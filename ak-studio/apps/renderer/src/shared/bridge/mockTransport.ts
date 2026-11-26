// The mock Transport, for the browser, tests and Storybook. It runs a real ServiceRegistry from
// @ak-studio/runtime (pre-flight ruling 9), the same one the main process serves, so the renderer behaves the same
// against it as against the app: the input parsed, the output and stream events parsed and stripped, exceptions
// turned into StudioErrors, errors masked. Behind it: fixture handlers for `app.*` and `window.*` and for the
// operations of desktop-only feature services (desktopFixtures.ts), the runtime's EventBus, StreamHub,
// JobService and SessionService over an in-memory JobRecordStore, sharing the registry's masker, and the
// runtime's feature services (registerFeatureServices), as the app serves them.
import {
	type Contract,
	contract,
	DEFAULT_SHELL_LAYOUT,
	type HandlerInputOf,
	type HandlerResultOf,
	type InputOf,
	type OperationMap,
	type OperationName,
	type Operations,
	type OutputOf,
	type ShellLayout,
	type StreamEventOf,
	type StreamHandlerEventOf,
	type StreamHandlerInputOf,
	type StreamInputOf,
	type StreamMap,
	type StreamName,
	type Streams,
	type StudioError,
	StudioFailure,
	type ThemePreference,
	type Transport,
} from "@ak-studio/contract";
import {
	EventBus,
	FakeCommandRunner,
	FakeProjectFs,
	FakeWatcher,
	InMemoryJobRecordStore,
	JobService,
	type Log,
	ProjectScopes,
	registerFeatureServices,
	type SecretMasker,
	ServiceRegistry,
	SessionService,
	StreamHub,
} from "@ak-studio/runtime";
import { desktopFixtureHandlers, type FixtureDeps } from "./desktopFixtures";
import { FIXTURE_FILES } from "./fixtures";
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

/** The operations the mock answers from fixtures: the app's own and the window's. The services serve the rest. */
export type MockFixtureName = Extract<
	OperationName,
	`app.${string}` | `window.${string}`
>;

/** The fixture project's folder as the mock's FakeProjectFs holds it (an absolute path, as ProjectFs needs). */
export const MOCK_PROJECT_ROOT = "/projects/support-triage";

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
 * Fixture answers: `app.info` reports the browser platform; `app.setTheme` and `app.setLayout` keep their values in
 * memory (a reload starts again from the defaults, as on a first run); `app.setUnsaved` is accepted and ignored (a
 * browser has no quit rule). The window requests act on `mockWindow` (minimise and close do nothing in a browser).
 */
export function defaultMockHandlers(
	initialTheme: ThemePreference = "system",
	initialLayout: ShellLayout = DEFAULT_SHELL_LAYOUT,
	mockWindow: MockWindow = createMockWindow(),
): Pick<MockHandlers, MockFixtureName> {
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
		"app.setUnsaved": () => ({}),
		"window.close": () => ({}),
		"window.minimize": () => ({}),
		"window.toggleMaximize": () => {
			mockWindow.maximized = !mockWindow.maximized;
			for (const listener of [...mockWindow.listeners])
				listener(mockWindow.maximized);
			return { maximized: mockWindow.maximized };
		},
	};
}

/** Fixture streams: `window.state` reports `mockWindow`'s flag at once and on every change. */
export function defaultMockStreams(
	mockWindow: MockWindow = createMockWindow(),
): Pick<MockStreamHandlers, "window.state"> {
	return {
		"window.state": (_input, emit) => {
			const listener = (maximized: boolean) => emit({ maximized });
			mockWindow.listeners.add(listener);
			emit({ maximized: mockWindow.maximized });
			return () => {
				mockWindow.listeners.delete(listener);
			};
		},
	};
}

export interface MockTransportOptions {
	/** Replace any handler: a fixture's, or one a service registers. */
	handlers?: Partial<MockHandlers>;
	streams?: Partial<MockStreamHandlers>;
	/** The contract to serve (default: the app's). Tests pass a test-local one; only what it declares is served. */
	contract?: Contract;
	/** Delay before each answer, to show pending states (default 0). */
	latencyMs?: number;
	onStreamError?: StreamErrorHandler;
	/** Where the registry and the services report bugs, as main's log does (default: the console). */
	log?: Log;
}

/** The mock's transport and the services behind it, for tests that emit events or watch jobs and sessions. */
export interface MockBackend {
	transport: Transport;
	registry: ServiceRegistry<OperationMap, StreamMap>;
	masker: SecretMasker;
	events: EventBus;
	streams: StreamHub;
	scopes: ProjectScopes;
	jobs: JobService;
	sessions: SessionService;
	window: MockWindow;
	/** The ports' fakes the features' runtime services are built with, for tests to script and inspect. */
	commandRunner: FakeCommandRunner;
	projectFs: FakeProjectFs;
	watcher: FakeWatcher;
}

type AnyRequestHandler = (input: unknown) => unknown;
type AnyStreamHandler = (
	input: unknown,
	emit: (event: unknown) => void,
) => () => void;

/** Collects the handlers a service registers, so fixtures and overrides can be merged before the registry starts. */
class HandlerCollector {
	readonly requests = new Map<string, AnyRequestHandler>();
	readonly streams = new Map<string, AnyStreamHandler>();

	handle(name: string, handler: (input: never) => unknown): this {
		this.requests.set(name, handler as AnyRequestHandler);
		return this;
	}

	handleStream(
		name: string,
		handler: (input: never, emit: never) => () => void,
	): this {
		this.streams.set(name, handler as AnyStreamHandler);
		return this;
	}
}

