// `pnpm check-palette` (also run by `pnpm lint` and `pnpm build`): fails on a Tailwind default-palette colour
// class or an arbitrary value anywhere in the renderer or packages/ui. The design system removes the default
// palette (`--color-*: initial`), so such a class would silently produce no CSS; an arbitrary value bypasses
// the tokens. Both must be fixed at the source.
//
//   node tools/check-palette.mjs [dir ...]   (default: apps/renderer packages/ui, relative to ak-studio/)
//
// Like Tailwind's own scanner this reads every source file as text, comments included.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const STUDIO = fileURLToPath(new URL("../", import.meta.url));
export const DEFAULT_ROOTS = ["apps/renderer", "packages/ui"];
const SKIP_DIRS = new Set([
	"node_modules",
	"dist",
	"out",
	"storybook-static",
	".git",
]);
const EXTENSIONS = /\.(ts|tsx|js|jsx|mjs|cjs|css|html|mdx)$/;
const SHADES = "50|100|200|300|400|500|600|700|800|900|950";
// Utilities that take a colour, for the shade-less black and white.
const COLOUR_UTILITIES =
	"text|bg|border(?:-[xytrblse])?|outline|ring(?:-offset)?|inset-ring|shadow|inset-shadow|drop-shadow|text-shadow|divide|fill|stroke|caret|accent|decoration|placeholder|from|via|to";

/** Colour family names (red, slate, ...) of Tailwind's default palette, read from the installed version. */
export function defaultPaletteFamilies() {
	const require = createRequire(join(STUDIO, "packages/ui/package.json"));
	const css = readFileSync(require.resolve("tailwindcss/theme.css"), "utf8");
	const families = new Set();
	for (const m of css.matchAll(/--color-([a-z]+)-\d+\s*:/g)) families.add(m[1]);
	if (families.size === 0)
		throw new Error("no palette colours found in tailwindcss/theme.css");
	return [...families];
}

/** Returns the default-palette and arbitrary-value classes in `text`, with 1-based line numbers. */
export function findViolations(text, families) {
	const patterns = [
		[
			"default palette",
			// Any utility ending in <family>-<shade>, after optional variants, with an optional /opacity.
			new RegExp(
				`(?<![\\w-])-?[a-z][a-z-]*-(?:${families.join("|")})-(?:${SHADES})(?:/[\\w.]+)?(?![\\w-])`,
				"g",
			),
		],
		[
			"default palette",
			new RegExp(
				`(?<![\\w-])(?:${COLOUR_UTILITIES})-(?:black|white)(?:/[\\w.]+)?(?![\\w-])`,
				"g",
			),
		],
		[
			"arbitrary value",
			// utility-[value]; a bracket followed by ':' is an arbitrary variant (data-[state=open]:), not a value.
			/(?<![\w-])-?[a-z][a-z0-9-]*-\[[^\]\s]+\](?!:)/g,
		],
		[
			"arbitrary value",
			// [property:value] arbitrary property.
			/(?<![\w-])\[[a-z-]+:[^\]\s]+\](?!:)/g,
		],
	];
	const found = [];
	const lines = text.split("\n");
	lines.forEach((line, index) => {
		for (const [kind, re] of patterns) {
			for (const m of line.matchAll(re)) {
				found.push({ kind, token: m[0], line: index + 1 });
			}
		}
	});
	return found;
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

/** Scans `roots` (relative to `base`); returns the number of files read and every violation. */
export function checkPalette(roots, base = STUDIO) {
	const families = defaultPaletteFamilies();
	let files = 0;
	const violations = [];
	for (const root of roots) {
		const dir = resolve(base, root);
		if (!statSync(dir, { throwIfNoEntry: false })?.isDirectory()) {
			throw new Error(`not a directory: ${root}`);
		}
		for (const file of sourceFiles(dir)) {
			files += 1;
			for (const v of findViolations(readFileSync(file, "utf8"), families)) {
				violations.push({ ...v, file: relative(base, file) });
			}
		}
	}
	return { files, violations };
}

function main(argv) {
	const roots = argv.length > 0 ? argv : DEFAULT_ROOTS;
	const { files, violations } = checkPalette(
		roots,
		argv.length > 0 ? process.cwd() : STUDIO,
	);
	if (files === 0) {
		console.error(
			`check-palette FAILED: no source files found under ${roots.join(", ")}`,
		);
		return 1;
	}
	if (violations.length > 0) {
		console.error(
			"check-palette FAILED: use the design-system tokens instead of",
		);
		for (const v of violations) {
			console.error(`  ${v.file}:${v.line}  ${v.kind}  ${v.token}`);
		}
		return 1;
	}
	console.log(
		`check-palette OK: ${files} files, no default-palette or arbitrary-value classes`,
	);
	return 0;
}

if (
	process.argv[1] &&
	resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
	process.exit(main(process.argv.slice(2)));
}
