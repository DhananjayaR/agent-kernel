// The shell's own copy in the app (copy rules: sentence case, final copy, one module). The design system's
// defaults (control labels) are in @ak-studio/ui's strings, and each tab's label and empty state are its feature's
// (features/<id>/strings.ts); this module holds what only the shell says: each bottom panel view's empty state,
// naming the phase that fills it (P4-P12.md, P2.md, P3.md), the shell's errors and its app commands' titles.
import type { BottomPanelTabId } from "@ak-studio/ui";

export type EmptyCopy = { title: string; description: string };

/** Each bottom panel view's empty state. */
export const panelEmptyStates: Record<BottomPanelTabId, EmptyCopy> = {
	problems: {
		title: "No problems",
		description:
			"Config errors and files the app cannot read are listed here, from P3.",
	},
	"run-log": {
		title: "No run yet",
		description: "The local run's output streams here, from P8.",
	},
	commands: {
		title: "No commands yet",
		description:
			"Every command the app runs on your computer is listed here with its output, from P2.",
	},
};

export const shellStrings = {
	buildWithAI: {
		title: "Build with AI",
		description:
			"Claude Agent will build on your project from a drawer beside every tab, and you review each change. It arrives in P6, once a project can be opened.",
	},
	layoutNotSaved: {
		title: "The panel layout could not be saved",
		description: "The app opens with the previous layout next time.",
	},
	/** The status bar's coding agent item until P6 connects one. */
	codingAgentNotSetUp: {
		status: "not-set-up",
		label: "Claude Agent not set up",
	},
	themeNotSaved:
		"Try again. If it keeps failing, check that the app's data folder can be written to.",
	bridgeError: "Restart the app. If it keeps happening, reinstall OAK Studio.",
	/** The shell's app commands, as the command palette and menus name them. */
	commands: {
		toggleBottomPanel: "Show or hide the panel",
		showCommands: "Show commands",
	},
} as const;
