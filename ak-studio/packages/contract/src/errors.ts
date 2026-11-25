// StudioError: how a failure crosses the bridge. It is always a plain value inside a result envelope; an
// exception never crosses the bridge (the main-process registry converts it).
import "./zodConfig";
import { z } from "zod";

export const studioErrorSchema = z.object({
	/** From the error catalog below, e.g. "bridge.invalidInput". */
	code: z.string(),
	/** Sentence case; says what happened. */
	message: z.string(),
	/** Raw detail for the collapsed part of an error view. */
	detail: z.string().optional(),
});
export type StudioError = z.infer<typeof studioErrorSchema>;

/** The error catalog. P1a holds the bridge's own codes and AppService's; features add theirs in later phases. */
export const ERROR_CODES = {
	/** The operation name is not in the contract (or is not of the kind that was called). */
	unknownOperation: "bridge.unknownOperation",
	/** The input failed the operation's input schema. */
	invalidInput: "bridge.invalidInput",
	/** The handler's result failed the operation's output schema (a bug in the main process). */
	invalidOutput: "bridge.invalidOutput",
	/** The message came from a frame that is not the app's own window. */
	forbidden: "bridge.forbidden",
	/** The bridge itself failed: IPC unavailable, or a reply that is not a result envelope. */
	unavailable: "bridge.unavailable",
	/** A handler threw something that is not a StudioError. */
	internal: "internal.unexpected",
	/** AppService could not write the preferences file in the app's data folder. */
	preferencesNotSaved: "app.preferencesNotSaved",
} as const;
export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export function studioError(
	code: string,
	message: string,
	detail?: string,
): StudioError {
	return detail === undefined ? { code, message } : { code, message, detail };
}

export function isStudioError(value: unknown): value is StudioError {
	return studioErrorSchema.safeParse(value).success;
}

/**
 * A StudioError as an exception, for use on one side of the bridge only. A service throws it to fail with a
 * specific code (the registry sends its `error` as a value); the renderer transport rejects with it so that a
 * caller (TanStack Query, `await`) sees a normal rejected promise.
 */
export class StudioFailure extends Error {
	readonly error: StudioError;

	constructor(error: StudioError) {
		super(error.message);
		this.name = "StudioFailure";
		this.error = error;
	}
}

export function isStudioFailure(value: unknown): value is StudioFailure {
	return value instanceof StudioFailure;
}
