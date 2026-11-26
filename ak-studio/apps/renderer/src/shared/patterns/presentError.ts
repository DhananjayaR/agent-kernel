// A StudioError as the patterns show it inline until Task 17's ErrorView: the catalogue's title for its code (what
// happened, errors/presentation.ts) and the error's own message (what to do), with its app command as the next
// action. A rejection that is not a StudioFailure (a bug) is shown as the catalogue's unexpected error.
import { ERROR_CODES } from "@ak-studio/contract";
import { isStudioFailure, type StudioError } from "../bridge/client";
import { runCommand } from "../commands/runCommand";
import { errorPresentation } from "../errors/presentation";
import { errorStrings } from "../errors/strings";

export interface InlineError {
	title: string;
	description?: string;
	action?: { label: string; onAction: () => void };
}

/** The inline form of `error`: its title by code, its message, and its action as an app command. */
export function presentError(error: StudioError): InlineError {
	const { action } = error;
	return {
		title: errorPresentation(error.code).title,
		description: error.message,
		...(action
			? {
					action: {
						label: action.label,
						onAction: () => {
							void runCommand(action.commandId, action.args);
						},
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
