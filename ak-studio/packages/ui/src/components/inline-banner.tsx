// InlineBanner: a message about a whole view, inside it (changed on disk, opened read-only below the supported
// version, cannot read a file). Feedback placement: inline for a field, a banner for a view, a toast only for
// something that finished in the background. Added with the shadcn CLI as `alert` (aria-nova), restyled: raised
// surface, decorative hairline, a 4 px start edge and an icon in the tone's text colour (never colour alone),
// title, description, then actions. Errors say what happened and what to do next.
import {
	CircleCheckIcon,
	CircleXIcon,
	InfoIcon,
	type LucideIcon,
	TriangleAlertIcon,
} from "lucide-react";
import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../lib/utils";

export type BannerTone = "info" | "success" | "warning" | "danger";

const TONES: Record<
	BannerTone,
	{ Icon: LucideIcon; icon: string; edge: string }
> = {
	info: { Icon: InfoIcon, icon: "text-text", edge: "border-l-border-control" },
	success: {
		Icon: CircleCheckIcon,
		icon: "text-text-status-success",
		edge: "border-l-text-status-success",
	},
	warning: {
		Icon: TriangleAlertIcon,
		icon: "text-text-status-warning",
		edge: "border-l-text-status-warning",
	},
	danger: {
		Icon: CircleXIcon,
		icon: "text-text-status-danger",
		edge: "border-l-text-status-danger",
	},
};

export type InlineBannerProps = Omit<
	HTMLAttributes<HTMLDivElement>,
	"title"
> & {
	tone?: BannerTone;
	/** What happened, in one line. */
	title: string;
	/** What it means and what to do next. */
	children?: ReactNode;
	/** Buttons for the next step ("Reload", "Open file"). */
	actions?: ReactNode;
};

export function InlineBanner({
	tone = "info",
	title,
	children,
	actions,
	className,
	...props
}: InlineBannerProps) {
	const { Icon, icon, edge } = TONES[tone];
	return (
		<div
			data-slot="inline-banner"
			data-tone={tone}
			className={cn(
				"flex flex-wrap items-start gap-3 rounded-control border border-l-4 border-border-default bg-surface-raised py-3 pr-3 pl-edge text-ui text-text",
				edge,
				className,
			)}
			{...props}
		>
			<Icon aria-hidden="true" className={cn("mt-px size-4 shrink-0", icon)} />
			<div className="flex min-w-0 flex-1 flex-col gap-1">
				<p className="font-bold">{title}</p>
				{children ? <div className="text-text">{children}</div> : null}
			</div>
			{actions ? (
				<div className="flex shrink-0 items-center gap-2">{actions}</div>
			) : null}
		</div>
	);
}
