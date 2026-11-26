// StreamingList over a real stream: the mock's StreamHub (batches every 16 ms of fake time, a 5,000-line backlog)
// read through the stream store. happy-dom has no layout, so the virtualised rows themselves are proved in the
// view's stories (rows in view only, follow, "Jump to latest"); here: Copy writes every line held to the clipboard,
// Clear hides what was held and keeps what comes next, the "not kept" note before and after a clear, a 10,000-line
// burst reaching the view in a few store updates, and a failed stream's error.
import { ERROR_CODES } from "@ak-studio/contract";
import { DEFAULT_FLUSH_MS } from "@ak-studio/runtime";
import { act, fireEvent, render, screen } from "@testing-library/react";
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	type MockInstance,
	vi,
} from "vitest";
import { setTransport } from "../bridge/client";
import { createMockBackend, type MockBackend } from "../bridge/mockTransport";
import { STREAM_BUFFER_LINES, useStreamStore } from "../streams/streamStore";
import { bindFailureNotice } from "./failureNotice";
import { StreamingList } from "./StreamingList";
import { patternStrings } from "./strings";

let backend: MockBackend;
let writeText: MockInstance<(text: string) => Promise<void>>;

beforeEach(() => {
	vi.useFakeTimers();
	useStreamStore.setState({ streams: {} });
	backend = createMockBackend({ onStreamError: () => {} });
	setTransport(backend.transport);
	writeText = vi.fn(async (_text: string) => {});
	Object.defineProperty(navigator, "clipboard", {
		value: { writeText },
		configurable: true,
	});
});
afterEach(() => {
	vi.useRealTimers();
	setTransport(undefined);
});

/** "line 0" … as one write, as a burst of output does. */
const lines = (from: number, count: number) =>
	Array.from({ length: count }, (_, i) => `line ${from + i}`).join("\n");

async function flushAll() {
	await act(async () => {
		await vi.advanceTimersByTimeAsync(DEFAULT_FLUSH_MS * 40);
	});
}

/** Presses a React Aria button (a virtual click: usePress answers it). */
async function press(name: string) {
	await act(async () => {
		fireEvent.click(screen.getByRole("button", { name }));
	});
}

describe("StreamingList", () => {
	it("copies every line held, with the escape sequences removed", async () => {
		const streamId = backend.streams.create();
		backend.streams.write(streamId, "stdout", "\x1b[31mERROR\x1b[0m one\ntwo");
		render(<StreamingList streamId={streamId} label="Output" />);
		await flushAll();
		await press("Copy");
		expect(writeText).toHaveBeenCalledWith("ERROR one\ntwo");
		expect(screen.getByRole("status").textContent).toBe("Output copied");
	});

	it("does not say copied when the clipboard refuses, and reports it (the Shell's toast) and logs it", async () => {
		const log = vi.spyOn(console, "error").mockImplementation(() => {});
		const notify = vi.fn();
		const unbind = bindFailureNotice(notify);
		writeText.mockRejectedValue(new Error("not allowed"));
		const streamId = backend.streams.create();
		backend.streams.write(streamId, "stdout", "one");
		render(<StreamingList streamId={streamId} label="Output" />);
		await flushAll();
		await press("Copy");
		expect(screen.getByRole("status").textContent).toBe("");
		expect(log).toHaveBeenCalledWith(
			"[studio] copying to the clipboard failed: not allowed",
		);
		expect(notify).toHaveBeenCalledWith(patternStrings.copyFailed);
		unbind();
	});

	it("clears what it held, in this view only, and shows what comes next", async () => {
		const streamId = backend.streams.create();
		backend.streams.write(streamId, "stdout", lines(0, 3));
		render(<StreamingList streamId={streamId} label="Output" />);
		await flushAll();
		await press("Clear");
		expect(screen.getByRole("region", { name: "Output" }).textContent).toBe(
			"No output yet",
		);
		// The stream itself is untouched: the store still holds the lines.
		expect(useStreamStore.getState().streams[streamId]?.lines).toHaveLength(3);
		backend.streams.write(streamId, "stdout", lines(3, 2));
		await flushAll();
		await press("Copy");
		expect(writeText).toHaveBeenLastCalledWith("line 3\nline 4");
	});

	it("says how many earlier lines were not kept, and after a clear only those lost since", async () => {
		const streamId = backend.streams.create();
		backend.streams.write(
			streamId,
			"stdout",
			lines(0, STREAM_BUFFER_LINES + 20),
		);
		render(<StreamingList streamId={streamId} label="Output" />);
		await flushAll();
		expect(screen.getByText("20 earlier lines not kept")).toBeTruthy();
		await press("Clear");
		expect(screen.queryByText(/earlier lines? not kept/)).toBeNull();
		backend.streams.write(
			streamId,
			"stdout",
			lines(STREAM_BUFFER_LINES + 20, STREAM_BUFFER_LINES + 1),
		);
		await flushAll();
		expect(screen.getByText("1 earlier line not kept")).toBeTruthy();
	});

	it("takes a 10,000-line burst in a few store updates, never one per line", async () => {
		const streamId = backend.streams.create();
		const updates = vi.fn();
		const unsubscribe = useStreamStore.subscribe(updates);
		render(<StreamingList streamId={streamId} label="Output" />);
		backend.streams.write(streamId, "stdout", lines(0, 10_000));
		await flushAll();
		unsubscribe();
		expect(
			useStreamStore.getState().streams[streamId]?.lines.at(-1)?.text,
		).toBe("line 9999");
		expect(updates.mock.calls.length).toBeGreaterThan(0);
		expect(updates.mock.calls.length).toBeLessThanOrEqual(25);
	});

	it("shows a failed stream's error above what arrived", async () => {
		render(<StreamingList streamId="gone" label="Output" />);
		await flushAll();
		const alert = screen.getByRole("alert");
		expect(alert.textContent).toBeTruthy();
		expect(useStreamStore.getState().streams.gone?.error?.code).toBe(
			ERROR_CODES.streamNotFound,
		);
	});

	it("starts afresh for a new stream: no copied state carried over", async () => {
		const first = backend.streams.create();
		const second = backend.streams.create();
		backend.streams.write(first, "stdout", "one");
		backend.streams.write(second, "stdout", "two");
		const view = render(<StreamingList streamId={first} label="Output" />);
		await flushAll();
		await press("Copy");
		expect(screen.getByRole("status").textContent).toBe("Output copied");
		view.rerender(<StreamingList streamId={second} label="Output" />);
		await flushAll();
		expect(screen.getByRole("status").textContent).toBe("");
		await press("Copy");
		expect(writeText).toHaveBeenLastCalledWith("two");
	});

	it("shows nothing and subscribes to nothing with no stream", () => {
		const subscribe = vi.spyOn(backend.transport, "subscribe");
		render(<StreamingList streamId={undefined} label="Output" />);
		expect(subscribe).not.toHaveBeenCalled();
		expect(screen.queryByRole("button", { name: "Clear" })).toBeNull();
	});
});
