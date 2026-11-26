// StreamHub tests, with an injected scheduler (no real time): a late subscriber gets the backlog first; output
// arrives in batches, at most one per flush and at most `batchLines` long; the backlog is bounded and `dropped`
// counts what fell out; a stream ends once; chunks are masked; and a burst of 10,000 lines costs one schema
// parse per batch, not per line (ruling 8).
import {
	ERROR_CODES,
	type StreamBatch,
	type StreamMessage,
	streamBatchSchema,
	streamChunkSchema,
	streamRead,
} from "@ak-studio/contract";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ServiceRegistry } from "./registry";
import { SecretMasker } from "./secrets";
import { DEFAULT_FLUSH_MS, StreamHub, type StreamHubOptions } from "./streams";

/** A scheduler the test drives: `tick()` runs the flushes queued so far (not the ones they queue). */
function manualScheduler() {
	let queue: Array<() => void> = [];
	const schedule = vi.fn((fn: () => void) => {
		queue.push(fn);
		return () => {
			queue = queue.filter((f) => f !== fn);
		};
	});
	return {
		schedule,
		pending: () => queue.length,
		tick() {
			const due = queue;
			queue = [];
			for (const fn of due) fn();
		},
	};
}

function setup(options: Partial<StreamHubOptions> = {}) {
	const clock = manualScheduler();
	const masker = options.masker ?? new SecretMasker();
	const hub = new StreamHub({
		masker,
		schedule: clock.schedule,
		now: () => 1000,
		...options,
	});
	const registry = new ServiceRegistry({
		contract: { operations: {}, streams: { "stream.read": streamRead } },
		log: vi.fn(),
	});
	registry.register(hub);
	registry.start();
	const read = (streamId: string) => {
		const messages: StreamMessage[] = [];
		const result = registry.subscribe("stream.read", { streamId }, (m) =>
			messages.push(m),
		);
		const batches = (): StreamBatch[] =>
			messages.map((m) => {
				if (!m.ok) throw new Error(m.error.message);
				return m.event as StreamBatch;
			});
		return { result, messages, batches };
	};
	return { hub, clock, registry, read, masker };
}

const texts = (batch: StreamBatch | undefined) =>
	batch?.chunks.map((c) => c.text);

afterEach(() => {
	vi.restoreAllMocks();
	vi.useRealTimers();
});

