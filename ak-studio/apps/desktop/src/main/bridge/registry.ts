// The service registry: services register a handler for each operation in the contract; the IPC server calls
// `request` and `subscribe`. Every input is parsed here, in the main process, every output is parsed against
// its schema, and every exception becomes a StudioError value. Nothing here throws across the bridge.
// No Electron import: the registry is transport-free.
import {
	type BridgeResult,
	type Contract,
	ERROR_CODES,
	fail,
	type HandlerInputOf,
	type HandlerResultOf,
	lookup,
	type Operation,
	type OperationMap,
	type Operations,
	ok,
	parseInput,
	runOperation,
	type Stream,
	type StreamHandlerEventOf,
	type StreamHandlerInputOf,
	type StreamMap,
	type StreamMessage,
	type Streams,
	contract as studioContract,
	toStudioError,
	unknownOperationError,
} from "@ak-studio/contract";

export type RequestHandler<Op extends Operation> = (
	input: HandlerInputOf<Op>,
) => HandlerResultOf<Op> | Promise<HandlerResultOf<Op>>;

/** Starts a stream; calls `emit` for each event; returns the function that stops it. */
export type StreamHandler<St extends Stream> = (
	input: StreamHandlerInputOf<St>,
	emit: (event: StreamHandlerEventOf<St>) => void,
) => () => void;

/** A main-process service: one class per domain, registering its handlers against the contract. */
export interface Service<
	Ops extends OperationMap = Operations,
	S extends StreamMap = Streams,
> {
	register(registry: ServiceRegistry<Ops, S>): void;
}

type Log = (message: string) => void;

export class ServiceRegistry<
	Ops extends OperationMap = Operations,
	S extends StreamMap = Streams,
> {
	readonly #contract: Contract<Ops, S>;
	readonly #log: Log;
	readonly #requests = new Map<string, (input: unknown) => unknown>();
	readonly #streams = new Map<
		string,
		(input: unknown, emit: (event: unknown) => void) => () => void
	>();
	#started = false;

	constructor(
		contract: Contract<Ops, S> = studioContract as unknown as Contract<Ops, S>,
		log: Log = (message) => console.error(`[studio] ${message}`),
	) {
		this.#contract = contract;
		this.#log = log;
	}

	/** Registers the handler for a declared request. Throws (a start-up bug) if undeclared or registered twice. */
	handle<N extends keyof Ops & string>(
		name: N,
		handler: RequestHandler<Ops[N]>,
	): this {
		this.#assertRegistrable(name, lookup(this.#contract.operations, name));
		this.#requests.set(name, handler as (input: unknown) => unknown);
		return this;
	}

	/** Registers the handler for a declared stream. Throws (a start-up bug) if undeclared or registered twice. */
	handleStream<N extends keyof S & string>(
		name: N,
		handler: StreamHandler<S[N]>,
	): this {
		this.#assertRegistrable(name, lookup(this.#contract.streams, name));
		this.#streams.set(
			name,
			handler as (input: unknown, emit: (event: unknown) => void) => () => void,
		);
		return this;
	}

	/** Lets a service register all its handlers. */
	register(service: Service<Ops, S>): this {
		service.register(this);
		return this;
	}

	/** Declared operations and streams with no handler, sorted. */
	missingHandlers(): string[] {
		return [
			...Object.keys(this.#contract.operations).filter(
				(name) => !this.#requests.has(name),
			),
			...Object.keys(this.#contract.streams).filter(
				(name) => !this.#streams.has(name),
			),
		].sort();
	}

	/**
	 * Ends registration. Throws if any declared operation or stream has no handler, so the app refuses to start
	 * rather than fail on first use. Until it succeeds, every request answers `bridge.unavailable`.
	 */
	start(): void {
		const missing = this.missingHandlers();
		if (missing.length > 0) {
			throw new Error(
				`no handler registered for: ${missing.join(", ")} (every operation in the contract needs one)`,
			);
		}
		this.#started = true;
	}

	get started(): boolean {
		return this.#started;
	}

	/** Answers one request. Never throws or rejects. */
	async request(name: unknown, input: unknown): Promise<BridgeResult> {
		if (!this.#started) return fail(notStarted());
		const op = lookup(this.#contract.operations, name);
		const handler = typeof name === "string" && this.#requests.get(name);
		if (!op || !handler) return fail(unknownOperationError(name));
		const result = await runOperation(op, handler, input);
		if (!result.ok) this.#logFailure(op.name, result.error);
		return result;
	}

	/**
	 * Starts a stream. Each event reaches `send` as `{ ok: true, event }`. On success, answers the function that
	 * stops it (idempotent; no event is sent after it). On failure, answers the StudioError and starts nothing.
	 */
	subscribe(
		name: unknown,
		input: unknown,
		send: (message: StreamMessage) => void,
	): BridgeResult<() => void> {
		if (!this.#started) return fail(notStarted());
		const stream = lookup(this.#contract.streams, name);
		const handler = typeof name === "string" && this.#streams.get(name);
		if (!stream || !handler) return fail(unknownOperationError(name));
		const parsed = parseInput(stream.input, stream.name, input);
		if (!parsed.ok) return parsed;
		let open = true;
		let stop: () => void;
		try {
			stop = handler(parsed.value, (event) => {
				if (open) send({ ok: true, event });
			});
		} catch (err) {
			open = false;
			const error = toStudioError(err);
			this.#logFailure(stream.name, error);
			return fail(error);
		}
		return ok(() => {
			if (!open) return;
			open = false;
			try {
				stop();
			} catch (err) {
				this.#log(`stopping ${stream.name} failed: ${String(err)}`);
			}
		});
	}

	#assertRegistrable(name: string, declared: unknown): void {
		if (this.#started) {
			throw new Error(`cannot register ${name}: the registry has started`);
		}
		if (!declared) throw new Error(`${name} is not declared in the contract`);
		if (this.#requests.has(name) || this.#streams.has(name)) {
			throw new Error(`${name} already has a handler`);
		}
	}

	// A broken output or an unexpected exception is a main-process bug: say so in the log. Input errors are the
	// caller's and are only returned.
	#logFailure(name: string, error: { code: string; detail?: string }): void {
		if (
			error.code === ERROR_CODES.invalidOutput ||
			error.code === ERROR_CODES.internal
		) {
			this.#log(`${name} failed with ${error.code}: ${error.detail ?? ""}`);
		}
	}
}

function notStarted() {
	return {
		code: ERROR_CODES.unavailable,
		message: "The app is still starting.",
	};
}
