// SessionService tests, over session kinds built with `defineSessionKind` (the app's `sessionKinds` is empty in
// P1b): start and stop through every state, args and info parsed at the boundary, one session per kind per
// project, a failing starter, a session that stops by itself, a stop while starting, scope disposal, masking and
// the bounded list of ended sessions. Fake timers settle the services' promises; nothing sleeps.
import {
	defineSessionKind,
	ERROR_CODES,
	eventsStream,
	type Session,
	type StudioEvent,
	StudioFailure,
	sessionStart,
	sessionStop,
	sessionsList,
	streamRead,
	studioEventSchema,
} from "@ak-studio/contract";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { EventBus } from "./events";
import type { Log } from "./host";
import { ServiceRegistry } from "./registry";
import { ProjectScopes } from "./scope";
import { SecretMasker } from "./secrets";
import {
	ENDED_SESSIONS_KEPT,
	type SessionContext,
	type SessionHandle,
	SessionService,
	type SessionStarter,
} from "./sessions";
import { StreamHub } from "./streams";

const server = defineSessionKind({
	kind: "t.server",
	args: z.strictObject({ port: z.int().positive() }),
	info: z.object({ url: z.string() }),
	errors: [ERROR_CODES.fileNotFound],
});
const ticker = defineSessionKind({
	kind: "t.ticker",
	args: z.strictObject({}),
	info: z.object({}),
});
// Info schemas a buggy kind could have: one whose transform throws, and one that lets anything through.
const broken = defineSessionKind({
	kind: "t.broken",
	args: z.strictObject({}),
	info: z.object({}).transform(() => {
		throw new Error("transform boom");
	}),
});
const loose = defineSessionKind({
	kind: "t.loose",
	args: z.strictObject({}),
	info: z.object({ value: z.unknown() }),
});
const kinds = {
	"t.server": server,
	"t.ticker": ticker,
	"t.broken": broken,
	"t.loose": loose,
} as const;
const contract = {
	operations: {
		"session.start": sessionStart,
		"session.stop": sessionStop,
		"sessions.list": sessionsList,
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

const settle = () => vi.runAllTimersAsync();

function setup() {
	const masker = new SecretMasker();
	masker.add(SECRET);
	const log = vi.fn<Log>();
	const events = new EventBus({ log, masker });
	const emitted: StudioEvent[] = [];
	vi.spyOn(events, "emit").mockImplementation((event) => {
		// Every event must pass the event union, as the registry's `events` stream would check it.
		emitted.push(studioEventSchema.parse(structuredClone(event)));
	});
	const streams = new StreamHub({ masker, log });
	const scopes = new ProjectScopes({ log, masker });
	const sessions = new SessionService({
		events,
		streams,
		scopes,
		masker,
		sessionKinds: kinds,
		log,
	});
	const registry = new ServiceRegistry({ contract, log, masker });
	registry.register(events).register(streams);
	sessions.register(registry);
	registry.start();
	const startSession = async (input: Record<string, unknown>) => {
		const result = await registry.request("session.start", input);
		if (!result.ok) throw new StudioFailure(result.error);
		return (result.value as { sessionId: string }).sessionId;
	};
	const current = (id: string): Session | undefined =>
		sessions.list().find((x) => x.id === id);
	const states = (id: string) =>
		emitted
			.filter((e) => e.type === "session.updated" && e.session.id === id)
			.map((e) => (e.type === "session.updated" ? e.session.state : ""));
	return {
		masker,
		log,
		events,
		emitted,
		streams,
		scopes,
		sessions,
		registry,
		startSession,
		current,
		states,
	};
}

/** A starter the test controls: each start parks until the test resolves it; its stop is a spy. */
function parked() {
	const calls: Array<{
		args: unknown;
		ctx: SessionContext;
		started: Deferred<SessionHandle<never>>;
		stop: ReturnType<typeof vi.fn<() => Promise<void>>>;
	}> = [];
	const starter: SessionStarter<unknown, never> = (args, ctx) => {
		const started = deferred<SessionHandle<never>>();
		const stop = vi.fn<() => Promise<void>>(async () => {});
		calls.push({ args, ctx, started, stop });
		return started.promise;
	};
	/** Resolves call `n` with `info` and its stop spy. */
	const run = (n: number, info: unknown) => {
		const call = calls[n];
		call?.started.resolve({ info: info as never, stop: call.stop });
	};
	return { starter, calls, run };
}

beforeEach(() => {
	vi.useFakeTimers();
});
afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
});

