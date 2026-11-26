// UnsavedChangesGuard: the unsaved changes guard for leaving a view in the app (P1b design gate row (c): a modal with
// Save, Discard and Stay; quitting and closing the window ask through native dialogs, P1b-plan ruling 11). Mounted by
// a view with a working copy: while the copy is dirty, useUnsavedGuard puts the view's label in the window's unsaved
// list and holds in-app navigation with the router's blocker; while a navigation is held, UnsavedChangesDialog asks.
//
// - **Save** saves the working copy; once the save is confirmed (no longer dirty, no conflict, no error) the held
//   navigation goes on. A save that fails (a conflict: the file changed on disk; or any other error) keeps the dialog
//   open with what happened and what to do, and the navigation held. Save is pending once it has run 300 ms.
// - **Discard** drops the copy and goes on. **Stay** (and Escape) cancels the navigation; the copy stays.
//
// The answer always resolves the blocker explicitly (proceed or reset): once the copy is clean the blocker is no
// longer registered, but the held navigation still waits for its answer.
import { ERROR_CODES } from "@ak-studio/contract";
import { type ErrorSlots, UnsavedChangesDialog } from "@ak-studio/ui";
import { useEffect, useState } from "react";
import { useUnsavedGuard } from "../working-copy/useUnsavedGuard";
import type { WorkingCopy } from "../working-copy/useWorkingCopy";
import { failureOf, presentError } from "./presentError";
import { patternStrings } from "./strings";

export interface UnsavedChangesGuardProps {
	/** The view's entry in the window's unsaved list ("Config: session section"); main's quit dialog names it. */
	label: string;
	/** What is unsaved, as the dialog's title names it ("config.yaml"); the label by default. */
	what?: string;
	/** The file the changes belong to. */
	file?: string;
	workingCopy: Pick<
		WorkingCopy<unknown>,
		| "dirty"
		| "saving"
		| "showPending"
		| "conflict"
		| "error"
		| "save"
		| "discard"
	>;
}

export function UnsavedChangesGuard({
	label,
	what,
	file,
	workingCopy,
}: UnsavedChangesGuardProps) {
	const guard = useUnsavedGuard(label, workingCopy.dirty);
	const blocked = guard.status === "blocked";
	// A save asked for from the dialog, waiting for its answer; and what went wrong with the last one.
	const [saveAsked, setSaveAsked] = useState(false);
	const [saveError, setSaveError] = useState<ErrorSlots>();

	useEffect(() => {
		if (!blocked) setSaveError(undefined);
	}, [blocked]);

	const { saving, dirty, conflict, error } = workingCopy;
	useEffect(() => {
		if (!saveAsked || saving) return;
		setSaveAsked(false);
		if (guard.status !== "blocked") return;
		if (!dirty && !conflict && !error) {
			guard.proceed?.();
			return;
		}
		setSaveError(
			conflict
				? presentError({
						code: ERROR_CODES.fileChangedOnDisk,
						message: patternStrings.saveConflict,
					})
				: error
					? presentError(error.error)
					: undefined,
		);
	}, [saveAsked, saving, dirty, conflict, error, guard]);

	if (!blocked) return null;
	return (
		<UnsavedChangesDialog
			isOpen
			what={what ?? label}
			{...(file === undefined ? {} : { file })}
			saving={workingCopy.showPending}
			{...(saveError === undefined ? {} : { error: saveError })}
			onSave={() => {
				setSaveError(undefined);
				setSaveAsked(true);
				workingCopy
					.save()
					.catch((reason: unknown) =>
						setSaveError(presentError(failureOf(reason))),
					);
			}}
			onDiscard={() => {
				workingCopy.discard();
				guard.proceed?.();
			}}
			onStay={() => {
				guard.reset?.();
			}}
		/>
	);
}
