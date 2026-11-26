// The registry's contract test: registerServices (as index.ts calls it) serves every operation and stream the
// contract declares, each from its real service (the job and session operations from JobService and
// SessionService, with crash records in a temporary folder), and its services share the registry's masker and
// the app's log. The registry's own tests moved with it to packages/runtime (P1b Task 4).
import {
	mkdirSync,
	mkdtempSync,
	readdirSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	appInfo,
	appSetTheme,
	contract,
	ERROR_CODES,
	operations,
	type StreamMessage,
} from "@ak-studio/contract";
import {
	type Log,
	ProjectScopes,
	SecretMasker,
	ServiceRegistry,
} from "@ak-studio/runtime";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { registerServices, type ServiceDeps } from "./registerServices";

let root: string;
let log: ReturnType<typeof vi.fn<Log>>;
let deps: ServiceDeps;
beforeEach(() => {
	root = mkdtempSync(join(tmpdir(), "ak-studio-services-"));
	log = vi.fn<Log>();
	deps = {
		window: () => null,
		app: {
			version: "1.0.0",
			platform: "linux",
			preferencesFile: "/nonexistent/preferences.json",
		},
		jobRecordsDir: join(root, "jobs"),
		log,
	};
});

afterEach(() => {
	vi.useRealTimers();
	rmSync(root, { recursive: true, force: true });
});

const record = (jobId: string) => ({
	jobId,
	kind: "project.create",
	title: "Create project",
	startedAt: 1000,
	commandIds: [],
});

