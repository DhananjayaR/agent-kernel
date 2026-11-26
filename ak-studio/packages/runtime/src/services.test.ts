// The job and session operations served end to end: one ServiceRegistry with EventBus, StreamHub, JobService
// and SessionService registered, as the desktop (Task 6) and the mock transport (Task 7) wire them. Its
// contract is the app's job and session operations and streams plus a test job kind and session kind (the app's
// kind maps are empty in P1b). Every operation has a handler, the registry starts, and a job and a session run
// through the registry with their `job.updated` and `session.updated` events parsed on the `events` stream.
import {
	defineSessionKind,
	ERROR_CODES,
	eventsStream,
	job,
	jobCancel,
	jobRespond,
	jobsDismissInterrupted,
	jobsInterrupted,
	jobsList,
	type StreamMessage,
	type StudioEvent,
	sessionStart,
	sessionStop,
	sessionsList,
	streamRead,
} from "@ak-studio/contract";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { EventBus } from "./events";
import { JobService } from "./jobs";
import { InMemoryJobRecordStore } from "./ports/fakes";
import { ServiceRegistry } from "./registry";
import { ProjectScopes } from "./scope";
import { SessionService } from "./sessions";
import { StreamHub } from "./streams";

const count = job({
	name: "t.count",
	input: z.strictObject({ to: z.int().positive() }),
	result: z.object({ counted: z.int() }),
	title: "Count",
	cancellable: true,
	survivesQuit: false,
});
const clock = defineSessionKind({
	kind: "t.clock",
	args: z.strictObject({}),
	info: z.object({ started: z.boolean() }),
});
const contract = {
	operations: {
		"job.cancel": jobCancel,
		"job.respond": jobRespond,
		"jobs.dismissInterrupted": jobsDismissInterrupted,
		"jobs.interrupted": jobsInterrupted,
		"jobs.list": jobsList,
		"session.start": sessionStart,
		"session.stop": sessionStop,
		"sessions.list": sessionsList,
		"t.count": count,
	},
	streams: { events: eventsStream, "stream.read": streamRead },
};

beforeEach(() => {
	vi.useFakeTimers();
});
afterEach(() => {
	vi.useRealTimers();
});

describe("a registry serving JobService and SessionService", () => {
	it("serves every job and session operation, and carries their events on the events stream", async () => {
		const log = vi.fn();
		const registry = new ServiceRegistry({ contract, log });
		const masker = registry.masker;
		const events = new EventBus({ log, masker });
		const streams = new StreamHub({ masker, log });
		const scopes = new ProjectScopes({ log, masker });
		const jobs = new JobService({
			events,
			streams,
			scopes,
			records: new InMemoryJobRecordStore(),
			masker,
			jobKinds: { "t.count": count },
		});
		const sessions = new SessionService({
			events,
			streams,
			scopes,
			masker,
			sessionKinds: { "t.clock": clock },
		});
		jobs.define("t.count", async ({ to }, ctx) => {
			for (let i = 1; i <= to; i++) ctx.step(i, to, `Counted ${i}`);
			ctx.stream.write("stdout", `counted to ${to}`);
			return { counted: to };
		});
		sessions.define("t.clock", async () => ({
			info: { started: true },
			stop: async () => {},
		}));
		registry
			.register(events)
			.register(streams)
			.register(jobs)
			.register(sessions);
		registry.handle("t.count", jobs.handler("t.count"));
		expect(registry.missingHandlers()).toEqual([]);
		registry.start();

		const sent: StudioEvent[] = [];
		registry.subscribe("events", {}, (m: StreamMessage) => {
			if (!m.ok) throw new Error(m.error.message);
			sent.push(m.event as StudioEvent);
		});

		const started = await registry.request("t.count", { to: 2 });
		expect(started).toMatchObject({
			ok: true,
			value: { jobId: expect.any(String) },
		});
		const session = await registry.request("session.start", {
			kind: "t.clock",
			args: {},
		});
		expect(session).toMatchObject({ ok: true });
		await vi.runAllTimersAsync();

		const jobStates = sent.flatMap((e) =>
			e.type === "job.updated" ? [e.job.state] : [],
		);
		expect(jobStates).toEqual([
			"queued",
			"running",
			"running",
			"running",
			"succeeded",
		]);
		const sessionStates = sent.flatMap((e) =>
			e.type === "session.updated" ? [e.session.state] : [],
		);
		expect(sessionStates).toEqual(["starting", "running"]);

		const listed = await registry.request("jobs.list", {});
		expect(listed).toMatchObject({
			ok: true,
			value: { jobs: [{ state: "succeeded", result: { counted: 2 } }] },
		});
		await expect(registry.request("sessions.list", {})).resolves.toMatchObject({
			ok: true,
			value: { sessions: [{ state: "running", info: { started: true } }] },
		});
		await expect(registry.request("jobs.interrupted", {})).resolves.toEqual({
			ok: true,
			value: { records: [] },
		});
		const sessionId = (session as { value: { sessionId: string } }).value
			.sessionId;
		await expect(
			registry.request("session.stop", { sessionId }),
		).resolves.toEqual({ ok: true, value: {} });
		await expect(
			registry.request("job.cancel", { jobId: "nope" }),
		).resolves.toMatchObject({
			ok: false,
			error: { code: ERROR_CODES.jobNotFound },
		});
		await expect(
			registry.request("session.start", { kind: "t.clock", args: { x: 1 } }),
		).resolves.toMatchObject({
			ok: false,
			error: { code: ERROR_CODES.invalidInput },
		});
		// No undeclared code was returned, and no event failed the event union.
		expect(log).not.toHaveBeenCalled();
	});
});
