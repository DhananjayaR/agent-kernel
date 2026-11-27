// The unsaved changes guard's blocker is the app's only router blocker, held through patterns/UnsavedChangesGuard.tsx:
// so the guard's `proceed()` always navigates (its Discard drops the copies, then leaves), and no view holds a blocker
// of its own outside the guards' registry (which would ask in turn, one view at a time).
import { describe, expect, it } from "vitest";

// Every source file of the renderer, as text (Vite's glob, as app/registry.test.ts reads them); tests left out.
const sources = import.meta.glob<string>(
	[
		"../../**/*.{ts,tsx}",
		"!../../**/*.test.{ts,tsx}",
		"!../../**/*.stories.tsx",
	],
	{ query: "?raw", import: "default", eager: true },
);

const callers = (pattern: RegExp) =>
	Object.entries(sources)
		.filter(([, text]) => pattern.test(text))
		.map(([path]) => path)
		.sort();

describe("router blockers", () => {
	it("reads the renderer's source (the scan is not empty)", () => {
		expect(Object.keys(sources)).toContain("./useUnsavedGuard.ts");
	});

	it("only useUnsavedGuard.ts calls TanStack's useBlocker", () => {
		expect(callers(/\buseBlocker\(/)).toEqual(["./useUnsavedGuard.ts"]);
	});

	it("only UnsavedChangesGuard.tsx holds the unsaved blocker", () => {
		expect(callers(/\buseUnsavedBlocker\(/)).toEqual([
			"../patterns/UnsavedChangesGuard.tsx",
			"./useUnsavedGuard.ts",
		]);
	});
});
