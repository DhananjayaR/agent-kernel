// The field checks of a generated config form (D12): a validator precompiled from the section's JSON schema by
// `tools/compile-schemas.mjs` (Ajv standalone, strict, `coerceTypes` off; runtime compile is blocked by the
// CSP), and a React Hook Form resolver over it, written here rather than taken from @hookform/resolvers.
// These checks are for immediate feedback; the kernel is the authority when the section is saved.
import {
	type FieldErrors,
	type FieldValues,
	type Resolver,
	set,
} from "react-hook-form";
import { formStrings } from "./strings";

/** One Ajv error, by its shape (the renderer imports nothing from `ajv`). */
export interface ValidatorError {
	instancePath: string;
	schemaPath: string;
	keyword: string;
	params: Record<string, unknown>;
	message?: string;
}

/** The default export of a generated `*.validate.js`. */
export interface SchemaValidator {
	(data: unknown): boolean;
	errors?: ValidatorError[] | null;
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
	typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * The value with unset fields left out: `undefined` and `""` (an emptied field is unset, so its default
 * applies). A section that held only unset fields is dropped too, unless its path is in `keepEmptyAt` (an
 * Optional section turned on: `{}` there means "configured, with its defaults"). A section written as `{}` is
 * kept. `null`, `false` and `0` are values.
 */
export function pruneUnset(
	value: Record<string, unknown>,
	keepEmptyAt: ReadonlySet<string> = new Set(),
	prefix = "",
): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	for (const [key, v] of Object.entries(value)) {
		if (v === undefined || v === "") continue;
		const path = prefix ? `${prefix}.${key}` : key;
		if (isPlainObject(v)) {
			const pruned = pruneUnset(v, keepEmptyAt, path);
			const emptied =
				Object.keys(pruned).length === 0 && Object.keys(v).length > 0;
			if (emptied && !keepEmptyAt.has(path)) continue;
			out[key] = pruned;
		} else {
			out[key] = v;
		}
	}
	return out;
}

/** `/dynamodb/table_name` to `dynamodb.table_name` (JSON pointer escapes undone). */
const toPath = (pointer: string) =>
	pointer
		.split("/")
		.slice(1)
		.map((p) => p.replaceAll("~1", "/").replaceAll("~0", "~"))
		.join(".");

/** The field an error belongs to: a missing required property is reported on that property, not its parent. */
function errorPath(e: ValidatorError): string {
	const path = toPath(e.instancePath);
	const missing = e.params.missingProperty;
	if (e.keyword === "required" && typeof missing === "string") {
		return path ? `${path}.${missing}` : missing;
	}
	return path;
}

/** Errors that only say "not the null branch" or "no anyOf branch matched": noise beside a real error. */
const isUnionNoise = (e: ValidatorError) =>
	e.keyword === "anyOf" || (e.keyword === "type" && e.params.type === "null");

/**
 * One error per field path. Ajv reports a failure inside `anyOf [x, null]` three times (the branch's own
 * error, "must be null", "must match a schema in anyOf"); the union noise is dropped wherever a real error sits
 * on the same path or below it. Of what is left, the first error on each path is kept.
 */
export function fieldErrors(
	errors: readonly ValidatorError[],
): Map<string, ValidatorError> {
	const located = errors.map((e) => ({ e, path: errorPath(e) }));
	const real = located.filter(({ e }) => !isUnionNoise(e));
	const covered = (path: string) =>
		real.some(
			(r) => r.path === path || path === "" || r.path.startsWith(`${path}.`),
		);
	const out = new Map<string, ValidatorError>();
	for (const { e, path } of located) {
		if (isUnionNoise(e) && covered(path)) continue;
		if (!out.has(path)) out.set(path, e);
	}
	return out;
}

/** The message a field shows for an error, from the strings module (Ajv's own text is not user copy). */
export function errorMessage(e: ValidatorError): string {
	const { errors } = formStrings;
	switch (e.keyword) {
		case "required":
			return errors.required;
		case "enum":
			return errors.enum;
		case "type":
			switch (e.params.type) {
				case "integer":
					return errors.integer;
				case "number":
					return errors.number;
				case "string":
					return errors.string;
				case "boolean":
					return errors.boolean;
			}
			return errors.invalid;
		default:
			return errors.invalid;
	}
}

/**
 * A React Hook Form resolver over a precompiled validator. Valid: the pruned values. Invalid: one error per
 * field, nested by path as React Hook Form expects (an error on the section's root goes on `root`).
 */
export function schemaResolver<T extends FieldValues = FieldValues>(
	validate: SchemaValidator,
	keepEmptyAt?: ReadonlySet<string>,
): Resolver<T> {
	return (values) => {
		const data = pruneUnset(values, keepEmptyAt);
		if (validate(data)) {
			return { values: data as T, errors: {} };
		}
		const errors: FieldErrors<T> = {};
		for (const [path, e] of fieldErrors(validate.errors ?? [])) {
			set(errors, path || "root", {
				type: e.keyword,
				message: errorMessage(e),
			});
		}
		return { values: {}, errors };
	};
}
