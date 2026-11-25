import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ReactNode } from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import {
	longProject,
	recentProjects,
	supportTriage,
} from "../lib/shell-fixtures";
import {
	expectFocusRing,
	expectInsetFocusRing,
	expectSolidLayer,
	tabTo,
} from "../lib/story-checks";
import { ProjectSwitcher } from "./project-switcher";
import {
	BuildWithAIButton,
	DeployStatus,
	RunControl,
	SettingsButton,
} from "./top-bar-controls";

const onStart = fn();
const onStop = fn();
const onShowLog = fn();
const onOpenFolder = fn();
const onOpenRecent = fn();

/** A strip on the top bar's surface, so the controls are seen on the ground they sit on. */
function Bar({ children }: { children: ReactNode }) {
	return (
		<div className="flex h-topbar flex-wrap items-center gap-6 bg-surface-raised px-3">
			{children}
		</div>
	);
}

const meta = {
	title: "Shell/Top bar controls",
	component: RunControl,
	args: { state: "stopped", onStart, onStop, onShowLog },
	beforeEach: () => {
		for (const f of [onStart, onStop, onShowLog, onOpenFolder, onOpenRecent])
			f.mockClear();
	},
	render: (args) => (
		<Bar>
			<RunControl {...args} />
		</Bar>
	),
} satisfies Meta<typeof RunControl>;

export default meta;
type Story = StoryObj<typeof meta>;

const chip = (canvasElement: HTMLElement) =>
	canvasElement.querySelector('[data-slot="status-chip"]') as HTMLElement;

/**
 * The run states side by side: no project (P1a's state: no control), stopped, starting, running, failed; each an
 * icon and a label (never colour alone), then start or stop.
 */
export const RunStates: Story = {
	render: (args) => (
		<Bar>
			<RunControl {...args} state="no-project" />
			<RunControl {...args} state="stopped" />
			<RunControl {...args} state="starting" />
			<RunControl {...args} state="running" port={8000} />
			<RunControl {...args} state="failed" />
		</Bar>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const groups = canvas.getAllByRole("group", { name: "Local run" });
		await expect(groups).toHaveLength(5);
		const [noProject, stopped, starting, running, failed] = groups as [
			HTMLElement,
			HTMLElement,
			HTMLElement,
			HTMLElement,
			HTMLElement,
		];
		// No project: the state only, no control (nothing to start).
		await expect(noProject).toHaveTextContent("No project to run");
		await expect(within(noProject).queryByRole("button")).toBeNull();
		await expect(stopped).toHaveTextContent("Stopped");
		await expect(
			within(stopped).getByRole("button", { name: "Start the local run" }),
		).toBeVisible();
		await expect(starting).toHaveTextContent("Starting");
		await expect(
			within(starting).getByRole("button", { name: "Stop the local run" }),
		).toBeVisible();
		await expect(running).toHaveTextContent("Running on port 8000");
		await expect(failed).toHaveTextContent("Run failed");
		await expect(
			within(failed).getByRole("button", { name: "Show the run log" }),
		).toBeVisible();
		const icons = new Set(
			groups
				.slice(1)
				.map(
					(g) =>
						g
							.querySelector('[data-slot="status-chip"] svg')
							?.getAttribute("class") ?? "",
				),
		);
		await expect(icons.size).toBe(4);
	},
};

/** Stopped: the start button runs `onStart`; keyboard focus shows the ring; its tooltip names it. */
export const Start: Story = {
	play: async ({ canvasElement }) => {
		const button = within(canvasElement).getByRole("button", {
			name: "Start the local run",
		});
		await tabTo(button);
		await expectFocusRing(button);
		await expect(
			await within(document.body).findByRole("tooltip"),
		).toHaveTextContent("Start the local run");
		await userEvent.keyboard("{Enter}");
		await expect(onStart).toHaveBeenCalledOnce();
		await expect(chip(canvasElement)).toHaveAttribute(
			"data-status",
			"not-set-up",
		);
	},
};

/** Running: the stop button runs `onStop`. */
export const Stop: Story = {
	args: { state: "running", port: 8000 },
	play: async ({ canvasElement }) => {
		await userEvent.click(
			within(canvasElement).getByRole("button", { name: "Stop the local run" }),
		);
		await expect(onStop).toHaveBeenCalledOnce();
		await expect(chip(canvasElement)).toHaveAttribute("data-status", "passed");
	},
};

