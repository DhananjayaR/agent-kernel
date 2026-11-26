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
	chmodSync,
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
	statSync,
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

/** Copies the workspace into `<parent>/ak-studio`, beside a link to the repository's branding/ (two tests compare the app icon with the mark). */
function copyWorkspace(parent) {
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

let parent;
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
	`${FEATURE_DIR}/api/useReleaseNotesReadHistory.ts`,
	`${FEATURE_DIR}/api/useReleaseNotesReadHistory.test.tsx`,
	`${FEATURE_DIR}/api/useReleaseNotesSaveHistory.ts`,
	`${FEATURE_DIR}/api/useReleaseNotesSaveHistory.test.tsx`,
	`${FEATURE_DIR}/api/useReleaseNotesRebuildIndex.ts`,
	`${FEATURE_DIR}/api/useReleaseNotesRebuildIndex.test.tsx`,
	`${FEATURE_DIR}/api/useReleaseNotesReadDiskPath.ts`,
	`${FEATURE_DIR}/api/useReleaseNotesReadDiskPath.test.tsx`,
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
	// The folder is recorded before the copy starts, so a failed copy is still deleted.
	parent = mkdtempSync(join(tmpdir(), "ak-studio-generators-"));
	copy = copyWorkspace(parent);
}, 120_000);

