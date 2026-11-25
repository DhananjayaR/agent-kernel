import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { supportTriageStatus } from "../lib/shell-fixtures";
import { expectHeight, expectTokenColour } from "../lib/story-checks";
import { StatusBar } from "./status-bar";

const onCopy = fn();

const meta = {
	title: "Shell/Status bar",
	component: StatusBar,
	args: supportTriageStatus,
	beforeEach: () => {
		onCopy.mockClear();
	},
	parameters: { fullBleed: true },
} satisfies Meta<typeof StatusBar>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * support-triage: the working directory and git branch at the start; the Python environment, file sync and the
 * coding agent (StatusChips), the project's OAK version (P2's slot) and the Studio's version at the end.
 */
export const Default: Story = {
	play: async ({ canvasElement }) => {
		const bar = within(canvasElement).getByRole("contentinfo");
		await expectHeight(bar, 32);
		await expect(bar).toHaveTextContent("~/code/support-triage");
		await expect(bar).toHaveTextContent("Git branchmain");
		const chips = [...bar.querySelectorAll('[data-slot="status-chip"]')];
		await expect(chips.map((c) => c.textContent)).toEqual([
			"Python 3.12 (.venv)",
			"Files in sync",
			"Claude Agent connected",
		]);
		// The coding agent's sparkle is the AI colour (the coding agent only).
		const sparkle = bar.querySelector(
			'[data-slot="coding-agent"] > svg',
		) as Element;
		await expectTokenColour(sparkle, "color", "text-text-accent-ai");
		await expect(bar).toHaveTextContent("OAK 0.10.2");
		const version = bar.querySelector(
			'[data-slot="app-version-number"]',
		) as HTMLElement;
		await expect(version).toHaveTextContent("0.1.0");
		await expect(getComputedStyle(version).fontVariantNumeric).toBe(
			"tabular-nums",
		);
	},
};

/** States other than ready: the environment missing, a change on disk being read, the agent not set up. */
export const NotReady: Story = {
	args: {
		python: { status: "not-set-up", label: "No Python environment" },
		fileSync: { status: "running", label: "Reading changes" },
		codingAgent: { status: "waiting", label: "Claude Agent signed out" },
	},
	play: async ({ canvasElement }) => {
		const statuses = [
			...canvasElement.querySelectorAll('[data-slot="status-chip"]'),
		].map((c) => c.getAttribute("data-status"));
		await expect(statuses).toEqual(["not-set-up", "running", "waiting"]);
	},
};

/** No project open (the app in P1a): only the Studio's version. */
export const NoProject: Story = {
	args: {
		workingDirectory: undefined,
		gitBranch: undefined,
		python: undefined,
		fileSync: undefined,
		codingAgent: undefined,
		kernelVersion: undefined,
	},
	play: async ({ canvasElement }) => {
		const bar = within(canvasElement).getByRole("contentinfo");
		await expect(bar).toHaveTextContent(/^Studio 0\.1\.0$/);
	},
};

/** The working directory's copy action (the feature passes the clipboard call). */
export const CopyPath: Story = {
	args: { onCopyWorkingDirectory: onCopy },
	play: async ({ canvasElement }) => {
		await userEvent.click(
			within(canvasElement).getByRole("button", { name: "Copy path" }),
		);
		await expect(onCopy).toHaveBeenCalledWith("~/code/support-triage");
	},
};
