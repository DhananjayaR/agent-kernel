// CommandRow's states (P1b gate step 4): a command running, one that exited 0, one that failed (a non-zero exit, and
// one ended by a signal), one the app stopped, and one whose secret the main process masked (`NAME=[hidden]`).
// P2's Commands view lists them; here they are shown in a list as it will.
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { tokenColour } from "../lib/story-checks";
import { CommandRow } from "./command-row";

const meta = {
	title: "Patterns/Command row",
	component: CommandRow,
	args: {
		executable: "uv",
		args: ["run", "pytest", "tests"],
		state: "running",
		durationMs: 4_200,
	},
	render: (args) => (
		<div className="max-w-dialog-l rounded-control border border-border-default bg-surface-raised">
			<CommandRow {...args} />
		</div>
	),
} satisfies Meta<typeof CommandRow>;

export default meta;
type Story = StoryObj<typeof meta>;

const chipOf = (root: HTMLElement) =>
	root.querySelector("[data-slot=status-chip]") as HTMLElement;

/** Running: a running chip, the command in monospace, the time so far. */
export const Running: Story = {
	play: async ({ canvasElement }) => {
		const row = canvasElement.querySelector(
			"[data-slot=command-row]",
		) as HTMLElement;
		await expect(chipOf(row)).toHaveAttribute("data-status", "running");
		await expect(chipOf(row)).toHaveTextContent("Running");
		const code = row.querySelector("code") as HTMLElement;
		await expect(code).toHaveTextContent("uv run pytest tests");
		await expect(getComputedStyle(code).fontFamily).toContain("JetBrains Mono");
		// While it runs the time reads "Running for"; once it ended, "Took".
		await expect(row).toHaveTextContent("Running for 4.2 s");
		await expect(row.getBoundingClientRect().height).toBeGreaterThanOrEqual(40);
	},
};

/** Exited 0: "Exit 0" in the passed state. */
export const Succeeded: Story = {
	args: { state: "ended", exitCode: 0, durationMs: 1_830 },
	play: async ({ canvasElement }) => {
		await expect(chipOf(canvasElement)).toHaveAttribute(
			"data-status",
			"passed",
		);
		await expect(chipOf(canvasElement)).toHaveTextContent("Exit 0");
	},
};

/** A non-zero exit: "Exit 1" in the failed state (its icon in the danger text colour, so never colour alone). */
export const Failed: Story = {
	args: { state: "ended", exitCode: 1, durationMs: 12_400 },
	play: async ({ canvasElement }) => {
		const chip = chipOf(canvasElement);
		await expect(chip).toHaveAttribute("data-status", "failed");
		await expect(chip).toHaveTextContent("Exit 1");
		const icon = chip.querySelector("svg") as SVGElement;
		await expect(getComputedStyle(icon).color).toBe(
			tokenColour(chip, "text-text-status-danger", "color"),
		);
	},
};

/** Ended by a signal (no exit code): failed, saying so. */
export const Signalled: Story = {
	args: { state: "ended", exitCode: null, durationMs: 75_000 },
	play: async ({ canvasElement }) => {
		await expect(chipOf(canvasElement)).toHaveAttribute(
			"data-status",
			"failed",
		);
		await expect(chipOf(canvasElement)).toHaveTextContent("Ended by a signal");
		await expect(canvasElement).toHaveTextContent("1 min 15 s");
	},
};

/** The app stopped it (the person stopped its job): "Stopped", not a failure. */
export const Stopped: Story = {
	args: { state: "stopped", durationMs: 640 },
	play: async ({ canvasElement }) => {
		await expect(chipOf(canvasElement)).toHaveAttribute(
			"data-status",
			"not-set-up",
		);
		await expect(chipOf(canvasElement)).toHaveTextContent("Stopped");
		await expect(canvasElement).toHaveTextContent("640 ms");
	},
};

/** A secret in the arguments, masked by the main process before it reached the renderer: `NAME=[hidden]`. */
export const MaskedSecret: Story = {
	args: {
		executable: "terraform",
		args: [
			"apply",
			"-var",
			"AZURE_CLIENT_SECRET=[hidden]",
			"-var",
			"region=West Europe",
		],
		state: "ended",
		exitCode: 0,
		durationMs: 95_000,
	},
	play: async ({ canvasElement }) => {
		const code = canvasElement.querySelector("code") as HTMLElement;
		await expect(code).toHaveTextContent(
			"terraform apply -var AZURE_CLIENT_SECRET=[hidden] -var 'region=West Europe'",
		);
	},
};

/** Several in a list, as the Commands view shows them: one row each, the commands wrapping, never cut off. */
export const List: Story = {
	render: () => (
		<ul
			aria-label="Commands"
			className="flex max-w-dialog-l flex-col divide-y divide-border-default rounded-control border border-border-default bg-surface-raised"
		>
			<li>
				<CommandRow
					executable="uv"
					args={["sync"]}
					state="ended"
					exitCode={0}
					durationMs={2_100}
				/>
			</li>
			<li>
				<CommandRow
					executable="uv"
					args={[
						"run",
						"python",
						"-m",
						"agentkernel.cli",
						"introspect",
						"--project",
						"/home/dev/projects/support-triage",
						"--format",
						"json",
					]}
					state="ended"
					exitCode={2}
					durationMs={880}
				/>
			</li>
			<li>
				<CommandRow
					executable="ak"
					args={["features", "--json"]}
					state="ended"
					durationMs={410}
				/>
			</li>
			<li>
				<CommandRow
					executable="docker"
					args={["info"]}
					state="running"
					durationMs={1_200}
				/>
			</li>
		</ul>
	),
	play: async ({ canvasElement }) => {
		await expect(within(canvasElement).getAllByRole("listitem")).toHaveLength(
			4,
		);
		// Ended with no exit code on its record: "Ended", with no verdict (not "Ended by a signal").
		const ended = within(canvasElement).getAllByRole(
			"listitem",
		)[2] as HTMLElement;
		await expect(chipOf(ended)).toHaveTextContent("Ended");
		await expect(chipOf(ended)).toHaveAttribute("data-status", "not-set-up");
		await expect(ended).toHaveTextContent("Took 410 ms");
		await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(
			window.innerWidth,
		);
	},
};
