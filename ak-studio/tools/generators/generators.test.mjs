// `pnpm test:generators` (part of `pnpm test`): runs the three generators in a temporary copy of the workspace, then
// runs the workspace's own checks in that copy, so what a generator writes passes them unchanged: Biome, the
// boundary rules (depcruise), the story and class checks, the typecheck (`tsc -b`), and the tests of the
// contract, the runtime, the desktop app and the renderer (the generated tests among them). It also checks the
// refusals: a bad name, a path, a reserved or taken name, a missing feature, a second run of the same generator,
// each leaving the copy exactly as it was. The copy is deleted afterwards; the real tree is never written.
//
// The copy holds the workspace's files as git sees them (tracked and untracked, not ignored) and links the root
// node_modules; each member's node_modules is recreated with the same relative links, so `@ak-studio/*` resolves
// inside the copy (checked below) and the typecheck reads the generated files, not the real tree's.
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
	cpSync,
	existsSync,
	lstatSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	readlinkSync,
	realpathSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const STUDIO = fileURLToPath(new URL("../../", import.meta.url));
const MEMBERS = ["apps", "packages"];
const SKIP = new Set(["node_modules", "dist", "out", "storybook-static"]);

/** Recreates a member's node_modules: its links (relative, or rebased into the copy) and its .bin shims. */
function copyLinks(from, to, dest) {
	mkdirSync(to, { recursive: true });
	for (const entry of readdirSync(from, { withFileTypes: true })) {
		const src = join(from, entry.name);
		const dst = join(to, entry.name);
		if (entry.isSymbolicLink()) {
			let target = readlinkSync(src);
			// pnpm links with junctions (absolute) on Windows: point workspace links at the copy.
			if (isAbsolute(target) && !relative(STUDIO, target).startsWith(".."))
				target = join(dest, relative(STUDIO, target));
			symlinkSync(target, dst, "junction");
		} else if (
			entry.isDirectory() &&
			(entry.name.startsWith("@") || entry.name === ".bin")
		)
			copyLinks(src, dst, dest);
		else if (entry.isFile()) cpSync(src, dst);
	}
}

function copyWorkspace() {
	// <temp>/ak-studio, beside a link to the repository's branding/ (two tests compare the app icon with the mark).
	const parent = mkdtempSync(join(tmpdir(), "ak-studio-generators-"));
	const dest = join(parent, "ak-studio");
	mkdirSync(dest);
	symlinkSync(
		join(STUDIO, "../branding"),
		join(parent, "branding"),
		"junction",
	);
	const files = execFileSync(
		"git",
		["ls-files", "-z", "--cached", "--others", "--exclude-standard"],
		{ cwd: STUDIO, encoding: "utf8" },
	)
		.split("\0")
		.filter(Boolean);
	for (const file of files) {
		const from = join(STUDIO, file);
		const stat = lstatSync(from, { throwIfNoEntry: false });
		if (!stat) continue; // deleted in the working tree
		const to = join(dest, file);
		mkdirSync(dirname(to), { recursive: true });
		if (stat.isSymbolicLink()) symlinkSync(readlinkSync(from), to);
		else cpSync(from, to);
	}
	symlinkSync(
		join(STUDIO, "node_modules"),
		join(dest, "node_modules"),
		"junction",
	);
	for (const group of MEMBERS)
		for (const member of readdirSync(join(STUDIO, group))) {
			const modules = join(STUDIO, group, member, "node_modules");
			if (existsSync(modules))
				copyLinks(modules, join(dest, group, member, "node_modules"), dest);
		}
	return dest;
}

/** Every file of the copy outside node_modules and build output, with a hash of its content. */
function snapshot(root) {
	const out = new Map();
	const walk = (dir) => {
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			if (SKIP.has(entry.name)) continue;
			const path = join(dir, entry.name);
			if (entry.isDirectory()) walk(path);
			else if (entry.isFile())
				out.set(
					relative(root, path),
					createHash("sha256").update(readFileSync(path)).digest("hex"),
				);
		}
	};
	walk(root);
	return out;
}

