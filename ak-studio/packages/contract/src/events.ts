// The two streams that carry everything the services announce, on the existing `subscribe` primitive
// (pre-flight ruling 6): `events`, the one app-wide stream of job, session, recorded-command and domain events;
// and `stream.read`, the output of one stream (a job's, a session's or a command's), backlog first, in batches.
// Each batch is parsed once as a whole, not line by line (ruling 8).
import "./zodConfig";
import { z } from "zod";
import { StreamId, streamChunkSchema, studioEventSchema } from "./domain";
import { defineStream } from "./shapes";

/** Every event from the services, one union on `type` (see `studioEventSchema`). */
export const eventsStream = defineStream({
	name: "events",
	input: z.strictObject({}),
	event: studioEventSchema,
});

/** One batch of a stream's output: new chunks, how many lines fell out of the backlog, and whether it ended. */
export const streamBatchSchema = z.object({
	chunks: z.array(streamChunkSchema),
	/** Lines that fell out of the bounded backlog before this subscriber saw them. */
	dropped: z.int().nonnegative(),
	/** True on the last batch: the stream has ended and nothing more will come. */
	ended: z.boolean(),
});
export type StreamBatch = z.infer<typeof streamBatchSchema>;

/**
 * Reads one stream: the backlog first, then new output, at most one batch per flush and a bounded number of
 * lines per batch (a long backlog spans several batches), until the batch with `ended: true`.
 */
export const streamRead = defineStream({
	name: "stream.read",
	input: z.strictObject({ streamId: StreamId }),
	event: streamBatchSchema,
});
