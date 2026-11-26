// UnsavedChangesDialog's states (P1b gate step 4, design gate row (c)): it names what is unsaved, Save (primary),
// Discard and Stay; Escape stays; a save on its way; a save that failed (the dialog stays open with what happened);
// and the keyboard (focus moves in, Tab wraps inside, focus returns to the trigger). Each story opens it from a
// trigger, standing in for leaving a tab with unsaved edits.
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { expectFocusRing, expectSolidLayer } from "../lib/story-checks";
import { Button } from "./button";
import {
	UnsavedChangesDialog,
	type UnsavedChangesDialogProps,
} from "./unsaved-changes-dialog";

/** A trigger standing in for "leave this tab"; each answer closes the dialog, as the guard does once it resolves. */
function WithTrigger({
	onSave,
	onDiscard,
	onStay,
	closeOnSave = true,
	...props
}: Omit<UnsavedChangesDialogProps, "isOpen"> & { closeOnSave?: boolean }) {
	const [open, setOpen] = useState(false);
	return (
		<>
			<Button variant="outline" onPress={() => setOpen(true)}>
				Leave this tab
			</Button>
			<UnsavedChangesDialog
				{...props}
				isOpen={open}
				onSave={() => {
					onSave();
					if (closeOnSave) setOpen(false);
				}}
				onDiscard={() => {
					onDiscard();
					setOpen(false);
				}}
				onStay={() => {
					onStay();
					setOpen(false);
				}}
			/>
		</>
	);
}

const meta = {
	title: "Patterns/Unsaved changes",
	component: UnsavedChangesDialog,
	args: {
		isOpen: true,
		what: "config.yaml",
		files: ["src/support/config.yaml"],
		onSave: fn(),
		onDiscard: fn(),
		onStay: fn(),
	},
	render: ({ isOpen: _open, ...args }) => <WithTrigger {...args} />,
} satisfies Meta<typeof UnsavedChangesDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

const body = () => within(document.body);
const trigger = (root: HTMLElement) =>
	within(root).getByRole("button", { name: "Leave this tab" });
/** Opens the dialog from its trigger by keyboard and answers it. */
const open = async (root: HTMLElement) => {
	trigger(root).focus();
	await userEvent.keyboard("{Enter}");
	return body().findByRole("alertdialog", {
		name: "Unsaved changes in config.yaml",
	});
};

/** Open: it names what is unsaved (title and file), Save is the primary action, focus starts on the dialog. */
export const Default: Story = {
	play: async ({ canvasElement }) => {
		const dialog = await open(canvasElement);
		await expectSolidLayer(dialog.closest("[data-slot=modal]") as HTMLElement);
		await expect(dialog).toHaveTextContent(
			"Save them before you leave, or discard them.",
		);
		await expect(
			dialog.querySelector("[data-slot=path-chip]"),
		).toHaveTextContent("config.yaml");
		const buttons = within(dialog).getAllByRole("button");
		await expect(buttons.map((b) => b.textContent)).toEqual([
			"Stay",
			"Discard changes",
			"Save",
		]);
		await expect(
			within(dialog).getByRole("button", { name: "Save" }),
		).toHaveAttribute("data-variant", "primary");
		await waitFor(() => expect(dialog).toHaveFocus());
	},
};

/** Save: the caller saves, then leaves. */
export const Save: Story = {
	play: async ({ canvasElement, args }) => {
		const dialog = await open(canvasElement);
		await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));
		await expect(args.onSave).toHaveBeenCalledOnce();
		await expect(args.onDiscard).not.toHaveBeenCalled();
		await waitFor(() => expect(body().queryByRole("alertdialog")).toBeNull());
		await waitFor(() => expect(trigger(canvasElement)).toHaveFocus());
		// For the screenshot: open again (focus came back to the trigger).
		await open(canvasElement);
	},
};

/** Discard: the changes are dropped and the person leaves. */
export const Discard: Story = {
	play: async ({ canvasElement, args }) => {
		const dialog = await open(canvasElement);
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Discard changes" }),
		);
		await expect(args.onDiscard).toHaveBeenCalledOnce();
		await expect(args.onSave).not.toHaveBeenCalled();
		await waitFor(() => expect(trigger(canvasElement)).toHaveFocus());
		// For the screenshot: open again (focus came back to the trigger).
		await open(canvasElement);
	},
};

