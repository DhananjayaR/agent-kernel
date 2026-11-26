// Failures nobody's view is showing (conventions §1 copy rules and §2 feedback placement: errors say what happened
// and what to do; nothing fails silently). A command run from the command palette or a shortcut has no view of its
// own to report into (the palette has already closed), and Copy in a streaming list can be refused by the
// clipboard. Each reports here; the mounted Shell binds a notice that raises a danger toast (placement ruling,
// Task 16 fix round 1: a failure after the palette closed is something that finished away from any view, so it
// goes in a toast). Every failure is also logged. Unbound (no Shell: tests, Storybook), it is only logged.
//
// What the toast says: a version-gated command (CommandUnavailableError) says the command is not available and the
// version gate's reason ("Needs OAK 0.12.0"); any other failure says the error catalogue's title for its code (what
// happened) and the error's own message (what to do), as presentError does, with the error's next action (its app
// command) as the toast's button when it has one. A toast with an action stays until dismissed. Commands are run with
// shared/commands/runReported.ts, whose reporter the Shell binds to reportCommandFailure.
import { CommandUnavailableError, findCommand } from "../commands/runCommand";
import { failureOf, presentError } from "./presentError";
import { patternStrings } from "./strings";

/** One failure, as the notice shows it. */
export interface FailureNotice {
	/** What happened. */
	title: string;
	/** What to do next. */
	description?: string;
	/** The error's next action (its app command), when it has one: the toast's button. */
	action?: { label: string; onAction: () => void };
}

type Notify = (notice: FailureNotice) => void;

let bound: Notify | undefined;

/** Binds the Shell's notice (a toast); returns the unbind. */
export function bindFailureNotice(notify: Notify): () => void {
	bound = notify;
	return () => {
		if (bound === notify) bound = undefined;
	};
}

function describe(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

/** Shows `notice` (when a Shell is bound) and logs `logLine`. */
export function noticeFailure(notice: FailureNotice, logLine: string): void {
	console.error(`[studio] ${logLine}`);
	bound?.(notice);
}

/** What a failed command's notice says (the rules in the header). */
export function commandFailureNotice(
	commandId: string,
	error: unknown,
): FailureNotice {
	if (error instanceof CommandUnavailableError) {
		const title = findCommand(commandId)?.title ?? commandId;
		return {
			title: patternStrings.commandUnavailable.replace("{command}", title),
			description: error.message,
		};
	}
	const { title, description, action } = presentError(failureOf(error));
	return {
		title,
		...(typeof description === "string" ? { description } : {}),
		...(action ? { action } : {}),
	};
}

/** Reports a command that failed or was refused, run from the palette or a shortcut. */
export function reportCommandFailure(commandId: string, error: unknown): void {
	noticeFailure(
		commandFailureNotice(commandId, error),
		`command ${commandId} failed: ${describe(error)}`,
	);
}
