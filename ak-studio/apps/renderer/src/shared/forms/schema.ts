// Reads a config section's JSON schema (as Pydantic's `model_json_schema()` writes it, draft 2020-12) into the
// field tree SchemaForm renders. P1b skeleton (D12): string, number, integer, boolean and string-enum fields;
// nullable scalars (`anyOf [scalar, null]`); sections behind a `$ref` or inline; Optional sections
// (`anyOf [section, null]`). Anything else (arrays, free-form objects, real unions) is "unsupported" until P3,
// which can also replace it through the override map.

/** The part of a JSON schema SchemaForm reads. Other keywords are ignored here (the validator checks them). */
export interface JsonSchema {
	type?: string | string[];
	properties?: Record<string, JsonSchema>;
	required?: string[];
	enum?: unknown[];
	anyOf?: JsonSchema[];
	$ref?: string;
	$defs?: Record<string, JsonSchema>;
	default?: unknown;
	description?: string;
	title?: string;
	[keyword: string]: unknown;
}

export type ScalarKind = "string" | "number" | "integer" | "boolean" | "enum";

interface NodeBase {
	/** The property name, also the field's label (as written in config.yaml). */
	key: string;
	/** Dotted path from the section's root, React Hook Form's field name (`dynamodb.table_name`). */
	path: string;
	description?: string;
	/** Listed in its parent's `required`. */
	required: boolean;
}

export interface ScalarNode extends NodeBase {
	kind: ScalarKind;
	/** Also accepts null (`anyOf [scalar, null]`). */
	nullable: boolean;
	hasDefault: boolean;
	default?: unknown;
	/** The allowed values of an enum field. */
	options?: string[];
}

export interface ObjectNode extends NodeBase {
	kind: "object";
	/** An Optional section (`anyOf [section, null]`): left out unless turned on. */
	optional: boolean;
	children: SchemaNode[];
}

export interface UnsupportedNode extends NodeBase {
	kind: "unsupported";
}

export type SchemaNode = ScalarNode | ObjectNode | UnsupportedNode;

const SCALAR_TYPES = new Set(["string", "number", "integer", "boolean"]);

/** Follows a local `#/$defs/Name` reference; anything else is returned as it is. */
function deref(node: JsonSchema, root: JsonSchema): JsonSchema {
	const match = node.$ref?.match(/^#\/\$defs\/(.+)$/);
	if (!match?.[1]) return node;
	const target = root.$defs?.[match[1]];
	if (!target) return node;
	// Keywords beside the $ref (Pydantic puts a field's description there) win over the definition's.
	const { $ref: _ref, ...beside } = node;
	return { ...deref(target, root), ...beside };
}

const isNull = (s: JsonSchema) => s.type === "null";

function describeNode(
	key: string,
	path: string,
	raw: JsonSchema,
	required: boolean,
	root: JsonSchema,
): SchemaNode {
	let schema = deref(raw, root);
	let nullable = false;
	const anyOf = schema.anyOf;
	if (anyOf?.length === 2 && anyOf.some(isNull)) {
		const other = anyOf.find((s) => !isNull(s));
		if (other) {
			const { anyOf: _anyOf, ...outer } = schema;
			schema = { ...deref(other, root), ...outer };
			nullable = true;
		}
	}
	const base = {
		key,
		path,
		required,
		...(typeof schema.description === "string"
			? { description: schema.description }
			: {}),
	};

	if (schema.type === "object" && schema.properties) {
		return {
			...base,
			kind: "object",
			optional: nullable,
			children: describeProperties(schema, path, root),
		};
	}

	const defaults =
		"default" in schema
			? { hasDefault: true, default: schema.default }
			: { hasDefault: false };
	if (
		Array.isArray(schema.enum) &&
		schema.enum.every((v) => typeof v === "string")
	) {
		return {
			...base,
			...defaults,
			kind: "enum",
			nullable,
			options: schema.enum as string[],
		};
	}
	if (typeof schema.type === "string" && SCALAR_TYPES.has(schema.type)) {
		return {
			...base,
			...defaults,
			kind: schema.type as ScalarKind,
			nullable,
		};
	}
	return { ...base, kind: "unsupported" };
}

function describeProperties(
	schema: JsonSchema,
	parentPath: string,
	root: JsonSchema,
): SchemaNode[] {
	const required = new Set(schema.required ?? []);
	return Object.entries(schema.properties ?? {}).map(([key, child]) =>
		describeNode(
			key,
			parentPath ? `${parentPath}.${key}` : key,
			child,
			required.has(key),
			root,
		),
	);
}

/** The fields of a section's schema (its top-level object), in the schema's property order. */
export function describeSchema(schema: JsonSchema): SchemaNode[] {
	return describeProperties(deref(schema, schema), "", schema);
}

/** The paths of every Optional section in the tree. */
export function optionalSectionPaths(nodes: SchemaNode[]): Set<string> {
	const out = new Set<string>();
	const walk = (list: SchemaNode[]) => {
		for (const n of list) {
			if (n.kind !== "object") continue;
			if (n.optional) out.add(n.path);
			walk(n.children);
		}
	};
	walk(nodes);
	return out;
}
