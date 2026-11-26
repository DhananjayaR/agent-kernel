// The built-in controls of a generated config form, one per scalar kind (D12), on the P1a components: Input for
// strings, integers and numbers; Switch for booleans; Select for string enums. Each takes FieldControlProps, the
// same props an override receives. Set versus default: an unset field is empty and shows the default as its
// placeholder (or, where there is no box, as its hint). Numbers are typed into a text box: whole digits become a
// number on change; anything else stays text and fails the strict check (no coercion anywhere).
import { Input, Select, SelectItem, Switch } from "@ak-studio/ui";
import { fieldDescription, fieldError } from "@ak-studio/ui/lib/styles";
import { IconAlertCircle } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import type { ScalarNode } from "./schema";
import { formStrings } from "./strings";

/** What a field control gets: the field, its state in the form, and the change and blur callbacks. */
export interface FieldControlProps {
	field: ScalarNode;
	/** The current value; `undefined` when the field is not set. */
	value: unknown;
	/** Sets the value; `undefined` unsets the field. */
	onChange: (value: unknown) => void;
	onBlur: () => void;
	/** The field's error, from the strings module; set while it is invalid. */
	errorMessage?: string;
	/** How an unset field shows what OAK uses instead ("Default: 604800", "Not set"). */
	defaultHint?: string;
}

/** A schema default as the user would write it in config.yaml. */
export function defaultText(field: ScalarNode): string | undefined {
	if (!field.hasDefault) return undefined;
	const d = field.default;
	if (d === null) return formStrings.notSet;
	if (typeof d === "boolean") {
		return formStrings.defaultHint(
			d ? formStrings.booleanText.on : formStrings.booleanText.off,
		);
	}
	return formStrings.defaultHint(String(d));
}

const INTEGER = /^-?\d+$/;
const NUMBER = /^-?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?$/;

/** Text typed into a number box, as a form value: a number only when the whole text is one. */
export function parseNumeric(text: string, kind: "integer" | "number") {
	if (text === "") return undefined;
	return (kind === "integer" ? INTEGER : NUMBER).test(text)
		? Number(text)
		: text;
}

const shown = (value: unknown) =>
	value === undefined || value === null ? "" : String(value);

function TextControl({
	field,
	value,
	onChange,
	onBlur,
	errorMessage,
	defaultHint,
}: FieldControlProps) {
	return (
		<Input
			label={field.key}
			description={field.description}
			placeholder={defaultHint}
			value={shown(value)}
			onChange={(text) => onChange(text === "" ? undefined : text)}
			onBlur={onBlur}
			isRequired={field.required}
			isInvalid={errorMessage !== undefined}
			errorMessage={errorMessage}
		/>
	);
}

/**
 * Keeps what was typed ("1." on the way to "1.5") while the form holds the parsed value; takes the form's value
 * again when it changes from outside (a reset).
 */
function NumericControl({
	field,
	value,
	onChange,
	onBlur,
	errorMessage,
	defaultHint,
}: FieldControlProps) {
	const kind = field.kind === "integer" ? "integer" : "number";
	const [text, setText] = useState(shown(value));
	useEffect(() => {
		setText((current) =>
			Object.is(parseNumeric(current, kind), value) ? current : shown(value),
		);
	}, [value, kind]);
	return (
		<Input
			label={field.key}
			description={field.description}
			placeholder={defaultHint}
			inputMode={kind === "integer" ? "numeric" : "decimal"}
			value={text}
			onChange={(next) => {
				setText(next);
				onChange(parseNumeric(next, kind));
			}}
			onBlur={onBlur}
			isRequired={field.required}
			isInvalid={errorMessage !== undefined}
			errorMessage={errorMessage}
		/>
	);
}

/** Help and error text under a control that has no field frame of its own (the switch). */
function FieldNotes({
	notes,
	errorMessage,
}: {
	notes: (string | undefined)[];
	errorMessage?: string;
}) {
	return (
		<>
			{notes.filter(Boolean).map((note) => (
				<p key={note} className={fieldDescription}>
					{note}
				</p>
			))}
			{errorMessage ? (
				<p className={fieldError} role="alert">
					<IconAlertCircle aria-hidden="true" />
					<span>{errorMessage}</span>
				</p>
			) : null}
		</>
	);
}

function BooleanControl({
	field,
	value,
	onChange,
	onBlur,
	errorMessage,
	defaultHint,
}: FieldControlProps) {
	const isSet = typeof value === "boolean";
	return (
		<div className="flex flex-col gap-1">
			<Switch
				isSelected={isSet ? value : field.default === true}
				onChange={(selected) => onChange(selected)}
				onBlur={onBlur}
			>
				{field.key}
			</Switch>
			<FieldNotes
				notes={[field.description, isSet ? undefined : defaultHint]}
				errorMessage={errorMessage}
			/>
		</div>
	);
}

function EnumControl({
	field,
	value,
	onChange,
	onBlur,
	errorMessage,
	defaultHint,
}: FieldControlProps) {
	return (
		<Select
			label={field.key}
			description={field.description}
			placeholder={defaultHint}
			selectedKey={typeof value === "string" ? value : null}
			onSelectionChange={(key) => onChange(key ?? undefined)}
			onBlur={onBlur}
			isRequired={field.required}
			isInvalid={errorMessage !== undefined}
			errorMessage={errorMessage}
		>
			{(field.options ?? []).map((option) => (
				<SelectItem key={option} id={option}>
					{option}
				</SelectItem>
			))}
		</Select>
	);
}

/** The built-in control for a field's kind. */
export function BuiltInControl(props: FieldControlProps) {
	switch (props.field.kind) {
		case "integer":
		case "number":
			return <NumericControl {...props} />;
		case "boolean":
			return <BooleanControl {...props} />;
		case "enum":
			return <EnumControl {...props} />;
		default:
			return <TextControl {...props} />;
	}
}
