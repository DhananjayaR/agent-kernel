// Every operation the renderer can call, declared once with zod schemas for its input and output. The main
// process validates every input and output against these; the renderer gets its types from them.
//
// P1a ships two primitives: a request (one answer) and a stream (events until cancelled). The operation shapes
// (query, command, job, session) are built on them in P1b. P1a declares no stream.
import { z } from "zod";
import { ERROR_CODES, isStudioFailure, type StudioError } from "./errors";

/** A request: one input, one answer. */
export interface Operation<
	Name extends string = string,
	Input extends z.ZodType = z.ZodType,
	Output extends z.ZodType = z.ZodType,
> {
	readonly kind: "request";
	readonly name: Name;
	readonly input: Input;
	readonly output: Output;
}

/** A stream: one input, then events until the subscriber cancels. Events are typed but not validated. */
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

// ---- The P1a operations ----

export const themePreferenceSchema = z.enum(["system", "dark", "light"]);
export type ThemePreference = z.infer<typeof themePreferenceSchema>;

export const platformSchema = z.enum(["linux", "darwin", "win32", "browser"]);
export type Platform = z.infer<typeof platformSchema>;

/** App version, platform ("browser" under the mock transport) and the stored theme preference. */
export const appInfo = defineOperation({
	name: "app.info",
	input: z.object({}),
	output: z.object({
		version: z.string(),
		platform: z.enum(["linux", "darwin", "win32", "browser"]),
		theme: z.enum(["system", "dark", "light"]),
	}),
});

/** Stores the theme preference in the app's data folder and answers with the stored value. */
export const appSetTheme = defineOperation({
	name: "app.setTheme",
	input: z.object({ theme: themePreferenceSchema }),
	output: z.object({ theme: themePreferenceSchema }),
});

/** Every request operation, keyed by name (a test checks each key equals its operation's name). */
export const operations = {
	"app.info": appInfo,
	"app.setTheme": appSetTheme,
} as const satisfies OperationMap;

/** Every stream, keyed by name. None in P1a. */
export const streams = {} as const satisfies StreamMap;

export const contract = { operations, streams } as const satisfies Contract;

export type Operations = typeof operations;
export type Streams = typeof streams;
export type OperationName = keyof Operations & string;
export type StreamName = keyof Streams & string;

/** What a caller passes (before parsing). */
export type InputOf<N extends OperationName> = z.input<Operations[N]["input"]>;
/** What a caller receives (after parsing). */
export type OutputOf<N extends OperationName> = z.output<
	Operations[N]["output"]
>;
export type StreamInputOf<N extends StreamName> = z.input<Streams[N]["input"]>;
export type StreamEventOf<N extends StreamName> = z.output<Streams[N]["event"]>;

/** What a main-process handler receives (the parsed input) and returns (checked against the output schema). */
export type HandlerInputOf<Op extends Operation> = z.output<Op["input"]>;
export type HandlerResultOf<Op extends Operation> = z.input<Op["output"]>;
export type StreamHandlerInputOf<S extends Stream> = z.output<S["input"]>;
export type StreamHandlerEventOf<S extends Stream> = z.output<S["event"]>;

// ---- Running an operation (shared by the main-process registry and the mock transport) ----

/** Every answer that crosses the bridge: a value or a StudioError, never an exception. */
export type BridgeResult<T = unknown> =
	| { ok: true; value: T }
	| { ok: false; error: StudioError };

export function ok<T>(value: T): BridgeResult<T> {
	return { ok: true, value };
}

export function fail(error: StudioError): BridgeResult<never> {
	return { ok: false, error };
}

/** Looks a name up as an own key only, so "__proto__" or "toString" is never an operation. */
export function lookup<T>(
	map: Readonly<Record<string, T>>,
	name: unknown,
): T | undefined {
	return typeof name === "string" && Object.hasOwn(map, name)
		? map[name]
		: undefined;
}

/** Turns anything a handler threw into a StudioError: a StudioFailure keeps its own. */
export function toStudioError(err: unknown): StudioError {
	if (isStudioFailure(err)) return err.error;
	const detail = err instanceof Error ? err.message : String(err);
	return {
		code: ERROR_CODES.internal,
		message: "Something went wrong in the app.",
		detail,
	};
}

/** Parses `raw` against `schema`; a failure becomes `bridge.invalidInput` with zod's summary as the detail. */
export function parseInput(
	schema: z.ZodType,
	name: string,
	raw: unknown,
): BridgeResult<unknown> {
	const parsed = schema.safeParse(raw);
	if (parsed.success) return ok(parsed.data);
	return fail({
		code: ERROR_CODES.invalidInput,
		message: `The input for ${name} is not valid.`,
		detail: z.prettifyError(parsed.error),
	});
}

/**
 * Runs one request: parses the input, calls the handler with the parsed value, parses the result against the
 * output schema (which strips undeclared fields), and converts any exception. Never throws or rejects.
 */
export async function runOperation(
	op: Operation,
	handler: (input: unknown) => unknown,
	rawInput: unknown,
): Promise<BridgeResult<unknown>> {
	const input = parseInput(op.input, op.name, rawInput);
	if (!input.ok) return input;
	let result: unknown;
	try {
		result = await handler(input.value);
	} catch (err) {
		return fail(toStudioError(err));
	}
	const output = op.output.safeParse(result);
	if (output.success) return ok(output.data);
	return fail({
		code: ERROR_CODES.invalidOutput,
		message: `The app gave an answer to ${op.name} that does not match the contract.`,
		detail: z.prettifyError(output.error),
	});
}
