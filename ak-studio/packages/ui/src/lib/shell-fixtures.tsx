// Story fixtures for the desktop shell (not exported): the support-triage example project from the briefs, the
// viewports the gate asks about, and a composed shell whose every slot can be set from a story's args.
import {
	IconAdjustmentsHorizontal,
	IconCode,
	IconFlask,
	IconPackages,
	IconRocket,
} from "@tabler/icons-react";
import { type ReactNode, useState } from "react";
import { expect } from "storybook/test";
import { Badge } from "../components/badge";
import { BottomPanel, type BottomPanelTabId } from "../components/bottom-panel";
import {
	type AppTabId,
	type BottomPanelLayout,
	DesktopShell,
} from "../components/desktop-shell";
import { EmptyState } from "../components/empty-state";
import {
	type ProjectRef,
	ProjectSwitcher,
} from "../components/project-switcher";
import { StatusBar, type StatusBarProps } from "../components/status-bar";
import {
	BuildWithAIButton,
	type DeployState,
	DeployStatus,
	RunControl,
	type RunState,
	SettingsButton,
} from "../components/top-bar-controls";
import { WindowControls } from "../components/window-controls";

/** Storybook viewports for the shell: the gate's two widths, the width the full top bar needs and the window's minimum. */
export const SHELL_VIEWPORTS = {
	studio1440: {
		name: "1440 px",
		styles: { width: "1440px", height: "900px" },
		type: "desktop",
	},
	studio1100: {
		name: "1100 px",
		styles: { width: "1100px", height: "720px" },
		type: "desktop",
	},
	studio1220: {
		name: "1220 px (the full top bar's width)",
		styles: { width: "1220px", height: "720px" },
		type: "desktop",
	},
	studio1000: {
		name: "1000 px (the window's minimum)",
		styles: { width: "1000px", height: "600px" },
		type: "desktop",
	},
} as const;

export type ShellViewport = keyof typeof SHELL_VIEWPORTS;

/** Story parameters and globals that render a story full bleed at one of the shell viewports. */
export function atViewport(viewport: ShellViewport) {
	return {
		parameters: { fullBleed: true, viewport: { options: SHELL_VIEWPORTS } },
		globals: { viewport: { value: viewport, isRotated: false } },
	};
}

export const supportTriage: ProjectRef = {
	name: "support-triage",
	path: "~/code/support-triage",
};

/** The longest name the gate's width check uses (worst case for the top bar). */
export const longProject: ProjectRef = {
	name: "customer-support-triage-with-escalations",
	path: "~/code/clients/acme/customer-support-triage-with-escalations",
};

export const recentProjects: ProjectRef[] = [
	{ name: "billing-assistant", path: "~/code/billing-assistant" },
	{ name: "kb-researcher", path: "~/code/kb-researcher" },
];

/** The status bar for support-triage: a git repository on main, environment ready, agent connected. */
export const supportTriageStatus: StatusBarProps = {
	workingDirectory: "~/code/support-triage",
	gitBranch: "main",
	python: { status: "passed", label: "Python 3.12 (.venv)" },
	fileSync: { status: "passed", label: "Files in sync" },
	codingAgent: { status: "passed", label: "Claude Agent connected" },
	kernelVersion: <span className="mono-figures">OAK 0.10.2</span>,
	appVersion: "0.1.0",
};

const TAB_EMPTY: Record<
	AppTabId,
	{ title: string; description: string; icon: ReactNode }
> = {
	canvas: {
		title: "Canvas",
		description:
			"The project's agents, tools and handoffs as a graph. It arrives in P3, once a project can be opened.",
		icon: <IconPackages aria-hidden="true" />,
	},
	code: {
		title: "Code",
		description:
			"Every file in the project, with a file tree. It arrives in P3, once a project can be opened.",
		icon: <IconCode aria-hidden="true" />,
	},
	config: {
		title: "Config",
		description:
			"Each section of config.yaml as a form. It arrives in P3, once a project can be opened.",
		icon: <IconAdjustmentsHorizontal aria-hidden="true" />,
	},
	"test-trace": {
		title: "Test & trace",
		description:
			"Chat with the running project and follow its trace (P8), then tests and scenarios (P9).",
		icon: <IconFlask aria-hidden="true" />,
	},
	deploy: {
		title: "Deploy",
		description:
			"Deploy the project to a cloud target, review the plan and destroy it again. It arrives in P10.",
		icon: <IconRocket aria-hidden="true" />,
	},
};

export function TabEmptyState({ tab }: { tab: AppTabId }) {
	const { title, description, icon } = TAB_EMPTY[tab];
	return (
		<EmptyState
			title={title}
			description={description}
			icon={icon}
			className="h-full"
		/>
	);
}

const PANEL_EMPTY: Record<
	BottomPanelTabId,
	{ title: string; description: string }
> = {
	problems: {
		title: "No problems",
		description: "Config errors and files the app cannot read show here (P3).",
	},
	"run-log": {
		title: "No run yet",
		description: "The local run's output shows here (P8).",
	},
	commands: {
		title: "No commands yet",
		description: "Every command the app runs shows here (P2).",
	},
};

