// Reading a JSON schema into the field tree SchemaForm renders: kinds, required, defaults, nullable scalars,
// $ref'd sections, Optional sections (`anyOf [section, null]`) and the kinds left for P3.
import { describe, expect, it } from "vitest";
import fieldKinds from "./fixtures/field-kinds.schema.json";
import session from "./fixtures/session.schema.json";
import { describeSchema, type JsonSchema, type SchemaNode } from "./schema";

const byPath = (nodes: SchemaNode[]): Map<string, SchemaNode> => {
	const out = new Map<string, SchemaNode>();
	const walk = (list: SchemaNode[]) => {
		for (const n of list) {
			out.set(n.path, n);
			if (n.kind === "object") walk(n.children);
		}
	};
	walk(nodes);
	return out;
};

describe("describeSchema", () => {
	it("reads the five scalar kinds, required and defaults", () => {
		const nodes = byPath(describeSchema(fieldKinds as JsonSchema));
		expect(nodes.get("name")).toMatchObject({
			kind: "string",
			required: true,
			hasDefault: false,
		});
		expect(nodes.get("enabled")).toMatchObject({
			kind: "boolean",
			required: false,
			hasDefault: true,
			default: false,
		});
		expect(nodes.get("mode")).toMatchObject({
			kind: "enum",
			options: ["fast", "thorough"],
			default: "fast",
		});
		expect(nodes.get("ratio")).toMatchObject({ kind: "number", default: 0.5 });
	});

	it("follows $ref into sections, marks Optional sections and nullable scalars", () => {
		const nodes = byPath(describeSchema(session as JsonSchema));
		expect(nodes.get("type")).toMatchObject({
			kind: "string",
			default: "in_memory",
		});
		expect(nodes.get("dynamodb")).toMatchObject({
			kind: "object",
			optional: true,
		});
		expect(nodes.get("dynamodb.table_name")).toMatchObject({
			kind: "string",
			required: true,
		});
		expect(nodes.get("dynamodb.ttl")).toMatchObject({
			kind: "integer",
			default: 604800,
		});
		expect(nodes.get("cache.size")).toMatchObject({ kind: "integer" });
		expect(nodes.get("connection_store")).toMatchObject({
			kind: "object",
			optional: false,
			// The description sits beside the $ref, not in the definition.
			description: expect.stringContaining("connection store"),
		});
		expect(nodes.get("connection_store.table_name")).toMatchObject({
			kind: "string",
			nullable: true,
			default: null,
		});
		expect(nodes.get("connection_store.ttl")).toMatchObject({
			kind: "number",
		});
	});

	it("leaves arrays, free objects and real unions as unsupported (P3)", () => {
		const nodes = byPath(
			describeSchema({
				type: "object",
				properties: {
					tags: { type: "array", items: { type: "string" } },
					extra: { type: "object" },
					either: { anyOf: [{ type: "string" }, { type: "integer" }] },
				},
			}),
		);
		expect(nodes.get("tags")?.kind).toBe("unsupported");
		expect(nodes.get("extra")?.kind).toBe("unsupported");
		expect(nodes.get("either")?.kind).toBe("unsupported");
	});
});
