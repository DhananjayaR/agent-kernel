import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import {
	expect,
	fireEvent,
	fn,
	userEvent,
	waitFor,
	within,
} from "storybook/test";
import {
	atViewport,
	expectNoSidewaysOverflow,
	FixtureShell,
	longProject,
	supportTriageStatus,
	TabEmptyState,
} from "../lib/shell-fixtures";
import {
	expectFocusRing,
	expectHeight,
	expectTokenColour,
	tabTo,
} from "../lib/story-checks";
import { Badge } from "./badge";
import { type AppTabId, AppTabList, isAppTabId, TopBar } from "./desktop-shell";
import { ProjectSwitcher } from "./project-switcher";
import { StatusBar } from "./status-bar";
import { TabPanel, Tabs } from "./tabs";
import {
	BuildWithAIButton,
	DeployStatus,
	RunControl,
	SettingsButton,
} from "./top-bar-controls";

const onLayoutChange = fn();

const meta = {
	title: "Shell/Desktop shell",
	component: FixtureShell,
	args: { onLayoutChange },
	beforeEach: () => {
		onLayoutChange.mockClear();
	},
	...atViewport("studio1440"),
} satisfies Meta<typeof FixtureShell>;

export default meta;
type Story = StoryObj<typeof meta>;

const shell = (canvasElement: HTMLElement) =>
	canvasElement.querySelector('[data-slot="desktop-shell"]') as HTMLElement;
const topBar = (canvasElement: HTMLElement) =>
	canvasElement.querySelector('[data-slot="top-bar"]') as HTMLElement;
const bottomPanel = (canvasElement: HTMLElement) =>
	canvasElement.querySelector('[data-panel][id="bottom-panel"]') as HTMLElement;

/** Within a pixel: panel sizes go through the library's percentages. */
async function expectHeightNear(el: Element, px: number) {
	await expect(
		Math.abs(el.getBoundingClientRect().height - px),
	).toBeLessThanOrEqual(1);
}

/**
 * Every control of the top bar is inside it, with nothing past its end. `except` names parts allowed to cut their
 * content (the status bar's end below 1100 px).
 */
async function expectTopBarHolds(canvasElement: HTMLElement, except?: string) {
	// Measured with the bundled fonts, not a fallback face.
	await document.fonts.ready;
	const bar = topBar(canvasElement);
	await expectHeight(bar, 48);
	const box = bar.getBoundingClientRect();
	const canvas = within(bar);
	const parts = [
		canvas.getByRole("tablist", { name: "Project views" }),
		...canvas.getAllByRole("tab"),
	];
	for (const part of parts) {
		const r = part.getBoundingClientRect();
		await expect(r.left).toBeGreaterThanOrEqual(box.left);
		await expect(r.right).toBeLessThanOrEqual(box.right);
	}
	// The OAK mark comes first, before the project switcher: 20 px, named, and loaded.
	const mark = canvas.getByRole("img", {
		name: "OAK Studio",
	}) as HTMLImageElement;
	await expect(mark.getBoundingClientRect().width).toBe(20);
	await expect(mark.getBoundingClientRect().height).toBe(20);
	await waitFor(() => expect(mark.naturalWidth).toBeGreaterThan(0));
	const switcher = bar.querySelector('[data-slot="project-switcher"]');
	await expect(
		switcher &&
			mark.compareDocumentPosition(switcher) & Node.DOCUMENT_POSITION_FOLLOWING,
	).toBeTruthy();
	// Nothing overflows the bar and its last control is whole and inside it. No exact padding is asserted: font
	// metrics can differ by a pixel or two between systems.
	await expect(bar.scrollWidth).toBeLessThanOrEqual(bar.clientWidth);
	const buttons = bar.querySelectorAll("button");
	const last = buttons[buttons.length - 1] as HTMLElement;
	const r = last.getBoundingClientRect();
	await expect(r.width).toBeGreaterThan(0);
	await expect(r.left).toBeGreaterThanOrEqual(box.left);
	await expect(r.right).toBeLessThanOrEqual(box.right);
	await expect(last.scrollWidth).toBeLessThanOrEqual(last.clientWidth);
	await expectNoSidewaysOverflow(shell(canvasElement), except);
}

