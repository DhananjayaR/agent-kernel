// The operations every job shares, served by JobService: answer a job's open request, cancel a job, list the
// jobs (a reloaded window reattaches with this), and the crash-recovery records of jobs that never ended.
// Each job kind is its own operation, declared with `job` in its feature's contract file.
import "./zodConfig";
import { z } from "zod";
import { interruptedJobSchema, JobId, jobSchema } from "./domain";
import { ERROR_CODES } from "./errors";
import { command, query } from "./shapes";

/** Answers the job's open request: the chosen option, or the name typed for `confirm-by-name`. */
export const jobRespond = command({
	name: "job.respond",
	input: z.strictObject({
		jobId: JobId,
		requestId: z.string().min(1),
		answer: z.strictObject({
			optionId: z.string().optional(),
			name: z.string().optional(),
		}),
	}),
	output: z.object({}),
	errors: [
		ERROR_CODES.jobNotFound,
		ERROR_CODES.jobNotWaiting,
		ERROR_CODES.jobRequestMismatch,
	],
});

/** Cancels a job; it ends in `cancelled` (an open request is denied). */
export const jobCancel = command({
	name: "job.cancel",
	input: z.strictObject({ jobId: JobId }),
	output: z.object({}),
	errors: [ERROR_CODES.jobNotFound, ERROR_CODES.jobNotCancellable],
});

/** Every job the main process knows in this run, queued, running or ended. */
export const jobsList = query({
	name: "jobs.list",
	input: z.strictObject({}),
	output: z.object({ jobs: z.array(jobSchema) }),
});

/** Jobs from an earlier run that started and never ended (the app quit or crashed). */
export const jobsInterrupted = query({
	name: "jobs.interrupted",
	input: z.strictObject({}),
	output: z.object({ records: z.array(interruptedJobSchema) }),
});

/** Removes an interrupted job's record once the user has seen the notice. */
export const jobsDismissInterrupted = command({
	name: "jobs.dismissInterrupted",
	input: z.strictObject({ jobId: JobId }),
	output: z.object({}),
	errors: [ERROR_CODES.jobNotFound],
});
