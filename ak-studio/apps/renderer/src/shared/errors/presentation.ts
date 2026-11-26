// How each error code is presented: its title and where it shows (conventions-and-skills.md, feedback
// placement: inline for a field or a control, a banner for a view, a toast only for something that finished in
// the background). One entry per code in the catalog; the map's type and a test both fail when a code is added
// without one (architecture.md, Errors). ErrorView (a later task) reads it.
import { ERROR_CODES, type ErrorCode, isErrorCode } from "@ak-studio/contract";
import { errorStrings } from "./strings";

export const ERROR_PLACEMENTS = ["inline", "banner", "toast"] as const;
export type ErrorPlacement = (typeof ERROR_PLACEMENTS)[number];

export interface ErrorPresentation {
	/** Sentence case; says what happened. The StudioError's own message and detail go below it. */
	title: string;
	placement: ErrorPlacement;
}

const t = errorStrings.titles;
const C = ERROR_CODES;

export const ERROR_PRESENTATIONS: Readonly<
	Record<ErrorCode, ErrorPresentation>
> = Object.freeze({
	[C.unknownOperation]: { title: t.unknownOperation, placement: "banner" },
	[C.invalidInput]: { title: t.invalidInput, placement: "inline" },
	[C.invalidOutput]: { title: t.invalidOutput, placement: "banner" },
	[C.forbidden]: { title: t.forbidden, placement: "banner" },
	[C.unavailable]: { title: t.unavailable, placement: "banner" },
	[C.internal]: { title: t.internal, placement: "banner" },
	// Preferences are saved as the person works (the panel layout): a failure is a background notice.
	[C.preferencesNotSaved]: { title: t.preferencesNotSaved, placement: "toast" },
	[C.projectNotOpen]: { title: t.projectNotOpen, placement: "banner" },
	// The changed-on-disk pattern: a non-blocking banner over the view, the working copy kept.
	[C.fileChangedOnDisk]: { title: t.fileChangedOnDisk, placement: "banner" },
	[C.fileOutsideProject]: { title: t.fileOutsideProject, placement: "inline" },
	[C.fileNotFound]: { title: t.fileNotFound, placement: "inline" },
	[C.capabilityUnavailable]: {
		title: t.capabilityUnavailable,
		placement: "banner",
	},
	// The job and session codes answer a press on the job's or session's own control: shown at that control.
	[C.jobNotFound]: { title: t.jobNotFound, placement: "inline" },
	[C.jobNotWaiting]: { title: t.jobNotWaiting, placement: "inline" },
	[C.jobRequestMismatch]: { title: t.jobRequestMismatch, placement: "inline" },
	[C.jobNotCancellable]: { title: t.jobNotCancellable, placement: "inline" },
	[C.sessionNotFound]: { title: t.sessionNotFound, placement: "inline" },
	[C.sessionUnknownKind]: { title: t.sessionUnknownKind, placement: "banner" },
	[C.sessionAlreadyRunning]: {
		title: t.sessionAlreadyRunning,
		placement: "inline",
	},
	[C.sessionFailed]: { title: t.sessionFailed, placement: "banner" },
	[C.streamNotFound]: { title: t.streamNotFound, placement: "inline" },
});

/** The presentation for `code`; a code outside the catalog (a service bug) is presented as an unexpected error. */
export function errorPresentation(code: string): ErrorPresentation {
	return isErrorCode(code)
		? ERROR_PRESENTATIONS[code]
		: ERROR_PRESENTATIONS[ERROR_CODES.internal];
}
