// Toast: a short notice about background work, with an optional "Show" action (the background job notice
// pattern: a job finishes, or needs an answer, while the person is on another tab). Feedback placement: inline for
// a field, a banner for a view, a toast only for something that happened in the background. A job that needs an
// answer is never only a toast: the owning tab also shows a badge, and the job itself shows the approval. Its
// toast uses the `info` tone with a "Show" action, so it stays until dismissed (it never times out).
//
// Built on React Aria's toast (`UNSTABLE_ToastRegion`, `UNSTABLE_Toast`, `UNSTABLE_ToastQueue`; pinned at 1.22.1),
// not on sonner 2.0.8, which P0 D1 names (a departure the decision record still has to take in): sonner injects
// a global stylesheet whose base toast rule, not switched off by its unstyled mode, sets fixed 400 ms
// transitions, absolute positioning and a fixed width, which breaks the motion and token rules. The same sheet
// also carries its own colour values (not checked whether any apply when unstyled).
// shadcn's aria-nova registry has no React Aria toast, so this file is written by hand in the same style.
//
// Look: the solid floating layer (overlay surface, decorative hairline, elevated shadow) at most 336 px wide, a
// 4 px start edge and an icon in the tone's colour (never colour alone), title, description, action, dismiss.
// Toasts sit above modal scrims (z-50 against the scrim's z-40), so a notice shown before a modal opens stays
// visible and reachable.
// Keyboard (React Aria): F6 moves focus to the notifications region; F6 or Shift+F6 there goes back to where focus
// was (`useLandmarkReturn`); Tab moves through a toast's
// buttons; when a focused toast closes, focus moves to the next toast or back to where it came from. A toast with
// an action stays until dismissed (WCAG 2.2.1); one without closes after 8 s, paused while hovered or focused.
import { CircleCheckIcon, CircleXIcon, InfoIcon, XIcon } from "lucide-react";
import { type RefObject, useEffect, useRef } from "react";
import {
	UNSTABLE_Toast as AriaToast,
	UNSTABLE_ToastContent as AriaToastContent,
	UNSTABLE_ToastQueue as AriaToastQueue,
	UNSTABLE_ToastRegion as AriaToastRegion,
	Text,
} from "react-aria-components";
import { floatingMotion } from "../lib/styles";
import { cn } from "../lib/utils";
import { type ToastStrings, uiStrings } from "../strings";
import { Button, IconButton } from "./button";

export type ToastTone = "info" | "success" | "danger";

/** A notice about background work: it finished, or it needs an answer. */
export type BackgroundResult = {
	tone: ToastTone;
	/** What finished, in one line ("Tests passed"). */
	title: string;
	/** One more line, if needed. */
	description?: string;
	/** Takes the person to the result ("Show"). */
	action?: { label: string; onAction: () => void };
};

export type ToastQueue = AriaToastQueue<BackgroundResult>;

/** Toasts with no action close after this long (React Aria's guidance: at least 5 s). */
export const TOAST_TIMEOUT_MS = 8000;

/** One queue per window, shared by every feature; at most three toasts show at once. */
export function createToastQueue(): ToastQueue {
	return new AriaToastQueue<BackgroundResult>({ maxVisibleToasts: 3 });
}

/**
 * Shows a background notice: a job that finished, or one that needs an answer (`info` with a "Show" action, which
 * never times out; the owning tab's badge carries it too). Returns the toast's key (for `queue.close`).
 */
export function notifyBackgroundResult(
	queue: ToastQueue,
	result: BackgroundResult,
): string {
	return queue.add(result, result.action ? {} : { timeout: TOAST_TIMEOUT_MS });
}

const TONES = {
	info: { Icon: InfoIcon, icon: "text-text", edge: "border-s-border-control" },
	success: {
		Icon: CircleCheckIcon,
		icon: "text-text-status-success",
		edge: "border-s-text-status-success",
	},
	danger: {
		Icon: CircleXIcon,
		icon: "text-text-status-danger",
		edge: "border-s-text-status-danger",
	},
} as const;

