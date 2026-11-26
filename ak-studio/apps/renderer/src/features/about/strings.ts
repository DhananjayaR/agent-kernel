// The About feature's copy, in one place (copy rules: sentence case, OAK's words, one strings module per feature),
// so it is reviewed and later translated together.
export const aboutStrings = {
	title: "About",
	empty: {
		description:
			"The app's version and platform, and a check of each way the app works with its services: a note to save, a demo job that asks before its last step, and a ticker. It is here for developers until the first project features land.",
	},
	commands: {
		runDemoJob: "Run the demo job",
		show: "Open About",
	},
} as const;
