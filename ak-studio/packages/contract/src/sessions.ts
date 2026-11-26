// The operations every session shares, served by SessionService: start a session of a declared kind (see
// `sessionKinds` in operations.ts), stop it, and list the sessions (a reloaded window reattaches with this).
// State changes arrive as `session.updated` events.
import "./zodConfig";
import { z } from "zod";
import { ProjectId, SessionId, sessionSchema } from "./domain";
import { ERROR_CODES } from "./errors";
import { command, query } from "./shapes";

/**
 * Starts a session of `kind`, one per kind per project. `args` is parsed against the kind's `args` schema by
 * SessionService (a mismatch is `bridge.invalidInput`). Answers at once; the session starts in `starting`.
 */
export const sessionStart = command({
	name: "session.start",
	input: z.strictObject({
		kind: z.string().min(1),
		projectId: ProjectId.optional(),
		args: z.unknown(),
	}),
	output: z.object({ sessionId: SessionId }),
	errors: [
		ERROR_CODES.invalidInput,
		ERROR_CODES.projectNotOpen,
		ERROR_CODES.sessionUnknownKind,
		ERROR_CODES.sessionAlreadyRunning,
		ERROR_CODES.sessionFailed,
	],
});

/** Stops a session; it passes through `stopping` to `stopped`. */
export const sessionStop = command({
	name: "session.stop",
	input: z.strictObject({ sessionId: SessionId }),
	output: z.object({}),
	errors: [ERROR_CODES.sessionNotFound],
});

/** Every session the main process knows in this run. */
export const sessionsList = query({
	name: "sessions.list",
	input: z.strictObject({}),
	output: z.object({ sessions: z.array(sessionSchema) }),
});
