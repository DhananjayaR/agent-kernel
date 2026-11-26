import { describe, expect, it } from "vitest";
import {
	ERROR_CODES,
	isErrorCode,
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

	it("takes an optional file, line and next action", () => {
		const full = {
			code: ERROR_CODES.fileChangedOnDisk,
			message: "The file changed on disk.",
			detail: "raw",
			file: "agent.yaml",
			line: 12,
			action: {
				label: "Reload",
				commandId: "file.reload",
				args: { path: "agent.yaml" },
			},
		};
		expect(isStudioError(full)).toBe(true);
		expect(isStudioError({ ...full, action: { label: "Reload" } })).toBe(false);
		expect(isStudioError({ ...full, line: 1.5 })).toBe(false);
		expect(isStudioError({ ...full, line: "12" })).toBe(false);
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

	it("holds the P1b codes", () => {
		const p1b = [
			"project.notOpen",
			"file.changedOnDisk",
			"file.outsideProject",
			"file.notFound",
			"kernel.capabilityUnavailable",
			"job.notFound",
			"job.notWaiting",
			"job.requestMismatch",
			"job.notCancellable",
			"session.notFound",
			"session.unknownKind",
			"session.alreadyRunning",
			"session.failed",
			"stream.notFound",
		];
		const codes: string[] = Object.values(ERROR_CODES);
		for (const code of p1b) {
			expect(codes).toContain(code);
			expect(isErrorCode(code)).toBe(true);
		}
		expect(isErrorCode("bridge.invalidInput")).toBe(true);
		expect(isErrorCode("nope.nothing")).toBe(false);
		expect(new Set(codes).size).toBe(codes.length);
	});

	it("keeps every catalog code namespaced", () => {
		for (const code of Object.values(ERROR_CODES)) {
			expect(code).toMatch(/^[a-z]+\.[A-Za-z]+$/);
		}
	});
});
