// Badge: a count or a short note on something else (the number of problems on a panel tab). Added with the
// shadcn CLI (aria-nova), restyled: 20 px pill, 11 px bold text, tabular figures. Never a state: the state of
// something is a StatusChip, so Badge has no success, warning or danger variants.
import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "../lib/utils";

const badgeVariants = cva(
	"inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-pill px-1.5 font-ui text-ui-xs font-control whitespace-nowrap tabular-nums",
	{
		variants: {
			variant: {
				/** On the neutral fill; for counts. */
				neutral: "bg-fill text-text",
				/** On the primary fill; for something new that needs attention. */
				accent: "bg-accent-primary text-on-accent-primary",
			},
		},
		defaultVariants: { variant: "neutral" },
	},
);

export type BadgeProps = HTMLAttributes<HTMLSpanElement> &
	VariantProps<typeof badgeVariants>;

export function Badge({ variant, className, ...props }: BadgeProps) {
	return (
		<span
			data-slot="badge"
			className={cn(badgeVariants({ variant }), className)}
			{...props}
		/>
	);
}