describe("SessionService: definitions", () => {
	it("refuses a kind not in its map and a second starter; types a starter by its kind", () => {
		const { sessions } = setup();
		// @ts-expect-error: not a session kind in the map
		expect(() => sessions.define("t.nope", async () => ({}))).toThrow(/t.nope/);
		sessions.define("t.server", async (args) => ({
			info: { url: `http://localhost:${args.port}` },
			stop: async () => {},
		}));
		expect(() =>
			sessions.define("t.server", async () => ({
				info: { url: "" },
				stop: async () => {},
			})),
		).toThrow(/already/);
		// @ts-expect-error: the info must be { url: string }
		setup().sessions.define("t.server", async () => ({
			info: { url: 1 },
			stop: async () => {},
		}));
	});
});

describe("SessionService: start and stop", () => {
	it("starts: answers { sessionId } at once in starting, then running with the info parsed", async () => {
		const s = setup();
		const { starter, calls, run } = parked();
		s.sessions.define("t.server", starter);
		const id = await s.startSession({ kind: "t.server", args: { port: 8080 } });
		expect(id).toMatch(/^session-/);
		expect(calls[0]?.args).toEqual({ port: 8080 });
		expect(calls[0]?.ctx.sessionId).toBe(id);
		expect(s.current(id)).toMatchObject({
			id,
			kind: "t.server",
			state: "starting",
			commandIds: [],
		});
		expect(s.current(id)?.streamId).toBeTruthy();
		run(0, { url: "http://localhost:8080", extra: "stripped" });
		await settle();
		expect(s.current(id)).toMatchObject({
			state: "running",
			info: { url: "http://localhost:8080" },
		});
		expect(s.current(id)?.info).toEqual({ url: "http://localhost:8080" });
		expect(s.states(id)).toEqual(["starting", "running"]);
	});

	it("stops: stopping, then stopped once its stop resolves; the stream ends", async () => {
		const s = setup();
		const { starter, calls, run } = parked();
		s.sessions.define("t.server", starter);
		const id = await s.startSession({ kind: "t.server", args: { port: 1 } });
		run(0, { url: "u" });
		await settle();
		const stopped = deferred();
		calls[0]?.stop.mockImplementation(() => stopped.promise);
		await expect(
			s.registry.request("session.stop", { sessionId: id }),
		).resolves.toEqual({ ok: true, value: {} });
		expect(s.current(id)?.state).toBe("stopping");
		stopped.resolve();
		await settle();
		expect(s.states(id)).toEqual([
			"starting",
			"running",
			"stopping",
			"stopped",
		]);
		expect(calls[0]?.stop).toHaveBeenCalledOnce();
		const batches: unknown[] = [];
		s.registry.subscribe(
			"stream.read",
			{ streamId: s.current(id)?.streamId },
			(m) => batches.push(m),
		);
		await settle();
		expect(batches).toEqual([
			{ ok: true, event: { chunks: [], dropped: 0, ended: true } },
		]);
		// Stopping again is a no-op; an unknown session is session.notFound.
		await expect(
			s.registry.request("session.stop", { sessionId: id }),
		).resolves.toEqual({ ok: true, value: {} });
		await expect(
			s.registry.request("session.stop", { sessionId: "nope" }),
		).resolves.toMatchObject({
			ok: false,
			error: { code: ERROR_CODES.sessionNotFound },
		});
	});

	it("writes the session's output to its stream, masked", async () => {
		const s = setup();
		const { starter, calls, run } = parked();
		s.sessions.define("t.server", starter);
		const id = await s.startSession({ kind: "t.server", args: { port: 1 } });
		calls[0]?.ctx.stream.write("stdout", `listening ${SECRET}`);
		calls[0]?.ctx.addCommand("cmd-1");
		run(0, { url: "u" });
		await settle();
		expect(s.current(id)?.commandIds).toEqual(["cmd-1"]);
		const texts: string[] = [];
		s.registry.subscribe(
			"stream.read",
			{ streamId: s.current(id)?.streamId },
			(m) => {
				if (m.ok)
					for (const c of (m.event as { chunks: { text: string }[] }).chunks)
						texts.push(c.text);
			},
		);
		await settle();
		expect(texts).toEqual(["listening ••••"]);
	});

	it("refuses an unknown kind, a kind with no starter, and args that fail the kind's schema", async () => {
		const s = setup();
		s.sessions.define("t.server", parked().starter);
		await expect(
			s.registry.request("session.start", { kind: "t.nope", args: {} }),
		).resolves.toMatchObject({
			ok: false,
			error: { code: ERROR_CODES.sessionUnknownKind },
		});
		await expect(
			s.registry.request("session.start", { kind: "t.ticker", args: {} }),
		).resolves.toMatchObject({
			ok: false,
			error: { code: ERROR_CODES.sessionUnknownKind },
		});
		for (const args of [{}, { port: -1 }, { port: 1, extra: true }, "x"]) {
			await expect(
				s.registry.request("session.start", { kind: "t.server", args }),
				JSON.stringify(args),
			).resolves.toMatchObject({
				ok: false,
				error: { code: ERROR_CODES.invalidInput },
			});
		}
		expect(s.sessions.list()).toEqual([]);
		// bridge.* codes are implicit: refusing args logs nothing about undeclared codes.
		expect(s.log).not.toHaveBeenCalledWith(
			expect.stringMatching(/does not list/),
		);
	});

	it("runs one session per kind per project (session.alreadyRunning), counting starting and stopping ones", async () => {
		const s = setup();
		const { starter, calls, run } = parked();
		s.sessions.define("t.server", starter);
		s.sessions.define("t.ticker", async () => ({
			info: {},
			stop: async () => {},
		}));
		s.scopes.open("p1", { root: "/p1" });
		s.scopes.open("p2", { root: "/p2" });
		const first = await s.startSession({
			kind: "t.server",
			projectId: "p1",
			args: { port: 1 },
		});
		const again = () =>
			s.registry.request("session.start", {
				kind: "t.server",
				projectId: "p1",
				args: { port: 2 },
			});
		await expect(again()).resolves.toMatchObject({
			ok: false,
			error: { code: ERROR_CODES.sessionAlreadyRunning },
		});
		// Another project, another kind, and no project at all are separate.
		await s.startSession({
			kind: "t.server",
			projectId: "p2",
			args: { port: 1 },
		});
		await s.startSession({ kind: "t.ticker", projectId: "p1", args: {} });
		await s.startSession({ kind: "t.server", args: { port: 1 } });
		run(0, { url: "u" });
		await settle();
		const stopped = deferred();
		calls[0]?.stop.mockImplementation(() => stopped.promise);
		await s.registry.request("session.stop", { sessionId: first });
		expect(s.current(first)?.state).toBe("stopping");
		await expect(again()).resolves.toMatchObject({
			ok: false,
			error: { code: ERROR_CODES.sessionAlreadyRunning },
		});
		stopped.resolve();
		await settle();
		await expect(again()).resolves.toMatchObject({ ok: true });
	});

	it("refuses a project that is not open with project.notOpen", async () => {
		const s = setup();
		s.sessions.define("t.server", parked().starter);
		await expect(
			s.registry.request("session.start", {
				kind: "t.server",
				projectId: "p1",
				args: { port: 1 },
			}),
		).resolves.toMatchObject({
			ok: false,
			error: { code: ERROR_CODES.projectNotOpen },
		});
		expect(s.sessions.list()).toEqual([]);
	});
});

