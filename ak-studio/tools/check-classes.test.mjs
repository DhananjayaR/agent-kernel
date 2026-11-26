// Self-test for check-classes (run by `pnpm lint`): planted arbitrary values and inline colour styles are each
// reported and make the command exit non-zero (spec P1b Verification: "an arbitrary value class fails CI", proved
// locally, P1b-plan ruling 1); what the rule allows passes; generated files and the fixture project are skipped;
// and the real tree is clean.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
	checkClasses,
	DEFAULT_ROOTS,
	findArbitraryValues,
	findInlineColourStyles,
} from "./check-classes.mjs";

const script = fileURLToPath(new URL("./check-classes.mjs", import.meta.url));
const fixture = fileURLToPath(
	new URL("./check-classes-fixture/", import.meta.url),
);
const run = (...args) =>
	spawnSync(process.execPath, [script, ...args], {
		cwd: fixture,
		encoding: "utf8",
	});
const tokens = (violations) => violations.map((v) => [v.kind, v.token]);

describe("check-classes", () => {
	it("reports each planted arbitrary value, including the variable shorthand", () => {
		const { violations } = checkClasses(["bad"], fixture);
		expect(
			tokens(violations.filter((v) => v.file.endsWith("Arbitrary.tsx"))),
		).toEqual([
			["arbitrary value", "p-[13px]"],
			["arbitrary value", "bg-[#fff]"],
			["arbitrary value", "w-[calc(100%-2rem)]"],
			["arbitrary value", "[mask-type:luminance]"],
			["arbitrary value", "gap-(--my-gap)"],
		]);
	});

	it("reports each planted inline colour style, in a multi-line style block too", () => {
		const { violations } = checkClasses(["bad"], fixture);
		expect(
			violations
				.filter((v) => v.file.endsWith("InlineColour.tsx"))
				.map((v) => [v.line, v.token]),
		).toEqual([
			[4, "background:"],
			[5, "outlineColor:"],
			[8, ".style.borderColor ="],
			[9, 'style.setProperty("background-color"'],
			[14, "style backgroundColor:"],
			[17, "style color:"],
			[19, 'fill="red"'],
			[20, 'color="#fff"'],
		]);
	});

	it("exits non-zero on the planted files and names them", () => {
		const r = run("bad");
		expect(r.status).toBe(1);
		expect(r.stderr).toContain("p-[13px]");
		expect(r.stderr).toContain("style color:");
	});

	it("lets through variants, --trigger-width, colourless styles, neutral SVG colours and non-style objects", () => {
		const { files, violations } = checkClasses(["good"], fixture);
		expect(files).toBe(1);
		expect(violations).toEqual([]);
		expect(run("good").status).toBe(0);
	});

	it("skips generated validators and the fixture project", () => {
		const { files, skipped, violations } = checkClasses(["skipped"], fixture);
		expect(files).toBe(1);
		expect(skipped.sort()).toEqual([
			"skipped/fixtures/support-triage/Planted.tsx",
			"skipped/forms/session.validate.d.ts",
		]);
		expect(violations).toEqual([]);
	});

	it("allows inline colour styles on the token reference page only, and still reports its arbitrary values", () => {
		const { violations } = checkClasses(["allowed"], fixture);
		expect(tokens(violations)).toEqual([["arbitrary value", "h-[37px]"]]);
		const page = 'style={{\n  backgroundColor: "var(--role-surface)",\n}}';
		expect(findInlineColourStyles(page).map((v) => v.token)).toEqual([
			"style backgroundColor:",
		]);
	});

	it("does not read an arbitrary variant as a value", () => {
		expect(
			findArbitraryValues(
				"data-[state=open]:bg-surface group-data-[open]/menu:p-2 aria-[selected=true]:text-text",
			),
		).toEqual([]);
	});

	it("passes on the real renderer and packages/ui source", () => {
		const { files, violations } = checkClasses(DEFAULT_ROOTS);
		expect(files).toBeGreaterThan(100);
		expect(violations).toEqual([]);
	});
});
