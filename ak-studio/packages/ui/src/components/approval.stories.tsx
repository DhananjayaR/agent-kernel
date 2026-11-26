// The approval card's states (P1b gate step 4): asking, asking for the name, answering, refused, approved, denied,
// and its keyboard model. The modal frame is ConfirmModal's stories (confirm-modal.stories.tsx).
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { expectFocusRing, expectTokenColour, tabTo } from "../lib/story-checks";
import { ApprovalCard, type ApprovalCardProps } from "./approval";
import { PathChip } from "./path-chip";

const meta = {
	title: "Patterns/Approval",
	component: ApprovalCard,
	args: {
		title: "Run the last step?",
		summary:
			"The demo job has run two of its three steps. Run the last one, or stop the job here. Nothing outside the app changes.",
		approveLabel: "Run the last step",
		denyLabel: "Stop the job",
		onApprove: fn(),
		onDeny: fn(),
	},
	render: (args) => (
		<div className="max-w-dialog-m">
			<ApprovalCard {...args} />
		</div>
	),
} satisfies Meta<typeof ApprovalCard>;

export default meta;
type Story = StoryObj<typeof meta>;

const card = (root: HTMLElement) =>
	within(root).getByRole("region", { name: "Run the last step?" });

/** Asking: "Approval required" (a waiting chip, never colour alone), what will happen, then approve and deny. No "Cancel". */
export const Default: Story = {
	play: async ({ canvasElement, args }) => {
		const el = card(canvasElement);
		await expect(el).toHaveAccessibleDescription(/two of its three steps/);
		// The live region is there, empty, while it asks: the outcome written into it later is announced.
		await expect(within(el).getByRole("status")).toHaveTextContent("");
		await expect(within(el).getByText("Approval required")).toBeVisible();
		const approve = within(el).getByRole("button", {
			name: "Run the last step",
		});
		await expect(approve).toHaveAttribute("data-variant", "primary");
		await expect(
			within(el).getByRole("button", { name: "Stop the job" }),
		).toHaveAttribute("data-variant", "secondary");
		await expect(
			within(el).queryByRole("button", { name: "Cancel" }),
		).not.toBeInTheDocument();
		await expectTokenColour(el, "border-top-color", "border-border-default");
		await userEvent.click(approve);
		await expect(args.onApprove).toHaveBeenCalledWith(undefined);
	},
};

/** What it affects, one row each (an account, files, a command). */
export const WithAffects: Story = {
	args: {
		title: "Run the tests?",
		summary: "Claude Agent wants to run the project's tests.",
		approveLabel: "Run tests",
		denyLabel: "Do not run",
		affects: [
			<PathChip key="a" path="support-triage/tests" />,
			<code key="b" className="font-mono text-ui-sm">
				uv run pytest -q
			</code>,
		],
	},
	play: async ({ canvasElement }) => {
		const el = within(canvasElement).getByRole("region", {
			name: "Run the tests?",
		});
		const affects = within(el).getByRole("region", { name: "This affects" });
		await expect(within(affects).getAllByRole("listitem")).toHaveLength(2);
		await expect(el).toHaveAccessibleDescription(/This affects/);
	},
};

const byName = {
	title: "Destroy the deployment?",
	summary:
		"terraform destroy removes every resource the deployment created. This cannot be undone.",
	affects: ["AWS account 1234-5678-9012, eu-west-1"],
	approveLabel: "Destroy deployment",
	denyLabel: "Keep deployment",
	destructive: true,
	confirmName: "support-triage",
} satisfies Partial<ApprovalCardProps>;

/**
 * Confirm by name: approve (danger, it names the thing) stays disabled until the name is typed exactly; Enter in
 * the field never approves; deny never needs the name.
 */
export const ConfirmByName: Story = {
	args: byName,
	play: async ({ canvasElement, args }) => {
		const el = within(canvasElement).getByRole("region", {
			name: "Destroy the deployment?",
		});
		const field = within(el).getByRole("textbox", {
			name: "Type support-triage to confirm",
		});
		const approve = within(el).getByRole("button", {
			name: "Destroy deployment",
		});
		await expect(approve).toHaveAttribute("data-variant", "danger");
		await expect(approve).toBeDisabled();
		await userEvent.type(field, "Support-triage");
		await expect(approve).toBeDisabled();
		await userEvent.clear(field);
		await userEvent.type(field, "support-triage{Enter}");
		await expect(args.onApprove).not.toHaveBeenCalled();
		await expect(approve).toBeEnabled();
		await userEvent.click(approve);
		await expect(args.onApprove).toHaveBeenCalledWith("support-triage");
	},
};