describe("SessionService: failures", () => {
	it("ends in failed when the starter throws: its StudioFailure, or session.failed, masked", async () => {
		const s = setup();
		s.sessions.define("t.server", async () => {
			throw new StudioFailure({
				code: ERROR_CODES.fileNotFound,
				message: `No config ${SECRET}`,
			});
		});
		s.sessions.define("t.ticker", async () => {
			throw new Error(`port busy ${SECRET}`);
		});
		const a = await s.startSession({ kind: "t.server", args: { port: 1 } });
		const b = await s.startSession({ kind: "t.ticker", args: {} });
		await settle();
		expect(s.states(a)).toEqual(["starting", "failed"]);
		expect(s.current(a)?.error).toEqual({
			code: ERROR_CODES.fileNotFound,
			message: "No config ••••",
		});
		expect(s.current(b)).toMatchObject({
			state: "failed",
			error: { code: ERROR_CODES.sessionFailed, detail: "port busy ••••" },
		});
		expect(JSON.stringify(s.emitted)).not.toContain(SECRET);
		// A failed session no longer holds its kind: it can start again.
		await expect(
			s.registry.request("session.start", { kind: "t.ticker", args: {} }),
		).resolves.toMatchObject({ ok: true });
	});

	it("stops what it started and fails with bridge.invalidOutput when the info does not match the kind", async () => {
		const s = setup();
		const { starter, calls, run } = parked();
		s.sessions.define("t.server", starter);
		const id = await s.startSession({ kind: "t.server", args: { port: 1 } });
		run(0, { url: 42 });
		await settle();
		expect(calls[0]?.stop).toHaveBeenCalledOnce();
		expect(s.current(id)).toMatchObject({
			state: "failed",
			error: { code: ERROR_CODES.invalidOutput },
		});
		expect(s.current(id)?.info).toBeUndefined();
		expect(s.log).toHaveBeenCalledWith(
			expect.stringMatching(/t\.server.*bridge\.invalidOutput/),
		);
	});

	it("ends in failed when the session stops by itself (ctx.fail), without calling its stop", async () => {
		const s = setup();
		const { starter, calls, run } = parked();
		s.sessions.define("t.server", starter);
		const id = await s.startSession({ kind: "t.server", args: { port: 1 } });
		run(0, { url: "u" });
		await settle();
		calls[0]?.ctx.fail(new Error(`exited with 1 ${SECRET}`));
		expect(s.current(id)).toMatchObject({
			state: "failed",
			error: { code: ERROR_CODES.sessionFailed, detail: "exited with 1 ••••" },
		});
		expect(calls[0]?.stop).not.toHaveBeenCalled();
		calls[0]?.ctx.fail(new Error("again"));
		expect(s.states(id)).toEqual(["starting", "running", "failed"]);
	});

	it("ends in failed when its stop throws", async () => {
		const s = setup();
		const { starter, calls, run } = parked();
		s.sessions.define("t.server", starter);
		const id = await s.startSession({ kind: "t.server", args: { port: 1 } });
		run(0, { url: "u" });
		await settle();
		calls[0]?.stop.mockRejectedValue(new Error("would not die"));
		await s.registry.request("session.stop", { sessionId: id });
		await settle();
		expect(s.current(id)).toMatchObject({
			state: "failed",
			error: { code: ERROR_CODES.sessionFailed, detail: "would not die" },
		});
	});
});

