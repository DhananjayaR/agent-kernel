// EventBus tests: it serves the `events` stream through a registry; every subscriber gets each event emitted
// while it is subscribed, parsed against the event union.
import {
	ERROR_CODES,
	eventsStream,
	type StreamMessage,
	type StudioEvent,
} from "@ak-studio/contract";
import { describe, expect, it, vi } from "vitest";
import { EventBus } from "./events";
import { ServiceRegistry } from "./registry";
import { SecretMasker } from "./secrets";

const changed: StudioEvent = {
	type: "domain.changed",
	domain: "about",
	projectId: "p1",
};

function served(bus = new EventBus()) {
	const registry = new ServiceRegistry({
		contract: { operations: {}, streams: { events: eventsStream } },
		log: vi.fn(),
	});
	registry.register(bus);
	registry.start();
	const subscribe = () => {
		const sent: StreamMessage[] = [];
		const result = registry.subscribe("events", {}, (m) => sent.push(m));
		if (!result.ok) throw new Error(result.error.message);
		return { sent, stop: result.value };
	};
	return { bus, registry, subscribe };
}

describe("EventBus", () => {
	it("delivers each event to every subscriber, until it unsubscribes", () => {
		const { bus, subscribe } = served();
		const a = subscribe();
		const b = subscribe();
		bus.emit(changed);
		a.stop();
		bus.emit({ type: "domain.changed", domain: "jobs" });
		expect(a.sent).toEqual([{ ok: true, event: changed }]);
		expect(b.sent).toEqual([
			{ ok: true, event: changed },
			{ ok: true, event: { type: "domain.changed", domain: "jobs" } },
		]);
	});

	it("sends nothing for events emitted before the subscription", () => {
		const { bus, subscribe } = served();
		bus.emit(changed);
		expect(subscribe().sent).toEqual([]);
	});

	it("emits with no subscriber without failing", () => {
		expect(() => new EventBus().emit(changed)).not.toThrow();
	});

	it("refuses input it does not declare", () => {
		const { registry } = served();
		expect(registry.subscribe("events", { extra: 1 }, () => {})).toMatchObject({
			ok: false,
			error: { code: ERROR_CODES.invalidInput },
		});
	});

	it("keeps delivering to others when one subscriber's send throws, and logs it", () => {
		const log = vi.fn();
		const { bus, registry, subscribe } = served(new EventBus({ log }));
		registry.subscribe("events", {}, () => {
			throw new Error("window gone");
		});
		const ok = subscribe();
		bus.emit(changed);
		expect(ok.sent).toEqual([{ ok: true, event: changed }]);
		expect(log).toHaveBeenCalledWith(expect.stringMatching(/window gone/));
	});

	it("masks known secrets in the line it logs for a failing subscriber", () => {
		const log = vi.fn();
		const masker = new SecretMasker();
		masker.add("hunter22");
		const { bus, registry } = served(new EventBus({ log, masker }));
		registry.subscribe("events", {}, () => {
			throw new Error("send failed with hunter22");
		});
		bus.emit(changed);
		expect(log).toHaveBeenCalledWith(
			expect.stringContaining("send failed with ••••"),
		);
	});
});
