// SchemaForm: a config section's form, generated from its JSON schema (D12; architecture.md "Forms"; the
// "Schema form" pattern). React Hook Form holds the working copy; each field is checked on blur (then on every
// change) by the section's precompiled strict validator, for immediate feedback. The kernel stays the
// authority: whoever saves (P3) validates the whole section with the installed OAK.
//
// P1b skeleton, filled out in P3. It renders string, number, integer, boolean and enum fields, nullable scalars,
// sections and Optional sections; anything else is shown as not editable here. `value` is the section as set in
// config.yaml (unset keys absent); `onSubmit` gets it back the same way. The form takes `value` when it mounts:
// to load another, remount it (a `key`). Not wired to a server or to useWorkingCopy yet.
import { Button, Switch } from "@ak-studio/ui";
import { fieldDescription, fieldError } from "@ak-studio/ui/lib/styles";
import { type ComponentType, useMemo } from "react";
import {
	FormProvider,
	get,
	useController,
	useForm,
	useFormContext,
	useFormState,
	useWatch,
} from "react-hook-form";
import { BuiltInControl, defaultText, type FieldControlProps } from "./fields";
import {
	describeSchema,
	type JsonSchema,
	type ObjectNode,
	optionalSectionPaths,
	type ScalarNode,
	type SchemaNode,
} from "./schema";
import { formStrings } from "./strings";
import { type SchemaValidator, schemaResolver } from "./validator";

export type { FieldControlProps } from "./fields";

/** Per-field replacements of the built-in control, keyed by the field's dotted path (`session.type`: `type`). */
export type FieldOverrides = Readonly<
	Record<string, ComponentType<FieldControlProps>>
>;

export interface SchemaFormProps {
	/** The section's JSON schema (draft 2020-12, as Pydantic writes it). */
	schema: JsonSchema;
	/** The section's validator, precompiled from the same schema by `pnpm compile-schemas`. */
	validate: SchemaValidator;
	/** The section as set in config.yaml: unset keys are absent. */
	value: Record<string, unknown>;
	/** Called with the checked section, unset fields left out. */
	onSubmit: (value: Record<string, unknown>) => void;
	overrides?: FieldOverrides;
}

type FormValues = Record<string, unknown>;

const isSection = (v: unknown) =>
	typeof v === "object" && v !== null && !Array.isArray(v);

function ScalarField({
	node,
	overrides,
}: {
	node: ScalarNode;
	overrides?: FieldOverrides;
}) {
	const { field, fieldState } = useController<FormValues>({ name: node.path });
	const Control = overrides?.[node.path] ?? BuiltInControl;
	return (
		<Control
			field={node}
			value={field.value}
			onChange={field.onChange}
			onBlur={field.onBlur}
			errorMessage={fieldState.error?.message}
			defaultHint={defaultText(node)}
		/>
	);
}

function UnsupportedField({ node }: { node: SchemaNode }) {
	return (
		<div className="flex flex-col gap-1">
			<p className="text-ui-sm font-action text-text-muted">{node.key}</p>
			<p className={fieldDescription}>{formStrings.unsupported}</p>
		</div>
	);
}

/** An error on the section itself (for example the section is not a mapping in config.yaml). */
function SectionError({ path }: { path: string }) {
	const { errors } = useFormState<FormValues>({ name: path });
	const message: unknown = (
		get(errors, path) as { message?: unknown } | undefined
	)?.message;
	return typeof message === "string" ? (
		<p className={fieldError} role="alert">
			{message}
		</p>
	) : null;
}

function Section({
	node,
	overrides,
}: {
	node: ObjectNode;
	overrides?: FieldOverrides;
}) {
	const { setValue, clearErrors } = useFormContext<FormValues>();
	const current = useWatch<FormValues>({ name: node.path });
	const on = !node.optional || isSection(current);
	return (
		<fieldset className="flex flex-col gap-3 border-l border-border-default pl-4">
			<legend className="pb-1 text-ui font-action text-text">{node.key}</legend>
			{node.description ? (
				<p className={fieldDescription}>{node.description}</p>
			) : null}
			{node.optional ? (
				<Switch
					isSelected={on}
					onChange={(selected) => {
						clearErrors(node.path);
						setValue(node.path, selected ? {} : undefined, {
							shouldDirty: true,
						});
					}}
				>
					{formStrings.configureSection(node.key)}
				</Switch>
			) : null}
			<SectionError path={node.path} />
			{on ? <FieldList nodes={node.children} overrides={overrides} /> : null}
		</fieldset>
	);
}

function FieldList({
	nodes,
	overrides,
}: {
	nodes: SchemaNode[];
	overrides?: FieldOverrides;
}) {
	return (
		<>
			{nodes.map((node) => {
				switch (node.kind) {
					case "object":
						return (
							<Section key={node.path} node={node} overrides={overrides} />
						);
					case "unsupported":
						return <UnsupportedField key={node.path} node={node} />;
					default:
						return (
							<ScalarField key={node.path} node={node} overrides={overrides} />
						);
				}
			})}
		</>
	);
}

export function SchemaForm({
	schema,
	validate,
	value,
	onSubmit,
	overrides,
}: SchemaFormProps) {
	const nodes = useMemo(() => describeSchema(schema), [schema]);
	const resolver = useMemo(
		() => schemaResolver<FormValues>(validate, optionalSectionPaths(nodes)),
		[validate, nodes],
	);
	const form = useForm<FormValues>({
		defaultValues: value,
		resolver,
		mode: "onBlur",
		reValidateMode: "onChange",
	});
	return (
		<FormProvider {...form}>
			<form
				noValidate
				className="flex flex-col gap-4"
				onSubmit={form.handleSubmit((checked) => onSubmit(checked))}
			>
				<FieldList nodes={nodes} overrides={overrides} />
				<div>
					<Button type="submit" variant="primary">
						{formStrings.save}
					</Button>
				</div>
			</form>
		</FormProvider>
	);
}
