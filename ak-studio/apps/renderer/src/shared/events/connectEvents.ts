// The app's one subscription to the `events` stream (pre-flight ruling 6), opened once by the app's providers
// (app/App.tsx), never by a feature. A `domain.changed` event invalidates the domain's query-key prefix: `[domain,
// projectId]`, or `[domain]` when it names no project (architecture rule 5: the main process decides what changed;
// the renderer never reasons about paths). Job, session and recorded-command events go to the stores through the
// callbacks (events/reattach.ts gives the stores' ones).
//
// If the stream ends with an error, it subscribes again after a backoff (250 ms, doubling to 5 s, back to 250 ms
// once an event arrives). Events sent while it was away are lost, so a reconnect invalidates every query and
// calls `onConnect` again, which re-lists the jobs and sessions (reattach): nothing missed stays stale.
import type {
	CommandRecord,
	Job,
	Session,
	StudioEvent,
	Transport,
} from "@ak-studio/contract";
import type { QueryClient } from "@tanstack/react-query";

export interface EventHandlers {
	onJob?: (job: Job) => void;
	onSession?: (session: Session) => void;
	onCommand?: (record: CommandRecord) => void;
	/**
	 * Called each time the subscription opens, once it is open (so nothing sent after the call is missed): at once,
	 * and after each reconnect. Not called for a subscription that failed while opening.
	 */
	onConnect?: () => void;
}

/** The backoff between attempts to subscribe again: the first wait, doubled after each failure up to the last. */
export const EVENTS_RETRY_MS = { first: 250, max: 5000 } as const;

/** Subscribes to `events` (and again after a failure) and routes each event; answers the function that stops it. */
export function connectEvents(
	queryClient: QueryClient,
	transport: Transport,
	handlers: EventHandlers = {},
): () => void {
	let stopped = false;
	let attempt = 0;
	let delay: number = EVENTS_RETRY_MS.first;
	let unsubscribe: (() => void) | undefined;
	let retry: ReturnType<typeof setTimeout> | undefined;

	const route = (event: StudioEvent): void => {
		switch (event.type) {
			case "domain.changed":
				void queryClient.invalidateQueries({
					queryKey:
						event.projectId === undefined
							? [event.domain]
							: [event.domain, event.projectId],
				});
				return;
			case "job.updated":
				handlers.onJob?.(event.job);
				return;
			case "session.updated":
				handlers.onSession?.(event.session);
				return;
			case "command.recorded":
				handlers.onCommand?.(event.record);
				return;
		}
	};

	const open = (reconnect: boolean): void => {
		attempt += 1;
		const mine = attempt;
		let failed = false;
		let heard = false;
		unsubscribe = transport.subscribe(
			"events",
			{},
			(event) => {
				if (stopped || mine !== attempt) return;
				if (!heard) {
					heard = true;
					delay = EVENTS_RETRY_MS.first;
				}
				route(event);
			},
			() => {
				if (stopped || mine !== attempt || failed) return;
				failed = true;
				// The transport has already closed it. Never subscribe again from inside its callback: wait.
				retry = setTimeout(() => {
					retry = undefined;
					open(true);
				}, delay);
				delay = Math.min(delay * 2, EVENTS_RETRY_MS.max);
			},
		);
		if (failed) return;
		if (reconnect) void queryClient.invalidateQueries();
		handlers.onConnect?.();
	};

	open(false);
	return () => {
		stopped = true;
		if (retry !== undefined) clearTimeout(retry);
		retry = undefined;
		unsubscribe?.();
	};
}
