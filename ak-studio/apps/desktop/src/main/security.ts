// Security baseline helpers. Only `import type` from electron here: index.ts owns every Electron value, so this
// file stays unit-testable in plain Node.
import type { Session, WebContents } from "electron";

/** The app's own origin. The renderer is served from here in every build that is not the dev server. */
export const APP_SCHEME = "app";
export const APP_HOST = "studio";
export const APP_ORIGIN = `${APP_SCHEME}://${APP_HOST}`;
export const APP_URL = `${APP_ORIGIN}/`;

const BASE_CSP: ReadonlyArray<readonly [string, string]> = [
	["default-src", "'self'"],
	["script-src", "'self'"],
	["style-src", "'self' 'unsafe-inline'"],
	["img-src", "'self' data:"],
	["font-src", "'self'"],
	["connect-src", "'self'"],
];

/**
 * The content security policy. In development `devServerUrl` (electron-vite's dev server) is also allowed to
 * connect, over HTTP and its WebSocket (Vite's hot reload).
 */
export function buildCsp(devServerUrl?: string): string {
	const dev = devServerUrl ? devOrigins(devServerUrl) : [];
	return BASE_CSP.map(([directive, value]) =>
		directive === "connect-src" && dev.length > 0
			? `${directive} ${value} ${dev.join(" ")}`
			: `${directive} ${value}`,
	).join("; ");
}

/** The dev server's HTTP origin and the matching WebSocket origin. */
function devOrigins(devServerUrl: string): string[] {
	const url = new URL(devServerUrl);
	const ws = url.protocol === "https:" ? "wss:" : "ws:";
	return [url.origin, `${ws}//${url.host}`];
}

/**
 * Whether a request may leave the renderer. Only the app's own scheme and DevTools pass; in development, the dev
 * server's origin (HTTP and WebSocket) too. Everything else is cancelled: the app makes no network calls.
 */
export function isRequestAllowed(
	rawUrl: string,
	devServerUrl?: string,
): boolean {
	let url: URL;
	try {
		url = new URL(rawUrl);
	} catch {
		return false;
	}
	if (url.protocol === `${APP_SCHEME}:` || url.protocol === "devtools:")
		return true;
	if (!devServerUrl) return false;
	const allowed = devOrigins(devServerUrl);
	return allowed.includes(`${url.protocol}//${url.host}`);
}

/** Records every cancelled request so a test can assert that the app made none. */
export class RequestGate {
	readonly #devServerUrl: string | undefined;
	readonly #cancelled: string[] = [];

	constructor(devServerUrl?: string) {
		this.#devServerUrl = devServerUrl;
	}

	/** Returns true if the request must be cancelled, and records it. */
	shouldCancel(url: string): boolean {
		if (isRequestAllowed(url, this.#devServerUrl)) return false;
		this.#cancelled.push(url);
		return true;
	}

	get cancelledCount(): number {
		return this.#cancelled.length;
	}

	get cancelledUrls(): readonly string[] {
		return [...this.#cancelled];
	}
}

/** Cancels every request the gate refuses, on the given session. */
export function installRequestGate(session: Session, gate: RequestGate): void {
	session.webRequest.onBeforeRequest((details, callback) => {
		const cancel = gate.shouldCancel(details.url);
		if (cancel) console.warn(`[studio] blocked request: ${details.url}`);
		callback({ cancel });
	});
}

/**
 * Adds the CSP header to dev server responses. In production the app protocol handler sets the header itself
 * (custom-protocol responses do not pass through onHeadersReceived).
 */
export function installDevCspHeader(session: Session, csp: string): void {
	session.webRequest.onHeadersReceived((details, callback) => {
		callback({
			responseHeaders: {
				...details.responseHeaders,
				"Content-Security-Policy": [csp],
			},
		});
	});
}

/** No permission (camera, notifications, geolocation, ...) is ever granted in P1a. */
export function denyAllPermissions(session: Session): void {
	session.setPermissionRequestHandler((_contents, _permission, callback) =>
		callback(false),
	);
	session.setPermissionCheckHandler(() => false);
}

/** Navigation, redirects, new windows and webviews are all refused. External links are not opened in P1a. */
export function hardenWebContents(contents: WebContents): void {
	contents.on("will-navigate", (event) => event.preventDefault());
	contents.on("will-frame-navigate", (event) => event.preventDefault());
	contents.on("will-redirect", (event) => event.preventDefault());
	contents.on("will-attach-webview", (event) => event.preventDefault());
	contents.setWindowOpenHandler(() => ({ action: "deny" }));
}
