// UnsavedChangesGuard: the unsaved changes guard for leaving a view in the app (P1b design gate row (c): a modal with
// Save, Discard and Stay; quitting and closing the window ask through native dialogs, P1b-plan ruling 11). Mounted by
// a view with a working copy. While the copy is dirty, its label is in the window's unsaved list (useUnsavedLabel) and
// its entry in the window's guards (unsavedGuards.ts). One guard holds the router's blocker for all of them, so
// leaving with several unsaved views asks once, in one UnsavedChangesDialog naming them all:
//
// - **Save** saves every view in turn (a view whose own save is running is waited for, then written again if it
//   changed meanwhile). When all are clean the held navigation goes on. The first that fails (a conflict: the file
//   changed on disk; or any other error) stops it: the dialog stays open with what happened, naming the view and its
//   file, and what to do; the navigation held; the views already saved stay saved and drop out of the dialog.
// - **While any save runs** (the dialog's own, or one a view started: an explicit Save, an autosave, Keep mine),
//   Discard, Stay and Escape do nothing: the write would undo a Discard. Save is pending once it has run 300 ms. A
//   save still running 10 s after that (SAVE_STUCK_MS) offers Stay again with a note, so the person is never
//   trapped: staying keeps every change.
// - **Discard** drops every view's copy, then the navigation goes on. This guard's blocker is the app's only router
//   blocker (a test checks), so `proceed()` always navigates: nothing is dropped unless the person leaves.
// - **Stay** (and Escape) cancels the navigation; every copy stays.
// - **Every copy turned clean while it asks** (a view's own save landed): it leaves without asking further.
// - **Two views of one file** are named once (one chip). Their copies share the file's revision, so the second save
//   finds the file changed by the first and stops as a conflict, naming that view: correct, since each view's base is
//   now stale; the person stays and keeps theirs (Keep mine writes on the new revision).
//
// The answer always resolves the blocker explicitly (proceed or reset): once the copies are clean the blocker is no
// longer registered, but the held navigation still waits for its answer.
import { ERROR_CODES } from "@ak-studio/contract";
import {
	type ErrorSlots,
	fillString,
	UnsavedChangesDialog,
} from "@ak-studio/ui";
import {
	useEffect,
	useId,
	useLayoutEffect,
	useRef,
	useState,
	useSyncExternalStore,
} from "react";
import { PENDING_DELAY_MS, usePendingAfter } from "../query/pending";
import {
	useUnsavedBlocker,
	useUnsavedLabel,
} from "../working-copy/useUnsavedGuard";
import type { SaveOutcome, WorkingCopy } from "../working-copy/useWorkingCopy";
import { failureOf, presentError } from "./presentError";
import { patternStrings } from "./strings";
import { type GuardEntry, unsavedGuards } from "./unsavedGuards";

export interface UnsavedChangesGuardProps {
	/** The view's entry in the window's unsaved list ("Config: session section"); main's quit dialog names it. */
	label: string;
	/** What is unsaved, as the dialog's title names it ("config.yaml"); the label by default. */
	what?: string;
	/** The file the changes belong to. */
	file?: string;
	/** The Discard button's label when this view is the only one unsaved ("Discard session changes"). */
	discardLabel?: string;
	workingCopy: Pick<
		WorkingCopy<unknown>,
		"dirty" | "saving" | "save" | "discard"
	>;
}

/** "a", "a and b", "a, b and c". */
function names(list: readonly string[]): string {
	if (list.length <= 1) return list[0] ?? "";
	return fillString(patternStrings.unsavedJoin, {
		first: list.slice(0, -1).join(patternStrings.unsavedJoinComma),
		last: list[list.length - 1] ?? "",
	});
}

/** How long a save may run (after its 300 ms pending look) before Stay is offered again. */
export const SAVE_STUCK_MS = 10_000;

/** Why `entry`'s save did not come out clean, in the error family's slots, naming the view and its file. */
function saveFailure(entry: GuardEntry, outcome: SaveOutcome): ErrorSlots {
	const slots = outcome.conflict
		? presentError({
				code: ERROR_CODES.fileChangedOnDisk,
				message: fillString(patternStrings.saveConflict, {
					what: entry.what,
				}),
			})
		: presentError(outcome.error ? outcome.error.error : failureOf(undefined));
	const file = slots.file ?? entry.file;
	return file === undefined ? slots : { ...slots, file };
}

