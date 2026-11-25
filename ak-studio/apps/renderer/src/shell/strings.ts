// The shell's own copy in the app (copy rules: sentence case, final copy, one module). The design system's
// defaults (tab names, control labels) are in @ak-studio/ui's strings; this module holds what only the app
// says: each area's empty state, naming the phase that fills it (later-phases.md, P2.md, P3.md), and the shell's
// errors.
import type { AppTabId, BottomPanelTabId } from "@ak-studio/ui";

export type EmptyCopy = { title: string; description: string };

/** Each app tab's empty state while no project can be opened (P1a). */
export const tabEmptyStates: Record<AppTabId, EmptyCopy> = {
	canvas: {
		title: "Canvas",
		description:
			"Your project's agents, tools and handoffs as a graph you can select and inspect. It arrives in P3, once a project can be opened (P2).",
	},
	code: {
		title: "Code",
		description:
			"Every file in your project, with a file tree and a viewer. It arrives in P3, once a project can be opened (P2).",
	},
	config: {
		title: "Config",
		description:
			"Each section of config.yaml as a form, from your OAK version's schema. It arrives in P3; editing comes in P4.",
	},
	"test-trace": {
		title: "Test & trace",
		description:
			"Chat with the running project and follow each run's trace (P8), then tests, scenarios and run history (P9).",
	},
	deploy: {
		title: "Deploy",
		description:
			"Deploy your project to a cloud target: prerequisites, variables, the plan, then its outputs. It arrives in P10.",
	},
};

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
	/** The bottom panel shortcut as shown on macOS (Ctrl+J elsewhere, the design system's default). */
	macShortcut: "⌘J",
} as const;
