import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import {
	expectHeight,
	expectTokenColour,
	hover,
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

const track = (canvasElement: HTMLElement) =>
	canvasElement.querySelector("[data-slot=switch-track]") as HTMLElement;

/** Off and on: a 28 x 16 track in a 32 px row; on fills and moves the thumb. */
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
		const rect = track(canvasElement).getBoundingClientRect();
		await expect([rect.width, rect.height]).toEqual([28, 16]);
	},
};

export const Hover: Story = {
	play: async ({ canvasElement }) => {
		const row = canvasElement.querySelector(
			"[data-slot=switch]",
		) as HTMLElement;
		const before = getComputedStyle(track(canvasElement)).borderTopColor;
		await hover(row);
		await settle(track(canvasElement));
		await expect(
			getComputedStyle(track(canvasElement)).borderTopColor,
		).not.toBe(before);
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
		// On and disabled: the disabled colours win over the selected fill.
		const tracks = canvasElement.querySelectorAll("[data-slot=switch-track]");
		const onTrack = tracks[1] as HTMLElement;
		await expectTokenColour(onTrack, "background-color", "bg-disabled-fill");
		await expectTokenColour(
			onTrack,
			"border-top-color",
			"border-disabled-border",
		);
		await expectTokenColour(
			onTrack.firstElementChild as HTMLElement,
			"background-color",
			"bg-disabled-text",
		);
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
