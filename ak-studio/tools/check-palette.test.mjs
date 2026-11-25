// Proves check-palette can fail: a planted default-palette class and arbitrary value are reported, and the
// command exits non-zero. Run by `pnpm test` (root).
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
	allowsColourLiterals,
	checkPalette,
	defaultPaletteFamilies,
	findColourLiterals,
	findViolations,
} from "./check-palette.mjs";

const script = fileURLToPath(new URL("./check-palette.mjs", import.meta.url));
const fixture = fileURLToPath(
	new URL("./check-palette-fixture/", import.meta.url),
);
const run = (...args) =>
	spawnSync(process.execPath, [script, ...args], {
		cwd: fixture,
		encoding: "utf8",
	});

describe("check-palette", () => {
	it("reports the planted default-palette class and arbitrary value", () => {
		const { files, violations } = checkPalette(["bad"], fixture);
		expect(files).toBe(1);
		expect(violations.map((v) => [v.kind, v.token])).toEqual([
			["default palette", "text-blue-500"],
			["arbitrary value", "p-[13px]"],
		]);
	});

	it("exits non-zero on the planted fixture", () => {
		const r = run("bad");
		expect(r.status).toBe(1);
		expect(r.stderr).toContain("text-blue-500");
		expect(r.stderr).toContain("p-[13px]");
	});

	it("reports planted colour literals in TSX (style prop, string) and CSS", () => {
		const { violations } = checkPalette(["bad-colours"], fixture);
		expect(
			violations.map((v) => [v.file.split("/").at(-1), v.kind, v.token]),
		).toEqual([
			["Inline.tsx", "colour literal", "#fff"],
			["Inline.tsx", "colour literal", "rgb("],
			["Inline.tsx", "colour literal", "#FF5E32"],
			["raw.css", "colour literal", "#abcdef"],
			["raw.css", "colour literal", "oklch("],
			["raw.css", "colour literal", "#00000080"],
		]);
		expect(run("bad-colours").status).toBe(1);
	});

	it.each([
		['color: "#fff"'],
		['fill="#000"'],
		["linear-gradient(#fff, #0008)"],
		["const c = '#123456';"],
		["background: hsl(10 20% 30%)"],
		['style={{ border: "1px solid #ccc" }}'],
		["color(srgb 1 0 0)"],
	])("flags the colour literal in %s", (text) => {
		expect(findColourLiterals(text).length).toBeGreaterThan(0);
	});

	it.each([
		['document.querySelector("#root")'],
		['href="#add"'],
		['const route = "#/settings";'],
		["see issue #950 for details"],
		["// fixes (#950)"],
		["#fade { display: none; }"],
		["toRgb(color)"],
		// biome-ignore lint/suspicious/noTemplateCurlyInString: source text under test, not a template.
		["backgroundColor: `var(--role-${surface})`"],
	])("allows %s", (text) => {
		expect(findColourLiterals(text)).toEqual([]);
	});

	it("allows colour literals only in theme.css and unit tests", () => {
		expect(allowsColourLiterals("/x/packages/ui/src/theme.css")).toBe(true);
		expect(allowsColourLiterals("/x/packages/ui/src/contrast.test.ts")).toBe(
			true,
		);
		expect(allowsColourLiterals("/x/packages/ui/src/fonts.css")).toBe(false);
		expect(allowsColourLiterals("/x/apps/renderer/src/styles.css")).toBe(false);
	});

	it("passes tokens, arbitrary variants and CSS selectors", () => {
		const r = run("good");
		expect(r.stderr).toBe("");
		expect(r.status).toBe(0);
	});

	it("fails when it finds no source files (the silent-pass guard)", () => {
		const r = run("empty");
		expect(r.status).toBe(1);
		expect(r.stderr).toContain("no source files");
	});

	it("fails on a missing directory", () => {
		expect(run("missing").status).not.toBe(0);
	});

	it("reads the palette from the installed Tailwind", () => {
		expect(defaultPaletteFamilies()).toEqual(
			expect.arrayContaining(["blue", "slate", "neutral"]),
		);
	});

	it.each([
		["hover:bg-red-50/40", "default palette"],
		["border-x-slate-200", "default palette"],
		["text-white", "default palette"],
		["bg-black/50", "default palette"],
		["w-[var(--x)]", "arbitrary value"],
		["md:grid-cols-[1fr_auto]", "arbitrary value"],
		["[mask-type:luminance]", "arbitrary value"],
	])("flags %s", (token, kind) => {
		expect(findViolations(`"${token}"`, defaultPaletteFamilies())).toEqual([
			{ kind, token: token.replace(/^[a-z]+:/, ""), line: 1 },
		]);
	});

	it("flags an arbitrary value with an opacity modifier", () => {
		expect(
			findViolations('"bg-[#fff]/50"', defaultPaletteFamilies()).map(
				(v) => v.kind,
			),
		).toEqual(["arbitrary value"]);
	});

	it.each([
		"data-[pressed]:bg-surface",
		"[&_svg]:size-4",
		"group-data-[open]/menu:bg-surface",
		"whitespace-nowrap",
		"text-accent-primary",
		"--color-*: initial",
		'[data-theme="light"]',
		"items[0]",
	])("allows %s", (text) => {
		expect(findViolations(text, defaultPaletteFamilies())).toEqual([]);
	});
});
