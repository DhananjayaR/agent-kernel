// The window's unsaved registry: labels listed once, `beforeunload` refused only while something is unsaved, and
// main told of the list after a short pause, at once when the last item clears, and never twice the same.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UNSAVED_REPORT_DELAY_MS, UnsavedWork } from "./unsaved";

function setup() {
	const target = new EventTarget();
	const report = vi.fn(async (_items: string[]) => ({}));
	const log = vi.fn();
	const work = new UnsavedWork({
		report,
		target: () => target as unknown as Window,
		log,
	});
	const unload = () => {
		const event = new Event("beforeunload", { cancelable: true });
		target.dispatchEvent(event);
		return event.defaultPrevented ? "refused" : "allowed";
	};
	return { work, report, log, unload };
}

beforeEach(() => {
	vi.useFakeTimers();
});
afterEach(() => {
	vi.useRealTimers();
});

describe("UnsavedWork", () => {
	it("refuses the page's unload only while something is unsaved", () => {
		const { work, unload } = setup();
		expect(unload()).toBe("allowed");
		const clearA = work.add("Config: session section");
		const clearB = work.add("Rules: refunds");
		expect(unload()).toBe("refused");
		clearA();
		expect(unload()).toBe("refused");
		clearB();
		expect(unload()).toBe("allowed");
		// Clearing twice does nothing more.
		clearB();
		expect(work.items()).toEqual([]);
	});

	it("lists each label once, in the order it became unsaved", () => {
		const { work } = setup();
		work.add("Rules: refunds");
		const second = work.add("Config: session section");
		work.add("Rules: refunds");
		expect(work.items()).toEqual(["Rules: refunds", "Config: session section"]);
		second();
		expect(work.items()).toEqual(["Rules: refunds"]);
	});

	it("tells main the first item at once, later changes after a pause, and the last item clearing at once", async () => {
		const { work, report } = setup();
		const clearA = work.add("Config: session section");
		// No timer runs: the first item goes at the end of this task, so a quit right after the first edit knows.
		await Promise.resolve();
		expect(report).toHaveBeenCalledExactlyOnceWith(["Config: session section"]);
		await vi.advanceTimersByTimeAsync(UNSAVED_REPORT_DELAY_MS / 2);
		const clearB = work.add("Rules: refunds");
		await vi.advanceTimersByTimeAsync(UNSAVED_REPORT_DELAY_MS - 1);
		expect(report).toHaveBeenCalledOnce();
		await vi.advanceTimersByTimeAsync(1);
		expect(report).toHaveBeenLastCalledWith([
			"Config: session section",
			"Rules: refunds",
		]);
		clearA();
		await vi.advanceTimersByTimeAsync(UNSAVED_REPORT_DELAY_MS);
		expect(report).toHaveBeenLastCalledWith(["Rules: refunds"]);
		clearB();
		expect(report).toHaveBeenLastCalledWith([]);
		expect(report).toHaveBeenCalledTimes(4);
		// Unsaved again after a clear: that is a first item again, told at once.
		work.add("Rules: refunds");
		await Promise.resolve();
		expect(report).toHaveBeenLastCalledWith(["Rules: refunds"]);
	});

	it("sends one report when a second item follows the first before it is told", async () => {
		const { work, report } = setup();
		work.add("Config: session section");
		work.add("Rules: refunds");
		await Promise.resolve();
		expect(report).toHaveBeenCalledExactlyOnceWith([
			"Config: session section",
			"Rules: refunds",
		]);
		// The pause timer the second add started finds main up to date.
		await vi.advanceTimersByTimeAsync(UNSAVED_REPORT_DELAY_MS);
		expect(report).toHaveBeenCalledOnce();
	});

	it("does not tell main a list it already has", async () => {
		const { work, report } = setup();
		// Added and cleared in one go: main, which has nothing, is told nothing.
		work.add("Config: session section")();
		await vi.advanceTimersByTimeAsync(UNSAVED_REPORT_DELAY_MS);
		expect(report).not.toHaveBeenCalled();
		// Added, cleared and added again in one go (StrictMode's double mount): told once.
		work.add("Rules: refunds")();
		work.add("Rules: refunds");
		await vi.advanceTimersByTimeAsync(UNSAVED_REPORT_DELAY_MS);
		expect(report).toHaveBeenCalledExactlyOnceWith(["Rules: refunds"]);
	});

	it("logs a failed report and sends the list again on the next change", async () => {
		const { work, report, log } = setup();
		report.mockRejectedValueOnce(new Error("bridge down"));
		const clear = work.add("Config: session section");
		await vi.advanceTimersByTimeAsync(UNSAVED_REPORT_DELAY_MS);
		expect(log).toHaveBeenCalledWith(expect.stringContaining("bridge down"));
		clear();
		work.add("Config: session section");
		await vi.advanceTimersByTimeAsync(UNSAVED_REPORT_DELAY_MS);
		expect(report).toHaveBeenCalledTimes(3);
		expect(report).toHaveBeenLastCalledWith(["Config: session section"]);
	});
});