/** Deny on a confirm-by-name request: enabled with no name typed. */
export const DenyWithoutName: Story = {
	args: byName,
	play: async ({ canvasElement, args }) => {
		const deny = within(canvasElement).getByRole("button", {
			name: "Keep deployment",
		});
		await expect(deny).toBeEnabled();
		await userEvent.click(deny);
		await expect(args.onDeny).toHaveBeenCalledOnce();
	},
};

/** Answering: the pressed button is pending (still focusable, presses ignored), the other disabled. */
export const Pending: Story = {
	args: { pending: "approve" },
	play: async ({ canvasElement, args }) => {
		const el = card(canvasElement);
		const approve = within(el).getByRole("button", {
			name: "Run the last step",
		});
		await expect(approve).toHaveAttribute("data-pending", "true");
		await userEvent.click(approve);
		await expect(args.onApprove).not.toHaveBeenCalled();
		await expect(
			within(el).getByRole("button", { name: "Stop the job" }),
		).toBeDisabled();
	},
};

/** The answer was refused: what happened and what to do, inline under the actions; the buttons work again. */
export const Refused: Story = {
	args: {
		error: {
			title: "The job is no longer waiting",
			description: "It ended or was answered elsewhere. Nothing was changed.",
		},
	},
	play: async ({ canvasElement }) => {
		const el = card(canvasElement);
		await expect(within(el).getByRole("alert")).toHaveTextContent(
			"The job is no longer waiting",
		);
		await expect(
			within(el).getByRole("button", { name: "Run the last step" }),
		).toBeEnabled();
	},
};

/** Approved: the outcome in place, as a polite live region. */
export const Approved: Story = {
	args: { outcome: "approved" },
	play: async ({ canvasElement }) => {
		// Its name says the outcome; the live region (mounted empty while it asked) holds it.
		const el = within(canvasElement).getByRole("region", {
			name: "Approved by you: Run the last step?",
		});
		await expect(within(el).getByRole("status")).toHaveTextContent(
			"Approved by you",
		);
		await expect(within(el).queryAllByRole("button")).toHaveLength(0);
	},
};

/** Denied: the outcome in place. */
export const Denied: Story = {
	args: {
		outcome: "denied",
		outcomeDetail: "The job stopped before its last step.",
	},
	play: async ({ canvasElement }) => {
		const el = within(canvasElement).getByRole("region", {
			name: "Denied: Run the last step?",
		});
		await expect(within(el).getByRole("status")).toHaveTextContent("Denied");
		await expect(el).toHaveTextContent("The job stopped before its last step.");
	},
};

/** A card that answers like the connected Approval: pending, then the outcome. */
function Answering(props: ApprovalCardProps) {
	const [pending, setPending] = useState<"approve" | "deny">();
	const [outcome, setOutcome] = useState<"approved" | "denied">();
	const answer = (which: "approve" | "deny") => {
		setPending(which);
		setTimeout(() => {
			setPending(undefined);
			setOutcome(which === "approve" ? "approved" : "denied");
		}, 50);
	};
	return (
		<div className="max-w-dialog-m">
			<ApprovalCard
				{...props}
				pending={pending}
				outcome={outcome}
				onApprove={(name) => {
					props.onApprove(name);
					answer("approve");
				}}
				onDeny={() => {
					props.onDeny();
					answer("deny");
				}}
			/>
		</div>
	);
}

/**
 * Keyboard: Tab reaches approve then deny with the focus ring; Enter answers; once answered the buttons go and
 * focus moves to the card (never lost to the page).
 */
export const Keyboard: Story = {
	// React Aria announces a focused button's pending state through its live announcer, pointing at the button;
	// answering removes the button, and the announcer keeps the stale pointer for 7 s. axe checks after the play
	// function, inside those 7 s, so the announcer's node (not the story) is left out of the check. The announcer
	// lives as long as the page, so this story stays the file's last.
	parameters: { a11y: { context: { exclude: ["[data-live-announcer]"] } } },
	render: (args) => <Answering {...args} />,
	play: async ({ canvasElement, args }) => {
		const el = card(canvasElement);
		const approve = within(el).getByRole("button", {
			name: "Run the last step",
		});
		const deny = within(el).getByRole("button", { name: "Stop the job" });
		await tabTo(approve);
		await expectFocusRing(approve);
		await userEvent.tab();
		await expect(deny).toHaveFocus();
		await expectFocusRing(deny);
		await userEvent.keyboard("{Enter}");
		await expect(args.onDeny).toHaveBeenCalledOnce();
		await waitFor(() =>
			expect(within(el).getByRole("status")).toHaveTextContent("Denied"),
		);
		await waitFor(() => expect(el).toHaveFocus());
		await expect(el).toHaveAccessibleName("Denied: Run the last step?");
	},
};
