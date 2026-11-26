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
	/** The file the error is about, relative to the project folder. */
	file: z.string().optional(),
	/** The line in `file` the error is about. */
	line: z.int().nonnegative().optional(),
	/** An app command the user can run next, e.g. "Reload" after a file changed on disk. */
	action: z
		.object({
			label: z.string(),
			commandId: z.string(),
			args: z.unknown().optional(),
		})
		.optional(),
});
export type StudioError = z.infer<typeof studioErrorSchema>;

/**
 * The error catalog. P1a holds the bridge's own codes and AppService's; P1b adds the project, file, kernel, job,
 * session and stream codes; features add theirs in later phases. Every code an operation lists must be here (a test).
 */
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
	/** The operation names a project that has no open scope in this window. */
	projectNotOpen: "project.notOpen",
	/** A write's `baseRevision` is not the file's current revision; the error carries the new content. */
	fileChangedOnDisk: "file.changedOnDisk",
	/** A path resolves outside the project folder. */
	fileOutsideProject: "file.outsideProject",
	/** The file does not exist in the project folder (a read of a missing file, or a write to a deleted one). */
	fileNotFound: "file.notFound",
	/** The project's OAK version lacks the capability the operation needs. */
	capabilityUnavailable: "kernel.capabilityUnavailable",
	/** No job has this id (it never existed, or its record was dismissed). */
	jobNotFound: "job.notFound",
	/** An answer arrived for a job that is not waiting for the user. */
	jobNotWaiting: "job.notWaiting",
	/** An answer names a request that is not the job's open request. */
	jobRequestMismatch: "job.requestMismatch",
	/** A cancel arrived for a job that cannot be cancelled. */
	jobNotCancellable: "job.notCancellable",
	/** No session has this id. */
	sessionNotFound: "session.notFound",
	/** `session.start` names a kind that is not in `sessionKinds`. */
	sessionUnknownKind: "session.unknownKind",
	/** A session of this kind is already running for this project (one per kind per project). */
	sessionAlreadyRunning: "session.alreadyRunning",
	/** The session could not start, or stopped by itself. */
	sessionFailed: "session.failed",
	/** `stream.read` names a stream the app does not have (it never existed, or the app restarted since). */
	streamNotFound: "stream.notFound",
} as const;
export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

const errorCodes: ReadonlySet<string> = new Set(Object.values(ERROR_CODES));

/** Whether `code` is in the error catalog. */
export function isErrorCode(code: string): code is ErrorCode {
	return errorCodes.has(code);
}

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
