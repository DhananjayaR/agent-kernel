// UnsavedChangesDialog: leaving a view in the app with an unsaved working copy (the unsaved changes guard; P1b design
// gate row (c), signed off 26 November 2026: a modal with Save, Discard and Stay). Quitting and closing the window
// ask through native dialogs (P1b-plan ruling 11); this one is for in-app navigation only: leaving a tab, closing the
// project.
//
// - **Names what is unsaved** in its title ("Unsaved changes in config.yaml"), and the file as a PathChip when the
//   view gives one.
// - **Save** (primary) writes the copy and then leaves; **Discard** drops it and leaves, and names what it drops
//   ("Discard changes"; a view may name the thing); **Stay** cancels the navigation, and so does Escape. A click on
//   the scrim does nothing, so a stray click can neither lose work nor leave.
// - **A save that fails** keeps the dialog open with the error under the body (what happened, what to do), so the
//   person can try again, discard, or stay. While it runs, Save is pending and the others are disabled.
//
// An alert dialog built on Modal: focus moves into it (onto the dialog, never onto Discard) and returns to where it
// was when it closes. Presentational: the renderer's UnsavedChangesGuard opens it from the router's blocker.
import { Text } from "react-aria-components";
import { fillString, type UnsavedChangesStrings, uiStrings } from "../strings";
import { Button } from "./button";
import { Modal } from "./modal";
import { PathChip } from "./path-chip";
import { ErrorBanner, type ErrorSlots } from "./state-message";

export type UnsavedChangesDialogProps = {
	isOpen: boolean;
	/** What is unsaved, as the view words it ("config.yaml", "the session section"). */
	what: string;
	/** The file the changes belong to, shown as a PathChip. */
	file?: string;
	/** Saves; the caller leaves once the save is confirmed. */
	onSave: () => void;
	/** Drops the changes and leaves. */
	onDiscard: () => void;
	/** Cancels the navigation (Stay, Escape). */
	onStay: () => void;
	/** The save is running: Save is pending, the others disabled. */
	saving?: boolean;
	/** The save failed: shown under the body; the dialog stays open. */
	error?: ErrorSlots;
	strings?: Partial<UnsavedChangesStrings>;
};

export function UnsavedChangesDialog({
	isOpen,
	what,
	file,
	onSave,
	onDiscard,
	onStay,
	saving = false,
	error,
	strings,
}: UnsavedChangesDialogProps) {
	const text = { ...uiStrings.unsavedChanges, ...strings };
	return (
		<Modal
			isOpen={isOpen}
			onOpenChange={(open) => {
				if (!open) onStay();
			}}
			title={fillString(text.title, { what })}
			role="alertdialog"
			showCloseButton={false}
			isDismissable={false}
			actions={() => (
				<>
					<Button variant="secondary" isDisabled={saving} onPress={onStay}>
						{text.stay}
					</Button>
					<Button variant="secondary" isDisabled={saving} onPress={onDiscard}>
						{text.discard}
					</Button>
					<Button variant="primary" isPending={saving} onPress={onSave}>
						{text.save}
					</Button>
				</>
			)}
		>
			<div data-slot="unsaved-changes" className="flex flex-col gap-4">
				<Text
					slot="description"
					elementType="div"
					className="flex flex-col gap-3"
				>
					{file ? (
						<div>
							<PathChip path={file} />
						</div>
					) : null}
					<p>{text.body}</p>
				</Text>
				{error ? <ErrorBanner error={error} /> : null}
			</div>
		</Modal>
	);
}