let copy;

/** Runs a Node script in the copy; answers its exit status and output. */
function node(args, cwd = copy) {
	const result = spawnSync(process.execPath, args, {
		cwd,
		encoding: "utf8",
		maxBuffer: 64 * 1024 * 1024,
	});
	return {
		status: result.status,
		out: `${result.stdout ?? ""}${result.stderr ?? ""}`,
	};
}

const generate = (script, ...args) =>
	node([join(copy, "tools/generators", `${script}.mjs`), ...args]);

/** Runs a generator and expects it to succeed. */
function generated(script, ...args) {
	const run = generate(script, ...args);
	expect(run.out, `${script} ${args.join(" ")}`).not.toMatch(/refused/);
	expect(run.status, run.out).toBe(0);
	return run.out;
}

/** Runs a generator and expects a refusal (exit 1, a "refused:" line) that names `reason`. */
function refused(reason, script, ...args) {
	const run = generate(script, ...args);
	expect(run.status, `${script} ${args.join(" ")}: ${run.out}`).toBe(1);
	expect(run.out).toMatch(/^refused: /m);
	expect(run.out).toMatch(reason);
}

const FEATURE = "release-notes";
const FEATURE_DIR = `apps/renderer/src/features/${FEATURE}`;
/** What the sample run writes, created or changed. */
const CREATED = [
	`${FEATURE_DIR}/manifest.ts`,
	`${FEATURE_DIR}/manifest.test.tsx`,
	`${FEATURE_DIR}/strings.ts`,
	`${FEATURE_DIR}/api/keys.ts`,
	`${FEATURE_DIR}/model/store.ts`,
	`${FEATURE_DIR}/model/store.test.ts`,
	`${FEATURE_DIR}/screens/ReleaseNotesScreen.tsx`,
	`${FEATURE_DIR}/screens/ReleaseNotesScreen.stories.tsx`,
	`${FEATURE_DIR}/api/useReleaseNotesReadSummary.ts`,
	`${FEATURE_DIR}/api/useReleaseNotesReadSummary.test.tsx`,
	`${FEATURE_DIR}/api/useReleaseNotesSaveSummary.ts`,
	`${FEATURE_DIR}/api/useReleaseNotesSaveSummary.test.tsx`,
	`${FEATURE_DIR}/api/useReleaseNotesPublishNotes.ts`,
	`${FEATURE_DIR}/api/useReleaseNotesPublishNotes.test.tsx`,
	`${FEATURE_DIR}/api/useReleaseNotesReadDiskUsage.ts`,
	`${FEATURE_DIR}/api/useReleaseNotesReadDiskUsage.test.tsx`,
	"packages/contract/src/release-notes.ts",
	"packages/runtime/src/release-notes/ReleaseNotesService.ts",
	"packages/runtime/src/release-notes/ReleaseNotesService.test.ts",
	"apps/desktop/src/main/services/ReleaseNotesService.ts",
	"apps/desktop/src/main/services/ReleaseNotesService.test.ts",
	"packages/ui/src/components/status-line.tsx",
	"packages/ui/src/components/status-line.stories.tsx",
];
const CHANGED = [
	"apps/renderer/src/app/features.ts",
	"packages/contract/src/index.ts",
	"packages/contract/src/operations.ts",
	"packages/runtime/src/features.ts",
	"apps/desktop/src/main/services/registerServices.ts",
	"apps/renderer/src/shared/bridge/desktopFixtures.ts",
	"packages/ui/src/index.ts",
];

beforeAll(() => {
	copy = copyWorkspace();
}, 120_000);

afterAll(() => {
	if (copy) rmSync(dirname(copy), { recursive: true, force: true });
});

