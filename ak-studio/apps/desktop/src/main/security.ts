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

const LOOPBACK_HOSTS: ReadonlySet<string> = new Set([
	"localhost",
	"127.0.0.1",
	"[::1]",
]);

/** Whether `rawUrl` is an http(s) URL on a loopback host: the only kind of dev server the app trusts. */
export function isLoopbackDevServerUrl(rawUrl: string): boolean {
	try {
		const url = new URL(rawUrl);
		return (
			(url.protocol === "http:" || url.protocol === "https:") &&
			LOOPBACK_HOSTS.has(url.hostname)
		);
	} catch {
		return false;
	}
}

/**
 * The dev server URL to trust: none in packaged builds; in unpackaged builds `ELECTRON_RENDERER_URL` if set,
 * which must be on a loopback host. Throws otherwise, so the app refuses to start.
 */
export function resolveDevServerUrl(
	isPackaged: boolean,
	envValue: string | undefined,
): string | undefined {
	if (isPackaged || !envValue) return undefined;
	if (!isLoopbackDevServerUrl(envValue)) {
		throw new Error(
			`ELECTRON_RENDERER_URL must be an http(s) URL on localhost, 127.0.0.1 or [::1]; got ${JSON.stringify(envValue)}`,
		);
	}
	return envValue;
}

/** Scheme and host only, for logs: full URLs can carry paths and query strings that do not belong in a log. */
export function describeOrigin(rawUrl: string): string {
	try {
		const url = new URL(rawUrl);
		return url.host ? `${url.protocol}//${url.host}` : url.protocol;
	} catch {
		return "<invalid url>";
	}
}

/** How many cancelled URLs the gate keeps (the newest); the count itself is always exact. */
export const MAX_RECORDED_URLS = 100;

/** Counts every cancelled request so a test can assert that the app made none. */
export class RequestGate {
	readonly #devServerUrl: string | undefined;
	readonly #recent: string[] = [];
	#count = 0;

	constructor(devServerUrl?: string) {
		this.#devServerUrl = devServerUrl;
	}

	/** Returns true if the request must be cancelled, and records it. */
	shouldCancel(url: string): boolean {
		if (isRequestAllowed(url, this.#devServerUrl)) return false;
		this.#count++;
		this.#recent.push(url);
		if (this.#recent.length > MAX_RECORDED_URLS) this.#recent.shift();
		return true;
	}

	get cancelledCount(): number {
		return this.#count;
	}

	/** The newest MAX_RECORDED_URLS cancelled URLs, oldest first. */
	get cancelledUrls(): readonly string[] {
		return [...this.#recent];
	}
}

/**
 * Cancels every request the gate refuses, on the given session. This sees Chromium's network stack only (the
 * renderer, and `net`/`session` requests from main); Node's `fetch`, `http` and `net` modules bypass it.
 */
export function installRequestGate(session: Session, gate: RequestGate): void {
	session.webRequest.onBeforeRequest((details, callback) => {
		const cancel = gate.shouldCancel(details.url);
		if (cancel)
			console.warn(`[studio] blocked request: ${describeOrigin(details.url)}`);
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

/**
 * Whether the page may navigate to `rawUrl`. Never in production (a page-initiated reload counts as a
 * navigation, and the app has no use for one). In development, only within the dev server's origin, so Vite's
 * full-page reload works.
 */
export function isNavigationAllowed(
	rawUrl: string,
	devServerUrl?: string,
): boolean {
	if (!devServerUrl) return false;
	try {
		return new URL(rawUrl).origin === new URL(devServerUrl).origin;
	} catch {
		return false;
	}
}

/**
 * Navigation (except, in development, within the dev server), redirects, new windows and webviews are refused.
 * External links are not opened in P1a.
 */
export function hardenWebContents(
	contents: WebContents,
	devServerUrl?: string,
): void {
	const guard = (event: { url: string; preventDefault(): void }): void => {
		if (!isNavigationAllowed(event.url, devServerUrl)) event.preventDefault();
	};
	contents.on("will-navigate", guard);
	contents.on("will-frame-navigate", guard);
	contents.on("will-redirect", (event) => event.preventDefault());
	contents.on("will-attach-webview", (event) => event.preventDefault());
	contents.setWindowOpenHandler(() => ({ action: "deny" }));
}
