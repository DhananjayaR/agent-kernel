// The Config feature's copy (copy rules: sentence case, final copy, one strings module per feature): its tab's
// label and, until its phase fills it, its empty state, naming that phase.
export const configStrings = {
	tab: "Config",
	empty: {
		title: "Config",
		description:
			"Each section of config.yaml as a form, from your OAK version's schema. It arrives in P3; editing comes in P4.",
	},
} as const;
