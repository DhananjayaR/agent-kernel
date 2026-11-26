// Self-test for check-stories (run by `pnpm lint`): each planted gap fails it (spec P1b Verification: "a component
// without its required stories fails CI", proved locally, P1b-plan ruling 1); the planted good tree passes; an empty
// tree fails rather than passing silently; and the real tree passes.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
	checkStories,
	componentFiles,
	componentName,
	globToRegExp,
	storyNames,
} from "./check-stories.mjs";

const script = fileURLToPath(new URL("./check-stories.mjs", import.meta.url));
const studio = fileURLToPath(new URL("../", import.meta.url));
const fixture = (name) =>
	fileURLToPath(new URL(`./check-stories-fixture/${name}/`, import.meta.url));
const requirementsOf = (root) =>
	JSON.parse(readFileSync(`${root}tools/story-requirements.json`, "utf8"));
const run = (root) =>
	spawnSync(process.execPath, [script, root], { encoding: "utf8" });

describe("check-stories", () => {
	it("reports each planted gap in the bad tree", () => {
		const root = fixture("bad");
		const { components, problems } = checkStories(root, requirementsOf(root));
		// hooks/ and a feature's loose files are not components.
		expect(components).not.toContain(
			"apps/renderer/src/features/demo/hooks/useDemo.tsx",
		);
		expect(components).not.toContain(
			"apps/renderer/src/features/demo/strings.tsx",
		);
		expect(problems.map(({ file, problem }) => `${file}: ${problem}`)).toEqual([
			// A component file, a feature screen and a feature component (nested) with no stories file.
			"apps/renderer/src/features/demo/components/table/Table.tsx: has no stories file (Table.stories.tsx)",
			"apps/renderer/src/features/demo/screens/DemoScreen.tsx: has no stories file (DemoScreen.stories.tsx)",
			"packages/ui/src/components/widget.tsx: has no stories file (widget.stories.tsx)",
			// coveredBy: a file that does not show the component; a stale entry; a file that is gone.
			"packages/ui/src/components/pill.tsx: packages/ui/src/components/group.stories.tsx does not show Pill",
			"packages/ui/src/components/tile.tsx: has its own stories file now: remove its coveredBy entry",
			"packages/ui/src/components/badge.tsx: coveredBy names a file that is gone",
			// exempt: no reason; a file that is gone.
			"packages/ui/src/components/frame.tsx: is exempt without a reason",
			"packages/ui/src/components/gone.tsx: is exempt but the file is gone",
			// required stories: missing names; a screen with no stories at all; a pattern that matches nothing.
			"packages/ui/src/components/gauge.tsx: packages/ui/src/components/gauge.stories.tsx lacks the required stories Empty, Error",
			"apps/renderer/src/features/demo/screens/DemoScreen.tsx: needs stories Empty but has no stories file",
			"packages/ui/src/components/nothing-*.tsx: required-stories pattern matches no component",
		]);
	});

	it("exits non-zero on the bad tree and on a tree with no components", () => {
		const bad = run(fixture("bad"));
		expect(bad.status).toBe(1);
		expect(bad.stderr).toContain("widget.tsx: has no stories file");
		const empty = run(fixture("empty"));
		expect(empty.status).toBe(1);
		expect(empty.stderr).toContain("no component files found");
	});

	it("passes the good tree: own stories with the required names, coveredBy, exempt and `export { A as B }`", () => {
		const root = fixture("good");
		const { components, problems } = checkStories(root, requirementsOf(root));
		expect(components).toHaveLength(4);
		expect(problems).toEqual([]);
		expect(run(root).status).toBe(0);
	});

	it("reads story export names and component names", () => {
		expect(
			storyNames(
				"export default { title: 'x' };\nexport const Empty = {};\nexport function Loading() {}\nexport { Error, Long as LongName };",
			).sort(),
		).toEqual(["Empty", "Error", "Loading", "LongName"]);
		expect(
			componentName("packages/ui/src/components/project-switcher.tsx"),
		).toBe("ProjectSwitcher");
		expect(componentName("a/screens/CanvasScreen.tsx")).toBe("CanvasScreen");
		expect(
			globToRegExp("a/*/screens/**/*.tsx").test("a/x/screens/y/Z.tsx"),
		).toBe(true);
		expect(globToRegExp("a/*/screens/**/*.tsx").test("a/x/screens/Z.tsx")).toBe(
			true,
		);
		expect(globToRegExp("a/*.tsx").test("a/b/c.tsx")).toBe(false);
	});

	it("passes on the real tree, which has components and screens to check", () => {
		expect(componentFiles(studio).length).toBeGreaterThan(30);
		const { problems } = checkStories(studio, requirementsOf(studio));
		expect(problems).toEqual([]);
	});
});
