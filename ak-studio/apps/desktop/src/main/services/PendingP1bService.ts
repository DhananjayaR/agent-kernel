// TEMPORARY (P1b Task 3): placeholder handlers for the operations the contract declares before the services
// that serve them exist, so the registry (which refuses to start with a handler missing) and the app still
// start. Each request answers `bridge.unavailable`. The `events` and `stream.read` streams it served until P1b
// Task 4 now come from EventBus and StreamHub (registerServices). Replaced by: the job and session operations
// by JobService and SessionService (P1b Task 5). P1b Task 6 wires those into registerServices and deletes this
// file. No Electron import.
import { ERROR_CODES, StudioFailure } from "@ak-studio/contract";
import type { Service, ServiceRegistry } from "@ak-studio/runtime";

/** The requests with no service yet: the job and session operations (served from P1b Task 5). */
export const PENDING_REQUESTS = [
	"job.cancel",
	"job.respond",
	"jobs.dismissInterrupted",
	"jobs.interrupted",
	"jobs.list",
	"session.start",
	"session.stop",
	"sessions.list",
] as const;

function notYetServed(name: string): never {
	throw new StudioFailure({
		code: ERROR_CODES.unavailable,
		message: "This part of the app is not available yet.",
		detail: `${name} has no service until a later P1b task.`,
	});
}

export class PendingP1bService implements Service {
	register(registry: ServiceRegistry): void {
		for (const name of PENDING_REQUESTS)
			registry.handle(name, () => notYetServed(name));
	}
}
