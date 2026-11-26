// JobService tests, over a test contract whose job kinds are real `job()` operations (the app's `jobKinds` is
// empty in P1b): every state transition, asking and answering, cancel, queueing by kind and project, scope
// disposal, the quit plan, crash records across a restart, masking, and the bounded list of finished jobs.
// Fake timers drive StreamHub's flushes and settle the services' promises; nothing sleeps.
import {
	ERROR_CODES,
	eventsStream,
	type Job,
	job,
	jobCancel,
	jobRespond,
	jobsDismissInterrupted,
	jobsInterrupted,
	jobsList,
	ProjectId,
	type StreamBatch,
	type StreamMessage,
	type StudioEvent,
	StudioFailure,
	streamRead,
} from "@ak-studio/contract";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { EventBus } from "./events";
import type { Log } from "./host";
import {
	FINISHED_JOBS_KEPT,
	type JobContext,
	type JobRunner,
	JobService,
} from "./jobs";
import { InMemoryJobRecordStore } from "./ports/fakes";
import type { JobRecordStore } from "./ports/jobRecordStore";
import { ServiceRegistry } from "./registry";
import { ProjectScopes } from "./scope";
import { SecretMasker } from "./secrets";
import { StreamHub } from "./streams";

const demo = job({
	name: "t.demo",
	input: z.strictObject({
		projectId: ProjectId.optional(),
		n: z.number().optional(),
	}),
	result: z.object({ total: z.number() }),
	errors: [ERROR_CODES.projectNotOpen, ERROR_CODES.fileNotFound],
	title: "Demo job",
	cancellable: true,
	survivesQuit: false,
});
const apply = job({
	name: "t.apply",
	input: z.strictObject({ projectId: ProjectId.optional() }),
	result: z.object({}),
	errors: [ERROR_CODES.projectNotOpen],
	title: "Apply changes",
	cancellable: false,
	survivesQuit: true,
});
const kinds = { "t.demo": demo, "t.apply": apply } as const;
const contract = {
	operations: {
		"job.cancel": jobCancel,
		"job.respond": jobRespond,
		"jobs.dismissInterrupted": jobsDismissInterrupted,
		"jobs.interrupted": jobsInterrupted,
		"jobs.list": jobsList,
		"t.demo": demo,
		"t.apply": apply,
	},
	streams: { events: eventsStream, "stream.read": streamRead },
};

const SECRET = "sk-live-0123456789";

interface Deferred<T> {
	promise: Promise<T>;
	resolve: (value: T) => void;
	reject: (err: unknown) => void;
}
function deferred<T = void>(): Deferred<T> {
	let resolve!: (value: T) => void;
	let reject!: (err: unknown) => void;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
}

/** Lets every pending promise (and StreamHub flush) run. */
const settle = () => vi.runAllTimersAsync();

function setup(options: { records?: JobRecordStore } = {}) {
	const masker = new SecretMasker();
	masker.add(SECRET);
	const log = vi.fn<Log>();
	const events = new EventBus({ log, masker });
	const emitted: StudioEvent[] = [];
	vi.spyOn(events, "emit").mockImplementation((event) => {
		emitted.push(structuredClone(event));
	});
	const streams = new StreamHub({ masker, log });
	const scopes = new ProjectScopes({ log, masker });
	const records = options.records ?? new InMemoryJobRecordStore();
	const jobs = new JobService({
		events,
		streams,
		scopes,
		records,
		masker,
		jobKinds: kinds,
		now: () => 1000,
		log,
	});
	const registry = new ServiceRegistry({ contract, log, masker });
	registry.register(events).register(streams);
	jobs.register(registry);
	return {
		masker,
		log,
		events,
		emitted,
		streams,
		scopes,
		records,
		jobs,
		registry,
	};
}

type Setup = ReturnType<typeof setup>;

/** Serves the test kinds (a kind the test did not define gets a runner that succeeds) and starts the registry. */
function serve(s: Setup): Setup {
	const ensure = (name: "t.demo" | "t.apply") => {
		try {
			s.jobs.define(name, async () => ({ total: 0 }));
		} catch {
			// The test defined it.
		}
	};
	ensure("t.demo");
	ensure("t.apply");
	s.registry.handle("t.demo", s.jobs.handler("t.demo"));
	s.registry.handle("t.apply", s.jobs.handler("t.apply"));
	s.registry.start();
	return s;
}

async function start(
	s: Setup,
	name: "t.demo" | "t.apply",
	input: Record<string, unknown> = {},
): Promise<string> {
	const result = await s.registry.request(name, input);
	if (!result.ok)
		throw new Error(`${result.error.code}: ${result.error.message}`);
	return (result.value as { jobId: string }).jobId;
}

