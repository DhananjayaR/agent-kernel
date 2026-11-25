// The renderer's one entry point to the bridge. It picks the IPC transport when the preload exposed
// `window.studio` (the Electron app), and the mock transport otherwise (a plain browser).
import type { StudioBridge, Transport } from "@ak-studio/contract";
import { createIpcTransport } from "./ipcTransport";
import { createMockTransport } from "./mockTransport";

export type { StudioError, Transport } from "@ak-studio/contract";
export { isStudioFailure, StudioFailure } from "@ak-studio/contract";

export type TransportKind = "ipc" | "mock";

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

/** The transport for a given `window.studio`: IPC when it is present, the mock when it is absent. */
export function selectTransport(studio: StudioBridge | undefined): {
	kind: TransportKind;
	transport: Transport;
} {
	return studio
		? { kind: "ipc", transport: createIpcTransport(studio) }
		: { kind: "mock", transport: createMockTransport() };
}

let current: { kind: TransportKind; transport: Transport } | undefined;

function selected(): { kind: TransportKind; transport: Transport } {
	current ??= selectTransport(readStudioGlobal());
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
