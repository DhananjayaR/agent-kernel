// The precompiled validators and the Ajv-errors-to-React-Hook-Form resolver: strict types ("30" is not an
// integer), required fields named on the field (not the section), one error per field, unset values dropped.
import { describe, expect, it } from "vitest";
import validateFieldKinds from "./fixtures/field-kinds.validate.js";
import validateSession from "./fixtures/session.validate.js";
import { formStrings } from "./strings";
import { fieldErrors, pruneUnset, schemaResolver } from "./validator";

const resolve = async (
	validate: typeof validateSession,
	values: Record<string, unknown>,
	keepEmptyAt?: ReadonlySet<string>,
) =>
	schemaResolver(validate, keepEmptyAt)(values, undefined, {
		fields: {},
		shouldUseNativeValidation: false,
	});

describe("precompiled validator (strict, P0 D12)", () => {
	it("rejects the string '30' for an integer and accepts the number", () => {
		expect(validateSession({ cache: { size: "30" } })).toBe(false);
		expect(validateSession({ cache: { size: 30 } })).toBe(true);
	});

	it("rejects a value outside an enum", () => {
		expect(validateFieldKinds({ name: "n", mode: "slow" })).toBe(false);
		expect(validateFieldKinds({ name: "n", mode: "thorough" })).toBe(true);
	});
});

describe("pruneUnset", () => {
	it("drops undefined and empty strings, keeps null, false, 0 and sections written empty", () => {
		expect(
			pruneUnset({
				a: undefined,
				b: "",
				c: null,
				d: false,
				e: 0,
				f: {},
				g: { h: "", i: "x" },
			}),
		).toEqual({ c: null, d: false, e: 0, f: {}, g: { i: "x" } });
	});

	it("drops a section left empty only by unset fields, unless it is a section turned on", () => {
		const value = { a: { x: undefined }, b: { y: "" } };
		expect(pruneUnset(value)).toEqual({});
		expect(pruneUnset(value, new Set(["b"]))).toEqual({ b: {} });
	});
});

describe("fieldErrors", () => {
	it("names a missing required property on the field, under an Optional section", () => {
		validateSession({ dynamodb: {} });
		const errors = fieldErrors(validateSession.errors ?? []);
		// Not also "must be null" / "must match a schema in anyOf" on the section.
		expect([...errors.keys()]).toEqual(["dynamodb.table_name"]);
		expect(errors.get("dynamodb.table_name")?.keyword).toBe("required");
	});

	it("keeps the type error for a nullable scalar, not the null branch", () => {
		validateSession({ connection_store: { table_name: 5 } });
		const errors = fieldErrors(validateSession.errors ?? []);
		expect([...errors.keys()]).toEqual(["connection_store.table_name"]);
		expect(errors.get("connection_store.table_name")?.params).toEqual({
			type: "string",
		});
	});
});

describe("schemaResolver", () => {
	it("passes the pruned values through when valid", async () => {
		const result = await resolve(validateSession, {
			type: "redis",
			cache: { size: 30 },
			connection_store: { table_name: "" },
		});
		expect(result.errors).toEqual({});
		// connection_store held only an unset field, so it is dropped rather than written as `{}`.
		expect(result.values).toEqual({ type: "redis", cache: { size: 30 } });
	});

	it("returns nested field errors with the strings module's messages", async () => {
		const result = await resolve(validateSession, {
			cache: { size: "30" },
			dynamodb: { ttl: 5 },
		});
		expect(result.values).toEqual({});
		expect(result.errors).toEqual({
			cache: {
				size: { type: "type", message: formStrings.errors.integer },
			},
			dynamodb: {
				table_name: { type: "required", message: formStrings.errors.required },
			},
		});
	});

	it("keeps a section turned on with nothing set (it is configured with its defaults)", async () => {
		const result = await resolve(
			validateSession,
			{ cache: { size: undefined } },
			new Set(["cache"]),
		);
		expect(result.values).toEqual({ cache: {} });
	});

	it("treats an empty string as unset, so a required field cleared is reported", async () => {
		const result = await resolve(validateFieldKinds, { name: "" });
		expect(result.errors).toEqual({
			name: { type: "required", message: formStrings.errors.required },
		});
	});
});