/** The states a job passed through, from its job.updated events (consecutive repeats kept). */
function states(s: Setup, jobId: string): string[] {
	return s.emitted
		.filter((e) => e.type === "job.updated" && e.job.id === jobId)
		.map((e) => (e.type === "job.updated" ? e.job.state : ""));
}

function current(s: Setup, jobId: string): Job | undefined {
	return s.jobs.list().find((j) => j.id === jobId);
}

/** A runner the test controls: each call parks until the test resolves it, and hands over its context. */
function parked() {
	const calls: Array<{
		input: unknown;
		ctx: JobContext;
		finish: Deferred<unknown>;
	}> = [];
	// Its result type is `never` so it fits any kind; the test resolves it with whatever the case needs.
	const runner: JobRunner<unknown, never> = (input, ctx) => {
		const finish = deferred<unknown>();
		calls.push({ input, ctx, finish });
		return finish.promise as Promise<never>;
	};
	return { runner, calls };
}

beforeEach(() => {
	vi.useFakeTimers();
});
afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
});

describe("JobService: definitions", () => {
	it("refuses a name not in its kind map, a second definition, and a handler with no runner", () => {
		const { jobs } = setup();
		// @ts-expect-error: not a job kind in the map
		expect(() => jobs.define("t.nope", async () => ({}))).toThrow(/t.nope/);
		// @ts-expect-error: not a job kind in the map
		expect(() => jobs.handler("t.nope")).toThrow(/t.nope/);
		expect(() => jobs.handler("t.demo")).toThrow(/no runner/);
		jobs.define("t.demo", async () => ({ total: 1 }));
		expect(() => jobs.define("t.demo", async () => ({ total: 1 }))).toThrow(
			/already/,
		);
	});

	it("types a runner by its kind: the input and the result come from the contract", () => {
		const typed = setup().jobs;
		typed.define("t.demo", async (input) => ({ total: input.n ?? 0 }));
		// @ts-expect-error: the result must be { total: number }
		setup().jobs.define("t.demo", async () => ({ total: "x" }));
		// @ts-expect-error: t.demo's input has no `nope`
		setup().jobs.define("t.demo", async (input) => ({ total: input.nope }));
	});

	it("defaults to the contract's job kinds, which are empty in P1b", () => {
		const masker = new SecretMasker();
		const jobs = new JobService({
			events: new EventBus(),
			streams: new StreamHub({ masker }),
			scopes: new ProjectScopes(),
			records: new InMemoryJobRecordStore(),
			masker,
		});
		expect(() =>
			(jobs as unknown as JobService<typeof kinds>).define(
				"t.demo",
				async () => ({ total: 1 }),
			),
		).toThrow(/t.demo/);
		expect(jobs.list()).toEqual([]);
	});
});

