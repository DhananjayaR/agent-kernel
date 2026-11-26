// The runtime's user-facing copy, in one place (the copy rules: sentence case, OAK's words, what happened and
// then what to do). Error messages here reach the renderer inside StudioError values.

export const strings = {
	appStarting: "The app is still starting.",
	capabilityNeedsUpgrade:
		"Your project's OAK version does not support this yet. Upgrade OAK to use it.",
	capabilityRemoved:
		"Your project's OAK version no longer supports this. Use the replacement your OAK version offers.",
	projectNotOpen: "This project is not open. Open it and try again.",
	streamNotFound:
		"This output is no longer available. Run the task again to see new output.",
	fileOutsideProject:
		"This path is outside the project folder. Choose a file inside the project.",
	fileNotFound:
		"This file is not in the project folder. Check the name, or create the file first.",
	fileChangedOnDisk:
		"This file changed on disk since you opened it. Reload it, or keep your version and save again.",
	jobNotFound:
		"This job is no longer in the list. Start it again if you still need it.",
	jobNotWaiting:
		"This job is not waiting for an answer now. Check where the job is up to.",
	jobRequestMismatch:
		"This answer is for a question the job is no longer asking. Answer its current question.",
	jobNotCancellable:
		"This job cannot be cancelled safely. Wait for it to finish.",
	confirmApprove: "Approve",
	confirmDeny: "Deny",
	jobAnswerInvalid:
		"This answer does not fit the question. Choose one of its options, or type the exact name it asks for.",
	jobInvalidResult:
		"The job finished, but its result is not what the app expects. Run it again, and report it if it keeps happening.",
	sessionNotFound:
		"This session is no longer in the list. Start it again if you still need it.",
	sessionUnknownKind:
		"This version of the app cannot start this kind of session. Check the name, or update the app.",
	sessionAlreadyRunning:
		"This is already running for this project. Use the one that is running, or stop it first.",
	sessionFailed:
		"This session stopped unexpectedly. Check its output, then start it again.",
	sessionInvalidInfo:
		"The session started, but reported details the app does not expect. It was stopped; report it if it keeps happening.",
} as const;
