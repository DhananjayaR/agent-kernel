// The contract's building blocks. Two primitives from P1a: a request (`defineOperation`, one input and one answer)
// and a stream (`defineStream`, events until cancelled). On them, the four shapes every operation takes
// (architecture.md, The contract): `query` (reads, no side effects), `command` (one quick write), `job` (finite,
// slow or cancellable work that answers `{ jobId }` at once) and the session kind (long-lived, until stopped).
// A shape adds read-only metadata: the error codes the operation can return and the capability it needs.
// The primitives live here, not in operations.ts, so the files that declare operations (jobs.ts, sessions.ts,
// events.ts, and later each feature's) import only this file and operations.ts can collect them without an
// import cycle.
import "./zodConfig";
import { z } from "zod";
import { JobId } from "./domain";
import type { ErrorCode } from "./errors";

// ---- The primitives ----

/** How a request behaves: the renderer picks its hook by this (useQuery, useMutation, useJob). */
export type OperationShape = "query" | "command" | "job";

/**
 * A request: one input, one answer. The shape fields are optional here so a test-local contract can use plain
 * `defineOperation`; every operation in the app's contract is built with a shape builder and has them.
 */
export interface Operation<
	Name extends string = string,
	Input extends z.ZodType = z.ZodType,
	Output extends z.ZodType = z.ZodType,
> {
	readonly kind: "request";
	readonly name: Name;
	readonly input: Input;
	readonly output: Output;
	readonly shape?: OperationShape;
	/** The error codes the handler can return (beyond the bridge's own). */
	readonly errors?: readonly string[];
	/** A kernel capability id the project's version must have, or the request is refused. */
	readonly capability?: string;
}

/** A stream: one input, then events until the subscriber cancels. Every event is parsed against `event`. */
export interface Stream<
	Name extends string = string,
	Input extends z.ZodType = z.ZodType,
	Event extends z.ZodType = z.ZodType,
> {
	readonly kind: "stream";
	readonly name: Name;
	readonly input: Input;
	readonly event: Event;
}

export function defineOperation<
	const Name extends string,
	Input extends z.ZodType,
	Output extends z.ZodType,
>(def: {
	name: Name;
	input: Input;
	output: Output;
}): Operation<Name, Input, Output> {
	return Object.freeze({
		kind: "request",
		name: def.name,
		input: def.input,
		output: def.output,
	});
}

export function defineStream<
	const Name extends string,
	Input extends z.ZodType,
	Event extends z.ZodType,
>(def: { name: Name; input: Input; event: Event }): Stream<Name, Input, Event> {
	return Object.freeze({
		kind: "stream",
		name: def.name,
		input: def.input,
		event: def.event,
	});
}

export type OperationMap = Readonly<Record<string, Operation>>;
export type StreamMap = Readonly<Record<string, Stream>>;

/** A whole contract: what a ServiceRegistry serves and a transport calls. */
export interface Contract<
	Ops extends OperationMap = OperationMap,
	Streams extends StreamMap = StreamMap,
> {
	readonly operations: Ops;
	readonly streams: Streams;
}

// ---- The shapes ----

/** A request built with `query`, `command` or `job`: its shape and error codes are always set. */
export interface ShapedOperation<
	Name extends string = string,
	Input extends z.ZodType = z.ZodType,
	Output extends z.ZodType = z.ZodType,
	Shape extends OperationShape = OperationShape,
> extends Operation<Name, Input, Output> {
	readonly shape: Shape;
	readonly errors: readonly ErrorCode[];
	readonly capability?: string;
}
export type ShapedOperationMap = Readonly<Record<string, ShapedOperation>>;

/** What every job operation answers: the id of the job it started. Progress arrives as `job.updated` events. */
export const jobStartedSchema = z.object({ jobId: JobId });

/** A job operation: starts a job of its kind and answers `{ jobId }`; the job's result is typed by `result`. */
export interface JobOperation<
	Name extends string = string,
	Input extends z.ZodType = z.ZodType,
	Result extends z.ZodType = z.ZodType,
