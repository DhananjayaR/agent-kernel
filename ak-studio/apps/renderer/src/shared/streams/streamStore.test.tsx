// The stream store, against the mock's real StreamHub (batches every 16 ms of fake time, a 5,000-line backlog,
// 500 lines a batch): one `stream.read` subscription however many views show a stream, closed with the last view;
// the bounded buffer and its `dropped` count; a 10,000-line burst applied a batch at a time, never a line at a
// time; and a stream that fails.
import { ERROR_CODES, type StreamBatch } from "@ak-studio/contract";
import { DEFAULT_BATCH_LINES, DEFAULT_FLUSH_MS } from "@ak-studio/runtime";
import { act, render, renderHook, screen } from "@testing-library/react";
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	type Mock,
	vi,
} from "vitest";
import { setTransport } from "../bridge/client";
import { createMockBackend } from "../bridge/mockTransport";
import {
	appendBatch,
	EMPTY_STREAM,
	STREAM_BUFFER_LINES,
	useStream,
	useStreamStore,
} from "./streamStore";

function setup() {
	const backend = createMockBackend({ onStreamError: () => {} });
	// Each subscription's close function, as a spy.
	const closes: Mock<() => void>[] = [];
	const open = backend.transport.subscribe.bind(backend.transport);
	const subscribe = vi
		.spyOn(backend.transport, "subscribe")
		.mockImplementation((...args: Parameters<typeof open>) => {
			const close = vi.fn(open(...args));
			closes.push(close);
			return close;
		});
	setTransport(backend.transport);
	const streamId = backend.streams.create();
	return { backend, subscribe, closes, streamId };
}

/** Writes `count` lines in one write ("line 0" … ), as a burst of output does. */
const lines = (from: number, count: number) =>
	Array.from({ length: count }, (_, i) => `line ${from + i}`).join("\n");

/** Lets StreamHub flush everything it has (each flush is one batch, 16 ms apart). */
async function flushAll() {
	await act(async () => {
		await vi.advanceTimersByTimeAsync(DEFAULT_FLUSH_MS * 40);
	});
}

function Output({ id, label }: { id: string; label: string }) {
	const { lines, dropped, ended } = useStream(id);
	return (
		<p data-testid={label}>
			{lines.length} {dropped} {String(ended)}
		</p>
	);
}

beforeEach(() => {
	vi.useFakeTimers();
	useStreamStore.setState({ streams: {} });
});
afterEach(() => {
	vi.useRealTimers();
	setTransport(undefined);
});

describe("useStream: one subscription per stream", () => {
	it("shares one stream.read between two views, and closes it when the last one unmounts", async () => {
		const { backend, subscribe, closes, streamId } = setup();
		backend.streams.write(streamId, "stdout", lines(0, 3));
		const two = render(
			<>
				<Output id={streamId} label="a" />
				<Output id={streamId} label="b" />
			</>,
		);
		await flushAll();
		expect(subscribe).toHaveBeenCalledOnce();
		expect(subscribe.mock.calls[0]?.slice(0, 2)).toEqual([
			"stream.read",
			{ streamId },
		]);
		expect(screen.getByTestId("a").textContent).toBe("3 0 false");
		expect(screen.getByTestId("b").textContent).toBe("3 0 false");
		// Unmounting one of two views keeps the subscription.
		two.rerender(<Output id={streamId} label="a" />);
		backend.streams.write(streamId, "stdout", lines(3, 2));
		await flushAll();
		expect(screen.getByTestId("a").textContent).toBe("5 0 false");
		expect(closes[0]).not.toHaveBeenCalled();
		// The last view going closes it: the main process stops sending, and the lines are forgotten.
		two.unmount();
		expect(closes[0]).toHaveBeenCalledOnce();
		backend.streams.write(streamId, "stdout", lines(5, 2));
		await flushAll();
		expect(useStreamStore.getState().streams).toEqual({});
		// A view that comes back opens a new subscription and reads the backlog again.
		render(<Output id={streamId} label="c" />);
		await flushAll();
		expect(subscribe).toHaveBeenCalledTimes(2);
		expect(screen.getByTestId("c").textContent).toBe("7 0 false");
	});

	it("subscribes to nothing for no stream id", () => {
		const { subscribe } = setup();
		const { result } = renderHook(() => useStream(undefined));
		expect(result.current).toBe(EMPTY_STREAM);
		expect(subscribe).not.toHaveBeenCalled();
	});

	it("shows the end of the stream", async () => {
		const { backend, streamId } = setup();
		const { result } = renderHook(() => useStream(streamId));
		backend.streams.write(streamId, "stdout", "done");
		backend.streams.end(streamId);
		await flushAll();
		expect(result.current.lines.map((l) => l.text)).toEqual(["done"]);
		expect(result.current.ended).toBe(true);
	});

	it("ends with the error when the stream fails (one that is gone)", async () => {
		const { backend, streamId } = setup();
		backend.streams.release(streamId);
		const { result } = renderHook(() => useStream(streamId));
		expect(result.current.ended).toBe(true);
		expect(result.current.error?.code).toBe(ERROR_CODES.streamNotFound);
	});
});