afterAll(() => {
	if (parent) rmSync(parent, { recursive: true, force: true });
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
		refused(/device name on Windows/, "new-feature", "con");
		refused(/device name on Windows/, "new-component", "lpt1");
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

	it("create a feature, a query, a command, a job, desktop-only and project-scoped operations, and a component", () => {
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
		generated(
			"new-operation",
			FEATURE,
			"read-history",
			"--shape",
			"query",
			"--project",
		);
		generated(
			"new-operation",
			FEATURE,
			"save-history",
			"--shape",
			"command",
			"--project",
		);
		generated(
			"new-operation",
			FEATURE,
			"rebuild-index",
			"--shape",
			"job",
			"--project",
		);
		generated(
			"new-operation",
			FEATURE,
			"read-disk-path",
			"--shape",
			"query",
			"--desktop",
			"--project",
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
			"readHistory",
			"saveHistory",
			"rebuildIndex",
			"readDiskPath",
		])
			expect(contract).toContain(`"${FEATURE}.${op}"`);
		const declared = readFileSync(
			join(copy, "packages/contract/src/release-notes.ts"),
			"utf8",
		);
		expect(declared).toMatch(
			/releaseNotesReadHistory = query\(\{[^}]*projectId: ProjectId[\s\S]*?errors: \[ERROR_CODES\.projectNotOpen\]/,
		);
		const hook = readFileSync(
			join(copy, FEATURE_DIR, "api/useReleaseNotesReadHistory.ts"),
			"utf8",
		);
		expect(hook).toContain('releaseNotesKeys.detail(projectId, "readHistory")');
		// A job's kind is owned by its feature: listed in the manifest's `jobs`, a second appended to the first.
		expect(
			readFileSync(join(copy, FEATURE_DIR, "manifest.ts"), "utf8"),
		).toMatch(
			/^\tjobs: \["release-notes\.publishNotes", "release-notes\.rebuildIndex"\],$/m,
		);
		// A job's runner takes its input and its context, and is registered so.
		const service = readFileSync(
			join(copy, "packages/runtime/src/release-notes/ReleaseNotesService.ts"),
			"utf8",
		);
		expect(service).toMatch(/import type \{ JobContext \} from "\.\.\/jobs";/);
		expect(service).toMatch(
			/async publishNotes\(\s*_input: HandlerInputOf<Operations\["release-notes\.publishNotes"\]>,\s*_ctx: JobContext,\s*\)/,
		);
		expect(service).toMatch(
			/jobs\.define\(\s*"release-notes\.publishNotes",\s*\(input, ctx\) =>\s*this\.publishNotes\(input, ctx\),?\s*\)/,
		);
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

	it("run through a symlinked path: refuse or answer, never exit 0 having done nothing", () => {
		const linked = join(parent, "linked");
		symlinkSync(copy, linked, "junction");
		const script = join(linked, "tools/generators/new-feature.mjs");
		const before = snapshot(copy);
		const bad = node([script, "../escape"]);
		expect(bad.status, bad.out).toBe(1);
		expect(bad.out).toMatch(/^refused: .*is a path/m);
		const help = node([script, "--help"]);
		expect(help.status).toBe(0);
		expect(help.out).toMatch(/usage: pnpm new:feature/);
		expect(snapshot(copy)).toEqual(before);
	}, 60_000);

	it("refuse an edit point it cannot find unambiguously, writing nothing", () => {
		const service = join(
			copy,
			"packages/runtime/src/release-notes/ReleaseNotesService.ts",
		);
		const operations = join(copy, "packages/contract/src/operations.ts");
		const originalService = readFileSync(service, "utf8");
		const originalOperations = readFileSync(operations, "utf8");
		// A method after `register`: the handler must not land inside it.
		writeFileSync(
			service,
			originalService.replace(
				/\n\}\n$/,
				"\n\n\tcount(): number {\n\t\treturn 1;\n\t}\n}\n",
			),
		);
		let before = snapshot(copy);
		refused(
			/not the class's last member/,
			"new-operation",
			FEATURE,
			"read-tally",
			"--shape",
			"query",
		);
		expect(snapshot(copy)).toEqual(before);
		writeFileSync(service, originalService);
		// A comment inside the operations map.
		writeFileSync(
			operations,
			originalOperations.replace(
				"export const operations = {\n",
				"export const operations = {\n\t// The app's own.\n",
			),
		);
		before = snapshot(copy);
		refused(
			/operations. map holds something other/,
			"new-operation",
			FEATURE,
			"read-tally",
			"--shape",
			"query",
		);
		expect(snapshot(copy)).toEqual(before);
		writeFileSync(operations, originalOperations);
		// A feature folder made by hand under a contract module's name.
		const domainFeature = join(copy, "apps/renderer/src/features/domain");
		mkdirSync(domainFeature);
		writeFileSync(join(domainFeature, "manifest.ts"), "export {};\n");
		before = snapshot(copy);
		refused(
			/another module/,
			"new-operation",
			"domain",
			"read-tally",
			"--shape",
			"command",
		);
		expect(snapshot(copy)).toEqual(before);
		rmSync(domainFeature, { recursive: true });
	}, 60_000);

	it("add a test case inside its describe when an afterEach follows it", () => {
		const testFile = join(
			copy,
			"packages/runtime/src/release-notes/ReleaseNotesService.test.ts",
		);
		const text = readFileSync(testFile, "utf8").replace(
			'import { describe, expect, it, vi } from "vitest";',
			'import { afterEach, describe, expect, it, vi } from "vitest";',
		);
		writeFileSync(
			testFile,
			`${text}\nafterEach(() => {\n\tvi.restoreAllMocks();\n});\n`,
		);
		generated("new-operation", FEATURE, "read-tally", "--shape", "query");
		const after = readFileSync(testFile, "utf8");
		const tally = after.indexOf('it("answers release-notes.readTally"');
		const close = after.indexOf("\n});\n\nafterEach(");
		expect(tally).toBeGreaterThan(0);
		expect(close).toBeGreaterThan(tally);
		expect(after).toMatch(
			/afterEach\(\(\) => \{\n\tvi\.restoreAllMocks\(\);\n\}\);\n$/,
		);
	}, 60_000);

	it("put every file back when writing fails part way (on every OS)", () => {
		const src = join(copy, "packages/ui/src");
		// A folder where the index's temporary file must go: the component and its stories are written first, then
		// writing the index fails (a file cannot be written over a folder on any OS), and all must be undone.
		const blocker = join(src, ".index.ts.generator-tmp");
		mkdirSync(blocker);
		const before = snapshot(copy);
		refused(
			/writing failed, so nothing was changed/,
			"new-component",
			"toolbar-row",
		);
		expect(snapshot(copy)).toEqual(before);
		expect(existsSync(join(src, "components/toolbar-row.tsx"))).toBe(false);
		expect(existsSync(join(src, "components/toolbar-row.stories.tsx"))).toBe(
			false,
		);
		// The folder it did not make is left alone.
		expect(existsSync(blocker)).toBe(true);
		rmSync(blocker, { recursive: true });
	}, 60_000);

	it("remove the folders it made when a new feature fails part way", () => {
		const features = join(copy, "apps/renderer/src/app");
		const blocker = join(features, ".features.ts.generator-tmp");
		mkdirSync(blocker);
		const before = snapshot(copy);
		refused(
			/writing failed, so nothing was changed/,
			"new-feature",
			"changelog",
		);
		expect(snapshot(copy)).toEqual(before);
		expect(existsSync(join(copy, "apps/renderer/src/features/changelog"))).toBe(
			false,
		);
		rmSync(blocker, { recursive: true });
	}, 60_000);

	it("keep a comment on register with register, and add a fixture inside its object when code follows it", () => {
		const service = join(
			copy,
			"apps/desktop/src/main/services/ReleaseNotesService.ts",
		);
		const fixtures = join(
			copy,
			"apps/renderer/src/shared/bridge/desktopFixtures.ts",
		);
		writeFileSync(
			service,
			readFileSync(service, "utf8").replace(
				"\tregister(registry:",
				"\t/**\n\t * Serves the feature's desktop-only operations.\n\t */\n\tregister(registry:",
			),
		);
		const trailing =
			"\n/** Answers the tests reuse. */\nexport const sampleAnswers = {\n\tempty: {},\n};\n";
		writeFileSync(fixtures, `${readFileSync(fixtures, "utf8")}${trailing}`);
		generated(
			"new-operation",
			FEATURE,
			"read-disk-label",
			"--shape",
			"query",
			"--desktop",
		);
		const text = readFileSync(service, "utf8");
		expect(text).toMatch(
			/\t\/\*\*\n\t \* Serves the feature's desktop-only operations\.\n\t \*\/\n\tregister\(registry:/,
		);
		expect(text.indexOf("readDiskLabel(")).toBeLessThan(
			text.indexOf("Serves the feature's desktop-only operations"),
		);
		const after = readFileSync(fixtures, "utf8");
		expect(after.endsWith(trailing)).toBe(true);
		expect(after.indexOf('"release-notes.readDiskLabel"')).toBeLessThan(
			after.indexOf("export const sampleAnswers"),
		);
		// A desktop-only, project-scoped operation's fixture checks the scope, as its service does.
		expect(after).toMatch(
			/"release-notes\.readDiskPath": \(\{ projectId \}, \{ scopes \}\) => \{\n\t\tscopes\.require\(projectId\);/,
		);
	}, 60_000);

	it.skipIf(process.platform === "win32")(
		"refuse to edit a file that is a symbolic link, and keep a file's mode",
		() => {
			const index = join(copy, "packages/ui/src/index.ts");
			const real = join(copy, "packages/ui/src/index.real.ts");
			const original = readFileSync(index, "utf8");
			writeFileSync(real, original);
			rmSync(index);
			symlinkSync("index.real.ts", index);
			const before = snapshot(copy);
			refused(/is a symbolic link/, "new-component", "toolbar-row");
			expect(snapshot(copy)).toEqual(before);
			rmSync(index);
			rmSync(real);
			writeFileSync(index, original);
			chmodSync(index, 0o600);
			generated("new-component", "toolbar-row");
			expect(statSync(index).mode & 0o777).toBe(0o600);
			chmodSync(index, 0o644);
		},
		60_000,
	);

	it("put every file back when Biome cannot fix what it wrote", () => {
		const features = join(copy, "apps/renderer/src/app/features.ts");
		const original = readFileSync(features, "utf8");
		// A hand edit Biome will not fix by itself (its fix is unsafe), in a file the generator edits.
		writeFileSync(
			features,
			`${original}\nexport function pause(): void {\n\tdebugger;\n}\n`,
		);
		const before = snapshot(copy);
		refused(
			/writing failed, so nothing was changed/,
			"new-feature",
			"changelog",
		);
		expect(snapshot(copy)).toEqual(before);
		expect(existsSync(join(copy, "apps/renderer/src/features/changelog"))).toBe(
			false,
		);
		writeFileSync(features, original);
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
