// UnsavedChangesGuard: the unsaved changes guard for leaving a view in the app (P1b design gate row (c): a modal with
// Save, Discard and Stay; quitting and closing the window ask through native dialogs, P1b-plan ruling 11). Mounted by
// a view with a working copy. While the copy is dirty, its label is in the window's unsaved list (useUnsavedLabel) and
// its entry in the window's guards (unsavedGuards.ts). One guard holds the router's blocker for all of them, so
// leaving with several unsaved views asks once, in one UnsavedChangesDialog naming them all:
//
// - **Save** saves every view in turn. When all are clean the held navigation goes on. The first that fails (a
//   conflict: the file changed on disk; or any other error) stops it: the dialog stays open with what happened and
//   what to do, the navigation held; the views already saved stay saved and drop out of the dialog. While it runs,
//   Stay, Discard and Escape do nothing (the save's answer decides; a Discard then would be reversed by the write),
//   and Save is pending once it has run 300 ms.
// - **Discard** drops every view's copy, then the navigation goes on. Nothing is dropped unless the person leaves.
// - **Stay** (and Escape) cancels the navigation; every copy stays.
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
import { usePendingAfter } from "../query/pending";
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
	workingCopy: Pick<WorkingCopy<unknown>, "dirty" | "save" | "discard">;
}

/** "a", "a and b", "a, b and c". */
function names(list: readonly string[]): string {
	if (list.length <= 1) return list[0] ?? "";
	return fillString(patternStrings.unsavedJoin, {
		first: list.slice(0, -1).join(patternStrings.unsavedJoinComma),
		last: list[list.length - 1] ?? "",
	});
}

/** Why a save did not come out clean, in the error family's slots. */
function saveFailure(outcome: SaveOutcome): ErrorSlots {
	if (outcome.conflict)
		return presentError({
			code: ERROR_CODES.fileChangedOnDisk,
			message: patternStrings.saveConflict,
		});
	return presentError(
		outcome.error ? outcome.error.error : failureOf(undefined),
	);
}

export function UnsavedChangesGuard({
	label,
	what,
	file,
	discardLabel,
	workingCopy,
}: UnsavedChangesGuardProps) {
	const id = useId();
	const { dirty } = workingCopy;
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

	const { entries, asking } = useSyncExternalStore(
		unsavedGuards.subscribe,
		unsavedGuards.getSnapshot,
	);
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
	const pending = usePendingAfter(saving, saves);
	useEffect(() => {
		if (!blocked) setSaveError(undefined);
	}, [blocked]);

	if (!blocked) return null;
	const only: GuardEntry | undefined =
		entries.length === 1 ? entries[0] : undefined;
	const files = entries
		.map((entry) => entry.file)
		.filter((path): path is string => path !== undefined);

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
					setSaveError(saveFailure(outcome));
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
			saving={saving}
			pending={pending}
			{...(saveError === undefined ? {} : { error: saveError })}
			{...(only?.discardLabel === undefined
				? {}
				: { strings: { discard: only.discardLabel } })}
			onSave={() => {
				void saveAll();
			}}
			onDiscard={() => {
				if (saving) return;
				for (const entry of entries) entry.discard();
				blocker.proceed?.();
			}}
			onStay={() => {
				if (saving) return;
				blocker.reset?.();
			}}
		/>
	);
}