/** Escape stays, as "Stay" does: nothing is saved or dropped, and focus returns to the trigger. */
export const EscapeStays: Story = {
	play: async ({ canvasElement, args }) => {
		await open(canvasElement);
		await userEvent.keyboard("{Escape}");
		await expect(args.onStay).toHaveBeenCalledOnce();
		await expect(args.onSave).not.toHaveBeenCalled();
		await expect(args.onDiscard).not.toHaveBeenCalled();
		await waitFor(() => expect(body().queryByRole("alertdialog")).toBeNull());
		await waitFor(() => expect(trigger(canvasElement)).toHaveFocus());
		// For the screenshot: open again (focus came back to the trigger).
		await open(canvasElement);
	},
};

/** A save on its way: Save is pending (presses ignored), Stay and Discard are disabled, and Escape does nothing. */
export const Saving: Story = {
	args: { saving: true, pending: true },
	play: async ({ canvasElement, args }) => {
		const dialog = await open(canvasElement);
		const save = within(dialog).getByRole("button", { name: "Save" });
		await expect(save).toHaveAttribute("data-pending");
		await userEvent.click(save);
		await expect(args.onSave).not.toHaveBeenCalled();
		await expect(
			within(dialog).getByRole("button", { name: "Stay" }),
		).toBeDisabled();
		await expect(
			within(dialog).getByRole("button", { name: "Discard changes" }),
		).toBeDisabled();
		// Escape does not leave the save either: its answer decides.
		await userEvent.keyboard("{Escape}");
		await expect(args.onStay).not.toHaveBeenCalled();
		await expect(body().getByRole("alertdialog")).toBeVisible();
	},
};

/** Several views unsaved at once: one dialog names them all, with each file; Save, Discard and Stay answer for all. */
export const SeveralItems: Story = {
	args: {
		what: "config.yaml and the session section",
		files: ["src/support/config.yaml", "src/support/sessions.yaml"],
	},
	play: async ({ canvasElement }) => {
		trigger(canvasElement).focus();
		await userEvent.keyboard("{Enter}");
		const dialog = await body().findByRole("alertdialog", {
			name: "Unsaved changes in config.yaml and the session section",
		});
		await expect(dialog.querySelectorAll("[data-slot=path-chip]")).toHaveLength(
			2,
		);
	},
};

/** The save failed: the dialog stays open with what happened and what to do, so the person can try again. */
export const SaveFailed: Story = {
	args: {
		closeOnSave: false,
		error: {
			title: "The file changed on disk",
			description:
				"Someone else saved config.yaml while you were editing. Stay to compare, or discard your changes.",
		},
	} as Story["args"],
	play: async ({ canvasElement }) => {
		const dialog = await open(canvasElement);
		const alert = within(dialog).getByRole("alert");
		await expect(alert).toHaveTextContent("The file changed on disk");
		await expect(
			within(dialog).getByRole("button", { name: "Save" }),
		).toBeEnabled();
	},
};

/** The keyboard: Tab from the dialog reaches Stay, Discard and Save in order, and wraps inside; Enter presses. */
export const Keyboard: Story = {
	args: { files: undefined },
	play: async ({ canvasElement, args }) => {
		const dialog = await open(canvasElement);
		await waitFor(() => expect(dialog).toHaveFocus());
		await userEvent.tab();
		const stay = within(dialog).getByRole("button", { name: "Stay" });
		await expect(stay).toHaveFocus();
		await expectFocusRing(stay);
		await userEvent.tab();
		await expect(
			within(dialog).getByRole("button", { name: "Discard changes" }),
		).toHaveFocus();
		await userEvent.tab();
		const save = within(dialog).getByRole("button", { name: "Save" });
		await expect(save).toHaveFocus();
		await userEvent.tab();
		await expect(stay).toHaveFocus();
		await userEvent.tab({ shift: true });
		await expect(save).toHaveFocus();
		await userEvent.keyboard("{Enter}");
		await expect(args.onSave).toHaveBeenCalledOnce();
		await waitFor(() => expect(trigger(canvasElement)).toHaveFocus());
		// For the screenshot: open again (focus came back to the trigger).
		await open(canvasElement);
	},
};
