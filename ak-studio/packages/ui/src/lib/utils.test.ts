import { describe, expect, it } from "vitest";
import themeCss from "../theme.css?raw";
import { cn, THEME_KEYS } from "./utils";

/** The `@theme static { ... }` block of theme.css: the size, radius, type and shadow tokens. */
function staticThemeBlock(css: string): string {
	const start = css.indexOf("@theme static {");
	expect(start).toBeGreaterThan(-1);
	const end = css.indexOf("\n}", start);
	return css.slice(start, end);
}

/** Keys declared in theme.css for one `cn` scale (`--<prefix>-<key>:`). */
function declaredKeys(prefix: string): string[] {
	const block = staticThemeBlock(themeCss);
	const keys: string[] = [];
	for (const m of block.matchAll(/^\s*--([a-z-]+?)-([a-z0-9-]+):/gm)) {
		const [, scale, key] = m;
		if (!scale || !key || key.includes("--")) continue;
		// `--font-weight-control` belongs to font-weight, not to font.
		const resolved =
			scale === "font" && key.startsWith("weight-") ? "font-weight" : scale;
		const name =
			resolved === "font-weight" && scale === "font"
				? key.slice("weight-".length)
				: key;
		if (resolved === prefix) keys.push(name);
	}
	return keys;
}

describe("cn knows the Studio's theme keys", () => {
	for (const scale of Object.keys(THEME_KEYS) as (keyof typeof THEME_KEYS)[]) {
		it(`lists every --${scale}-* key in theme.css`, () => {
			const declared = declaredKeys(scale);
			expect(declared.length).toBeGreaterThan(0);
			expect([...THEME_KEYS[scale]].sort()).toEqual([...declared].sort());
		});
	}
});

describe("cn merges the Studio's classes", () => {
	it("keeps a size and a colour that share the text- prefix", () => {
		expect(cn("text-ui", "text-text")).toBe("text-ui text-text");
		expect(cn("text-ui-sm", "text-text-muted")).toBe(
			"text-ui-sm text-text-muted",
		);
	});

	it("lets a later size or colour win over an earlier one", () => {
		expect(cn("text-ui", "text-ui-sm")).toBe("text-ui-sm");
		expect(cn("text-text", "text-text-muted")).toBe("text-text-muted");
	});

	it("treats custom radii as one group", () => {
		expect(cn("rounded-pill", "rounded-control")).toBe("rounded-control");
	});

	it("treats custom spacing as spacing", () => {
		expect(cn("px-pill-edge", "px-edge")).toBe("px-edge");
		expect(cn("h-control-m", "h-control-s")).toBe("h-control-s");
		expect(cn("w-field-width", "w-full")).toBe("w-full");
	});

	it("keeps a weight and a family that share the font- prefix", () => {
		expect(cn("font-control", "font-ui")).toBe("font-control font-ui");
		expect(cn("font-ui", "font-mono")).toBe("font-mono");
		expect(cn("font-control", "font-action")).toBe("font-action");
	});

	it("treats the state fills as background colours", () => {
		expect(cn("bg-fill", "bg-fill-hover")).toBe("bg-fill-hover");
		expect(cn("bg-accent-primary", "bg-disabled-fill")).toBe(
			"bg-disabled-fill",
		);
	});

	it("treats the elevated shadow as a shadow", () => {
		expect(cn("shadow-elevated", "shadow-none")).toBe("shadow-none");
	});
});

// shadcn's generated components import `cn` from the "cn" package and other components through the
// components.json aliases; both bypass this configuration or Storybook's resolution.
const componentSources = import.meta.glob("../components/*.tsx", {
	query: "?raw",
	import: "default",
	eager: true,
}) as Record<string, string>;

describe("components", () => {
	it("are found", () => {
		expect(Object.keys(componentSources).length).toBeGreaterThan(0);
	});

	for (const [file, source] of Object.entries(componentSources)) {
		it(`${file} imports cn from lib/utils, not the cn package`, () => {
			expect(source).not.toMatch(/from\s+["']cn["']/);
			expect(source).not.toMatch(/from\s+["']@ak-studio\/ui\//);
		});
	}
});