describe("StreamHub", () => {
	it("creates distinct stream ids", () => {
		const { hub } = setup();
		const ids = new Set([hub.create(), hub.create(), hub.create()]);
		expect(ids.size).toBe(3);
	});

	it("refuses to read a stream it does not know, with stream.notFound", () => {
		const { read } = setup();
		expect(read("nope").result).toMatchObject({
			ok: false,
			error: { code: ERROR_CODES.streamNotFound },
		});
	});

	it("gives a late subscriber the backlog in its first batch, on the next flush", () => {
		const { hub, clock, read } = setup();
		const id = hub.create();
		hub.write(id, "stdout", "one\ntwo");
		hub.write(id, "stderr", "three");
		const reader = read(id);
		expect(reader.result.ok).toBe(true);
		expect(reader.messages).toEqual([]); // nothing is sent inside subscribe
		clock.tick();
		expect(reader.batches()).toEqual([
			{
				chunks: [
					{ seq: 0, at: 1000, channel: "stdout", text: "one" },
					{ seq: 1, at: 1000, channel: "stdout", text: "two" },
					{ seq: 2, at: 1000, channel: "stderr", text: "three" },
				],
				dropped: 0,
				ended: false,
			},
		]);
	});

	it("splits on \\n, \\r\\n and \\r; a final line break adds no empty line; empty text adds nothing", () => {
		const { hub, clock, read } = setup();
		const id = hub.create();
		hub.write(id, "stdout", "a\r\nb\rc\n");
		hub.write(id, "stdout", "");
		hub.write(id, "stdout", "\n");
		hub.write(id, "info", "d\n\ne");
		const reader = read(id);
		clock.tick();
		expect(texts(reader.batches()[0])).toEqual([
			"a",
			"b",
			"c",
			"",
			"d",
			"",
			"e",
		]);
	});

	it("sends what was written between two flushes as one batch, and nothing when idle", () => {
		const { hub, clock, read } = setup();
		const id = hub.create();
		const reader = read(id);
		expect(clock.pending()).toBe(0); // an empty stream schedules nothing
		hub.write(id, "stdout", "a");
		hub.write(id, "stdout", "b");
		hub.write(id, "stdout", "c");
		expect(clock.pending()).toBe(1);
		clock.tick();
		clock.tick();
		hub.write(id, "stdout", "d");
		clock.tick();
		expect(reader.batches().map(texts)).toEqual([["a", "b", "c"], ["d"]]);
	});

	it("sends at most one batch per flush, at most batchLines long, scheduling the next flush for the rest", () => {
		const { hub, clock, read } = setup({ batchLines: 4 });
		const id = hub.create();
		const reader = read(id);
		hub.write(id, "stdout", "1\n2\n3\n4\n5\n6\n7\n8\n9\n10");
		clock.tick();
		expect(reader.batches().map((b) => b.chunks.length)).toEqual([4]);
		expect(clock.pending()).toBe(1);
		clock.tick();
		clock.tick();
		clock.tick();
		expect(reader.batches().map((b) => b.chunks.length)).toEqual([4, 4, 2]);
		expect(clock.pending()).toBe(0);
	});

	it("caps the first batch too: a long backlog arrives over several flushes", () => {
		const { hub, clock, read } = setup({ batchLines: 2 });
		const id = hub.create();
		hub.write(id, "stdout", "a\nb\nc\nd\ne");
		const reader = read(id);
		clock.tick();
		clock.tick();
		clock.tick();
		expect(reader.batches().map(texts)).toEqual([
			["a", "b"],
			["c", "d"],
			["e"],
		]);
	});

	it("bounds the backlog: a late subscriber gets the newest lines and how many fell out", () => {
		const { hub, clock, read } = setup({ backlogLines: 3 });
		const id = hub.create();
		hub.write(id, "stdout", "1\n2\n3\n4\n5");
		const reader = read(id);
		clock.tick();
		expect(reader.batches()).toEqual([
			{
				chunks: [
					expect.objectContaining({ seq: 2, text: "3" }),
					expect.objectContaining({ seq: 3, text: "4" }),
					expect.objectContaining({ seq: 4, text: "5" }),
				],
				dropped: 2,
				ended: false,
			},
		]);
	});

	it("counts lines a slow subscriber missed, once, in the batch that skips them", () => {
		const { hub, clock, read } = setup({ backlogLines: 3 });
		const id = hub.create();
		const reader = read(id);
		hub.write(id, "stdout", "1\n2\n3\n4\n5\n6");
		clock.tick();
		hub.write(id, "stdout", "7");
		clock.tick();
		expect(reader.batches()).toEqual([
			{
				chunks: [
					expect.objectContaining({ text: "4" }),
					expect.objectContaining({ text: "5" }),
					expect.objectContaining({ text: "6" }),
				],
				dropped: 3,
				ended: false,
			},
			{
				chunks: [expect.objectContaining({ seq: 6, text: "7" })],
				dropped: 0,
				ended: false,
			},
		]);
	});

	it("sends ended: true once, after the backlog drains", () => {
		const { hub, clock, read } = setup({ batchLines: 2 });
		const id = hub.create();
		const reader = read(id);
		hub.write(id, "stdout", "a\nb\nc");
		hub.end(id);
		hub.end(id);
		for (let i = 0; i < 5; i++) clock.tick();
		expect(reader.batches()).toEqual([
			{ chunks: expect.any(Array), dropped: 0, ended: false },
			{
				chunks: [expect.objectContaining({ text: "c" })],
				dropped: 0,
				ended: true,
			},
		]);
		expect(clock.pending()).toBe(0);
	});

	it("ends with an empty batch when nothing is left to send", () => {
		const { hub, clock, read } = setup();
		const id = hub.create();
		const reader = read(id);
		hub.write(id, "stdout", "a");
		clock.tick();
		hub.end(id);
		clock.tick();
		expect(reader.batches()[1]).toEqual({
			chunks: [],
			dropped: 0,
			ended: true,
		});
	});

	it("gives a subscriber to an ended stream its backlog, then ended", () => {
		const { hub, clock, read } = setup();
		const id = hub.create();
		hub.write(id, "stdout", "a");
		hub.end(id);
		const reader = read(id);
		clock.tick();
		expect(reader.batches()).toEqual([
			{
				chunks: [expect.objectContaining({ text: "a" })],
				dropped: 0,
				ended: true,
			},
		]);
		const empty = hub.create();
		hub.end(empty);
		const late = read(empty);
		clock.tick();
		expect(late.batches()).toEqual([{ chunks: [], dropped: 0, ended: true }]);
	});

	it("ignores writes after end, and throws for a stream it never created", () => {
		const { hub, clock, read } = setup();
		const id = hub.create();
		hub.end(id);
		hub.write(id, "stdout", "too late");
		const reader = read(id);
		clock.tick();
		expect(reader.batches()).toEqual([{ chunks: [], dropped: 0, ended: true }]);
		expect(() => hub.write("nope", "stdout", "x")).toThrow(/nope/);
		expect(() => hub.end("nope")).toThrow(/nope/);
	});

	it("stops sending once the subscriber cancels, and cancels its pending flush", () => {
		const { hub, clock, read } = setup();
		const id = hub.create();
		const reader = read(id);
		hub.write(id, "stdout", "a");
		expect(clock.pending()).toBe(1);
		if (reader.result.ok) reader.result.value();
		expect(clock.pending()).toBe(0);
		hub.write(id, "stdout", "b");
		clock.tick();
		expect(reader.messages).toEqual([]);
	});

	it("serves several subscribers independently", () => {
		const { hub, clock, read } = setup();
		const id = hub.create();
		const early = read(id);
		hub.write(id, "stdout", "a");
		clock.tick();
		const late = read(id);
		hub.write(id, "stdout", "b");
		clock.tick();
		expect(early.batches().map(texts)).toEqual([["a"], ["b"]]);
		expect(late.batches().map(texts)).toEqual([["a", "b"]]);
	});

	it("masks known secrets in every chunk", () => {
		const masker = new SecretMasker();
		masker.add("sk-live-0123456789");
		const { hub, clock, read } = setup({ masker });
		const id = hub.create();
		hub.write(id, "stdout", "using sk-live-0123456789\nok");
		const reader = read(id);
		clock.tick();
		expect(texts(reader.batches()[0])).toEqual(["using ••••", "ok"]);
	});

	it("flushes every 16 ms by default (setTimeout)", () => {
		vi.useFakeTimers();
		const hub = new StreamHub({ masker: new SecretMasker() });
		const registry = new ServiceRegistry({
			contract: { operations: {}, streams: { "stream.read": streamRead } },
		});
		registry.register(hub);
		registry.start();
		const sent: StreamMessage[] = [];
		const id = hub.create();
		registry.subscribe("stream.read", { streamId: id }, (m) => sent.push(m));
		hub.write(id, "stdout", "a");
		vi.advanceTimersByTime(DEFAULT_FLUSH_MS - 1);
		expect(sent).toEqual([]);
		vi.advanceTimersByTime(1);
		expect(sent).toHaveLength(1);
		expect(DEFAULT_FLUSH_MS).toBe(16);
	});

	it("delivers 10,000 lines written at once in batches of at most batchLines, parsing once per batch (ruling 8)", () => {
		const batchParse = vi.spyOn(streamBatchSchema, "safeParse");
		const chunkParse = vi.spyOn(streamChunkSchema, "safeParse");
		expect(streamRead.event).toBe(streamBatchSchema);
		const { hub, clock, read } = setup({
			backlogLines: 10_000,
			batchLines: 500,
		});
		const id = hub.create();
		const reader = read(id);
		const lines = Array.from({ length: 10_000 }, (_, i) => `line ${i}`);
		hub.write(id, "stdout", lines.join("\n"));
		let flushes = 0;
		while (clock.pending() > 0) {
			clock.tick();
			flushes++;
		}
		const batches = reader.batches();
		expect(batches).toHaveLength(Math.ceil(10_000 / 500));
		expect(flushes).toBe(batches.length);
		for (const batch of batches) {
			expect(batch.chunks.length).toBeLessThanOrEqual(500);
			expect(batch.dropped).toBe(0);
		}
		const all = batches.flatMap((b) => b.chunks);
		expect(all.map((c) => c.text)).toEqual(lines);
		expect(all.map((c) => c.seq)).toEqual(lines.map((_, i) => i));
		// Real parse calls, counted on the schema the registry's stream path uses.
		expect(batchParse).toHaveBeenCalledTimes(batches.length);
		expect(chunkParse).not.toHaveBeenCalled();
	});
});
