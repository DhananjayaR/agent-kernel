// `pnpm check-stories` (run by `pnpm lint`): every component and screen has a stories file, with the stories its
// pattern requires (architecture.md, Enforcement: "Every component and screen has stories for its required
// states"; conventions-and-skills.md, Story first). A script, not a lint plugin (the P1b risk table).
//
//   node tools/check-stories.mjs [studio-root]   (default: ak-studio/; requirements from <root>/tools/story-requirements.json)
//
// Component files (COMPONENT_GLOBS): packages/ui/src/components/*.tsx, and every .tsx under a feature's
// components/ or screens/ folder; stories and tests are not components. Each needs `<name>.stories.tsx` beside it.
// story-requirements.json may also say:
// - `required`: for a glob of component files, the story export names (CSF: `export const Empty`) each one's
//   stories file must have. A glob that matches no component fails, so a typo cannot pass silently;
// - `coveredBy`: a component whose stories live in another stories file (a part shown inside a larger story).
//   That file must exist and name the component, alone or as the start of a story's name (`ProjectSwitcher` or
//   `ProjectSwitcherOpen` for project-switcher.tsx);
// - `exempt`: a component file with no stories, and why. Each needs a reason.
// A `coveredBy` or `exempt` entry for a file that is gone, or that now has its own stories file, is stale and fails.
//
// Static on purpose: lint runs before Storybook is built, so story names are read from the stories file's named
// exports rather than from Storybook's index. Known limit: a story re-exported from another module is not seen.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const STUDIO = fileURLToPath(new URL("../", import.meta.url));
export const COMPONENT_GLOBS = [
	"packages/ui/src/components/*.tsx",
	"apps/renderer/src/features/*/components/**/*.tsx",
	"apps/renderer/src/features/*/screens/**/*.tsx",
];
const NOT_COMPONENTS = /\.(?:stories|test)\.tsx$/;
const SKIP_DIRS = new Set(["node_modules", "dist", "out", "storybook-static"]);

/** A glob (`*` within a folder, `**\/` across folders) as an anchored regular expression. */
export function globToRegExp(glob) {
	let out = "";
	for (let i = 0; i < glob.length; i += 1) {
		const c = glob[i];
		if (glob.startsWith("**/", i)) {
			out += "(?:[^/]+/)*";
			i += 2;
		} else if (c === "*") out += "[^/]*";
		else out += c.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
	}
	return new RegExp(`^${out}$`);
}

/** The story export names in a CSF file: `export const X`, `export function X` and `export { A, B as X }`. */
export function storyNames(text) {
	const names = new Set();
	for (const m of text.matchAll(
		/^export\s+(?:const|let|function)\s+([A-Za-z_$][\w$]*)/gm,
	))
		names.add(m[1]);
	for (const m of text.matchAll(/^export\s*\{([^}]*)\}/gm))
		for (const part of m[1].split(",")) {
			const name = part
				.trim()
				.split(/\s+as\s+/)
				.at(-1);
			if (name && name !== "default") names.add(name);
		}
	return [...names];
}

/** `project-switcher.tsx` -> `ProjectSwitcher`; `CanvasScreen.tsx` -> `CanvasScreen`. */
export function componentName(file) {
	const base = file
		.split("/")
		.at(-1)
		.replace(/\.tsx$/, "");
	return base
		.split("-")
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join("");
}

const storiesFileOf = (file) => file.replace(/\.tsx$/, ".stories.tsx");

function* walk(dir, base) {
	if (!statSync(dir, { throwIfNoEntry: false })?.isDirectory()) return;
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) {
			if (!SKIP_DIRS.has(entry.name)) yield* walk(path, base);
		} else if (entry.isFile()) yield relative(base, path).replaceAll("\\", "/");
	}
}

/** The component files under `root` (relative, `/`-separated, sorted). */
export function componentFiles(root) {
	const globs = COMPONENT_GLOBS.map(globToRegExp);
	const tops = ["packages/ui/src/components", "apps/renderer/src/features"];
	return tops
		.flatMap((top) => [...walk(join(root, top), root)])
		.filter((file) => !NOT_COMPONENTS.test(file))
		.filter((file) => globs.some((re) => re.test(file)))
		.sort();
}

/**
 * Checks `root` against `requirements` ({ required?, coveredBy?, exempt? }). Returns the component files read and
 * every problem, each `{ file, problem }`.
 */
export function checkStories(root, requirements) {
	const components = componentFiles(root);
	const exists = (file) => existsSync(join(root, file));
	const read = (file) => readFileSync(join(root, file), "utf8");
	const coveredBy = requirements.coveredBy ?? {};
	const exempt = requirements.exempt ?? {};
	const problems = [];
	const report = (file, problem) => problems.push({ file, problem });

	for (const file of components) {
		const own = storiesFileOf(file);
		if (exists(own)) continue;
		if (Object.hasOwn(exempt, file)) continue;
		if (Object.hasOwn(coveredBy, file)) continue;
		report(file, `has no stories file (${own.split("/").at(-1)})`);
	}

	for (const [file, stories] of Object.entries(coveredBy)) {
		if (!exists(file)) report(file, "coveredBy names a file that is gone");
		else if (exists(storiesFileOf(file)))
			report(file, "has its own stories file now: remove its coveredBy entry");
		else if (!exists(stories))
			report(file, `coveredBy names ${stories}, which does not exist`);
		// The name at a word start: a story about it (`BottomPanelClosed`) or the component itself.
		else if (!new RegExp(`\\b${componentName(file)}`).test(read(stories)))
			report(file, `${stories} does not show ${componentName(file)}`);
	}

	for (const [file, reason] of Object.entries(exempt)) {
		if (typeof reason !== "string" || reason.trim() === "")
			report(file, "is exempt without a reason");
		if (!exists(file)) report(file, "is exempt but the file is gone");
		else if (exists(storiesFileOf(file)))
			report(file, "has its own stories file now: remove its exemption");
	}

	for (const { pattern, stories } of requirements.required ?? []) {
		const re = globToRegExp(pattern);
		const matched = components.filter((file) => re.test(file));
		if (matched.length === 0)
			report(pattern, "required-stories pattern matches no component");
		for (const file of matched) {
			const storiesFile = exists(storiesFileOf(file))
				? storiesFileOf(file)
				: coveredBy[file];
			if (storiesFile === undefined || !exists(storiesFile)) {
				report(
					file,
					`needs stories ${stories.join(", ")} but has no stories file`,
				);
				continue;
			}
			const have = new Set(storyNames(read(storiesFile)));
			const missing = stories.filter((name) => !have.has(name));
			if (missing.length > 0)
				report(
					file,
					`${storiesFile} lacks the required stories ${missing.join(", ")}`,
				);
		}
	}
	return { components, problems };
}

function main(argv) {
	const root = argv[0] ? resolve(argv[0]) : STUDIO;
	const requirementsFile = join(root, "tools/story-requirements.json");
	const requirements = JSON.parse(readFileSync(requirementsFile, "utf8"));
	const { components, problems } = checkStories(root, requirements);
	if (components.length === 0) {
		console.error("check-stories FAILED: no component files found");
		return 1;
	}
	if (problems.length > 0) {
		console.error(
			"check-stories FAILED: every component and screen needs its stories (tools/story-requirements.json)",
		);
		for (const { file, problem } of problems)
			console.error(`  ${file}: ${problem}`);
		return 1;
	}
	console.log(
		`check-stories OK: ${components.length} components and screens, each with its stories`,
	);
	return 0;
}

if (
	process.argv[1] &&
	resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
	process.exit(main(process.argv.slice(2)));
}
