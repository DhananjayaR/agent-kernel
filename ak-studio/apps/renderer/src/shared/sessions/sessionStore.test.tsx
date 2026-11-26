// The session store: newest state by `seq`, the session of one kind in one project (the live one over ended ones
// in the same slot), and starting and stopping through the mock's SessionService.
import { ERROR_CODES, type Session } from "@ak-studio/contract";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setTransport } from "../bridge/client";
import { createMockBackend } from "../bridge/mockTransport";
import {
	applySessions,
	pickSession,
	startSession,
	stopSession,
	useSession,
	useSessionStore,
} from "./sessionStore";

const session = (
	id: string,
	seq: number,
	state: Session["state"],
	extra: Partial<Session> = {},
): Session => ({
	id,
	kind: "run.server",
	state,
	commandIds: [],
	seq,
	...extra,
});

beforeEach(() => {
	useSessionStore.setState({ sessions: {} });
});
afterEach(() => {
	setTransport(undefined);
});

describe("applySessions", () => {
	it("keeps the newest state of each session by seq", () => {
		applySessions([session("s1", 3, "running"), session("s1", 2, "starting")]);
		expect(useSessionStore.getState().sessions.s1?.state).toBe("running");
		const kept = useSessionStore.getState();
		applySessions([session("s1", 3, "running")]);
		expect(useSessionStore.getState()).toBe(kept);
	});
});

describe("pickSession", () => {
	it("answers the live session of the kind in the project, else the newest ended one", () => {
		const sessions = Object.fromEntries(
			[
				session("s1", 5, "stopped", { projectId: "p1" }),
				session("s2", 4, "failed", { projectId: "p1" }),
				session("s3", 2, "running", { projectId: "p1" }),
				session("s4", 2, "running", { projectId: "p2" }),
				session("s5", 2, "running"),
				session("s6", 2, "running", { kind: "agent.session", projectId: "p1" }),
			].map((s) => [s.id, s]),
		);
		expect(pickSession(sessions, "run.server", "p1")?.id).toBe("s3");
		expect(pickSession(sessions, "run.server", "p2")?.id).toBe("s4");
		expect(pickSession(sessions, "run.server")?.id).toBe("s5");
		expect(pickSession(sessions, "agent.session", "p1")?.id).toBe("s6");
		const { s3: _live, ...ended } = sessions;
		expect(pickSession(ended, "run.server", "p1")?.id).toBe("s2");
		expect(pickSession(sessions, "run.server", "p3")).toBeUndefined();
	});
});

describe("useSession", () => {
	it("follows the session of its kind and project, and only re-renders when that answer changes", () => {
		let renders = 0;
		const { result } = renderHook(() => {
			renders += 1;
			return useSession("run.server", "p1");
		});
		expect(result.current).toBeUndefined();
		act(() =>
			applySessions([session("s1", 1, "starting", { projectId: "p1" })]),
		);
		expect(result.current?.state).toBe("starting");
		const before = renders;
		// Another project's session changes nothing here.
		act(() =>
			applySessions([session("s9", 1, "running", { projectId: "p2" })]),
		);
		expect(renders).toBe(before);
		act(() =>
			applySessions([session("s1", 2, "running", { projectId: "p1" })]),
		);
		expect(result.current?.state).toBe("running");
	});
});

describe("startSession and stopSession", () => {
	it("send session.start and session.stop, and reject with the StudioFailure the service answers", async () => {
		const backend = createMockBackend();
		const request = vi.spyOn(backend.transport, "request");
		setTransport(backend.transport);
		// The app declares no session kind in P1b, so SessionService refuses this one.
		const started = await startSession({
			kind: "run.server",
			projectId: undefined,
			args: {},
		}).catch((e: unknown) => e);
		expect((started as { error: { code: string } }).error.code).toBe(
			ERROR_CODES.sessionUnknownKind,
		);
		const stopped = await stopSession("nope").catch((e: unknown) => e);
		expect((stopped as { error: { code: string } }).error.code).toBe(
			ERROR_CODES.sessionNotFound,
		);
		expect(request.mock.calls.map(([name]) => name)).toEqual([
			"session.start",
			"session.stop",
		]);
	});

	it("answers the new session's id", async () => {
		const backend = createMockBackend({
			handlers: { "session.start": () => ({ sessionId: "session-1" }) },
		});
		setTransport(backend.transport);
		await expect(
			startSession({ kind: "run.server", args: { port: 8000 } }),
		).resolves.toBe("session-1");
	});
});
