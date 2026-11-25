import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import {
	expectFocusRing,
	expectStyle,
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
		const before = getComputedStyle(textarea).borderTopColor;
		await hover(textarea);
		await expect(getComputedStyle(textarea).borderTopColor).not.toBe(before);
	},
};

export const Focus: Story = {
	play: async ({ canvasElement }) => {
		const textarea = box(canvasElement);
		await tabTo(textarea);
		await expectFocusRing(textarea);
	},
};

export const Disabled: Story = {
	args: { isDisabled: true },
	play: async ({ canvasElement }) => {
		await expect(box(canvasElement)).toBeDisabled();
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
		await expect(box(canvasElement)).toHaveAttribute("aria-invalid", "true");
	},
};
