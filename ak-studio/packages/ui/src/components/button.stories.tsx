import type { Meta, StoryObj } from "@storybook/react-vite";
import { CopyIcon, FolderOpenIcon, PlusIcon, Trash2Icon } from "lucide-react";
import type { ReactNode } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import {
	expectDisabledLook,
	expectFocusRing,
	expectHeight,
	expectStyle,
	expectTokenColour,
	hover,
	settle,
	tabTo,
} from "../lib/story-checks";
import { Button, IconButton } from "./button";

const meta = {
	title: "Controls/Button",
	component: Button,
	args: { children: "Open folder" },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

function Row({ children }: { children: ReactNode }) {
	return <div className="flex flex-wrap items-center gap-3">{children}</div>;
}

/** Every variant at rest: 32 px; buttons are pills with 16 px padding, ghost is Spectrum's 8 px ActionButton. */
export const Default: Story = {
	render: () => (
		<Row>
			<Button variant="primary" icon={<FolderOpenIcon />}>
				Open folder
			</Button>
			<Button variant="secondary">Show commands</Button>
			<Button variant="outline">Check again</Button>
			<Button variant="ghost">Clear list</Button>
			<Button variant="danger" icon={<Trash2Icon />}>
				Remove project
			</Button>
			<Button variant="danger">Destroy deployment</Button>
			<IconButton aria-label="Copy path" icon={<CopyIcon />} />
			<IconButton
				aria-label="Add project"
				variant="outline"
				icon={<PlusIcon />}
			/>
		</Row>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		for (const button of canvas.getAllByRole("button")) {
			await expectHeight(button, 32);
		}
		const primary = canvas.getByRole("button", { name: "Open folder" });
		await expectStyle(primary, "border-top-left-radius", "9999px");
		await expectStyle(primary, "padding-left", "16px");
		await expectStyle(primary, "font-weight", "700");
		await expectStyle(primary, "font-size", "14px");
		const ghost = canvas.getByRole("button", { name: "Clear list" });
		await expectStyle(ghost, "border-top-left-radius", "8px");
		await expectStyle(ghost, "padding-left", "12px");
		await expectStyle(ghost, "font-weight", "500");
		const outline = canvas.getByRole("button", { name: "Check again" });
		await expectStyle(outline, "border-top-width", "2px");
		const icon = canvas.getByRole("button", { name: "Copy path" });
		await expect(icon.getBoundingClientRect().width).toBe(32);
		await expectStyle(icon, "border-top-left-radius", "8px");
		// Danger is never colour alone: it always carries an icon.
		const danger = canvas.getByRole("button", { name: "Destroy deployment" });
		await expect(danger.querySelector("svg")).not.toBeNull();
	},
};

/** Primary, hovered: the next colour stop (accent-primary-hover); its text stays at 4.5:1. */
export const Hover: Story = {
	args: { variant: "primary" },
	play: async ({ canvasElement }) => {
		const button = within(canvasElement).getByRole("button");
		const before = getComputedStyle(button).backgroundColor;
		await hover(button);
		await waitFor(() =>
			expect(getComputedStyle(button).backgroundColor).not.toBe(before),
		);
		await settle(button);
	},
};

/** Danger, hovered. */
export const HoverDanger: Story = {
	args: { variant: "danger", children: "Destroy deployment" },
	play: Hover.play,
};

/** Secondary, pressed: Spectrum's 2 px push-in. */
export const Pressed: Story = {
	args: { variant: "secondary", children: "Show commands" },
	play: async ({ canvasElement }) => {
		const button = within(canvasElement).getByRole("button");
		await userEvent.pointer({ keys: "[MouseLeft>]", target: button });
		await expect(button).toHaveAttribute("data-pressed");
		await expect(getComputedStyle(button).transform).not.toBe("none");
		await userEvent.pointer({ keys: "[/MouseLeft]", target: button });
	},
};

/** Keyboard focus: a 2 px ring, 2 px from the button. */
export const Focus: Story = {
	args: { variant: "primary" },
	play: async ({ canvasElement }) => {
		const button = within(canvasElement).getByRole("button");
		await tabTo(button);
		await expectFocusRing(button);
	},
};

/** A pointer press shows no ring (keyboard focus only). */
export const PointerFocus: Story = {
	args: { variant: "primary" },
	play: async ({ canvasElement }) => {
		const button = within(canvasElement).getByRole("button");
		await userEvent.click(button);
		await expect(button).not.toHaveAttribute("data-focus-visible");
		await expectStyle(button, "outline-style", "none");
	},
};

/** Disabled: dedicated colours, not opacity. */
export const Disabled: Story = {
	render: () => (
		<Row>
			<Button variant="primary" isDisabled>
				Open folder
			</Button>
			<Button variant="secondary" isDisabled>
				Show commands
			</Button>
			<Button variant="outline" isDisabled>
				Check again
			</Button>
			<Button variant="ghost" isDisabled>
				Clear list
			</Button>
			<Button variant="danger" isDisabled>
				Destroy deployment
			</Button>
			<IconButton aria-label="Copy path" icon={<CopyIcon />} isDisabled />
		</Row>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		for (const button of canvas.getAllByRole("button")) {
			await expect(button).toBeDisabled();
			await expectDisabledLook(button);
			await expectTokenColour(button, "color", "text-disabled-text");
		}
		// The filled variants take the disabled fill instead of their own.
		for (const name of ["Open folder", "Show commands", "Destroy deployment"]) {
			await expectTokenColour(
				canvas.getByRole("button", { name }),
				"background-color",
				"bg-disabled-fill",
			);
		}
		await expectTokenColour(
			canvas.getByRole("button", { name: "Check again" }),
			"border-top-color",
			"border-disabled-border",
		);
	},
};

/** Pending: focusable, presses ignored, the leading icon becomes a spinner. */
export const Pending: Story = {
	args: { variant: "primary", children: "Check toolchain", isPending: true },
	play: async ({ canvasElement }) => {
		const button = within(canvasElement).getByRole("button");
		await expect(button).toHaveAttribute("data-pending");
		await expect(button.querySelector("svg.animate-spin")).not.toBeNull();
	},
};
