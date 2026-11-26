// The domain types the services and the renderer share: ids, file revisions, jobs and their user requests,
// sessions, stream chunks, recorded commands and the event union the `events` stream carries. One zod schema
// each, so the main process, the mock and the renderer's types all come from the same declaration. The Job,
// UserRequest and Session fields are those in architecture.md (Jobs, Sessions), with `projectId` and `seq` added
// (`seq` counts the service's changes to one job or session, so the renderer keeps the newest after a reload).
// All are output schemas: plain objects, so undeclared fields are stripped before they cross the bridge.
import "./zodConfig";
import { z } from "zod";
import { studioErrorSchema } from "./errors";

// ---- Ids and revisions (each a schema and a type of the same name) ----

/** The id of an open project (one per window). */
export const ProjectId = z.string().min(1);
export type ProjectId = z.infer<typeof ProjectId>;

export const JobId = z.string().min(1);
export type JobId = z.infer<typeof JobId>;

export const SessionId = z.string().min(1);
export type SessionId = z.infer<typeof SessionId>;

/** The id of a stream of output (a job's, a session's or a recorded command's), read with `stream.read`. */
export const StreamId = z.string().min(1);
export type StreamId = z.infer<typeof StreamId>;

/** A file's revision: the SHA-256 of its content, as 64 lowercase hex characters. */
export const Revision = z.string().regex(/^[0-9a-f]{64}$/);
export type Revision = z.infer<typeof Revision>;

// ---- Jobs ----

export const jobStateSchema = z.enum([
	"queued",
	"running",
	"waiting-for-user",
	"succeeded",
	"failed",
	"cancelled",
]);
export type JobState = z.infer<typeof jobStateSchema>;

export const userRequestKindSchema = z.enum([
	"confirm",
	"confirm-by-name",
	"permission",
	"choice",
]);
export type UserRequestKind = z.infer<typeof userRequestKindSchema>;

/** A question a job asks the user; answered only with `job.respond`. */
export const userRequestSchema = z.object({
	id: z.string().min(1),
	kind: userRequestKindSchema,
	/** Sentence case, shown in the UI. */
	title: z.string(),
	/** What will happen. */
	summary: z.string(),
	/** What it touches: a cloud account, files, resources. */
	affects: z.array(z.string()),
	/** The name the user types, for `confirm-by-name`. */
	expectedName: z.string().optional(),
	options: z
		.array(
			z.object({
				id: z.string().min(1),
				label: z.string(),
				destructive: z.boolean().optional(),
			}),
		)
		.optional(),
});
export type UserRequest = z.infer<typeof userRequestSchema>;

export const jobProgressSchema = z.object({
	step: z.int().nonnegative(),
	steps: z.int().positive(),
	label: z.string(),
});
export type JobProgress = z.infer<typeof jobProgressSchema>;

/** Every slow, finite thing the app does: one model, one UI pattern. */
export const jobSchema = z.object({
	id: JobId,
	/** The job operation's name, e.g. "project.create". */
	kind: z.string().min(1),
	/** Sentence case, shown in the UI. */
	title: z.string(),
	state: jobStateSchema,
	progress: jobProgressSchema.optional(),
	/** Present while `waiting-for-user`. */
	request: userRequestSchema.optional(),
	/** The CommandRunner records behind it. */
	commandIds: z.array(z.string()),
	streamId: StreamId.optional(),
	/** Typed per kind by the job operation's `result` schema. */
	result: z.unknown().optional(),
	error: studioErrorSchema.optional(),
	cancellable: z.boolean(),
	/** See the quit rule: a job that survives quit blocks it until it ends. */
	survivesQuit: z.boolean(),
	projectId: ProjectId.optional(),
	/**
	 * Counts this job's announced changes: JobService adds one before each `job.updated`, so a higher `seq` is a
	 * newer state of the same job (the renderer's store keeps the newest, whichever arrives first).
	 */
	seq: z.int().nonnegative(),
});
export type Job = z.infer<typeof jobSchema>;

/** A job whose start record has no end record: the app quit or crashed while it ran. */
export const interruptedJobSchema = z.object({
	jobId: JobId,
	kind: z.string().min(1),
	title: z.string(),
	projectId: ProjectId.optional(),
	/** When it started, in milliseconds since the epoch. */
	startedAt: z.number(),
	/** The commands it had run, so the notice can say what to check. */
	commandIds: z.array(z.string()),
});
export type InterruptedJob = z.infer<typeof interruptedJobSchema>;

// ---- Sessions ----

export const sessionStateSchema = z.enum([
	"starting",
	"running",
	"stopping",
	"stopped",
	"failed",
]);
export type SessionState = z.infer<typeof sessionStateSchema>;

/** Something long-lived that runs until stopped; one per kind per project. */
export const sessionSchema = z.object({
	id: SessionId,
	/** The session kind, e.g. "run.server". */
	kind: z.string().min(1),
	state: sessionStateSchema,
	/** Typed per kind by the session kind's `info` schema: port, URL, model. */
	info: z.unknown().optional(),
	streamId: StreamId.optional(),
	commandIds: z.array(z.string()),
	error: studioErrorSchema.optional(),
	projectId: ProjectId.optional(),
	/** Counts this session's announced changes, as Job's `seq` does (SessionService adds one before each event). */
	seq: z.int().nonnegative(),
});
export type Session = z.infer<typeof sessionSchema>;

// ---- Streams and recorded commands ----

export const streamChannelSchema = z.enum(["stdout", "stderr", "info"]);
export type StreamChannel = z.infer<typeof streamChannelSchema>;

/** One line of a stream. `seq` counts from 0 per stream; `at` is milliseconds since the epoch. */
export const streamChunkSchema = z.object({
	seq: z.int().nonnegative(),
	at: z.number(),
	channel: streamChannelSchema,
	text: z.string(),
});
export type StreamChunk = z.infer<typeof streamChunkSchema>;

/** A command the app ran through CommandRunner. The shape only: P2 fills it in. */
export const commandRecordSchema = z.object({
	id: z.string().min(1),
	projectId: ProjectId.optional(),
	executable: z.string(),
	args: z.array(z.string()),
	/** Milliseconds since the epoch. */
	startedAt: z.number(),
	endedAt: z.number().optional(),
	/** Absent while running; null when the process ended by a signal. */
	exitCode: z.int().nullable().optional(),
	streamId: StreamId.optional(),
});
export type CommandRecord = z.infer<typeof commandRecordSchema>;

// ---- Events ----

/**
 * Everything the services announce, as one union on `type`, carried by the `events` stream. A domain change is
 * one event type with a `domain` field (pre-flight ruling 14): the renderer invalidates that domain's queries.
 */
export const studioEventSchema = z.discriminatedUnion("type", [
	z.object({ type: z.literal("job.updated"), job: jobSchema }),
	z.object({ type: z.literal("session.updated"), session: sessionSchema }),
	z.object({
		type: z.literal("command.recorded"),
		record: commandRecordSchema,
	}),
	z.object({
		type: z.literal("domain.changed"),
		domain: z.string().min(1),
		projectId: ProjectId.optional(),
	}),
]);
export type StudioEvent = z.infer<typeof studioEventSchema>;
export type StudioEventType = StudioEvent["type"];
