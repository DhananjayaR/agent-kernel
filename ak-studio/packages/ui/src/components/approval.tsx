// The approval pattern (P1b design gate row (a), signed off 26 November 2026): one body in two frames. The body says
// what will happen, what it affects (account, files, command) and, for a confirm-by-name request, asks for the
// thing's name; then approve and deny. The frames follow one rule: a card where the work happens (ApprovalCard, here:
// a chat, a drawer, a job in its view), and a modal when the approval affects real infrastructure or is destructive
// (ConfirmModal, confirm-modal.tsx, which renders the same body). The card has no "Cancel": deny says no, and
// stopping the whole job is the job's own "Stop".
//
// The card is a named region with the warning tone's start edge, headed by a "waiting" StatusChip ("Approval
// required", never colour alone). Approve is the primary action (`danger` for a destructive one, which names the
// thing); deny is secondary. With `confirmName`, approve stays disabled until the typed name matches exactly (an
// empty name never matches); Enter in the field never approves, and denying never needs the name. Once answered,
// the card shows the outcome in place ("Approved by you", "Denied") as a polite live region, and focus that was on
// its buttons moves to the card. While an answer is on its way the pressed button is pending and the other is
// disabled; a refused answer shows inline under the actions.
import { type ReactNode, useId, useState } from "react";
import { useKeepFocus } from "../lib/focus";
import { cn } from "../lib/utils";
import { type ApprovalStrings, uiStrings } from "../strings";
import { Button } from "./button";
import { InlineBanner } from "./inline-banner";
import { Input } from "./input";
import { StatusChip } from "./status-chip";

/** What an approval says, in either frame. */
export type ApprovalDetailsProps = {
	/** What will happen, in a sentence or two. */
	summary: ReactNode;
	/** What it affects (a cloud account, files, a command), one row each. */
	affects?: readonly ReactNode[];
	/** The "This affects" heading; overridable copy. */
	affectsLabel?: string;
	id?: string;
	className?: string;
};

/** The approval body's words: what will happen, then "This affects" with one row per thing affected. */
export function ApprovalDetails({
	summary,
	affects,
	affectsLabel = uiStrings.confirmModal.affects,
	id,
	className,
}: ApprovalDetailsProps) {
	return (
		<div
			id={id}
			className={cn("flex flex-col gap-4 text-ui text-text", className)}
		>
			<div>{summary}</div>
			{affects && affects.length > 0 ? (
				<section
					aria-label={affectsLabel}
					className="flex flex-col gap-1 rounded-control border border-border-default bg-surface-raised px-edge py-2"
				>
					<h3 className="font-ui text-ui-sm font-action text-text-muted">
						{affectsLabel}
					</h3>
					<ul className="flex flex-col items-start gap-1">
						{affects.map((item, index) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: the rows are given in order and never reordered
							<li key={index}>{item}</li>
						))}
					</ul>
				</section>
			) : null}
		</div>
	);
}

/** The typed-name label with the name put in literally (a replacer function: no `$&` pattern expansion). */
export function typeToConfirmLabel(template: string, name: string): string {
	return template.replace("{name}", () => name);
}

/** True when the typed text enables a confirm-by-name action: an exact match with a non-empty name. */
export function nameMatches(typed: string, name: string | undefined): boolean {
	return Boolean(name) && typed === name;
}

export type ApprovalNameFieldProps = {
	/** The name to type ("support-triage"). */
	name: string;
	value: string;
	onChange: (value: string) => void;
	/** The field's label template, `{name}` filled in. */
	labelTemplate?: string;
	autoFocus?: boolean;
	isDisabled?: boolean;
};

/** The typed-name field of a confirm-by-name approval: monospace, no autocomplete. */
export function ApprovalNameField({
	name,
	value,
	onChange,
	labelTemplate = uiStrings.confirmModal.typeToConfirm,
	autoFocus,
	isDisabled,
}: ApprovalNameFieldProps) {
	return (
		<Input
			label={typeToConfirmLabel(labelTemplate, name)}
			value={value}
			onChange={onChange}
			autoFocus={autoFocus}
			autoComplete="off"
			isDisabled={isDisabled}
			className="w-full [&_input]:font-mono"
		/>
	);
}

/** An answer that could not be sent, shown under the actions. */
export type ApprovalError = { title: string; description?: ReactNode };