describe("the generators, run in a copy of the workspace", () => {
	it("resolve the workspace's packages inside the copy", () => {
		const contract = realpathSync(
			join(copy, "apps/renderer/node_modules/@ak-studio/contract"),
		);
		expect(relative(realpathSync(copy), contract).startsWith("..")).toBe(false);
	});

	it("refuse a bad name, a path, a reserved or taken name and a missing feature, writing nothing", () => {
		const before = snapshot(copy);
		refused(/is a path/, "new-feature", "../escape");
		refused(/is a path/, "new-feature", "a/b");
		refused(/is a path/, "new-feature", "a\\b");
		refused(/not kebab-case/, "new-feature", "ReleaseNotes");
		refused(/not kebab-case/, "new-feature", "release_notes");
		refused(/not kebab-case/, "new-feature", "release--notes");
		refused(/reserved/, "new-feature", "shell");
		refused(/reserved/, "new-feature", "jobs");
		refused(/exists/, "new-feature", "domain");
		refused(/already exists/, "new-feature", "canvas");
		refused(/expected 1 name/, "new-feature");
		refused(/unknown option/, "new-feature", "x", "--force");
		refused(
			/no feature "nope"/,
			"new-operation",
			"nope",
			"read",
			"--shape",
			"query",
		);
		refused(
			/is a path/,
			"new-operation",
			"canvas",
			"../read",
			"--shape",
			"query",
		);
		refused(/--shape must be/, "new-operation", "canvas", "read");
		refused(
			/--shape must be/,
			"new-operation",
			"canvas",
			"read",
			"--shape",
			"table",
		);
		refused(
			/never desktop-only/,
			"new-operation",
			"canvas",
			"build",
			"--shape",
			"job",
			"--desktop",
		);
		refused(
			/member of every service/,
			"new-operation",
			"canvas",
			"register",
			"--shape",
			"query",
		);
		refused(/already exists/, "new-component", "tag");
		refused(/is a path/, "new-component", "../tag");
		refused(/not kebab-case/, "new-component", "StatusLine");
		refused(
			/--group must be/,
			"new-component",
			"status-line",
			"--group",
			"Misc",
		);
		expect(snapshot(copy)).toEqual(before);
	}, 60_000);

	it("create a feature, a query, a command, a job, a desktop-only query and a component", () => {
		const before = snapshot(copy);
		generated("new-feature", FEATURE);
		generated("new-operation", FEATURE, "read-summary", "--shape", "query");
		generated("new-operation", FEATURE, "save-summary", "--shape=command");
		generated("new-operation", FEATURE, "publish-notes", "--shape", "job");
		generated(
			"new-operation",
			FEATURE,
			"read-disk-usage",
			"--shape",
			"query",
			"--desktop",
		);
		generated("new-component", "status-line");
		const after = snapshot(copy);
		const created = [...after.keys()].filter((path) => !before.has(path));
		const changed = [...after.keys()].filter(
			(path) => before.has(path) && before.get(path) !== after.get(path),
		);
		expect(created.sort()).toEqual([...CREATED].sort());
		expect(changed.sort()).toEqual([...CHANGED].sort());
		expect(existsSync(join(copy, FEATURE_DIR, "components"))).toBe(true);
		const contract = readFileSync(
			join(copy, "packages/contract/src/operations.ts"),
			"utf8",
		);
		for (const op of [
			"readSummary",
			"saveSummary",
			"publishNotes",
			"readDiskUsage",
		])
			expect(contract).toContain(`"${FEATURE}.${op}"`);
	}, 120_000);

	it("refuse to make the same feature, operation or component twice, writing nothing", () => {
		const before = snapshot(copy);
		refused(/already exists/, "new-feature", FEATURE);
		refused(
			/already in the operations map/,
			"new-operation",
			FEATURE,
			"read-summary",
			"--shape",
			"query",
		);
		refused(
			/already in the operations map/,
			"new-operation",
			FEATURE,
			"read-disk-usage",
			"--shape",
			"command",
			"--desktop",
		);
		refused(/already exists/, "new-component", "status-line");
		expect(snapshot(copy)).toEqual(before);
	}, 60_000);

	it("add to services and tests that were edited by hand: a value import beside the types, code after the class", () => {
		const services = [
			"packages/runtime/src/release-notes/ReleaseNotesService.ts",
			"apps/desktop/src/main/services/ReleaseNotesService.ts",
		];
		for (const path of services) {
			const file = join(copy, path);
			const text = readFileSync(file, "utf8").replace(
				/import type \{([^}]*)\} from "@ak-studio\/contract";/,
				(_, names) =>
					`import { ERROR_CODES, ${names
						.split(",")
						.map((n) => n.trim())
						.filter(Boolean)
						.map((n) => `type ${n}`)
						.join(", ")} } from "@ak-studio/contract";`,
			);
			expect(text).toContain("ERROR_CODES");
			writeFileSync(
				file,
				`${text}\n/** The code this feature's errors use. */\nexport const RELEASE_NOTES_ERROR = ERROR_CODES.internal;\n`,
			);
		}
		generated("new-operation", FEATURE, "archive-notes", "--shape", "job");
		generated("new-operation", FEATURE, "read-word-count", "--shape", "query");
		generated(
			"new-operation",
			FEATURE,
			"write-disk-note",
			"--shape",
			"command",
			"--desktop",
		);
		for (const path of services) {
			const text = readFileSync(join(copy, path), "utf8");
			expect(text.match(/from "@ak-studio\/contract";/g), path).toHaveLength(1);
			expect(text, path).toMatch(
				/RELEASE_NOTES_ERROR = ERROR_CODES\.internal;\n$/,
			);
		}
		const fixtures = readFileSync(
			join(copy, "apps/renderer/src/shared/bridge/desktopFixtures.ts"),
			"utf8",
		);
		expect(fixtures).toContain('"release-notes.readDiskUsage"');
		expect(fixtures).toContain('"release-notes.writeDiskNote"');
	}, 60_000);

	it("write no placeholder copy", () => {
		for (const path of CREATED)
			expect(readFileSync(join(copy, path), "utf8"), path).not.toMatch(
				/TODO|FIXME|XXX|lorem|placeholder/i,
			);
	});

	it("pass Biome, the boundary rules, the story and class checks and the typecheck unchanged", () => {
		const checks = [
			[
				join(copy, "node_modules/@biomejs/biome/bin/biome"),
				"check",
				"--error-on-warnings",
				".",
			],
			[join(copy, "tools/depcruise.mjs")],
			[join(copy, "tools/check-stories.mjs")],
			[join(copy, "tools/check-classes.mjs")],
			[join(copy, "node_modules/typescript/bin/tsc"), "-b"],
		];
		const failed = [];
		for (const args of checks) {
			const run = node(args);
			if (run.status !== 0)
				failed.push(`${relative(copy, args[0])}:\n${run.out}`);
		}
		expect(failed.join("\n\n")).toBe("");
	}, 180_000);

	it("pass the contract's, the runtime's, the desktop app's and the renderer's tests, the generated ones among them", () => {
		const failed = [];
		let output = "";
		for (const member of [
			"packages/contract",
			"packages/runtime",
			"apps/desktop",
			"apps/renderer",
		]) {
			const run = node(
				[
					join(copy, "node_modules/vitest/vitest.mjs"),
					"run",
					"--reporter=verbose",
				],
				join(copy, member),
			);
			output += run.out;
			if (run.status !== 0) failed.push(`${member}:\n${run.out}`);
		}
		expect(failed.join("\n\n")).toBe("");
		// The generated tests ran, each with its cases.
		for (const test of CREATED.filter((path) => /\.test\.tsx?$/.test(path)))
			expect(output, test).toContain(test.split("/").at(-1));
	}, 240_000);
});
