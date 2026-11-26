import type { Meta, StoryObj } from "@storybook/react-vite";
import { IconDots } from "@tabler/icons-react";
import { useState } from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import {
	expectFocusWithin,
	expectSolidLayer,
	expectTokenColour,
	settle,
	tabTo,
} from "../lib/story-checks";
import { Button, IconButton } from "./button";
import { ConfirmModal } from "./confirm-modal";
import { Menu, MenuItem } from "./menu";
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
		await expect(el).toHaveAccessibleDescription(
			"Requests in progress are cancelled. You can start it again.",
		);
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
		// What will happen and what it affects are the dialog's description, read when it opens.
		await expect(el).toHaveAccessibleDescription(
			/removed from app\.py.*This affects.*support-triage\/app\.py/,
		);
		await expect(
			within(el).getByRole("region", { name: "This affects" }),
		).toHaveTextContent("app.py");
		// The actions are in the footer, outside the scrolling body.
		const body = el.querySelector("[data-slot=modal-body]") as HTMLElement;
		await expect(
			body.contains(within(el).getByRole("button", { name: "Delete agent" })),
		).toBe(false);
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

/** Controlled by the caller (a job waiting for an answer opens it); confirming closes it through `onOpenChange`. */
function ControlledConfirm({ onConfirm }: { onConfirm: () => void }) {
	const [isOpen, setOpen] = useState(false);
	return (
		<>
			<Button onPress={() => setOpen(true)}>Answer the job</Button>
			<ConfirmModal
				isOpen={isOpen}
				onOpenChange={setOpen}
				title="Install the LangGraph extra?"
				confirmLabel="Install extra"
				onConfirm={onConfirm}
				affects={<PathChip path="support-triage/pyproject.toml" />}
			>
				uv adds agentkernel[langgraph] to the project and syncs the environment.
			</ConfirmModal>
		</>
	);
}

export const Controlled: Story = {
	render: (args) => <ControlledConfirm onConfirm={args.onConfirm} />,
	play: async ({ canvasElement, args }) => {
		const opener = within(canvasElement).getByRole("button", {
			name: "Answer the job",
		});
		await tabTo(opener);
		await userEvent.keyboard("{Enter}");
		const el = await alertDialog();
		await expectFocusWithin(el);
		await userEvent.click(
			within(el).getByRole("button", { name: "Install extra" }),
		);
		await expect(args.onConfirm).toHaveBeenCalledOnce();
		await waitFor(() => expect(el).not.toBeInTheDocument());
		await waitFor(() => expect(opener).toHaveFocus());
	},
};

const emptyName: string = "";

/**
 * A destructive confirmation whose name came back empty never enables its action (an empty literal is also a type
 * error: `confirmName=""` does not compile).
 */
export const DestructiveEmptyName: Story = {
	args: { ...destructive, confirmName: emptyName, defaultOpen: true },
	play: async ({ args }) => {
		const el = await alertDialog();
		const action = within(el).getByRole("button", { name: "Delete agent" });
		await expect(action).toBeDisabled();
		await userEvent.click(action);
		await expect(args.onConfirm).not.toHaveBeenCalled();
	},
};

/** The name is put into the field's label literally: `$&` and `$'` are not replacement patterns. */
export const NameWithDollarPatterns: Story = {
	args: { ...destructive, confirmName: "$&-agent$'", defaultOpen: true },
	play: async () => {
		const el = await alertDialog();
		const field = within(el).getByRole("textbox", {
			name: "Type $&-agent$' to confirm",
		});
		await userEvent.type(field, "$&-agent$'");
		await expect(
			within(el).getByRole("button", { name: "Delete agent" }),
		).toBeEnabled();
	},
};

/**
 * A destructive menu item opens a ConfirmModal (menu.tsx: destructive actions never run from a menu item
 * directly). After the answer, focus returns to the menu's trigger.
 */
function MenuThenConfirm({ onConfirm }: { onConfirm: () => void }) {
	const [isOpen, setOpen] = useState(false);
	return (
		<>
			<Menu
				trigger={
					<IconButton
						aria-label="Agent actions"
						icon={<IconDots aria-hidden="true" />}
					/>
				}
				onAction={(key) => {
					if (key === "delete") setOpen(true);
				}}
			>
				<MenuItem id="rename">Rename agent</MenuItem>
				<MenuItem id="delete">Delete agent</MenuItem>
			</Menu>
			<ConfirmModal
				{...destructive}
				trigger={undefined}
				isOpen={isOpen}
				onOpenChange={setOpen}
				onConfirm={onConfirm}
			/>
		</>
	);
}

export const FromAMenuItem: Story = {
	render: (args) => <MenuThenConfirm onConfirm={args.onConfirm} />,
	play: async ({ canvasElement, args }) => {
		const trigger = within(canvasElement).getByRole("button", {
			name: "Agent actions",
		});
		await tabTo(trigger);
		await userEvent.keyboard("{Enter}");
		const menu = await within(document.body).findByRole("menu");
		await waitFor(() =>
			expect(
				within(menu).getByRole("menuitem", { name: "Rename agent" }),
			).toHaveFocus(),
		);
		await userEvent.keyboard("{ArrowDown}{Enter}");
		const el = await alertDialog();
		await waitFor(() => expect(within(el).getByRole("textbox")).toHaveFocus());
		await userEvent.keyboard("triage");
		await userEvent.click(
			within(el).getByRole("button", { name: "Delete agent" }),
		);
		await expect(args.onConfirm).toHaveBeenCalledOnce();
		await waitFor(() => expect(el).not.toBeInTheDocument());
		await waitFor(() => expect(trigger).toHaveFocus());
	},
};