describe("SessionService: stopping while starting, and scopes", () => {
	it("a stop while starting aborts the signal, waits for the starter, then stops what it started", async () => {
		const s = setup();
		const { starter, calls, run } = parked();
		s.sessions.define("t.server", starter);
		const id = await s.startSession({ kind: "t.server", args: { port: 1 } });
		await s.registry.request("session.stop", { sessionId: id });
		expect(calls[0]?.ctx.signal.aborted).toBe(true);
		expect(s.current(id)?.state).toBe("stopping");
		run(0, { url: "u" });
		await settle();
		expect(calls[0]?.stop).toHaveBeenCalledOnce();
		expect(s.states(id)).toEqual(["starting", "stopping", "stopped"]);
		expect(s.current(id)?.info).toBeUndefined();
	});

	it("a stop while starting ends in stopped when the starter then throws", async () => {
		const s = setup();
		const { starter, calls } = parked();
		s.sessions.define("t.server", starter);
		const id = await s.startSession({ kind: "t.server", args: { port: 1 } });
		await s.registry.request("session.stop", { sessionId: id });
		calls[0]?.started.reject(new Error("aborted"));
		await settle();
		expect(s.current(id)?.state).toBe("stopped");
		expect(s.current(id)?.error).toBeUndefined();
	});

	it("stops a project's sessions, all at once, when its scope is disposed, and waits for them", async () => {
		const s = setup();
		const server = parked();
		const tick = parked();
		s.sessions.define("t.server", server.starter);
		s.sessions.define("t.ticker", tick.starter);
		s.scopes.open("p1", { root: "/p1" });
		s.scopes.open("p2", { root: "/p2" });
		const a = await s.startSession({
			kind: "t.server",
			projectId: "p1",
			args: { port: 1 },
		});
		const b = await s.startSession({
			kind: "t.ticker",
			projectId: "p1",
			args: {},
		});
		const other = await s.startSession({
			kind: "t.server",
			projectId: "p2",
			args: { port: 1 },
		});
		server.run(0, { url: "u" });
		server.run(1, { url: "u" });
		await settle();
		const slow = deferred();
		server.calls[0]?.stop.mockImplementation(() => slow.promise);
		let closed = false;
		void s.scopes.close("p1").then(() => {
			closed = true;
		});
		await settle();
		expect(server.calls[0]?.stop).toHaveBeenCalledOnce();
		expect(tick.calls[0]?.ctx.signal.aborted).toBe(true); // b was still starting
		expect(closed).toBe(false);
		tick.run(0, {});
		slow.resolve();
		await settle();
		expect(closed).toBe(true);
		expect([a, b].map((id) => s.current(id)?.state)).toEqual([
			"stopped",
			"stopped",
		]);
		expect(tick.calls[0]?.stop).toHaveBeenCalledOnce();
		expect(s.current(other)?.state).toBe("running");
	});

	it("stopAll stops every session and resolves once they have ended", async () => {
		const s = setup();
		const { starter, calls, run } = parked();
		s.sessions.define("t.server", starter);
		s.sessions.define("t.ticker", async () => ({
			info: {},
			stop: async () => {},
		}));
		const a = await s.startSession({ kind: "t.server", args: { port: 1 } });
		const b = await s.startSession({ kind: "t.ticker", args: {} });
		run(0, { url: "u" });
		await settle();
		await s.sessions.stopAll();
		expect([a, b].map((id) => s.current(id)?.state)).toEqual([
			"stopped",
			"stopped",
		]);
		expect(calls[0]?.stop).toHaveBeenCalledOnce();
	});
});

