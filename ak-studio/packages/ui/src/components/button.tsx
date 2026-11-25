// Button: added with the shadcn CLI (aria-nova, React Aria `Button`), restyled to Spectrum 2 medium.
// One primary action per view: `primary` for it; everything else is `secondary`, `outline` or `ghost`.
// `danger` names the thing it destroys ("Destroy deployment") and always shows an icon, so it is never told
// from `primary` by colour alone (the two hues are close). `IconButton` is the icon-only form; its label is
// required by type.
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2Icon, TriangleAlertIcon } from "lucide-react";
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
					"bg-accent-primary text-on-accent-primary data-hovered:bg-accent-primary-hover data-pressed:bg-accent-primary-hover",
				secondary:
					"bg-fill text-text data-hovered:bg-fill-hover data-pressed:bg-fill-pressed",
				outline:
					"border-border-control bg-transparent text-text data-hovered:bg-fill data-pressed:bg-fill-hover data-disabled:border-disabled-border data-disabled:bg-transparent",
				ghost:
					"bg-transparent text-text data-hovered:bg-fill data-pressed:bg-fill-hover data-disabled:bg-transparent",
				danger:
					"bg-status-danger text-on-status-danger data-hovered:bg-status-danger-hover data-pressed:bg-status-danger-hover",
			},
			shape: {
				// Spectrum 2 Button: pill, 16 px (height / 2) padding, 700.
				label: "rounded-pill px-pill-edge",
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
	/** Leading icon (lucide-react). `danger` shows a warning icon when none is given. */
	icon?: ReactNode;
	children: ReactNode;
};

function PendingIcon() {
	return (
		<Loader2Icon
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
		(variant === "danger" ? <TriangleAlertIcon aria-hidden="true" /> : null);
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
	variant?: Exclude<ButtonVariant, "primary" | "danger">;
	/** The icon (lucide-react), decorative. */
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
