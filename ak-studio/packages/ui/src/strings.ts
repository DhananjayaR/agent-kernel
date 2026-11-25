// The English defaults of the shared components, in one place (copy rules: sentence case; reviewed and later
// translated in one module). Every one can be overridden where the component is used: StatusChip's `label`,
// Combobox's `emptyText`, BuildWithAIButton's and SettingsButton's `label`, and the `strings` prop of PathChip,
// CodeBlock, Modal, ConfirmModal, ToastRegion and the shell (DesktopShell, ProjectSwitcher, RunControl,
// DeployStatus, BottomPanel, StatusBar, SettingsModal). Placeholders such as `{port}` are filled by `fillString`.
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
	// The desktop shell (Task 10). The app areas are fixed; their empty states are the app's own copy.
	shell: {
		tabsLabel: "Project views",
		canvas: "Canvas",
		code: "Code",
		config: "Config",
		testTrace: "Test & trace",
		deploy: "Deploy",
	},
	projectSwitcher: {
		noProject: "No project open",
		openFolder: "Open folder…",
		newProject: "New project…",
		recent: "Recent projects",
		reveal: "Reveal in file manager",
	},
	runControl: {
		group: "Local run",
		stopped: "Stopped",
		starting: "Starting",
		running: "Running",
		/** `{port}` is replaced by the port number. */
		runningOnPort: "Running on port {port}",
		failed: "Run failed",
		start: "Start the local run",
		stop: "Stop the local run",
		showLog: "Show the run log",
	},
	deployStatus: {
		group: "Deployment",
		notDeployed: "Not deployed",
		deployed: "Deployed",
		/** `{ago}` is replaced by a relative time ("2 h ago"). */
		deployedAgo: "Deployed {ago}",
		applying: "Applying",
		failed: "Deploy failed",
	},
	buildWithAI: {
		label: "Build with AI",
	},
	settings: {
		open: "Settings",
		title: "Settings",
		theme: "Theme",
		themeHelp: "System follows your computer's light or dark setting.",
		system: "System",
		dark: "Dark",
		light: "Light",
	},
	bottomPanel: {
		label: "Panel",
		tabsLabel: "Panel views",
		problems: "Problems",
		runLog: "Run log",
		commands: "Commands",
		hide: "Hide the panel",
		show: "Show the panel",
		resize: "Resize the panel",
		/** The shortcut that shows or hides the panel, as shown (Mod+J: Ctrl+J, or Cmd+J on macOS). */
		shortcut: "Ctrl+J",
	},
	statusBar: {
		gitBranch: "Git branch",
		/** Shown before the Studio's own version number. */
		appName: "Studio",
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
export type ShellStrings = {
	-readonly [K in keyof typeof uiStrings.shell]: string;
};
export type ProjectSwitcherStrings = {
	-readonly [K in keyof typeof uiStrings.projectSwitcher]: string;
};
export type RunControlStrings = {
	-readonly [K in keyof typeof uiStrings.runControl]: string;
};
export type DeployStatusStrings = {
	-readonly [K in keyof typeof uiStrings.deployStatus]: string;
};
export type SettingsStrings = {
	-readonly [K in keyof typeof uiStrings.settings]: string;
};
export type BottomPanelStrings = {
	-readonly [K in keyof typeof uiStrings.bottomPanel]: string;
};
export type StatusBarStrings = {
	-readonly [K in keyof typeof uiStrings.statusBar]: string;
};

/** Replaces `{name}` placeholders in a string from this module. */
export function fillString(
	template: string,
	values: Readonly<Record<string, string | number>>,
): string {
	return template.replace(/\{(\w+)\}/g, (whole, key: string) =>
		key in values ? String(values[key]) : whole,
	);
}
