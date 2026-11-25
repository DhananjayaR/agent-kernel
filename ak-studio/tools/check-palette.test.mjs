// Proves check-palette can fail: a planted default-palette class and arbitrary value are reported, and the
// command exits non-zero. Run by `pnpm test` (root).
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
	checkPalette,
	defaultPaletteFamilies,
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

	it.each([
		"data-[pressed]:bg-surface",
		"[&_svg]:size-4",
		"whitespace-nowrap",
		"text-accent-primary",
		"--color-*: initial",
		'[data-theme="light"]',
		"items[0]",
	])("allows %s", (text) => {
		expect(findViolations(text, defaultPaletteFamilies())).toEqual([]);
	});
});
