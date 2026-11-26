// `pnpm check-classes` (run by `pnpm lint`): fails on an arbitrary value in a class name or an inline colour style
// in the renderer's and packages/ui's TypeScript (conventions-and-skills.md, Visual rules: "No arbitrary values
// (`p-[13px]`) and no inline colour styles"; architecture.md, Enforcement). A script rather than a lint plugin,
// as the P1b risk table allows.
//
//   node tools/check-classes.mjs [dir ...]   (default: apps/renderer/src packages/ui/src, relative to ak-studio/)
//
// What fails:
// - an arbitrary value, `utility-[value]` (`p-[13px]`, `bg-[#fff]`, `w-[calc(100%-2rem)]`), or an arbitrary
//   property, `[prop:value]`. An arbitrary variant (`data-[state=open]:`) is not a value and passes;
// - the variable shorthand `utility-(--name)` for any variable not in ALLOWED_VARIABLES: it reads a value from
//   outside the closed scale just as `[...]` does;
// - an inline colour style: a colour property (`color`, `backgroundColor`, `borderColor`, `fill`, the `border`
//   and `background` shorthands, ...) anywhere in a `style={...}` expression (a
//   conditional too) or in an object typed `CSSProperties`; a colour
//   property set on an element's `.style` or through `style.setProperty`; an SVG or icon colour attribute
//   (`fill="..."`, `stroke=`, `color=`) with any literal value but currentColor, none, transparent or inherit.
// Class checks read the whole text, as Tailwind's scanner does, so a class in a `cn()`/`cva()` string or a
// comment counts. The patterns are shared with check-palette, which also runs them over CSS and MDX.
//
// Skipped: generated files (`*.validate.js`, `*.validate.d.ts`), the fixture project (`fixtures/support-triage`)
// and build output. Inline colour styles are allowed in ALLOWS_INLINE_COLOUR only: the design-token reference
// page paints each role colour from its variable.
// Known limits: a colour set through a custom property (`style={{ "--x": "red" }}`; a hex or rgb() value there is
// still a colour literal to check-palette); any component prop named `color` with a literal value is reported, not
// only an SVG or icon one; class names built at run time; and a style object passed by name (`style={styles}`) that is not
// typed CSSProperties where it is written.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const STUDIO = fileURLToPath(new URL("../", import.meta.url));
export const DEFAULT_ROOTS = ["apps/renderer/src", "packages/ui/src"];
const SKIP_DIRS = new Set([
	"node_modules",
	"dist",
	"out",
	"storybook-static",
	".git",
]);
const EXTENSIONS = /\.(ts|tsx)$/;
const GENERATED = /\.validate\.(?:js|d\.ts)$/;
const FIXTURE_PROJECT = /(^|\/)fixtures\/support-triage\//;

/**
 * Variables the `utility-(--name)` shorthand may read: React Aria sets --trigger-width to the measured width of a
 * popover's trigger (Select, Combobox, Menu), which is layout, not a design value.
 */
export const ALLOWED_VARIABLES = new Set(["--trigger-width"]);

/** Files allowed inline colour styles: the token reference story, which shows each colour role by its variable. */
export const ALLOWS_INLINE_COLOUR = ["packages/ui/src/tokens.stories.tsx"];

/** The arbitrary-value class patterns (also used by check-palette). */
export const ARBITRARY_VALUE_PATTERNS = [
	// utility-[value]. A bracket followed by ':' (or by '/name:' for a named group or peer) is an arbitrary
	// variant such as data-[state=open]: or group-data-[open]/menu:, not a value.
	/(?<![\w-])-?[a-z][a-z0-9-]*-\[[^\]\s]+\](?!:|\/[\w-]+:)/g,
	// [property:value] arbitrary property.
	/(?<![\w-])\[[a-z-]+:[^\]\s]+\](?!:|\/[\w-]+:)/g,
];

/** utility-(--name), optionally with a type hint: utility-(length:--name). */
const VARIABLE_SHORTHAND =
	/(?<![\w-])-?[a-z][a-z0-9-]*-\((?:[a-z-]+:)?(--[\w-]+)\)(?![\w-])/g;

