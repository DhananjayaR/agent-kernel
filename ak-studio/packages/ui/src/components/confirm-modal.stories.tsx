import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import {
	expectFocusWithin,
	expectSolidLayer,
	expectTokenColour,
	settle,
	tabTo,
} from "../lib/story-checks";
import { Button } from "./button";
import { ConfirmModal } from "./confirm-modal";
import { PathChip } from "./path-chip";

const meta = {
	title: "Overlays/Confirm modal",
	component: ConfirmModal,
	args: {
		title: "Stop the local server?",
		trigger: <Button>Stop server</Button>,
		children: "Requests in progress are cancelled. You can start it again.",
		confirmLabel: "Stop server",
		onConfirm: fn(),
	},
} satisfies Meta<typeof ConfirmModal>;

export default meta;
type Story = StoryObj<typeof meta>;

const alertDialog = () => within(document.body).findByRole("alertdialog");

/** Default: an alert dialog; focus starts on the dialog, not on the action. */
export const Default: Story = {
	play: async ({ canvasElement, args }) => {
		const trigger = within(canvasElement).getByRole("button", {
			name: "Stop server",
		});
		await tabTo(trigger);
		await userEvent.keyboard("{Enter}");
		const el = await alertDialog();
		await expectFocusWithin(el);
		const action = within(el).getByRole("button", { name: "Stop server" });
		await expect(action).not.toHaveFocus();
		await expect(action).toHaveAttribute("data-variant", "primary");
		await expectSolidLayer(el.closest("[data-slot=modal]") as HTMLElement);
		await userEvent.click(action);
		await expect(args.onConfirm).toHaveBeenCalledOnce();
		await waitFor(() => expect(el).not.toBeInTheDocument());
		await waitFor(() => expect(trigger).toHaveFocus());
	},
};

const destructive = {
	variant: "destructive" as const,
	title: "Delete the agent triage?",
	trigger: <Button variant="danger">Delete agent</Button>,
	children:
		"The agent's definition is removed from app.py and its tools are unregistered. This cannot be undone.",
	affects: (
		<div className="flex flex-col items-start gap-1">
			<PathChip path="support-triage/app.py" />
			<PathChip path="support-triage/config.yaml" />
		</div>
	),
	confirmName: "triage",
	confirmLabel: "Delete agent",
};

/**
 * Destructive: names what it affects; the danger action stays disabled until the agent's name is typed exactly.
 * Focus starts in the name field, never on the action.
 */
export const Destructive: Story = {
	args: destructive,
	play: async ({ canvasElement, args }) => {
		const trigger = within(canvasElement).getByRole("button", {
			name: "Delete agent",
		});
		await tabTo(trigger);
		await userEvent.keyboard("{Enter}");
		const el = await alertDialog();
		const field = within(el).getByRole("textbox", {
			name: "Type triage to confirm",
		});
		await waitFor(() => expect(field).toHaveFocus());
		await expect(
			within(el).getByRole("region", { name: "This affects" }),
		).toHaveTextContent("app.py");
		const action = within(el).getByRole("button", { name: "Delete agent" });
		await expect(action).toHaveAttribute("data-variant", "danger");
		await expect(action).toBeDisabled();
		await userEvent.keyboard("Triage");
		await expect(action).toBeDisabled();
		await userEvent.clear(field);
		await userEvent.keyboard("triage ");
		await expect(action).toBeDisabled();
		// Enter in the field does nothing: the destructive action is never a default.
		await userEvent.keyboard("{Backspace}{Enter}");
		await expect(args.onConfirm).not.toHaveBeenCalled();
		await expect(action).toBeEnabled();
		await expectTokenColour(action, "background-color", "bg-status-danger");
		await userEvent.click(action);
		await expect(args.onConfirm).toHaveBeenCalledOnce();
		await waitFor(() => expect(el).not.toBeInTheDocument());
		await waitFor(() => expect(trigger).toHaveFocus());
	},
};

/** Escape cancels a destructive confirmation too (the safe direction); a click on the scrim does nothing. */
export const DestructiveCancel: Story = {
	args: destructive,
	play: async ({ canvasElement, args }) => {
		const trigger = within(canvasElement).getByRole("button", {
			name: "Delete agent",
		});
		await userEvent.click(trigger);
		let el = await alertDialog();
		await settle(el);
		await userEvent.click(
			el.closest("[data-slot=modal-overlay]") as HTMLElement,
		);
		await expect(el).toBeInTheDocument();
		// Focus stays contained in the dialog after the click.
		await expectFocusWithin(el);
		await userEvent.keyboard("{Escape}");
		await waitFor(() => expect(el).not.toBeInTheDocument());
		await waitFor(() => expect(trigger).toHaveFocus());
		// Cancel closes without acting; the typed name does not survive a reopen.
		await userEvent.keyboard("{Enter}");
		el = await alertDialog();
		const field = within(el).getByRole("textbox");
		await waitFor(() => expect(field).toHaveFocus());
		await userEvent.keyboard("triage");
		await userEvent.click(within(el).getByRole("button", { name: "Cancel" }));
		await waitFor(() => expect(el).not.toBeInTheDocument());
		await userEvent.keyboard("{Enter}");
		el = await alertDialog();
		await expect(within(el).getByRole("textbox")).toHaveValue("");
		await expect(args.onConfirm).not.toHaveBeenCalled();
	},
};
