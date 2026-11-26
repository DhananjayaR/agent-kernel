// The job progress pattern's elapsed time: whole seconds, then minutes and seconds, then hours and minutes.
import { describe, expect, it } from "vitest";
import { formatElapsed } from "./job-progress";

describe("formatElapsed", () => {
	it("counts whole seconds under a minute", () => {
		expect(formatElapsed(0)).toBe("0 s");
		expect(formatElapsed(1_000)).toBe("1 s");
		expect(formatElapsed(59_999)).toBe("59 s");
	});

	it("counts minutes and seconds under an hour, then hours and minutes", () => {
		expect(formatElapsed(60_000)).toBe("1 min 0 s");
		expect(formatElapsed(72_400)).toBe("1 min 12 s");
		expect(formatElapsed(3_599_000)).toBe("59 min 59 s");
		expect(formatElapsed(3_600_000)).toBe("1 h 0 min");
		expect(formatElapsed(3_900_000)).toBe("1 h 5 min");
	});

	it("never shows a negative time (a clock that went back)", () => {
		expect(formatElapsed(-5_000)).toBe("0 s");
	});
});
