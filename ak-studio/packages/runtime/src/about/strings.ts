// The About service's copy, in one place (the copy rules: sentence case, OAK's words, what happened and then what
// to do): the demo job's steps and its question, and the note's stale-write error. Kept beside the service so the
// throwaway About slice leaves with one folder when P2 lands.

export const aboutStrings = {
	steps: ["Checking the app", "Preparing the demo", "Finishing the demo"],
	/** One line of the job's output per step. */
	stepLine: (step: number, steps: number, label: string) =>
		`Step ${step} of ${steps}: ${label}`,
	confirm: {
		title: "Run the last step?",
		summary:
			"The demo job has run two of its three steps. Run the last one, or stop the job here. Nothing outside the app changes.",
		/** The buttons say what happens (copy rules). */
		approveLabel: "Run the last step",
		denyLabel: "Stop the job",
	},
	noteChanged:
		"The note changed since you opened it. Your text is kept: compare it with the new note and save again.",
	tickLine: (tick: number) => `Tick ${tick}`,
	burstLine: (line: number, lines: number) => `Burst line ${line} of ${lines}`,
} as const;