describe("SessionService: the list of sessions", () => {
	it(`keeps the newest ${ENDED_SESSIONS_KEPT} ended sessions, and releases the older ones' streams`, async () => {
		const s = setup();
		s.sessions.define("t.ticker", async () => ({
			info: {},
			stop: async () => {},
		}));
		const ids: string[] = [];
		for (let i = 0; i < ENDED_SESSIONS_KEPT + 2; i++) {
			const id = await s.startSession({ kind: "t.ticker", args: {} });
			ids.push(id);
			await settle();
			await s.registry.request("session.stop", { sessionId: id });
			await settle();
		}
		const live = await s.startSession({ kind: "t.ticker", args: {} });
		await settle();
		const listed = await s.registry.request("sessions.list", {});
		const sessions = (listed as { value: { sessions: Session[] } }).value
			.sessions;
		expect(sessions.map((x) => x.id)).toEqual([...ids.slice(2), live]);
		const first = s.emitted.find(
			(e) => e.type === "session.updated" && e.session.id === ids[0],
		);
		const streamId =
			first?.type === "session.updated" ? first.session.streamId : undefined;
		expect(
			s.registry.subscribe("stream.read", { streamId }, () => {}),
		).toMatchObject({ ok: false, error: { code: ERROR_CODES.streamNotFound } });
	});

	it("defaults to the contract's session kinds, which are empty in P1b", async () => {
		const masker = new SecretMasker();
		const sessions = new SessionService({
			events: new EventBus(),
			streams: new StreamHub({ masker }),
			scopes: new ProjectScopes(),
			masker,
		});
		expect(() =>
			(sessions as unknown as SessionService<typeof kinds>).define(
				"t.ticker",
				async () => ({ info: {}, stop: async () => {} }),
			),
		).toThrow(/t.ticker/);
	});
});