/**
 * The shell at 1440 px, comfortable: support-triage open, the local run on port 8000, deployed two hours ago, the
 * coding agent connected; the bottom panel open on Problems with two problems. Top bar, tabs, panel and status bar
 * in one window with nothing scrolling sideways.
 */
export const At1440: Story = {
	args: {
		run: "running",
		port: 8000,
		deploy: "deployed",
		deployedAgo: "2 h ago",
		problemCount: 2,
	},
	play: async ({ canvasElement }) => {
		await expect(window.innerWidth).toBe(1440);
		await expect(topBar(canvasElement)).not.toHaveAttribute("data-compact");
		await expectTopBarHolds(canvasElement);
		const canvas = within(canvasElement);
		await expect(
			canvas.getByRole("tab", { name: "Canvas", selected: true }),
		).toBeVisible();
		await expect(canvas.getByText("Running on port 8000")).toBeVisible();
		await expect(canvas.getByText("Deployed 2 h ago")).toBeVisible();
		await expect(
			canvas.getByRole("button", { name: "Build with AI" }),
		).toHaveTextContent("Build with AI");
		// Landmarks: the top bar, the tab content and the status bar.
		await expect(canvas.getByRole("banner")).toBe(topBar(canvasElement));
		await expect(canvas.getByRole("main")).toBeVisible();
		await expect(canvas.getByRole("contentinfo")).toBeVisible();
		await expect(canvas.getByRole("region", { name: "Panel" })).toBeVisible();
		await expectHeight(bottomPanel(canvasElement), 240);
		await expectHeight(canvas.getByRole("contentinfo"), 32);
	},
};

/**
 * The full top bar's width, 1220 px, with the worst case it must hold, the window controls included: a 40-character
 * project name, "Running on port 8000" and "Deployed 3 days ago". The five tabs and every control keep their full
 * labels; the project name gives way first (cut with an ellipsis; the full name and path are in its tooltip and
 * menu).
 */
export const At1220: Story = {
	...atViewport("studio1220"),
	args: {
		project: longProject,
		run: "running",
		port: 8000,
		deploy: "deployed",
		deployedAgo: "3 days ago",
		problemCount: 2,
	},
	play: async ({ canvasElement }) => {
		await expect(window.innerWidth).toBe(1220);
		await document.fonts.ready;
		await expect(topBar(canvasElement)).not.toHaveAttribute("data-compact");
		await expectTopBarHolds(canvasElement);
		const canvas = within(canvasElement);
		await expect(canvas.getByText("Running on port 8000")).toBeVisible();
		await expect(canvas.getByText("Deployed 3 days ago")).toBeVisible();
		await expect(
			canvas.getByRole("button", { name: "Build with AI" }),
		).toHaveTextContent("Build with AI");
		// The project name is the part that gives way: cut, never wrapped, at least 96 px wide.
		const name = canvasElement.querySelector(
			'[data-slot="project-switcher"] span.truncate',
		) as HTMLElement;
		await expect(name.scrollWidth).toBeGreaterThan(name.clientWidth);
		const switcher = canvasElement.querySelector(
			'[data-slot="project-switcher"]',
		) as HTMLElement;
		await expect(switcher.getBoundingClientRect().width).toBeGreaterThanOrEqual(
			96,
		);
	},
};

/**
 * The page's floor, 1100 px: the window controls take 120 px, so the full form no longer fits here and the top bar
 * is compact (the rule is below 1220 px). Everything is still whole and inside the bar.
 */
export const At1100: Story = {
	...atViewport("studio1100"),
	args: {
		project: longProject,
		run: "running",
		port: 8000,
		deploy: "deployed",
		deployedAgo: "3 days ago",
		problemCount: 2,
	},
	play: async ({ canvasElement }) => {
		await expect(window.innerWidth).toBe(1100);
		await expect(topBar(canvasElement)).toHaveAttribute("data-compact");
		await expectTopBarHolds(canvasElement);
		const canvas = within(canvasElement);
		await expect(canvas.getByText("Running")).toBeVisible();
		await expect(
			canvas.getByRole("button", { name: "Maximise" }),
		).toBeVisible();
	},
};

/**
 * The overflow rule below 1220 px (the window allows 1000 px): the top bar turns compact. Build with AI keeps its
 * sparkle and name (in a tooltip and for assistive technology), the run control drops the port and the deploy
 * status its time. Still one row, still nothing past the edge, at the app's real state too (no project open).
 */
