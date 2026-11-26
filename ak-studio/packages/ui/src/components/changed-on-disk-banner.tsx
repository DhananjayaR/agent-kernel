// ChangedOnDiskBanner: a file the view shows changed outside the app (the changed-on-disk pattern; P1b design gate
// row (c), signed off 26 November 2026). A non-blocking banner at the top of the view: in the flow under the view's
// toolbar (forms, code: it covers nothing), or floating at the top of a canvas, a viewport the person pans anyway
// (`placement="floating"`; the view's content box must be positioned).
//
// - **No working copy** (`conflict` false): the view re-read the file and shows it, so nothing needs deciding. The
//   banner is **info** and can be dismissed. A view may say what changed in its own words ("The canvas was
//   updated.").
// - **A conflicting working copy** (`conflict` true): the person's edits are kept and flagged. The banner is
//   **warning** and carries "Keep mine" (save the copy over the file), "Take theirs" (drop the copy) and "Compare".
//   It is not dismissable: the conflict stays until one is chosen. While a "Keep mine" save runs the others are
//   disabled and a second press does nothing (`saving`), and "Keep mine" shows its pending state once the save has
//   run 300 ms (`pending`). A "Keep mine" that failed for another reason shows its error under the choices
//   (`error`), and the banner stays, so the person can try again or take theirs.
// - **Compare** shows only when the caller gives `onCompare`: the compare view is settled when first used (the
//   design leans to the Code tab opened on the file's diff), so no view offers it before then.
//
// The file is a PathChip (never plain text). The banner is a polite status (WCAG 4.1.3), with the tone's icon and
// words, never colour alone.
import { IconX } from "@tabler/icons-react";
import { cn } from "../lib/utils";
import { type ChangedOnDiskStrings, uiStrings } from "../strings";
import { Button, IconButton } from "./button";
import { InlineBanner } from "./inline-banner";
import { PathChip } from "./path-chip";
import { ErrorBanner, type ErrorSlots } from "./state-message";

type Common = {
	/** The file that changed, relative to the project. */
	file: string;
	/** `inline` (in the flow at the top of the view) by default; `floating` over a canvas. */
	placement?: "inline" | "floating";
	/** What the view did or keeps, in the view's words; replaces the default sentence. */
	description?: string;
	strings?: Partial<ChangedOnDiskStrings>;
	className?: string;
};

export type ChangedOnDiskBannerProps = Common &
	(
		| {
				/** No working copy: the view now shows the file as it is on disk. */
				conflict: false;
				/** Shows "Dismiss" when given. */
				onDismiss?: () => void;
				onKeepMine?: undefined;
				onTakeTheirs?: undefined;
				onCompare?: undefined;
				saving?: undefined;
				pending?: undefined;
				error?: undefined;
		  }
		| {
				/** The person's working copy and the file on disk differ. */
				conflict: true;
				/** Saves the working copy over the file. */
				onKeepMine: () => void;
				/** Drops the working copy for the file on disk. */
				onTakeTheirs: () => void;
				/** Opens the compare view; "Compare" shows only when given. */
				onCompare?: () => void;
				/**
				 * A "Keep mine" save is running: "Take theirs" and "Compare" are disabled at once, so a choice made
				 * during the save cannot be reversed by the write landing after it.
				 */
				saving?: boolean;
				/** The save has run 300 ms (the shared pending timing): "Keep mine" shows its pending state. */
				pending?: boolean;
				/** The last "Keep mine" failed (not a conflict): what happened and what to do, under the choices. */
				error?: ErrorSlots;
				onDismiss?: undefined;
		  }
	);

export function ChangedOnDiskBanner(props: ChangedOnDiskBannerProps) {
	const { file, placement = "inline", description, strings, className } = props;
	const text = { ...uiStrings.changedOnDisk, ...strings };
	// The conflict's three choices sit in a row under the words, so the words keep the banner's width; the info
	// banner's one Dismiss sits at its end.
	const choices = props.conflict ? (
		<div className="flex flex-wrap items-center gap-2">
			{props.onCompare ? (
				<Button
					variant="secondary"
					isDisabled={props.saving}
					onPress={props.onCompare}
				>
					{text.compare}
				</Button>
			) : null}
			<Button
				variant="secondary"
				isDisabled={props.saving}
				onPress={props.onTakeTheirs}
			>
				{text.takeTheirs}
			</Button>
			<Button
				variant="secondary"
				isPending={props.pending}
				onPress={() => {
					// One save at a time, whether or not its pending look shows yet.
					if (!props.saving) props.onKeepMine();
				}}
			>
				{text.keepMine}
			</Button>
		</div>
	) : undefined;
	const dismiss =
		!props.conflict && props.onDismiss ? (
			<IconButton
				aria-label={text.dismiss}
				icon={<IconX aria-hidden="true" />}
				onPress={props.onDismiss}
			/>
		) : undefined;

	return (
		<InlineBanner
			data-slot="changed-on-disk"
			data-placement={placement}
			tone={props.conflict ? "warning" : "info"}
			title={props.conflict ? text.conflictTitle : text.updatedTitle}
			actions={dismiss}
			className={cn(
				placement === "floating" &&
					"absolute inset-x-4 top-4 z-10 mx-auto max-w-dialog-l shadow-elevated",
				className,
			)}
		>
			<div className="flex flex-col items-start gap-2">
				<PathChip path={file} />
				<p>{description ?? (props.conflict ? text.conflict : text.updated)}</p>
				{choices}
				{props.conflict && props.error ? (
					<ErrorBanner error={props.error} className="self-stretch" />
				) : null}
			</div>
		</InlineBanner>
	);
}
