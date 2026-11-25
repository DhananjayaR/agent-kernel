import { describe, expect, it } from "vitest";
import {
	ERROR_CODES,
	isStudioError,
	isStudioFailure,
	StudioFailure,
	studioError,
} from "./errors";

describe("StudioError", () => {
	it("builds a plain value, with detail only when given", () => {
		expect(studioError("a.b", "It failed.")).toEqual({
			code: "a.b",
			message: "It failed.",
		});
		expect(studioError("a.b", "It failed.", "raw")).toEqual({
			code: "a.b",
			message: "It failed.",
			detail: "raw",
		});
	});

	it("recognises StudioError values", () => {
		expect(isStudioError({ code: "a", message: "b" })).toBe(true);
		expect(isStudioError({ code: "a" })).toBe(false);
		expect(isStudioError(new Error("x"))).toBe(false);
	});

	it("wraps a StudioError as a StudioFailure for one side of the bridge", () => {
		const error = studioError(ERROR_CODES.forbidden, "Not allowed.");
		const failure = new StudioFailure(error);
		expect(failure).toBeInstanceOf(Error);
		expect(failure.message).toBe("Not allowed.");
		expect(failure.error).toBe(error);
		expect(isStudioFailure(failure)).toBe(true);
		expect(isStudioFailure(new Error("x"))).toBe(false);
	});

	it("keeps every catalog code namespaced", () => {
		for (const code of Object.values(ERROR_CODES)) {
			expect(code).toMatch(/^[a-z]+\.[A-Za-z]+$/);
		}
	});
});