export const At1000Compact: Story = {
	...atViewport("studio1000"),
	args: {
		project: longProject,
		run: "running",
		port: 8000,
		deploy: "deployed",
		deployedAgo: "3 days ago",
		problemCount: 2,
	},
	play: async ({ canvasElement }) => {
		await expect(window.innerWidth).toBe(1000);
		await expect(topBar(canvasElement)).toHaveAttribute("data-compact");
		// The status bar's end may cut its last items at this width (its rule, settled at P2's gate).
		await expectTopBarHolds(canvasElement, '[data-slot="status-bar-end"]');
		const canvas = within(canvasElement);
		await expect(canvas.getByText("Running")).toBeVisible();
		await expect(canvas.getByText("Deployed")).toBeVisible();
		const ai = canvas.getByRole("button", { name: "Build with AI" });
		await expect(ai.getBoundingClientRect().width).toBe(32);
		// The status bar's two ends never overlap; the path keeps at least 128 px.
		const start = canvasElement.querySelector(
			'[data-slot="status-bar-start"]',
		) as HTMLElement;
		const end = canvasElement.querySelector(
			'[data-slot="status-bar-end"]',
		) as HTMLElement;
		await expect(start.getBoundingClientRect().right).toBeLessThanOrEqual(
			end.getBoundingClientRect().left,
		);
		await expect(start.getBoundingClientRect().width).toBeGreaterThanOrEqual(
			128,
		);
	},
};

/** The app's own state (no project open) at the window's minimum: compact, and everything whole inside the bar. */
export const At1000NoProject: Story = {
	...atViewport("studio1000"),
	args: { project: null },
	play: async ({ canvasElement }) => {
		await expect(window.innerWidth).toBe(1000);
		await expect(topBar(canvasElement)).toHaveAttribute("data-compact");
		await expectTopBarHolds(canvasElement, '[data-slot="status-bar-end"]');
		await expect(
			within(canvasElement).getByRole("button", { name: "Close" }),
		).toBeVisible();
	},
};

/**
 * The shell as the app shows it in P1a: no project can be opened yet, so the project switcher says so, the run
 * control says there is no project to run (no start control), the deploy status "Not deployed", and the status
 * bar the coding agent not set up and the Studio's version. Each tab shows its empty state, naming the phase that
 * fills it.
 */
export const NoProject: Story = {
	...atViewport("studio1220"),
	args: {
		project: null,
		status: {
			codingAgent: { status: "not-set-up", label: "Claude Agent not set up" },
			appVersion: "0.1.0",
		},
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText("No project open")).toBeVisible();
		const run = canvas.getByRole("group", { name: "Local run" });
		await expect(run).toHaveTextContent("No project to run");
		await expect(within(run).queryByRole("button")).toBeNull();
		await expect(
			canvasElement.querySelector('[data-slot="deploy-status"]'),
		).toHaveTextContent("Deployment: Not deployed");
		const status = canvas.getByRole("contentinfo");
		await expect(status).toHaveTextContent("Claude Agent not set up");
		await expect(status).toHaveTextContent("Studio 0.1.0");
		await expect(
			canvas.getByRole("heading", { name: "Canvas", level: 2 }),
		).toBeVisible();
		await expect(canvas.getByText(/arrives in P3/)).toBeVisible();
		await expect(topBar(canvasElement)).not.toHaveAttribute("data-compact");
		await expectTopBarHolds(canvasElement);
	},
};

/**
 * Badges on the tabs (background job notices) at 1220 px with the worst case: the full form no longer fits, so
 * the top bar turns compact rather than pushing a control past the edge.
 */
export const At1220WithBadges: Story = {
	...atViewport("studio1220"),
	args: {
		project: longProject,
		run: "running",
		port: 8000,
		deploy: "deployed",
		deployedAgo: "3 days ago",
		tabBadges: {
			"test-trace": <Badge>2</Badge>,
			deploy: <Badge>1</Badge>,
		},
	},
	play: async ({ canvasElement }) => {
		await expect(window.innerWidth).toBe(1220);
		await waitFor(() =>
			expect(topBar(canvasElement)).toHaveAttribute("data-compact"),
		);
		await expectTopBarHolds(canvasElement);
		await expect(
			within(canvasElement).getByRole("tab", { name: /Deploy/ }),
		).toHaveTextContent("Deploy1");
	},
};

