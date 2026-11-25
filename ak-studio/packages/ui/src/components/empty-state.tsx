// EmptyState: a view with nothing in it yet. Says what the place is for and offers the first action (copy
// rules). Added with the shadcn CLI as `empty` (aria-nova), restyled and reduced to one component: centred,
// an optional icon in a 48 px disc, the title in the heading face, a muted description, then the actions.
import type { ReactNode } from "react";
import { cn } from "../lib/utils";

export type EmptyStateProps = {
	/** What this place is ("No projects yet"). */
	title: string;
	/** What it is for and how to fill it. */
	description: string;
	/** Icon (Tabler outline, `@tabler/icons-react`), decorative. */
	icon?: ReactNode;
	/** The first action: usually one primary Button, plus an alternative. */
	action?: ReactNode;
	/** Heading level in the page outline (default 2). */
	headingLevel?: 2 | 3 | 4;
	className?: string;
};

export function EmptyState({
	title,
	description,
	icon,
	action,
	headingLevel = 2,
	className,
}: EmptyStateProps) {
	const Heading = `h${headingLevel}` as const;
	return (
		<div
			data-slot="empty-state"
			className={cn(
				"flex flex-col items-center justify-center gap-4 p-8 text-center",
				className,
			)}
		>
			{icon ? (
				<div
					aria-hidden="true"
					className="flex size-control-xl items-center justify-center rounded-pill bg-fill text-text [&_svg]:size-6"
				>
					{icon}
				</div>
			) : null}
			<div className="flex max-w-dialog-m flex-col gap-1">
				<Heading className="font-heading text-ui-xl font-bold text-text">
					{title}
				</Heading>
				<p className="text-ui text-text-muted">{description}</p>
			</div>
			{action ? (
				<div className="flex flex-wrap items-center justify-center gap-2">
					{action}
				</div>
			) : null}
		</div>
	);
}
