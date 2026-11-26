// The service registry: services register a handler for each operation in the contract; a transport calls
// `request` and `subscribe` (the desktop's IPC server, and from P1b Task 7 the browser's mock transport). Every
// input is parsed here, every output is parsed against its schema, and every exception becomes a StudioError
// value. Nothing here throws across the bridge. Before a handler runs, an operation that names a kernel
// capability is checked against the project's version; before an error leaves, its message, detail, file and
// action label are masked. Moved from apps/desktop in P1b (ruling 9): it is transport-free and browser-safe.
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
	type ProjectId,
	runOperation,
	type Stream,
	type StreamHandlerEventOf,
	type StreamHandlerInputOf,
	type StreamMap,
	type StreamMessage,
	type Streams,
	type StudioError,
	StudioFailure,
	startStream,
	contract as studioContract,
	unknownOperationError,
} from "@ak-studio/contract";
import { defaultLog, type Log } from "./host";
import { SecretMasker } from "./secrets";
import { strings } from "./strings";

export type RequestHandler<Op extends Operation> = (
	input: HandlerInputOf<Op>,
) => HandlerResultOf<Op> | Promise<HandlerResultOf<Op>>;

/** Starts a stream; calls `emit` for each event; returns the function that stops it. */
export type StreamHandler<St extends Stream> = (
	input: StreamHandlerInputOf<St>,
	emit: (event: StreamHandlerEventOf<St>) => void,
) => () => void;

/** What a service needs to serve one stream: lets it register on any registry whose contract declares it. */
export interface StreamRegistrar<Name extends string, St extends Stream> {
	handleStream(name: Name, handler: StreamHandler<St>): unknown;
}

/**
 * What a service needs to serve some requests: lets it register on any registry whose contract declares them
 * (the app's, or a test contract that adds kinds of its own).
 */
export interface RequestRegistrar<Ops extends OperationMap> {
	handle<N extends keyof Ops & string>(
		name: N,
		handler: RequestHandler<Ops[N]>,
	): unknown;
}

/** A service: one class per domain, registering its handlers against the contract. */
export interface Service<
	Ops extends OperationMap = Operations,
	S extends StreamMap = Streams,
> {
	register(registry: ServiceRegistry<Ops, S>): void;
}

/** Whether the project's OAK version has a kernel capability. P2 brings the real catalog; P1b tests fake it. */
export interface CapabilityChecker {
	status(
		capability: string,
		projectId?: ProjectId,
	): "available" | "needs-upgrade" | "removed";
}

export interface ServiceRegistryOptions<
	Ops extends OperationMap = Operations,
	S extends StreamMap = Streams,
> {
	/** The contract to serve. Defaults to the app's. */
	contract?: Contract<Ops, S>;
	/** Where bugs are reported: a broken output, an unexpected exception, an undeclared error code. */
	log?: Log;
	/**
	 * Checks the capability an operation names. Required when any operation names one: without it `start()`
	 * throws, and a request for such an operation is refused (the check fails closed).
	 */
	capabilities?: CapabilityChecker;
	/**
	 * Masks known secrets in every error's message, detail, file and action label. Defaults to a new one that knows none; services
	 * that mask (StreamHub) take it from `registry.masker`, so there is one set of known secrets.
	 */
	masker?: SecretMasker;
}

export class ServiceRegistry<
	Ops extends OperationMap = Operations,
	S extends StreamMap = Streams,
