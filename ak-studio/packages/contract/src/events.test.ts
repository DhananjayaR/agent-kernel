// The two streams that carry everything from the services: `events` (the event union) and `stream.read` (the
// chunks of one stream, in batches).
import { describe, expect, it } from "vitest";
import { studioEventSchema } from "./domain";
import { eventsStream, streamBatchSchema, streamRead } from "./events";

describe("event streams", () => {
	it("events takes {} and carries the event union", () => {
		expect(eventsStream.kind).toBe("stream");
		expect(eventsStream.name).toBe("events");
		expect(eventsStream.input.safeParse({}).success).toBe(true);
		expect(eventsStream.input.safeParse({ extra: 1 }).success).toBe(false);
		expect(eventsStream.event).toBe(studioEventSchema);
	});

	it("stream.read takes a streamId and carries batches", () => {
		expect(streamRead.kind).toBe("stream");
		expect(streamRead.name).toBe("stream.read");
		expect(streamRead.input.parse({ streamId: "st1" })).toEqual({
			streamId: "st1",
		});
		for (const bad of [{}, { streamId: "" }, { streamId: "st1", extra: 1 }]) {
			expect(streamRead.input.safeParse(bad).success).toBe(false);
		}
		expect(streamRead.event).toBe(streamBatchSchema);
		const batch = {
			chunks: [{ seq: 0, at: 1, channel: "stdout", text: "a" }],
			dropped: 3,
			ended: false,
		};
		expect(streamRead.event.parse(batch)).toEqual(batch);
		expect(streamRead.event.safeParse({ ...batch, dropped: -1 }).success).toBe(
			false,
		);
		expect(streamRead.event.safeParse({ chunks: [], dropped: 0 }).success).toBe(
			false,
		);
	});
});