/** The four deploy states: icon and label each; read as "Deployment: …". */
export const DeployStates: Story = {
	render: () => (
		<Bar>
			<DeployStatus state="not-deployed" />
			<DeployStatus state="deployed" deployedAgo="2 h ago" />
			<DeployStatus state="applying" />
			<DeployStatus state="failed" />
		</Bar>
	),
	play: async ({ canvasElement }) => {
		const items = [
			...canvasElement.querySelectorAll('[data-slot="deploy-status"]'),
		];
		const text = items.map((el) => el.textContent);
		await expect(text).toEqual([
			"Deployment: Not deployed",
			"Deployment: Deployed 2 h ago",
			"Deployment: Applying",
			"Deployment: Deploy failed",
		]);
		const statuses = items.map((el) =>
			el
				.querySelector('[data-slot="status-chip"]')
				?.getAttribute("data-status"),
		);
		await expect(statuses).toEqual([
			"not-set-up",
			"passed",
			"running",
			"failed",
		]);
	},
};

/** Build with AI (the AI button style) and the settings control, as the top bar ends. */
export const BuildWithAIAndSettings: Story = {
	render: () => (
		<Bar>
			<BuildWithAIButton />
			<SettingsButton />
		</Bar>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const ai = canvas.getByRole("button", { name: "Build with AI" });
		await expect(ai).toHaveAttribute("data-variant", "ai");
		await expect(ai).toHaveTextContent("Build with AI");
		const settings = canvas.getByRole("button", { name: "Settings" });
		await tabTo(settings);
		await expectFocusRing(settings);
		await expect(
			await within(document.body).findByRole("tooltip"),
		).toHaveTextContent("Settings");
	},
};

/** The project switcher, closed: the folder name with its path in a tooltip on keyboard focus. */
export const ProjectSwitcherClosed: Story = {
	render: () => (
		<Bar>
			<ProjectSwitcher
				project={supportTriage}
				recent={recentProjects}
				onOpenFolder={onOpenFolder}
				onOpenRecent={onOpenRecent}
			/>
		</Bar>
	),
	play: async ({ canvasElement }) => {
		const button = within(canvasElement).getByRole("button", {
			name: "support-triage",
		});
		await expect(button).toHaveAttribute("aria-haspopup", "true");
		await tabTo(button);
		await expectFocusRing(button);
		await expect(
			await within(document.body).findByRole("tooltip"),
		).toHaveTextContent("~/code/support-triage");
	},
};

/**
 * The project switcher, open (keyboard): open folder, new project, the recent projects, reveal in the file
 * manager. ArrowDown moves, Enter runs the item and returns focus to the switcher.
 */
export const ProjectSwitcherOpen: Story = {
	render: () => (
		<Bar>
			<ProjectSwitcher
				project={supportTriage}
				recent={recentProjects}
				onOpenFolder={onOpenFolder}
				onOpenRecent={onOpenRecent}
			/>
		</Bar>
	),
	play: async ({ canvasElement }) => {
		const button = within(canvasElement).getByRole("button", {
			name: "support-triage",
		});
		await tabTo(button);
		await userEvent.keyboard("{ArrowDown}");
		const menu = await within(document.body).findByRole("menu");
		await expectSolidLayer(
			menu.closest('[data-slot="menu-popover"]') as Element,
		);
		const items = within(menu).getAllByRole("menuitem");
		await expect(items.map((i) => i.textContent)).toEqual([
			"Open folder…",
			"New project…",
			"billing-assistant",
			"kb-researcher",
			"Reveal in file manager",
		]);
		await waitFor(() => expect(items[0]).toHaveFocus());
		await expectInsetFocusRing(items[0] as HTMLElement);
		await userEvent.keyboard("{ArrowDown}{ArrowDown}{Enter}");
		await expect(onOpenRecent).toHaveBeenCalledWith(recentProjects[0]);
		await waitFor(() => expect(button).toHaveFocus());
	},
};

/** A long project name is cut with an ellipsis inside the room it gets; it never wraps. */
export const ProjectSwitcherLongName: Story = {
	render: () => (
		<Bar>
			<div className="flex w-40 min-w-0">
				<ProjectSwitcher project={longProject} />
			</div>
		</Bar>
	),
	play: async ({ canvasElement }) => {
		const button = within(canvasElement).getByRole("button", {
			name: longProject.name,
		});
		await expect(button.getBoundingClientRect().width).toBeLessThanOrEqual(160);
		await expect(button.getBoundingClientRect().height).toBe(32);
	},
};

/** No project open (the app in P1a): a plain label, not a control. */
export const ProjectSwitcherNoProject: Story = {
	render: () => (
		<Bar>
			<ProjectSwitcher />
		</Bar>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText("No project open")).toBeVisible();
		await expect(canvas.queryByRole("button")).toBeNull();
	},
};
