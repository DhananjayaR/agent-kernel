// Button: added with the shadcn CLI (aria-nova, React Aria `Button`), restyled to Spectrum 2 medium in OAK's shape:
// rectangular, the 8 px control radius (branding/README.md, "Shape"), never a pill.
// One primary action per view: `primary` for it; everything else is `secondary`, `outline` or `ghost`. The primary
// label is Archivo SemiBold (the Drive "Agent Kernel - Style Guidelines Quick Reference", May 2026: "Archivo for headlines and CTA buttons"); every other label is Inter.
// `danger` names the thing it destroys ("Destroy deployment") and always shows an icon, so it is never told
// from `primary` by colour alone (the two hues are close). `ai` is the AI button style, for an action that hands
// work to the coding agent ("Build with AI") and nothing else: an outline in the AI colour with a sparkle icon
// (shown when no icon is given), which fills with the AI colour on hover and press. It uses only existing roles:
// `text-accent-ai` for the label and edge (at least 4.5:1, so also 3:1, on every surface) and `accent-ai` with
// `on-accent-ai` for the hover fill. It is never the view's primary action. `IconButton` is the icon-only form;
// its label is required by type.

import {
	IconAlertTriangle,
	IconLoader2,
	IconSparkles,
} from "@tabler/icons-react";
import { cva, type VariantProps } from "class-variance-authority";
import type { ReactNode, RefAttributes } from "react";
import {
	Button as AriaButton,
	type ButtonProps as AriaButtonProps,
} from "react-aria-components";
import { motion } from "../lib/styles";
import { cn } from "../lib/utils";

const buttonVariants = cva(
	[
		"press focus-ring inline-flex h-control-m shrink-0 cursor-default items-center justify-center gap-text-to-visual",
		"border-2 border-transparent font-ui text-ui font-control whitespace-nowrap outline-none select-none",
		motion,
		"data-disabled:bg-disabled-fill data-disabled:text-disabled-text",
		"[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
	].join(" "),
	{
		variants: {
			variant: {
				primary:
					"bg-accent-primary font-heading font-cta text-on-accent-primary data-hovered:bg-accent-primary-hover data-pressed:bg-accent-primary-hover",
				secondary:
					"bg-fill text-text data-hovered:bg-fill-hover data-pressed:bg-fill-pressed",
				outline:
					"border-border-control bg-transparent text-text data-hovered:bg-fill data-pressed:bg-fill-hover data-disabled:border-disabled-border data-disabled:bg-transparent",
				ghost:
					"bg-transparent text-text data-hovered:bg-fill data-pressed:bg-fill-hover data-disabled:bg-transparent",
				danger:
					"bg-status-danger text-on-status-danger data-hovered:bg-status-danger-hover data-pressed:bg-status-danger-hover",
				ai: "border-text-accent-ai bg-transparent text-text-accent-ai data-hovered:bg-accent-ai data-hovered:text-on-accent-ai data-pressed:bg-accent-ai data-pressed:text-on-accent-ai data-disabled:border-disabled-border data-disabled:bg-transparent",
			},
			shape: {
				// Spectrum 2 Button's 16 px (height / 2) padding and 700 weight, in OAK's 8 px control radius.
				label: "rounded-control px-button-edge",
				// Spectrum 2 ActionButton, icon only: 32 x 32, 8 px radius.
				icon: "size-control-m rounded-control px-0",
			},
		},
		compoundVariants: [
			// Spectrum 2's quiet ActionButton: 8 px radius, 12 px padding, 500.
			{
				variant: "ghost",
				shape: "label",
				className: "rounded-control px-edge font-action",
			},
		],
		defaultVariants: { variant: "secondary", shape: "label" },
	},
);

type ButtonVariant = NonNullable<
	VariantProps<typeof buttonVariants>["variant"]
>;

type BaseProps = Omit<AriaButtonProps, "children" | "className"> &
	RefAttributes<HTMLButtonElement> & { className?: string };

export type ButtonProps = BaseProps & {
	variant?: ButtonVariant;
	/** Leading icon (Tabler outline, `@tabler/icons-react`). `danger` shows a warning icon and `ai` a sparkle when none is given. */
	icon?: ReactNode;
	children: ReactNode;
};

function PendingIcon() {
	return (
		<IconLoader2
			aria-hidden="true"
			className="animate-spin motion-reduce:animate-none"
		/>
	);
}

/**
 * A text button. While `isPending`, React Aria keeps it focusable, ignores presses and announces the pending
 * state; the leading icon becomes a spinner.
 */
export function Button({
	variant = "secondary",
	icon,
	isPending,
	className,
	children,
	...props
}: ButtonProps) {
	const leading =
		icon ??
		(variant === "danger" ? (
			<IconAlertTriangle aria-hidden="true" />
		) : variant === "ai" ? (
			<IconSparkles aria-hidden="true" />
		) : null);
	return (
		<AriaButton
			data-slot="button"
			data-variant={variant}
			isPending={isPending}
			className={cn(buttonVariants({ variant, shape: "label" }), className)}
			{...props}
		>
			{isPending ? <PendingIcon /> : leading}
			{children}
		</AriaButton>
	);
}

export type IconButtonProps = Omit<BaseProps, "aria-label"> & {
	/** What the button does ("Copy path"); also its accessible name. Required: the button has no text. */
	"aria-label": string;
	variant?: Exclude<ButtonVariant, "primary" | "danger" | "ai">;
	/** The icon (Tabler outline, `@tabler/icons-react`), decorative. */
	icon: ReactNode;
};

/** An icon-only button (Spectrum 2 ActionButton): ghost by default. */
export function IconButton({
	variant = "ghost",
	icon,
	isPending,
	className,
	...props
}: IconButtonProps) {
	return (
		<AriaButton
			data-slot="icon-button"
			data-variant={variant}
			isPending={isPending}
			className={cn(buttonVariants({ variant, shape: "icon" }), className)}
			{...props}
		>
			{isPending ? <PendingIcon /> : icon}
		</AriaButton>
	);
}

export { buttonVariants };
