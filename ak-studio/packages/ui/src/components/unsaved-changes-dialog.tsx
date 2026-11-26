// UnsavedChangesDialog: leaving a view in the app with an unsaved working copy (the unsaved changes guard; P1b design
// gate row (c), signed off 26 November 2026: a modal with Save, Discard and Stay). Quitting and closing the window
// ask through native dialogs (P1b-plan ruling 11); this one is for in-app navigation only: leaving a tab, closing the
// project.
//
// - **Names what is unsaved** in its title ("Unsaved changes in config.yaml", or every unsaved view: "…in
//   config.yaml and the session section"), and each file as a PathChip.
// - **Save** (primary) writes the copy and then leaves; **Discard** drops it and leaves, and names what it drops
//   ("Discard changes"; a view may name the thing); **Stay** cancels the navigation, and so does Escape (not while a
//   save runs: the save's answer decides). A click on
//   the scrim does nothing, so a stray click can neither lose work nor leave.
// - **A save that fails** keeps the dialog open with the error under the body (what happened, what to do), so the
//   person can try again, discard, or stay. While it runs, Stay and Discard are disabled and a second Save does
//   nothing; Save shows its pending state once the save has run 300 ms.
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
	/** What is unsaved, as the views word it; several are named together ("config.yaml and the session section"). */
	what: string;
	/** The files the changes belong to, each shown as a PathChip. */
	files?: readonly string[];
	/** Saves; the caller leaves once the save is confirmed. */
	onSave: () => void;
	/** Drops the changes and leaves. */
	onDiscard: () => void;
	/** Cancels the navigation (Stay, Escape). */
	onStay: () => void;
	/**
	 * The save is running: Stay and Discard are disabled at once, so a Discard cannot be reversed by the write landing
	 * after it.
	 */
	saving?: boolean;
	/** The save has run 300 ms (the shared pending timing): Save shows its pending state. */
	pending?: boolean;
	/** The save failed: shown under the body; the dialog stays open. */
	error?: ErrorSlots;
	strings?: Partial<UnsavedChangesStrings>;
};

export function UnsavedChangesDialog({
	isOpen,
	what,
	files = [],
	onSave,
	onDiscard,
	onStay,
	saving = false,
	pending = false,
	error,
	strings,
}: UnsavedChangesDialogProps) {
	const text = { ...uiStrings.unsavedChanges, ...strings };
	return (
		<Modal
			isOpen={isOpen}
			onOpenChange={(open) => {
				// Escape stays, except while the save runs (as Stay is disabled then): the answer comes from the save.
				if (!open && !saving) onStay();
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
					<Button
						variant="primary"
						isPending={pending}
						onPress={() => {
							if (!saving) onSave();
						}}
					>
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
					{files.length > 0 ? (
						<div className="flex flex-wrap gap-2">
							{files.map((file) => (
								<PathChip key={file} path={file} />
							))}
						</div>
					) : null}
					<p>{text.body}</p>
				</Text>
				{error ? <ErrorBanner error={error} /> : null}
			</div>
		</Modal>
	);
}
