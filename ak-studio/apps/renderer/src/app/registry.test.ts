// The app registry, built from the feature manifests (app/features.ts), with no DOM: the shell's tabs in order with
// their labels and paths, the manifest checks (every capability a manifest or command names is in the kernel
// capability catalog; every command id is unique; every `runCommand("…")` id in the renderer's source is an app
// command, found by a source scan), and the shortcut clash test, platform by platform.
import { EMPTY_CATALOG } from "@ak-studio/kernel-catalog";
import { describe, expect, it } from "vitest";
import { defineCommand } from "../shared/commands/command";
import { defineFeature } from "../shared/commands/feature";
import { getCommands } from "../shared/commands/runCommand";
import {
	findShortcutClashes,
	RESERVED_SHORTCUTS,
	SHORTCUT_PLATFORMS,
} from "../shared/commands/shortcuts";
import { features } from "./features";
import { buildRegistry, registry } from "./registry";

const Empty = () => null;

/** A literal id passed to runCommand that is not an app command. */
interface UnknownCommandId {
	file: string;
	id: string;
}

/** The literal ids passed to runCommand in `sources` (file to text) that are not in `known`; built ids are skipped. */
function unknownCommandIds(
	sources: Readonly<Record<string, string>>,
	known: readonly string[],
): UnknownCommandId[] {
	const call = /\brunCommand\(\s*(["'`])([^"'`$]+)\1/g;
	const ids = new Set(known);
	const unknown: UnknownCommandId[] = [];
	for (const [file, text] of Object.entries(sources))
		for (const match of text.matchAll(call)) {
			const id = match[2] as string;
			if (!ids.has(id)) unknown.push({ file, id });
		}
	return unknown;
}

describe("the registry's tabs", () => {
	it("are the five current tabs, in order, with their labels and paths", () => {
		expect(
			registry.tabs.map(({ id, label, path }) => ({ id, label, path })),
		).toEqual([
			{ id: "canvas", label: "Canvas", path: "/canvas" },
			{ id: "code", label: "Code", path: "/code" },
			{ id: "config", label: "Config", path: "/config" },
			{ id: "test-trace", label: "Test & trace", path: "/test-trace" },
			{ id: "deploy", label: "Deploy", path: "/deploy" },
		]);
		expect(registry.defaultTab.id).toBe("canvas");
	});

	it("each have a route the router mounts at the tab's path", () => {
		for (const tab of registry.tabs)
			expect(
				registry.routes.some((route) => route.path === tab.path),
				tab.id,
			).toBe(true);
	});

	it("come from the manifests' order, not the list's", () => {
		const built = buildRegistry([
			defineFeature({
				id: "b",
				tab: { label: "B", path: "/b", order: 2 },
				routes: [{ path: "/b", component: Empty }],
				commands: [],
				capabilities: [],
			}),
			defineFeature({
				id: "a",
				tab: { label: "A", path: "/a", order: 1 },
				routes: [{ path: "/a", component: Empty }],
				commands: [],
				capabilities: [],
			}),
		]);
		expect(built.tabs.map((tab) => tab.id)).toEqual(["a", "b"]);
	});
});

describe("the manifests", () => {
	it("name only capabilities in the kernel capability catalog (empty in P1b, so none)", () => {
		const named = features.flatMap((feature) => [
			...feature.capabilities,
			...feature.commands.flatMap((command) =>
				command.capability === undefined ? [] : [command.capability],
			),
		]);
		expect(named.filter((id) => !EMPTY_CATALOG.has(id))).toEqual([]);
		expect(registry.capabilities).toEqual([]);
	});

	it("have unique feature ids and unique command ids", () => {
		const ids = features.map((feature) => feature.id);
		expect(new Set(ids).size).toBe(ids.length);
		const commandIds = registry.commands.map((command) => command.id);
		expect(new Set(commandIds).size).toBe(commandIds.length);
	});

	it("give runCommand the registry's commands", () => {
		expect(getCommands()).toEqual(registry.commands);
		expect(registry.commands.map((command) => command.id)).toContain(
			"shell.toggleBottomPanel",
		);
	});

	it("are refused by buildRegistry when two commands share an id, two features share a path, or a tab has no route", () => {
		const command = defineCommand({ id: "a.one", title: "One", run: () => {} });
		const feature = (id: string, extra: object = {}) =>
			defineFeature({ id, commands: [], capabilities: [], ...extra });
		expect(() =>
			buildRegistry([
				feature("a", { commands: [command] }),
				feature("b", { commands: [command] }),
			]),
		).toThrow(/a\.one/);
		expect(() => buildRegistry([feature("a"), feature("a")])).toThrow(
			/feature a/,
		);
		expect(() =>
			buildRegistry([
				feature("a", { routes: [{ path: "/x", component: Empty }] }),
				feature("b", { routes: [{ path: "/x", component: Empty }] }),
			]),
		).toThrow(/\/x/);
		expect(() =>
			defineFeature({
				id: "a",
				tab: { label: "A", path: "/a", order: 1 },
				commands: [],
				capabilities: [],
			}),
		).toThrow(/\/a/);
	});
});

describe("runCommand ids in the source", () => {
	// Every source file of the renderer, as text (Vite's glob: the renderer imports no Node built-in, tests
	// included). Tests are left out: they call runCommand with unknown ids on purpose.
	const sources = import.meta.glob<string>(
		["../**/*.{ts,tsx}", "!../**/*.test.{ts,tsx}", "!../**/*.stories.tsx"],
		{ query: "?raw", import: "default", eager: true },
	);

	it("reads the renderer's source (the scan is not empty)", () => {
		expect(Object.keys(sources).length).toBeGreaterThan(20);
		expect(Object.keys(sources)).toContain("./registry.ts");
	});

	it("names only app commands", () => {
		const known = registry.commands.map((command) => command.id);
		expect(unknownCommandIds(sources, known)).toEqual([]);
	});

	it("would fail on a literal id that is not an app command (the check can fail)", () => {
		const planted = {
			"./planted.ts": `void runCommand("code.revealFile", { path });\nrunCommand( 'shell.toggleBottomPanel' );\nrunCommand(\`nope.missing\`)`,
		};
		expect(unknownCommandIds(planted, ["shell.toggleBottomPanel"])).toEqual([
			{ file: "./planted.ts", id: "code.revealFile" },
			{ file: "./planted.ts", id: "nope.missing" },
		]);
	});
});

describe("shortcuts", () => {
	it("never clash, on any platform, and leave Mod+K to the command palette", () => {
		for (const platform of SHORTCUT_PLATFORMS)
			expect(
				findShortcutClashes(registry.commands, platform),
				platform,
			).toEqual([]);
		expect(Object.keys(RESERVED_SHORTCUTS)).toContain("Mod+K");
	});

	it("give Mod+J to shell.toggleBottomPanel: Cmd+J on macOS, Ctrl+J elsewhere, in the registry's shortcut map", () => {
		expect(
			registry.commands.find((c) => c.id === "shell.toggleBottomPanel")
				?.shortcut,
		).toBe("Mod+J");
		const mac = registry.shortcutMap("mac");
		const other = registry.shortcutMap("other");
		expect(mac.get("Meta+J")?.id).toBe("shell.toggleBottomPanel");
		expect(mac.has("Control+J")).toBe(false);
		expect(other.get("Control+J")?.id).toBe("shell.toggleBottomPanel");
		expect(other.has("Meta+J")).toBe(false);
	});
});
