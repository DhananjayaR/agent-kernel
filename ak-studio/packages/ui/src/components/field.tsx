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

/**
 * A field must be named: a visible `label`, or (where the name is shown elsewhere, as in a table cell)
 * `aria-label` or `aria-labelledby`. Enforced by type.
 */
export type FieldLabelling =
	| { label: string; "aria-label"?: string; "aria-labelledby"?: string }
	| { label?: undefined; "aria-label": string; "aria-labelledby"?: string }
	| { label?: undefined; "aria-label"?: string; "aria-labelledby": string };

export type FieldTextProps = FieldLabelling & {
	/** Help text under the field. */
	description?: string;
	/**
	 * Shown under the field, with an icon, while it is invalid. Says what to do next. Without it, React Aria's
	 * own validation message (from `isRequired`, `validate`, ...) is shown.
	 */
	errorMessage?: string;
};

/** The props a field component takes from the caller that are not React Aria's. */
export type FieldOwnProps = "label" | "description" | "errorMessage";

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
			{({ validationErrors }) => {
				const text = children || validationErrors.join(" ");
				return text ? (
					<>
						<CircleAlertIcon aria-hidden="true" />
						<span>{text}</span>
					</>
				) : null;
			}}
		</AriaFieldError>
	);
}

/** Label, then the control, then help and error text. */
export function FieldFrame({
	label,
	description,
	errorMessage,
	children,
}: {
	label?: string;
	description?: string;
	errorMessage?: string;
	children: ReactNode;
}) {
	return (
		<>
			{label ? <FieldLabel>{label}</FieldLabel> : null}
			{children}
			{description ? <FieldDescription>{description}</FieldDescription> : null}
			<FieldErrorText>{errorMessage}</FieldErrorText>
		</>
	);
}