describe("JobService: running a job", () => {
	it("answers { jobId } at once, then goes queued, running, succeeded, with the result parsed", async () => {
		const s = setup();
		const { runner, calls } = parked();
		s.jobs.define("t.demo", runner);
		serve(s);
		const jobId = await start(s, "t.demo", { n: 2 });
		expect(jobId).toMatch(/^job-/);
		expect(calls[0]?.input).toEqual({ n: 2 });
		expect(calls[0]?.ctx.jobId).toBe(jobId);
		expect(current(s, jobId)).toMatchObject({
			id: jobId,
			kind: "t.demo",
			title: "Demo job",
			state: "running",
			commandIds: [],
			cancellable: true,
			survivesQuit: false,
		});
		calls[0]?.finish.resolve({ total: 2, extra: "stripped" });
		await settle();
		expect(states(s, jobId)).toEqual(["queued", "running", "succeeded"]);
		expect(current(s, jobId)).toMatchObject({
			state: "succeeded",
			result: { total: 2 },
		});
		expect(current(s, jobId)?.result).toEqual({ total: 2 });
	});

	it("emits progress for each step, and refuses a step outside the progress schema", async () => {
		const s = setup();
		const { runner, calls } = parked();
		s.jobs.define("t.demo", runner);
		serve(s);
		const jobId = await start(s, "t.demo");
		const ctx = calls[0]?.ctx as JobContext;
		ctx.step(1, 3, "Checking");
		expect(current(s, jobId)?.progress).toEqual({
			step: 1,
			steps: 3,
			label: "Checking",
		});
		expect(states(s, jobId)).toEqual(["queued", "running", "running"]);
		expect(() => ctx.step(1, 0, "No steps")).toThrow();
		expect(() => ctx.step(-1, 3, "Negative")).toThrow();
		expect(current(s, jobId)?.progress?.label).toBe("Checking");
	});

	it("records commands, and writes a crash record at start (replaced with each command) that is gone at the end", async () => {
		const s = setup();
		const { runner, calls } = parked();
		s.jobs.define("t.demo", runner);
		serve(s);
		const jobId = await start(s, "t.demo");
		await settle();
		const store = s.records as InMemoryJobRecordStore;
		expect(store.data.get(jobId)).toEqual({
			jobId,
			kind: "t.demo",
			title: "Demo job",
			startedAt: 1000,
			commandIds: [],
		});
		calls[0]?.ctx.addCommand("cmd-1");
		expect(current(s, jobId)?.commandIds).toEqual(["cmd-1"]);
		await settle();
		expect(store.data.get(jobId)?.commandIds).toEqual(["cmd-1"]);
		calls[0]?.finish.resolve({ total: 1 });
		await settle();
		expect(store.data.has(jobId)).toBe(false);
	});

	it("writes the job's output to its stream, ends the stream with the job, and ignores writes after", async () => {
		const s = setup();
		const { runner, calls } = parked();
		s.jobs.define("t.demo", runner);
		serve(s);
		const jobId = await start(s, "t.demo");
		const streamId = current(s, jobId)?.streamId as string;
		expect(streamId).toBeTruthy();
		const ctx = calls[0]?.ctx as JobContext;
		ctx.stream.write("stdout", `line one ${SECRET}`);
		calls[0]?.finish.resolve({ total: 1 });
		await settle();
		expect(() => ctx.stream.write("stdout", "too late")).not.toThrow();
		const batches: StreamMessage[] = [];
		s.registry.subscribe("stream.read", { streamId }, (m) => batches.push(m));
		await settle();
		const texts = batches.flatMap((m) =>
			m.ok ? (m.event as StreamBatch).chunks.map((c) => c.text) : [],
		);
		expect(texts).toEqual(["line one ••••"]);
		expect(batches.at(-1)).toMatchObject({ ok: true, event: { ended: true } });
	});

	it("fails with a StudioFailure's own error, masked, and logs a code the kind does not list", async () => {
		const s = setup();
		s.jobs.define("t.demo", async () => {
			throw new StudioFailure({
				code: ERROR_CODES.fileNotFound,
				message: `Missing ${SECRET}`,
				detail: `path /keys/${SECRET}`,
				file: `keys/${SECRET}`,
			});
		});
		s.jobs.define("t.apply", async () => {
			throw new StudioFailure({
				code: ERROR_CODES.sessionFailed,
				message: "Not listed",
			});
		});
		serve(s);
		const jobId = await start(s, "t.demo");
		await settle();
		expect(states(s, jobId)).toEqual(["queued", "running", "failed"]);
		expect(current(s, jobId)?.error).toEqual({
			code: ERROR_CODES.fileNotFound,
			message: "Missing ••••",
			detail: "path /keys/••••",
			file: "keys/••••",
		});
		expect(JSON.stringify(s.emitted)).not.toContain(SECRET);
		expect(s.log).not.toHaveBeenCalled();
		await start(s, "t.apply");
		await settle();
		expect(s.log).toHaveBeenCalledWith(
			expect.stringMatching(/t\.apply.*session\.failed.*does not list/),
		);
	});

	it("fails with internal.unexpected when the runner throws something else, masked", async () => {
		const s = setup();
		s.jobs.define("t.demo", async () => {
			throw new Error(`boom ${SECRET}`);
		});
		serve(s);
		const jobId = await start(s, "t.demo");
		await settle();
		expect(current(s, jobId)).toMatchObject({
			state: "failed",
			error: { code: ERROR_CODES.internal, detail: "boom ••••" },
		});
	});

	it("fails with bridge.invalidOutput when the result does not match the kind's schema, and logs it", async () => {
		const s = setup();
		s.jobs.define(
			"t.demo",
			async () => ({ total: SECRET }) as unknown as { total: number },
		);
		serve(s);
		const jobId = await start(s, "t.demo");
		await settle();
		const failed = current(s, jobId);
		expect(failed).toMatchObject({
			state: "failed",
			error: { code: ERROR_CODES.invalidOutput },
		});
		expect(failed?.result).toBeUndefined();
		expect(s.log).toHaveBeenCalledWith(
			expect.stringMatching(/t\.demo.*bridge\.invalidOutput/),
		);
		expect(JSON.stringify(s.log.mock.calls)).not.toContain(SECRET);
	});

	it("replaces an error that is not a valid StudioError, so the events stream never carries a broken event", async () => {
		const s = setup();
		s.jobs.define("t.demo", async () => {
			throw new StudioFailure({ code: "x.y", message: "m", line: -1 });
		});
		serve(s);
		const jobId = await start(s, "t.demo");
		await settle();
		expect(current(s, jobId)?.error?.code).toBe(ERROR_CODES.internal);
	});

	it("refuses a job on a project that is not open with project.notOpen, starting nothing", async () => {
		const s = setup();
		const { runner, calls } = parked();
		s.jobs.define("t.demo", runner);
		serve(s);
		const result = await s.registry.request("t.demo", { projectId: "p1" });
		expect(result).toMatchObject({
			ok: false,
			error: { code: ERROR_CODES.projectNotOpen },
		});
		expect(calls).toEqual([]);
		expect(s.jobs.list()).toEqual([]);
	});
});