export type ApprovalCardProps = {
	/** The question ("Run the last step?"). Also the card's accessible name. */
	title: string;
	/** What will happen. */
	summary: ReactNode;
	/** What it affects, one row each. */
	affects?: readonly ReactNode[];
	/** Approve's label: what happens ("Run the last step"). Defaults to "Approve". */
	approveLabel?: string;
	/** Deny's label ("Stop the job"). Defaults to "Deny". */
	denyLabel?: string;
	/** Approve destroys something: a danger button that names the thing. */
	destructive?: boolean;
	/** The name to type before approve enables (confirm-by-name). */
	confirmName?: string;
	/** Approve pressed; gets the typed name when `confirmName` is set. */
	onApprove: (typedName?: string) => void;
	/** Deny pressed. Never needs the name. */
	onDeny: () => void;
	/** The answer on its way: its button is pending, the other disabled. */
	pending?: "approve" | "deny";
	/** The answer was refused or could not be sent. */
	error?: ApprovalError;
	/** Answered: the card shows the outcome in place. */
	outcome?: "approved" | "denied";
	/** One more line under the outcome (what came of it). */
	outcomeDetail?: ReactNode;
	strings?: Partial<ApprovalStrings>;
	className?: string;
};

const cardFrame =
	"rounded-card border border-border-default bg-surface-raised p-4 text-ui text-text outline-none focus-visible:focus-outline";

export function ApprovalCard({
	title,
	summary,
	affects,
	approveLabel,
	denyLabel,
	destructive = false,
	confirmName,
	onApprove,
	onDeny,
	pending,
	error,
	outcome,
	outcomeDetail,
	strings,
	className,
}: ApprovalCardProps) {
	const text = { ...uiStrings.approval, ...strings };
	const titleId = useId();
	const detailsId = useId();
	const [typed, setTyped] = useState("");
	// Answering removes the buttons: focus that was on them moves to the card rather than falling to the page.
	const ref = useKeepFocus<HTMLElement>(outcome);
	const byName = confirmName !== undefined;
	const canApprove = !byName || nameMatches(typed, confirmName);

	if (outcome) {
		return (
			<section
				ref={ref}
				tabIndex={-1}
				data-slot="approval-card"
				data-outcome={outcome}
				aria-labelledby={titleId}
				className={cn("flex flex-col gap-2", cardFrame, className)}
			>
				<div role="status" className="flex flex-col items-start gap-2">
					{outcome === "approved" ? (
						<StatusChip status="passed" label={text.approved} />
					) : (
						<p className="font-bold">{text.denied}</p>
					)}
					<h3 id={titleId} className="text-text-muted">
						{title}
					</h3>
				</div>
				{outcomeDetail ? <div>{outcomeDetail}</div> : null}
			</section>
		);
	}

	return (
		<section
			ref={ref}
			tabIndex={-1}
			data-slot="approval-card"
			aria-labelledby={titleId}
			aria-describedby={detailsId}
			className={cn(
				"flex flex-col gap-4",
				cardFrame,
				// After the frame: its `border` and border colour would otherwise win over the edge.
				"border-s-4 border-s-text-status-warning",
				className,
			)}
		>
			<div className="flex flex-col items-start gap-2">
				<StatusChip status="waiting" label={text.required} />
				<h3
					id={titleId}
					className="font-heading text-ui-lg font-bold text-text"
				>
					{title}
				</h3>
			</div>
			<ApprovalDetails id={detailsId} summary={summary} affects={affects} />
			{byName ? (
				<ApprovalNameField
					name={confirmName}
					value={typed}
					onChange={setTyped}
					isDisabled={pending !== undefined}
				/>
			) : null}
			<div className="flex flex-wrap items-center gap-2">
				<Button
					variant={destructive ? "danger" : "primary"}
					isDisabled={!canApprove || pending === "deny"}
					isPending={pending === "approve"}
					onPress={() => onApprove(byName ? typed : undefined)}
				>
					{approveLabel ?? text.approve}
				</Button>
				<Button
					variant="secondary"
					isDisabled={pending === "approve"}
					isPending={pending === "deny"}
					onPress={onDeny}
				>
					{denyLabel ?? text.deny}
				</Button>
			</div>
			{error ? (
				<InlineBanner tone="danger" title={error.title}>
					{error.description}
				</InlineBanner>
			) : null}
		</section>
	);
}
