import type { Meta, StoryObj } from "@storybook/react-vite";
import { IconCopy } from "@tabler/icons-react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { hover, settle, tabTo } from "../lib/story-checks";
import { IconButton } from "./button";
import { Tooltip } from "./tooltip";

const meta = {
	title: "Display/Tooltip",
	component: Tooltip,
	args: {
		content: "Copy path",
		children: (
			<IconButton
				aria-label="Copy path"
				icon={<IconCopy aria-hidden="true" />}
			/>
		),
	},
	render: (args) => (
		<div className="flex flex-col gap-4 pt-12">
			<span
				data-probe
				aria-hidden="true"
				className="block size-4 bg-surface-overlay"
			/>
			<div>
				<Tooltip {...args} />
			</div>
		</div>
	),
} satisfies Meta<typeof Tooltip>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Open (as on hover): solid overlay surface in the story's theme, from a portal on <body>. */
export const Default: Story = {
	args: { defaultOpen: true },
	play: async ({ canvasElement }) => {
		const tooltip = await within(document.body).findByRole("tooltip");
		await settle(tooltip);
		await expect(tooltip).toHaveTextContent("Copy path");
		const probe = canvasElement.querySelector("[data-probe]") as HTMLElement;
		await expect(getComputedStyle(tooltip).backgroundColor).toBe(
			getComputedStyle(probe).backgroundColor,
		);
	},
};

/** Hover shows it after the delay. */
export const Hover: Story = {
	args: { delay: 0 },
	play: async ({ canvasElement }) => {
		// React Aria shows a tooltip on hover only in pointer modality: click the page first (earlier stories
		// may have left keyboard modality), then hover.
		await userEvent.click(canvasElement);
		await hover(within(canvasElement).getByRole("button"));
		await expect(
			await within(document.body).findByRole("tooltip"),
		).toBeVisible();
	},
};

/** Keyboard focus shows it at once; Escape hides it. */
export const Focus: Story = {
	play: async ({ canvasElement }) => {
		const button = within(canvasElement).getByRole("button");
		await tabTo(button);
		const tooltip = await within(document.body).findByRole("tooltip");
		await expect(button).toHaveAttribute("aria-describedby", tooltip.id);
		await userEvent.keyboard("{Escape}");
		await waitFor(() => expect(tooltip).not.toBeInTheDocument());
	},
};

/** A disabled trigger shows no tooltip. */
export const Disabled: Story = {
	args: {
		isDisabled: true,
		children: (
			<IconButton
				aria-label="Copy path"
				icon={<IconCopy aria-hidden="true" />}
				isDisabled
			/>
		),
	},
};
