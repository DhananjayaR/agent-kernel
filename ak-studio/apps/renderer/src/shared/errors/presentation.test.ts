// The error presentations: every code in the catalog has one (architecture.md, Errors: "a code with no
// presentation fails a test"), each title follows the copy rules, and a code outside the catalog still gets one.
import { ERROR_CODES } from "@ak-studio/contract";
import { describe, expect, it } from "vitest";
import {
	ERROR_PLACEMENTS,
	ERROR_PRESENTATIONS,
	errorPresentation,
} from "./presentation";

const catalog = Object.values(ERROR_CODES);

describe("errorPresentation", () => {
	it("has an entry for every code in the catalog, and none for a code outside it", () => {
		for (const code of catalog) {
			expect(ERROR_PRESENTATIONS, code).toHaveProperty([code]);
		}
		expect(Object.keys(ERROR_PRESENTATIONS).sort()).toEqual(
			[...catalog].sort(),
		);
	});

	it("covers the codes added in P1b: files, streams, jobs and sessions", () => {
		for (const code of [
			"file.notFound",
			"file.changedOnDisk",
			"stream.notFound",
			"job.notFound",
			"job.notWaiting",
			"job.requestMismatch",
			"job.notCancellable",
			"session.notFound",
			"session.unknownKind",
			"session.alreadyRunning",
			"session.failed",
		]) {
			expect(errorPresentation(code).title, code).not.toBe(
				errorPresentation("internal.unexpected").title,
			);
		}
	});

	it("gives each a known placement and a sentence-case title that says what happened", () => {
		for (const code of catalog) {
			const { title, placement } = errorPresentation(code);
			expect(ERROR_PLACEMENTS, code).toContain(placement);
			expect(title.length, code).toBeGreaterThan(0);
			// Sentence case: a capital first letter, then no capitalised word except OAK and the app's names.
			expect(title[0], code).toBe(title[0]?.toUpperCase());
			const rest = title
				.slice(1)
				.split(/\s+/)
				.filter((word) => /^[A-Z]/.test(word) && word !== "OAK");
			expect(rest, `${code}: "${title}"`).toEqual([]);
			expect(title, code).not.toMatch(/something went wrong/i);
			expect(title.endsWith("."), code).toBe(false);
		}
	});

	it("places a changed file as a banner over the view, and a background save as a toast", () => {
		expect(errorPresentation("file.changedOnDisk").placement).toBe("banner");
		expect(errorPresentation("app.preferencesNotSaved").placement).toBe(
			"toast",
		);
		expect(errorPresentation("bridge.invalidInput").placement).toBe("inline");
	});

	it("presents a code outside the catalog as an unexpected error", () => {
		expect(errorPresentation("feature.madeUp")).toEqual(
			errorPresentation("internal.unexpected"),
		);
	});
});
