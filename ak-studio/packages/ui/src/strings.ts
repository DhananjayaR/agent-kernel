// The English defaults of the shared components, in one place (copy rules: sentence case; reviewed and later
// translated in one module). Every one can be overridden where the component is used: StatusChip's `label`,
// Combobox's `emptyText`, BuildWithAIButton's and SettingsButton's `label`, and the `strings` prop of PathChip,
// CodeBlock, Modal, ConfirmModal, ToastRegion, ApprovalCard, JobProgressView, the background job notice,
// StreamingListView, CommandRow, SessionControlView, CommandPaletteView, StateMessage, ChangedOnDiskBanner,
// UnsavedChangesDialog, VersionNotice and the shell (DesktopShell, ProjectSwitcher, RunControl, DeployStatus,
// BottomPanel, StatusBar, SettingsModal, WindowControls). Placeholders such as `{port}` are filled by `fillString`.
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
		/** The chip's text for assistive technology when it names a line. */
		atLine: "{path}, line {line}",
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
	// The approval pattern (approval.tsx, ConfirmModal): the card's frame, its outcome and the default answers.
	approval: {
		required: "Approval required",
		approve: "Approve",
		deny: "Deny",
		approved: "Approved by you",
		denied: "Denied",
		/** The answered card's accessible name: `{outcome}` is approved or denied, `{title}` the question. */
		outcomeName: "{outcome}: {title}",
	},
	// The job progress pattern (job-progress.tsx). `{step}`, `{steps}` and `{label}` fill the step line.
	jobProgress: {
		queued: "Queued",
		running: "Running",
		waiting: "Waiting for you",
		succeeded: "Done",
		failed: "Failed",
		cancelled: "Stopped",
		step: "Step {step} of {steps} · {label}",
		elapsed: "Elapsed time",
		stop: "Stop",
		showCommands: "Show commands",
		cancelledResult: "Stopped before it finished.",
		/** Announced when a job succeeds with a one-line result. */
		succeededWith: "Done. {result}",
	},
	// The background job notice (background-job-notice.tsx): the tab icon's names and the one toast template.
	// `{job}` is the job's title ("Apply").
	backgroundJob: {
		waitingIcon: "Needs your answer",
		finishedIcon: "Finished",
		failedIcon: "Failed",
		finished: "{job} finished",
		failed: "{job} failed",
		waiting: "{job} is waiting for you",
		show: "Show",
	},
	// The streaming list (streaming-list.tsx). `{count}` is a number of lines.
	streamingList: {
		copy: "Copy",
		copied: "Output copied",
		clear: "Clear",
		jumpToLatest: "Jump to latest",
		empty: "No output yet",
		dropped: "{count} earlier lines not kept",
		droppedOne: "1 earlier line not kept",
	},
	// The command row (command-row.tsx): a command the app ran. `{code}` is its exit code.
	commandRow: {
		running: "Running",
		exited: "Exit {code}",
		signalled: "Ended by a signal",
		/** Ended, with no exit code on the record. */
		ended: "Ended",
		stopped: "Stopped",
		duration: "Took",
		/** Read before the time so far while it runs. */
		runningFor: "Running for",
	},
	// The generic session control (session-control.tsx).
	sessionControl: {
		stopped: "Stopped",
		starting: "Starting",
		running: "Running",
		stopping: "Stopping",
		failed: "Failed",
		start: "Start",
		stop: "Stop",
		showLog: "Show log",
	},
	// The command palette (command-palette.tsx).
	commandPalette: {
		title: "Command palette",
		search: "Search commands",
		placeholder: "Type a command",
		commands: "Commands",
		noMatches: "No matching commands",
		/** Said once typing pauses: how many commands match. `{count}` is the number. */
		matches: "{count} commands",
		matchesOne: "1 command",
	},
	// The empty, cannot-read and error family (state-message.tsx): the slots' own words.
	stateMessage: {
		/** The disclosure that shows the raw output (masked), collapsed by default. */
		details: "Details",
		/** The detail's caption: the raw output, with secrets already hidden by the service. */
		output: "Raw output",
	},
	// The changed-on-disk banner (changed-on-disk-banner.tsx). Views may say what changed in their own words
	// ("The canvas was updated.").
	changedOnDisk: {
		updatedTitle: "File changed on disk",
		updated: "This view now shows the file as it is on disk.",
		conflictTitle: "File changed on disk while you were editing",
		conflict:
			"Your changes are kept here, not saved. Keep yours to save them over the file, or take the file as it is on disk.",
		keepMine: "Keep mine",
		takeTheirs: "Take theirs",
		compare: "Compare",
		dismiss: "Dismiss",
	},
	// The unsaved changes guard (unsaved-changes-dialog.tsx), for leaving a view in the app. `{what}` names what is
	// unsaved, as the view words it ("config.yaml", "the session section").
	unsavedChanges: {
		title: "Unsaved changes in {what}",
		body: "Save them before you leave, or discard them.",
		save: "Save",
		discard: "Discard changes",
		stay: "Stay",
	},
	// The version gate (version-notice.tsx). `{feature}` is the capability's title, `{since}` the first OAK version
	// with it, `{until}` the first without it, `{version}` the project's.
	versionNotice: {
		needsUpgrade: "{feature} needs OAK {since} or later",
		removed: "{feature} was removed in OAK {until}",
		removedUnknown: "{feature} was removed from OAK",
		projectVersion: "This project uses OAK {version}.",
		upgrade: "Upgrade OAK in this project to use it.",
		readOnly: "The fields below are read-only until then.",
		readOnlyRemoved: "The fields below are read-only.",
		/** A removed capability with nothing named to replace it: what to do. */
		removedNext: "Check the OAK release notes for what replaces it.",
		replacedBy: "Use {replacement} instead.",
		command: "Upgrade command",
		commandHint:
			"Run it in a terminal in the project's folder. The Studio does not run it for you.",
		docs: "Open the docs",
		tag: "Needs {since}",
		tagRemoved: "Removed in {until}",
		tagRemovedUnknown: "Removed",
	},
	// The desktop shell (Task 10). The app areas are fixed; their empty states are the app's own copy.
	shell: {
		/** The OAK mark's accessible name, at the start of the top bar. */
		appName: "OAK Studio",
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
		noProject: "No project to run",
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
		/** The app's show/hide shortcut as shown (Mod+J: Ctrl+J, or ⌘J on macOS); the app passes its own. */
		shortcut: "Ctrl+J",
	},
	windowControls: {
		group: "Window controls",
		minimise: "Minimise",
		maximise: "Maximise",
		/** The maximise button's name while the window is maximised. */
		restore: "Restore",
		close: "Close",
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
export type ApprovalStrings = {
	-readonly [K in keyof typeof uiStrings.approval]: string;
};
export type JobProgressStrings = {
	-readonly [K in keyof typeof uiStrings.jobProgress]: string;
};
export type BackgroundJobStrings = {
	-readonly [K in keyof typeof uiStrings.backgroundJob]: string;
};
export type StreamingListStrings = {
	-readonly [K in keyof typeof uiStrings.streamingList]: string;
};
export type CommandRowStrings = {
	-readonly [K in keyof typeof uiStrings.commandRow]: string;
};
export type SessionControlStrings = {
	-readonly [K in keyof typeof uiStrings.sessionControl]: string;
};
export type CommandPaletteStrings = {
	-readonly [K in keyof typeof uiStrings.commandPalette]: string;
};
export type StateMessageStrings = {
	-readonly [K in keyof typeof uiStrings.stateMessage]: string;
};
export type ChangedOnDiskStrings = {
	-readonly [K in keyof typeof uiStrings.changedOnDisk]: string;
};
export type UnsavedChangesStrings = {
	-readonly [K in keyof typeof uiStrings.unsavedChanges]: string;
};
export type VersionNoticeStrings = {
	-readonly [K in keyof typeof uiStrings.versionNotice]: string;
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
export type WindowControlsStrings = {
	-readonly [K in keyof typeof uiStrings.windowControls]: string;
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
