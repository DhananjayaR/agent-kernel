// Rules over the whole contract: every map is keyed by its own names, every operation has a shape, every error
// code and capability an operation names exists, inputs are strict at every level, and nothing that leaves the
// main process (an output, a job result, a session's info or a stream event) has a field that looks like a secret.
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ERROR_CODES } from "./errors";
import { jobKinds, operations, sessionKinds, streams } from "./operations";
import type { JobKindMap, SessionKindMap, ShapedOperation } from "./shapes";

// ---- A recursive walk over zod 4 schemas (test-only) ----

interface Def {
	type: string;
	[field: string]: unknown;
}
type Node = { _zod: { def: Def; innerType?: Node } };

const LEAVES = new Set([
	"string",
	"number",
	"bigint",
	"boolean",
	"literal",
	"enum",
	"unknown",
	"any",
	"null",
	"undefined",
	"void",
	"never",
	"nan",
	"date",
	"template_literal",
]);
const WRAPPERS = new Set([
	"optional",
	"nullable",
	"default",
	"prefault",
	"readonly",
	"nonoptional",
	"catch",
	"success",
	"promise",
]);

/**
 * Calls `visit` on every node of `schema`, depth first, with a readable path. Fails closed: a zod type this walk
 * has no rule for throws, so a new wrapper cannot hide a field from the checks below.
 */
function walk(
	schema: z.ZodType,
	visit: (def: Def, path: string) => void,
	path = "$",
	seen = new Set<unknown>(),
): void {
	if (seen.has(schema)) return; // A lazy (recursive) schema comes back to itself.
	seen.add(schema);
	const node = schema as unknown as Node;
	const def = node._zod.def;
	visit(def, path);
	for (const [child, at] of children(node, path))
		walk(child as z.ZodType, visit, at, seen);
}

/** The child schemas of one node, each with its path. */
function children(node: Node, path: string): [unknown, string][] {
	const def = node._zod.def;
	switch (def.type) {
		case "object":
			return [
				...Object.entries(def.shape as Record<string, unknown>).map(
					([name, child]): [unknown, string] => [child, `${path}.${name}`],
				),
				...(def.catchall
					? [[def.catchall, `${path}.*`] as [unknown, string]]
					: []),
			];
		case "array":
			return [[def.element, `${path}[]`]];
		case "union":
			return (def.options as unknown[]).map((option, i) => [
				option,
				`${path}|${i}`,
			]);
		case "intersection":
			return [
				[def.left, path],
				[def.right, path],
			];
		case "tuple":
			return [
				...(def.items as unknown[]).map((item, i): [unknown, string] => [
					item,
					`${path}[${i}]`,
				]),
				...(def.rest ? [[def.rest, `${path}[...]`] as [unknown, string]] : []),
			];
		case "record":
		case "map":
			return [
				[def.keyType, `${path}<key>`],
				[def.valueType, `${path}<value>`],
			];
		case "set":
			return [[def.valueType, `${path}<value>`]];
		case "lazy":
			// `_zod.innerType` is the getter's cached result; calling `def.getter` again builds a new schema.
			return [[node._zod.innerType, path]];
		case "pipe":
			return [
				[def.in, path],
				[def.out, path],
			];
		default:
			if (WRAPPERS.has(def.type)) return [[def.innerType, path]];
			if (LEAVES.has(def.type)) return [];
			throw new Error(`no walk rule for zod type "${def.type}" at ${path}`);
	}
}

const SECRET_NAMES = new Set(["key", "apikey", "token"]);

/** Paths of every object field named key, apiKey or token (any case). */
function secretFields(schema: z.ZodType): string[] {
	const found: string[] = [];
	walk(schema, (def, path) => {
		if (def.type !== "object") return;
		for (const name of Object.keys(def.shape as object)) {
			if (SECRET_NAMES.has(name.toLowerCase())) found.push(`${path}.${name}`);
		}
	});
	return found;
}

/** Paths of every object that accepts unknown keys (not a `z.strictObject`). */
function looseObjects(schema: z.ZodType): string[] {
	const found: string[] = [];
	walk(schema, (def, path) => {
		if (def.type !== "object") return;
		const catchall = def.catchall as Node | undefined;
		if (catchall?._zod.def.type !== "never") found.push(path);
	});
	return found;
}

describe("the schema walk (self-test)", () => {
	it("finds a secret field under every kind of node the contract uses", () => {
		const tok = z.object({ token: z.string() });
		const recursive: z.ZodType = z.lazy(() =>
			z.object({ child: recursive.optional(), apiKey: z.string() }),
		);
		const planted = {
			object: z.object({ key: z.string() }),
			array: z.array(tok),
			union: z.union([z.string(), tok]),
			discriminated: z.discriminatedUnion("type", [
				z.object({ type: z.literal("a") }),
				z.object({ type: z.literal("b"), Token: z.string() }),
			]),
			optional: tok.optional(),
			nullable: tok.nullable(),
			record: z.record(z.string(), tok),
			lazy: recursive,
			deep: z.object({ a: z.array(z.object({ b: tok.optional() })) }),
		};
		for (const [name, schema] of Object.entries(planted)) {
			expect(secretFields(schema), name).not.toEqual([]);
		}
		expect(
			secretFields(
				z.object({ tokenCount: z.int(), keys: z.array(z.string()) }),
			),
		).toEqual([]);
	});

	it("fails closed on a zod type it has no rule for", () => {
		expect(() =>
			secretFields(z.object({ x: z.custom<string>(() => true) })),
		).toThrow(/no walk rule for zod type "custom"/);
	});

	it("tells strict objects from loose ones, at every level", () => {
		expect(looseObjects(z.strictObject({ a: z.strictObject({}) }))).toEqual([]);
		expect(
			looseObjects(z.strictObject({ a: z.array(z.object({})).optional() })),
		).toEqual(["$.a[]"]);
	});
});

