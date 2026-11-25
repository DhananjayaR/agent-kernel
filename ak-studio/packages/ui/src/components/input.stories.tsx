import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import {
	expectFocusRing,
	expectHeight,
	expectNoFocusRing,
	expectPlaceholderColour,
	expectStyle,
	expectTokenColour,
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
		await expectTokenColour(input, "border-top-color", "border-border-control");
	},
};

/** Empty, with a hint in muted text. */
export const WithPlaceholder: Story = {
	args: { defaultValue: undefined, placeholder: "support-agent" },
	play: async ({ canvasElement }) => {
		await expectPlaceholderColour(box(canvasElement), "text-text-muted");
	},
};

/** Hover strengthens the border to text-muted. */
export const Hover: Story = {
	play: async ({ canvasElement }) => {
		const input = box(canvasElement);
		await hover(input);
		await expectTokenColour(input, "border-top-color", "border-text-muted");
	},
};

/** Keyboard focus: the ring, and the border in the text colour. */
export const Focus: Story = {
	play: async ({ canvasElement }) => {
		const input = box(canvasElement);
		await tabTo(input);
		await expectFocusRing(input);
		await expectTokenColour(input, "border-top-color", "border-text");
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

/**
 * Disabled wins over everything: with a value, while invalid, and empty with a placeholder, the border, text and
 * placeholder all take the disabled colours (no danger border, no muted placeholder).
 */
export const Disabled: Story = {
	args: { isDisabled: true },
	render: (args) => (
		<div className="flex flex-col gap-4">
			<Input {...args} />
			<Input
				label="Port"
				defaultValue="80a"
				isDisabled
				isInvalid
				errorMessage="Enter a whole number."
			/>
			<Input label="Region" placeholder="eu-west-1" isDisabled />
		</div>
	),
	play: async ({ canvasElement }) => {
		const [withValue, invalid, empty] = within(canvasElement).getAllByRole(
			"textbox",
		) as [HTMLElement, HTMLElement, HTMLElement];
		for (const input of [withValue, invalid, empty]) {
			await expect(input).toBeDisabled();
			await expectStyle(input, "opacity", "1");
			await expectTokenColour(
				input,
				"border-top-color",
				"border-disabled-border",
			);
			await expectTokenColour(input, "color", "text-disabled-text");
		}
		await expectPlaceholderColour(empty, "text-disabled-text");
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
		await expectTokenColour(
			input,
			"border-top-color",
			"border-text-status-danger",
		);
		await expect(
			within(canvasElement).getByText(
				"Use lowercase letters, digits and hyphens.",
			),
		).toBeVisible();
		await expect(canvasElement.querySelector("svg")).not.toBeNull();
		// Invalid wins over hover and focus.
		await hover(input);
		await expectTokenColour(
			input,
			"border-top-color",
			"border-text-status-danger",
		);
		await tabTo(input);
		await expectTokenColour(
			input,
			"border-top-color",
			"border-text-status-danger",
		);
	},
};

/** Without an errorMessage, React Aria's own validation message is shown (here from `validate`). */
export const InvalidWithoutMessage: Story = {
	args: {
		defaultValue: "support agent",
		validationBehavior: "aria",
		validate: (value: string) =>
			value.includes(" ") ? "Use hyphens instead of spaces." : null,
	},
	play: async ({ canvasElement }) => {
		await expect(box(canvasElement)).toHaveAttribute("aria-invalid", "true");
		await expect(
			within(canvasElement).getByText("Use hyphens instead of spaces."),
		).toBeVisible();
	},
};

/** Read-only, as in P3's config forms: focusable and selectable, not editable, no hover change. */
export const ReadOnly: Story = {
	args: { isReadOnly: true, description: "Set in config.yaml." },
	play: async ({ canvasElement }) => {
		const input = box(canvasElement);
		await expect(input).toHaveAttribute("readonly");
		await hover(input);
		await expectTokenColour(input, "border-top-color", "border-border-control");
	},
};
