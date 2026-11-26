// The copy for errors in the renderer, in one place (copy rules: sentence case, OAK's words, say what happened).
// The titles are what an error view shows above a StudioError's own message; the presentation map pairs each
// catalog code with its title and placement.
export const errorStrings = {
	/** The message of a failure that reached a hook as something other than a StudioFailure. */
	unexpectedFailure: "The app could not complete this action.",
	titles: {
		unknownOperation: "This version of the app does not have this action",
		invalidInput: "The value was not accepted",
		invalidOutput: "The app could not read the answer it got",
		forbidden: "The request did not come from the app's window",
		unavailable: "The app's bridge did not answer",
		internal: "An unexpected error stopped this action",
		preferencesNotSaved: "Your preferences could not be saved",
		projectNotOpen: "No project is open",
		fileChangedOnDisk: "The file changed on disk",
		fileOutsideProject: "The path is outside the project folder",
		fileNotFound: "The file is not in the project folder",
		capabilityUnavailable: "This project's OAK version does not support this",
		jobNotFound: "The job no longer exists",
		jobNotWaiting: "The job is no longer waiting for an answer",
		jobRequestMismatch: "The job is now asking something else",
		jobNotCancellable: "This job cannot be cancelled",
		sessionNotFound: "The session no longer exists",
		sessionUnknownKind: "The app cannot start this kind of session",
		sessionAlreadyRunning: "This is already running for the project",
		sessionFailed: "The session could not start, or stopped by itself",
		streamNotFound: "The output is no longer available",
	},
} as const;
