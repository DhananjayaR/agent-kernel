// The renderer's only way to reach the main process. Two implementations: Electron IPC (over `window.studio`)
// and a mock for the browser and tests. The same renderer code runs on both.
import "./zodConfig";
import { z } from "zod";
import { ERROR_CODES, type StudioError, studioErrorSchema } from "./errors";
import type {
	InputOf,
	OperationName,
	OutputOf,
	StreamEventOf,
	StreamInputOf,
	StreamName,
} from "./operations";

/**
 * Typed calls against the contract.
 * - `request` resolves with the operation's output, or rejects with a `StudioFailure` carrying the StudioError.
 * - `subscribe` delivers each event to `onEvent` until the returned function is called. A stream that fails
 *   (unknown name, invalid input, a failing handler) ends; the transport logs its StudioError and then calls
 *   `onError` with it, once (possibly before `subscribe` returns). Nothing more arrives after that: a caller that
 *   wants the stream again subscribes again (the app's `events` subscription does, with a backoff).
 */
export interface Transport {
	request<N extends OperationName>(
		name: N,
		input: InputOf<N>,
	): Promise<OutputOf<N>>;
	subscribe<N extends StreamName>(
		name: N,
		input: StreamInputOf<N>,
		onEvent: (event: StreamEventOf<N>) => void,
		onError?: (error: StudioError) => void,
	): () => void;
}

/**
 * What the preload exposes as `window.studio`: the untyped wire, which `ipcTransport` wraps.
 * - `request` resolves with a BridgeResult envelope.
 * - `subscribe` calls `onEvent` with a StreamMessage envelope for each message of the stream.
 */
export interface StudioBridge {
	request(op: string, input: unknown): Promise<unknown>;
	subscribe(
		op: string,
		input: unknown,
		onEvent: (message: unknown) => void,
	): () => void;
}

/** The reply to a request, as it crosses the bridge. */
export const bridgeResultSchema = z.discriminatedUnion("ok", [
	z.object({ ok: z.literal(true), value: z.unknown() }),
	z.object({ ok: z.literal(false), error: studioErrorSchema }),
]);

/** One message of a stream, as it crosses the bridge. An `ok: false` message ends the stream. */
export const streamMessageSchema = z.discriminatedUnion("ok", [
	z.object({ ok: z.literal(true), event: z.unknown() }),
	z.object({ ok: z.literal(false), error: studioErrorSchema }),
]);
export type StreamMessage = z.infer<typeof streamMessageSchema>;

export function unknownOperationError(name: unknown): StudioError {
	return {
		code: ERROR_CODES.unknownOperation,
		message: "The app does not know this operation.",
		detail: typeof name === "string" ? name : `(${typeof name})`,
	};
}