describe("registerServices", () => {
	it("serves the real contract completely with the app's own services (registerServices, as index.ts)", () => {
		const registry = new ServiceRegistry();
		expect(registry.missingHandlers()).toEqual(
			[...Object.keys(operations), ...Object.keys(contract.streams)].sort(),
		);
		const services = registerServices(registry, deps);
		expect(services.app.theme).toBe("system");
		expect(registry.missingHandlers()).toEqual([]);
		expect(() => registry.start()).not.toThrow();
		expect(Object.keys(contract.operations)).toContain(appInfo.name);
		expect(Object.keys(contract.operations)).toContain(appSetTheme.name);
		expect(services.window).toBeDefined();
	});

	it("serves the job and session operations from JobService and SessionService, with records in the jobs folder", async () => {
		// A job that never ended in an earlier run: its record is in the folder the app passes.
		mkdirSync(deps.jobRecordsDir, { recursive: true });
		writeFileSync(
			join(deps.jobRecordsDir, "job-old-1.json"),
			JSON.stringify(record("job-old-1")),
		);
		const registry = new ServiceRegistry();
		const services = registerServices(registry, deps);
		registry.start();

		await expect(registry.request("jobs.list", {})).resolves.toEqual({
			ok: true,
			value: { jobs: [] },
		});
		await expect(registry.request("jobs.interrupted", {})).resolves.toEqual({
			ok: true,
			value: { records: [record("job-old-1")] },
		});
		await expect(
			registry.request("jobs.dismissInterrupted", { jobId: "job-old-1" }),
		).resolves.toEqual({ ok: true, value: {} });
		expect(readdirSync(deps.jobRecordsDir)).toEqual([]);
		await expect(
			registry.request("jobs.dismissInterrupted", { jobId: "job-old-1" }),
		).resolves.toMatchObject({
			ok: false,
			error: { code: ERROR_CODES.jobNotFound },
		});
		await expect(
			registry.request("job.cancel", { jobId: "j1" }),
		).resolves.toMatchObject({
			ok: false,
			error: { code: ERROR_CODES.jobNotFound },
		});
		await expect(
			registry.request("job.respond", {
				jobId: "j1",
				requestId: "r1",
				answer: {},
			}),
		).resolves.toMatchObject({
			ok: false,
			error: { code: ERROR_CODES.jobNotFound },
		});
		await expect(registry.request("sessions.list", {})).resolves.toEqual({
			ok: true,
			value: { sessions: [] },
		});
		await expect(
			registry.request("session.start", { kind: "t.kind", args: {} }),
		).resolves.toMatchObject({
			ok: false,
			error: { code: ERROR_CODES.sessionUnknownKind },
		});
		await expect(
			registry.request("session.stop", { sessionId: "s1" }),
		).resolves.toMatchObject({
			ok: false,
			error: { code: ERROR_CODES.sessionNotFound },
		});
		// What index.ts's quit rule reads: nothing running.
		expect(services.jobs.quitPlan()).toEqual({ toCancel: [], blocking: [] });
		expect(services.sessions.list()).toEqual([]);
		expect(services.scopes).toBeInstanceOf(ProjectScopes);
	});

	it("logs a corrupt job record through the app's log, masked with the registry's masker", async () => {
		mkdirSync(deps.jobRecordsDir, { recursive: true });
		writeFileSync(join(deps.jobRecordsDir, "job-tok-123456.json"), "{ nope");
		const registry = new ServiceRegistry();
		const services = registerServices(registry, deps);
		registry.start();
		services.masker.add("tok-123456");
		await expect(registry.request("jobs.interrupted", {})).resolves.toEqual({
			ok: true,
			value: { records: [] },
		});
		expect(log).toHaveBeenCalledWith(
			expect.stringContaining("skipping job record job-••••.json"),
		);
		expect(JSON.stringify(log.mock.calls)).not.toContain("tok-123456");
	});

	it("serves events and stream.read from EventBus and StreamHub", () => {
		vi.useFakeTimers();
		const registry = new ServiceRegistry();
		const services = registerServices(registry, deps);
		registry.start();

		const events: StreamMessage[] = [];
		expect(registry.subscribe("events", {}, (m) => events.push(m)).ok).toBe(
			true,
		);
		services.events.emit({ type: "domain.changed", domain: "about" });
		expect(events).toEqual([
			{ ok: true, event: { type: "domain.changed", domain: "about" } },
		]);

		services.masker.add("hunter22");
		const streamId = services.streams.create();
		services.streams.write(streamId, "stdout", "password hunter22");
		services.streams.end(streamId);
		const batches: StreamMessage[] = [];
		expect(
			registry.subscribe("stream.read", { streamId }, (m) => batches.push(m))
				.ok,
		).toBe(true);
		vi.runAllTimers();
		expect(batches).toEqual([
			{
				ok: true,
				event: {
					chunks: [expect.objectContaining({ text: "password ••••" })],
					dropped: 0,
					ended: true,
				},
			},
		]);
		expect(
			registry.subscribe("stream.read", { streamId: "nope" }, () => {}),
		).toMatchObject({ ok: false, error: { code: ERROR_CODES.streamNotFound } });
	});

	it("masks with one masker: a secret added to it is hidden in error details and in stream output", async () => {
		vi.useFakeTimers();
		const masker = new SecretMasker();
		const registry = new ServiceRegistry({ masker });
		const services = registerServices(registry, deps);
		registry.start();
		expect(services.masker).toBe(masker);
		expect(services.masker).toBe(registry.masker);

		services.masker.add("tok-123456");
		await expect(registry.request("app.tok-123456", {})).resolves.toMatchObject(
			{
				ok: false,
				error: { code: ERROR_CODES.unknownOperation, detail: "app.••••" },
			},
		);
		const streamId = services.streams.create();
		services.streams.write(streamId, "stdout", "using tok-123456");
		const batches: StreamMessage[] = [];
		registry.subscribe("stream.read", { streamId }, (m) => batches.push(m));
		vi.runAllTimers();
		expect(JSON.stringify(batches)).not.toContain("tok-123456");
		expect(batches).toEqual([
			{
				ok: true,
				event: expect.objectContaining({
					chunks: [expect.objectContaining({ text: "using ••••" })],
				}),
			},
		]);
	});
});