/** The worst case at 1220 px, with badges that the story adds and removes (a hidden control, pressed by the test). */
function BadgesComeAndGoShell() {
	const [badges, setBadges] = useState(false);
	return (
		<>
			<FixtureShell
				project={longProject}
				run="running"
				port={8000}
				deploy="deployed"
				deployedAgo="3 days ago"
				tabBadges={
					badges
						? { "test-trace": <Badge>2</Badge>, deploy: <Badge>1</Badge> }
						: undefined
				}
			/>
			<button
				type="button"
				tabIndex={-1}
				className="sr-only"
				onClick={() => setBadges((on) => !on)}
			>
				Toggle badges
			</button>
		</>
	);
}

/**
 * Changing form keeps focus, and a transient overflow does not stick: with focus on Build with AI, badges appear
 * (the bar turns compact; the same button keeps focus), then go (the full form comes back at the same width; focus
 * still there).
 */
export const BadgesComeAndGo: Story = {
	...atViewport("studio1220"),
	render: () => <BadgesComeAndGoShell />,
	play: async ({ canvasElement }) => {
		const bar = topBar(canvasElement);
		const toggle = within(canvasElement).getByRole("button", {
			name: "Toggle badges",
			hidden: true,
		});
		const ai = within(bar).getByRole("button", { name: "Build with AI" });
		await expect(bar).not.toHaveAttribute("data-compact");
		ai.focus();
		await expect(ai).toHaveFocus();
		fireEvent.click(toggle);
		await waitFor(() => expect(bar).toHaveAttribute("data-compact"));
		await expect(ai.isConnected).toBe(true);
		await expect(ai).toHaveFocus();
		await expectTopBarHolds(canvasElement);
		fireEvent.click(toggle);
		await waitFor(() => expect(bar).not.toHaveAttribute("data-compact"));
		await expect(ai).toHaveFocus();
		await expect(ai).toHaveTextContent("Build with AI");
		await expectTopBarHolds(canvasElement);
	},
};

/**
 * Keyboard, app tabs (the Tabs model): Tab reaches the selected tab and shows the ring; ArrowRight moves to and
 * selects the next tab (its panel changes), End and Home jump; Tab moves on into the panel.
 */
export const TabsKeyboard: Story = {
	...atViewport("studio1100"),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const canvasTab = canvas.getByRole("tab", { name: "Canvas" });
		await tabTo(canvasTab);
		await expectFocusRing(canvasTab);
		await userEvent.keyboard("{ArrowRight}");
		const code = canvas.getByRole("tab", { name: "Code" });
		await expect(code).toHaveFocus();
		await expect(code).toHaveAttribute("aria-selected", "true");
		await expect(
			canvas.getByRole("heading", { name: "Code", level: 2 }),
		).toBeVisible();
		await userEvent.keyboard("{End}");
		await expect(canvas.getByRole("tab", { name: "Deploy" })).toHaveAttribute(
			"aria-selected",
			"true",
		);
		await expect(canvas.getByText(/arrives in P10/)).toBeVisible();
		await userEvent.keyboard("{Home}");
		await expect(canvasTab).toHaveAttribute("aria-selected", "true");
		// The indicator marks the selected tab (a shape, not colour alone).
		const indicator = canvasTab.querySelector(
			'[data-slot="tab-indicator"]',
		) as HTMLElement;
		await expectTokenColour(
			indicator,
			"background-color",
			"bg-text-accent-primary",
		);
		// Tab leaves the list for the next control in reading order (the top bar's), and goes on to the panel, which
		// is focusable because its empty state has no control.
		await userEvent.tab();
		await expect(
			canvas.getByRole("button", { name: "Start the local run" }),
		).toHaveFocus();
		const panel = canvas.getByRole("tabpanel", { name: "Canvas" });
		await tabTo(panel);
		await expect(panel).toHaveFocus();
	},
};

/** Each app tab once, showing the empty state that names the phase that fills it. */
export const EachTab: Story = {
	...atViewport("studio1100"),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const phases = {
			Canvas: /P3/,
			Code: /P3/,
			Config: /P3/,
			"Test & trace": /P8.*P9/,
			Deploy: /P10/,
		};
		for (const [name, phase] of Object.entries(phases)) {
			await userEvent.click(canvas.getByRole("tab", { name }));
			const panel = canvas.getByRole("tabpanel", { name });
			await expect(
				within(panel).getByRole("heading", { name, level: 2 }),
			).toBeVisible();
			await expect(panel).toHaveTextContent(phase);
		}
	},
};

