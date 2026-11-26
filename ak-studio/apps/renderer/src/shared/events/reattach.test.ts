// Reattaching after a reload, against the mock's real registry and EventBus: `jobs.list` and `sessions.list` fill
// the stores, events that arrive while they are fetched are held and applied after them, and the newest state of
// each job and session wins by `seq` whichever comes first, so neither a late list nor an early event rolls one
// back. The lists are answered by deferred handlers, so the test decides when each list is taken and answered.
import type { Job, Session } from "@ak-studio/contract";
import { ERROR_CODES, StudioFailure } from "@ak-studio/contract";
import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMockBackend } from "../bridge/mockTransport";
import { useJobStore } from "../jobs/jobStore";
import { useSessionStore } from "../sessions/sessionStore";
import { connectEvents } from "./connectEvents";
import {
	REATTACH_HOLD_MS,
	reattach,
	receiveJob,
	receiveSession,
	storeEventHandlers,
} from "./reattach";

const job = (seq: number, state: Job["state"], id = "j1"): Job => ({
	id,
	kind: "t.demo",
	title: "Create the project",
	state,
	commandIds: [],
	cancellable: true,
	survivesQuit: false,
	streamId: "stream-1",
	seq,
});

const session = (seq: number, state: Session["state"], id = "s1"): Session => ({
	id,
	kind: "run.server",
	state,
	commandIds: [],
	seq,
});

function deferred<T>() {
	let resolve!: (value: T) => void;
	let reject!: (err: unknown) => void;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
}

/** A mock whose lists answer when the test says, with what the test says; events routed to the stores. */
function setup() {
	const jobsList = deferred<{ jobs: Job[] }>();
	const sessionsList = deferred<{ sessions: Session[] }>();
	const backend = createMockBackend({
		handlers: {
			"jobs.list": () => jobsList.promise,
			"sessions.list": () => sessionsList.promise,
		},
	});
	// Events reach the stores as in the app; the test starts each reattach itself, to await it.
	connectEvents(new QueryClient(), backend.transport, {
		onJob: receiveJob,
		onSession: receiveSession,
	});
	return { backend, jobsList, sessionsList };
}

const jobs = () => useJobStore.getState().jobs;
const sessions = () => useSessionStore.getState().sessions;

beforeEach(() => {
	useJobStore.setState({ jobs: {} });
	useSessionStore.setState({ sessions: {} });
});
afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
});

describe("reattach", () => {
	it("fills the stores with the jobs and sessions running before the reload", async () => {
		const { backend, jobsList, sessionsList } = setup();
		const done = reattach(backend.transport);
		jobsList.resolve({ jobs: [job(4, "running"), job(9, "succeeded", "j0")] });
		sessionsList.resolve({ sessions: [session(2, "running")] });
		await done;
		expect(jobs()).toEqual({
			j1: job(4, "running"),
			j0: job(9, "succeeded", "j0"),
		});
		expect(sessions()).toEqual({ s1: session(2, "running") });
	});

	it("holds an event that races the list, then keeps it when it is newer than the late list", async () => {
		const { backend, jobsList, sessionsList } = setup();
		const done = reattach(backend.transport);
		// The list was taken with the job running (seq 4); the job then ends, and its event beats the answer.
		backend.events.emit({ type: "job.updated", job: job(5, "succeeded") });
		backend.events.emit({
			type: "session.updated",
			session: session(3, "stopping"),
		});
		// Held, not applied, while the lists are fetched.
		expect(jobs()).toEqual({});
		expect(sessions()).toEqual({});
		jobsList.resolve({ jobs: [job(4, "running")] });
		sessionsList.resolve({ sessions: [session(2, "running")] });
		await done;
		expect(jobs().j1).toEqual(job(5, "succeeded"));
		expect(sessions().s1).toEqual(session(3, "stopping"));
	});

	it("keeps the list when an event held during the fetch is older than it", async () => {
		const { backend, jobsList, sessionsList } = setup();
		const done = reattach(backend.transport);
		backend.events.emit({ type: "job.updated", job: job(3, "queued") });
		jobsList.resolve({ jobs: [job(4, "running")] });
		sessionsList.resolve({ sessions: [] });
		await done;
		expect(jobs().j1).toEqual(job(4, "running"));
	});

	it("applies events at once when no reattach is fetching, and never rolls a job back", async () => {
		const { backend, jobsList, sessionsList } = setup();
		const done = reattach(backend.transport);
		jobsList.resolve({ jobs: [job(4, "running")] });
		sessionsList.resolve({ sessions: [] });
		await done;
		backend.events.emit({ type: "job.updated", job: job(5, "succeeded") });
		expect(jobs().j1?.state).toBe("succeeded");
		const kept = jobs().j1;
		// An older state, and the same state again, change nothing (the object stays, so no view re-renders).
		backend.events.emit({ type: "job.updated", job: job(4, "running") });
		backend.events.emit({ type: "job.updated", job: job(5, "succeeded") });
		expect(jobs().j1).toBe(kept);
	});

	it("never rejects: a failed list is logged, the other is applied, and the held events are applied", async () => {
		const { backend, jobsList, sessionsList } = setup();
		const log = vi.fn();
		const done = reattach(backend.transport, log);
		backend.events.emit({ type: "job.updated", job: job(2, "running", "j2") });
		jobsList.reject(
			new StudioFailure({
				code: ERROR_CODES.unavailable,
				message: "The app did not respond.",
			}),
		);
		sessionsList.resolve({ sessions: [session(1, "starting")] });
		await expect(done).resolves.toBeUndefined();
		expect(log).toHaveBeenCalledExactlyOnceWith(
			`reattaching jobs failed: ${ERROR_CODES.unavailable}`,
		);
		expect(jobs()).toEqual({ j2: job(2, "running", "j2") });
		expect(sessions()).toEqual({ s1: session(1, "starting") });
	});

	it("holds events until the last of two overlapping reattaches has answered", async () => {
		const { backend, jobsList, sessionsList } = setup();
		const first = reattach(backend.transport);
		const second = reattach(backend.transport);
		backend.events.emit({ type: "job.updated", job: job(6, "cancelled") });
		jobsList.resolve({ jobs: [job(4, "running")] });
		sessionsList.resolve({ sessions: [] });
		await Promise.all([first, second]);
		expect(jobs().j1).toEqual(job(6, "cancelled"));
	});
});

