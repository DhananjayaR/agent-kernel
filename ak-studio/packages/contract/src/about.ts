// The About feature's operations (architecture.md, The contract), collected into `operations` in operations.ts.
// Builders come from ./shapes, never ./operations (that would be an import cycle). Inputs are strict objects;
// outputs are plain objects, so undeclared fields are stripped before they cross the bridge.
//
// About is the throwaway proving slice of P1b (P1b-plan Task 14): one operation of each shape, a session kind and
// an app command, deleted when P2 lands its first real feature.
import "./zodConfig";
import { z } from "zod";
import { platformSchema, Revision } from "./domain";
import { ERROR_CODES } from "./errors";
import { command, defineSessionKind, job, query } from "./shapes";

/** About: info (a query: reads state, with no side effects). The app's version and platform. */
export const aboutInfo = query({
	name: "about.info",
	input: z.strictObject({}),
	output: z.object({ version: z.string(), platform: platformSchema }),
});

/** About: note (a query: reads state, with no side effects). The note kept in memory, and its revision. */
export const aboutNote = query({
	name: "about.note",
	input: z.strictObject({}),
	output: z.object({ note: z.string(), revision: Revision }),
});

/**
 * About: set note (a command: one write that finishes in under a second). Writes the note if `baseRevision` is
 * still the note's revision, else fails with `file.changedOnDisk` (no content: the caller re-reads `about.note`).
 */
export const aboutSetNote = command({
	name: "about.setNote",
	input: z.strictObject({
		note: z.string().max(10_000),
		baseRevision: Revision,
	}),
	output: z.object({ revision: Revision }),
	errors: [ERROR_CODES.fileChangedOnDisk],
});

/**
 * About: demo job (a job: slow or stepped work that ends with a result). Three steps of about a second, a
 * `confirm` request before the third, a line of output per step.
 */
export const aboutDemoJob = job({
	name: "about.demoJob",
	input: z.strictObject({}),
	result: z.object({ steps: z.int().nonnegative() }),
	title: "Demo job",
	cancellable: true,
	survivesQuit: false,
});

/**
 * About: the ticker session (a session kind: runs until stopped). Writes a line a second to its stream; with
 * `burst`, first writes that many lines at once.
 */
export const aboutTicker = defineSessionKind({
	kind: "about.ticker",
	args: z.strictObject({ burst: z.int().min(1).max(100_000).optional() }),
	info: z.object({ startedAt: z.int().nonnegative() }),
});
