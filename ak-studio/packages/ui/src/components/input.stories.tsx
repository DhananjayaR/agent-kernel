import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import {
	expectFocusRing,
	expectHeight,
	expectNoFocusRing,
	expectStyle,
	hover,
	tabTo,
} from "../lib/story-checks";
import { Input } from "./input";

const meta = {
	title: "Controls/Input",
	component: Input,
	args: {
		label: "Project name",
		description: "Used as the folder name.",
		defaultValue: "support-agent",
	},
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

const box = (canvasElement: HTMLElement) =>
	within(canvasElement).getByRole("textbox");

/** Spectrum 2 TextField: 32 px, 2 px control border, 8 px radius, 12 px padding, 14 px text, 208 px wide. */
export const Default: Story = {
	play: async ({ canvasElement }) => {
		const input = box(canvasElement);
		await expect(input).toHaveAccessibleName("Project name");
		await expect(input).toHaveAccessibleDescription("Used as the folder name.");
		await expectHeight(input, 32);
		await expectStyle(input, "border-top-width", "2px");
		await expectStyle(input, "border-top-left-radius", "8px");
		await expectStyle(input, "padding-left", "12px");
		await expectStyle(input, "font-size", "14px");
		await expect(input.getBoundingClientRect().width).toBe(208);
	},
};

/** Empty, with a hint. */
export const WithPlaceholder: Story = {
	args: { defaultValue: undefined, placeholder: "support-agent" },
};

/** Hover strengthens the border. */
export const Hover: Story = {
	play: async ({ canvasElement }) => {
		const input = box(canvasElement);
		const before = getComputedStyle(input).borderTopColor;
		await hover(input);
		await expect(getComputedStyle(input).borderTopColor).not.toBe(before);
	},
};

/** Keyboard focus: the ring, and the border in the text colour. */
export const Focus: Story = {
	play: async ({ canvasElement }) => {
		const input = box(canvasElement);
		await tabTo(input);
		await expectFocusRing(input);
	},
};

/** A pointer click focuses the field without the ring (keyboard focus only). */
export const PointerFocus: Story = {
	play: async ({ canvasElement }) => {
		const input = box(canvasElement);
		await userEvent.click(input);
		await expect(input).toHaveFocus();
		await expectNoFocusRing(input);
	},
};

export const Disabled: Story = {
	args: { isDisabled: true },
	play: async ({ canvasElement }) => {
		const input = box(canvasElement);
		await expect(input).toBeDisabled();
		await expectStyle(input, "opacity", "1");
	},
};

/** Invalid: danger border plus an error that says what to do, with an icon (never colour alone). */
export const Invalid: Story = {
	args: {
		defaultValue: "Support Agent",
		isInvalid: true,
		errorMessage: "Use lowercase letters, digits and hyphens.",
	},
	play: async ({ canvasElement }) => {
		const input = box(canvasElement);
		await expect(input).toHaveAttribute("aria-invalid", "true");
		await expect(
			within(canvasElement).getByText(
				"Use lowercase letters, digits and hyphens.",
			),
		).toBeVisible();
		await expect(canvasElement.querySelector("svg")).not.toBeNull();
	},
};

/** Read-only, as in P3's config forms: focusable and selectable, not editable. */
export const ReadOnly: Story = {
	args: { isReadOnly: true, description: "Set in config.yaml." },
	play: async ({ canvasElement }) => {
		await expect(box(canvasElement)).toHaveAttribute("readonly");
	},
};
