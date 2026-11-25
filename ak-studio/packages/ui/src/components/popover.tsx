// Popover: more detail on demand, anchored to the control that opened it (the resolved version and its source in
// the status bar, why a feature needs a newer OAK, a tool's path and version). Added with the shadcn CLI
// (aria-nova, React Aria `DialogTrigger`, `Popover` and `Dialog`), restyled: the solid floating layer (overlay
// surface, decorative hairline, elevated shadow, 10 px radius), 12 px padding, at most 336 px wide (Spectrum 2
// Popover S). Not for menus (Menu) or short labels (Tooltip).
//
// Focus moves into the popover's dialog when it opens, Escape or a click outside closes it, and focus returns to
// the trigger.
import type { ReactElement, ReactNode } from "react";
import {
	Popover as AriaPopover,
	Dialog,
	DialogTrigger,
	type DialogTriggerProps,
	Heading,
} from "react-aria-components";
import { InOverlayContext } from "../lib/overlay";
import { floatingLayer, floatingMotion } from "../lib/styles";
import { cn } from "../lib/utils";

export type PopoverProps = Omit<DialogTriggerProps, "children"> & {
	/** A React Aria pressable (a Button or IconButton from this package). */
	trigger: ReactElement;
	/** The content. A function gets `close`. */
	children: ReactNode | ((close: () => void) => ReactNode);
	placement?:
		| "top"
		| "bottom"
		| "start"
		| "end"
		| "bottom start"
		| "bottom end";
	className?: string;
} & (
		| {
				/** A short heading; also the dialog's accessible name. */
				title: string;
				"aria-label"?: undefined;
		  }
		| { title?: undefined; "aria-label": string }
	);

export function Popover({
	trigger,
	title,
	"aria-label": ariaLabel,
	children,
	placement = "bottom",
	className,
	...props
}: PopoverProps) {
	return (
		<DialogTrigger {...props}>
			{trigger}
			<AriaPopover
				data-slot="popover"
				placement={placement}
				offset={4}
				className={cn(
					floatingLayer,
					floatingMotion,
					"max-w-popover-s p-edge text-ui",
					className,
				)}
			>
				<Dialog
					aria-label={ariaLabel}
					className="flex flex-col gap-2 outline-none"
				>
					{({ close }) => (
						<InOverlayContext.Provider value={true}>
							{title ? (
								<Heading slot="title" className="font-ui text-ui font-control">
									{title}
								</Heading>
							) : null}
							{typeof children === "function" ? children(close) : children}
						</InOverlayContext.Provider>
					)}
				</Dialog>
			</AriaPopover>
		</DialogTrigger>
	);
}
