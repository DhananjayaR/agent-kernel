import { describe, expect, it } from "vitest";
import { contrastRatio, gradeContrast, parseHex } from "./contrast";

function ratio(fg: string, bg: string): number {
	const a = parseHex(fg);
	const b = parseHex(bg);
	if (!a || !b) throw new Error("bad hex");
	return Math.round(contrastRatio(a, b) * 100) / 100;
}

describe("contrastRatio", () => {
	it("spans 1 to 21", () => {
		expect(ratio("#000000", "#ffffff")).toBe(21);
		expect(ratio("#777", "#777777")).toBe(1);
	});

	it("is symmetric", () => {
		expect(ratio("#ff5e32", "#02284f")).toBe(ratio("#02284f", "#ff5e32"));
	});

	// Cross-check against the measured table in research/p1a-design-gate-options.md.
	it.each([
		["#ff5e32", "#011428", 6.09],
		["#ff5e32", "#02284f", 4.86],
		["#ff5e32", "#ffffff", 3.04],
		["#798bad", "#011428", 5.4],
		["#5d7199", "#f1f5fa", 4.47],
		["#3f598a", "#e7eef7", 5.98],
	])("%s on %s is %s", (fg, bg, expected) => {
		expect(ratio(fg, bg)).toBe(expected);
	});
});

describe("gradeContrast", () => {
	it("grades at the WCAG thresholds", () => {
		expect(gradeContrast(4.5)).toBe("text");
		expect(gradeContrast(4.49)).toBe("non-text");
		expect(gradeContrast(3)).toBe("non-text");
		expect(gradeContrast(2.99)).toBe("fail");
	});
});

describe("parseHex", () => {
	it("reads short and long forms", () => {
		expect(parseHex("#fff")).toEqual([255, 255, 255]);
		expect(parseHex("#02284F")).toEqual([2, 40, 79]);
	});

	it("rejects anything else", () => {
		expect(parseHex("rgb(0 0 0)")).toBeNull();
		expect(parseHex("#12345")).toBeNull();
	});
});
