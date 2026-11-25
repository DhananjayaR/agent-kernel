// Tooltip: a short label for a control that has no visible text (an IconButton). Added with the shadcn CLI
// (aria-nova, React Aria `TooltipTrigger` and `Tooltip`), restyled: solid overlay surface (floating layers are
// solid), decorative hairline, 4 px radius, 12 px text. React Aria shows it on hover after a delay and at once
// on keyboard focus, and hides it on Escape. Never the only place information lives.
import type { ReactElement, ReactNode } from "react";
import {
	Tooltip as AriaTooltip,
	TooltipTrigger,
	type TooltipTriggerComponentProps,
} from "react-aria-components";
import { floatingMotion } from "../lib/styles";
import { cn } from "../lib/utils";

export type TooltipProps = Omit<TooltipTriggerComponentProps, "children"> & {
	/** The text shown. */
	content: ReactNode;
	/** One React Aria focusable element, such as a Button or IconButton from this package. */
	children: ReactElement;
	placement?: "top" | "bottom" | "start" | "end";
};

export function Tooltip({
	content,
	children,
	placement = "top",
	delay = 600,
	...props
}: TooltipProps) {
	return (
		<TooltipTrigger delay={delay} {...props}>
			{children}
			<AriaTooltip
				data-slot="tooltip"
				placement={placement}
				offset={6}
				className={cn(
					"max-w-popover-s rounded-sm border border-border-default bg-surface-overlay px-2 py-1 text-ui-sm text-text shadow-elevated",
					floatingMotion,
				)}
			>
				{content}
			</AriaTooltip>
		</TooltipTrigger>
	);
}