describe("useStream: the bounded buffer", () => {
	it(`keeps the newest ${STREAM_BUFFER_LINES} lines and counts the ones it evicts in dropped`, async () => {
		const { backend, streamId } = setup();
		const { result } = renderHook(() => useStream(streamId));
		backend.streams.write(streamId, "stdout", lines(0, STREAM_BUFFER_LINES));
		await flushAll();
		expect(result.current.lines).toHaveLength(STREAM_BUFFER_LINES);
		expect(result.current.dropped).toBe(0);
		// 3,000 more: the main process sends them all (its backlog has room); the buffer evicts the oldest 3,000.
		backend.streams.write(streamId, "stdout", lines(STREAM_BUFFER_LINES, 3000));
		await flushAll();
		expect(result.current.lines).toHaveLength(STREAM_BUFFER_LINES);
		expect(result.current.dropped).toBe(3000);
		expect(result.current.lines[0]?.text).toBe("line 3000");
		expect(result.current.lines.at(-1)?.text).toBe(
			`line ${STREAM_BUFFER_LINES + 3000 - 1}`,
		);
	});

	it("applies a 10,000-line burst a batch at a time, adding the main process's dropped lines", async () => {
		const { backend, streamId } = setup();
		const { result } = renderHook(() => useStream(streamId));
		await flushAll();
		const updates = vi.fn();
		const unsubscribe = useStreamStore.subscribe(updates);
		backend.streams.write(streamId, "stdout", lines(0, 10_000));
		await flushAll();
		unsubscribe();
		// The main process's backlog keeps 5,000 and says so in `dropped`; the rest come 500 to a batch.
		const batches = STREAM_BUFFER_LINES / DEFAULT_BATCH_LINES;
		expect(updates).toHaveBeenCalledTimes(batches);
		expect(result.current.lines).toHaveLength(STREAM_BUFFER_LINES);
		expect(result.current.dropped).toBe(5000);
		expect(result.current.lines[0]?.text).toBe("line 5000");
		expect(result.current.lines.at(-1)?.text).toBe("line 9999");
	});
});

describe("appendBatch", () => {
	const chunk = (seq: number) => ({
		seq,
		at: 1,
		channel: "stdout" as const,
		text: `line ${seq}`,
	});
	const batch = (
		from: number,
		count: number,
		extra: Partial<StreamBatch> = {},
	) => ({
		chunks: Array.from({ length: count }, (_, i) => chunk(from + i)),
		dropped: 0,
		ended: false,
		...extra,
	});

	it("keeps the newest lines when one batch alone is over the limit", () => {
		const view = appendBatch(
			appendBatch(EMPTY_STREAM, batch(0, 3), 4),
			batch(3, 6),
			4,
		);
		expect(view.lines.map((l) => l.seq)).toEqual([5, 6, 7, 8]);
		expect(view.dropped).toBe(5);
	});

	it("answers the same view for a batch that changes nothing", () => {
		const view = appendBatch(EMPTY_STREAM, batch(0, 2));
		expect(appendBatch(view, batch(2, 0))).toBe(view);
		expect(appendBatch(view, batch(2, 0, { dropped: 4 })).dropped).toBe(4);
		expect(appendBatch(view, batch(2, 0, { ended: true })).ended).toBe(true);
	});
});
