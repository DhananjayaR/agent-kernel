// The Transport over Electron IPC: wraps `window.studio` (the preload's untyped wire) with the contract's types.
// A request resolves with the output or rejects with a StudioFailure; nothing is thrown as a bare string.
import {
	bridgeResultSchema,
	ERROR_CODES,
	type InputOf,
	type OperationName,
	type OutputOf,
	type StreamEventOf,
	type StreamInputOf,
	type StreamName,
	type StudioBridge,
	type StudioError,
	StudioFailure,
	streamMessageSchema,
	type Transport,
} from "@ak-studio/contract";

/** Called when a stream ends with an error (or sends something that is not a stream message). */
export type StreamErrorHandler = (stream: string, error: StudioError) => void;

export const logStreamError: StreamErrorHandler = (stream, error) => {
	console.error(`[studio] stream ${stream} failed: ${error.code}`, error);
};

function unavailable(detail: string): StudioError {
	return {
		code: ERROR_CODES.unavailable,
		message: "The app's bridge did not answer.",
		detail,
	};
}

export function createIpcTransport(
	studio: StudioBridge,
	onStreamError: StreamErrorHandler = logStreamError,
): Transport {
	return {
		async request<N extends OperationName>(
			name: N,
			input: InputOf<N>,
		): Promise<OutputOf<N>> {
			let reply: unknown;
			try {
				reply = await studio.request(name, input);
			} catch (err) {
				// IPC itself failed (e.g. the input could not be cloned): not an answer from the main process.
				throw new StudioFailure(
					unavailable(err instanceof Error ? err.message : String(err)),
				);
			}
			const parsed = bridgeResultSchema.safeParse(reply);
			if (!parsed.success) {
				throw new StudioFailure(
					unavailable(`${name}: the reply is not a result envelope`),
				);
			}
			if (!parsed.data.ok) throw new StudioFailure(parsed.data.error);
			return parsed.data.value as OutputOf<N>;
		},

		subscribe<N extends StreamName>(
			name: N,
			input: StreamInputOf<N>,
			onEvent: (event: StreamEventOf<N>) => void,
		): () => void {
			let closed = false;
			let unsubscribe: (() => void) | undefined;
			const stop = (): void => {
				if (closed) return;
				closed = true;
				unsubscribe?.();
			};
			try {
				unsubscribe = studio.subscribe(name, input, (raw) => {
					if (closed) return;
					const parsed = streamMessageSchema.safeParse(raw);
					if (!parsed.success) {
						onStreamError(name, unavailable("not a stream message"));
						return;
					}
					if (parsed.data.ok) {
						onEvent(parsed.data.event as StreamEventOf<N>);
					} else {
						// The main process ended the stream; also drop the preload's entry for it.
						stop();
						onStreamError(name, parsed.data.error);
					}
				});
			} catch (err) {
				closed = true;
				onStreamError(
					name,
					unavailable(err instanceof Error ? err.message : String(err)),
				);
				return () => {};
			}
			// The stream may have ended while `studio.subscribe` was still running.
			if (closed) unsubscribe();
			return stop;
		},
	};
}