/** CSS properties that set a colour, in React's camelCase (and the shorthands that can carry one). */
const COLOUR_PROPERTIES = [
	"color",
	"background",
	"backgroundColor",
	"backgroundImage",
	"border",
	"borderColor",
	...[
		"Top",
		"Right",
		"Bottom",
		"Left",
		"Block",
		"Inline",
		"BlockStart",
		"BlockEnd",
		"InlineStart",
		"InlineEnd",
	].flatMap((side) => [`border${side}`, `border${side}Color`]),
	"outline",
	"outlineColor",
	"boxShadow",
	"textShadow",
	"fill",
	"stroke",
	"caretColor",
	"accentColor",
	"textDecoration",
	"textDecorationColor",
	"columnRuleColor",
	"stopColor",
	"floodColor",
	"lightingColor",
	"scrollbarColor",
	"WebkitTextFillColor",
];
// A colour key in an object: after `{` or `,` (and any comments), plain, quoted or computed (`["color"]`), with a
// value (`color: x`) or as a shorthand property (`{ color }`, `{ ...base, color }`).
const COLOUR_KEY = new RegExp(
	`(?<=[{,]\\s*(?:(?://[^\\n]*\\n|/\\*[\\s\\S]*?\\*/)\\s*)*)(\\[\\s*)?(["'\`]?)(${COLOUR_PROPERTIES.join("|")})\\2\\s*(\\])?\\s*(?=([:,}]))`,
	"g",
);
const DOM_STYLE_ASSIGNMENT = new RegExp(
	`\\.style\\.(${COLOUR_PROPERTIES.join("|")})\\s*=(?!=)`,
	"g",
);
const SET_PROPERTY =
	/\bstyle\.setProperty\(\s*["'`]((?:background|border|outline|text-decoration|column-rule)(?:-[a-z-]+)?-color|color|background|fill|stroke|box-shadow|text-shadow|caret-color|accent-color|stop-color)["'`]/g;
// A JSX attribute (no space around `=`, unlike an assignment) with a literal value.
const COLOUR_ATTRIBUTE =
	/(?<=\s)(fill|stroke|color|stopColor|floodColor|lightingColor)=(?:"([^"]*)"|'([^']*)'|\{\s*["'`]([^"'`]*)["'`]\s*\})/g;
const NEUTRAL_COLOUR_VALUES = new Set([
	"currentColor",
	"currentcolor",
	"none",
	"transparent",
	"inherit",
]);
/**
 * Where a style object starts: a JSX style prop's whole expression (`style={{ ... }}`, and `style={cond ? { ... } :
 * undefined}`), a `style: { ... }` property (createElement props), or an object typed or checked as CSSProperties.
 */
