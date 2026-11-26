// EventBus: the one app-wide `events` stream (ruling 6). Services call `emit` for every job, session,
// recorded-command and domain change; each subscriber (the renderer's one subscription, Task 7) receives every
// event emitted while it is subscribed. The registry parses each event against the event union on the way out.
import type { eventsStream, StudioEvent } from "@ak-studio/contract";
import { defaultLog, type Log, maskedLog } from "./host";
import type { StreamRegistrar } from "./registry";
import { SecretMasker } from "./secrets";

export interface EventBusOptions {
	log?: Log;
	/** Masks the log line for a failing subscriber (pass `registry.masker`). Defaults to one that knows none. */
	masker?: SecretMasker;
}

export class EventBus {
	readonly #subscribers = new Set<(event: StudioEvent) => void>();
	readonly #log: Log;

	constructor(options: EventBusOptions = {}) {
		this.#log = maskedLog(
			options.log ?? defaultLog,
			options.masker ?? new SecretMasker(),
		);
	}

	/** Sends `event` to every current subscriber. Never throws: a subscriber that fails is logged and skipped. */
	emit(event: StudioEvent): void {
		for (const send of [...this.#subscribers]) {
			try {
				send(event);
			} catch (err) {
				this.#log(
					`an events subscriber failed on ${event.type}: ${err instanceof Error ? err.message : String(err)}`,
				);
			}
		}
	}

	/** Serves the `events` stream. */
	register(registry: StreamRegistrar<"events", typeof eventsStream>): void {
		registry.handleStream("events", (_input, emit) => {
			this.#subscribers.add(emit);
			return () => {
				this.#subscribers.delete(emit);
			};
		});
	}
}
