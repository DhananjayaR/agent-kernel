// JobProgressView's states (P1b gate step 4): queued, just started (no time under a second), running with a step and
// the elapsed time, not cancellable, a stop caution, "Show commands", stopping, a stop refused, waiting with its
// approval, succeeded, failed with a next action, stopped, several stacked, and the keyboard. The elapsed time is a
// prop: each story passes a fixed value, so the screenshots never move.
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { expectFocusRing, tabTo } from "../lib/story-checks";
import { ApprovalCard } from "./approval";
import {
	JobProgressStack,
	JobProgressView,
	type JobProgressViewProps,
} from "./job-progress";

const meta = {
	title: "Patterns/Job progress",
	component: JobProgressView,
	args: {
		title: "Demo job",
		state: "running",
		step: { step: 2, steps: 3, label: "Preparing the demo" },
		elapsedMs: 72_400,
		onStop: fn(),
	},
	render: (args) => (
		<div className="max-w-dialog-m">
			<JobProgressView {...args} />
		</div>
	),
} satisfies Meta<typeof JobProgressView>;

export default meta;
type Story = StoryObj<typeof meta>;

const job = (root: HTMLElement, name = "Demo job") =>
	within(root).getByRole("region", { name });

/** Running: title, a running chip, "Step 2 of 3 · Preparing the demo", the elapsed time in figures, and "Stop". */
export const Running: Story = {
	play: async ({ canvasElement, args }) => {
		const el = job(canvasElement);
		await expect(within(el).getByRole("status")).toHaveTextContent(
			"Step 2 of 3 · Preparing the demo",
		);
		await expect(el).toHaveTextContent("Elapsed time 1 min 12 s");
		const time = within(el).getByText("1 min 12 s", { exact: false });
		await expect(getComputedStyle(time).fontVariantNumeric).toBe(
			"tabular-nums",
		);
		await expect(
			el.querySelector("[data-slot=status-chip]")?.getAttribute("data-status"),
		).toBe("running");
		const stop = within(el).getByRole("button", { name: "Stop" });
		await expect(stop).toHaveAttribute("data-variant", "secondary");
		await userEvent.click(stop);
		await expect(args.onStop).toHaveBeenCalledOnce();
		await expect(
			within(el).queryByRole("button", { name: "Show commands" }),
		).not.toBeInTheDocument();
	},
};

/** Under a second: no time is shown yet (feedback timing). */
export const JustStarted: Story = {
	args: {
		elapsedMs: 600,
		step: { step: 1, steps: 3, label: "Checking the app" },
	},
	play: async ({ canvasElement }) => {
		const el = job(canvasElement);
		await expect(el).not.toHaveTextContent("Elapsed time");
		await expect(el).toHaveTextContent("Step 1 of 3 · Checking the app");
	},
};

/** Queued behind another job of its kind: no step, no time; it can still be stopped. */
export const Queued: Story = {
	args: { state: "queued", step: undefined, elapsedMs: undefined },
	play: async ({ canvasElement }) => {
		const el = job(canvasElement);
		await expect(el).toHaveTextContent("Queued");
		await expect(
			within(el).getByRole("button", { name: "Stop" }),
		).toBeVisible();
	},
};

/** A job the person cannot stop (`cancellable: false`): no "Stop". */
export const NotCancellable: Story = {
	args: { onStop: undefined },
	play: async ({ canvasElement }) => {
		await expect(
			within(job(canvasElement)).queryByRole("button", { name: "Stop" }),
		).not.toBeInTheDocument();
	},
};

/** Stopping is unsafe: the job's own caution beside "Stop" (as Builder-Deploy-Applying draws it). */
export const StopCaution: Story = {
	args: {
		title: "Apply",
		step: { step: 3, steps: 5, label: "terraform apply" },
		stopCaution:
			"Stopping can leave some resources created. A new plan shows the current state.",
		onShowCommands: fn(),
	},
	play: async ({ canvasElement }) => {
		const el = job(canvasElement, "Apply");
		await expect(el).toHaveTextContent(
			"Stopping can leave some resources created.",
		);
	},
};

/** The job ran commands: "Show commands" opens the Commands panel on them. */
export const ShowCommands: Story = {
	args: { onShowCommands: fn() },
	play: async ({ canvasElement, args }) => {
		const show = within(job(canvasElement)).getByRole("button", {
			name: "Show commands",
		});
		await expect(show).toHaveAttribute("data-variant", "ghost");
		await userEvent.click(show);
		await expect(args.onShowCommands).toHaveBeenCalledOnce();
	},
};

/** Stopping: "Stop" is pending until the job ends. */
export const Stopping: Story = {
	args: { stopPending: true },
	play: async ({ canvasElement }) => {
		await expect(
			within(job(canvasElement)).getByRole("button", { name: "Stop" }),
		).toHaveAttribute("data-pending", "true");
	},
};

/** The stop was refused: said inline, under the actions. */
export const StopRefused: Story = {
	args: {
		stopError: {
			title: "This job cannot be stopped",
			description:
				"It finishes on its own; stopping it could leave things half done.",
		},
	},
	play: async ({ canvasElement }) => {
		await expect(
			within(job(canvasElement)).getByRole("alert"),
		).toHaveTextContent("This job cannot be stopped");
	},
};

