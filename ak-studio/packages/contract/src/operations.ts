// Every operation and stream the renderer can call, collected once: the `operations`, `streams`, `jobKinds` and
// `sessionKinds` maps the main process serves and the renderer gets its types from. The main process validates
// every input and output against these schemas. Also the helpers that run one request or stream against its
// schemas, shared by the main-process registry and the mock transport.
//
// The primitives and the four shapes are in shapes.ts. P1a's requests are declared here, reclassified into shapes
// in P1b (pre-flight ruling 7); the job, session and event operations are in jobs.ts, sessions.ts and events.ts.
import "./zodConfig";
import { z } from "zod";
import {
	aboutDemoJob,
	aboutInfo,
	aboutNote,
	aboutSetNote,
	aboutTicker,
} from "./about";
import { platformSchema } from "./domain";
import { ERROR_CODES, isStudioFailure, type StudioError } from "./errors";
import { eventsStream, streamRead } from "./events";
import {
	jobCancel,
	jobRespond,
	jobsDismissInterrupted,
	jobsInterrupted,
	jobsList,
} from "./jobs";
import { sessionStart, sessionStop, sessionsList } from "./sessions";
import {
	type Contract,
	command,
	defineStream,
	type JobOperation,
	type Operation,
	query,
	type SessionKind,
	type SessionKindMap,
	type ShapedOperationMap,
	type Stream,
	type StreamMap,
} from "./shapes";
import type { StreamMessage } from "./transport";

// ---- The P1a operations ----

export const themePreferenceSchema = z.enum(["system", "dark", "light"]);
export type ThemePreference = z.infer<typeof themePreferenceSchema>;

// Inputs are strict objects: an unknown key is `bridge.invalidInput`, not silently dropped (P0 D12, strict
// validation). Outputs are plain objects, so undeclared fields are stripped before they cross the bridge.

/** The bottom panel's height in CSS pixels: the bounds a stored value must keep, and the first-run default. */
export const BOTTOM_PANEL_HEIGHT = {
	min: 120,
	max: 4000,
	default: 240,
} as const;

const bottomPanelLayoutShape = {
	/** Open (its content shows) or closed (only its tab strip shows). */
	open: z.boolean(),
	/** Its height while open; kept while it is closed, so opening it restores the height. */
	height: z.int().min(BOTTOM_PANEL_HEIGHT.min).max(BOTTOM_PANEL_HEIGHT.max),
};

/** The shell's remembered layout (an app preference, stored by main beside the theme). Strict, as an input. */
export const shellLayoutSchema = z.strictObject({
	bottomPanel: z.strictObject(bottomPanelLayoutShape),
});
export type ShellLayout = z.infer<typeof shellLayoutSchema>;

/** The same layout as an output: a plain object, so undeclared fields are stripped. */
const shellLayoutOutputSchema = z.object({
	bottomPanel: z.object(bottomPanelLayoutShape),
});

/** The layout before the person has changed anything: the bottom panel open at its default height. */
export const DEFAULT_SHELL_LAYOUT: ShellLayout = Object.freeze({
	bottomPanel: Object.freeze({
		open: true,
		height: BOTTOM_PANEL_HEIGHT.default,
	}),
});

/** App version, platform ("browser" under the mock transport), the stored theme preference and shell layout. */
export const appInfo = query({
	name: "app.info",
	input: z.strictObject({}),
	output: z.object({
		version: z.string(),
		platform: platformSchema,
		theme: themePreferenceSchema,
		layout: shellLayoutOutputSchema,
	}),
});

/** Stores the theme preference in the app's data folder and answers with the stored value. */
export const appSetTheme = command({
	name: "app.setTheme",
	input: z.strictObject({ theme: themePreferenceSchema }),
	output: z.object({ theme: themePreferenceSchema }),
	errors: [ERROR_CODES.preferencesNotSaved],
});

