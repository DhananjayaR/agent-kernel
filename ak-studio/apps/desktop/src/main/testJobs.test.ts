// The e2e's test job kind (testJobs.ts) on the real services, as index.ts wires it when the test hooks are on: a
// started job of the kind blocks the quit (the quit plan's `blocking`), finishing it ends it succeeded, and a cancel
// (the quit rule's "Quit anyway") ends it cancelled. Without the test kinds, the contract's JobService refuses it.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ServiceRegistry } from "@ak-studio/runtime";
import { afterEach, describe, expect, it, vi } from "vitest";
import { registerServices } from "./services/registerServices";
import { defineTestJobs, testJobKinds } from "./testJobs";

const roots: string[] = [];
afterEach(() => {
	for (const root of roots.splice(0))
		rmSync(root, { recursive: true, force: true });
});

function services(withTestKinds: boolean) {
	const root = mkdtempSync(join(tmpdir(), "ak-studio-test-jobs-"));
	roots.push(root);
	const registry = new ServiceRegistry({ log: vi.fn() });
	return registerServices(registry, {
		window: () => null,
		app: {
			version: "1.0.0",
			platform: "linux",
			preferencesFile: join(root, "preferences.json"),
		},
		jobRecordsDir: join(root, "jobs"),
		log: vi.fn(),
		...(withTestKinds ? { jobKinds: testJobKinds() } : {}),
	});
}

describe("the test job kind", () => {
	it("blocks the quit while it runs, and ends succeeded when finished", async () => {
		const { jobs } = services(true);
		const test = defineTestJobs(jobs);
		const jobId = test.startSurvivingJob();
		await vi.waitFor(() =>
			expect(jobs.quitPlan().blocking.map((job) => job.id)).toEqual([jobId]),
		);
		expect(jobs.quitPlan().toCancel).toEqual([]);
		test.finishSurvivingJobs();
		await vi.waitFor(() =>
			expect(jobs.list().find((job) => job.id === jobId)?.state).toBe(
				"succeeded",
			),
		);
		expect(jobs.quitPlan().blocking).toEqual([]);
	});

	it("ends cancelled when the quit cancels it", async () => {
		const { jobs } = services(true);
		const jobId = defineTestJobs(jobs).startSurvivingJob();
		await jobs.cancelAll([{ id: jobId }]);
		expect(jobs.list().find((job) => job.id === jobId)?.state).toBe(
			"cancelled",
		);
	});

	it("is not a kind the app's JobService runs", () => {
		const { jobs } = services(false);
		expect(() => defineTestJobs(jobs)).toThrow(/not a job kind/);
	});
});