export type ToastRegionProps = {
	queue: ToastQueue;
	/** Overrides of the default copy (strings.ts). */
	strings?: Partial<ToastStrings>;
	className?: string;
};

/**
 * F6 and Shift+F6 from the notifications region go back to where focus was before it entered, when there is no
 * other landmark to go to. React Aria cycles F6 through its own landmarks only; with the region as the only one,
 * it would wrap to itself, so its wrap event (`react-aria-landmark-navigation`, cancelable) is taken here.
 */
function useLandmarkReturn(regionRef: RefObject<HTMLDivElement | null>) {
	useEffect(() => {
		let returnTo: HTMLElement | null = null;
		const inRegion = (node: EventTarget | null) =>
			node instanceof Node && Boolean(regionRef.current?.contains(node));
		const onFocusIn = (e: FocusEvent) => {
			if (inRegion(e.target) && !inRegion(e.relatedTarget)) {
				returnTo =
					e.relatedTarget instanceof HTMLElement ? e.relatedTarget : null;
			}
		};
		const onWrap = (e: Event) => {
			if (!inRegion(e.target) || !returnTo?.isConnected) return;
			e.preventDefault();
			returnTo.focus();
		};
		document.addEventListener("focusin", onFocusIn);
		document.addEventListener("react-aria-landmark-navigation", onWrap);
		return () => {
			document.removeEventListener("focusin", onFocusIn);
			document.removeEventListener("react-aria-landmark-navigation", onWrap);
		};
	}, [regionRef]);
}

/**
 * Where the toasts appear: once per window, at the bottom end. Its name is React Aria's own ("3 notifications"),
 * which changes with the count: React Aria registers the region for F6 only when its name changes after the
 * first toast renders, so a fixed `aria-label` would leave it unreachable by F6 (react-aria 1.22.1).
 */
export function ToastRegion({ queue, strings, className }: ToastRegionProps) {
	const text = { ...uiStrings.toast, ...strings };
	const regionRef = useRef<HTMLDivElement>(null);
	useLandmarkReturn(regionRef);
	return (
		<AriaToastRegion
			ref={regionRef}
			data-slot="toast-region"
			queue={queue}
			className={cn(
				"fixed end-6 bottom-6 z-50 flex flex-col-reverse gap-2 rounded-control outline-none",
				"data-focus-visible:focus-outline",
				className,
			)}
		>
			{({ toast }) => {
				const { Icon, icon, edge } = TONES[toast.content.tone];
				const action = toast.content.action;
				return (
					<AriaToast
						data-slot="toast"
						data-tone={toast.content.tone}
						toast={toast}
						className={cn(
							"flex w-popover-s max-w-full items-start gap-3 rounded-control border border-s-4 border-border-default",
							"bg-surface-overlay py-3 pe-2 ps-edge text-ui text-text shadow-elevated outline-none",
							"data-focus-visible:focus-outline animate-in fade-in-0",
							floatingMotion,
							edge,
						)}
					>
						<Icon
							aria-hidden="true"
							className={cn("mt-px size-4 shrink-0", icon)}
						/>
						<AriaToastContent className="flex min-w-0 flex-1 flex-col gap-1">
							<Text slot="title" className="font-bold">
								{toast.content.title}
							</Text>
							{toast.content.description ? (
								<Text slot="description">{toast.content.description}</Text>
							) : null}
						</AriaToastContent>
						{action ? (
							<Button
								variant="outline"
								className="-my-1 shrink-0"
								onPress={() => {
									action.onAction();
									queue.close(toast.key);
								}}
							>
								{action.label}
							</Button>
						) : null}
						<IconButton
							slot="close"
							aria-label={text.dismiss}
							icon={<XIcon aria-hidden="true" />}
							className="-my-1.5 shrink-0"
						/>
					</AriaToast>
				);
			}}
		</AriaToastRegion>
	);
}
