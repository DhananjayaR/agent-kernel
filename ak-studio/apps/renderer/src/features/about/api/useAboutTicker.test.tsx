// useAboutTicker's test: the ticker session started and stopped through the hook against the mock transport (the
// feature's service behind a real registry, a FakeClock for its ticks), followed as a view follows it: the session
// from the store over the events subscription, its lines with `useStream`. A 10,000-line burst reaches the view in
// a few batches after the first tick, one store update each, never one per line.
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { FakeClock } from "../../../shared/bridge/mockTransport";
import {
	STREAM_BUFFER_LINES,
	useStream,
	useStreamStore,
} from "../../../shared/streams/streamStore";
import { type ConnectedMock, connectMock } from "../../../test/connectedMock";
import { useAboutTicker } from "./useAboutTicker";

let mock: ConnectedMock | undefined;
afterEach(async () => {
	await mock?.backend.sessions.stopAll();
	mock?.dispose();
	mock = undefined;
});

function renderTicker(clock: FakeClock) {
	mock = connectMock({ clock });
	return renderHook(
		() => {
			const ticker = useAboutTicker();
			const stream = useStream(ticker.session?.streamId);
			return { ticker, stream, texts: stream.lines.map((c) => c.text) };
		},
		{ wrapper: mock.wrapper },
	);
}

describe("useAboutTicker", () => {
	it("starts the ticker, shows a line a second, and stops it", async () => {
		const clock = new FakeClock(5_000);
		const { result } = renderTicker(clock);
		expect(result.current.ticker.session).toBeUndefined();
		await act(() => result.current.ticker.start());
		await waitFor(() =>
			expect(result.current.ticker.session?.state).toBe("running"),
		);
		expect(result.current.ticker.session?.info).toEqual({ startedAt: 5_000 });
		const { stop } = result.current.ticker;
		await act(() => clock.advance(3_000));
		await waitFor(() =>
			expect(result.current.texts).toEqual(["Tick 1", "Tick 2", "Tick 3"]),
		);
		// New lines re-render the view, but the calls keep their identity while the same session runs.
		expect(result.current.ticker.stop).toBe(stop);
		await act(() => result.current.ticker.stop());
		await waitFor(() =>
			expect(result.current.ticker.session?.state).toBe("stopped"),
		);
		expect(clock.sleeping).toBe(0);
		// Stopping again, with none running, does nothing.
		await act(() => result.current.ticker.stop());
	});

	it("refuses a second ticker while one runs", async () => {
		const { result } = renderTicker(new FakeClock());
		await act(() => result.current.ticker.start());
		const second = await result.current.ticker
			.start()
			.catch((err: { error: { code: string } }) => err.error.code);
		expect(second).toBe("session.alreadyRunning");
	});

	it("shows a 10,000-line burst that arrives live after the first tick, in batches, ending with its last line", async () => {
		const clock = new FakeClock();
		const { result } = renderTicker(clock);
		await act(() => result.current.ticker.start({ burst: 10_000 }));
		// The view is reading the session's stream before the burst is written.
		await waitFor(() =>
			expect(result.current.ticker.session?.state).toBe("running"),
		);
		expect(result.current.texts).toEqual([]);
		let updates = 0;
		const unsubscribe = useStreamStore.subscribe(() => {
			updates += 1;
		});
		await act(() => clock.advance(1_000));
		await waitFor(() =>
			expect(result.current.texts.at(-1)).toBe("Burst line 10000 of 10000"),
		);
		unsubscribe();
		// The view keeps its newest lines; the stream's backlog and its batches of 500 keep the updates few.
		expect(result.current.texts).toHaveLength(STREAM_BUFFER_LINES);
		expect(updates).toBeGreaterThan(1);
		expect(updates).toBeLessThanOrEqual(25);
	});
});
