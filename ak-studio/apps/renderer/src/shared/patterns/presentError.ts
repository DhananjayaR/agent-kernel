// A StudioError in the slots of the empty, cannot-read and error family (StateMessage, ErrorBanner): the catalogue's
// title for its code (what happened, errors/presentation.ts), the error's own message (what to do), its file and
// line, its detail (raw output, masked by the service; collapsed in the view) and its app command as the next
// action, run through runReported so a failure of that command is reported too (a toast), never lost. ErrorView
// places it; JobProgress, SessionControl and StreamingList pass it to their views' error slot. A rejection that is
// not a StudioFailure (a bug) is shown as the catalogue's unexpected error.
import { ERROR_CODES } from "@ak-studio/contract";
import type { ErrorSlots } from "@ak-studio/ui";
import { isStudioFailure, type StudioError } from "../bridge/client";
import { runReported } from "../commands/runReported";
import { errorPresentation } from "../errors/presentation";
import { errorStrings } from "../errors/strings";

export type { ErrorSlots };

/** The family's slots for `error`: its title by code, its message, file, line, detail, and action as an app command. */
export function presentError(error: StudioError): ErrorSlots {
	const { action, file, line, detail } = error;
	return {
		title: errorPresentation(error.code).title,
		description: error.message,
		...(file === undefined ? {} : { file }),
		...(line === undefined ? {} : { line }),
		...(detail === undefined ? {} : { detail }),
		...(action
			? {
					action: {
						label: action.label,
						onAction: () => runReported(action.commandId, action.args),
					},
				}
			: {}),
	};
}

/** What a rejected bridge call says: the StudioFailure's error, or the unexpected error for anything else. */
export function failureOf(reason: unknown): StudioError {
	return isStudioFailure(reason)
		? reason.error
		: { code: ERROR_CODES.internal, message: errorStrings.unexpectedFailure };
}