/** Stores the shell layout (the bottom panel's open state and height) and answers with the stored value. */
export const appSetLayout = command({
	name: "app.setLayout",
	input: z.strictObject({ layout: shellLayoutSchema }),
	output: z.object({ layout: shellLayoutOutputSchema }),
	errors: [ERROR_CODES.preferencesNotSaved],
});

/**
 * Tells main what is unsaved in the window, so the quit rule can ask about it before it asks about jobs (P1b
 * ruling 11). Labels only, never content ("Config: session section"); the whole list each time, `[]` when
 * nothing is unsaved.
 */
export const appSetUnsaved = command({
	name: "app.setUnsaved",
	input: z.strictObject({ items: z.array(z.string().min(1)) }),
	output: z.object({}),
});

/** Minimises the window. Answers once it is asked; a missing window is not an error. */
export const windowMinimize = command({
	name: "window.minimize",
	input: z.strictObject({}),
	output: z.object({}),
});

/** Maximises the window, or restores it when it is maximised; answers with the state it asked for. */
export const windowToggleMaximize = command({
	name: "window.toggleMaximize",
	input: z.strictObject({}),
	output: z.object({ maximized: z.boolean() }),
});

/** Closes the window (the app quits with its last window, except on macOS). */
export const windowClose = command({
	name: "window.close",
	input: z.strictObject({}),
	output: z.object({}),
});

/**
 * Whether the window is maximised: the current state at once on subscribe, then on every change. Full screen
 * counts as not maximised, since the window controls are shown for the maximise state alone.
 */
export const windowState = defineStream({
	name: "window.state",
	input: z.strictObject({}),
	event: z.object({ maximized: z.boolean() }),
});

/** Every request operation, keyed by name (a test checks each key equals its operation's name). */
export const operations = {
	"about.demoJob": aboutDemoJob,
	"about.info": aboutInfo,
	"about.note": aboutNote,
	"about.setNote": aboutSetNote,
	"app.info": appInfo,
	"app.setLayout": appSetLayout,
	"app.setTheme": appSetTheme,
	"app.setUnsaved": appSetUnsaved,
	"job.cancel": jobCancel,
	"job.respond": jobRespond,
	"jobs.dismissInterrupted": jobsDismissInterrupted,
	"jobs.interrupted": jobsInterrupted,
	"jobs.list": jobsList,
	"session.start": sessionStart,
	"session.stop": sessionStop,
	"sessions.list": sessionsList,
	"window.close": windowClose,
	"window.minimize": windowMinimize,
	"window.toggleMaximize": windowToggleMaximize,
} as const satisfies ShapedOperationMap;

/** Every stream, keyed by name. */
export const streams = {
	events: eventsStream,
	"stream.read": streamRead,
	"window.state": windowState,
} as const satisfies StreamMap;

/**
 * Every session kind, keyed by kind: what `session.start` may start (SessionService refuses any other with
 * `session.unknownKind`). A feature declares each with `defineSessionKind` and adds it here by hand.
 */
export const sessionKinds = {
	"about.ticker": aboutTicker,
} as const satisfies SessionKindMap;

export const contract = { operations, streams } as const satisfies Contract;

export type Operations = typeof operations;
export type Streams = typeof streams;
export type SessionKinds = typeof sessionKinds;
export type OperationName = keyof Operations & string;
export type StreamName = keyof Streams & string;
export type SessionKindName = keyof SessionKinds & string;

/** The names of the job operations in `operations`. */
export type JobKindName = {
	[N in OperationName]: Operations[N] extends { readonly shape: "job" }
		? N
		: never;
}[OperationName];
export type JobKinds = { readonly [N in JobKindName]: Operations[N] };

/** Every job operation, keyed by name: the kinds JobService runs. Derived from `operations`, so a job is declared once. */
export const jobKinds: JobKinds = Object.freeze(
	Object.fromEntries(
		Object.entries(operations as ShapedOperationMap).filter(
			([, op]) => op.shape === "job",
		),
	),
) as JobKinds;

/** A job kind's result, once it succeeds (`Job.result`). */
export type JobResultOf<N extends JobKindName> =
	JobKinds[N] extends JobOperation<string, z.ZodType, infer R>
		? z.output<R>
		: never;
