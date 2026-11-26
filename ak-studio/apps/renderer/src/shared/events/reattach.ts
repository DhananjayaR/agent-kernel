// Reattaching the job and session stores (architecture.md, Jobs: Reload). JobService and SessionService live in
// the main process, so a reloaded window, or one whose `events` subscription has just reconnected, asks for
// `jobs.list` and `sessions.list` to learn what is running. The lists fill the stores first; the events that
// arrive while they are fetched are held and applied after them. Every write goes through the stores' newest-wins
// rule (by `seq`), so neither a late list nor an early event can roll a job or a session back, whatever the
// order. connectEvents calls `reattach` each time its subscription opens (storeEventHandlers wires this).
import type { Job, Session, Transport } from "@ak-studio/contract";
import { isStudioFailure } from "../bridge/client";
import { applyJobs } from "../jobs/jobStore";
import { applySessions } from "../sessions/sessionStore";
import type { EventHandlers } from "./connectEvents";

type Log = (message: string) => void;

const consoleLog: Log = (message) => console.error(`[studio] ${message}`);

/** How many reattaches are fetching; while any is, events are held. */
let fetching = 0;
let heldJobs: Job[] = [];
let heldSessions: Session[] = [];

/** A `job.updated` event: applied now, or held while the lists are fetched. */
export function receiveJob(job: Job): void {
	if (fetching > 0) heldJobs.push(job);
	else applyJobs([job]);
}

/** A `session.updated` event: applied now, or held while the lists are fetched. */
export function receiveSession(session: Session): void {
	if (fetching > 0) heldSessions.push(session);
	else applySessions([session]);
}

function reasonOf(err: unknown): string {
	if (isStudioFailure(err)) return err.error.code;
	return err instanceof Error ? err.message : String(err);
}

/**
 * Fills the stores from `jobs.list` and `sessions.list`, then applies the events held meanwhile. Never rejects: a
 * list that fails is logged, and the held events are applied all the same (the next reconnect lists again).
 */
export async function reattach(
	transport: Transport,
	log: Log = consoleLog,
): Promise<void> {
	fetching += 1;
	try {
		// Async wrappers, so a transport that throws instead of rejecting is still a settled failure.
		const [jobs, sessions] = await Promise.allSettled([
			(async () => transport.request("jobs.list", {}))(),
			(async () => transport.request("sessions.list", {}))(),
		]);
		if (jobs.status === "fulfilled") applyJobs(jobs.value.jobs);
		else log(`reattaching jobs failed: ${reasonOf(jobs.reason)}`);
		if (sessions.status === "fulfilled") applySessions(sessions.value.sessions);
		else log(`reattaching sessions failed: ${reasonOf(sessions.reason)}`);
	} finally {
		fetching -= 1;
		if (fetching === 0) {
			const jobs = heldJobs;
			const sessions = heldSessions;
			heldJobs = [];
			heldSessions = [];
			applyJobs(jobs);
			applySessions(sessions);
		}
	}
}

/** The stores' side of connectEvents: events go to the stores, and each (re)connect reattaches. */
export function storeEventHandlers(
	transport: Transport,
	log: Log = consoleLog,
): EventHandlers {
	return {
		onJob: receiveJob,
		onSession: receiveSession,
		onConnect: () => {
			void reattach(transport, log);
		},
	};
}