describe("SessionService: nothing after the starter can wedge a session", () => {
	it("stops what it started and fails with bridge.invalidOutput when the info schema's transform throws; the kind can start again", async () => {
		const s = setup();
		s.scopes.open("p1", { root: "/p1" });
		const stop = vi.fn(async () => {});
		s.sessions.define("t.broken", async () => ({ info: {}, stop }));
		const id = await s.startSession({
			kind: "t.broken",
			projectId: "p1",
			args: {},
		});
		await settle();
		expect(s.current(id)).toMatchObject({
			state: "failed",
			error: {
				code: ERROR_CODES.invalidOutput,
				detail: expect.stringContaining("transform boom"),
			},
		});
		expect(stop).toHaveBeenCalledOnce();
		await expect(
			s.registry.request("session.start", {
				kind: "t.broken",
				projectId: "p1",
				args: {},
			}),
		).resolves.toMatchObject({ ok: true });
		await settle();
		await expect(s.sessions.stopAll()).resolves.toBeUndefined();
		await expect(s.scopes.close("p1")).resolves.toBeUndefined();
	});

	it("fails with bridge.invalidOutput when the info holds something that is not data, or its getter throws", async () => {
		const s = setup();
		const infos: unknown[] = [
			{ value: () => 1 },
			{
				get value(): unknown {
					throw new Error("getter boom");
				},
			},
		];
		let n = 0;
		s.sessions.define("t.loose", async () => {
			const info = infos[n] as never;
			n += 1;
			return { info, stop: async () => {} };
		});
		const getterInfo = {
			get info(): never {
				throw new Error("info getter boom");
			},
			stop: async () => {},
		};
		s.sessions.define("t.ticker", async () => getterInfo);
		for (let i = 0; i < infos.length; i++) {
			const id = await s.startSession({ kind: "t.loose", args: {} });
			await settle();
			expect(s.current(id), String(i)).toMatchObject({
				state: "failed",
				error: { code: ERROR_CODES.invalidOutput },
			});
			expect(s.current(id)?.info).toBeUndefined();
		}
		const ticker = await s.startSession({ kind: "t.ticker", args: {} });
		await settle();
		expect(s.current(ticker)).toMatchObject({
			state: "failed",
			error: {
				code: ERROR_CODES.invalidOutput,
				detail: expect.stringContaining("info getter boom"),
			},
		});
		expect(() => s.sessions.list()).not.toThrow();
	});

	it("still ends the session and frees its slot when announcing the end throws", async () => {
		const s = setup();
		const { starter, run } = parked();
		s.sessions.define("t.server", starter);
		const id = await s.startSession({ kind: "t.server", args: { port: 1 } });
		run(0, { url: "u" });
		await settle();
		const emit = vi.mocked(s.events.emit);
		emit.mockImplementation((event) => {
			if (
				event.type === "session.updated" &&
				event.session.state === "stopped"
			) {
				throw new Error("send failed");
			}
		});
		await s.registry.request("session.stop", { sessionId: id });
		await settle();
		expect(s.current(id)?.state).toBe("stopped");
		expect(s.log).toHaveBeenCalledWith(expect.stringMatching(/send failed/));
		await expect(
			s.registry.request("session.start", {
				kind: "t.server",
				args: { port: 1 },
			}),
		).resolves.toMatchObject({ ok: true });
	});

	it("calls stop once when a stop arrives while it stops a session whose info failed", async () => {
		const s = setup();
		const stopping = deferred();
		const stop = vi.fn(() => stopping.promise);
		s.sessions.define("t.server", async () => ({
			info: { url: 42 } as unknown as { url: string },
			stop,
		}));
		const id = await s.startSession({ kind: "t.server", args: { port: 1 } });
		await settle();
		expect(stop).toHaveBeenCalledOnce();
		await s.registry.request("session.stop", { sessionId: id });
		stopping.resolve();
		await settle();
		expect(stop).toHaveBeenCalledOnce();
		expect(s.current(id)).toMatchObject({
			state: "failed",
			error: { code: ERROR_CODES.invalidOutput },
		});
	});

	it("keeps the slot after ctx.fail while starting, until the starter has settled and what it started is stopped", async () => {
		const s = setup();
		const { starter, calls, run } = parked();
		s.sessions.define("t.server", starter);
		const id = await s.startSession({ kind: "t.server", args: { port: 1 } });
		calls[0]?.ctx.fail(new Error("crashed"));
		expect(s.current(id)?.state).toBe("failed");
		const again = () =>
			s.registry.request("session.start", {
				kind: "t.server",
				args: { port: 1 },
			});
		await expect(again()).resolves.toMatchObject({
			ok: false,
			error: { code: ERROR_CODES.sessionAlreadyRunning },
		});
		run(0, { url: "u" });
		await settle();
		expect(calls[0]?.stop).toHaveBeenCalledOnce();
		await expect(again()).resolves.toMatchObject({ ok: true });
	});

	it("refuses a command id that is not a non-empty string", async () => {
		const s = setup();
		const { starter, calls } = parked();
		s.sessions.define("t.server", starter);
		await s.startSession({ kind: "t.server", args: { port: 1 } });
		expect(() => calls[0]?.ctx.addCommand("")).toThrow(TypeError);
	});
});