describe("JobService: asking the user", () => {
	const confirm = {
		kind: "choice" as const,
		title: "Apply the plan?",
		summary: "Creates 3 resources",
		affects: ["account 123"],
		options: [
			{ id: "apply", label: "Apply", destructive: true },
			{ id: "stop", label: "Stop" },
		],
	};

	it("waits for the user with the request, and goes back to running with the answer", async () => {
		const s = setup();
		const { runner, calls } = parked();
		s.jobs.define("t.demo", runner);
		serve(s);
		const jobId = await start(s, "t.demo");
		const answer = calls[0]?.ctx.ask(confirm);
		const waiting = current(s, jobId);
		expect(waiting?.state).toBe("waiting-for-user");
		expect(waiting?.request).toMatchObject(confirm);
		const requestId = waiting?.request?.id as string;
		expect(requestId).toBeTruthy();
		await expect(
			s.registry.request("job.respond", {
				jobId,
				requestId,
				answer: { optionId: "apply" },
			}),
		).resolves.toEqual({ ok: true, value: {} });
		await expect(answer).resolves.toEqual({ optionId: "apply" });
		expect(current(s, jobId)?.state).toBe("running");
		expect(current(s, jobId)?.request).toBeUndefined();
		expect(states(s, jobId)).toEqual([
			"queued",
			"running",
			"waiting-for-user",
			"running",
		]);
	});

	it("refuses an answer for another request (job.requestMismatch), when not waiting (job.notWaiting), or for no job (job.notFound)", async () => {
		const s = setup();
		const { runner, calls } = parked();
		s.jobs.define("t.demo", runner);
		serve(s);
		const jobId = await start(s, "t.demo");
		const respond = (input: Record<string, unknown>) =>
			s.registry.request("job.respond", {
				jobId,
				requestId: "r",
				answer: {},
				...input,
			});
		await expect(respond({})).resolves.toMatchObject({
			ok: false,
			error: { code: ERROR_CODES.jobNotWaiting },
		});
		void calls[0]?.ctx.ask(confirm);
		await expect(respond({ requestId: "other" })).resolves.toMatchObject({
			ok: false,
			error: { code: ERROR_CODES.jobRequestMismatch },
		});
		await expect(respond({ jobId: "job-none" })).resolves.toMatchObject({
			ok: false,
			error: { code: ERROR_CODES.jobNotFound },
		});
		expect(current(s, jobId)?.state).toBe("waiting-for-user");
	});

	it("refuses an answer that does not fit the request with bridge.invalidInput, and keeps waiting", async () => {
		const s = setup();
		const { runner, calls } = parked();
		s.jobs.define("t.demo", runner);
		serve(s);
		const jobId = await start(s, "t.demo");
		const ctx = calls[0]?.ctx as JobContext;
		void ctx.ask(confirm);
		const requestId = current(s, jobId)?.request?.id;
		await expect(
			s.registry.request("job.respond", {
				jobId,
				requestId,
				answer: { optionId: "nope" },
			}),
		).resolves.toMatchObject({
			ok: false,
			error: { code: ERROR_CODES.invalidInput },
		});
		expect(current(s, jobId)?.state).toBe("waiting-for-user");
	});

	it("needs the exact name for confirm-by-name", async () => {
		const s = setup();
		const { runner, calls } = parked();
		s.jobs.define("t.demo", runner);
		serve(s);
		const jobId = await start(s, "t.demo");
		const answer = calls[0]?.ctx.ask({
			kind: "confirm-by-name",
			title: "Destroy?",
			summary: "Removes everything",
			affects: ["prod"],
			expectedName: "prod",
		});
		const requestId = current(s, jobId)?.request?.id;
		const respond = (name?: string) =>
			s.registry.request("job.respond", {
				jobId,
				requestId,
				answer: name === undefined ? {} : { name },
			});
		await expect(respond("prd")).resolves.toMatchObject({
			ok: false,
			error: { code: ERROR_CODES.invalidInput },
		});
		await expect(respond()).resolves.toMatchObject({ ok: false });
		await expect(respond("prod")).resolves.toEqual({ ok: true, value: {} });
		await expect(answer).resolves.toEqual({ name: "prod" });
	});

	it("keeps one open request: a second ask waits until the first is answered", async () => {
		const s = setup();
		const { runner, calls } = parked();
		s.jobs.define("t.demo", runner);
		serve(s);
		const jobId = await start(s, "t.demo");
		const ctx = calls[0]?.ctx as JobContext;
		const first = ctx.ask({ ...confirm, title: "First" });
		const second = ctx.ask({ ...confirm, title: "Second" });
		expect(current(s, jobId)?.request?.title).toBe("First");
		const firstId = current(s, jobId)?.request?.id;
		await s.registry.request("job.respond", {
			jobId,
			requestId: firstId,
			answer: { optionId: "stop" },
		});
		await expect(first).resolves.toEqual({ optionId: "stop" });
		const now = current(s, jobId);
		expect(now?.state).toBe("waiting-for-user");
		expect(now?.request?.title).toBe("Second");
		expect(now?.request?.id).not.toBe(firstId);
		await s.registry.request("job.respond", {
			jobId,
			requestId: now?.request?.id,
			answer: { optionId: "apply" },
		});
		await expect(second).resolves.toEqual({ optionId: "apply" });
	});

	it("rejects a request that is not a valid UserRequest, without waiting", async () => {
		const s = setup();
		const { runner, calls } = parked();
		s.jobs.define("t.demo", runner);
		serve(s);
		const jobId = await start(s, "t.demo");
		await expect(
			calls[0]?.ctx.ask({
				...confirm,
				kind: "bogus" as "choice",
			}),
		).rejects.toThrow();
		expect(current(s, jobId)?.state).toBe("running");
	});
});

