// Checkbox: select or deselect one item (an optional config section, a row). Added with the shadcn CLI
// (aria-nova, React Aria `Checkbox`), restyled to Spectrum 2: a 16 px box with a 2 px control border and 4 px
// radius in a 32 px row; selected fills with the primary (selection) colour and shows a mark, so the state is
// never colour alone. Invalid adds the danger border and, with `errorMessage`, text with an icon.
import { CheckIcon, CircleAlertIcon, MinusIcon } from "lucide-react";
import { type ReactNode, useId } from "react";
import {
	Checkbox as AriaCheckbox,
	type CheckboxProps as AriaCheckboxProps,
} from "react-aria-components";
import { fieldError, motion } from "../lib/styles";
import { cn } from "../lib/utils";

export type CheckboxProps = Omit<
	AriaCheckboxProps,
	"children" | "className"
> & {
	/** The label, next to the box. */
	children: ReactNode;
	/** Shown under the checkbox while it is invalid. */
	errorMessage?: string;
	className?: string;
};

export function Checkbox({
	children,
	errorMessage,
	className,
	...props
}: CheckboxProps) {
	const errorId = useId();
	const showError = Boolean(props.isInvalid && errorMessage);
	const checkbox = (
		<AriaCheckbox
			data-slot="checkbox"
			aria-describedby={showError ? errorId : undefined}
			className={cn(
				"group/checkbox flex min-h-control-m cursor-default items-center gap-2 text-ui text-text select-none",
				"data-disabled:text-disabled-text",
				!showError && className,
			)}
			{...props}
		>
			{({ isSelected, isIndeterminate }) => (
				<>
					<span
						data-slot="checkbox-box"
						aria-hidden="true"
						className={cn(
							"flex size-4 shrink-0 items-center justify-center rounded-sm border-2 border-border-control text-on-accent-primary",
							motion,
							"group-data-hovered/checkbox:border-text-muted",
							"group-data-selected/checkbox:border-accent-primary group-data-selected/checkbox:bg-accent-primary",
							"group-data-indeterminate/checkbox:border-accent-primary group-data-indeterminate/checkbox:bg-accent-primary",
							"group-data-selected/checkbox:group-data-hovered/checkbox:border-accent-primary-hover group-data-selected/checkbox:group-data-hovered/checkbox:bg-accent-primary-hover",
							"group-data-invalid/checkbox:border-text-status-danger group-data-invalid/checkbox:group-data-selected/checkbox:border-text-status-danger",
							"group-data-disabled/checkbox:border-disabled-border group-data-disabled/checkbox:bg-disabled-fill group-data-disabled/checkbox:text-disabled-text",
							"group-data-selected/checkbox:group-data-disabled/checkbox:border-disabled-border group-data-selected/checkbox:group-data-disabled/checkbox:bg-disabled-fill",
							"group-data-focus-visible/checkbox:focus-outline",
							"[&_svg]:size-3 [&_svg]:stroke-3",
						)}
					>
						{isIndeterminate ? (
							<MinusIcon />
						) : isSelected ? (
							<CheckIcon />
						) : null}
					</span>
					{children}
				</>
			)}
		</AriaCheckbox>
	);
	if (!showError) return checkbox;
	return (
		<div className={cn("flex flex-col", className)}>
			{checkbox}
			<span id={errorId} className={fieldError}>
				<CircleAlertIcon aria-hidden="true" />
				{errorMessage}
			</span>
		</div>
	);
}
