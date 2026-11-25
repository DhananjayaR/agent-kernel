// Card: a group of related content on a raised surface (a recent project, the toolchain check). Added with the
// shadcn CLI (aria-nova), restyled: raised surface, decorative hairline, OAK's 16 px card radius, 16 px padding, title in
// the heading face. Text roles all hold 4.5:1 on the raised surface.
import type { HTMLAttributes } from "react";
import { cn } from "../lib/utils";

type DivProps = HTMLAttributes<HTMLDivElement>;

export function Card({ className, ...props }: DivProps) {
	return (
		<div
			data-slot="card"
			className={cn(
				"flex flex-col gap-4 rounded-card border border-border-default bg-surface-raised p-4 text-ui text-text",
				className,
			)}
			{...props}
		/>
	);
}

/** Title and description on the left, an optional `CardAction` on the right. */
export function CardHeader({ className, ...props }: DivProps) {
	return (
		<div
			data-slot="card-header"
			className={cn(
				"grid grid-cols-1 items-start gap-x-4 gap-y-1 has-data-[slot=card-action]:grid-cols-2",
				className,
			)}
			{...props}
		/>
	);
}

export type CardTitleProps = HTMLAttributes<HTMLHeadingElement> & {
	/** Heading level in the page outline (default 3). */
	level?: 2 | 3 | 4;
};

export function CardTitle({ level = 3, className, ...props }: CardTitleProps) {
	const Heading = `h${level}` as const;
	return (
		<Heading
			data-slot="card-title"
			className={cn(
				"col-start-1 font-heading text-ui-lg font-bold text-text",
				className,
			)}
			{...props}
		/>
	);
}

export function CardDescription({ className, ...props }: DivProps) {
	return (
		<div
			data-slot="card-description"
			className={cn("col-start-1 text-ui text-text-muted", className)}
			{...props}
		/>
	);
}

export function CardAction({ className, ...props }: DivProps) {
	return (
		<div
			data-slot="card-action"
			className={cn(
				"col-start-2 row-span-2 row-start-1 self-start justify-self-end",
				className,
			)}
			{...props}
		/>
	);
}

export function CardContent({ className, ...props }: DivProps) {
	return (
		<div
			data-slot="card-content"
			className={cn("flex flex-col gap-2", className)}
			{...props}
		/>
	);
}

export function CardFooter({ className, ...props }: DivProps) {
	return (
		<div
			data-slot="card-footer"
			className={cn("flex items-center justify-end gap-2", className)}
			{...props}
		/>
	);
}
