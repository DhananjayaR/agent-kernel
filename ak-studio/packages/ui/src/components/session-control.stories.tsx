// SessionControlView's states (P1b gate step 4, design gate row (b)): stopped, starting, running with its key facts,
// a stop on its way, stopping, failed (what happened, "Show log", start again), a refused start, and the keyboard
// (one button from "Start" to "Stop" and back, keeping focus). The top bar's RunControl keeps its own stories.
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, userEvent, within } from "storybook/test";
import { expectFocusRing, tabTo } from "../lib/story-checks";
import {
	type SessionControlState,
	SessionControlView,
} from "./session-control";

const facts = [
	{ label: "Started", value: "10:42:07" },
	{ label: "Lines", value: "128" },
];

const meta = {
	title: "Patterns/Session control",
	component: SessionControlView,
	args: {
		title: "Demo ticker",
		state: "stopped",
		onStart: fn(),
		onStop: fn(),
	},
	render: (args) => (
		<div className="max-w-dialog-m">
			<SessionControlView {...args} />
		</div>
	),
} satisfies Meta<typeof SessionControlView>;

export default meta;
type Story = StoryObj<typeof meta>;

const control = (root: HTMLElement, name = "Demo ticker") =>
	within(root).getByRole("region", { name });
const chipOf = (root: HTMLElement) =>
	root.querySelector("[data-slot=status-chip]") as HTMLElement;

/** Stopped: the state and "Start" (secondary: the view's one primary action is its own). */
export const Stopped: Story = {
	play: async ({ canvasElement, args }) => {
		const el = control(canvasElement);
		await expect(chipOf(el)).toHaveTextContent("Stopped");
		const start = within(el).getByRole("button", { name: "Start" });
		await expect(start).toHaveAttribute("data-variant", "secondary");
		await userEvent.click(start);
		await expect(args.onStart).toHaveBeenCalledOnce();
		await expect(within(el).queryByRole("button", { name: "Stop" })).toBeNull();
	},
};

/** Starting: it can already be stopped. */
export const Starting: Story = {
	args: { state: "starting" },
	play: async ({ canvasElement }) => {
		const el = control(canvasElement);
		await expect(chipOf(el)).toHaveAttribute("data-status", "running");
		await expect(chipOf(el)).toHaveTextContent("Starting");
		await expect(
			within(el).getByRole("button", { name: "Stop" }),
		).toBeEnabled();
	},
};

/** Running: its key facts, label and monospace value; "Stop" and "Show log". */
export const Running: Story = {
	args: { state: "running", facts, onShowLog: fn() },
	play: async ({ canvasElement, args }) => {
		const el = control(canvasElement);
		await expect(chipOf(el)).toHaveAttribute("data-status", "passed");
		await expect(chipOf(el)).toHaveTextContent("Running");
		const value = within(el).getByText("10:42:07");
		await expect(value.tagName).toBe("DD");
		await expect(getComputedStyle(value).fontFamily).toContain(
			"JetBrains Mono",
		);
		await userEvent.click(within(el).getByRole("button", { name: "Stop" }));
		await expect(args.onStop).toHaveBeenCalledOnce();
		await userEvent.click(within(el).getByRole("button", { name: "Show log" }));
		await expect(args.onShowLog).toHaveBeenCalledOnce();
	},
};

/** A stop on its way for more than 300 ms: the button is pending (it ignores presses). */
export const Pending: Story = {
	args: { state: "running", facts, pending: true },
	play: async ({ canvasElement, args }) => {
		const stop = within(control(canvasElement)).getByRole("button", {
			name: "Stop",
		});
		await expect(stop).toHaveAttribute("data-pending");
		await userEvent.click(stop);
		await expect(args.onStop).not.toHaveBeenCalled();
	},
};

/** Stopping: the service is winding it down; "Stop" stays, pending. */
export const Stopping: Story = {
	args: { state: "stopping", facts },
	play: async ({ canvasElement }) => {
		const el = control(canvasElement);
		await expect(chipOf(el)).toHaveTextContent("Stopping");
		await expect(
			within(el).getByRole("button", { name: "Stop" }),
		).toHaveAttribute("data-pending");
	},
};

/** Failed: what happened and what to do, "Show log", and "Start" to try again. */
export const Failed: Story = {
	args: {
		state: "failed",
		onShowLog: fn(),
		error: {
			title: "The ticker stopped unexpectedly",
			description: "Start it again. If it keeps stopping, the log shows why.",
		},
	},
	play: async ({ canvasElement }) => {
		const el = control(canvasElement);
		await expect(chipOf(el)).toHaveAttribute("data-status", "failed");
		await expect(within(el).getByRole("alert")).toHaveTextContent(
			"The ticker stopped unexpectedly",
		);
		await expect(
			within(el).getByRole("button", { name: "Show log" }),
		).toBeVisible();
		await expect(
			within(el).getByRole("button", { name: "Start" }),
		).toBeVisible();
	},
};

/** A start the service refused: still stopped, with the reason. */
export const StartRefused: Story = {
	args: {
		error: {
			title: "The ticker is already running in another window",
			description: "Stop it there first.",
		},
	},
	play: async ({ canvasElement }) => {
		const el = control(canvasElement);
		await expect(chipOf(el)).toHaveTextContent("Stopped");
		await expect(within(el).getByRole("alert")).toHaveTextContent(
			"already running",
		);
	},
};

/** Keyboard: one button, from "Start" to "Stop" and back, never losing focus. */
export const Keyboard: Story = {
	render: function Render() {
		const [state, setState] = useState<SessionControlState>("stopped");
		return (
			<div className="max-w-dialog-m">
				<SessionControlView
					title="Demo ticker"
					state={state}
					facts={state === "running" ? facts : []}
					onStart={() => setState("running")}
					onStop={() => setState("stopped")}
				/>
			</div>
		);
	},
	play: async ({ canvasElement }) => {
		const el = control(canvasElement);
		const button = within(el).getByRole("button", { name: "Start" });
		await tabTo(button);
		await expectFocusRing(button);
		await userEvent.keyboard("{Enter}");
		await expect(within(el).getByRole("button", { name: "Stop" })).toBe(button);
		await expect(button).toHaveFocus();
		await userEvent.keyboard("{Enter}");
		await expect(within(el).getByRole("button", { name: "Start" })).toBe(
			button,
		);
		await expect(button).toHaveFocus();
		await userEvent.keyboard("{Enter}");
		await expect(button).toHaveFocus();
		await expectFocusRing(button);
	},
};