const consoleLog: Log = (message) => console.error(`[studio mock] ${message}`);

/**
 * Builds the mock: services first, then fixtures, then the caller's overrides, each registered on a real
 * ServiceRegistry if the served contract declares it. The registry starts at once, so a declared operation with
 * no handler throws here, as the app refuses to start.
 */
export function createMockBackend(
	options: MockTransportOptions = {},
): MockBackend {
	const log = options.log ?? consoleLog;
	const served: Contract = options.contract ?? contract;
	const registry = new ServiceRegistry<OperationMap, StreamMap>({
		contract: served,
		log,
	});
	const masker = registry.masker;
	const events = new EventBus({ masker, log });
	const streams = new StreamHub({ masker, log: (m) => log(masker.mask(m)) });
	const scopes = new ProjectScopes({ masker, log });
	const jobs = new JobService({
		events,
		streams,
		scopes,
		records: new InMemoryJobRecordStore(),
		masker,
		log,
	});
	const sessions = new SessionService({ events, streams, scopes, masker, log });

	const collected = new HandlerCollector();
	for (const service of [events, streams, jobs, sessions]) {
		service.register(collected as never);
	}
	// The features' runtime services, over the ports' fakes: commands run nothing, the project folder is the
	// support-triage fixture in memory, and the watcher reports only what a test announces.
	const commandRunner = new FakeCommandRunner();
	const projectFs = new FakeProjectFs(MOCK_PROJECT_ROOT, FIXTURE_FILES);
	const watcher = new FakeWatcher();
	registerFeatureServices(collected, {
		commandRunner,
		projectFs,
		watcher,
		jobs,
		sessions,
		streams,
		events,
		scopes,
		masker,
	});
	const mockWindow = createMockWindow();
	const requests: Record<string, AnyRequestHandler> = {
		...Object.fromEntries(collected.requests),
		...(defaultMockHandlers(
			"system",
			DEFAULT_SHELL_LAYOUT,
			mockWindow,
		) as Record<string, AnyRequestHandler>),
		...Object.fromEntries(
			Object.entries(desktopFixtureHandlers).map(([name, answer]) => [
				name,
				(input: unknown) =>
					(answer as (input: unknown, deps: FixtureDeps) => unknown)(input, {
						scopes,
					}),
			]),
		),
		...(options.handlers as Record<string, AnyRequestHandler> | undefined),
	};
	const streamHandlers: Record<string, AnyStreamHandler> = {
		...Object.fromEntries(collected.streams),
		...(defaultMockStreams(mockWindow) as Record<string, AnyStreamHandler>),
		...(options.streams as Record<string, AnyStreamHandler> | undefined),
	};
	for (const [name, handler] of Object.entries(requests)) {
		if (Object.hasOwn(served.operations, name))
			registry.handle(name, handler as never);
	}
	for (const [name, handler] of Object.entries(streamHandlers)) {
		if (Object.hasOwn(served.streams, name))
			registry.handleStream(name, handler as never);
	}
	registry.start();

	const transport = createRegistryTransport(registry, {
		latencyMs: options.latencyMs ?? 0,
		onStreamError: options.onStreamError ?? logStreamError,
		log,
	});
	return {
		transport,
		registry,
		masker,
		events,
		streams,
		scopes,
		jobs,
		sessions,
		window: mockWindow,
		commandRunner,
		projectFs,
		watcher,
	};
}

export function createMockTransport(
	options: MockTransportOptions = {},
): Transport {
	return createMockBackend(options).transport;
}

/**
 * A Transport over a registry in the same page: what IPC does in the app, without the wire. A request rejects
 * with a StudioFailure; a stream's events and its end reach the caller through callbacks that never throw back
 * into the services (StreamHub calls them from a timer, EventBus from inside `emit`).
 */
function createRegistryTransport(
	registry: ServiceRegistry<OperationMap, StreamMap>,
	options: { latencyMs: number; onStreamError: StreamErrorHandler; log: Log },
): Transport {
	const { latencyMs, onStreamError, log } = options;
	const guarded =
		<A extends unknown[]>(what: string, fn: (...args: A) => void) =>
		(...args: A): void => {
			try {
				fn(...args);
			} catch (err) {
				log(
					`${what} failed: ${err instanceof Error ? err.message : String(err)}`,
				);
			}
		};
	return {
		async request<N extends OperationName>(
			name: N,
			input: InputOf<N>,
		): Promise<OutputOf<N>> {
			if (latencyMs > 0) await new Promise((r) => setTimeout(r, latencyMs));
			const result = await registry.request(name, input);
			if (!result.ok) throw new StudioFailure(result.error);
			return result.value as OutputOf<N>;
		},

		subscribe<N extends StreamName>(
			name: N,
			input: StreamInputOf<N>,
			onEvent: (event: StreamEventOf<N>) => void,
			onError?: (error: StudioError) => void,
		): () => void {
			const deliver = guarded(`${name}: a subscriber`, onEvent);
			const logError = guarded(`${name}: the error handler`, onStreamError);
			const tell = guarded(
				`${name}: the subscriber's error handler`,
				(error: StudioError) => onError?.(error),
			);
			const report = (error: StudioError): void => {
				logError(name, error);
				tell(error);
			};
			const result = registry.subscribe(name, input, (message) => {
				if (message.ok) deliver(message.event as StreamEventOf<N>);
				else report(message.error);
			});
			if (!result.ok) {
				report(result.error);
				return () => {};
			}
			return result.value;
		},
	};
}
