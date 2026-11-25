// Input: a single-line text field. Added with the shadcn CLI (aria-nova, React Aria `Input`), restyled to
// Spectrum 2's TextField and made a whole field on React Aria `TextField`: label, box, help text and error. A
// field is named by type (`label`, `aria-label` or `aria-labelledby`). Read-only (P3's config forms) keeps the
// box, shows focus, and does not change on hover. State colours: `fieldBoxColours` (lib/state.ts).
import {
	Input as AriaInput,
	TextField,
	type TextFieldProps,
} from "react-aria-components";
import { fieldBoxColours } from "../lib/state";
import { fieldBox, fieldRoot } from "../lib/styles";
import { cn } from "../lib/utils";
import { FieldFrame, type FieldTextProps } from "./field";

export type InputProps = Omit<
	TextFieldProps,
	"children" | "className" | "aria-label" | "aria-labelledby"
> &
	FieldTextProps & {
		/** Hint inside the empty box. Not a label, and not example copy. */
		placeholder?: string;
		/** Classes for the field's root (for example a width). */
		className?: string;
	};

export function Input({
	label,
	description,
	errorMessage,
	placeholder,
	className,
	...props
}: InputProps) {
	return (
		<TextField
			data-slot="input"
			className={cn(fieldRoot, className)}
			{...props}
		>
			<FieldFrame
				label={label}
				description={description}
				errorMessage={errorMessage}
			>
				<AriaInput
					placeholder={placeholder}
					className={({ isHovered, isFocused, isInvalid, isDisabled }) =>
						cn(
							fieldBox,
							"focus-ring",
							fieldBoxColours({
								hovered: isHovered,
								focused: isFocused,
								invalid: isInvalid,
								disabled: isDisabled,
								readOnly: props.isReadOnly,
							}),
						)
					}
				/>
			</FieldFrame>
		</TextField>
	);
}
