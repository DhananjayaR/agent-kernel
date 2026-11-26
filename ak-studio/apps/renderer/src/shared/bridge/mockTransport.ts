// The mock Transport, for the browser, tests and Storybook: answers from fixture handlers, with the same
// contract checks as the main process (input parsed, output and stream events parsed and stripped, exceptions
// turned into StudioErrors), so the renderer behaves the same against it as against the app.
import {
	type Contract,
	contract,
	DEFAULT_SHELL_LAYOUT,
	ERROR_CODES,
	type HandlerInputOf,
	type HandlerResultOf,
	type InputOf,
	lookup,
	type OperationName,
	type Operations,
	type OutputOf,
	runOperation,
	type ShellLayout,
	type StreamEventOf,
	type StreamHandlerEventOf,
	type StreamHandlerInputOf,
	type StreamInputOf,
	type StreamName,
	type Streams,
	StudioFailure,
	startStream,
	type ThemePreference,
	type Transport,
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

/** A fake window for the mock: a maximised flag that `window.toggleMaximize` flips and `window.state` reports. */
export interface MockWindow {
	maximized: boolean;
	listeners: Set<(maximized: boolean) => void>;
}

export function createMockWindow(): MockWindow {
	return { maximized: false, listeners: new Set() };
}

/**
 * TEMPORARY (P1b Task 3): the job, session and event operations have no fixture until the mock runs the runtime's
 * services (P1b Task 7, on Tasks 4 and 5). Until then each answers `bridge.unavailable`, as the app does.
 */
function notYetServed(name: string): never {
	throw new StudioFailure({
		code: ERROR_CODES.unavailable,
		message: "This part of the app is not available yet.",
		detail: `${name} has no service until a later P1b task.`,
	});
}

/**
 * Fixture answers: `app.info` reports the browser platform; `app.setTheme` and `app.setLayout` keep their values in
 * memory (a reload starts again from the defaults, as on a first run). The window requests act on `mockWindow`
 * (minimise and close do nothing in a browser).
 */
export function defaultMockHandlers(
	initialTheme: ThemePreference = "system",
	initialLayout: ShellLayout = DEFAULT_SHELL_LAYOUT,
	mockWindow: MockWindow = createMockWindow(),
): MockHandlers {
	let theme = initialTheme;
	let layout = initialLayout;
	return {
		"app.info": () => ({
			version: MOCK_VERSION,
			platform: "browser",
			theme,
			layout,
		}),
		"app.setLayout": (input) => {
			layout = input.layout;
			return { layout };
		},
		"app.setTheme": (input) => {
			theme = input.theme;
			return { theme };
		},
		"window.close": () => ({}),
		"window.minimize": () => ({}),
		"window.toggleMaximize": () => {
			mockWindow.maximized = !mockWindow.maximized;
			for (const listener of [...mockWindow.listeners])
				listener(mockWindow.maximized);
			return { maximized: mockWindow.maximized };
		},
		// TEMPORARY (P1b Task 3), replaced in Task 7.
		"job.cancel": () => notYetServed("job.cancel"),
		"job.respond": () => notYetServed("job.respond"),
		"jobs.dismissInterrupted": () => notYetServed("jobs.dismissInterrupted"),
		"jobs.interrupted": () => notYetServed("jobs.interrupted"),
		"jobs.list": () => notYetServed("jobs.list"),
		"session.start": () => notYetServed("session.start"),
		"session.stop": () => notYetServed("session.stop"),
		"sessions.list": () => notYetServed("sessions.list"),
	};
}

/** Fixture streams: `window.state` reports `mockWindow`'s flag at once and on every change. */
export function defaultMockStreams(
	mockWindow: MockWindow = createMockWindow(),
): MockStreamHandlers {
	return {
		"window.state": (_input, emit) => {
			const listener = (maximized: boolean) => emit({ maximized });
			mockWindow.listeners.add(listener);
			emit({ maximized: mockWindow.maximized });
			return () => {
				mockWindow.listeners.delete(listener);
			};
		},
		// TEMPORARY (P1b Task 3), replaced in Task 7: fails at once with bridge.unavailable.
		events: () => notYetServed("events"),
		"stream.read": () => notYetServed("stream.read"),
	};
}

export interface MockTransportOptions {
	/** Replace any of the default fixture handlers. */
	handlers?: Partial<MockHandlers>;
	streams?: Partial<MockStreamHandlers>;
	/** The contract to serve (default: the app's). Tests pass a test-local one. */
	contract?: Contract;
	/** Delay before each answer, to show pending states (default 0). */
	latencyMs?: number;
	onStreamError?: StreamErrorHandler;
}

export function createMockTransport(
	options: MockTransportOptions = {},
): Transport {
	const mockWindow = createMockWindow();
	const handlers: Partial<MockHandlers> = {
		...defaultMockHandlers("system", DEFAULT_SHELL_LAYOUT, mockWindow),
		...options.handlers,
	};
	const streamHandlers: Partial<MockStreamHandlers> = {
		...defaultMockStreams(mockWindow),
		...options.streams,
	};
	const onStreamError = options.onStreamError ?? logStreamError;
	const latencyMs = options.latencyMs ?? 0;
	const served: Contract = options.contract ?? contract;

	return {
		async request<N extends OperationName>(
			name: N,
			input: InputOf<N>,
		): Promise<OutputOf<N>> {
			const op = lookup(served.operations, name);
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
			const stream = lookup(served.streams, name);
			const handler = lookup(streamHandlers, name) as
				| ((input: unknown, emit: (event: unknown) => void) => () => void)
				| undefined;
			if (!stream || !handler) {
				onStreamError(name, unknownOperationError(name));
				return () => {};
			}
			// Same checks as the main process: input parsed, each event parsed; an invalid event ends the stream.
			const result = startStream(stream, handler, input, (message) => {
				if (message.ok) onEvent(message.event as StreamEventOf<N>);
				else onStreamError(name, message.error);
			});
			if (!result.ok) {
				onStreamError(name, result.error);
				return () => {};
			}
			return result.value;
		},
	};
}
