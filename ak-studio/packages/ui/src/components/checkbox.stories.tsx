import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { expectHeight, hover, settle, tabTo } from "../lib/story-checks";
import { Checkbox } from "./checkbox";

const meta = {
	title: "Controls/Checkbox",
	component: Checkbox,
	args: { children: "Configure a session store" },
} satisfies Meta<typeof Checkbox>;

export default meta;
type Story = StoryObj<typeof meta>;

const box = (canvasElement: HTMLElement) =>
	canvasElement.querySelector("[data-slot=checkbox-box]") as HTMLElement;

/** Off, on and mixed: a 16 px box in a 32 px row; on and mixed show a mark as well as the fill. */
export const Default: Story = {
	render: (args) => (
		<div className="flex flex-col">
			<Checkbox {...args} />
			<Checkbox defaultSelected>Configure Redis</Checkbox>
			<Checkbox isIndeterminate>Configure all stores</Checkbox>
		</div>
	),
	play: async ({ canvasElement }) => {
		const rows = canvasElement.querySelectorAll("[data-slot=checkbox]");
		for (const row of rows) await expectHeight(row, 32);
		const first = box(canvasElement);
		await expect(first.getBoundingClientRect().width).toBe(16);
		await expect(getComputedStyle(first).borderTopWidth).toBe("2px");
		const marks = canvasElement.querySelectorAll("[data-slot=checkbox] svg");
		await expect(marks).toHaveLength(2);
	},
};

export const Hover: Story = {
	play: async ({ canvasElement }) => {
		const row = canvasElement.querySelector(
			"[data-slot=checkbox]",
		) as HTMLElement;
		const before = getComputedStyle(box(canvasElement)).borderTopColor;
		await hover(row);
		await settle(box(canvasElement));
		await expect(getComputedStyle(box(canvasElement)).borderTopColor).not.toBe(
			before,
		);
	},
};

/** Keyboard focus rings the box (2 px, 2 px gap). */
export const Focus: Story = {
	play: async ({ canvasElement }) => {
		const checkbox = within(canvasElement).getByRole("checkbox");
		await tabTo(checkbox);
		const row = canvasElement.querySelector(
			"[data-slot=checkbox]",
		) as HTMLElement;
		await expect(row).toHaveAttribute("data-focus-visible");
		await settle(row);
		const style = getComputedStyle(box(canvasElement));
		await expect(style.outlineStyle).toBe("solid");
		await expect(style.outlineWidth).toBe("2px");
		await expect(style.outlineOffset).toBe("2px");
	},
};

export const Disabled: Story = {
	render: (args) => (
		<div className="flex flex-col">
			<Checkbox {...args} isDisabled />
			<Checkbox defaultSelected isDisabled>
				Configure Redis
			</Checkbox>
		</div>
	),
	play: async ({ canvasElement }) => {
		for (const checkbox of within(canvasElement).getAllByRole("checkbox")) {
			await expect(checkbox).toBeDisabled();
		}
	},
};

export const Invalid: Story = {
	args: {
		children: "I have read the deployment plan",
		isInvalid: true,
		errorMessage: "Confirm the plan before deploying.",
	},
	play: async ({ canvasElement }) => {
		const checkbox = within(canvasElement).getByRole("checkbox");
		await expect(checkbox).toHaveAttribute("aria-invalid", "true");
		await expect(checkbox).toHaveAccessibleDescription(
			"Confirm the plan before deploying.",
		);
	},
};

/** Keyboard: Tab reaches the checkbox, Space toggles it on and off. */
export const Keyboard: Story = {
	play: async ({ canvasElement }) => {
		const checkbox = within(canvasElement).getByRole("checkbox");
		await tabTo(checkbox);
		await expect(checkbox).not.toBeChecked();
		await userEvent.keyboard(" ");
		await expect(checkbox).toBeChecked();
		await userEvent.keyboard(" ");
		await expect(checkbox).not.toBeChecked();
	},
};
