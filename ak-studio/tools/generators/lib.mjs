// What the three generators share (`pnpm new:feature`, `pnpm new:operation`, `pnpm new:component`): the name
// checks, the names derived from a kebab-case name, and the plan of files to create and edit. A plan is checked
// whole before anything is written, so a refused run (a bad name, a file that already exists, an edit point that
// is missing) leaves the tree as it was. After writing, the touched files go through the workspace's Biome
// (`biome check --write`), which sorts the imports and exports the edits added.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** The ak-studio/ workspace the generators write into (the one this file is in). */
export const STUDIO = fileURLToPath(new URL("../../", import.meta.url));

/** A refusal: printed without a stack, and the run exits 1 having written nothing. */
export class GeneratorError extends Error {}

/** Feature ids, operation names and component names: lower-case words joined by hyphens (feature.ts's FEATURE_ID). */
export const KEBAB = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const MAX_NAME = 40;

/**
 * Checks a name given on the command line: a kebab-case name, never a path. Refuses separators, `..`, a leading
 * dot or anything outside [a-z0-9-] before the kebab-case check, so the message says what is wrong.
 */
export function checkName(what, name) {
	if (typeof name !== "string" || name === "")
		throw new GeneratorError(`give the ${what}'s name`);
	if (/[/\\]/.test(name) || name.includes("..") || name.startsWith("."))
		throw new GeneratorError(
			`${JSON.stringify(name)} is a path: give the ${what}'s name alone, in kebab-case (release-notes)`,
		);
	if (!KEBAB.test(name))
		throw new GeneratorError(
			`${JSON.stringify(name)} is not kebab-case: lower-case letters and digits, words joined by single hyphens, starting with a letter (release-notes)`,
		);
	if (name.length > MAX_NAME)
		throw new GeneratorError(
			`${JSON.stringify(name)} is longer than ${MAX_NAME} characters`,
		);
	return name;
}

/** A file's header comment: `text` as `// ` lines of at most `width` characters (the files' own style). */
export function comment(text, width = 116) {
	const lines = [];
	let line = "//";
	for (const word of text.split(/\s+/).filter(Boolean)) {
		if (line.length + 1 + word.length > width && line !== "//") {
			lines.push(line);
			line = "//";
		}
		line += ` ${word}`;
	}
	lines.push(line);
	return lines.join("\n");
}

/** The forms of a kebab-case name: `release-notes` -> releaseNotes, ReleaseNotes, "Release notes". */
export function namesOf(kebab) {
	const words = kebab.split("-");
	const cap = (w) => w.charAt(0).toUpperCase() + w.slice(1);
	return {
		kebab,
		camel: words[0] + words.slice(1).map(cap).join(""),
		pascal: words.map(cap).join(""),
		/** Sentence case, for copy (copy rules). */
		title: cap(words.join(" ")),
	};
}

/** Parses `--name value` and `--flag` options and positionals; refuses unknown options. */
export function parseCli(argv, { options, positionals, usage }) {
	const values = {};
	const rest = [];
	for (let i = 0; i < argv.length; i += 1) {
		const arg = argv[i];
		if (arg === "--") continue;
		if (arg === "--help" || arg === "-h") return { help: true };
		if (arg.startsWith("--")) {
			const [flag, inline] = arg.slice(2).split("=", 2);
			const kind = options[flag];
			if (kind === undefined)
				throw new GeneratorError(`unknown option --${flag}\n${usage}`);
			if (kind === "boolean") {
				if (inline !== undefined)
					throw new GeneratorError(`--${flag} takes no value`);
				values[flag] = true;
			} else {
				const value = inline ?? argv[++i];
				if (value === undefined || value.startsWith("--"))
					throw new GeneratorError(`--${flag} needs a value\n${usage}`);
				values[flag] = value;
			}
		} else rest.push(arg);
	}
	if (rest.length !== positionals)
		throw new GeneratorError(
			`expected ${positionals} name${positionals === 1 ? "" : "s"}, got ${rest.length}\n${usage}`,
		);
	return { values, positionals: rest };
}

/**
 * The files a generator will create and edit, relative to the workspace. Nothing touches the disk until
 * `write()`, which runs only once every create and edit has been planned without a refusal.
 */
export class Plan {
	constructor(root = STUDIO) {
		this.root = root;
		/** @type {Map<string, string>} */
		this.files = new Map();
		this.created = new Set();
		this.dirs = new Set();
	}

	abs(path) {
		return join(this.root, path);
	}

	exists(path) {
		return this.files.has(path) || existsSync(this.abs(path));
	}

	/** The file's text as planned so far (an earlier edit included), or as it is on disk. */
	read(path) {
		if (this.files.has(path)) return this.files.get(path);
		if (!existsSync(this.abs(path)))
			throw new GeneratorError(`${path} is missing`);
		return readFileSync(this.abs(path), "utf8");
	}

