// The English defaults of the shared components, in one place (copy rules: sentence case; reviewed and later
// translated in one module). Every one can be overridden where the component is used: StatusChip's `label`,
// Combobox's `emptyText`, and the `strings` prop of PathChip and CodeBlock. Features keep their own copy in their
// own strings module and pass it in.
export const uiStrings = {
	status: {
		passed: "Passed",
		running: "Running",
		waiting: "Waiting",
		failed: "Failed",
		"not-set-up": "Not set up",
	},
	combobox: {
		noMatches: "No matches",
	},
	pathChip: {
		reveal: "Reveal in file manager",
		copy: "Copy path",
		copied: "Path copied",
	},
	codeBlock: {
		copy: "Copy code",
		copied: "Code copied",
	},
} as const;

export type PathChipStrings = {
	-readonly [K in keyof typeof uiStrings.pathChip]: string;
};
export type CodeBlockStrings = {
	-readonly [K in keyof typeof uiStrings.codeBlock]: string;
};
