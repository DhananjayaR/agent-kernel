// Badge: a count on something else (the number of problems on a panel tab). Added with the shadcn CLI
// (aria-nova), restyled: 20 px pill, 11 px bold text, tabular figures, on the neutral fill. One look only: it is
// never a state (that is a StatusChip) and never uses the primary colour, which is reserved for the primary
// action, focus and selection.
import type { HTMLAttributes } from "react";
import { cn } from "../lib/utils";

export type BadgeProps = HTMLAttributes<HTMLSpanElement>;

export function Badge({ className, ...props }: BadgeProps) {
	return (
		<span
			data-slot="badge"
			className={cn(
				"inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-pill bg-fill px-1.5 font-ui text-ui-xs font-control whitespace-nowrap text-text tabular-nums",
				className,
			)}
			{...props}
		/>
	);
}