> {
	readonly #contract: Contract<Ops, S>;
	readonly #log: Log;
	readonly #capabilities: CapabilityChecker | undefined;
	readonly #masker: SecretMasker;
	readonly #requests = new Map<string, (input: unknown) => unknown>();
	readonly #streams = new Map<
		string,
		(input: unknown, emit: (event: unknown) => void) => () => void
	>();
	#started = false;

	constructor(options: ServiceRegistryOptions<Ops, S> = {}) {
		this.#contract =
			options.contract ?? (studioContract as unknown as Contract<Ops, S>);
		this.#log = options.log ?? defaultLog;
		this.#capabilities = options.capabilities;
		this.#masker = options.masker ?? new SecretMasker();
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
	 * Ends registration. Throws if any declared operation or stream has no handler, or if an operation names a
	 * capability and no CapabilityChecker was given, so the app refuses to start rather than fail (or skip the
	 * check) on first use. Until it succeeds, every request answers `bridge.unavailable`.
	 */
	start(): void {
		const missing = this.missingHandlers();
		if (missing.length > 0) {
			throw new Error(
				`no handler registered for: ${missing.join(", ")} (every operation in the contract needs one)`,
			);
		}
		if (!this.#capabilities) {
			const gated = Object.values(this.#contract.operations).find(
				(op) => op.capability !== undefined,
			);
			if (gated) {
				throw new Error(
					`${gated.name} names a capability (${gated.capability}) but the registry has no CapabilityChecker`,
				);
			}
		}
		this.#started = true;
	}

	/** The masker every error is masked with. */
	get masker(): SecretMasker {
		return this.#masker;
	}

	get started(): boolean {
		return this.#started;
	}

	/**
	 * Answers one request. Never throws or rejects. The input is parsed first; then, if the operation names a
	 * capability that is not available for the input's `projectId`, it answers `kernel.capabilityUnavailable`
	 * without calling the handler. An error's text fields are masked before it is logged or returned.
	 */
	async request(name: unknown, input: unknown): Promise<BridgeResult> {
		if (!this.#started) return fail(notStarted());
		const op = lookup(this.#contract.operations, name);
		const handler = typeof name === "string" && this.#requests.get(name);
		if (!op || !handler) return fail(this.#mask(unknownOperationError(name)));
		const capability = op.capability;
		const guarded =
			capability === undefined
				? handler
				: (parsed: unknown) => {
						this.#requireCapability(capability, parsed);
						return handler(parsed);
					};
		const result = await runOperation(op, guarded, input);
		if (result.ok) return result;
		const error = this.#mask(result.error);
		this.#logFailure(op.name, error);
		this.#checkDeclared(op, error);
		return fail(error);
	}

	/**
	 * Starts a stream (see `startStream`): each event is parsed against its schema and reaches `send` as
	 * `{ ok: true, event }`; an invalid event ends the stream with one `bridge.invalidOutput` message, logged. On
	 * success, answers the function that stops it. On failure, answers the StudioError and starts nothing.
	 */
	subscribe(
		name: unknown,
		input: unknown,
		send: (message: StreamMessage) => void,
	): BridgeResult<() => void> {
		if (!this.#started) return fail(notStarted());
		const stream = lookup(this.#contract.streams, name);
		const handler = typeof name === "string" && this.#streams.get(name);
		if (!stream || !handler)
			return fail(this.#mask(unknownOperationError(name)));
		const result = startStream(
			stream,
			handler,
			input,
			(message) => {
				if (message.ok) return send(message);
				const error = this.#mask(message.error);
				this.#logFailure(stream.name, error);
				send({ ok: false, error });
			},
			(err) =>
				this.#log(
					this.#masker.mask(`stopping ${stream.name} failed: ${String(err)}`),
				),
		);
		if (result.ok) return result;
		const error = this.#mask(result.error);
		this.#logFailure(stream.name, error);
		return fail(error);
	}

	#requireCapability(capability: string, input: unknown): void {
		// No checker: fail closed (start() refuses a contract that needs one, so this is belt and braces).
		const status =
			this.#capabilities?.status(capability, projectIdOf(input)) ??
			"needs-upgrade";
		if (status === "available") return;
		throw new StudioFailure({
			code: ERROR_CODES.capabilityUnavailable,
			message:
				status === "removed"
					? strings.capabilityRemoved
					: strings.capabilityNeedsUpgrade,
			detail: capability,
		});
	}

	#mask(error: StudioError): StudioError {
		return this.#masker.maskError(error);
	}

	// An operation built with a shape builder lists the codes its handler may return. Returning another is a bug
	// in its service: still returned, and logged. The bridge's own codes and `internal.unexpected` can come from
	// any request, and the registry itself answers `kernel.capabilityUnavailable` for an operation that names a
	// capability. A test-local operation with no `errors` list is not checked.
	#checkDeclared(op: Operation, error: StudioError): void {
		if (op.errors === undefined) return;
		if (error.code.startsWith("bridge.") || error.code === ERROR_CODES.internal)
			return;
		if (
			error.code === ERROR_CODES.capabilityUnavailable &&
			op.capability !== undefined
		)
			return;
		if (op.errors.includes(error.code)) return;
		this.#log(
			`${op.name} returned ${error.code}, which it does not list in its errors (a bug in its service)`,
		);
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

	// A broken output or an unexpected exception is a bug in a service: say so in the log. Input errors are the
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

function notStarted(): StudioError {
	return { code: ERROR_CODES.unavailable, message: strings.appStarting };
}

/** The `projectId` of a parsed input, if it has one: the project a capability is checked for. */
function projectIdOf(input: unknown): ProjectId | undefined {
	if (typeof input !== "object" || input === null) return undefined;
	const projectId = (input as { projectId?: unknown }).projectId;
	return typeof projectId === "string" ? projectId : undefined;
}
