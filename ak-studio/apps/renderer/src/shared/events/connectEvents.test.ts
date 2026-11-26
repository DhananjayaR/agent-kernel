// The app's one `events` subscription, against the mock's real EventBus: a domain event invalidates only its own
// domain's keys (by project, or the whole domain), and job, session and recorded-command events reach the
// callbacks the stores give it. When the stream ends with an error it subscribes again after a backoff (fake
// timers), invalidates every query and calls onConnect again, so the stores re-list.
import type { CommandRecord, Job, Session } from "@ak-studio/contract";
import { QueryClient } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockBackend } from "../bridge/mockTransport";
import { keys } from "../query/keys";
import { connectEvents, EVENTS_RETRY_MS } from "./connectEvents";

function cacheWith(...queryKeys: (readonly unknown[])[]) {
	const client = new QueryClient();
	for (const key of queryKeys) client.setQueryData(key, { cached: true });
	const invalidated = () =>
		client
			.getQueryCache()
			.getAll()
			.filter((query) => query.state.isInvalidated)
			.map((query) => query.queryKey);
	return { client, invalidated };
}

const config = keys("config");
const graph = keys("graph");

describe("connectEvents", () => {
	it("invalidates the changed domain's keys for that project, and nothing else", () => {
		const backend = createMockBackend();
		const { client, invalidated } = cacheWith(
			config.detail("p1", "section", "session"),
			config.project("p1"),
			config.project("p2"),
			graph.project("p1"),
			keys("app").all,
		);
		connectEvents(client, backend.transport);
		backend.events.emit({
			type: "domain.changed",
			domain: "config",
			projectId: "p1",
		});
		expect(invalidated()).toEqual([
			config.detail("p1", "section", "session"),
			config.project("p1"),
		]);
	});

	it("invalidates the whole domain when the event names no project", () => {
		const backend = createMockBackend();
		const { client, invalidated } = cacheWith(
			config.project("p1"),
			config.project("p2"),
			graph.project("p1"),
		);
		connectEvents(client, backend.transport);
		backend.events.emit({ type: "domain.changed", domain: "config" });
		expect(invalidated()).toEqual([config.project("p1"), config.project("p2")]);
	});

	it("hands job, session and recorded-command events to their callbacks", () => {
		const backend = createMockBackend();
		const onJob = vi.fn();
		const onSession = vi.fn();
		const onCommand = vi.fn();
		const { client, invalidated } = cacheWith(config.project("p1"));
		connectEvents(client, backend.transport, { onJob, onSession, onCommand });
		const job: Job = {
			id: "j1",
			kind: "t.demo",
			title: "Create project",
			state: "running",
			commandIds: [],
			cancellable: true,
			survivesQuit: false,
			seq: 1,
		};
		const session: Session = {
			id: "s1",
			kind: "run.server",
			state: "running",
			commandIds: [],
			seq: 1,
		};
		const record: CommandRecord = {
			id: "cmd-1",
			executable: "ak",
			args: ["validate"],
			startedAt: 1,
		};
		backend.events.emit({ type: "job.updated", job });
		backend.events.emit({ type: "session.updated", session });
		backend.events.emit({ type: "command.recorded", record });
		expect(onJob).toHaveBeenCalledExactlyOnceWith(job);
		expect(onSession).toHaveBeenCalledExactlyOnceWith(session);
		expect(onCommand).toHaveBeenCalledExactlyOnceWith(record);
		expect(invalidated()).toEqual([]);
	});

	it("opens one subscription, and the function it answers closes it", () => {
		const backend = createMockBackend();
		const subscribe = vi.spyOn(backend.transport, "subscribe");
		const { client, invalidated } = cacheWith(config.project("p1"));
		const disconnect = connectEvents(client, backend.transport);
		expect(subscribe).toHaveBeenCalledOnce();
		expect(subscribe.mock.calls[0]?.[0]).toBe("events");
		disconnect();
		backend.events.emit({ type: "domain.changed", domain: "config" });
		expect(invalidated()).toEqual([]);
	});

	it("ignores job and session events when no store listens", () => {
		const backend = createMockBackend();
		const { client } = cacheWith();
		connectEvents(client, backend.transport);
		expect(() =>
			backend.events.emit({
				type: "session.updated",
				session: {
					id: "s1",
					kind: "k",
					state: "running",
					commandIds: [],
					seq: 1,
				},
			}),
		).not.toThrow();
	});
});

