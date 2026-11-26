// ConfirmModal: an explicit yes before an action, as an alert dialog: the approval pattern's modal frame (P1b design
// gate row (a): a modal when the approval affects real infrastructure or is destructive; a card, ApprovalCard,
// where the work happens). Added with the shadcn CLI as `alert-dialog` (aria-nova), rebuilt on Modal, and since
// Task 15 renders the approval pattern's one body (approval.tsx: ApprovalDetails and ApprovalNameField): title,
// what will happen, what it affects, the typed name when asked, then Cancel and the action in the modal's footer
// (it stays visible when the body scrolls). The action's label says what happens ("Delete agent", never "OK").
// "What will happen" and "This affects" are the dialog's description (React Aria's description slot), so they are
// read with the title when the dialog opens.
//
// Destructive (`variant="destructive"`): the action is a danger Button, the dialog names what it affects, and
// the person types the thing's name before the action enables (the approval pattern's rule for destructive
// actions). `confirmName` without `destructive` asks for the name too (a confirm-by-name request that creates real
// infrastructure). The match is exact, and an empty name never matches, so the action stays disabled. Focus never
// starts on the action: it starts in the name field (when a name is asked) or on the dialog itself. Escape and
// Cancel close without acting, in both variants (Escape is the safe direction), and call `onCancel`: a job's
// question answered from this modal is denied by them. A click on the scrim does nothing, so a stray click cannot
// dismiss a question. The typed name is cleared each time the dialog opens. A caller that answers a job keeps the
// modal open (controlled) while the answer is `pending`, and shows a refused answer as `error`.
import { type ReactNode, useLayoutEffect, useRef, useState } from "react";
import { Text } from "react-aria-components";
import { type ConfirmModalStrings, uiStrings } from "../strings";
import {
	ApprovalDetails,
	type ApprovalError,
	ApprovalNameField,
	nameMatches,
	typeToConfirmLabel,
} from "./approval";
import { Button } from "./button";
import { InlineBanner } from "./inline-banner";
import { Modal, type ModalOpening } from "./modal";

export { nameMatches, typeToConfirmLabel };

type ConfirmBase = ModalOpening & {
	/** The question, naming the thing ("Delete the agent triage?"). */
	title: string;
	/** What will happen, in a sentence or two. */
	children: ReactNode;
	/** The action's label: what happens, naming the thing ("Delete agent"). */
	confirmLabel: string;
	/** Called when the person confirms, with the typed name when one is asked; the modal then closes. */
	onConfirm: (typedName?: string) => void;
	/** Called when it closes without confirming: Cancel or Escape. */
	onCancel?: () => void;
	/** An answer on its way (a caller answering a job): its button is pending, the other disabled. */
	pending?: "confirm" | "cancel";
	/** The answer was refused or could not be sent; shown under the body. */
	error?: ApprovalError;
	/** Overrides of the default copy (strings.ts); `cancel` is the deny label when it answers a job. */
	strings?: Partial<ConfirmModalStrings>;
};

/** Rejects the empty literal `""` where the value is known at compile time (N is inferred from the prop). */
type NotEmpty<N extends string> = N extends "" ? never : unknown;

/** What the action affects: one row, or one row per item. */
type Affects = ReactNode | readonly ReactNode[];

export type ConfirmModalProps<N extends string = string> = ConfirmBase &
	(
		| {
				variant?: "default";
				/** What the action affects (account, files), shown under "This affects". */
				affects?: Affects;
				/** A name to type before the action enables (a confirm-by-name request); not empty. */
				confirmName?: N & NotEmpty<N>;
		  }
		| {
				variant: "destructive";
				/** What the action affects (account, files, the deployment). Required: destructive names it. */
				affects: Affects;
				/**
				 * The thing's name, which the person types to enable the action ("support-triage"). Must not be empty:
				 * `""` is a type error where it is a literal, and at run time an empty name keeps the action disabled.
				 */
				confirmName: N & NotEmpty<N>;
		  }
	);

/** Clears the typed name each time the dialog's body mounts (each open). */
function ResetOnOpen({ reset }: { reset: () => void }) {
	useLayoutEffect(() => {
		reset();
	}, [reset]);
	return null;
}

function rows(affects: Affects): readonly ReactNode[] | undefined {
	if (affects === undefined || affects === null || affects === false)
		return undefined;
	return Array.isArray(affects) ? affects : [affects];
}

export function ConfirmModal<N extends string>({
	title,
	children,
	confirmLabel,
	onConfirm,
	onCancel,
	pending,
	error,
	strings,
	affects,
	confirmName,
	variant = "default",
	...opening
}: ConfirmModalProps<N>) {
	const text = { ...uiStrings.confirmModal, ...strings };
	const [typed, setTyped] = useState("");
	const [reset] = useState(() => () => setTyped(""));
	// Set by the action just before it closes the modal, so the close is not taken for a cancel.
	const confirming = useRef(false);
	const destructive = variant === "destructive";
	const byName = destructive || confirmName !== undefined;
	const enabled = !byName || nameMatches(typed, confirmName);
	const { onOpenChange: callerOpenChange, ...rest } = opening as ModalOpening;
	const onOpenChange = (open: boolean) => {
		const confirmed = confirming.current;
		confirming.current = false;
		if (!open && !confirmed) onCancel?.();
		callerOpenChange?.(open);
	};
	return (
		<Modal
			{...(rest as ModalOpening)}
			onOpenChange={onOpenChange}
			title={title}
			role="alertdialog"
			showCloseButton={false}
			isDismissable={false}
			actions={(close) => (
				<>
					<Button
						variant="secondary"
						isDisabled={pending === "confirm"}
						isPending={pending === "cancel"}
						onPress={close}
					>
						{text.cancel}
					</Button>
					<Button
						variant={destructive ? "danger" : "primary"}
						isDisabled={!enabled || pending === "cancel"}
						isPending={pending === "confirm"}
						onPress={() => {
							confirming.current = true;
							onConfirm(byName ? typed : undefined);
							close();
						}}
					>
						{confirmLabel}
					</Button>
				</>
			)}
		>
			<ResetOnOpen reset={reset} />
			<div className="flex flex-col gap-4">
				<Text slot="description" elementType="div">
					<ApprovalDetails
						summary={children}
						affects={rows(affects)}
						affectsLabel={text.affects}
					/>
				</Text>
				{byName && confirmName ? (
					<ApprovalNameField
						name={confirmName}
						value={typed}
						onChange={setTyped}
						labelTemplate={text.typeToConfirm}
						isDisabled={pending !== undefined}
						autoFocus
					/>
				) : null}
				{error ? (
					<InlineBanner tone="danger" title={error.title}>
						{error.description}
					</InlineBanner>
				) : null}
			</div>
		</Modal>
	);
}
