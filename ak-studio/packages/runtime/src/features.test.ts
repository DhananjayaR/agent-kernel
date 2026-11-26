// The list of runtime feature services: registerFeatureServices creates each one and registers its handlers on
// the registry it is given, every name a declared operation and none twice. The app's own wiring (desktop and
// mock) is checked whole by registerServices.test.ts and mockTransport.test.ts, which start a registry over the
// real contract.
import { operations } from "@ak-studio/contract";
import { describe, expect, it, vi } from "vitest";
import { EventBus } from "./events";
import { registerFeatureServices } from "./features";
import { JobService } from "./jobs";
import { InMemoryJobRecordStore } from "./ports/fakes";
import { ProjectScopes } from "./scope";
import { SecretMasker } from "./secrets";
import { SessionService } from "./sessions";
import { StreamHub } from "./streams";

function deps() {
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
	return { jobs, sessions, streams, events, scopes, masker };
}

describe("registerFeatureServices", () => {
	it("registers each feature service's handlers once, each for a declared operation", () => {
		const handled: string[] = [];
		const registry = {
			handle: (name: string) => {
				handled.push(name);
			},
		};
		const services = registerFeatureServices(registry, deps());
		for (const service of services)
			expect(typeof service.register).toBe("function");
		for (const name of handled)
			expect(Object.keys(operations), name).toContain(name);
		expect(new Set(handled).size).toBe(handled.length);
	});
});