describe("connectEvents: reconnecting", () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	/** An event the `events` stream refuses (a job with no seq): the registry ends the stream with an error. */
	const breakStream = (backend: ReturnType<typeof createMockBackend>) =>
		backend.events.emit({
			type: "job.updated",
			job: { id: "bad" } as unknown as Job,
		});

	function setup() {
		vi.useFakeTimers();
		const log = vi.fn();
		const backend = createMockBackend({ log, onStreamError: () => {} });
		const subscribe = vi.spyOn(backend.transport, "subscribe");
		const onConnect = vi.fn();
		const onJob = vi.fn();
		const { client, invalidated } = cacheWith(config.project("p1"));
		const disconnect = connectEvents(client, backend.transport, {
			onConnect,
			onJob,
		});
		return { backend, subscribe, onConnect, onJob, invalidated, disconnect };
	}

	it("calls onConnect once the subscription is open", () => {
		const { subscribe, onConnect } = setup();
		expect(subscribe).toHaveBeenCalledOnce();
		expect(onConnect).toHaveBeenCalledOnce();
		expect(subscribe.mock.invocationCallOrder[0]).toBeLessThan(
			onConnect.mock.invocationCallOrder[0] as number,
		);
	});

	it("subscribes again after the backoff when the stream fails, re-lists and invalidates every query", async () => {
		const { backend, subscribe, onConnect, onJob, invalidated } = setup();
		breakStream(backend);
		expect(onJob).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(EVENTS_RETRY_MS.first - 1);
		expect(subscribe).toHaveBeenCalledOnce();
		expect(invalidated()).toEqual([]);
		await vi.advanceTimersByTimeAsync(1);
		expect(subscribe).toHaveBeenCalledTimes(2);
		expect(onConnect).toHaveBeenCalledTimes(2);
		// Domain events sent while it was away are lost: everything cached is read again.
		expect(invalidated()).toEqual([config.project("p1")]);
		// The new subscription delivers.
		const job: Job = {
			id: "j1",
			kind: "t.demo",
			title: "Demo",
			state: "running",
			commandIds: [],
			cancellable: true,
			survivesQuit: false,
			seq: 2,
		};
		backend.events.emit({ type: "job.updated", job });
		expect(onJob).toHaveBeenCalledExactlyOnceWith(job);
	});

	it("doubles the wait after each failure, up to 5 s, and starts again from 250 ms once an event arrives", async () => {
		const { backend, subscribe } = setup();
		const waits: number[] = [];
		for (let failure = 0; failure < 7; failure++) {
			const before = subscribe.mock.calls.length;
			breakStream(backend);
			let waited = 0;
			while (subscribe.mock.calls.length === before) {
				await vi.advanceTimersByTimeAsync(EVENTS_RETRY_MS.first);
				waited += EVENTS_RETRY_MS.first;
			}
			waits.push(waited);
		}
		expect(waits).toEqual([250, 500, 1000, 2000, 4000, 5000, 5000]);
		// An event proves the stream works: the next failure waits the first 250 ms again.
		backend.events.emit({ type: "domain.changed", domain: "graph" });
		const before = subscribe.mock.calls.length;
		breakStream(backend);
		await vi.advanceTimersByTimeAsync(EVENTS_RETRY_MS.first);
		expect(subscribe.mock.calls.length).toBe(before + 1);
	});

	it("does not call onConnect for a subscription that failed while opening, and keeps trying", async () => {
		vi.useFakeTimers();
		const failing = {
			request: vi.fn(),
			subscribe: vi.fn(
				(
					_name: string,
					_input: unknown,
					_onEvent: unknown,
					onError?: (error: unknown) => void,
				) => {
					onError?.({ code: "bridge.unavailable", message: "No bridge." });
					return () => {};
				},
			),
		};
		const onConnect = vi.fn();
		const { client } = cacheWith();
		const disconnect = connectEvents(client, failing as never, { onConnect });
		await vi.advanceTimersByTimeAsync(
			EVENTS_RETRY_MS.first + EVENTS_RETRY_MS.first * 2,
		);
		expect(failing.subscribe).toHaveBeenCalledTimes(3);
		expect(onConnect).not.toHaveBeenCalled();
		disconnect();
		await vi.advanceTimersByTimeAsync(EVENTS_RETRY_MS.max * 2);
		expect(failing.subscribe).toHaveBeenCalledTimes(3);
	});

	it("stops trying once disconnected, even with a retry pending", async () => {
		const { backend, subscribe, onConnect, disconnect } = setup();
		breakStream(backend);
		disconnect();
		await vi.advanceTimersByTimeAsync(EVENTS_RETRY_MS.max * 2);
		expect(subscribe).toHaveBeenCalledOnce();
		expect(onConnect).toHaveBeenCalledOnce();
	});
});
