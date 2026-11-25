import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import {
	expectHeight,
	expectNonTextContrastOnSurfaces,
	expectTokenColour,
	hover,
	pointerOver,
	settle,
	tabTo,
} from "../lib/story-checks";
import { Checkbox } from "./checkbox";

const meta = {
	title: "Controls/Checkbox",
	component: Checkbox,
	args: { children: "Configure a session store" },
} satisfies Meta<typeof Checkbox>;

export default meta;
type Story = StoryObj<typeof meta>;

const boxes = (canvasElement: HTMLElement) => [
	...canvasElement.querySelectorAll<HTMLElement>("[data-slot=checkbox-box]"),
];
const box = (canvasElement: HTMLElement) =>
	boxes(canvasElement)[0] as HTMLElement;

/**
 * Off, on and mixed: a 16 px box in a 32 px row. On and mixed show a mark, fill with the primary colour and
 * draw their edge in text-accent-primary, which holds 3:1 on all three surfaces (the fill alone does not in
 * light theme).
 */
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
		const [off, on, mixed] = boxes(canvasElement) as [
			HTMLElement,
			HTMLElement,
			HTMLElement,
		];
		await expect(off.getBoundingClientRect().width).toBe(16);
		await expect(getComputedStyle(off).borderTopWidth).toBe("2px");
		await expectTokenColour(off, "border-top-color", "border-border-control");
		for (const selected of [on, mixed]) {
			await expectTokenColour(
				selected,
				"background-color",
				"bg-accent-primary",
			);
			await expectTokenColour(
				selected,
				"border-top-color",
				"border-text-accent-primary",
			);
			await expectNonTextContrastOnSurfaces(selected, "border-top-color");
		}
		const marks = canvasElement.querySelectorAll("[data-slot=checkbox] svg");
		await expect(marks).toHaveLength(2);
	},
};

export const Hover: Story = {
	play: async ({ canvasElement }) => {
		const row = canvasElement.querySelector(
			"[data-slot=checkbox]",
		) as HTMLElement;
		await hover(row);
		await expectTokenColour(
			box(canvasElement),
			"border-top-color",
			"border-text-muted",
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

/** Disabled wins over everything: off, on, mixed and invalid all take the disabled colours. */
export const Disabled: Story = {
	render: (args) => (
		<div className="flex flex-col">
			<Checkbox {...args} isDisabled />
			<Checkbox defaultSelected isDisabled>
				Configure Redis
			</Checkbox>
			<Checkbox isIndeterminate isDisabled>
				Configure all stores
			</Checkbox>
			<Checkbox isInvalid defaultSelected isDisabled>
				I have read the deployment plan
			</Checkbox>
		</div>
	),
	play: async ({ canvasElement }) => {
		for (const checkbox of within(canvasElement).getAllByRole("checkbox")) {
			await expect(checkbox).toBeDisabled();
		}
		const [off, ...onBoxes] = boxes(canvasElement) as HTMLElement[];
		await expectTokenColour(
			off as HTMLElement,
			"border-top-color",
			"border-disabled-border",
		);
		for (const on of onBoxes) {
			await expectTokenColour(on, "background-color", "bg-disabled-fill");
			await expectTokenColour(on, "border-top-color", "border-disabled-border");
		}
	},
};

/** Invalid keeps the danger border, selected or not, and while hovered. */
export const Invalid: Story = {
	args: {
		children: "I have read the deployment plan",
		isInvalid: true,
		errorMessage: "Confirm the plan before deploying.",
	},
	render: (args) => (
		<div className="flex flex-col gap-2">
			<Checkbox {...args} />
			<Checkbox isInvalid defaultSelected>
				Configure Redis
			</Checkbox>
		</div>
	),
	play: async ({ canvasElement }) => {
		const checkbox = within(canvasElement).getByRole("checkbox", {
			name: "I have read the deployment plan",
		});
		await expect(checkbox).toHaveAttribute("aria-invalid", "true");
		await expect(checkbox).toHaveAccessibleDescription(
			"Confirm the plan before deploying.",
		);
		for (const b of boxes(canvasElement)) {
			await expectTokenColour(
				b,
				"border-top-color",
				"border-text-status-danger",
			);
		}
		await hover(
			canvasElement.querySelector("[data-slot=checkbox]") as HTMLElement,
		);
		await expectTokenColour(
			box(canvasElement),
			"border-top-color",
			"border-text-status-danger",
		);
	},
};

/** Read-only (P3's forms): shows its state, does not change on hover or press, and cannot be toggled. */
export const ReadOnly: Story = {
	render: () => (
		<div className="flex flex-col">
			<Checkbox isReadOnly>Configure a session store</Checkbox>
			<Checkbox isReadOnly defaultSelected>
				Configure Redis
			</Checkbox>
		</div>
	),
	play: async ({ canvasElement }) => {
		const [offRow, onRow] = [
			...canvasElement.querySelectorAll<HTMLElement>("[data-slot=checkbox]"),
		] as [HTMLElement, HTMLElement];
		const [off, on] = boxes(canvasElement) as [HTMLElement, HTMLElement];
		await pointerOver(offRow);
		await expectTokenColour(off, "border-top-color", "border-border-control");
		await pointerOver(onRow);
		await expectTokenColour(on, "background-color", "bg-accent-primary");
		const selected = within(onRow).getByRole("checkbox");
		await userEvent.click(onRow);
		await expect(selected).toBeChecked();
		await expectTokenColour(on, "background-color", "bg-accent-primary");
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
