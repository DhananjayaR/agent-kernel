// The renderer's session store (architecture.md, Sessions): every session the main process has announced, by
// id. Filled like the job store: `session.updated` events, and `sessions.list` after a reload or a reconnect
// (events/reattach.ts), keeping the newest state of each by its `seq`. A view reads the session of one kind in
// one project with `useSession`; sessions are started and stopped with `startSession` and `stopSession`.
import type {
	InputOf,
	ProjectId,
	Session,
	SessionId,
} from "@ak-studio/contract";
import { create } from "zustand";
import { requestStudio } from "../query/hooks";

export interface SessionStoreState {
	/** By id, in the order the store first saw each (the main process lists them oldest first). */
	readonly sessions: Readonly<Record<SessionId, Session>>;
}

export const useSessionStore = create<SessionStoreState>()(() => ({
	sessions: {},
}));

/** Puts each session in the store unless it already has the same or a newer state of it (by `seq`). */
export function applySessions(sessions: readonly Session[]): void {
	if (sessions.length === 0) return;
	useSessionStore.setState((state) => {
		let next: Record<SessionId, Session> | undefined;
		for (const session of sessions) {
			const known = (next ?? state.sessions)[session.id];
			if (known !== undefined && known.seq >= session.seq) continue;
			next ??= { ...state.sessions };
			next[session.id] = session;
		}
		return next ? { sessions: next } : state;
	});
}

const ENDED: ReadonlySet<Session["state"]> = new Set(["stopped", "failed"]);

/**
 * The session of `kind` in `projectId` (none: the app-level one), from the sessions in the store. There is one
 * live session per kind per project, but ended ones stay listed beside it: the live one wins, else the newest
 * ended one, so a view can still show why the last one stopped. Undefined when there has been none.
 */
export function pickSession(
	sessions: Readonly<Record<SessionId, Session>>,
	kind: string,
	projectId?: ProjectId,
): Session | undefined {
	let ended: Session | undefined;
	let live: Session | undefined;
	for (const session of Object.values(sessions)) {
		if (session.kind !== kind || session.projectId !== projectId) continue;
		if (ENDED.has(session.state)) ended = session;
		else live = session;
	}
	return live ?? ended;
}

/** The session of `kind` in `projectId` (see `pickSession`); re-renders only when that answer changes. */
export function useSession(
	kind: string,
	projectId?: ProjectId,
): Session | undefined {
	return useSessionStore((state) =>
		pickSession(state.sessions, kind, projectId),
	);
}

/** Starts a session (`session.start`) and answers its id at once; its states arrive as events. */
export async function startSession(
	input: InputOf<"session.start">,
): Promise<SessionId> {
	const { sessionId } = await requestStudio("session.start", input);
	return sessionId;
}

/** Stops a session (`session.stop`): it passes through `stopping` to `stopped`. Rejects only with a StudioFailure. */
export async function stopSession(sessionId: SessionId): Promise<void> {
	await requestStudio("session.stop", { sessionId });
}