/**
 * Confirm by name without destructive (a job that creates real infrastructure): the primary action enables only
 * when the name is typed exactly, and gets the typed name.
 */
export const ConfirmByName: Story = {
	args: {
		title: "Create the state backend?",
		children:
			"An S3 bucket and a DynamoDB table are created for the Terraform state.",
		affects: ["AWS account 1234-5678-9012", "eu-west-1"],
		confirmName: "support-triage",
		confirmLabel: "Create backend",
		defaultOpen: true,
		trigger: <Button>Create backend</Button>,
	},
	play: async ({ canvasElement, args }) => {
		const el = await alertDialog();
		const field = within(el).getByRole("textbox", {
			name: "Type support-triage to confirm",
		});
		await waitFor(() => expect(field).toHaveFocus());
		const action = within(el).getByRole("button", { name: "Create backend" });
		await expect(action).toHaveAttribute("data-variant", "primary");
		await expect(action).toBeDisabled();
		await expect(
			within(el)
				.getAllByRole("listitem")
				.map((item) => item.textContent),
		).toEqual(["AWS account 1234-5678-9012", "eu-west-1"]);
		await userEvent.keyboard("support-triage");
		await expect(action).toBeEnabled();
		await userEvent.click(action);
		await expect(args.onConfirm).toHaveBeenCalledWith("support-triage");
		await waitFor(() => expect(el).not.toBeInTheDocument());
		// Opened again, it asks for the name afresh (what the screenshot shows).
		await userEvent.click(
			within(canvasElement).getByRole("button", { name: "Create backend" }),
		);
		const again = await alertDialog();
		await expect(within(again).getByRole("textbox")).toHaveValue("");
		await expect(
			within(again).getByRole("button", { name: "Create backend" }),
		).toBeDisabled();
	},
};

/** A job's answer refused: said inline in the modal, which stays open so the person can answer again. */
export const AnswerRefused: Story = {
	args: {
		title: "Run the last step?",
		children: "The demo job has run two of its three steps.",
		confirmLabel: "Run the last step",
		strings: { cancel: "Stop the job" },
		error: {
			title: "The job is now asking something else",
			description: "Read the new question, then answer it.",
		},
		defaultOpen: true,
	},
	play: async () => {
		const el = await alertDialog();
		await expect(within(el).getByRole("alert")).toHaveTextContent(
			"The job is now asking something else",
		);
		await expect(
			within(el).getByRole("button", { name: "Run the last step" }),
		).toBeEnabled();
		await expect(
			within(el).getByRole("button", { name: "Stop the job" }),
		).toBeEnabled();
	},
};

/**
 * Answering a job (the connected Approval's modal frame): the caller keeps it open while the answer is on its way
 * and shows a refused one; Cancel, labelled with the job's deny, and Escape call `onCancel`.
 */
function AnsweringJob({
	onConfirm,
	onCancel,
}: {
	onConfirm: (name?: string) => void;
	onCancel: () => void;
}) {
	const [isOpen, setOpen] = useState(true);
	const [pending, setPending] = useState<"confirm" | "cancel">();
	const [refused, setRefused] = useState(false);
	return (
		<>
			<Button onPress={() => setOpen(true)}>Show the question</Button>
			<ConfirmModal
				isOpen={isOpen}
				onOpenChange={() => {}}
				title="Run the last step?"
				confirmLabel="Run the last step"
				strings={{ cancel: "Stop the job" }}
				pending={pending}
				error={
					refused
						? {
								title: "The job is no longer waiting",
								description: "It ended or was answered elsewhere.",
							}
						: undefined
				}
				onConfirm={(name) => {
					onConfirm(name);
					setPending("confirm");
					setTimeout(() => {
						setPending(undefined);
						setRefused(true);
					}, 50);
				}}
				onCancel={() => {
					onCancel();
					setOpen(false);
				}}
			>
				The demo job has run two of its three steps. Nothing outside the app
				changes.
			</ConfirmModal>
		</>
	);
}

export const AnswersAJob: Story = {
	// React Aria announces a focused button's pending state through its live announcer, pointing at the button;
	// answering removes the button, and the announcer keeps the stale pointer for 7 s. axe checks after the play
	// function, inside those 7 s, so the announcer's node (not the story) is left out of the check. The announcer
	// lives as long as the page, so this story stays the file's last.
	parameters: { a11y: { context: { exclude: ["[data-live-announcer]"] } } },
	args: { onCancel: fn() },
	render: (args) => (
		<AnsweringJob
			onConfirm={args.onConfirm}
			onCancel={args.onCancel ?? (() => {})}
		/>
	),
	play: async ({ args }) => {
		const el = await alertDialog();
		await userEvent.click(
			within(el).getByRole("button", { name: "Run the last step" }),
		);
		await expect(args.onConfirm).toHaveBeenCalledOnce();
		// Still open: the answer was refused, said inline.
		await waitFor(() =>
			expect(within(el).getByRole("alert")).toHaveTextContent(
				"The job is no longer waiting",
			),
		);
		await expect(el).toBeInTheDocument();
		await expect(args.onCancel).not.toHaveBeenCalled();
		await userEvent.keyboard("{Escape}");
		await expect(args.onCancel).toHaveBeenCalledOnce();
		await waitFor(() => expect(el).not.toBeInTheDocument());
	},
};
