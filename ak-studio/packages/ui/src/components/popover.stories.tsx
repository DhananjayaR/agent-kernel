import type { Meta, StoryObj } from "@storybook/react-vite";
import { IconInfoCircle } from "@tabler/icons-react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import {
	expectFocusWithin,
	expectSolidLayer,
	expectStyle,
	settle,
	tabTo,
} from "../lib/story-checks";
import { IconButton } from "./button";
import { Popover } from "./popover";

const meta = {
	title: "Overlays/Popover",
	component: Popover,
	args: {
		title: "Agent Kernel 0.9.2",
		trigger: (
			<IconButton
				aria-label="About this version"
				icon={<IconInfoCircle aria-hidden="true" />}
			/>
		),
		children: (
			<p>
				Read from the installed package in <code>.venv</code>. The lock file
				agrees.
			</p>
		),
	},
	render: (args) => (
		<div className="flex h-64 items-start">
			<Popover {...args} />
		</div>
	),
} satisfies Meta<typeof Popover>;

export default meta;
type Story = StoryObj<typeof meta>;

const triggerOf = (canvasElement: HTMLElement) =>
	within(canvasElement).getByRole("button", { name: "About this version" });

/** Open: the solid floating layer (overlay surface, elevated shadow, 10 px radius), at most 336 px wide. */
export const Open: Story = {
	args: { defaultOpen: true },
	play: async () => {
		const el = await within(document.body).findByRole("dialog", {
			name: "Agent Kernel 0.9.2",
		});
		const layer = el.closest("[data-slot=popover]") as HTMLElement;
		await expectSolidLayer(layer);
		await expectStyle(layer, "border-top-left-radius", "10px");
		await expectStyle(layer, "padding-left", "12px");
		await expect(layer.getBoundingClientRect().width).toBeLessThanOrEqual(336);
	},
};

/** Keyboard: Enter opens it and focus moves in; Escape closes it and focus returns to the trigger. */
export const Keyboard: Story = {
	play: async ({ canvasElement }) => {
		const trigger = triggerOf(canvasElement);
		await tabTo(trigger);
		await userEvent.keyboard("{Enter}");
		const el = await within(document.body).findByRole("dialog");
		await expectFocusWithin(el);
		await userEvent.keyboard("{Escape}");
		await waitFor(() => expect(el).not.toBeInTheDocument());
		await waitFor(() => expect(trigger).toHaveFocus());
	},
};

/** A click outside closes it (it holds no work to lose). */
export const ClickOutside: Story = {
	play: async ({ canvasElement }) => {
		await userEvent.click(triggerOf(canvasElement));
		const el = await within(document.body).findByRole("dialog");
		await settle(el);
		await userEvent.click(document.body);
		await waitFor(() => expect(el).not.toBeInTheDocument());
	},
};
