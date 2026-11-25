// ConfirmModal: an explicit yes before an action, as an alert dialog (the approval pattern in modal form, P1b).
// Added with the shadcn CLI as `alert-dialog` (aria-nova), rebuilt on Modal: title, what will happen, what it
// affects, then Cancel and the action in the modal's footer (it stays visible when the body scrolls). The action's
// label says what happens ("Delete agent", never "OK"). "What will happen" and "This affects" are the dialog's
// description (React Aria's description slot), so they are read with the title when the dialog opens.
//
// Destructive (`variant="destructive"`): the action is a danger Button, the dialog names what it affects, and
// the person types the thing's name before the action enables (the approval pattern's rule for destructive
// actions); the match is exact, and an empty name never matches, so the action stays disabled. Focus never starts
// on the action: it starts in the name field (destructive) or on the dialog itself (default). Escape and Cancel
// close without acting, in both variants (Escape is the safe direction); a click on the scrim does nothing, so a
// stray click cannot dismiss a question. The typed name is cleared each time the dialog opens.
import { type ReactNode, useLayoutEffect, useState } from "react";
import { Text } from "react-aria-components";
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

/** Rejects the empty literal `""` where the value is known at compile time (N is inferred from the prop). */
type NotEmpty<N extends string> = N extends "" ? never : unknown;

export type ConfirmModalProps<N extends string = string> = ConfirmBase &
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
				/**
				 * The thing's name, which the person types to enable the action ("support-triage"). Must not be empty:
				 * `""` is a type error where it is a literal, and at run time an empty name keeps the action disabled.
				 */
				confirmName: N & NotEmpty<N>;
		  }
	);

/** The typed-name label with the name put in literally (a replacer function: no `$&` pattern expansion). */
export function typeToConfirmLabel(template: string, name: string): string {
	return template.replace("{name}", () => name);
}

/** True when the typed text enables a destructive action: an exact match with a non-empty name. */
export function nameMatches(typed: string, name: string | undefined): boolean {
	return Boolean(name) && typed === name;
}

/** Clears the typed name each time the dialog's body mounts (each open). */
function ResetOnOpen({ reset }: { reset: () => void }) {
	useLayoutEffect(() => {
		reset();
	}, [reset]);
	return null;
}

export function ConfirmModal<N extends string>({
	title,
	children,
	confirmLabel,
	onConfirm,
	strings,
	affects,
	confirmName,
	variant = "default",
	...opening
}: ConfirmModalProps<N>) {
	const text = { ...uiStrings.confirmModal, ...strings };
	const [typed, setTyped] = useState("");
	const [reset] = useState(() => () => setTyped(""));
	const destructive = variant === "destructive";
	const enabled = !destructive || nameMatches(typed, confirmName);
	return (
		<Modal
			{...(opening as ModalOpening)}
			title={title}
			role="alertdialog"
			showCloseButton={false}
			isDismissable={false}
			actions={(close) => (
				<>
					<Button variant="secondary" slot="close">
						{text.cancel}
					</Button>
					<Button
						variant={destructive ? "danger" : "primary"}
						isDisabled={!enabled}
						onPress={() => {
							onConfirm();
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
				<Text
					slot="description"
					elementType="div"
					className="flex flex-col gap-4 text-ui text-text"
				>
					<div>{children}</div>
					{affects ? (
						<section
							aria-label={text.affects}
							className="flex flex-col gap-1 rounded-control border border-border-default bg-surface-raised px-edge py-2"
						>
							<h3 className="font-ui text-ui-sm font-action text-text-muted">
								{text.affects}
							</h3>
							<div>{affects}</div>
						</section>
					) : null}
				</Text>
				{destructive && confirmName ? (
					<Input
						label={typeToConfirmLabel(text.typeToConfirm, confirmName)}
						value={typed}
						onChange={setTyped}
						autoFocus
						autoComplete="off"
						className="w-full [&_input]:font-mono"
					/>
				) : null}
			</div>
		</Modal>
	);
}