> extends ShapedOperation<Name, Input, typeof jobStartedSchema, "job"> {
	/** The schema of the job's result (`Job.result` once it succeeds). */
	readonly result: Result;
	/** Sentence case, shown in the UI. */
	readonly title: string;
	readonly cancellable: boolean;
	/** True only where killing the process risks damage (e.g. `terraform apply`): it then blocks quit. */
	readonly survivesQuit: boolean;
}
export type JobKindMap = Readonly<Record<string, JobOperation>>;

/** A kind of session, started with `session.start`. Not an operation: the session operations are shared. */
export interface SessionKind<
	Kind extends string = string,
	Args extends z.ZodType = z.ZodType,
	Info extends z.ZodType = z.ZodType,
> {
	readonly shape: "session";
	readonly kind: Kind;
	/** The `args` of `session.start` for this kind: an input, so strict. */
	readonly args: Args;
	/** The schema of `Session.info` for this kind: an output, so plain. */
	readonly info: Info;
	readonly errors: readonly ErrorCode[];
}
export type SessionKindMap = Readonly<Record<string, SessionKind>>;

/** What `query` and `command` take. */
export interface ShapeDef<
	Name extends string,
	Input extends z.ZodType,
	Output extends z.ZodType,
> {
	name: Name;
	input: Input;
	output: Output;
	errors?: readonly ErrorCode[];
	capability?: string;
}

function shaped<
	Name extends string,
	Input extends z.ZodType,
	Output extends z.ZodType,
	Shape extends OperationShape,
>(
	shape: Shape,
	def: ShapeDef<Name, Input, Output>,
): ShapedOperation<Name, Input, Output, Shape> {
	return {
		...defineOperation({
			name: def.name,
			input: def.input,
			output: def.output,
		}),
		shape,
		errors: Object.freeze([...(def.errors ?? [])]),
		...(def.capability === undefined ? {} : { capability: def.capability }),
	};
}

/** Reads state, with no side effects. The renderer calls it through `useQuery`. */
export function query<
	const Name extends string,
	Input extends z.ZodType,
	Output extends z.ZodType,
>(
	def: ShapeDef<Name, Input, Output>,
): ShapedOperation<Name, Input, Output, "query"> {
	return Object.freeze(shaped("query", def));
}

/** One write that normally finishes in under a second. The renderer calls it through `useMutation`. */
export function command<
	const Name extends string,
	Input extends z.ZodType,
	Output extends z.ZodType,
>(
	def: ShapeDef<Name, Input, Output>,
): ShapedOperation<Name, Input, Output, "command"> {
	return Object.freeze(shaped("command", def));
}

/** Finite work that is slow, cancellable or has steps. Answers `{ jobId }` at once; JobService runs it. */
export function job<
	const Name extends string,
	Input extends z.ZodType,
	Result extends z.ZodType,
>(def: {
	name: Name;
	input: Input;
	result: Result;
	errors?: readonly ErrorCode[];
	capability?: string;
	title: string;
	cancellable: boolean;
	survivesQuit: boolean;
}): JobOperation<Name, Input, Result> {
	return Object.freeze({
		...shaped("job", {
			name: def.name,
			input: def.input,
			output: jobStartedSchema,
			errors: def.errors,
			capability: def.capability,
		}),
		result: def.result,
		title: def.title,
		cancellable: def.cancellable,
		survivesQuit: def.survivesQuit,
	});
}

/** Declares a session kind; add it to `sessionKinds` (operations.ts) for SessionService to start it. */
export function defineSessionKind<
	const Kind extends string,
	Args extends z.ZodType,
	Info extends z.ZodType,
>(def: {
	kind: Kind;
	args: Args;
	info: Info;
	errors?: readonly ErrorCode[];
}): SessionKind<Kind, Args, Info> {
	return Object.freeze({
		shape: "session",
		kind: def.kind,
		args: def.args,
		info: def.info,
		errors: Object.freeze([...(def.errors ?? [])]),
	});
}
