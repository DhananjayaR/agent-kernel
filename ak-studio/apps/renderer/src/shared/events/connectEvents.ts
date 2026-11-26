// The app's one subscription to the `events` stream (pre-flight ruling 6), opened once by the app's providers
// (app/App.tsx), never by a feature. A `domain.changed` event invalidates the domain's query-key prefix: `[domain,
// projectId]`, or `[domain]` when it names no project (architecture rule 5: the main process decides what changed;
// the renderer never reasons about paths). Job, session and recorded-command events go to the stores (Task 8)
// through the callbacks.
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
}

/** Subscribes to `events` and routes each event; answers the function that unsubscribes. */
export function connectEvents(
	queryClient: QueryClient,
	transport: Transport,
	handlers: EventHandlers = {},
): () => void {
	return transport.subscribe("events", {}, (event: StudioEvent) => {
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
	});
}
