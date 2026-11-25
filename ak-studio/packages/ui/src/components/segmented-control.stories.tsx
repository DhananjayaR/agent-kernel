import type { Meta, StoryObj } from "@storybook/react-vite";
import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { expect, userEvent, within } from "storybook/test";
import {
	expectFocusRing,
	expectHeight,
	expectTokenColour,
	hover,
	tabTo,
} from "../lib/story-checks";
import { SegmentedControl, SegmentedControlItem } from "./segmented-control";

const meta = {
	title: "Controls/Segmented control",
	component: SegmentedControl,
	args: {
		"aria-label": "Theme",
		defaultSelectedKey: "system",
		children: null,
	},
	render: (args) => (
		<SegmentedControl {...args}>
			<SegmentedControlItem id="system" icon={<MonitorIcon />}>
				System
			</SegmentedControlItem>
			<SegmentedControlItem id="light" icon={<SunIcon />}>
				Light
			</SegmentedControlItem>
			<SegmentedControlItem id="dark" icon={<MoonIcon />}>
				Dark
			</SegmentedControlItem>
		</SegmentedControl>
	),
} satisfies Meta<typeof SegmentedControl>;

export default meta;
type Story = StoryObj<typeof meta>;

const radio = (canvasElement: HTMLElement, name: string) =>
	within(canvasElement).getByRole("radio", { name });

/** A 32 px group; one segment is always selected (a radio group to assistive technology). */
export const Default: Story = {
	play: async ({ canvasElement }) => {
		const group = within(canvasElement).getByRole("radiogroup", {
			name: "Theme",
		});
		await expectHeight(group, 32);
		await expect(radio(canvasElement, "System")).toBeChecked();
	},
};

export const Hover: Story = {
	play: async ({ canvasElement }) => {
		const light = radio(canvasElement, "Light");
		const before = getComputedStyle(light).backgroundColor;
		await hover(light);
		await expect(getComputedStyle(light).backgroundColor).not.toBe(before);
	},
};

export const Focus: Story = {
	play: async ({ canvasElement }) => {
		const system = radio(canvasElement, "System");
		await tabTo(system);
		await expectFocusRing(system);
	},
};

export const Disabled: Story = {
	args: { isDisabled: true },
	play: async ({ canvasElement }) => {
		for (const item of within(canvasElement).getAllByRole("radio")) {
			await expect(item).toBeDisabled();
		}
		// Selected and disabled: the disabled colours win over the selected fill and its text.
		const system = radio(canvasElement, "System");
		await expectTokenColour(system, "background-color", "bg-disabled-fill");
		await expectTokenColour(system, "color", "text-disabled-text");
	},
};

/**
 * Keyboard (React Aria's toolbar model, checked here): arrows move focus without selecting; Space or Enter
 * selects; selecting the selected segment again keeps it (never empty). Tab leaves the group in a browser
 * (React Aria moves focus to the last segment on Tab keydown and lets the browser continue); the simulated
 * Tab of the test library does not reproduce that, so it is not asserted here.
 */
export const Keyboard: Story = {
	play: async ({ canvasElement }) => {
		const system = radio(canvasElement, "System");
		const light = radio(canvasElement, "Light");
		const dark = radio(canvasElement, "Dark");
		await tabTo(system);
		await userEvent.keyboard("{ArrowRight}");
		await expect(light).toHaveFocus();
		await expect(system).toBeChecked();
		await userEvent.keyboard("{ArrowRight}");
		await expect(dark).toHaveFocus();
		await userEvent.keyboard(" ");
		await expect(dark).toBeChecked();
		await expect(system).not.toBeChecked();
		await userEvent.keyboard("{ArrowLeft}{Enter}");
		await expect(light).toBeChecked();
		await userEvent.keyboard(" ");
		await expect(light).toBeChecked();
		// Pressed while selected keeps the selected (hover) fill, not the neutral pressed fill.
		await userEvent.keyboard("[Space>]");
		await expect(light).toHaveAttribute("data-pressed");
		await expectTokenColour(
			light,
			"background-color",
			"bg-accent-primary-hover",
		);
		await expectTokenColour(light, "color", "text-on-accent-primary");
		await userEvent.keyboard("[/Space]");
		await expect(light).toBeChecked();
	},
};