// ---- The rules ----

const allOperations = Object.values(operations) as ShapedOperation[];
// Typed views of the kind maps (both empty in P1b; Task 14 adds the first entries).
const allJobKinds = Object.entries(jobKinds as JobKindMap);
const allSessionKinds = Object.entries(sessionKinds as SessionKindMap);

describe("the contract's maps", () => {
	it("key every operation, stream, job kind and session kind by its own name", () => {
		for (const [key, op] of Object.entries(operations)) {
			expect(op.name).toBe(key);
			expect(op.kind).toBe("request");
		}
		for (const [key, stream] of Object.entries(streams)) {
			expect(stream.name).toBe(key);
			expect(stream.kind).toBe("stream");
		}
		for (const [key, job] of allJobKinds) {
			expect(job.name).toBe(key);
		}
		for (const [key, kind] of allSessionKinds) {
			expect(kind.kind).toBe(key);
		}
	});

	it("gives every operation a shape (query, command or job)", () => {
		for (const op of allOperations) {
			expect(["query", "command", "job"], op.name).toContain(op.shape);
		}
		// The P1a requests, reclassified (pre-flight ruling 7).
		expect(operations["app.info"].shape).toBe("query");
		for (const name of [
			"app.setTheme",
			"app.setLayout",
			"window.minimize",
			"window.toggleMaximize",
			"window.close",
		] as const) {
			expect(operations[name].shape, name).toBe("command");
		}
	});

	it("lists every job operation in jobKinds, and only those", () => {
		const jobs = allOperations.filter((op) => op.shape === "job");
		expect(Object.keys(jobKinds).sort()).toEqual(
			jobs.map((op) => op.name).sort(),
		);
		for (const op of jobs) {
			expect((jobKinds as JobKindMap)[op.name]).toBe(op);
		}
	});
});

describe("error codes and capabilities", () => {
	const catalog: string[] = Object.values(ERROR_CODES);

	it("names only codes in the catalog", () => {
		for (const op of allOperations) {
			for (const code of op.errors) expect(catalog, op.name).toContain(code);
		}
		for (const [name, kind] of allSessionKinds) {
			for (const code of kind.errors) expect(catalog, name).toContain(code);
		}
	});

	it("lists project.notOpen for every job kind whose input has a projectId (JobService refuses a closed project)", () => {
		for (const [name, op] of allJobKinds) {
			const shape = (op.input as { shape?: Record<string, unknown> }).shape;
			if (shape && "projectId" in shape) {
				expect(op.errors, name).toContain(ERROR_CODES.projectNotOpen);
			}
		}
	});

	it("lists only domain codes: the bridge's own codes and internal.unexpected are implicit for every operation", () => {
		const implicit = (code: string) =>
			code.startsWith("bridge.") || code === ERROR_CODES.internal;
		for (const op of allOperations) {
			expect(op.errors.filter(implicit), op.name).toEqual([]);
		}
		for (const [name, kind] of allSessionKinds) {
			expect(kind.errors.filter(implicit), name).toEqual([]);
		}
	});

	it("names only capabilities in the catalog (empty until P2, so none)", () => {
		// The kernel capability catalog is empty in P1b (pre-flight ruling 10).
		const capabilities: readonly string[] = [];
		for (const op of allOperations) {
			if (op.capability !== undefined)
				expect(capabilities, op.name).toContain(op.capability);
		}
	});
});

describe("what crosses the bridge", () => {
	it("keeps every input strict at every level", () => {
		for (const op of allOperations)
			expect(looseObjects(op.input), op.name).toEqual([]);
		for (const stream of Object.values(streams))
			expect(looseObjects(stream.input), stream.name).toEqual([]);
		for (const [name, kind] of allSessionKinds)
			expect(looseObjects(kind.args), name).toEqual([]);
	});

	it("has no field named key, apiKey or token in any output, job result, session info or event", () => {
		const outbound: [string, z.ZodType][] = [
			...allOperations.map((op): [string, z.ZodType] => [op.name, op.output]),
			...Object.values(streams).map((s): [string, z.ZodType] => [
				s.name,
				s.event,
			]),
			...allJobKinds.map(([name, job]): [string, z.ZodType] => [
				`${name} result`,
				job.result,
			]),
			...allSessionKinds.map(([name, kind]): [string, z.ZodType] => [
				`${name} info`,
				kind.info,
			]),
		];
		expect(outbound.length).toBeGreaterThan(0);
		for (const [name, schema] of outbound) {
			expect(secretFields(schema), name).toEqual([]);
		}
	});
});