/** What `session.start` takes as `args` for a kind (before parsing). */
export type SessionArgsOf<K extends SessionKindName> =
	SessionKinds[K] extends SessionKind<string, infer A> ? z.input<A> : never;
/** A session kind's `Session.info`. */
export type SessionInfoOf<K extends SessionKindName> =
	SessionKinds[K] extends SessionKind<string, z.ZodType, infer I>
		? z.output<I>
		: never;

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

/** What `parseSafely` answers: the parsed value, or zod's summary of why it failed. */
export type SafeParseResult =
	| { success: true; data: unknown }
	| { success: false; detail: string };

/**
 * `schema.safeParse(raw)` that never throws: zod's `safeParse` throws when a refine, transform or getter does, and
 * that throw is caught here as a failure whose detail says so. Everything that parses a value it did not build
 * (the registry, JobService, SessionService) uses this.
 */
export function parseSafely(schema: z.ZodType, raw: unknown): SafeParseResult {
	try {
		const parsed = schema.safeParse(raw);
		return parsed.success
			? { success: true, data: parsed.data }
			: { success: false, detail: z.prettifyError(parsed.error) };
	} catch (err) {
		return {
			success: false,
			detail: `validation threw: ${err instanceof Error ? err.message : String(err)}`,
		};
	}
}

/** Parses `raw` against `schema`; a failure becomes `bridge.invalidInput` with zod's summary as the detail. */
export function parseInput(
	schema: z.ZodType,
	name: string,
	raw: unknown,
): BridgeResult<unknown> {
	const parsed = parseSafely(schema, raw);
	if (parsed.success) return ok(parsed.data);
	return fail({
		code: ERROR_CODES.invalidInput,
		message: `The input for ${name} is not valid.`,
		detail: parsed.detail,
	});
}

function invalidOutput(name: string, detail: string): StudioError {
	return {
		code: ERROR_CODES.invalidOutput,
		message: `The app gave an answer to ${name} that does not match the contract.`,
		detail,
	};
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
	const output = parseSafely(op.output, result);
	if (output.success) return ok(output.data);
	return fail(invalidOutput(op.name, output.detail));
}

/**
 * Starts one stream: parses the input, then calls the handler. Each event the handler emits is parsed against
 * the stream's event schema (undeclared fields stripped) and sent as `{ ok: true, event }`. An event that fails
 * the schema is dropped and ends the stream: one `{ ok: false, error: bridge.invalidOutput }` message is sent
 * and the handler is stopped. On success, answers the function that stops the stream (idempotent; nothing is
 * sent after it). On failure to start, answers the StudioError and sends nothing. Never throws.
 */
export function startStream(
	stream: Stream,
	handler: (input: unknown, emit: (event: unknown) => void) => () => void,
	rawInput: unknown,
	send: (message: StreamMessage) => void,
	onStopError: (err: unknown) => void = () => {},
): BridgeResult<() => void> {
	const input = parseInput(stream.input, stream.name, rawInput);
	if (!input.ok) return input;
	let open = true;
	let stop: (() => void) | undefined;
	const callStop = (): void => {
		try {
			stop?.();
		} catch (err) {
			onStopError(err);
		}
	};
	const emit = (event: unknown): void => {
		if (!open) return;
		const parsed = parseSafely(stream.event, event);
		if (parsed.success) {
			send({ ok: true, event: parsed.data });
			return;
		}
		open = false;
		send({ ok: false, error: invalidOutput(stream.name, parsed.detail) });
		callStop(); // A no-op while the handler is still starting; done below once it returns.
	};
	try {
		stop = handler(input.value, emit);
	} catch (err) {
		open = false;
		return fail(toStudioError(err));
	}
	if (!open) {
		// An invalid event arrived while the handler was starting: the stream has already ended.
		callStop();
		return ok(() => {});
	}
	return ok(() => {
		if (!open) return;
		open = false;
		callStop();
	});
}