/** Waiting for the person: the job's question shows inside it as the approval card. */
export const Waiting: Story = {
	args: {
		state: "waiting",
		elapsedMs: 2_300,
		children: (
			<ApprovalCard
				title="Run the last step?"
				summary="The demo job has run two of its three steps. Run the last one, or stop the job here. Nothing outside the app changes."
				approveLabel="Run the last step"
				denyLabel="Stop the job"
				onApprove={() => {}}
				onDeny={() => {}}
			/>
		),
	},
	play: async ({ canvasElement }) => {
		const el = job(canvasElement);
		await expect(el).toHaveTextContent("Waiting for you");
		await expect(
			within(el).getByRole("region", { name: "Run the last step?" }),
		).toBeVisible();
		await expect(el).toHaveTextContent("2 s");
	},
};

/** Succeeded: "Done" and the result in one line; no time, no "Stop". */
export const Succeeded: Story = {
	args: { state: "succeeded", result: "Ran all 3 steps." },
	play: async ({ canvasElement }) => {
		const el = job(canvasElement);
		await expect(el).toHaveTextContent("Done");
		await expect(within(el).getByRole("status")).toHaveTextContent(
			"Ran all 3 steps.",
		);
		await expect(within(el).queryByRole("button")).not.toBeInTheDocument();
		await expect(el).not.toHaveTextContent("Elapsed time");
	},
};

/** Failed: what happened, then the next action (Task 17's ErrorView replaces this minimal banner). */
export const Failed: Story = {
	args: {
		state: "failed",
		onShowCommands: fn(),
		error: {
			title: "The toolchain could not be found",
			message: "uv is not on your PATH. Install it, then try again.",
			action: { label: "Check again", onAction: fn() },
		},
	},
	play: async ({ canvasElement, args }) => {
		const el = job(canvasElement);
		const alert = within(el).getByRole("alert");
		await expect(alert).toHaveTextContent("The toolchain could not be found");
		await userEvent.click(
			within(alert).getByRole("button", { name: "Check again" }),
		);
		await expect(args.error?.action?.onAction).toHaveBeenCalledOnce();
		await expect(
			within(el).getByRole("button", { name: "Show commands" }),
		).toBeVisible();
	},
};

/** Stopped (cancelled, or the question denied): said plainly; nothing failed. */
export const Cancelled: Story = {
	args: { state: "cancelled" },
	play: async ({ canvasElement }) => {
		const el = job(canvasElement);
		await expect(el).toHaveTextContent("Stopped");
		await expect(within(el).getByRole("status")).toHaveTextContent(
			"Stopped before it finished.",
		);
	},
};

/** Several jobs in one view: each its own block, newest first; nothing hidden. */
export const Stacked: Story = {
	render: () => (
		<JobProgressStack className="max-w-dialog-m">
			<JobProgressView
				title="Opening the project"
				state="running"
				step={{ step: 1, steps: 2, label: "Reading config.yaml" }}
				elapsedMs={3_100}
				onStop={() => {}}
			/>
			<JobProgressView
				title="Detecting the toolchain"
				state="succeeded"
				result="Python 3.12.7 and uv 0.9.2 found."
			/>
		</JobProgressStack>
	),
	play: async ({ canvasElement }) => {
		const regions = within(canvasElement).getAllByRole("region");
		await expect(regions.map((r) => r.getAttribute("data-state"))).toEqual([
			"running",
			"succeeded",
		]);
	},
};

/** A job whose "Stop" ends it, as the connected JobProgress does once the stop arrives. */
function StoppableJob(props: JobProgressViewProps) {
	const [state, setState] = useState<JobProgressViewProps["state"]>("running");
	const [stopping, setStopping] = useState(false);
	return (
		<div className="max-w-dialog-m">
			<JobProgressView
				{...props}
				state={state}
				stopPending={stopping}
				onStop={() => {
					props.onStop?.();
					setStopping(true);
					setTimeout(() => setState("cancelled"), 50);
				}}
			/>
		</div>
	);
}

/**
 * Keyboard: Tab reaches "Stop" and "Show commands" with the focus ring; Enter on "Stop" stops the job, and when the
 * job ends and "Stop" goes, focus moves to the job's card instead of the page.
 */
export const Keyboard: Story = {
	// React Aria announces a focused button's pending state through its live announcer, pointing at the button;
	// answering removes the button, and the announcer keeps the stale pointer for 7 s. axe checks after the play
	// function, inside those 7 s, so the announcer's node (not the story) is left out of the check. The announcer
	// lives as long as the page, so this story stays the file's last.
	parameters: { a11y: { context: { exclude: ["[data-live-announcer]"] } } },
	args: { onShowCommands: fn() },
	render: (args) => <StoppableJob {...args} />,
	play: async ({ canvasElement, args }) => {
		const el = job(canvasElement);
		const stop = within(el).getByRole("button", { name: "Stop" });
		await tabTo(stop);
		await expectFocusRing(stop);
		await userEvent.tab();
		const show = within(el).getByRole("button", { name: "Show commands" });
		await expect(show).toHaveFocus();
		await expectFocusRing(show);
		await userEvent.keyboard("{Enter}");
		await expect(args.onShowCommands).toHaveBeenCalledOnce();
		await userEvent.tab({ shift: true });
		await expect(stop).toHaveFocus();
		await userEvent.keyboard("{Enter}");
		await expect(args.onStop).toHaveBeenCalledOnce();
		await waitFor(() => expect(el).toHaveAttribute("data-state", "cancelled"));
		await waitFor(() => expect(el).toHaveFocus());
	},
};
