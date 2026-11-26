// Copying text the person asked for (a streaming list's output, a version gate's upgrade command) to the clipboard,
// through `navigator.clipboard`. A refusal is reported (failureNotice.ts: the Shell's toast, with what to do
// instead) and logged, and the promise rejects, so the view does not say "copied".
import { type FailureNotice, noticeFailure } from "./failureNotice";

/** Copies `text`; rejects, logs and reports `failure` when the clipboard refuses. */
export async function copyToClipboard(
	text: string,
	failure: FailureNotice,
): Promise<void> {
	try {
		await navigator.clipboard.writeText(text);
	} catch (error) {
		noticeFailure(
			failure,
			`copying to the clipboard failed: ${error instanceof Error ? error.message : String(error)}`,
		);
		throw error;
	}
}