/** A remembered layout is restored: the bottom panel opens at the stored 360 px. */
export const RememberedHeight: Story = {
	...atViewport("studio1100"),
	args: { layout: { open: true, height: 360 } },
	play: async ({ canvasElement }) => {
		await expectHeight(bottomPanel(canvasElement), 360);
	},
};

/** A remembered closed panel: only its 48 px tab strip shows; the views are inert. */
export const BottomPanelClosed: Story = {
	...atViewport("studio1100"),
	args: { layout: { open: false, height: 300 } },
	play: async ({ canvasElement }) => {
		await expectHeight(bottomPanel(canvasElement), 48);
		const canvas = within(canvasElement);
		await expect(
			canvas.getByRole("button", { name: "Show the panel" }),
		).toHaveAttribute("aria-expanded", "false");
		const views = canvasElement.querySelector(
			'[data-slot="bottom-panel"] [inert]',
		);
		await expect(views).not.toBeNull();
	},
};

/**
 * Showing and hiding the panel with its toggle: hiding keeps focus on the toggle and reports the layout to
 * remember (closed, the height kept); showing restores the height.
 */
export const BottomPanelToggle: Story = {
	...atViewport("studio1100"),
	args: { layout: { open: true, height: 280 } },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const hide = canvas.getByRole("button", { name: "Hide the panel" });
		await tabTo(hide);
		await expectFocusRing(hide);
		await userEvent.keyboard("{Enter}");
		await waitFor(() => expectHeight(bottomPanel(canvasElement), 48));
		await expect(onLayoutChange).toHaveBeenLastCalledWith({
			open: false,
			height: 280,
		});
		const show = canvas.getByRole("button", { name: "Show the panel" });
		await expect(show).toHaveFocus();
		await userEvent.keyboard("{Enter}");
		await waitFor(() => expectHeight(bottomPanel(canvasElement), 280));
		await expect(onLayoutChange).toHaveBeenLastCalledWith({
			open: true,
			height: 280,
		});
	},
};

/**
 * The panel shown or hidden from outside it: in the app, the shell.toggleBottomPanel command on Mod+J (here the
 * fixture's stand-in, `panelShortcut`). With focus inside a view, hiding moves focus to the toggle (never lost to
 * the page); showing again leaves it there.
 */
export const BottomPanelShortcut: Story = {
	...atViewport("studio1100"),
	args: {
		panelShortcut: true,
		problems: (
			<div className="p-4">
				<button type="button">Open config.yaml</button>
			</div>
		),
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const inside = canvas.getByRole("button", { name: "Open config.yaml" });
		inside.focus();
		await userEvent.keyboard("{Control>}j{/Control}");
		await waitFor(() => expectHeight(bottomPanel(canvasElement), 48));
		const show = canvas.getByRole("button", { name: "Show the panel" });
		await expect(show).toHaveFocus();
		await expect(onLayoutChange).toHaveBeenLastCalledWith({
			open: false,
			height: 240,
		});
		await userEvent.keyboard("{Control>}j{/Control}");
		await waitFor(() => expectHeight(bottomPanel(canvasElement), 240));
		await expect(
			canvas.getByRole("button", { name: "Hide the panel" }),
		).toHaveFocus();
	},
};

/**
 * Resizing from the keyboard (the window splitter model): ArrowUp on the handle makes the panel taller, and the new
 * height is reported to remember. Selecting a panel tab while it is closed opens it.
 */
export const BottomPanelResize: Story = {
	...atViewport("studio1100"),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const handle = canvas.getByRole("separator", {
			name: "Resize the panel",
		});
		await tabTo(handle);
		await userEvent.keyboard("{ArrowUp}");
		await waitFor(() => expect(onLayoutChange).toHaveBeenCalled());
		const [layout] = onLayoutChange.mock.lastCall as [
			{ open: boolean; height: number },
		];
		await expect(layout.open).toBe(true);
		await expect(layout.height).toBeGreaterThan(240);
		// The library sizes in percentages: the reported height is the rendered one, rounded.
		await expectHeightNear(bottomPanel(canvasElement), layout.height);
		// Closed, then a tab press opens it on that view.
		await userEvent.click(
			canvas.getByRole("button", { name: "Hide the panel" }),
		);
		await waitFor(() => expectHeight(bottomPanel(canvasElement), 48));
		await userEvent.click(canvas.getByRole("tab", { name: "Commands" }));
		await waitFor(() =>
			expectHeightNear(bottomPanel(canvasElement), layout.height),
		);
		await expect(
			canvas.getByRole("heading", { name: "No commands yet" }),
		).toBeVisible();
	},
};