describe("JobService: cancel", () => {
	it("aborts the signal and ends in cancelled once the runner settles", async () => {
		const s = setup();
		const { runner, calls } = parked();
		s.jobs.define("t.demo", runner);
		serve(s);
		const jobId = await start(s, "t.demo");
		const ctx = calls[0]?.ctx as JobContext;
		await expect(s.registry.request("job.cancel", { jobId })).resolves.toEqual({
			ok: true,
			value: {},
		});
		expect(ctx.signal.aborted).toBe(true);
		expect(current(s, jobId)?.state).toBe("running");
		calls[0]?.finish.reject(ctx.signal.reason);
		await settle();
		expect(current(s, jobId)?.state).toBe("cancelled");
		expect(current(s, jobId)?.error).toBeUndefined();
		expect(states(s, jobId)).toEqual(["queued", "running", "cancelled"]);
		expect((s.records as InMemoryJobRecordStore).data.has(jobId)).toBe(false);
	});

	it("ends in cancelled even if the runner returns a result after the cancel", async () => {
		const s = setup();
		const { runner, calls } = parked();
		s.jobs.define("t.demo", runner);
		serve(s);
		const jobId = await start(s, "t.demo");
		await s.registry.request("job.cancel", { jobId });
		calls[0]?.finish.resolve({ total: 1 });
		await settle();
		expect(current(s, jobId)).toMatchObject({ state: "cancelled" });
		expect(current(s, jobId)?.result).toBeUndefined();
	});

	it("denies the open request (and any waiting one) when cancelled while waiting", async () => {
		const s = setup();
		const { runner, calls } = parked();
		s.jobs.define("t.demo", runner);
		serve(s);
		const jobId = await start(s, "t.demo");
		const ctx = calls[0]?.ctx as JobContext;
		const request = {
			kind: "confirm" as const,
			title: "Go?",
			summary: "",
			affects: [],
		};
		const first = ctx.ask(request);
		const second = ctx.ask(request);
		await s.registry.request("job.cancel", { jobId });
		await expect(first).rejects.toBe(ctx.signal.reason);
		await expect(second).rejects.toBe(ctx.signal.reason);
		expect(current(s, jobId)?.request).toBeUndefined();
		expect(current(s, jobId)?.state).toBe("running");
		await expect(ctx.ask(request)).rejects.toBe(ctx.signal.reason);
		calls[0]?.finish.reject(ctx.signal.reason);
		await settle();
		expect(current(s, jobId)?.state).toBe("cancelled");
	});

	it("cancels a queued job at once, without running it", async () => {
		const s = setup();
		const { runner, calls } = parked();
		s.jobs.define("t.demo", runner);
		serve(s);
		await start(s, "t.demo");
		const queued = await start(s, "t.demo");
		expect(current(s, queued)?.state).toBe("queued");
		await s.registry.request("job.cancel", { jobId: queued });
		expect(current(s, queued)?.state).toBe("cancelled");
		expect(states(s, queued)).toEqual(["queued", "cancelled"]);
		calls[0]?.finish.resolve({ total: 1 });
		await settle();
		expect(calls).toHaveLength(1);
		expect((s.records as InMemoryJobRecordStore).data.has(queued)).toBe(false);
	});

	it("refuses to cancel a job that cannot be cancelled, or one that does not exist; an ended job is a no-op", async () => {
		const s = setup();
		const { runner, calls } = parked();
		s.jobs.define("t.apply", runner);
		s.jobs.define("t.demo", async () => ({ total: 1 }));
		serve(s);
		const applyId = await start(s, "t.apply");
		await expect(
			s.registry.request("job.cancel", { jobId: applyId }),
		).resolves.toMatchObject({
			ok: false,
			error: { code: ERROR_CODES.jobNotCancellable },
		});
		expect(calls[0]?.ctx.signal.aborted).toBe(false);
		await expect(
			s.registry.request("job.cancel", { jobId: "job-none" }),
		).resolves.toMatchObject({
			ok: false,
			error: { code: ERROR_CODES.jobNotFound },
		});
		const done = await start(s, "t.demo");
		await settle();
		await expect(
			s.registry.request("job.cancel", { jobId: done }),
		).resolves.toEqual({ ok: true, value: {} });
		expect(current(s, done)?.state).toBe("succeeded");
	});
});

