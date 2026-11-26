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

	// TEMPORARY (P1b Task 3): PendingP1bService answers bridge.unavailable for the operations whose services come
	// in Task 5. Task 6 deletes it and this test, and turns the todo below into a real test.
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

	it("serves events and stream.read from EventBus and StreamHub, with stream output masked by the registry's masker", () => {
		vi.useFakeTimers();
		const masker = new SecretMasker();
		const registry = new ServiceRegistry({ masker });
		const services = registerServices(registry, { ...deps, masker });
		registry.start();
		expect(services.masker).toBe(masker);

		const events: StreamMessage[] = [];
		expect(registry.subscribe("events", {}, (m) => events.push(m)).ok).toBe(
			true,
		);
		services.events.emit({ type: "domain.changed", domain: "about" });
		expect(events).toEqual([
			{ ok: true, event: { type: "domain.changed", domain: "about" } },
		]);

		masker.add("hunter22");
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

	it.todo(
		"serves the job and session operations from JobService and SessionService (P1b Task 5; wired in registerServices by Task 6)",
	);
});
