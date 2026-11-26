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
} as const;