describe("JobService: queueing", () => {
	it("runs jobs of the same kind on the same project one at a time, in order; other kinds and projects run alongside", async () => {
		const s = setup();
		const demoRuns = parked();
		const applyRuns = parked();
		s.jobs.define("t.demo", demoRuns.runner);
		s.jobs.define("t.apply", applyRuns.runner);
		s.scopes.open("p1", { root: "/p1" });
		s.scopes.open("p2", { root: "/p2" });
		serve(s);
		const a = await start(s, "t.demo", { projectId: "p1", n: 1 });
		const b = await start(s, "t.demo", { projectId: "p1", n: 2 });
		const c = await start(s, "t.demo", { projectId: "p1", n: 3 });
		const other = await start(s, "t.demo", { projectId: "p2" });
		const kind = await start(s, "t.apply", { projectId: "p1" });
		expect([a, b, c, other, kind].map((id) => current(s, id)?.state)).toEqual([
			"running",
			"queued",
			"queued",
			"running",
			"running",
		]);
		expect(current(s, a)?.projectId).toBe("p1");
		demoRuns.calls[0]?.finish.resolve({ total: 1 });
		await settle();
		expect(current(s, b)?.state).toBe("running");
		expect(current(s, c)?.state).toBe("queued");
		expect(demoRuns.calls.map((call) => call.input)).toEqual([
			{ projectId: "p1", n: 1 },
			{ projectId: "p2" },
			{ projectId: "p1", n: 2 },
		]);
	});

	it("holds the slot until a cancelled runner settles, so the next job never overlaps it", async () => {
		const s = setup();
		const { runner, calls } = parked();
		s.jobs.define("t.demo", runner);
		serve(s);
		const a = await start(s, "t.demo");
		const b = await start(s, "t.demo");
		await s.registry.request("job.cancel", { jobId: a });
		await settle();
		expect(current(s, b)?.state).toBe("queued");
		calls[0]?.finish.reject(new Error("aborted"));
		await settle();
		expect(current(s, a)?.state).toBe("cancelled");
		expect(current(s, b)?.state).toBe("running");
	});
});

