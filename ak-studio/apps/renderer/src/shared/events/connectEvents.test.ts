// The app's one `events` subscription, against the mock's real EventBus: a domain event invalidates only its own
// domain's keys (by project, or the whole domain), and job, session and recorded-command events reach the
// callbacks the stores (Task 8) give it.
import type { CommandRecord, Job, Session } from "@ak-studio/contract";
import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { createMockBackend } from "../bridge/mockTransport";
import { keys } from "../query/keys";
import { connectEvents } from "./connectEvents";

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
		};
		const session: Session = {
			id: "s1",
			kind: "run.server",
			state: "running",
			commandIds: [],
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
				session: { id: "s1", kind: "k", state: "running", commandIds: [] },
			}),
		).not.toThrow();
	});
});
