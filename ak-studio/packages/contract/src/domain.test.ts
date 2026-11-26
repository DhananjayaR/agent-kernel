// The domain types every service and the renderer share: ids, revisions, jobs, user requests, sessions, stream
// chunks, recorded commands and the event union.
import { describe, expect, it } from "vitest";
import {
	commandRecordSchema,
	interruptedJobSchema,
	JobId,
	jobSchema,
	ProjectId,
	Revision,
	SessionId,
	StreamId,
	sessionSchema,
	streamChunkSchema,
	studioEventSchema,
	userRequestSchema,
} from "./domain";

const job = {
	id: "j1",
	kind: "project.create",
	title: "Create the project",
	state: "running",
	commandIds: [],
	cancellable: true,
	survivesQuit: false,
	seq: 3,
} as const;

const request = {
	id: "r1",
	kind: "confirm-by-name",
	title: "Delete the deployment",
	summary: "Removes every resource.",
	affects: ["account 1234"],
	expectedName: "prod",
	options: [{ id: "delete", label: "Delete", destructive: true }],
} as const;

const session = {
	id: "s1",
	kind: "run.server",
	state: "running",
	commandIds: ["c1"],
	seq: 2,
} as const;

describe("ids and revisions", () => {
	it("are non-empty strings", () => {
		for (const id of [ProjectId, JobId, SessionId, StreamId]) {
			expect(id.parse("a")).toBe("a");
			expect(id.safeParse("").success).toBe(false);
			expect(id.safeParse(1).success).toBe(false);
		}
	});

	it("takes a revision as a SHA-256: 64 lowercase hex characters", () => {
		const sha = "a".repeat(32) + "0123456789abcdef".repeat(2);
		expect(Revision.parse(sha)).toBe(sha);
		for (const bad of [
			sha.toUpperCase(),
			sha.slice(1),
			`${sha}0`,
			`${sha.slice(1)}g`,
			"",
		]) {
			expect(Revision.safeParse(bad).success).toBe(false);
		}
	});
});

describe("jobSchema", () => {
	it("takes the architecture's fields, with projectId", () => {
		const full = {
			...job,
			state: "waiting-for-user",
			progress: { step: 2, steps: 3, label: "Writing files" },
			request,
			streamId: "st1",
			result: { anything: true },
			error: { code: "job.failed", message: "It failed." },
			projectId: "p1",
		};
		expect(jobSchema.parse(full)).toEqual(full);
		expect(jobSchema.parse(job)).toEqual(job);
	});

	it("knows the six states", () => {
		for (const state of [
			"queued",
			"running",
			"waiting-for-user",
			"succeeded",
			"failed",
			"cancelled",
		]) {
			expect(jobSchema.safeParse({ ...job, state }).success).toBe(true);
		}
		expect(jobSchema.safeParse({ ...job, state: "paused" }).success).toBe(
			false,
		);
	});

	it("strips undeclared fields and refuses missing ones", () => {
		expect(jobSchema.parse({ ...job, secret: "x" })).toEqual(job);
		const { commandIds: _, ...noCommands } = job;
		expect(jobSchema.safeParse(noCommands).success).toBe(false);
		const { seq: _seq, ...noSeq } = job;
		expect(jobSchema.safeParse(noSeq).success).toBe(false);
		for (const seq of [-1, 1.5]) {
			expect(jobSchema.safeParse({ ...job, seq }).success).toBe(false);
		}
		expect(
			jobSchema.safeParse({
				...job,
				progress: { step: 1.5, steps: 3, label: "x" },
			}).success,
		).toBe(false);
	});
});

describe("userRequestSchema", () => {
	it("knows the four request kinds", () => {
		expect(userRequestSchema.parse(request)).toEqual(request);
		for (const kind of ["confirm", "confirm-by-name", "permission", "choice"]) {
			expect(userRequestSchema.safeParse({ ...request, kind }).success).toBe(
				true,
			);
		}
		expect(
			userRequestSchema.safeParse({ ...request, kind: "prompt" }).success,
		).toBe(false);
		expect(
			userRequestSchema.safeParse({ ...request, affects: undefined }).success,
		).toBe(false);
	});
});

describe("sessionSchema", () => {
	it("takes the architecture's fields, with projectId, and the five states", () => {
		const full = {
			...session,
			info: { url: "http://localhost:8000" },
			streamId: "st1",
			error: { code: "session.failed", message: "It stopped." },
			projectId: "p1",
		};
		expect(sessionSchema.parse(full)).toEqual(full);
		for (const state of [
			"starting",
			"running",
			"stopping",
			"stopped",
			"failed",
		]) {
			expect(sessionSchema.safeParse({ ...session, state }).success).toBe(true);
		}
		expect(
			sessionSchema.safeParse({ ...session, state: "paused" }).success,
		).toBe(false);
	});

	it("needs seq, a whole number of at least 0", () => {
		const { seq: _seq, ...noSeq } = session;
		expect(sessionSchema.safeParse(noSeq).success).toBe(false);
		expect(sessionSchema.safeParse({ ...session, seq: -1 }).success).toBe(
			false,
		);
		expect(sessionSchema.parse({ ...session, seq: 0 }).seq).toBe(0);
	});
});

describe("streamChunkSchema", () => {
	it("takes seq, at, channel and text", () => {
		const chunk = { seq: 0, at: 1700000000000, channel: "stdout", text: "hi" };
		expect(streamChunkSchema.parse(chunk)).toEqual(chunk);
		for (const channel of ["stderr", "info"]) {
			expect(streamChunkSchema.safeParse({ ...chunk, channel }).success).toBe(
				true,
			);
		}
		expect(
			streamChunkSchema.safeParse({ ...chunk, channel: "stdin" }).success,
		).toBe(false);
		expect(streamChunkSchema.safeParse({ ...chunk, seq: -1 }).success).toBe(
			false,
		);
	});
});

describe("commandRecordSchema and interruptedJobSchema", () => {
	it("take a minimal record", () => {
		const record = {
			id: "c1",
			executable: "uv",
			args: ["run", "pytest"],
			startedAt: 1,
		};
		expect(commandRecordSchema.parse(record)).toEqual(record);
		expect(
			commandRecordSchema.parse({ ...record, endedAt: 2, exitCode: null }),
		).toEqual({ ...record, endedAt: 2, exitCode: null });
		const interrupted = {
			jobId: "j1",
			kind: "deploy.apply",
			title: "Deploy",
			startedAt: 1,
			commandIds: ["c1"],
		};
		expect(interruptedJobSchema.parse(interrupted)).toEqual(interrupted);
		expect(interruptedJobSchema.safeParse({ jobId: "j1" }).success).toBe(false);
	});
});

describe("studioEventSchema", () => {
	it("is a union on type", () => {
		const events = [
			{ type: "job.updated", job },
			{ type: "session.updated", session },
			{
				type: "command.recorded",
				record: { id: "c1", executable: "ak", args: [], startedAt: 1 },
			},
			{ type: "domain.changed", domain: "config", projectId: "p1" },
			{ type: "domain.changed", domain: "preferences" },
		];
		for (const event of events) {
			expect(studioEventSchema.parse(event)).toEqual(event);
		}
		for (const bad of [
			{ type: "job.updated" },
			{ type: "stream.chunk", chunk: {} },
			{ type: "domain.changed", domain: "" },
			{ job },
		]) {
			expect(studioEventSchema.safeParse(bad).success).toBe(false);
		}
	});
});
