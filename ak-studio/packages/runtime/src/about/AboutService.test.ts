// AboutService's tests: each operation it registers, answered through a real ServiceRegistry (input and output
// parsed against the contract, as the app serves them), with the core services behind it and a project the tests
// can open. The registry also serves the job and session operations and `stream.read`, so the demo job is answered
// and cancelled and the ticker started and stopped as the renderer does it; the clock is a FakeClock the tests move.
import {
	type Contract,
	contract,
	type Job,
	type OperationMap,
	type StreamChunk,
} from "@ak-studio/contract";
import { describe, expect, it, vi } from "vitest";
import { EventBus } from "../events";
import { JobService } from "../jobs";
import { FakeClock, InMemoryJobRecordStore } from "../ports/fakes";
import { ServiceRegistry } from "../registry";
import { ProjectScopes } from "../scope";
import { SecretMasker } from "../secrets";
import { SessionService } from "../sessions";
import { StreamHub } from "../streams";
import {
	ABOUT_STEP_MS,
	AboutService,
	EMPTY_NOTE_REVISION,
	noteRevision,
} from "./AboutService";
import { aboutStrings } from "./strings";

/** A started registry serving exactly what AboutService registers, and the core services behind it. */
function serve() {
	const log = vi.fn();
	const masker = new SecretMasker();
	const events = new EventBus({ masker, log });
	const streams = new StreamHub({ masker, log });
	const scopes = new ProjectScopes({ masker, log });
	const jobs = new JobService({
		events,
		streams,
		scopes,
		records: new InMemoryJobRecordStore(),
		masker,
		log,
	});
	const sessions = new SessionService({ events, streams, scopes, masker, log });
	const handlers = new Map<string, (input: never) => unknown>();
	const clock = new FakeClock(1_000);
	new AboutService({
		app: { version: "1.2.3", platform: "linux" },
		clock,
		jobs,
		sessions,
		streams,
		events,
		scopes,
		masker,
	}).register({
		handle: (name, handler) => {
			handlers.set(name, handler as (input: never) => unknown);
		},
	});
	const names = [...handlers.keys()];
	// The shared operations the renderer answers, cancels, starts and stops with, and the stream it reads.
	const core = new Map<string, (input: never) => unknown>();
	const collect = {
		handle: (name: string, handler: (input: never) => unknown) => {
			core.set(name, handler);
		},
	};
	jobs.register(collect as never);
	sessions.register(collect as never);
	const served: Contract = {
		operations: Object.fromEntries(
			[...names, ...core.keys()].map((name) => [
				name,
				contract.operations[name as keyof typeof contract.operations],
			]),
		) as OperationMap,
		streams: { "stream.read": contract.streams["stream.read"] },
	};
	const registry = new ServiceRegistry({ contract: served, masker, log });
	for (const [name, handler] of [...handlers, ...core])
		registry.handle(name, handler as never);
	streams.register(registry as never);
	registry.start();

	/** The one job's current state (each test starts one). */
	const job = (): Job | undefined => jobs.list()[0];
	/** Reads a stream as the renderer does: its backlog first, then new lines, in batches. */
	const read = (streamId: string | undefined) => {
		const texts: string[] = [];
		let batches = 0;
		registry.subscribe("stream.read", { streamId }, (message) => {
			if (!message.ok) throw new Error(message.error.code);
			batches += 1;
			for (const chunk of (message.event as { chunks: StreamChunk[] }).chunks)
				texts.push(chunk.text);
		});
		return {
			texts,
			get batches() {
				return batches;
			},
		};
	};
	/** The lines of a stream so far, once its backlog has arrived. */
	const lines = async (streamId: string | undefined): Promise<string[]> => {
		const reader = read(streamId);
		await vi.waitFor(() => expect(reader.batches).toBeGreaterThan(0));
		return reader.texts;
	};
	return {
		registry,
		jobs,
		sessions,
		scopes,
		events,
		clock,
		names,
		job,
		read,
		lines,
	};
}

const HELLO_REVISION =
	"2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824";

