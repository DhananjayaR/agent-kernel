// The renderer's one entry point to the bridge. It picks the IPC transport when the preload exposed
// `window.studio` (the Electron app), and the mock transport in a plain browser. Served from `app:` without
// `window.studio` (the preload failed), it never falls back to fixtures: every call fails with
// `bridge.unavailable`, so the app shows an error instead of fake data.
import {
	ERROR_CODES,
	type StudioBridge,
	type StudioError,
	StudioFailure,
	type Transport,
} from "@ak-studio/contract";
import { createIpcTransport, logStreamError } from "./ipcTransport";
import { createMockTransport } from "./mockTransport";

export type { StudioError, Transport } from "@ak-studio/contract";
export { isStudioFailure, StudioFailure } from "@ak-studio/contract";

export type TransportKind = "ipc" | "mock" | "unavailable";

/** The error every call gets when the app's own page has no bridge. */
export const BRIDGE_MISSING_ERROR: StudioError = {
	code: ERROR_CODES.unavailable,
	message: "The app's bridge is not available.",
	detail:
		"window.studio is missing on the app's own page (the preload did not load)",
};

/** A transport whose every request rejects, and every stream fails, with `error`. */
export function createUnavailableTransport(error: StudioError): Transport {
	return {
		request: () => Promise.reject(new StudioFailure(error)),
		subscribe: (name) => {
			logStreamError(name, error);
			return () => {};
		},
	};
}

function isStudioBridge(value: unknown): value is StudioBridge {
	return (
		typeof value === "object" &&
		value !== null &&
		typeof (value as StudioBridge).request === "function" &&
		typeof (value as StudioBridge).subscribe === "function"
	);
}

/** `window.studio` if the preload exposed it, else undefined (also outside a browser, as in unit tests). */
export function readStudioGlobal(): StudioBridge | undefined {
	const studio = typeof window === "undefined" ? undefined : window.studio;
	return isStudioBridge(studio) ? studio : undefined;
}

/** Whether the page is served from the app's own `app:` protocol (the Electron app, not a browser). */
export function isServedFromApp(): boolean {
	return typeof location !== "undefined" && location.protocol === "app:";
}

/**
 * The transport for a given `window.studio`: IPC when it is present; when it is absent, the mock in a browser,
 * or the unavailable transport on the app's own page (`servedFromApp`).
 */
export function selectTransport(
	studio: StudioBridge | undefined,
	servedFromApp = false,
): { kind: TransportKind; transport: Transport } {
	if (studio) return { kind: "ipc", transport: createIpcTransport(studio) };
	if (servedFromApp) {
		return {
			kind: "unavailable",
			transport: createUnavailableTransport(BRIDGE_MISSING_ERROR),
		};
	}
	return { kind: "mock", transport: createMockTransport() };
}

let current: { kind: TransportKind; transport: Transport } | undefined;

function selected(): { kind: TransportKind; transport: Transport } {
	current ??= selectTransport(readStudioGlobal(), isServedFromApp());
	return current;
}

/** The app's transport, chosen once on first use. */
export function getTransport(): Transport {
	return selected().transport;
}

/** Which transport `getTransport` returns. */
export function getTransportKind(): TransportKind {
	return selected().kind;
}

/** For tests and Storybook: use `transport` from now on (`undefined` chooses again on next use). */
export function setTransport(
	transport: Transport | undefined,
	kind: TransportKind = "mock",
): void {
	current = transport ? { kind, transport } : undefined;
}
