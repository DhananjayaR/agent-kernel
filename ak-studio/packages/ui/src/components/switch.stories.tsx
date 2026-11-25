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
import { Switch } from "./switch";

const meta = {
	title: "Controls/Switch",
	component: Switch,
	args: { children: "Debug logging" },
} satisfies Meta<typeof Switch>;

export default meta;
type Story = StoryObj<typeof meta>;

const tracks = (canvasElement: HTMLElement) => [
	...canvasElement.querySelectorAll<HTMLElement>("[data-slot=switch-track]"),
];
const track = (canvasElement: HTMLElement) =>
	tracks(canvasElement)[0] as HTMLElement;
const thumb = (t: HTMLElement) => t.firstElementChild as HTMLElement;

/**
 * Off and on: a 28 x 16 track in a 32 px row. On fills, moves the thumb and draws the track's edge in
 * text-accent-primary, which holds 3:1 on all three surfaces.
 */
export const Default: Story = {
	render: (args) => (
		<div className="flex flex-col">
			<Switch {...args} />
			<Switch defaultSelected>Stream responses</Switch>
		</div>
	),
	play: async ({ canvasElement }) => {
		for (const row of canvasElement.querySelectorAll("[data-slot=switch]")) {
			await expectHeight(row, 32);
		}
		const [off, on] = tracks(canvasElement) as [HTMLElement, HTMLElement];
		const rect = off.getBoundingClientRect();
		await expect([rect.width, rect.height]).toEqual([28, 16]);
		await expectTokenColour(off, "border-top-color", "border-border-control");
		await expectTokenColour(on, "background-color", "bg-accent-primary");
		await expectTokenColour(
			on,
			"border-top-color",
			"border-text-accent-primary",
		);
		await expectNonTextContrastOnSurfaces(on, "border-top-color");
		await expectTokenColour(
			thumb(on),
			"background-color",
			"bg-on-accent-primary",
		);
	},
};

export const Hover: Story = {
	play: async ({ canvasElement }) => {
		const row = canvasElement.querySelector(
			"[data-slot=switch]",
		) as HTMLElement;
		await hover(row);
		await expectTokenColour(
			track(canvasElement),
			"border-top-color",
			"border-text-muted",
		);
	},
};

export const Focus: Story = {
	play: async ({ canvasElement }) => {
		const control = within(canvasElement).getByRole("switch");
		await tabTo(control);
		await settle(track(canvasElement));
		const style = getComputedStyle(track(canvasElement));
		await expect(style.outlineStyle).toBe("solid");
		await expect(style.outlineWidth).toBe("2px");
		await expect(style.outlineOffset).toBe("2px");
	},
};

/** Disabled wins: off and on both take the disabled colours, thumb included. */
export const Disabled: Story = {
	render: (args) => (
		<div className="flex flex-col">
			<Switch {...args} isDisabled />
			<Switch defaultSelected isDisabled>
				Stream responses
			</Switch>
		</div>
	),
	play: async ({ canvasElement }) => {
		for (const control of within(canvasElement).getAllByRole("switch")) {
			await expect(control).toBeDisabled();
		}
		const [off, on] = tracks(canvasElement) as [HTMLElement, HTMLElement];
		await expectTokenColour(off, "border-top-color", "border-disabled-border");
		await expectTokenColour(on, "background-color", "bg-disabled-fill");
		await expectTokenColour(on, "border-top-color", "border-disabled-border");
		await expectTokenColour(thumb(on), "background-color", "bg-disabled-text");
	},
};

/** Read-only (P3's forms): shows its state, does not change on hover or press, and cannot be toggled. */
export const ReadOnly: Story = {
	render: () => (
		<div className="flex flex-col">
			<Switch isReadOnly>Debug logging</Switch>
			<Switch isReadOnly defaultSelected>
				Stream responses
			</Switch>
		</div>
	),
	play: async ({ canvasElement }) => {
		const [offRow, onRow] = [
			...canvasElement.querySelectorAll<HTMLElement>("[data-slot=switch]"),
		] as [HTMLElement, HTMLElement];
		const [off, on] = tracks(canvasElement) as [HTMLElement, HTMLElement];
		await pointerOver(offRow);
		await expectTokenColour(off, "border-top-color", "border-border-control");
		await pointerOver(onRow);
		await expectTokenColour(on, "background-color", "bg-accent-primary");
		await userEvent.click(onRow);
		await expect(within(onRow).getByRole("switch")).toBeChecked();
		await expectTokenColour(on, "background-color", "bg-accent-primary");
	},
};

/** Keyboard: Space turns it on and off. */
export const Keyboard: Story = {
	play: async ({ canvasElement }) => {
		const control = within(canvasElement).getByRole("switch");
		await tabTo(control);
		await userEvent.keyboard(" ");
		await expect(control).toBeChecked();
		await userEvent.keyboard(" ");
		await expect(control).not.toBeChecked();
	},
};
