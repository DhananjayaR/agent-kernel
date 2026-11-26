// The Deploy feature's copy (copy rules: sentence case, final copy, one strings module per feature): its tab's
// label and, until its phase fills it, its empty state, naming that phase.
export const deployStrings = {
	tab: "Deploy",
	empty: {
		title: "Deploy",
		description:
			"Deploy your project to a cloud target: prerequisites, variables, the plan, then its outputs. It arrives in P10.",
	},
} as const;
