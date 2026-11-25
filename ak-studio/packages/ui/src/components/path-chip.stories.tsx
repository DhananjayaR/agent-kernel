import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import {
	expectFocusRing,
	expectHeight,
	expectStyle,
	hover,
	tabTo,
} from "../lib/story-checks";
import { PathChip } from "./path-chip";

const meta = {
	title: "Display/Path chip",
	component: PathChip,
	args: {
		path: "examples/api/claude/app.py",
		onReveal: fn(),
		onCopy: fn(),
	},
} satisfies Meta<typeof PathChip>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Monospace, 24 px pill; reveal and copy are 24 px round buttons inside it. */
export const Default: Story = {
	play: async ({ canvasElement }) => {
		const chip = canvasElement.querySelector(
			"[data-slot=path-chip]",
		) as HTMLElement;
		await expectHeight(chip, 24);
		await expectStyle(chip, "border-top-left-radius", "9999px");
		await expect(getComputedStyle(chip).fontFamily).toContain("JetBrains Mono");
		const canvas = within(canvasElement);
		await expect(
			canvas.getByRole("button", { name: "Reveal in file manager" }),
		).toBeVisible();
		await expect(
			canvas.getByRole("button", { name: "Copy path" }),
		).toBeVisible();
	},
};

/** Without actions: just the path. */
export const PathOnly: Story = {
	args: { onReveal: undefined, onCopy: undefined, path: "config.yaml" },
};

/** A long path is cut at the end; the whole path is in the title. */
export const Truncated: Story = {
	args: {
		path: "examples/aws-serverless/openai-langfuse-trace-evaluation/evaluator/opik_evaluator.py",
	},
	render: (args) => (
		<div className="w-dialog-m">
			<PathChip {...args} />
		</div>
	),
};

export const Hover: Story = {
	play: async ({ canvasElement }) => {
		const copy = within(canvasElement).getByRole("button", {
			name: "Copy path",
		});
		const before = getComputedStyle(copy).backgroundColor;
		await hover(copy);
		await expect(getComputedStyle(copy).backgroundColor).not.toBe(before);
	},
};

export const Focus: Story = {
	play: async ({ canvasElement }) => {
		const reveal = within(canvasElement).getByRole("button", {
			name: "Reveal in file manager",
		});
		await tabTo(reveal);
		await expectFocusRing(reveal);
	},
};

/** Keyboard: Enter on each action calls its callback; copy shows a check and announces it. */
export const Keyboard: Story = {
	play: async ({ args, canvasElement }) => {
		const canvas = within(canvasElement);
		await tabTo(canvas.getByRole("button", { name: "Reveal in file manager" }));
		await userEvent.keyboard("{Enter}");
		await expect(args.onReveal).toHaveBeenCalledOnce();
		await userEvent.tab();
		await userEvent.keyboard("{Enter}");
		await expect(args.onCopy).toHaveBeenCalledWith(
			"examples/api/claude/app.py",
		);
		await waitFor(() =>
			expect(canvas.getByRole("status")).toHaveTextContent("Path copied"),
		);
	},
};
