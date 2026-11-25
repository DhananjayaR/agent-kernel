// StatusChip: the state of something (a check, a command, a tool). The one component for it: never a coloured
// word, a bare dot or a Badge. Written by hand (shadcn has no equivalent). 24 px pill with a decorative
// hairline; each state has its own icon and label, so it is never colour alone (the status colours are close
// to the primary one), and the icon takes the state's text colour.
import {
	CircleCheckIcon,
	CircleDashedIcon,
	CircleXIcon,
	Clock3Icon,
	Loader2Icon,
	type LucideIcon,
} from "lucide-react";
import type { HTMLAttributes } from "react";
import { cn } from "../lib/utils";

export type Status = "passed" | "running" | "waiting" | "failed" | "not-set-up";

const STATES: Record<
	Status,
	{ label: string; Icon: LucideIcon; iconClass: string }
> = {
	passed: {
		label: "Passed",
		Icon: CircleCheckIcon,
		iconClass: "text-text-status-success",
	},
	running: {
		label: "Running",
		Icon: Loader2Icon,
		iconClass: "animate-spin text-text",
	},
	waiting: {
		label: "Waiting",
		Icon: Clock3Icon,
		iconClass: "text-text-status-warning",
	},
	failed: {
		label: "Failed",
		Icon: CircleXIcon,
		iconClass: "text-text-status-danger",
	},
	"not-set-up": {
		label: "Not set up",
		Icon: CircleDashedIcon,
		iconClass: "text-text-muted",
	},
};

export type StatusChipProps = Omit<
	HTMLAttributes<HTMLSpanElement>,
	"children"
> & {
	status: Status;
	/**
	 * Replaces the state's default label with a more specific one in the same meaning ("Found" for passed,
	 * "Missing" for not set up, "Wrong version" for failed). The icon stays the state's.
	 */
	label?: string;
};

export function StatusChip({
	status,
	label,
	className,
	...props
}: StatusChipProps) {
	const { label: defaultLabel, Icon, iconClass } = STATES[status];
	return (
		<span
			data-slot="status-chip"
			data-status={status}
			className={cn(
				"inline-flex h-control-s shrink-0 items-center gap-1.5 rounded-pill border border-border-default px-2.5 text-ui-sm font-action text-text whitespace-nowrap",
				className,
			)}
			{...props}
		>
			<Icon
				aria-hidden="true"
				className={cn("size-4 shrink-0 motion-reduce:animate-none", iconClass)}
			/>
			{label ?? defaultLabel}
		</span>
	);
}