describe("JobService: project scopes and quitting", () => {
	it("cancels a project's running and queued jobs (even one that cannot be cancelled) when its scope is disposed, and waits for them", async () => {
		const s = setup();
		const demoRuns = parked();
		const applyRuns = parked();
		s.jobs.define("t.demo", demoRuns.runner);
		s.jobs.define("t.apply", applyRuns.runner);
		s.scopes.open("p1", { root: "/p1" });
		s.scopes.open("p2", { root: "/p2" });
		serve(s);
		const running = await start(s, "t.demo", { projectId: "p1" });
		const queued = await start(s, "t.demo", { projectId: "p1" });
		const pinned = await start(s, "t.apply", { projectId: "p1" });
		const elsewhere = await start(s, "t.demo", { projectId: "p2" });
		let closed = false;
		void s.scopes.close("p1").then(() => {
			closed = true;
		});
		await settle();
		expect(demoRuns.calls[0]?.ctx.signal.aborted).toBe(true);
		expect(applyRuns.calls[0]?.ctx.signal.aborted).toBe(true);
		expect(current(s, queued)?.state).toBe("cancelled");
		expect(closed).toBe(false);
		demoRuns.calls[0]?.finish.reject(new Error("aborted"));
		applyRuns.calls[0]?.finish.reject(new Error("aborted"));
		await settle();
		expect(closed).toBe(true);
		expect(
			[running, queued, pinned].map((id) => current(s, id)?.state),
		).toEqual(["cancelled", "cancelled", "cancelled"]);
		expect(demoRuns.calls).toHaveLength(2); // the queued job never ran
		expect(current(s, elsewhere)?.state).toBe("running");
		await expect(
			s.registry.request("t.demo", { projectId: "p1" }),
		).resolves.toMatchObject({
			ok: false,
			error: { code: ERROR_CODES.projectNotOpen },
		});
	});

	it("plans a quit: unfinished jobs that survive quit block it; the others are to cancel", async () => {
		const s = setup();
		const demoRuns = parked();
		const applyRuns = parked();
		s.jobs.define("t.demo", demoRuns.runner);
		s.jobs.define("t.apply", applyRuns.runner);
		serve(s);
		expect(s.jobs.quitPlan()).toEqual({ toCancel: [], blocking: [] });
		const demoId = await start(s, "t.demo");
		const applyId = await start(s, "t.apply");
		const queuedApply = await start(s, "t.apply");
		const plan = s.jobs.quitPlan();
		expect(plan.blocking.map((j) => [j.id, j.state])).toEqual([
			[applyId, "running"],
			[queuedApply, "queued"],
		]);
		expect(plan.toCancel.map((j) => j.id)).toEqual([demoId]);
		demoRuns.calls[0]?.finish.resolve({ total: 1 });
		await settle();
		expect(s.jobs.quitPlan().toCancel).toEqual([]);
	});

	it("cancelAll cancels the jobs it is given, even ones that cannot be cancelled, and resolves once they have ended and their records are written", async () => {
		const records = new InMemoryJobRecordStore();
		const s = setup({ records });
		const demoRuns = parked();
		const applyRuns = parked();
		s.jobs.define("t.demo", demoRuns.runner);
		s.jobs.define("t.apply", applyRuns.runner);
		serve(s);
		const demoId = await start(s, "t.demo");
		const applyId = await start(s, "t.apply");
		await settle();
		let done = false;
		const all = s.jobs.cancelAll(s.jobs.list()).then(() => {
			done = true;
		});
		await settle();
		expect(done).toBe(false);
		demoRuns.calls[0]?.finish.reject(new Error("aborted"));
		await settle();
		expect(done).toBe(false);
		applyRuns.calls[0]?.finish.reject(new Error("aborted"));
		await all;
		expect(current(s, demoId)?.state).toBe("cancelled");
		expect(current(s, applyId)?.state).toBe("cancelled");
		expect(records.data.size).toBe(0);
		await expect(s.jobs.cancelAll([])).resolves.toBeUndefined();
	});
});

