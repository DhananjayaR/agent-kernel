// The shared patterns' own copy (copy rules: sentence case, say what happened, then what to do), in one place.
// `{command}` is an app command's title.
export const patternStrings = {
	/** A version-gated command run anyway (its shortcut): the toast's title; its description is the gate's reason. */
	commandUnavailable: "{command} is not available",
	/** The clipboard refused a streaming list's Copy. */
	copyFailed: {
		title: "The output could not be copied",
		description:
			"Select the lines in the list and copy them with the keyboard instead.",
	},
	/** A save from the unsaved changes dialog found the file changed on disk: its description (what to do). */
	saveConflict:
		"The file behind {what} changed while you were editing. Stay to keep yours or take theirs, or discard your changes.",
	/** Several unsaved views named together in one dialog: "{first} and {last}", the rest joined with ", ". */
	unsavedJoin: "{first} and {last}",
	unsavedJoinComma: ", ",
	/** The clipboard refused a version gate's Copy. */
	copyCommandFailed: {
		title: "The upgrade command could not be copied",
		description: "Select the command and copy it with the keyboard instead.",
	},
} as const;
