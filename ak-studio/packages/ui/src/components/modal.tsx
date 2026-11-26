// Modal: a blocking dialog over the page (the approval and unsaved-changes patterns, P1b, used by P2 and P3).
// Added with the shadcn CLI as `dialog` (aria-nova, React Aria `ModalOverlay`, `Modal` and `Dialog`), restyled to
// Spectrum 2's Dialog M: solid overlay surface (floating layers are solid), decorative hairline, the elevated
// shadow, 16 px radius, 480 px wide, 32 px padding, a 22/26 bold title in the heading face, actions at the end.
//
// Focus moves into the dialog when it opens (React Aria focuses the dialog, or the element with `autoFocus`), is
// contained while it is open (Tab and Shift+Tab wrap), and returns to the trigger (or to whatever had focus) when
// it closes; a modal opened from another returns focus into the first. The page behind does not scroll. Escape
// closes the top modal only; a click on the scrim closes it only when `isDismissable`. A body taller than the
// window scrolls between the header and the footer (the actions stay visible) and, while it overflows, is a
// focusable named region so it can be scrolled from the keyboard. Collections inside (DataTable, Tree) leave
// Escape to the modal. ConfirmModal (confirm-modal.tsx) builds on it.
//
// ModalLayer is the same overlay with no frame of its own (no heading, body or footer), for a modal that draws its
// own content: the command palette, an overlay at the top centre, Dialog size L (640 px). It carries the same
// data-slot="modal-overlay", so isModalOpen sees it and app shortcuts do not act while it is open.
//
// Stacking: the scrim is z-40, toasts z-50 (above any modal), React Aria's popovers above both.
// Separation: in light theme the scrim (navy text at 40%) separates the modal's fill from the page by more than
// 2:1; in dark theme no existing colour is dark enough for that (theme.css, scrim), so the dark modal draws its
// edge in border-control, at least 3:1 against the scrimmed page.
import { IconX } from "@tabler/icons-react";
import {
	type ReactElement,
	type ReactNode,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import {
	Modal as AriaModal,
	Dialog,
	DialogTrigger,
	Heading,
	ModalOverlay,
} from "react-aria-components";
import { InOverlayContext } from "../lib/overlay";
import { motion } from "../lib/styles";
import { cn } from "../lib/utils";
import { type ModalStrings, uiStrings } from "../strings";
import { IconButton } from "./button";

/**
 * What marks an open modal in the page: every `Modal` (and ConfirmModal, SettingsModal) renders its overlay with
 * data-slot="modal-overlay" while open, and any other dialog marked aria-modal counts too. React Aria sets no
 * aria-modal itself, and how it hides the page behind (inert or aria-hidden) differs between browsers and test
 * DOMs, so this is the signal the app reads.
 */
export const MODAL_OPEN_SELECTOR =
	'[data-slot="modal-overlay"], [aria-modal="true"]';

/** True while a modal is open in `root` (the app's shortcuts do not act then, P1b-plan ruling 13). */
export function isModalOpen(root: ParentNode = document): boolean {
	return root.querySelector(MODAL_OPEN_SELECTOR) !== null;
}

/** The scrim: the page behind a modal, dimmed. Fades in and out (none under reduced motion). */
export const modalOverlay = [
	"fixed inset-0 z-40 flex items-center justify-center bg-scrim p-6",
	"data-entering:animate-in data-entering:fade-in-0 data-exiting:animate-out data-exiting:fade-out-0",
	"motion-reduce:animate-none",
].join(" ");

/** The modal surface: Spectrum 2 Dialog M, solid. */
export const modalSurface = [
	"flex max-h-full w-dialog-m max-w-full flex-col rounded-dialog border border-border-default dark:border-border-control",
	"bg-surface-overlay",
	"text-ui text-text shadow-elevated outline-none",
	motion,
].join(" ");

type Close = () => void;

/**
 * The modal's body: scrolls when taller than the window. While it overflows it is a focusable region named after
 * the modal, so a body with nothing focusable in it can still be scrolled from the keyboard.
 */
function ModalBody({
	label,
	children,
}: {
	label: string;
	children: ReactNode;
}) {
	const ref = useRef<HTMLDivElement>(null);
	const [overflows, setOverflows] = useState(false);
	useLayoutEffect(() => {
		const el = ref.current;
		if (!el) return;
		const measure = () => setOverflows(el.scrollHeight > el.clientHeight + 1);
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(el);
		for (const child of el.children) observer.observe(child);
		return () => observer.disconnect();
	}, []);
	return (
		<div
			ref={ref}
			data-slot="modal-body"
			{...(overflows
				? { tabIndex: 0, role: "region", "aria-label": label }
				: {})}
			className="min-h-0 overflow-y-auto rounded-sm px-dialog outline-none focus-visible:focus-outline"
		>
			{children}
		</div>
	);
}

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
						<InOverlayContext.Provider value={true}>
							<header className="flex shrink-0 items-start gap-4 px-dialog pt-dialog pb-4">
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
										icon={<IconX aria-hidden="true" />}
										className="-me-2 -mt-1"
									/>
								) : null}
							</header>
							<ModalBody label={title}>
								{typeof children === "function" ? children(close) : children}
							</ModalBody>
							{actions ? (
								<footer className="flex shrink-0 flex-wrap justify-end gap-3 px-dialog pt-6 pb-dialog">
									{actions(close)}
								</footer>
							) : (
								<div className="pb-dialog" />
							)}
						</InOverlayContext.Provider>
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

export type ModalLayerProps = {
	isOpen: boolean;
	onOpenChange: (isOpen: boolean) => void;
	/** The dialog's accessible name (it shows no heading). */
	title: string;
	/** `top`: near the top of the window, centred (the command palette); `center` by default. */
	placement?: "center" | "top";
	/** Dialog size: M (480 px) by default, L (640 px). */
	size?: "m" | "l";
	/** Close when the scrim is clicked. Off by default: a stray click must not lose work. */
	isDismissable?: boolean;
	children: ReactNode | ((close: Close) => ReactNode);
	className?: string;
};

/** A modal with no frame of its own: the overlay, the solid surface and focus handling, around `children`. */
export function ModalLayer({
	isOpen,
	onOpenChange,
	title,
	placement = "center",
	size = "m",
	isDismissable = false,
	children,
	className,
}: ModalLayerProps) {
	return (
		<ModalOverlay
			data-slot="modal-overlay"
			className={cn(modalOverlay, placement === "top" && "items-start pt-16")}
			isDismissable={isDismissable}
			isOpen={isOpen}
			onOpenChange={onOpenChange}
		>
			<AriaModal
				data-slot="modal"
				className={cn(
					modalSurface,
					size === "l" ? "w-dialog-l" : "w-dialog-m",
					className,
				)}
			>
				<Dialog
					aria-label={title}
					className="flex min-h-0 flex-col outline-none"
				>
					{({ close }) => (
						<InOverlayContext.Provider value={true}>
							{typeof children === "function" ? children(close) : children}
						</InOverlayContext.Provider>
					)}
				</Dialog>
			</AriaModal>
		</ModalOverlay>
	);
}