export function PanelEmptyState({ tab }: { tab: BottomPanelTabId }) {
	const { title, description } = PANEL_EMPTY[tab];
	return (
		<EmptyState
			title={title}
			description={description}
			headingLevel={3}
			className="h-full p-4"
		/>
	);
}

export type FixtureShellProps = {
	/** The open project; `null` for none (as in the app in P1a). */
	project?: ProjectRef | null;
	run?: RunState;
	port?: number;
	deploy?: DeployState;
	deployedAgo?: string;
	/** The selected tab to start on. */
	tab?: AppTabId;
	panelTab?: BottomPanelTabId;
	layout?: BottomPanelLayout;
	status?: StatusBarProps;
	problemCount?: number;
	/** Badges on the app tabs (background job notices). */
	tabBadges?: Partial<Record<AppTabId, ReactNode>>;
	/** Replaces the selected tab's empty state. */
	content?: ReactNode;
	/** Replaces the Problems view's empty state. */
	problems?: ReactNode;
	onLayoutChange?: (layout: BottomPanelLayout) => void;
	onOpenSettings?: () => void;
	settings?: ReactNode;
	/** Shows the window controls (Linux and Windows; the default) with a maximised flag of their own. */
	windowControls?: boolean;
	/** Space (px) at the top bar's left, for the macOS traffic lights. */
	leadingInset?: number;
};

/**
 * The shell with fixture data, keeping its own tab and layout state (as the renderer does, through the bridge).
 * With no project, the run control and deploy status show their not-yet states, as in the app.
 */
export function FixtureShell({
	project = supportTriage,
	run = "stopped",
	port,
	deploy = "not-deployed",
	deployedAgo,
	tab = "canvas",
	panelTab = "problems",
	layout = { open: true, height: 240 },
	status = supportTriageStatus,
	problemCount,
	tabBadges,
	content,
	problems,
	onLayoutChange,
	onOpenSettings,
	settings,
	windowControls = true,
	leadingInset,
}: FixtureShellProps) {
	const [maximized, setMaximized] = useState(false);
	const [selected, setSelected] = useState<AppTabId>(tab);
	const [panel, setPanel] = useState<BottomPanelTabId>(panelTab);
	const [stored, setStored] = useState(layout);
	const remember = (next: BottomPanelLayout) => {
		setStored(next);
		onLayoutChange?.(next);
	};
	return (
		<DesktopShell
			selectedTab={selected}
			onTabChange={setSelected}
			tabBadges={tabBadges}
			leadingInset={leadingInset}
			windowControls={
				windowControls ? (
					<WindowControls
						maximized={maximized}
						onMinimize={() => {}}
						onToggleMaximize={() => setMaximized((was) => !was)}
						onClose={() => {}}
					/>
				) : undefined
			}
			project={
				<ProjectSwitcher
					project={project ?? undefined}
					recent={project ? recentProjects : undefined}
				/>
			}
			actions={
				<>
					{project ? (
						<>
							<RunControl state={run} port={port} onShowLog={() => {}} />
							<DeployStatus state={deploy} deployedAgo={deployedAgo} />
						</>
					) : (
						<>
							<RunControl state="no-project" />
							<DeployStatus state="not-deployed" />
						</>
					)}
					<BuildWithAIButton />
					{settings ?? <SettingsButton onPress={onOpenSettings} />}
				</>
			}
			bottomPanel={
				<BottomPanel
					isOpen={stored.open}
					onOpenChange={(open) => remember({ ...stored, open })}
					selectedTab={panel}
					onTabChange={setPanel}
					problems={problems ?? <PanelEmptyState tab="problems" />}
					runLog={<PanelEmptyState tab="run-log" />}
					commands={<PanelEmptyState tab="commands" />}
					badges={
						problemCount
							? { problems: <Badge>{problemCount}</Badge> }
							: undefined
					}
				/>
			}
			bottomPanelLayout={stored}
			onBottomPanelLayoutChange={remember}
			statusBar={<StatusBar {...status} />}
		>
			{content ?? <TabEmptyState tab={selected} />}
		</DesktopShell>
	);
}

/**
 * Nothing in `root` reaches past its right edge, and the page does not scroll sideways: the layout rule "nothing
 * scrolls the page sideways", checked on every element (an item clipped by `overflow: hidden` counts as a failure
 * too, so the top bar cannot hide a control).
 */
export async function expectNoSidewaysOverflow(
	root: HTMLElement,
	/** Parts allowed to cut their content at the edge (named in the component's own rule). */
	except?: string,
): Promise<void> {
	await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(
		window.innerWidth,
	);
	const edge = root.getBoundingClientRect().right + 0.5;
	const over: string[] = [];
	for (const el of root.querySelectorAll<HTMLElement>("*")) {
		if (el.closest(".sr-only") || el.getClientRects().length === 0) continue;
		if (except && el.closest(except)) continue;
		const right = el.getBoundingClientRect().right;
		if (right > edge)
			over.push(`${el.tagName.toLowerCase()}.${el.className} (${right})`);
	}
	await expect(over, `past the right edge at ${edge}`).toEqual([]);
}
