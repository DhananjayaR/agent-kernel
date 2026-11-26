// The registry's contract test: registerServices (as index.ts calls it) serves every operation and stream the
// contract declares. The registry's own tests moved with it to packages/runtime (P1b Task 4).
import {
	appInfo,
	appSetTheme,
	contract,
	ERROR_CODES,
	operations,
	type StreamMessage,
} from "@ak-studio/contract";
import { SecretMasker, ServiceRegistry } from "@ak-studio/runtime";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PENDING_REQUESTS } from "./PendingP1bService";
import { registerServices, type ServiceDeps } from "./registerServices";

const deps: ServiceDeps = {
	window: () => null,
	app: {
		version: "1.0.0",
		platform: "linux",
		preferencesFile: "/nonexistent/preferences.json",
	},
};

afterEach(() => {
	vi.useRealTimers();
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

	// TEMPORARY (P1b Task 3): PendingP1bService answers bridge.unavailable for the job and session operations.
	// JobService and SessionService serve them from P1b Task 5 (tested over a registry in
	// packages/runtime/src/services.test.ts); Task 6 wires them in here, deletes PendingP1bService and this test.
	it("answers bridge.unavailable for the job and session operations until their services exist", async () => {
		const registry = new ServiceRegistry();
		registerServices(registry, deps);
		registry.start();
		// A valid input for each, so the handler (not input parsing) answers.
		const inputs: Record<(typeof PENDING_REQUESTS)[number], unknown> = {
			"job.cancel": { jobId: "j1" },
			"job.respond": { jobId: "j1", requestId: "r1", answer: {} },
			"jobs.dismissInterrupted": { jobId: "j1" },
			"jobs.interrupted": {},
			"jobs.list": {},
			"session.start": { kind: "t.kind", args: {} },
			"session.stop": { sessionId: "s1" },
			"sessions.list": {},
		};
		for (const name of PENDING_REQUESTS) {
			expect(await registry.request(name, inputs[name]), name).toMatchObject({
				ok: false,
				error: { code: ERROR_CODES.unavailable },
			});
		}
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
