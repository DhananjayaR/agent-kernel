// The job operations: answering a request, cancelling, listing jobs and the interrupted-job records.
import { describe, expect, it } from "vitest";
import { ERROR_CODES } from "./errors";
import {
	jobCancel,
	jobRespond,
	jobsDismissInterrupted,
	jobsInterrupted,
	jobsList,
} from "./jobs";

const job = {
	id: "j1",
	kind: "t.job",
	title: "A job",
	state: "queued",
	commandIds: [],
	cancellable: true,
	survivesQuit: false,
};

describe("job operations", () => {
	it("are named and shaped as the plan says", () => {
		expect(
			[jobRespond, jobCancel, jobsDismissInterrupted].map((op) => [
				op.name,
				op.shape,
			]),
		).toEqual([
			["job.respond", "command"],
			["job.cancel", "command"],
			["jobs.dismissInterrupted", "command"],
		]);
		expect(
			[jobsList, jobsInterrupted].map((op) => [op.name, op.shape]),
		).toEqual([
			["jobs.list", "query"],
			["jobs.interrupted", "query"],
		]);
	});

	it("job.respond takes jobId, requestId and a strict answer", () => {
		const input = { jobId: "j1", requestId: "r1", answer: { optionId: "yes" } };
		expect(jobRespond.input.parse(input)).toEqual(input);
		expect(
			jobRespond.input.parse({ ...input, answer: { name: "prod" } }),
		).toEqual({ ...input, answer: { name: "prod" } });
		for (const bad of [
			{ ...input, extra: 1 },
			{ ...input, answer: { optionId: "yes", extra: 1 } },
			{ ...input, jobId: "" },
			{ jobId: "j1", answer: {} },
		]) {
			expect(jobRespond.input.safeParse(bad).success).toBe(false);
		}
		expect(jobRespond.errors).toEqual([
			ERROR_CODES.jobNotFound,
			ERROR_CODES.jobNotWaiting,
			ERROR_CODES.jobRequestMismatch,
		]);
	});

	it("job.cancel and jobs.dismissInterrupted take a strict { jobId }", () => {
		for (const op of [jobCancel, jobsDismissInterrupted]) {
			expect(op.input.parse({ jobId: "j1" })).toEqual({ jobId: "j1" });
			expect(op.input.safeParse({ jobId: "j1", extra: 1 }).success).toBe(false);
			expect(op.input.safeParse({}).success).toBe(false);
			expect(op.output.parse({ extra: 1 })).toEqual({});
		}
		expect(jobCancel.errors).toEqual([
			ERROR_CODES.jobNotFound,
			ERROR_CODES.jobNotCancellable,
		]);
		expect(jobsDismissInterrupted.errors).toEqual([ERROR_CODES.jobNotFound]);
	});

	it("jobs.list answers { jobs } and jobs.interrupted answers { records }", () => {
		expect(jobsList.input.safeParse({ extra: 1 }).success).toBe(false);
		expect(jobsList.output.parse({ jobs: [job] })).toEqual({ jobs: [job] });
		expect(jobsList.output.safeParse({ jobs: [{ id: "j1" }] }).success).toBe(
			false,
		);
		const record = {
			jobId: "j1",
			kind: "t.job",
			title: "A job",
			startedAt: 1,
			commandIds: [],
		};
		expect(jobsInterrupted.input.safeParse({ extra: 1 }).success).toBe(false);
		expect(jobsInterrupted.output.parse({ records: [record] })).toEqual({
			records: [record],
		});
	});
});
