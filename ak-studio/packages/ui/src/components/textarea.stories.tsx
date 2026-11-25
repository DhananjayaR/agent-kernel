import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import {
	expectFocusRing,
	expectPlaceholderColour,
	expectStyle,
	expectTokenColour,
	hover,
	tabTo,
} from "../lib/story-checks";
import { Textarea } from "./textarea";

const meta = {
	title: "Controls/Textarea",
	component: Textarea,
	args: {
		label: "System prompt",
		description: "Sent to the model before every conversation.",
		defaultValue:
			"You answer questions about orders and refunds. Hand off to the billing agent for payment changes.",
		className: "w-dialog-m",
	},
} satisfies Meta<typeof Textarea>;

export default meta;
type Story = StoryObj<typeof meta>;

const box = (canvasElement: HTMLElement) =>
	within(canvasElement).getByRole("textbox");

export const Default: Story = {
	play: async ({ canvasElement }) => {
		const textarea = box(canvasElement);
		await expect(textarea).toHaveAccessibleName("System prompt");
		await expectStyle(textarea, "border-top-width", "2px");
		await expectStyle(textarea, "border-top-left-radius", "8px");
		await expectStyle(textarea, "padding-left", "12px");
	},
};

export const Hover: Story = {
	play: async ({ canvasElement }) => {
		const textarea = box(canvasElement);
		await hover(textarea);
		await expectTokenColour(textarea, "border-top-color", "border-text-muted");
	},
};

export const Focus: Story = {
	play: async ({ canvasElement }) => {
		const textarea = box(canvasElement);
		await tabTo(textarea);
		await expectFocusRing(textarea);
	},
};

/** Disabled wins: with a value, while invalid, and empty with a placeholder. */
export const Disabled: Story = {
	args: { isDisabled: true },
	render: (args) => (
		<div className="flex flex-col gap-4">
			<Textarea {...args} />
			<Textarea
				label="Instructions"
				defaultValue=""
				isDisabled
				isInvalid
				errorMessage="Enter instructions."
				className="w-dialog-m"
			/>
			<Textarea
				label="Notes"
				placeholder="What this agent is for"
				isDisabled
				className="w-dialog-m"
			/>
		</div>
	),
	play: async ({ canvasElement }) => {
		const boxes = within(canvasElement).getAllByRole("textbox");
		for (const textarea of boxes) {
			await expect(textarea).toBeDisabled();
			await expectTokenColour(
				textarea,
				"border-top-color",
				"border-disabled-border",
			);
		}
		await expectPlaceholderColour(
			boxes[2] as HTMLElement,
			"text-disabled-text",
		);
	},
};

export const Invalid: Story = {
	args: {
		defaultValue: "",
		isRequired: true,
		isInvalid: true,
		errorMessage: "Enter a system prompt.",
	},
	play: async ({ canvasElement }) => {
		const textarea = box(canvasElement);
		await expect(textarea).toHaveAttribute("aria-invalid", "true");
		await expectTokenColour(
			textarea,
			"border-top-color",
			"border-text-status-danger",
		);
	},
};

/** Read-only, as in P3's config forms: not editable, no hover change. */
export const ReadOnly: Story = {
	args: { isReadOnly: true, description: "Set in config.yaml." },
	play: async ({ canvasElement }) => {
		const textarea = box(canvasElement);
		await expect(textarea).toHaveAttribute("readonly");
		await hover(textarea);
		await expectTokenColour(
			textarea,
			"border-top-color",
			"border-border-control",
		);
	},
};
