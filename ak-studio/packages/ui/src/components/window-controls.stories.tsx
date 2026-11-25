import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, userEvent, within } from "storybook/test";
import {
	expectHeight,
	expectInsetFocusRing,
	expectStyle,
	expectTokenColour,
	hover,
	tabTo,
} from "../lib/story-checks";
import { WindowControls } from "./window-controls";

const onMinimize = fn();
const onToggleMaximize = fn();
const onClose = fn();

const meta = {
	title: "Shell/Window controls",
	component: WindowControls,
	args: { maximized: false, onMinimize, onToggleMaximize, onClose },
	beforeEach: () => {
		for (const f of [onMinimize, onToggleMaximize, onClose]) f.mockClear();
	},
	// On the top bar's surface, 48 px tall, as in the app.
	render: (args) => (
		<div className="flex h-topbar items-center justify-end bg-surface-raised">
			<WindowControls {...args} />
		</div>
	),
} satisfies Meta<typeof WindowControls>;

export default meta;
type Story = StoryObj<typeof meta>;

const slot = (el: HTMLElement, name: string) =>
	el.querySelector(`[data-slot="${name}"]`) as HTMLElement;

/**
 * Normal: Minimise, Maximise and Close, each 40 px wide and the top bar's 48 px tall, square, quiet. Each press
 * reaches its own handler.
 */
export const Normal: Story = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const minimise = canvas.getByRole("button", { name: "Minimise" });
		const maximise = canvas.getByRole("button", { name: "Maximise" });
		const close = canvas.getByRole("button", { name: "Close" });
		await expect(canvas.getByRole("group", { name: "Window controls" })).toBe(
			slot(canvasElement, "window-controls"),
		);
		for (const button of [minimise, maximise, close]) {
			await expect(button.getBoundingClientRect().width).toBe(40);
			await expectHeight(button, 48);
			await expectStyle(button, "border-top-left-radius", "0px");
			await expectTokenColour(button, "background-color", "bg-transparent");
		}
		await userEvent.click(minimise);
		await userEvent.click(maximise);
		await userEvent.click(close);
		await expect(onMinimize).toHaveBeenCalledOnce();
		await expect(onToggleMaximize).toHaveBeenCalledOnce();
		await expect(onClose).toHaveBeenCalledOnce();
	},
};

/** Maximised: the middle button is named Restore and shows two squares. Pressing it reports a toggle. */
export const Maximised: Story = {
	args: { maximized: true },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.queryByRole("button", { name: "Maximise" })).toBeNull();
		const restore = canvas.getByRole("button", { name: "Restore" });
		await expect(slot(canvasElement, "window-controls")).toHaveAttribute(
			"data-maximized",
		);
		await userEvent.click(restore);
		await expect(onToggleMaximize).toHaveBeenCalledOnce();
	},
};

/** The name follows the state when the host flips it. */
export const NameFollowsState: Story = {
	render: (args) => {
		const [maximized, setMaximized] = useState(false);
		return (
			<div className="flex h-topbar items-center justify-end bg-surface-raised">
				<WindowControls
					{...args}
					maximized={maximized}
					onToggleMaximize={() => setMaximized((was) => !was)}
				/>
			</div>
		);
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(canvas.getByRole("button", { name: "Maximise" }));
		await expect(canvas.getByRole("button", { name: "Restore" })).toBeVisible();
		await userEvent.click(canvas.getByRole("button", { name: "Restore" }));
		await expect(
			canvas.getByRole("button", { name: "Maximise" }),
		).toBeVisible();
	},
};

/** Hover fills the neutral fill; Close fills with the danger colour and its on-colour. */
export const Hover: Story = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const maximise = canvas.getByRole("button", { name: "Maximise" });
		await hover(maximise);
		await expectTokenColour(maximise, "background-color", "bg-fill");
		const close = canvas.getByRole("button", { name: "Close" });
		await hover(close);
		await expectTokenColour(close, "background-color", "bg-status-danger");
		await expectTokenColour(close, "color", "text-on-status-danger");
	},
};

/** Keyboard: Tab reaches each button in turn and shows the focus ring (inside the button's edge: outside, the window would clip it). Enter presses it. */
export const KeyboardFocus: Story = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const minimise = canvas.getByRole("button", { name: "Minimise" });
		await tabTo(minimise);
		await expectInsetFocusRing(minimise);
		await userEvent.keyboard("{Enter}");
		await expect(onMinimize).toHaveBeenCalledOnce();
		await userEvent.tab();
		await expect(
			canvas.getByRole("button", { name: "Maximise" }),
		).toHaveFocus();
		await userEvent.tab();
		await expect(canvas.getByRole("button", { name: "Close" })).toHaveFocus();
	},
};

/** The buttons opt out of the top bar's drag region (a press must click, not drag the window). */
export const OutOfTheDragRegion: Story = {
	play: async ({ canvasElement }) => {
		for (const name of ["window-minimize", "window-maximize", "window-close"]) {
			const el = slot(canvasElement, name);
			await expect(
				getComputedStyle(el).getPropertyValue("-webkit-app-region") ||
					getComputedStyle(el).getPropertyValue("app-region"),
			).toBe("no-drag");
		}
	},
};
