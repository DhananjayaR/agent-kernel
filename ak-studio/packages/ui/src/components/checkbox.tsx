// Checkbox: select or deselect one item (an optional config section, a row). Added with the shadcn CLI
// (aria-nova, React Aria `Checkbox`), restyled to Spectrum 2: a 16 px box with a 2 px border and 4 px radius in
// a 32 px row. On (selected or indeterminate) fills with the primary (selection) colour, draws its edge in
// text-accent-primary (at least 3:1 on every surface) and shows a mark, so the state is never colour alone.
// Invalid draws the danger border and, with `errorMessage`, text with an icon. Read-only does not change on hover
// or press. State colours and their precedence: `toggleIndicatorColours` (lib/state.ts).
import { IconAlertCircle, IconCheck, IconMinus } from "@tabler/icons-react";
import { type ReactNode, useId } from "react";
import {
	Checkbox as AriaCheckbox,
	type CheckboxProps as AriaCheckboxProps,
} from "react-aria-components";
import { toggleIndicatorColours, toggleLabelColour } from "../lib/state";
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
			className={({ isDisabled }) =>
				cn(
					"group/checkbox flex min-h-control-m cursor-default items-center gap-2 text-ui select-none",
					toggleLabelColour({ disabled: isDisabled }),
					!showError && className,
				)
			}
			{...props}
		>
			{({
				isSelected,
				isIndeterminate,
				isHovered,
				isPressed,
				isInvalid,
				isDisabled,
				isReadOnly,
				isFocusVisible,
			}) => (
				<>
					<span
						data-slot="checkbox-box"
						aria-hidden="true"
						className={cn(
							"flex size-4 shrink-0 items-center justify-center rounded-sm border-2",
							motion,
							toggleIndicatorColours({
								selected: isSelected,
								indeterminate: isIndeterminate,
								hovered: isHovered,
								pressed: isPressed,
								invalid: isInvalid,
								disabled: isDisabled,
								readOnly: isReadOnly,
							}),
							isFocusVisible && "focus-outline",
							"[&_svg]:size-3 [&_svg]:stroke-3",
						)}
					>
						{isIndeterminate ? (
							<IconMinus aria-hidden="true" />
						) : isSelected ? (
							<IconCheck aria-hidden="true" />
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
				<IconAlertCircle aria-hidden="true" />
				{errorMessage}
			</span>
		</div>
	);
}