export function UnsavedChangesGuard({
	label,
	what,
	file,
	discardLabel,
	workingCopy,
}: UnsavedChangesGuardProps) {
	const id = useId();
	const { dirty, saving: copySaving } = workingCopy;
	useUnsavedLabel(label, dirty);

	// This view's entry, while dirty. Its save and discard always reach the latest working copy.
	const latest = useRef(workingCopy);
	latest.current = workingCopy;
	useLayoutEffect(() => {
		if (!dirty) return;
		return unsavedGuards.add({
			id,
			what: what ?? label,
			file,
			discardLabel,
			save: () => latest.current.save(),
			discard: () => latest.current.discard(),
		});
	}, [id, dirty, what, label, file, discardLabel]);
	// Whether this view's own save is running (an explicit Save, an autosave, Keep mine).
	useLayoutEffect(() => {
		unsavedGuards.setSaving(id, copySaving);
		return () => unsavedGuards.setSaving(id, false);
	}, [id, copySaving]);

	const {
		entries,
		saving: viewSaving,
		asking,
	} = useSyncExternalStore(unsavedGuards.subscribe, unsavedGuards.getSnapshot);
	const owner = asking ?? entries[0]?.id;
	const blocker = useUnsavedBlocker(owner === id && entries.length > 0);
	const blocked = blocker.status === "blocked";
	useLayoutEffect(() => {
		if (blocked) {
			unsavedGuards.setAsking(id);
			return () => unsavedGuards.setAsking(undefined);
		}
	}, [blocked, id]);

	const [saving, setSaving] = useState(false);
	// Counts the Saves pressed, so each gets its own 300 ms before its pending state shows.
	const [saves, setSaves] = useState(0);
	const [saveError, setSaveError] = useState<ErrorSlots>();
	// A save is on its way: the dialog's own, or one a view started (Discard, Stay and Escape wait for it).
	const busy = saving || viewSaving;
	const pending = usePendingAfter(busy, saves);
	// A save that has run far too long: Stay is offered again (the navigation stays held, the work is kept).
	const stuck = usePendingAfter(busy, saves, PENDING_DELAY_MS + SAVE_STUCK_MS);
	useEffect(() => {
		if (!blocked) setSaveError(undefined);
	}, [blocked]);
	// Every copy turned clean while asking (a view's own save landed): nothing is left to ask about, so it leaves.
	useEffect(() => {
		if (blocked && entries.length === 0 && !busy) blocker.proceed?.();
	}, [blocked, entries.length, busy, blocker]);

	if (!blocked || entries.length === 0) return null;
	const only: GuardEntry | undefined =
		entries.length === 1 ? entries[0] : undefined;
	// One chip per file: two views of one file name it once.
	const files = [
		...new Set(
			entries
				.map((entry) => entry.file)
				.filter((path): path is string => path !== undefined),
		),
	];

	const saveAll = async () => {
		if (saving) return;
		setSaving(true);
		setSaves((n) => n + 1);
		setSaveError(undefined);
		try {
			// The views unsaved when Save was pressed, in turn; the first that is not clean stops it.
			for (const entry of entries) {
				const outcome = await entry.save();
				if (!outcome.clean) {
					setSaveError(saveFailure(entry, outcome));
					return;
				}
			}
			blocker.proceed?.();
		} catch (reason) {
			setSaveError(presentError(failureOf(reason)));
		} finally {
			setSaving(false);
		}
	};

	return (
		<UnsavedChangesDialog
			isOpen
			what={names(entries.map((entry) => entry.what))}
			files={files}
			saving={busy}
			stuck={stuck}
			pending={pending}
			{...(saveError === undefined ? {} : { error: saveError })}
			{...(only?.discardLabel === undefined
				? {}
				: { strings: { discard: only.discardLabel } })}
			onSave={() => {
				void saveAll();
			}}
			onDiscard={() => {
				if (busy) return;
				for (const entry of entries) entry.discard();
				blocker.proceed?.();
			}}
			onStay={() => {
				if (busy && !stuck) return;
				blocker.reset?.();
			}}
		/>
	);
}
