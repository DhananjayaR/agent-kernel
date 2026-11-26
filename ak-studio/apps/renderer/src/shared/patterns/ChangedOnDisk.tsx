// ChangedOnDisk: the changed-on-disk pattern for a view (P1b design gate row (c)), over the view's working copy
// (useWorkingCopy). It shows ChangedOnDiskBanner at the top of the view (in the flow, or floating over a canvas):
//
// - **The working copy conflicts** (`conflict`: the file changed underneath the person's edits, or a save found it
//   stale): the warning banner. "Keep mine" saves the copy over the file (keepMine), "Take theirs" drops it
//   (takeTheirs); "Keep mine" is pending once the save has run 300 ms.
// - **No working copy, and the view re-read a file changed outside the app** (`changed`, which the view sets from
//   the file's domain event; the working copy cannot tell it from the view's own save): the info banner, until
//   dismissed.
//
// "Compare" is an app command, COMPARE_FILE_COMMAND, run with the file: the compare view is settled when first used
// (the design leans to the Code tab opened on the file's diff), so the button shows only once that command exists.
// Nothing registers it in P1b, so no banner offers Compare yet.
import { ChangedOnDiskBanner } from "@ak-studio/ui";
import { findCommand } from "../commands/runCommand";
import { runReported } from "../commands/runReported";
import type { WorkingCopy } from "../working-copy/useWorkingCopy";

/** The app command behind "Compare": the Code tab's diff of the file against the working copy (P6 or P7 builds it). */
export const COMPARE_FILE_COMMAND = "code.compareWithDisk";

export interface ChangedOnDiskProps {
	/** The file the view shows, relative to the project. */
	file: string;
	/** The view's working copy, when it has one. */
	workingCopy?: Pick<
		WorkingCopy<unknown>,
		"conflict" | "keepMine" | "takeTheirs" | "showPending"
	>;
	/** The view re-read the file after a change made outside the app, with no working copy to keep. */
	changed?: boolean;
	/** Dismisses the info banner (the view clears `changed`). */
	onDismiss?: () => void;
	/** `floating` over a canvas; in the flow at the top of the view by default. */
	placement?: "inline" | "floating";
	/** What the view did, in its own words ("The canvas was updated."), for the info banner. */
	description?: string;
	className?: string;
}

export function ChangedOnDisk({
	file,
	workingCopy,
	changed = false,
	onDismiss,
	placement,
	description,
	className,
}: ChangedOnDiskProps) {
	const common = {
		file,
		...(placement === undefined ? {} : { placement }),
		...(className === undefined ? {} : { className }),
	};
	if (workingCopy?.conflict) {
		const onCompare = findCommand(COMPARE_FILE_COMMAND)
			? () => runReported(COMPARE_FILE_COMMAND, { file })
			: undefined;
		return (
			<ChangedOnDiskBanner
				{...common}
				conflict
				onKeepMine={() => {
					void workingCopy.keepMine();
				}}
				onTakeTheirs={workingCopy.takeTheirs}
				onCompare={onCompare}
				saving={workingCopy.showPending}
			/>
		);
	}
	if (!changed) return null;
	return (
		<ChangedOnDiskBanner
			{...common}
			conflict={false}
			onDismiss={onDismiss}
			{...(description === undefined ? {} : { description })}
		/>
	);
}
