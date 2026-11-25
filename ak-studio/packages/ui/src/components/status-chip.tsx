// StatusChip: the state of something (a check, a command, a tool). The one component for it: never a coloured
// word, a bare dot or a Badge. Written by hand (shadcn has no equivalent). 24 px, the 8 px control
// radius, a decorative hairline; each state has its own icon and label, so it is never colour alone (the status colours are close
// to the primary one), and the icon takes the state's text colour.
import {
	IconCircleCheck,
	IconCircleDashed,
	IconCircleX,
	IconClockHour3,
	IconLoader2,
	type TablerIcon,
} from "@tabler/icons-react";
import type { HTMLAttributes } from "react";
import { cn } from "../lib/utils";
import { uiStrings } from "../strings";

export type Status = "passed" | "running" | "waiting" | "failed" | "not-set-up";

const STATES: Record<Status, { Icon: TablerIcon; iconClass: string }> = {
	passed: {
		Icon: IconCircleCheck,
		iconClass: "text-text-status-success",
	},
	running: {
		Icon: IconLoader2,
		iconClass: "animate-spin text-text",
	},
	waiting: {
		Icon: IconClockHour3,
		iconClass: "text-text-status-warning",
	},
	failed: {
		Icon: IconCircleX,
		iconClass: "text-text-status-danger",
	},
	"not-set-up": {
		Icon: IconCircleDashed,
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
	const { Icon, iconClass } = STATES[status];
	const defaultLabel = uiStrings.status[status];
	return (
		<span
			data-slot="status-chip"
			data-status={status}
			className={cn(
				"inline-flex h-control-s shrink-0 items-center gap-1.5 rounded-control border border-border-default px-2.5 text-ui-sm font-action text-text whitespace-nowrap",
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
