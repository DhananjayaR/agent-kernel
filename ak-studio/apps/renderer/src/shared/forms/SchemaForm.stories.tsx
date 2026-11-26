// Storybook story for SchemaForm, PROVISIONAL until the P3 design gate signs off the schema form pattern. It shows
// the session slice fixture with one field set and one Optional section on, and the override map swapping `type`
// for a picker of the built-in backends. Written as type-free CSF because the renderer does not depend on
// Storybook; packages/ui's Storybook indexes it (ruling 16), so `pnpm test:storybook` runs its axe check.
import { Select, SelectItem } from "@ak-studio/ui";
import session from "./fixtures/session.schema.json";
import validateSession from "./fixtures/session.validate.js";
import { type FieldControlProps, SchemaForm } from "./SchemaForm";
import type { JsonSchema } from "./schema";

/** The built-in backends named in `type`'s description (a dotted class path is also allowed; P3 decides how). */
const BACKENDS = [
	"in_memory",
	"redis",
	"valkey",
	"dynamodb",
	"cosmosdb",
	"firestore",
];

function BackendPicker({
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
			isInvalid={errorMessage !== undefined}
			errorMessage={errorMessage}
		>
			{BACKENDS.map((name) => (
				<SelectItem key={name} id={name}>
					{name}
				</SelectItem>
			))}
		</Select>
	);
}

export default {
	title: "Provisional (until the P3 gate)/Patterns/Schema form",
	component: SchemaForm,
};

/** The session slice: `type` set, `dynamodb` turned on with its required table name missing. */
export const SessionSlice = {
	args: {
		schema: session as JsonSchema,
		validate: validateSession,
		value: { type: "dynamodb", dynamodb: { ttl: 3600 } },
		overrides: { type: BackendPicker },
		onSubmit: () => {},
	},
};
