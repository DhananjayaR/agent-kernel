// Spinner: a short wait on something small (a control's pending state, a check that takes a moment). Added with
// the shadcn CLI (aria-nova), restyled. Its label is required: never a spinner with no label. A long operation
// is a labelled job (JobProgress, P1b), not a spinner. The label is visible unless `hideLabel`, and is announced
// through role="status". Under reduced motion the icon stays still; the label carries the meaning.
import { Loader2Icon } from "lucide-react";
import type { HTMLAttributes } from "react";
import { cn } from "../lib/utils";

export type SpinnerProps = Omit<HTMLAttributes<HTMLSpanElement>, "children"> & {
	/** What is happening ("Checking the toolchain"). */
	label: string;
	/** Keep the label for assistive technology only (when the context already shows it). */
	hideLabel?: boolean;
};

export function Spinner({
	label,
	hideLabel = false,
	className,
	...props
}: SpinnerProps) {
	return (
		<span
			data-slot="spinner"
			role="status"
			className={cn(
				"inline-flex items-center gap-text-to-visual text-ui text-text",
				className,
			)}
			{...props}
		>
			<Loader2Icon
				aria-hidden="true"
				className="size-4 shrink-0 animate-spin motion-reduce:animate-none"
			/>
			<span className={hideLabel ? "sr-only" : undefined}>{label}</span>
		</span>
	);
}
