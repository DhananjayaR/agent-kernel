// Textarea: a multi-line text field (config values that span lines). Added with the shadcn CLI (aria-nova,
// React Aria `TextArea`), restyled like Input and made a whole field on React Aria `TextField`.
import {
	TextArea as AriaTextArea,
	TextField,
	type TextFieldProps,
} from "react-aria-components";
import { fieldRoot } from "../lib/styles";
import { cn } from "../lib/utils";
import { FieldFrame, type FieldTextProps } from "./field";
import { inputBox } from "./input";

export type TextareaProps = Omit<TextFieldProps, "children" | "className"> &
	FieldTextProps & {
		placeholder?: string;
		/** Visible lines before it scrolls (default 3). */
		rows?: number;
		className?: string;
	};

export function Textarea({
	label,
	description,
	errorMessage,
	placeholder,
	rows = 3,
	className,
	...props
}: TextareaProps) {
	return (
		<TextField
			data-slot="textarea"
			className={cn(fieldRoot, className)}
			{...props}
		>
			<FieldFrame
				label={label}
				description={description}
				errorMessage={errorMessage}
			>
				<AriaTextArea
					rows={rows}
					placeholder={placeholder}
					className={cn(inputBox, "h-auto resize-y py-text-to-visual")}
				/>
			</FieldFrame>
		</TextField>
	);
}
