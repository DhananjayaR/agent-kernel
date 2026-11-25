// ConfirmModal: an explicit yes before an action, as an alert dialog (the approval pattern in modal form, P1b).
// Added with the shadcn CLI as `alert-dialog` (aria-nova), rebuilt on Modal: title, what will happen, what it
// affects, then Cancel and the action. The action's label says what happens ("Delete agent", never "OK").
//
// Destructive (`variant="destructive"`): the action is a danger Button, the dialog names what it affects, and
// the person types the thing's name before the action enables (the approval pattern's rule for destructive
// actions); the match is exact. Focus never starts on the action: it starts in the name field (destructive) or
// on the dialog itself (default). Escape and Cancel close without acting, in both variants (Escape is the safe
// direction); a click on the scrim does nothing, so a stray click cannot dismiss a question.
import { type ReactNode, useState } from "react";
import { type ConfirmModalStrings, uiStrings } from "../strings";
import { Button } from "./button";
import { Input } from "./input";
import { Modal, type ModalOpening } from "./modal";

type ConfirmBase = ModalOpening & {
	/** The question, naming the thing ("Delete the agent triage?"). */
	title: string;
	/** What will happen, in a sentence or two. */
	children: ReactNode;
	/** The action's label: what happens, naming the thing ("Delete agent"). */
	confirmLabel: string;
	/** Called when the person confirms; the modal then closes. */
	onConfirm: () => void;
	/** Overrides of the default copy (strings.ts). */
	strings?: Partial<ConfirmModalStrings>;
};

export type ConfirmModalProps = ConfirmBase &
	(
		| {
				variant?: "default";
				/** What the action affects (account, files), shown under "This affects". */
				affects?: ReactNode;
				confirmName?: undefined;
		  }
		| {
				variant: "destructive";
				/** What the action affects (account, files, the deployment). Required: destructive names it. */
				affects: ReactNode;
				/** The thing's name, which the person types to enable the action ("support-triage"). */
				confirmName: string;
		  }
	);

function ConfirmBody({
	children,
	affects,
	confirmName,
	confirmLabel,
	variant,
	onConfirm,
	close,
	text,
}: {
	children: ReactNode;
	affects?: ReactNode;
	confirmName?: string;
	confirmLabel: string;
	variant: "default" | "destructive";
	onConfirm: () => void;
	close: () => void;
	text: ConfirmModalStrings;
}) {
	const [typed, setTyped] = useState("");
	const destructive = variant === "destructive";
	const matches = !destructive || typed === confirmName;
	return (
		<div className="flex flex-col gap-4">
			<div className="text-ui text-text">{children}</div>
			{affects ? (
				<section
					aria-label={text.affects}
					className="flex flex-col gap-1 rounded-control border border-border-default bg-surface-raised px-edge py-2"
				>
					<h3 className="font-ui text-ui-sm font-action text-text-muted">
						{text.affects}
					</h3>
					<div className="text-ui text-text">{affects}</div>
				</section>
			) : null}
			{destructive && confirmName ? (
				<Input
					label={text.typeToConfirm.replace("{name}", confirmName)}
					value={typed}
					onChange={setTyped}
					autoFocus
					autoComplete="off"
					spellCheck="false"
					className="w-full [&_input]:font-mono"
				/>
			) : null}
			<div className="flex flex-wrap justify-end gap-3 pt-2">
				<Button variant="secondary" slot="close">
					{text.cancel}
				</Button>
				<Button
					variant={destructive ? "danger" : "primary"}
					isDisabled={!matches}
					onPress={() => {
						onConfirm();
						close();
					}}
				>
					{confirmLabel}
				</Button>
			</div>
		</div>
	);
}

export function ConfirmModal({
	title,
	children,
	confirmLabel,
	onConfirm,
	strings,
	affects,
	confirmName,
	variant = "default",
	...opening
}: ConfirmModalProps) {
	const text = { ...uiStrings.confirmModal, ...strings };
	return (
		<Modal
			{...(opening as ModalOpening)}
			title={title}
			role="alertdialog"
			showCloseButton={false}
			isDismissable={false}
		>
			{(close) => (
				<ConfirmBody
					affects={affects}
					confirmName={confirmName}
					confirmLabel={confirmLabel}
					variant={variant}
					onConfirm={onConfirm}
					close={close}
					text={text}
				>
					{children}
				</ConfirmBody>
			)}
		</Modal>
	);
}
