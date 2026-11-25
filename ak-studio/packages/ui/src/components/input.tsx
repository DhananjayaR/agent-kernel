// Input: a single-line text field. Added with the shadcn CLI (aria-nova, React Aria `Input`), restyled to
// Spectrum 2's TextField and made a whole field on React Aria `TextField`: label, box, help text and error, so
// a field cannot ship without a label. Read-only (P3's config forms) keeps the box and drops the hover change.
import {
	Input as AriaInput,
	TextField,
	type TextFieldProps,
} from "react-aria-components";
import { fieldBox, fieldRoot } from "../lib/styles";
import { cn } from "../lib/utils";
import { FieldFrame, type FieldTextProps } from "./field";

/** The text box itself, for the field components. */
export const inputBox = cn(
	fieldBox,
	"focus-ring placeholder:text-text-muted read-only:not-data-invalid:data-hovered:border-border-control",
);

export type InputProps = Omit<TextFieldProps, "children" | "className"> &
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
				<AriaInput placeholder={placeholder} className={inputBox} />
			</FieldFrame>
		</TextField>
	);
}
