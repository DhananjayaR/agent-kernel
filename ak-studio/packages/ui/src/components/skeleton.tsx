// Skeleton: stands in for content that is loading (after the 300 ms no-indicator window; the timing is applied
// by the shared hooks, not here). Added with the shadcn CLI (aria-nova), restyled: the neutral fill, 8 px
// radius, a pulse that stops under reduced motion. Hidden from assistive technology: mark the region being
// loaded with aria-busy instead.
import type { HTMLAttributes } from "react";
import { cn } from "../lib/utils";

export function Skeleton({
	className,
	...props
}: HTMLAttributes<HTMLDivElement>) {
	return (
		<div
			data-slot="skeleton"
			aria-hidden="true"
			className={cn(
				"h-4 animate-pulse rounded-control bg-fill motion-reduce:animate-none",
				className,
			)}
			{...props}
		/>
	);
}
