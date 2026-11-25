// The English defaults of the shared components, in one place (copy rules: sentence case; reviewed and later
// translated in one module). Every one can be overridden where the component is used: StatusChip's `label`,
// Combobox's `emptyText`, and the `strings` prop of PathChip, CodeBlock, Modal, ConfirmModal and ToastRegion.
// Features keep their own copy in their own strings module and pass it in.
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
	modal: {
		close: "Close",
	},
	confirmModal: {
		cancel: "Cancel",
		affects: "This affects",
		/** The typed-name field's label; `{name}` is replaced by the name to type. */
		typeToConfirm: "Type {name} to confirm",
	},
	toast: {
		dismiss: "Dismiss",
	},
} as const;

export type PathChipStrings = {
	-readonly [K in keyof typeof uiStrings.pathChip]: string;
};
export type CodeBlockStrings = {
	-readonly [K in keyof typeof uiStrings.codeBlock]: string;
};
export type ModalStrings = {
	-readonly [K in keyof typeof uiStrings.modal]: string;
};
export type ConfirmModalStrings = {
	-readonly [K in keyof typeof uiStrings.confirmModal]: string;
};
export type ToastStrings = {
	-readonly [K in keyof typeof uiStrings.toast]: string;
};
