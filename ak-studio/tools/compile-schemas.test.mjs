// Tests for compile-schemas (P0 D12): the precompiled validator is strict (a string "30" for an integer is
// rejected), carries no runtime code generation, runs in a Node process that forbids code generation from
// strings (the renderer CSP's `script-src 'self'` blocks the same thing), and the committed output is current.
// Run by `pnpm test` (root).
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import {
	compileSchema,
	compileSchemas,
	declarationSource,
	findSchemas,
	STUDIO,
} from "./compile-schemas.mjs";

const FIXTURES = join(STUDIO, "apps/renderer/src/shared/forms/fixtures");
const sessionSchema = JSON.parse(
	readFileSync(join(FIXTURES, "session.schema.json"), "utf8"),
);
const sessionSource = compileSchema(sessionSchema, "session.schema.json");

const scratch = mkdtempSync(join(tmpdir(), "compile-schemas-"));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

/** Writes `source` as an ES module in the scratch folder and returns its file URL. */
function writeModule(name, source) {
	const file = join(scratch, name);
	writeFileSync(file, source);
	return pathToFileURL(file).href;
}

/** Runs `code` (an ES module) in a Node that refuses `eval` and `new Function`, as the renderer CSP does. */
function runWithoutCodeGeneration(code) {
	return spawnSync(
		process.execPath,
		[
			"--disallow-code-generation-from-strings",
			"--input-type=module",
			"-e",
			code,
		],
		// From ak-studio/, so the -e module resolves `ajv` from the workspace's node_modules.
		{ cwd: STUDIO, encoding: "utf8" },
	);
}

describe("compileSchema", () => {
	it("is strict: a string '30' for an integer is rejected, the number 30 accepted", async () => {
		const url = writeModule("strict.validate.js", sessionSource);
		const { default: validate } = await import(url);
		expect(validate({ dynamodb: { table_name: "t", ttl: "30" } })).toBe(false);
		expect(validate.errors).toContainEqual(
			expect.objectContaining({
				instancePath: "/dynamodb/ttl",
				keyword: "type",
				params: { type: "integer" },
			}),
		);
		expect(validate({ dynamodb: { table_name: "t", ttl: 30 } })).toBe(true);
	});

	it("reports every failing field (allErrors), not only the first", async () => {
		const url = writeModule("all.validate.js", sessionSource);
		const { default: validate } = await import(url);
		expect(
			validate({ type: 1, cache: { size: "big" }, connection_store: {} }),
		).toBe(false);
		const paths = validate.errors.map((e) => e.instancePath);
		expect(paths).toContain("/type");
		expect(paths).toContain("/cache/size");
	});

	it("emits no runtime code generation and no imports", () => {
		expect(sessionSource).not.toMatch(/new Function|\beval\s*\(/);
		expect(sessionSource).not.toMatch(/\brequire\s*\(/);
		expect(sessionSource).not.toMatch(/^\s*import\b|\bimport\s*\(/m);
	});

	it("drops annotations (description, title, $comment), so schema prose never reaches the bundle", () => {
		expect(sessionSource).not.toContain('"description"');
		expect(sessionSource).not.toContain('"title"');
		expect(sessionSource).not.toContain('"$comment"');
	});

	it("runs where code generation from strings is forbidden (the CSP's rule)", () => {
		const url = writeModule("csp.validate.js", sessionSource);
		const r = runWithoutCodeGeneration(
			`import validate from ${JSON.stringify(url)};
			 console.log(JSON.stringify([validate({ cache: { size: 30 } }), validate({ cache: { size: "30" } })]));`,
		);
		expect(r.stderr).toBe("");
		expect(r.stdout.trim()).toBe("[true,false]");
	});

	it("control: the same Node refuses new Function, so the check above means something", () => {
		const r = runWithoutCodeGeneration(
			`try { new Function("return 1"); console.log("allowed"); } catch { console.log("refused"); }`,
		);
		expect(r.stdout.trim()).toBe("refused");
	});

	it("control: Ajv's runtime compile is refused there too (why validators are precompiled)", () => {
		const r = runWithoutCodeGeneration(
			`import Ajv from "ajv/dist/2020.js";
			 try { new Ajv({ logger: false }).compile({ type: "integer" }); console.log("compiled"); } catch { console.log("refused"); }`,
		);
		expect(r.stderr).toBe("");
		expect(r.stdout.trim()).toBe("refused");
	});
});

describe("declarationSource", () => {
	it("types the default export as a validator with Ajv's error fields", () => {
		const d = declarationSource("x.schema.json");
		expect(d).toContain("export default validate;");
		expect(d).toContain("instancePath: string;");
		expect(d).toContain("errors?:");
	});
});

describe("committed output", () => {
	it("finds the fixture schemas", () => {
		const names = findSchemas().map((f) => f.replace(`${STUDIO}/`, ""));
		expect(names).toContain(
			"apps/renderer/src/shared/forms/fixtures/session.schema.json",
		);
		expect(names).toContain(
			"apps/renderer/src/shared/forms/fixtures/field-kinds.schema.json",
		);
	});

	it("is up to date: regenerating changes nothing (pnpm compile-schemas)", () => {
		const { stale } = compileSchemas({ check: true });
		expect(stale).toEqual([]);
	});
});
