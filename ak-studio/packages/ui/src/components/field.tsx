// Internal parts shared by the field components (Input, Textarea, Select, Combobox): label, help text and
// error text on React Aria's Label, Text and FieldError, so each field is labelled and its error is announced.
// Not exported from the package: features use the field components' `label`, `description` and `errorMessage`.
import { CircleAlertIcon } from "lucide-react";
import type { ReactNode } from "react";
import {
	FieldError as AriaFieldError,
	Label as AriaLabel,
	Text,
} from "react-aria-components";
import { fieldDescription, fieldError, fieldLabel } from "../lib/styles";

export type FieldTextProps = {
	/** Visible label. Without one, pass `aria-label` to the field. */
	label?: string;
	/** Help text under the field. */
	description?: string;
	/** Shown under the field, with an icon, while the field is invalid. Says what to do next. */
	errorMessage?: string;
};

export function FieldLabel({ children }: { children: string }) {
	return <AriaLabel className={fieldLabel}>{children}</AriaLabel>;
}

export function FieldDescription({ children }: { children: string }) {
	return (
		<Text slot="description" className={fieldDescription}>
			{children}
		</Text>
	);
}

export function FieldErrorText({ children }: { children?: string }) {
	return (
		<AriaFieldError className={fieldError}>
			<CircleAlertIcon aria-hidden="true" />
			<span>{children}</span>
		</AriaFieldError>
	);
}

/** Label, then the control, then help and error text. */
export function FieldFrame({
	label,
	description,
	errorMessage,
	children,
}: FieldTextProps & { children: ReactNode }) {
	return (
		<>
			{label ? <FieldLabel>{label}</FieldLabel> : null}
			{children}
			{description ? <FieldDescription>{description}</FieldDescription> : null}
			<FieldErrorText>{errorMessage}</FieldErrorText>
		</>
	);
}
