// StateMessage's states (P1b gate step 4, design gate row (d)): one family for empty, cannot read and error, in two
// frames with the same slots. Centred when nothing is left to show (an empty view, a file that cannot be read with
// nothing else to show, an error that left nothing); a banner over what is left (partial results). The raw detail is
// collapsed until asked for, and the keyboard reaches the disclosure and the next action.
import type { Meta, StoryObj } from "@storybook/react-vite";
import { IconTopologyStar3 } from "@tabler/icons-react";
import { expect, fn, userEvent, within } from "storybook/test";
import { expectFocusRing, tabTo } from "../lib/story-checks";
import { Button } from "./button";
import { StateMessage } from "./state-message";

const meta = {
	title: "Patterns/State message",
	component: StateMessage,
	args: {
		kind: "empty",
		frame: "centred",
		title: "Nothing on the canvas yet",
		description:
			"The canvas shows the agents in app.py and how they connect. Add an agent to start.",
	},
	render: (args) => (
		<div className="flex h-96 max-w-dialog-l flex-col justify-center rounded-card border border-border-default">
			<StateMessage {...args} />
		</div>
	),
} satisfies Meta<typeof StateMessage>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A view with a few rows left over: what a banner sits on when something is left to show. */
function PartialRows() {
	return (
		<ul className="flex flex-col gap-2 text-ui text-text">
			<li>triage (agent)</li>
			<li>billing (agent)</li>
			<li>refunds (tool)</li>
		</ul>
	);
}

/** Empty: what the place is for and the first action; not announced (nothing went wrong). */
export const Empty: Story = {
	args: {
		icon: <IconTopologyStar3 aria-hidden="true" />,
		actions: <Button variant="primary">Add agent</Button>,
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(
			canvas.getByRole("heading", { name: "Nothing on the canvas yet" }),
		).toBeVisible();
		await expect(canvas.queryByRole("alert")).toBeNull();
		await expect(
			canvas.getByRole("button", { name: "Add agent" }),
		).toBeVisible();
	},
};

/** Cannot read, nothing left to show: the file and line as a PathChip, and "Open in Code". */
export const CannotRead: Story = {
	args: {
		kind: "cannot-read",
		title: "Cannot read app.py",
		description:
			"Fix the syntax error at line 42, then the canvas reads the file again.",
		file: "src/support/app.py",
		line: 42,
		action: { label: "Open in Code", onAction: fn() },
	},
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);
		const alert = canvas.getByRole("alert");
		await expect(within(alert).getByRole("heading")).toHaveTextContent(
			"Cannot read app.py",
		);
		// The line is read with the path, and shown after the name.
		await expect(alert).toHaveTextContent("src/support/app.py, line 42");
		await expect(
			alert.querySelector("[data-slot=path-chip]"),
		).toHaveTextContent("app.py:42");
		await userEvent.click(
			within(alert).getByRole("button", { name: "Open in Code" }),
		);
		await expect(args.action?.onAction).toHaveBeenCalledOnce();
	},
};

/** Cannot read, with partial results left: a danger banner over what could be read. */
export const CannotReadPartial: Story = {
	args: {
		kind: "cannot-read",
		frame: "banner",
		title: "Cannot read app.py",
		description:
			"Showing the last view that could be read. Fix the syntax error to edit nodes again.",
		file: "src/support/app.py",
		line: 42,
		action: { label: "Open in Code", onAction: fn() },
	},
	render: (args) => (
		<div className="flex max-w-dialog-l flex-col gap-4">
			<StateMessage {...args} />
			<PartialRows />
		</div>
	),
	play: async ({ canvasElement }) => {
		const alert = within(canvasElement).getByRole("alert");
		await expect(alert).toHaveAttribute("data-tone", "danger");
		await expect(alert).toHaveAttribute("data-kind", "cannot-read");
		await expect(
			within(canvasElement).getByText("triage (agent)"),
		).toBeVisible();
	},
};

/** An error that left nothing to show: what happened, what to do, the detail collapsed, the next action. */
export const ErrorState: Story = {
	name: "Error",
	args: {
		kind: "error",
		title: "The project could not be opened",
		description:
			"The folder is not readable. Check its permissions, then open it again.",
		detail: "EACCES: permission denied, scandir '/home/ada/support-triage'",
		action: { label: "Choose another folder", onAction: fn() },
	},
	play: async ({ canvasElement }) => {
		const alert = within(canvasElement).getByRole("alert");
		await expect(alert).toHaveTextContent("The project could not be opened");
		await expect(within(alert).getByText(/EACCES/)).not.toBeVisible();
	},
};

/** An error over partial results: the banner frame, with the same slots. */
export const ErrorPartial: Story = {
	args: {
		kind: "error",
		frame: "banner",
		title: "Some test results could not be loaded",
		description:
			"The results below are from the last run that could be read. Run the tests again to refresh them.",
		action: { label: "Run tests", onAction: fn() },
	},
	render: (args) => (
		<div className="flex max-w-dialog-l flex-col gap-4">
			<StateMessage {...args} />
			<PartialRows />
		</div>
	),
	play: async ({ canvasElement }) => {
		const alert = within(canvasElement).getByRole("alert");
		await expect(alert).toHaveAttribute("data-kind", "error");
		await expect(
			within(alert).getByRole("button", { name: "Run tests" }),
		).toBeVisible();
	},
};

/** The raw detail, opened: masked by the service, in a code block that scrolls sideways. */
export const DetailOpen: Story = {
	args: {
		kind: "error",
		frame: "banner",
		title: "The command could not start",
		description: "uv is not on your PATH. Install it, then try again.",
		detail:
			"spawn uv ENOENT\n    at ChildProcess._handle.onexit (node:internal/child_process:285:19)\n    env: OPENAI_API_KEY=••••••••",
	},
	render: (args) => (
		<div className="max-w-dialog-l">
			<StateMessage {...args} />
		</div>
	),
	play: async ({ canvasElement }) => {
		const alert = within(canvasElement).getByRole("alert");
		const toggle = within(alert).getByRole("button", { name: "Details" });
		await expect(toggle).toHaveAttribute("aria-expanded", "false");
		await expect(
			within(alert).queryByText(/spawn uv ENOENT/),
		).not.toBeVisible();
		await userEvent.click(toggle);
		await expect(toggle).toHaveAttribute("aria-expanded", "true");
		await expect(within(alert).getByText(/spawn uv ENOENT/)).toBeVisible();
	},
};

/** The keyboard: Tab reaches the disclosure (Enter opens it) and then the next action. */
export const Keyboard: Story = {
	args: {
		kind: "error",
		frame: "banner",
		title: "The command could not start",
		description: "uv is not on your PATH. Install it, then try again.",
		detail: "spawn uv ENOENT",
		action: { label: "Check again", onAction: fn() },
	},
	render: (args) => (
		<div className="max-w-dialog-l">
			<StateMessage {...args} />
		</div>
	),
	play: async ({ canvasElement, args }) => {
		const alert = within(canvasElement).getByRole("alert");
		const toggle = within(alert).getByRole("button", { name: "Details" });
		await tabTo(toggle);
		await expectFocusRing(toggle);
		await userEvent.keyboard("{Enter}");
		await expect(within(alert).getByText("spawn uv ENOENT")).toBeVisible();
		const next = within(alert).getByRole("button", { name: "Check again" });
		await tabTo(next);
		await expectFocusRing(next);
		await userEvent.keyboard("{Enter}");
		await expect(args.action?.onAction).toHaveBeenCalledOnce();
	},
};
