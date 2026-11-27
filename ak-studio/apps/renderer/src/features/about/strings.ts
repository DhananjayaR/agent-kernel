// The About feature's copy, in one place (copy rules: sentence case, OAK's words, one strings module per feature),
// so it is reviewed and later translated together.
export const aboutStrings = {
	title: "About",
	/** Its tab: temporary, removed with the About feature when P2 lands its first real feature. */
	tab: "About",
	intro:
		"A demonstration of the Studio's building blocks: a read, a save that checks for changes made elsewhere, a job that asks before its last step, and a stream of lines. It is here for developers until the first project features land.",
	info: {
		heading: "This app",
		version: "Version",
		platform: "Platform",
		loading: "Reading the app's details",
	},
	note: {
		heading: "Note",
		description:
			"Kept in memory until the app quits. Saving checks that nobody changed the note since you opened it.",
		label: "Note",
		save: "Save note",
		saved: "Saved.",
		/** Writes the note as another window would, so the stale-write banner can be seen. */
		changeElsewhere: "Change it elsewhere",
		changeElsewhereHelp:
			"Writes the note as another window would, so you can see what happens to your unsaved edits.",
		elsewhereText: "Changed in another window.",
		/** The working copy's stand-in for a file: the banner's path chip and the unsaved dialog's file. */
		file: "About note",
		/** What the unsaved changes dialog names. */
		what: "the About note",
		/** The window's unsaved list (main's quit dialog names it). */
		unsavedLabel: "About: note",
		discard: "Discard note changes",
	},
	job: {
		heading: "Jobs",
		description:
			"The demo job runs three steps of about a second, with a line of output each, and asks before the last step.",
		run: "Run the demo job",
		output: "Demo job output",
		result: (steps: number) => `Ran ${steps} steps.`,
	},
	ticker: {
		heading: "Ticker",
		description: "Writes a line a second until you stop it.",
		title: "Demo ticker",
		burst: "Write 10,000 lines at once after the first tick",
		output: "Ticker output",
	},
	commands: {
		runDemoJob: "Run the demo job",
		show: "Open About",
	},
} as const;