	/** Plans a new file; refuses one that exists, so nothing is ever overwritten. */
	create(path, text) {
		if (this.exists(path))
			throw new GeneratorError(`${path} already exists: nothing was written`);
		this.files.set(path, text);
		this.created.add(path);
	}

	/** Plans an empty folder (made only if missing). */
	mkdir(path) {
		this.dirs.add(path);
	}

	/** Plans an edit: `change(text)` answers the new text, or throws a GeneratorError naming what it missed. */
	edit(path, change) {
		const before = this.read(path);
		const after = change(before);
		if (after === before)
			throw new GeneratorError(`${path}: the edit changed nothing`);
		this.files.set(path, after);
	}

	/** Writes every planned file, then formats them with the workspace's Biome. Answers the paths written. */
	write() {
		for (const dir of this.dirs) mkdirSync(this.abs(dir), { recursive: true });
		for (const [path, text] of this.files) {
			mkdirSync(dirname(this.abs(path)), { recursive: true });
			writeFileSync(this.abs(path), text, "utf8");
		}
		const paths = [...this.files.keys()];
		formatWithBiome(this.root, paths);
		return paths;
	}
}

/** `biome check --write` over the written files: formatting, sorted imports and exports, safe fixes. */
function formatWithBiome(root, paths) {
	const biome = join(root, "node_modules/@biomejs/biome/bin/biome");
	try {
		execFileSync(
			process.execPath,
			[biome, "check", "--write", "--no-errors-on-unmatched", ...paths],
			{ cwd: root, stdio: "pipe" },
		);
	} catch (err) {
		const out = `${err.stdout ?? ""}${err.stderr ?? ""}`;
		throw new Error(
			`the files were written, but Biome reports problems it could not fix (a generator bug):\n${out}`,
		);
	}
}

/**
 * Inserts an import declaration among the file's imports: a package's before the first relative import, a relative
 * one after the last import. Biome sorts them afterwards; placing a package's import first keeps the header comment
 * on the first line (Biome would otherwise move it with the import it sits on).
 */
export function addImport(text, line, path) {
	const imports = [...text.matchAll(/^import\b[^;]*;[^\n]*\n/gm)];
	if (imports.length === 0)
		throw new GeneratorError(`${path}: no import to add ${line} beside`);
	const source = /from "([^"]+)";/.exec(line)?.[1] ?? "";
	const firstRelative = source.startsWith(".")
		? undefined
		: imports.find((m) => /from "\.{1,2}\//.test(m[0]));
	const at = firstRelative
		? firstRelative.index
		: imports.at(-1).index + imports.at(-1)[0].length;
	return `${text.slice(0, at)}${line}\n${text.slice(at)}`;
}

/** Adds `names` to the named import from `source` (`import { a } from "x"` or `import type { a } from "x"`). */
export function addNamedImport(
	text,
	source,
	names,
	{ typeOnly = false, path },
) {
	const escaped = source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const re = new RegExp(
		`^import ${typeOnly ? "type " : ""}\\{([^}]*)\\} from "${escaped}";`,
		"m",
	);
	const m = re.exec(text);
	if (!m) {
		const list = [...names].sort().join(", ");
		return addImport(
			text,
			`import ${typeOnly ? "type " : ""}{ ${list} } from "${source}";`,
			path,
		);
	}
	const have = m[1]
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean);
	const all = [...new Set([...have, ...names])].sort();
	if (all.length === have.length) return text;
	return text.replace(
		re,
		`import ${typeOnly ? "type " : ""}{ ${all.join(", ")} } from "${source}";`,
	);
}

/** Finds `re` in `text` or refuses, saying what to restore. */
export function find(text, re, path, what) {
	const m = re.exec(text);
	if (!m)
		throw new GeneratorError(
			`${path}: cannot find ${what}, where the generator adds its line. Restore it, or add the change by hand.`,
		);
	return m;
}

/** Prints what a run wrote, relative to the workspace. */
export function report(title, plan, written, next) {
	console.log(title);
	for (const path of written)
		console.log(`  ${plan.created.has(path) ? "created" : "changed"} ${path}`);
	for (const dir of plan.dirs)
		if (![...written].some((p) => p.startsWith(`${dir}/`)))
			console.log(`  created ${dir}/`);
	if (next) console.log(`\n${next}`);
}

/** Runs a generator's main, printing a refusal without a stack. */
export function runCli(main) {
	try {
		main(process.argv.slice(2));
	} catch (err) {
		if (err instanceof GeneratorError) {
			console.error(`refused: ${err.message}`);
			process.exit(1);
		}
		throw err;
	}
}

/** True when the module at `url` is the script node was started with (not imported by a test). */
export function isMain(url) {
	return (
		Boolean(process.argv[1]) && resolve(process.argv[1]) === fileURLToPath(url)
	);
}
