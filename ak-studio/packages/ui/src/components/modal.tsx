// Modal: a blocking dialog over the page (the approval and unsaved-changes patterns, P1b, used by P2 and P3).
// Added with the shadcn CLI as `dialog` (aria-nova, React Aria `ModalOverlay`, `Modal` and `Dialog`), restyled to
// Spectrum 2's Dialog M: solid overlay surface (floating layers are solid), decorative hairline, the elevated
// shadow, 16 px radius, 480 px wide, 32 px padding, a 22/26 bold title in the heading face, actions at the end.
//
// Focus moves into the dialog when it opens (React Aria focuses the dialog, or the element with `autoFocus`), is
// contained while it is open, and returns to the trigger (or to whatever had focus) when it closes. Escape closes
// it; a click on the scrim closes it only when `isDismissable`. ConfirmModal (confirm-modal.tsx) builds on it.
import { XIcon } from "lucide-react";
import type { ReactElement, ReactNode } from "react";
import {
	Modal as AriaModal,
	Dialog,
	DialogTrigger,
	Heading,
	ModalOverlay,
} from "react-aria-components";
import { motion } from "../lib/styles";
import { cn } from "../lib/utils";
import { type ModalStrings, uiStrings } from "../strings";
import { IconButton } from "./button";

/** The scrim: the page behind a modal, dimmed. Fades in and out (none under reduced motion). */
export const modalOverlay = [
	"fixed inset-0 z-50 flex items-center justify-center bg-scrim p-6",
	"data-entering:animate-in data-entering:fade-in-0 data-exiting:animate-out data-exiting:fade-out-0",
	"motion-reduce:animate-none",
].join(" ");

/** The modal surface: Spectrum 2 Dialog M, solid. */
export const modalSurface = [
	"flex max-h-full w-dialog-m max-w-full flex-col rounded-dialog border border-border-default bg-surface-overlay",
	"text-ui text-text shadow-elevated outline-none",
	motion,
].join(" ");

type Close = () => void;

/** How the modal opens: from a trigger it wraps, or controlled by the caller. */
export type ModalOpening =
	| {
			/** A React Aria pressable (a Button from this package); pressing it opens the modal. */
			trigger: ReactElement;
			isOpen?: boolean;
			defaultOpen?: boolean;
			onOpenChange?: (isOpen: boolean) => void;
	  }
	| {
			trigger?: undefined;
			isOpen: boolean;
			defaultOpen?: undefined;
			onOpenChange: (isOpen: boolean) => void;
	  };

export type ModalProps = ModalOpening & {
	/** What the dialog is about, as a short heading. Also the dialog's accessible name. */
	title: string;
	/** The body. A function gets `close`. */
	children: ReactNode | ((close: Close) => ReactNode);
	/** Buttons at the end of the footer, most important last (it closes with `close`). */
	actions?: (close: Close) => ReactNode;
	/** Close when the scrim is clicked. Off by default: a stray click must not lose work. */
	isDismissable?: boolean;
	/** The close (X) button in the header. Shown by default; Escape closes either way. */
	showCloseButton?: boolean;
	/** `alertdialog` for an interruption that needs an answer (ConfirmModal). */
	role?: "dialog" | "alertdialog";
	/** Overrides of the default copy (strings.ts). */
	strings?: Partial<ModalStrings>;
	className?: string;
};

export function Modal({
	trigger,
	isOpen,
	defaultOpen,
	onOpenChange,
	title,
	children,
	actions,
	isDismissable = false,
	showCloseButton = true,
	role = "dialog",
	strings,
	className,
}: ModalProps) {
	const text = { ...uiStrings.modal, ...strings };
	const overlay = (
		<ModalOverlay
			data-slot="modal-overlay"
			className={modalOverlay}
			isDismissable={isDismissable}
			{...(trigger ? {} : { isOpen, onOpenChange })}
		>
			<AriaModal data-slot="modal" className={cn(modalSurface, className)}>
				<Dialog role={role} className="flex min-h-0 flex-col outline-none">
					{({ close }) => (
						<>
							<header className="flex items-start gap-4 px-dialog pt-dialog pb-4">
								<Heading
									slot="title"
									className="min-w-0 flex-1 text-heading font-control"
								>
									{title}
								</Heading>
								{showCloseButton ? (
									<IconButton
										slot="close"
										aria-label={text.close}
										icon={<XIcon aria-hidden="true" />}
										className="-me-2 -mt-1"
									/>
								) : null}
							</header>
							<div className="min-h-0 overflow-y-auto px-dialog">
								{typeof children === "function" ? children(close) : children}
							</div>
							{actions ? (
								<footer className="flex flex-wrap justify-end gap-3 px-dialog pt-6 pb-dialog">
									{actions(close)}
								</footer>
							) : (
								<div className="pb-dialog" />
							)}
						</>
					)}
				</Dialog>
			</AriaModal>
		</ModalOverlay>
	);
	if (!trigger) return overlay;
	return (
		<DialogTrigger
			isOpen={isOpen}
			defaultOpen={defaultOpen}
			onOpenChange={onOpenChange}
		>
			{trigger}
			{overlay}
		</DialogTrigger>
	);
}
