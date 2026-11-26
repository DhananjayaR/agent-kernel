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
} as const;
