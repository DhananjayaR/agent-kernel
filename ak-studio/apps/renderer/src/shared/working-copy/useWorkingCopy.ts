// The working-copy helper (architecture.md, "Where each kind of data lives", rule 3, and "Writing files safely").
// A view may hold an editable copy of server data only while the person edits it. The copy records the revision
// it was taken from, is written back by one command at a defined moment (`save()`, with that `baseRevision`), and
// is dropped once the write is confirmed and re-read. If the file changes underneath it, the copy is kept and
// flagged as conflicting, and the person chooses: keep mine (write again on the new revision) or take theirs.
// The copy lives in this hook only; nothing else reads it.
import { ERROR_CODES, type Revision } from "@ak-studio/contract";
import { useLayoutEffect, useReducer, useRef } from "react";
import { isStudioFailure, StudioFailure } from "../bridge/client";
import { usePendingAfter } from "../query/pending";

export interface WorkingCopyOptions<T> {
	/** The server's value: the query's data. */
	value: T | undefined;
	/** The revision `value` was read at. */
	revision: Revision | undefined;
	/** The one command that writes the copy back, carrying the revision it was edited from. */
	write: (draft: T, baseRevision: Revision) => Promise<{ revision: Revision }>;
	/**
	 * Re-reads the query after a stale save (`file.changedOnDisk` carries no content), so "theirs" arrives with
	 * its revision. Optional: the domain event of the change also re-reads it.
	 */
	reread?: () => unknown;
}

export interface WorkingCopy<T> {
	/** The copy while there is one, else the server's value. T is a plain value, never a function. */
	draft: T | undefined;
	setDraft(next: T | ((current: T | undefined) => T)): void;
	/** There is a copy with edits not yet written. */
	dirty: boolean;
	/** The file changed underneath the copy (a new revision, or a stale save); the copy is kept. */
	conflict: boolean;
	/** A save is running. */
	saving: boolean;
	/** A save has run for 300 ms (the shared pending timing). */
	showPending: boolean;
	/** The last save's failure, other than a conflict. */
	error: StudioFailure | undefined;
	/** Writes the copy with its base revision. Never rejects: a failure is `conflict` or `error`. */
	save(): Promise<void>;
	/** Drops the copy. */
	discard(): void;
	/** Drops the copy in favour of the server's value, ending the conflict. */
	takeTheirs(): void;
	/** Writes the copy again with the latest revision as its base, ending the conflict. */
	keepMine(): Promise<void>;
}

interface Copy<T> {
	draft: T;
	/** The revision the copy was taken from, or the one its last write produced. */
	base: Revision | undefined;
	/** Counts edits, so a save knows whether the copy changed while it ran. */
	edits: number;
	/** Written and confirmed; kept on screen only until the re-read arrives. */
	written: boolean;
}

interface State<T> {
	copy: Copy<T> | undefined;
	conflict: boolean;
	saving: boolean;
	error: StudioFailure | undefined;
}

export function useWorkingCopy<T>(
	options: WorkingCopyOptions<T>,
): WorkingCopy<T> {
	const [, rerender] = useReducer((n: number) => n + 1, 0);
	const state = useRef<State<T>>({
		copy: undefined,
		conflict: false,
		saving: false,
		error: undefined,
	});
	const latest = useRef(options);
	latest.current = options;

	// A new revision from the server. While a save runs, its answer decides (it may be this very write).
	const seenRevision = useRef(options.revision);
	useLayoutEffect(() => {
		if (seenRevision.current === options.revision) return;
		seenRevision.current = options.revision;
		const s = state.current;
		if (s.saving || !s.copy) return;
		if (s.copy.written) s.copy = undefined;
		else if (options.revision !== s.copy.base) s.conflict = true;
		rerender();
	}, [options.revision]);

	const write = async (copy: Copy<T>): Promise<void> => {
		const s = state.current;
		const base = copy.base;
		if (base === undefined)
			throw new Error("useWorkingCopy: no revision to save against");
		const edits = copy.edits;
		s.saving = true;
		s.conflict = false;
		s.error = undefined;
		rerender();
		try {
			const { revision } = await latest.current.write(copy.draft, base);
			if (s.copy !== copy) return;
			copy.base = revision;
			if (copy.edits === edits) copy.written = true;
			// The re-read already landed while the save ran: settle against it now.
			const current = latest.current.revision;
			if (current !== base) {
				if (copy.written) s.copy = undefined;
				else if (current !== revision) s.conflict = true;
			}
		} catch (err) {
			if (s.copy !== copy) return;
			if (
				isStudioFailure(err) &&
				err.error.code === ERROR_CODES.fileChangedOnDisk
			) {
				s.conflict = true;
				latest.current.reread?.();
			} else {
				s.error = isStudioFailure(err)
					? err
					: new StudioFailure({
							code: ERROR_CODES.internal,
							message: err instanceof Error ? err.message : String(err),
						});
			}
		} finally {
			s.saving = false;
			rerender();
		}
	};

	const s = state.current;
	const showPending = usePendingAfter(s.saving);
	return {
		draft: s.copy ? s.copy.draft : options.value,
		dirty: s.copy !== undefined && !s.copy.written,
		conflict: s.conflict,
		saving: s.saving,
		showPending,
		error: s.error,
		setDraft(next) {
			const st = state.current;
			const current = st.copy ? st.copy.draft : latest.current.value;
			const draft =
				typeof next === "function"
					? (next as (current: T | undefined) => T)(current)
					: next;
			if (st.copy) {
				st.copy.draft = draft;
				st.copy.edits += 1;
				st.copy.written = false;
			} else {
				st.copy = {
					draft,
					base: latest.current.revision,
					edits: 1,
					written: false,
				};
			}
			rerender();
		},
		async save() {
			const st = state.current;
			if (!st.copy || st.copy.written || st.saving) return;
			await write(st.copy);
		},
		discard() {
			drop(state.current);
			rerender();
		},
		takeTheirs() {
			drop(state.current);
			rerender();
		},
		async keepMine() {
			const st = state.current;
			if (!st.copy || st.saving) return;
			st.copy.base = latest.current.revision;
			st.copy.written = false;
			await write(st.copy);
		},
	};
}

function drop<T>(s: State<T>): void {
	s.copy = undefined;
	s.conflict = false;
	s.error = undefined;
}
