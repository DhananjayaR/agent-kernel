// A test-only job kind for the Electron e2e (tests/e2e/electron.spec.ts): a job marked `survivesQuit`, so the quit
// rule's "Wait" dialog can be proved before P10 brings the first real one (`terraform apply`). Registered only when
// index.ts turns the test hooks on (a development or e2e build, unpackaged, started with AK_STUDIO_TEST_HOOKS=1):
// never in a production or packaged build (tools/packaged-smoke.mjs checks its name is not in the bundle), and never
// in the mock transport. It is not in the contract, so the renderer cannot start it: the test starts and finishes it
// through main's test hooks (`app.evaluate`).
import {
	jobKinds as contractJobKinds,
	type JobId,
	job,
} from "@ak-studio/contract";
import type { JobService } from "@ak-studio/runtime";
import { z } from "zod";

/** The test kind's name. */
const TEST_SURVIVING_JOB = "test.survivesQuit";

/**
 * A started job of this kind blocks the quit until it finishes, or the person chooses "Quit anyway". Built when
 * asked, not at module load, so a production build (which never asks) drops it with the rest of this module.
 */
function testSurvivingJob() {
	return job({
		name: TEST_SURVIVING_JOB,
		input: z.strictObject({}),
		result: z.object({}),
		title: "Test job that must finish",
		cancellable: false,
		survivesQuit: true,
	});
}

/** The contract's job kinds and the test kind: what JobService runs while the test hooks are on. */
export function testJobKinds() {
	return Object.freeze({
		...contractJobKinds,
		[TEST_SURVIVING_JOB]: testSurvivingJob(),
	});
}

/** What the test hooks can do with the test kind. */
export interface TestJobs {
	/** Starts a job of the test kind; it runs until `finishSurvivingJobs` or a cancel (Quit anyway). */
	startSurvivingJob(): JobId;
	/** Ends every running job of the test kind, as if its work were done. */
	finishSurvivingJobs(): void;
}

/** Gives the test kind its runner on `jobs` (built with testJobKinds()), and answers the calls that drive it. */
export function defineTestJobs(jobs: JobService): TestJobs {
	// `jobs` was built with testJobKinds() (registerServices' `jobKinds`); its type names the contract's kinds only.
	const service = jobs as unknown as JobService<
		ReturnType<typeof testJobKinds>
	>;
	// By job id: a finish may come before the job's runner has been called (it starts after the record is written).
	const started = new Set<JobId>();
	const finished = new Set<JobId>();
	const finishers = new Map<JobId, () => void>();
	service.define(
		TEST_SURVIVING_JOB,
		(_input, ctx) =>
			new Promise<Record<string, never>>((resolve, reject) => {
				if (finished.has(ctx.jobId)) {
					resolve({});
					return;
				}
				finishers.set(ctx.jobId, () => resolve({}));
				ctx.signal.addEventListener(
					"abort",
					() => {
						finishers.delete(ctx.jobId);
						reject(ctx.signal.reason);
					},
					{ once: true },
				);
			}),
	);
	const start = service.handler(TEST_SURVIVING_JOB);
	return {
		startSurvivingJob: () => {
			const { jobId } = start({}) as { jobId: JobId };
			started.add(jobId);
			return jobId;
		},
		finishSurvivingJobs: () => {
			for (const jobId of started) {
				finished.add(jobId);
				finishers.get(jobId)?.();
				finishers.delete(jobId);
			}
			started.clear();
		},
	};
}