describe("AboutService", () => {
	it("registers the About feature's operations, and no other", () => {
		const { names } = serve();
		expect(names.length).toBeGreaterThan(0);
		for (const name of names) expect(name.startsWith("about.")).toBe(true);
	});

	it("answers about.info with the app's version and platform", async () => {
		const { registry } = serve();
		expect(await registry.request("about.info", {})).toEqual({
			ok: true,
			value: { version: "1.2.3", platform: "linux" },
		});
	});

	it("answers about.note: empty at first, at the SHA-256 of the empty text", async () => {
		const { registry } = serve();
		expect(EMPTY_NOTE_REVISION).toBe(await noteRevision(""));
		expect(await noteRevision("hello")).toBe(HELLO_REVISION);
		expect(await registry.request("about.note", {})).toEqual({
			ok: true,
			value: { note: "", revision: EMPTY_NOTE_REVISION },
		});
	});

	it("writes with about.setNote on the current revision, and announces the change", async () => {
		const { registry, events } = serve();
		const emit = vi.spyOn(events, "emit");
		expect(
			await registry.request("about.setNote", {
				note: "hello",
				baseRevision: EMPTY_NOTE_REVISION,
			}),
		).toEqual({ ok: true, value: { revision: HELLO_REVISION } });
		expect(emit).toHaveBeenCalledExactlyOnceWith({
			type: "domain.changed",
			domain: "about",
		});
		expect(await registry.request("about.note", {})).toEqual({
			ok: true,
			value: { note: "hello", revision: HELLO_REVISION },
		});
	});

	it("refuses a stale about.setNote with file.changedOnDisk, carrying no content, and keeps the note", async () => {
		const { registry, events } = serve();
		await registry.request("about.setNote", {
			note: "theirs",
			baseRevision: EMPTY_NOTE_REVISION,
		});
		const emit = vi.spyOn(events, "emit");
		const stale = await registry.request("about.setNote", {
			note: "mine",
			baseRevision: EMPTY_NOTE_REVISION,
		});
		expect(stale).toEqual({
			ok: false,
			error: {
				code: "file.changedOnDisk",
				message: aboutStrings.noteChanged,
			},
		});
		expect(emit).not.toHaveBeenCalled();
		expect(await registry.request("about.note", {})).toMatchObject({
			value: { note: "theirs" },
		});
	});

	it("lets only one of two writes on the same base win", async () => {
		const { registry } = serve();
		const results = await Promise.all(
			["first", "second"].map((note) =>
				registry.request("about.setNote", {
					note,
					baseRevision: EMPTY_NOTE_REVISION,
				}),
			),
		);
		expect(results.filter((r) => r.ok)).toHaveLength(1);
		expect(results.filter((r) => !r.ok)).toEqual([
			expect.objectContaining({
				error: expect.objectContaining({ code: "file.changedOnDisk" }),
			}),
		]);
	});

	it("runs about.demoJob step by step, asks before the last step, and succeeds once approved", async () => {
		const { registry, clock, job, lines } = serve();
		const started = await registry.request("about.demoJob", {});
		expect(started).toMatchObject({
			ok: true,
			value: { jobId: expect.any(String) },
		});
		await vi.waitFor(() => expect(job()?.progress?.step).toBe(1));
		expect(job()).toMatchObject({
			title: "Demo job",
			state: "running",
			cancellable: true,
			survivesQuit: false,
			progress: { step: 1, steps: 3, label: aboutStrings.steps[0] },
		});
		await clock.advance(ABOUT_STEP_MS);
		expect(job()?.progress?.step).toBe(2);
		await clock.advance(ABOUT_STEP_MS);
		const asking = job();
		expect(asking?.state).toBe("waiting-for-user");
		expect(asking?.request).toMatchObject({
			kind: "confirm",
			title: aboutStrings.confirm.title,
			summary: aboutStrings.confirm.summary,
			options: [{ id: "approve" }, { id: "deny" }],
		});
		expect(
			await registry.request("job.respond", {
				jobId: asking?.id,
				requestId: asking?.request?.id,
				answer: { optionId: "approve" },
			}),
		).toEqual({ ok: true, value: {} });
		await vi.waitFor(() => expect(job()?.progress?.step).toBe(3));
		await clock.advance(ABOUT_STEP_MS);
		await vi.waitFor(() => expect(job()?.state).toBe("succeeded"));
		expect(job()?.result).toEqual({ steps: 3 });
		expect(await lines(job()?.streamId)).toEqual([
			"Step 1 of 3: Checking the app",
			"Step 2 of 3: Preparing the demo",
			"Step 3 of 3: Finishing the demo",
		]);
	});

	it("ends about.demoJob as cancelled when the question is denied, without the last step", async () => {
		const { registry, clock, job, lines } = serve();
		await registry.request("about.demoJob", {});
		await vi.waitFor(() => expect(job()?.progress?.step).toBe(1));
		await clock.advance(2 * ABOUT_STEP_MS);
		const asking = job();
		expect(asking?.state).toBe("waiting-for-user");
		await registry.request("job.respond", {
			jobId: asking?.id,
			requestId: asking?.request?.id,
			answer: { optionId: "deny" },
		});
		await vi.waitFor(() => expect(job()?.state).toBe("cancelled"));
		expect(job()?.result).toBeUndefined();
		expect(job()?.error).toBeUndefined();
		expect(await lines(job()?.streamId)).toHaveLength(2);
	});

	it("cancels about.demoJob while it waits for an answer, and in the middle of a step", async () => {
		const { registry, clock, job } = serve();
		await registry.request("about.demoJob", {});
		await vi.waitFor(() => expect(job()?.progress?.step).toBe(1));
		await clock.advance(2 * ABOUT_STEP_MS);
		expect(job()?.state).toBe("waiting-for-user");
		await registry.request("job.cancel", { jobId: job()?.id });
		await vi.waitFor(() => expect(job()?.state).toBe("cancelled"));
		expect(job()?.request).toBeUndefined();

		const second = serve();
		await second.registry.request("about.demoJob", {});
		await vi.waitFor(() => expect(second.job()?.progress?.step).toBe(1));
		// The step's wait ends with the cancel: the clock does not move.
		await second.registry.request("job.cancel", { jobId: second.job()?.id });
		await vi.waitFor(() => expect(second.job()?.state).toBe("cancelled"));
		expect(second.clock.sleeping).toBe(0);
	});

	it("runs an about.ticker session: a line a second, the burst after the first, until stopped", async () => {
		const { registry, sessions, clock, lines } = serve();
		const started = await registry.request("session.start", {
			kind: "about.ticker",
			args: { burst: 3 },
		});
		expect(started).toMatchObject({ ok: true });
		await vi.waitFor(() => expect(sessions.list()[0]?.state).toBe("running"));
		const session = sessions.list()[0];
		expect(session?.info).toEqual({ startedAt: 1_000 });
		await clock.advance(2 * ABOUT_STEP_MS);
		expect(await lines(session?.streamId)).toEqual([
			"Tick 1",
			"Burst line 1 of 3",
			"Burst line 2 of 3",
			"Burst line 3 of 3",
			"Tick 2",
		]);
		await registry.request("session.stop", { sessionId: session?.id });
		await vi.waitFor(() => expect(sessions.list()[0]?.state).toBe("stopped"));
		expect(clock.sleeping).toBe(0);
		await clock.advance(5 * ABOUT_STEP_MS);
		expect(await lines(session?.streamId)).toHaveLength(5);
	});

	it("sends a 10,000-line burst live, in batches, to a reader subscribed from the start, and refuses a burst that is not a positive count", async () => {
		const { registry, sessions, clock, read } = serve();
		await registry.request("session.start", {
			kind: "about.ticker",
			args: { burst: 10_000 },
		});
		await vi.waitFor(() => expect(sessions.list()[0]?.state).toBe("running"));
		// Subscribed before anything is written: nothing arrives until the first tick.
		const reader = read(sessions.list()[0]?.streamId);
		await clock.advance(ABOUT_STEP_MS / 2);
		expect(reader.batches).toBe(0);
		await clock.advance(ABOUT_STEP_MS / 2);
		await vi.waitFor(() =>
			expect(reader.texts.at(-1)).toBe("Burst line 10000 of 10000"),
		);
		// One write, read in batches of at most 500 lines; the stream keeps its newest 5,000 for a reader behind.
		expect(reader.batches).toBe(Math.ceil(reader.texts.length / 500));
		expect(reader.texts).toHaveLength(5_000);
		expect(
			await registry.request("session.start", {
				kind: "about.ticker",
				args: { burst: 0 },
			}),
		).toMatchObject({ ok: false, error: { code: "bridge.invalidInput" } });
		await sessions.stopAll();
	});
});
