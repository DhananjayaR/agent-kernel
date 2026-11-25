// The mock Transport, for the browser, tests and Storybook: answers from fixture handlers, with the same
// contract checks as the main process (input parsed, output parsed and stripped, exceptions turned into
// StudioErrors), so the renderer behaves the same against it as against the app.
import {
	type HandlerInputOf,
	type HandlerResultOf,
	type InputOf,
	lookup,
	type OperationName,
	type Operations,
	type OutputOf,
	operations,
	parseInput,
	runOperation,
	type StreamEventOf,
	type StreamHandlerEventOf,
	type StreamHandlerInputOf,
	type StreamInputOf,
	type StreamMap,
	type StreamName,
	type Streams,
	StudioFailure,
	streams,
	type ThemePreference,
	type Transport,
	toStudioError,
	unknownOperationError,
} from "@ak-studio/contract";
import { logStreamError, type StreamErrorHandler } from "./ipcTransport";

export type MockHandlers = {
	[N in OperationName]: (
		input: HandlerInputOf<Operations[N]>,
	) => HandlerResultOf<Operations[N]> | Promise<HandlerResultOf<Operations[N]>>;
};

export type MockStreamHandlers = {
	[N in StreamName]: (
		input: StreamHandlerInputOf<Streams[N]>,
		emit: (event: StreamHandlerEventOf<Streams[N]>) => void,
	) => () => void;
};

/** The version the mock reports for `app.info`. */
export const MOCK_VERSION = "0.0.0-mock";

/** Fixture answers: `app.info` reports the browser platform; `app.setTheme` keeps the theme in memory. */
export function defaultMockHandlers(
	initialTheme: ThemePreference = "system",
): MockHandlers {
	let theme = initialTheme;
	return {
		"app.info": () => ({ version: MOCK_VERSION, platform: "browser", theme }),
		"app.setTheme": (input) => {
			theme = input.theme;
			return { theme };
		},
	};
}

export interface MockTransportOptions {
	/** Replace any of the default fixture handlers. */
	handlers?: Partial<MockHandlers>;
	streams?: Partial<MockStreamHandlers>;
	/** Delay before each answer, to show pending states (default 0). */
	latencyMs?: number;
	onStreamError?: StreamErrorHandler;
}

export function createMockTransport(
	options: MockTransportOptions = {},
): Transport {
	const handlers: Partial<MockHandlers> = {
		...defaultMockHandlers(),
		...options.handlers,
	};
	const streamHandlers: Partial<MockStreamHandlers> = { ...options.streams };
	const onStreamError = options.onStreamError ?? logStreamError;
	const latencyMs = options.latencyMs ?? 0;

	return {
		async request<N extends OperationName>(
			name: N,
			input: InputOf<N>,
		): Promise<OutputOf<N>> {
			const op = lookup(operations, name);
			const handler = lookup(handlers, name) as
				| ((input: unknown) => unknown)
				| undefined;
			if (latencyMs > 0) await new Promise((r) => setTimeout(r, latencyMs));
			if (!op || !handler) throw new StudioFailure(unknownOperationError(name));
			const result = await runOperation(op, handler, input);
			if (!result.ok) throw new StudioFailure(result.error);
			return result.value as OutputOf<N>;
		},

		subscribe<N extends StreamName>(
			name: N,
			input: StreamInputOf<N>,
			onEvent: (event: StreamEventOf<N>) => void,
		): () => void {
			const stream = lookup(streams as StreamMap, name);
			const handler = lookup(streamHandlers, name) as
				| ((input: unknown, emit: (event: unknown) => void) => () => void)
				| undefined;
			if (!stream || !handler) {
				onStreamError(name, unknownOperationError(name));
				return () => {};
			}
			const parsed = parseInput(stream.input, name, input);
			if (!parsed.ok) {
				onStreamError(name, parsed.error);
				return () => {};
			}
			let open = true;
			let stop: () => void;
			try {
				stop = handler(parsed.value, (event) => {
					if (open) onEvent(event as StreamEventOf<N>);
				});
			} catch (err) {
				onStreamError(name, toStudioError(err));
				return () => {};
			}
			return () => {
				if (!open) return;
				open = false;
				stop();
			};
		},
	};
}