const STYLE_OBJECT_START =
	/\bstyle=\{|\bstyle:\s*\{|:\s*(?:React\.)?CSSProperties\s*=\s*\{|\{(?=[^{}]*\}\s*(?:as|satisfies)\s+(?:React\.)?CSSProperties\b)/g;

function lineAt(text, index) {
	let line = 1;
	for (let i = 0; i < index; i += 1) if (text.charCodeAt(i) === 10) line += 1;
	return line;
}

/** The arbitrary values and unlisted variable shorthands in class names, with 1-based line numbers. */
export function findArbitraryValues(text) {
	const found = [];
	text.split("\n").forEach((line, index) => {
		for (const re of ARBITRARY_VALUE_PATTERNS)
			for (const m of line.matchAll(re))
				found.push({ kind: "arbitrary value", token: m[0], line: index + 1 });
		for (const m of line.matchAll(VARIABLE_SHORTHAND))
			if (!ALLOWED_VARIABLES.has(m[1]))
				found.push({
					kind: "arbitrary value",
					token: m[0],
					line: index + 1,
				});
	});
	return found;
}

/** The end (exclusive) of the brace block that opens at `open` (the index of its `{`). */
function blockEnd(text, open) {
	let depth = 0;
	for (let i = open; i < text.length; i += 1) {
		if (text[i] === "{") depth += 1;
		else if (text[i] === "}") {
			depth -= 1;
			if (depth === 0) return i + 1;
		}
	}
	return text.length;
}

/** The inline colour styles in `text` (TSX or TS), with 1-based line numbers. */
export function findInlineColourStyles(text) {
	const found = [];
	const add = (index, token) =>
		found.push({
			kind: "inline colour style",
			token,
			line: lineAt(text, index),
		});
	for (const start of text.matchAll(STYLE_OBJECT_START)) {
		const open = start.index + start[0].lastIndexOf("{");
		const block = text.slice(open, blockEnd(text, open));
		for (const m of block.matchAll(COLOUR_KEY)) {
			// A computed key needs its closing bracket; a plain one must not have one.
			if (Boolean(m[1]) !== Boolean(m[4])) continue;
			const shorthand = m[5] !== ":";
			add(
				open + m.index,
				`${start[0].startsWith("style") ? "style " : ""}${m[3]}${shorthand ? "" : ":"}`,
			);
		}
	}
	for (const m of text.matchAll(DOM_STYLE_ASSIGNMENT)) add(m.index, m[0]);
	for (const m of text.matchAll(SET_PROPERTY)) add(m.index, m[0]);
	for (const m of text.matchAll(COLOUR_ATTRIBUTE)) {
		const value = m[2] ?? m[3] ?? m[4] ?? "";
		if (!NEUTRAL_COLOUR_VALUES.has(value.trim())) add(m.index, m[0]);
	}
	return found.sort((a, b) => a.line - b.line);
}

/** True for a file the check never reads: generated output and the fixture project. */
export function isSkipped(file) {
	const path = file.replaceAll("\\", "/");
	return GENERATED.test(path) || FIXTURE_PROJECT.test(path);
}

/** True for a file allowed inline colour styles. */
export function allowsInlineColour(file) {
	const path = file.replaceAll("\\", "/");
	return ALLOWS_INLINE_COLOUR.some((allowed) => path.endsWith(allowed));
}

function* sourceFiles(dir) {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		if (entry.isDirectory()) {
			if (!SKIP_DIRS.has(entry.name)) yield* sourceFiles(join(dir, entry.name));
		} else if (entry.isFile() && EXTENSIONS.test(entry.name)) {
			yield join(dir, entry.name);
		}
	}
}

/** Scans `roots` (relative to `base`); returns the number of files read, the files skipped and every violation. */
export function checkClasses(roots, base = STUDIO) {
	let files = 0;
	const skipped = [];
	const violations = [];
	for (const root of roots) {
		const dir = resolve(base, root);
		if (!statSync(dir, { throwIfNoEntry: false })?.isDirectory()) {
			throw new Error(`not a directory: ${root}`);
		}
		for (const file of sourceFiles(dir)) {
			const name = relative(base, file).replaceAll("\\", "/");
			if (isSkipped(name)) {
				skipped.push(name);
				continue;
			}
			files += 1;
			const text = readFileSync(file, "utf8");
			const found = findArbitraryValues(text);
			if (!allowsInlineColour(name))
				found.push(...findInlineColourStyles(text));
			for (const v of found) violations.push({ ...v, file: name });
		}
	}
	return { files, skipped, violations };
}

function main(argv) {
	const roots = argv.length > 0 ? argv : DEFAULT_ROOTS;
	const { files, violations } = checkClasses(
		roots,
		argv.length > 0 ? process.cwd() : STUDIO,
	);
	if (files === 0) {
		console.error(
			`check-classes FAILED: no source files found under ${roots.join(", ")}`,
		);
		return 1;
	}
	if (violations.length > 0) {
		console.error(
			"check-classes FAILED: use the design system's scale and role tokens instead of",
		);
		for (const v of violations)
			console.error(`  ${v.file}:${v.line}  ${v.kind}  ${v.token}`);
		return 1;
	}
	console.log(
		`check-classes OK: ${files} files, no arbitrary values or inline colour styles`,
	);
	return 0;
}

if (
	process.argv[1] &&
	resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
	process.exit(main(process.argv.slice(2)));
}