describe("JobService: crash records", () => {
	it("lists a job that never ended in jobs.interrupted after a new JobService starts on the same store", async () => {
		const store = new InMemoryJobRecordStore();
		const first = setup({ records: store });
		const { runner, calls } = parked();
		first.jobs.define("t.demo", runner);
		serve(first);
		const lost = await start(first, "t.demo");
		await settle();
		calls[0]?.ctx.addCommand("cmd-7");
		await settle();
		// This run's own running job is not "interrupted".
		await expect(
			first.registry.request("jobs.interrupted", {}),
		).resolves.toEqual({ ok: true, value: { records: [] } });
		await expect(
			first.registry.request("jobs.dismissInterrupted", { jobId: lost }),
		).resolves.toMatchObject({
			ok: false,
			error: { code: ERROR_CODES.jobNotFound },
		});

		// The app restarts: a new service over the same records.
		const second = serve(
			setup({ records: new InMemoryJobRecordStore(store.data) }),
		);
		await expect(
			second.registry.request("jobs.interrupted", {}),
		).resolves.toEqual({
			ok: true,
			value: {
				records: [
					{
						jobId: lost,
						kind: "t.demo",
						title: "Demo job",
						startedAt: 1000,
						commandIds: ["cmd-7"],
					},
				],
			},
		});
		await expect(
			second.registry.request("jobs.dismissInterrupted", { jobId: lost }),
		).resolves.toEqual({ ok: true, value: {} });
		await expect(
			second.registry.request("jobs.dismissInterrupted", { jobId: lost }),
		).resolves.toMatchObject({
			ok: false,
			error: { code: ERROR_CODES.jobNotFound },
		});
		await expect(
			second.registry.request("jobs.interrupted", {}),
		).resolves.toEqual({ ok: true, value: { records: [] } });
	});

	it("gives each run's jobs ids no other run uses", async () => {
		const a = setup();
		const b = setup();
		for (const s of [a, b]) {
			s.jobs.define("t.demo", async () => ({ total: 1 }));
			serve(s);
		}
		expect(await start(a, "t.demo")).not.toBe(await start(b, "t.demo"));
	});

	it("logs a record store failure, masked, and the job carries on", async () => {
		const failing: JobRecordStore = {
			started: async () => {
				throw new Error(`disk full ${SECRET}`);
			},
			ended: async () => {
				throw new Error("disk full");
			},
			unfinished: async () => [],
			dismiss: async () => false,
		};
		const s = setup({ records: failing });
		s.jobs.define("t.demo", async () => ({ total: 1 }));
		serve(s);
		const jobId = await start(s, "t.demo");
		await settle();
		expect(current(s, jobId)?.state).toBe("succeeded");
		expect(s.log).toHaveBeenCalledWith(expect.stringMatching(/disk full/));
		expect(JSON.stringify(s.log.mock.calls)).not.toContain(SECRET);
	});

	it("writes a job's records in order: its end never lands before its start", async () => {
		const order: string[] = [];
		const slowStart = deferred();
		const store: JobRecordStore = {
			started: async () => {
				await slowStart.promise;
				order.push("started");
			},
			ended: async () => {
				order.push("ended");
			},
			unfinished: async () => [],
			dismiss: async () => false,
		};
		const s = setup({ records: store });
		s.jobs.define("t.demo", async () => ({ total: 1 }));
		serve(s);
		await start(s, "t.demo");
		await settle();
		expect(order).toEqual([]);
		slowStart.resolve();
		await settle();
		expect(order).toEqual(["started", "ended"]);
	});
});

describe("JobService: the list of jobs", () => {
	it(`keeps the newest ${FINISHED_JOBS_KEPT} finished jobs, and releases the older ones' streams`, async () => {
		const s = setup();
		s.jobs.define("t.demo", async () => ({ total: 1 }));
		serve(s);
		const ids: string[] = [];
		for (let i = 0; i < FINISHED_JOBS_KEPT + 2; i++) {
			ids.push(await start(s, "t.demo"));
			await settle();
		}
		const listed = await s.registry.request("jobs.list", {});
		const jobs = (listed as { value: { jobs: Job[] } }).value.jobs;
		expect(jobs.map((j) => j.id)).toEqual(ids.slice(2));
		const oldStream = s.emitted.find(
			(e) => e.type === "job.updated" && e.job.id === ids[0],
		);
		const streamId =
			oldStream?.type === "job.updated" ? oldStream.job.streamId : undefined;
		expect(streamId).toBeTruthy();
		expect(
			s.registry.subscribe("stream.read", { streamId }, () => {}),
		).toMatchObject({ ok: false, error: { code: ERROR_CODES.streamNotFound } });
		const kept = jobs[0]?.streamId;
		expect(
			s.registry.subscribe("stream.read", { streamId: kept }, () => {}).ok,
		).toBe(true);
	});

	it("emits snapshots: a later change does not alter an event already sent", async () => {
		const s = setup();
		const sent: Job[] = [];
		vi.mocked(s.events.emit).mockImplementation((event) => {
			if (event.type === "job.updated") sent.push(event.job);
		});
		const { runner, calls } = parked();
		s.jobs.define("t.demo", runner);
		serve(s);
		await start(s, "t.demo");
		calls[0]?.ctx.addCommand("cmd-1");
		expect(sent.map((j) => j.state)).toEqual(["queued", "running", "running"]);
		expect(sent[1]?.commandIds).toEqual([]);
		expect(sent[2]?.commandIds).toEqual(["cmd-1"]);
	});

	it("ignores context calls after the job has ended", async () => {
		const s = setup();
		const { runner, calls } = parked();
		s.jobs.define("t.demo", runner);
		serve(s);
		const jobId = await start(s, "t.demo");
		const ctx = calls[0]?.ctx as JobContext;
		calls[0]?.finish.resolve({ total: 1 });
		await settle();
		const before = s.emitted.length;
		ctx.step(1, 2, "late");
		ctx.addCommand("cmd-late");
		ctx.stream.write("stdout", "late");
		await expect(
			ctx.ask({ kind: "confirm", title: "t", summary: "", affects: [] }),
		).rejects.toThrow();
		expect(s.emitted.length).toBe(before);
		expect(current(s, jobId)?.commandIds).toEqual([]);
	});
});