/** Option B for gate question (a): the same parts, with the tabs on a row of their own. */
function TabsOnOwnRow() {
	const [tab, setTab] = useState<AppTabId>("canvas");
	return (
		<div
			data-slot="desktop-shell"
			className="flex h-dvh w-full min-w-0 flex-col overflow-hidden bg-surface text-text"
		>
			<Tabs
				selectedKey={tab}
				onSelectionChange={(key) => {
					if (isAppTabId(key)) setTab(key);
				}}
				className="min-h-0 flex-1"
			>
				<TopBar
					project={<ProjectSwitcher project={longProject} />}
					tabs={null}
					actions={
						<>
							<RunControl state="running" port={8000} />
							<DeployStatus state="deployed" deployedAgo="3 days ago" />
							<BuildWithAIButton />
							<SettingsButton />
						</>
					}
				/>
				<div className="flex h-tab shrink-0 items-end border-b border-border-default bg-surface-raised px-3">
					<AppTabList />
				</div>
				<TabPanel
					key={tab}
					id={tab}
					className="min-h-0 flex-1 rounded-none pt-0"
				>
					<TabEmptyState tab={tab} />
				</TabPanel>
			</Tabs>
			<StatusBar {...supportTriageStatus} />
		</div>
	);
}

/**
 * Gate question (a), option B (not recommended): the tabs on a second row under the project and the controls. It
 * gives the project name its full width at any size, but costs 48 px of height on every screen (the canvas and
 * code views need it most) and parts the project from its areas. Option A (one row; stories At1220, At1440 and
 * At1000Compact) fits at 1220 px with every label in full, so the second row buys nothing there.
 */
export const OptionTabsOnOwnRow: Story = {
	...atViewport("studio1100"),
	render: () => <TabsOnOwnRow />,
	play: async ({ canvasElement }) => {
		const bar = topBar(canvasElement);
		const tabs = within(canvasElement).getByRole("tablist", {
			name: "Project views",
		});
		await expect(tabs.getBoundingClientRect().top).toBeGreaterThanOrEqual(
			bar.getBoundingClientRect().bottom,
		);
		await expectNoSidewaysOverflow(shell(canvasElement));
	},
};

/**
 * Keyboard, bottom panel tabs (the Tabs model): ArrowRight moves to and selects the next view; End jumps to the last.
 * While the panel is closed, selecting a tab (also by arrow key) opens it.
 */
export const BottomPanelTabsKeyboard: Story = {
	...atViewport("studio1100"),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const panel = canvas.getByRole("region", { name: "Panel" });
		const problems = within(panel).getByRole("tab", { name: "Problems" });
		await tabTo(problems);
		await expectFocusRing(problems);
		await userEvent.keyboard("{ArrowRight}");
		const runLog = within(panel).getByRole("tab", { name: "Run log" });
		await expect(runLog).toHaveFocus();
		await expect(runLog).toHaveAttribute("aria-selected", "true");
		await expect(
			within(panel).getByRole("tabpanel", { name: "Run log" }),
		).toHaveTextContent("No run yet");
		// The app tabs keep their own selection (the panel's tab state is its own).
		await expect(canvas.getByRole("tab", { name: "Canvas" })).toHaveAttribute(
			"aria-selected",
			"true",
		);
		// Closed, then ArrowRight opens it on the next view.
		await userEvent.click(
			canvas.getByRole("button", { name: "Hide the panel" }),
		);
		await waitFor(() => expectHeight(bottomPanel(canvasElement), 48));
		runLog.focus();
		await userEvent.keyboard("{End}");
		await waitFor(() => expectHeightNear(bottomPanel(canvasElement), 240));
		await expect(
			within(panel).getByRole("tabpanel", { name: "Commands" }),
		).toHaveTextContent("No commands yet");
	},
};
