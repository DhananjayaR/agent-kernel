// useAboutTicker: the app-level `about.ticker` session (a line a second until stopped), from the session store, with
// the calls that start and stop it. Its states arrive as `session.updated` events; its lines are read with
// `useStream(session.streamId)` (shared/streams/streamStore.ts). Not generated: the generators make queries,
// commands and jobs; a session kind and its hook are written by hand on the same pattern.
import type { Session, SessionArgsOf } from "@ak-studio/contract";
import {
	startSession,
	stopSession,
	useSession,
} from "../../../shared/sessions/sessionStore";

const KIND = "about.ticker";

export interface AboutTicker {
	/** The live ticker, else the last one that ended; undefined before the first. */
	session: Session | undefined;
	/** Starts the ticker and answers its session id; `burst` lines are written at once first. */
	start(args?: SessionArgsOf<typeof KIND>): Promise<string>;
	/** Stops the live ticker; nothing when none is running. */
	stop(): Promise<void>;
}

/** About: the ticker session. */
export function useAboutTicker(): AboutTicker {
	const session = useSession(KIND);
	const live =
		session && session.state !== "stopped" && session.state !== "failed";
	return {
		session,
		start: (args = {}) => startSession({ kind: KIND, args }),
		stop: async () => {
			if (live) await stopSession(session.id);
		},
	};
}
