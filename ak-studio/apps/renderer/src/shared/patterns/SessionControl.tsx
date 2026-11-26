// SessionControl: the session control pattern over one session kind (architecture.md, Sessions; P1b design gate row
// (b)). It reads the session of `kind` (in `projectId`, or the app-level one) with `useSession` and fills
// SessionControlView: its state (no session yet reads as stopped), its key facts from the kind's `info` (the caller
// says which and how, through `facts`), one button that starts it (startSession, with the caller's `args`) or stops
// it (stopSession), pending once the call has taken 300 ms (usePendingAfter), and a start or stop the service
// refused, said inline (presentError). A session that failed shows its own error. "Show log" runs the app command
// `logCommand` when given and declared (the bottom panel's view of its output; P8 for the run log).
//
// The top bar's local run keeps RunControl as built in P1a (P8 wires it); this is the generic control a view shows,
// the About ticker first (Task 18).
import type { ProjectId, Session } from "@ak-studio/contract";
import {
	type SessionControlState,
	SessionControlView,
	type SessionFact,
} from "@ak-studio/ui";
import { useState } from "react";
import { findCommand } from "../commands/runCommand";
import { runReported } from "../commands/runReported";
import { usePendingAfter } from "../query/pending";
import {
	startSession,
	stopSession,
	useSession,
} from "../sessions/sessionStore";
import { type ErrorSlots, failureOf, presentError } from "./presentError";

export interface SessionControlProps {
	/** The session kind ("about.ticker"). */
	kind: string;
	/** The project it runs in; none for an app-level session. */
	projectId?: ProjectId;
	/** What it is ("Demo ticker"), from the feature's strings. */
	title: string;
	/** The arguments `session.start` passes to the kind's starter. */
	args?: unknown;
	/**
	 * The key facts to show from the session while it lives. Its `info` is typed per kind and absent until the
	 * starter has answered (while it is starting), so answer no facts then.
	 */
	facts?: (session: Session) => readonly SessionFact[];
	/** The app command that shows its log, if it has one. */
	logCommand?: string;
}

const LIVE: ReadonlySet<Session["state"]> = new Set([
	"starting",
	"running",
	"stopping",
]);

export function SessionControl({
	kind,
	projectId,
	title,
	args = {},
	facts,
	logCommand,
}: SessionControlProps) {
	const session = useSession(kind, projectId);
	const [calling, setCalling] = useState<"start" | "stop">();
	const [refused, setRefused] = useState<ErrorSlots>();
	const pending = usePendingAfter(calling !== undefined, calling);
	const state: SessionControlState = session?.state ?? "stopped";
	const live = LIVE.has(state);

	const call = (which: "start" | "stop", run: () => Promise<unknown>) => {
		if (calling) return;
		setCalling(which);
		setRefused(undefined);
		run()
			.catch((reason: unknown) => setRefused(presentError(failureOf(reason))))
			.finally(() => setCalling(undefined));
	};

	const failure =
		session?.state === "failed" && session.error
			? presentError(session.error)
			: undefined;
	const error = refused ?? failure;
	const showLog =
		logCommand !== undefined && findCommand(logCommand)
			? () => {
					runReported(logCommand);
				}
			: undefined;

	return (
		<SessionControlView
			title={title}
			state={state}
			facts={session && live && facts ? facts(session) : []}
			onStart={() =>
				call("start", () =>
					startSession({
						kind,
						args,
						...(projectId === undefined ? {} : { projectId }),
					}),
				)
			}
			onStop={
				session ? () => call("stop", () => stopSession(session.id)) : undefined
			}
			pending={pending}
			onShowLog={showLog}
			error={error}
		/>
	);
}
