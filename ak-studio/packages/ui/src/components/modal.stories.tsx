import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import {
	expectFocusRing,
	expectFocusWithin,
	expectSolidLayer,
	expectStyle,
	expectTokenColour,
	settle,
	tabTo,
} from "../lib/story-checks";
import { Button } from "./button";
import { Modal } from "./modal";

const meta = {
	title: "Overlays/Modal",
	component: Modal,
	args: {
		title: "Python environment",
		trigger: <Button>Show environment</Button>,
		children: (
			<p>
				The project runs on Python 3.12 from <code>.venv</code>. Agent Kernel
				0.9.2 is installed with the OpenAI Agents and LangGraph extras.
			</p>
		),
		actions: (close: () => void) => (
			<Button variant="primary" onPress={close}>
				Done
			</Button>
		),
	},
} satisfies Meta<typeof Modal>;

export default meta;
type Story = StoryObj<typeof meta>;

const dialog = () => within(document.body).findByRole("dialog");
const triggerOf = (canvasElement: HTMLElement) =>
	within(canvasElement).getByRole("button", { name: "Show environment" });

/**
 * Open: Spectrum 2 Dialog M on the solid overlay surface (480 px, 16 px radius, 32 px padding, 22/26 bold title),
 * over the scrim, in the story's theme.
 */
export const Open: Story = {
	args: { defaultOpen: true },
	play: async () => {
		const el = await dialog();
		const surface = el.closest("[data-slot=modal]") as HTMLElement;
		await expectSolidLayer(surface);
		await expect(surface.getBoundingClientRect().width).toBe(480);
		await expectStyle(surface, "border-top-left-radius", "16px");
		const heading = within(el).getByRole("heading", {
			name: "Python environment",
		});
		await expectStyle(heading, "font-size", "22px");
		await expectStyle(heading, "line-height", "26px");
		await expectStyle(heading, "font-weight", "700");
		await expectStyle(heading.parentElement as Element, "padding-left", "32px");
		const overlay = surface.closest("[data-slot=modal-overlay]") as HTMLElement;
		await expectTokenColour(overlay, "background-color", "bg-scrim");
		await expect(el).toHaveAccessibleName("Python environment");
	},
};

/** Focus moves into the modal when it opens and back to the trigger when Escape closes it. */
export const KeyboardAndEscape: Story = {
	play: async ({ canvasElement }) => {
		const trigger = triggerOf(canvasElement);
		await tabTo(trigger);
		await userEvent.keyboard("{Enter}");
		const el = await dialog();
		await expectFocusWithin(el);
		// Focus is contained: Tab cycles inside the dialog.
		await userEvent.tab();
		await expectFocusWithin(el);
		await userEvent.tab();
		await expectFocusWithin(el);
		await userEvent.keyboard("{Escape}");
		await waitFor(() => expect(el).not.toBeInTheDocument());
		await waitFor(() => expect(trigger).toHaveFocus());
	},
};

/** The close button: keyboard focus ring, and pressing it closes and returns focus. */
export const CloseButton: Story = {
	play: async ({ canvasElement }) => {
		const trigger = triggerOf(canvasElement);
		await tabTo(trigger);
		await userEvent.keyboard("{Enter}");
		const el = await dialog();
		const close = within(el).getByRole("button", { name: "Close" });
		await tabTo(close);
		await expectFocusRing(close);
		await userEvent.keyboard("{Enter}");
		await waitFor(() => expect(el).not.toBeInTheDocument());
		await waitFor(() => expect(trigger).toHaveFocus());
	},
};

/** A click on the scrim does not close a modal unless it is `isDismissable` (a stray click must not lose work). */
export const ScrimClick: Story = {
	play: async ({ canvasElement }) => {
		await userEvent.click(triggerOf(canvasElement));
		const el = await dialog();
		await settle(el);
		const overlay = el.closest("[data-slot=modal-overlay]") as HTMLElement;
		await userEvent.click(overlay);
		await expect(el).toBeInTheDocument();
	},
};

export const Dismissable: Story = {
	args: { isDismissable: true },
	play: async ({ canvasElement }) => {
		const trigger = triggerOf(canvasElement);
		await userEvent.click(trigger);
		const el = await dialog();
		await settle(el);
		const overlay = el.closest("[data-slot=modal-overlay]") as HTMLElement;
		await userEvent.click(overlay);
		await waitFor(() => expect(el).not.toBeInTheDocument());
	},
};

const openChanged = fn();

/** Opened from the caller's state, as the approval pattern and the unsaved-changes guard open it. */
function ControlledModal() {
	const [isOpen, setOpen] = useState(false);
	return (
		<>
			<Button onPress={() => setOpen(true)}>Review changes</Button>
			<Modal
				isOpen={isOpen}
				onOpenChange={(open) => {
					openChanged(open);
					setOpen(open);
				}}
				title="Unsaved changes in config.yaml"
				actions={(close) => <Button onPress={close}>Stay</Button>}
			>
				<p>The session store section has changes that are not saved.</p>
			</Modal>
		</>
	);
}

/**
 * Controlled (`isOpen` and `onOpenChange`, no trigger): focus moves in when the caller opens it; Escape asks the
 * caller to close it; focus returns to the element that had it.
 */
export const Controlled: Story = {
	render: () => <ControlledModal />,
	beforeEach: () => {
		openChanged.mockClear();
	},
	play: async ({ canvasElement }) => {
		const opener = within(canvasElement).getByRole("button", {
			name: "Review changes",
		});
		await tabTo(opener);
		await userEvent.keyboard("{Enter}");
		const el = await dialog();
		await expect(el).toHaveAccessibleName("Unsaved changes in config.yaml");
		await expectFocusWithin(el);
		await userEvent.keyboard("{Escape}");
		await expect(openChanged).toHaveBeenCalledWith(false);
		await waitFor(() => expect(el).not.toBeInTheDocument());
		await waitFor(() => expect(opener).toHaveFocus());
	},
};
