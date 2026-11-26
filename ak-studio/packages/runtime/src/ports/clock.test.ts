// The real clock: a sleep resolves after its time, and ends early, rejecting with the signal's reason, when its
// signal aborts (a cancelled job's step never runs out its second).
import { afterEach, describe, expect, it, vi } from "vitest";
import { systemClock } from "./clock";

afterEach(() => {
	vi.useRealTimers();
});

describe("systemClock", () => {
	it("tells the time and sleeps for the time asked", async () => {
		vi.useFakeTimers({ now: 5_000 });
		expect(systemClock.now()).toBe(5_000);
		const done = vi.fn();
		void systemClock.sleep(1000).then(done);
		await vi.advanceTimersByTimeAsync(999);
		expect(done).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(1);
		expect(done).toHaveBeenCalledOnce();
	});

	it("rejects with the signal's reason when it aborts, and at once when it already has", async () => {
		vi.useFakeTimers();
		const controller = new AbortController();
		const sleeping = systemClock.sleep(1000, controller.signal);
		controller.abort(new Error("stopped"));
		await expect(sleeping).rejects.toThrow("stopped");
		expect(vi.getTimerCount()).toBe(0);
		await expect(systemClock.sleep(10, controller.signal)).rejects.toThrow(
			"stopped",
		);
	});
});