describe("reattach, when a list never answers", () => {
	it(`stops holding events after ${REATTACH_HOLD_MS} ms, and the late list cannot roll them back`, async () => {
		vi.useFakeTimers();
		const { backend, jobsList, sessionsList } = setup();
		const log = vi.fn();
		const done = reattach(backend.transport, log);
		backend.events.emit({ type: "job.updated", job: job(6, "running") });
		await vi.advanceTimersByTimeAsync(REATTACH_HOLD_MS - 1);
		expect(jobs().j1).toBeUndefined();
		await vi.advanceTimersByTimeAsync(1);
		expect(jobs().j1).toEqual(job(6, "running"));
		expect(log).toHaveBeenCalledExactlyOnceWith(
			`reattaching did not answer in ${REATTACH_HOLD_MS} ms; applying the events held meanwhile`,
		);
		// No longer held: a later event applies at once.
		backend.events.emit({ type: "job.updated", job: job(7, "succeeded") });
		expect(jobs().j1).toEqual(job(7, "succeeded"));
		// The list answers late, with an older state: the newest stays.
		jobsList.resolve({ jobs: [job(4, "running")] });
		sessionsList.resolve({ sessions: [] });
		await done;
		expect(jobs().j1).toEqual(job(7, "succeeded"));
	});

	it("releases its hold once: a later reattach still holds the events that race it", async () => {
		vi.useFakeTimers();
		const first = setup();
		const late = reattach(first.backend.transport, vi.fn());
		await vi.advanceTimersByTimeAsync(REATTACH_HOLD_MS);
		first.jobsList.resolve({ jobs: [] });
		first.sessionsList.resolve({ sessions: [] });
		await late;

		const second = setup();
		const done = reattach(second.backend.transport);
		second.backend.events.emit({ type: "job.updated", job: job(3, "running") });
		expect(jobs().j1).toBeUndefined();
		second.jobsList.resolve({ jobs: [job(2, "queued")] });
		second.sessionsList.resolve({ sessions: [] });
		await done;
		expect(jobs().j1).toEqual(job(3, "running"));
	});

	it("clears its timer when the lists answer in time", async () => {
		vi.useFakeTimers();
		const { backend, jobsList, sessionsList } = setup();
		const log = vi.fn();
		const done = reattach(backend.transport, log);
		jobsList.resolve({ jobs: [] });
		sessionsList.resolve({ sessions: [] });
		await done;
		await vi.advanceTimersByTimeAsync(REATTACH_HOLD_MS * 2);
		expect(log).not.toHaveBeenCalled();
	});
});

describe("storeEventHandlers", () => {
	it("routes job and session events to the stores, and lists again on each connect", async () => {
		const backend = createMockBackend();
		const request = vi.spyOn(backend.transport, "request");
		const handlers = storeEventHandlers(backend.transport, vi.fn());
		connectEvents(new QueryClient(), backend.transport, handlers);
		expect(request.mock.calls.map(([name]) => name)).toEqual([
			"jobs.list",
			"sessions.list",
		]);
		// Sent while the lists are fetched (the mock's services know no jobs): held, then applied.
		backend.events.emit({ type: "job.updated", job: job(1, "queued") });
		backend.events.emit({
			type: "session.updated",
			session: session(1, "starting"),
		});
		await vi.waitFor(() => {
			expect(jobs().j1).toEqual(job(1, "queued"));
			expect(sessions().s1).toEqual(session(1, "starting"));
		});
	});
});
