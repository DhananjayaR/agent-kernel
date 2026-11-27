// The app registry, built from the feature manifests (app/features.ts), with no DOM: the shell's tabs in order with
// their labels and paths, the manifest checks (every capability a manifest or command names is in the kernel
// capability catalog the app uses; every command id is unique and in its feature's namespace; every
// `runCommand("…")` id in the renderer's source is an app command, found by a source scan), and the shortcut clash
// test, platform by platform, with Mod+K and the native menu's accelerators kept.
import { jobKinds } from "@ak-studio/contract";
import type { CapabilityCatalog } from "@ak-studio/kernel-catalog";
import { describe, expect, it } from "vitest";
import { APP_CATALOG } from "../shared/capability/capability";
import { defineCommand } from "../shared/commands/command";
import {
	defineFeature,
	type FeatureManifest,
} from "../shared/commands/feature";
import { getCommands } from "../shared/commands/runCommand";
import {
	findShortcutClashes,
	NATIVE_MENU_SHORTCUTS,
	RESERVED_SHORTCUTS,
	SHORTCUT_PLATFORMS,
} from "../shared/commands/shortcuts";
import { features } from "./features";
import { buildRegistry, registry } from "./registry";

const Empty = () => null;

/** The capabilities `manifests` (or their commands) name that `catalog` does not have. */
function unknownCapabilities(
	manifests: readonly FeatureManifest[],
	catalog: CapabilityCatalog,
): string[] {
	return manifests
		.flatMap((feature) => [
			...feature.capabilities,
			...feature.commands.flatMap((command) =>
				command.capability === undefined ? [] : [command.capability],
			),
		])
		.filter((id) => !catalog.has(id));
}

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
	// The five product tabs, then About's temporary tab (it goes with the About feature when P2 lands).
	it("are the five product tabs, in order, then About's, with their labels and paths", () => {
		expect(
			registry.tabs.map(({ id, label, path }) => ({ id, label, path })),
		).toEqual([
			{ id: "canvas", label: "Canvas", path: "/canvas" },
			{ id: "code", label: "Code", path: "/code" },
			{ id: "config", label: "Config", path: "/config" },
			{ id: "test-trace", label: "Test & trace", path: "/test-trace" },
			{ id: "deploy", label: "Deploy", path: "/deploy" },
			{ id: "about", label: "About", path: "/about" },
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
				title: "B",
				tab: { label: "B", path: "/b", order: 2 },
				routes: [{ path: "/b", component: Empty }],
				commands: [],
				capabilities: [],
			}),
			defineFeature({
				id: "a",
				title: "A",
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
	it("name only capabilities in the catalog the app uses (empty in P1b, so none)", () => {
		expect(unknownCapabilities(features, APP_CATALOG)).toEqual([]);
		expect(registry.capabilities).toEqual([]);
	});

	it("would fail on a capability the catalog lacks (the check can fail)", () => {
		const planted = defineFeature({
			id: "planted",
			title: "Planted",
			commands: [
				defineCommand({
					id: "planted.run",
					title: "Run",
					capability: "made.up.command",
					run: () => {},
				}),
			],
			capabilities: ["made.up.feature"],
		});
		expect(unknownCapabilities([planted], APP_CATALOG)).toEqual([
			"made.up.feature",
			"made.up.command",
		]);
		const knows: CapabilityCatalog = {
			has: (id) => id.startsWith("made.up."),
			get: () => undefined,
			status: () => "available",
		};
		expect(unknownCapabilities([planted], knows)).toEqual([]);
	});

	it("have unique feature ids and unique command ids", () => {
		const ids = features.map((feature) => feature.id);
		expect(new Set(ids).size).toBe(ids.length);
		const commandIds = registry.commands.map((command) => command.id);
		expect(new Set(commandIds).size).toBe(commandIds.length);
	});

	it("look a command up by id, and throw for one no manifest declares", () => {
		expect(registry.command("shell.toggleBottomPanel").shortcut).toBe("Mod+J");
		expect(() => registry.command("shell.nope")).toThrow(/shell\.nope/);
	});

	it("give runCommand the registry's commands", () => {
		expect(getCommands()).toEqual(registry.commands);
		expect(registry.commands.map((command) => command.id)).toContain(
			"shell.toggleBottomPanel",
		);
	});

	it("are refused by buildRegistry when two commands share an id, a command is outside its feature's namespace, two features share a path, or a tab has no route", () => {
		const command = defineCommand({ id: "a.one", title: "One", run: () => {} });
		const feature = (id: string, extra: object = {}) =>
			defineFeature({
				id,
				title: id,
				commands: [],
				capabilities: [],
				...extra,
			});
		expect(() =>
			buildRegistry([feature("a", { commands: [command, command] })]),
		).toThrow(/a\.one is declared twice/);
		// Feature b may not declare a.one, nor ab.one (the prefix is the id and a dot).
		expect(() =>
			buildRegistry([feature("b", { commands: [command] })]),
		).toThrow(/a\.one is declared by feature b/);
		const ab = defineCommand({ id: "ab.one", title: "One", run: () => {} });
		expect(() => buildRegistry([feature("a", { commands: [ab] })])).toThrow(
			/ab\.one is declared by feature a/,
		);
		expect(
			buildRegistry([
				feature("ab", {
					tab: { label: "AB", path: "/ab", order: 1 },
					routes: [{ path: "/ab", component: Empty }],
					commands: [ab],
				}),
			]).command("ab.one"),
		).toBe(ab);
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
				title: "A",
				tab: { label: "A", path: "/a", order: 1 },
				commands: [],
				capabilities: [],
			}),
		).toThrow(/\/a/);
		expect(() =>
			defineFeature({ id: "a", title: " ", commands: [], capabilities: [] }),
		).toThrow(/feature a: it has no title/);
	});
});

describe("Job ownership and show commands", () => {
	it("give every job kind in the contract exactly one owning feature", () => {
		const owners = new Map<string, string[]>();
		for (const feature of features)
			for (const kind of feature.jobs ?? [])
				owners.set(kind, [...(owners.get(kind) ?? []), feature.id]);
		const kinds = Object.keys(jobKinds);
		expect(kinds.length).toBeGreaterThan(0);
		for (const kind of kinds) {
			expect(owners.get(kind), `owners of ${kind}`).toHaveLength(1);
			expect(registry.ownerOfJob(kind)).toBe(owners.get(kind)?.[0]);
		}
		// And no manifest owns a kind the contract does not have.
		expect([...owners.keys()].filter((kind) => !kinds.includes(kind))).toEqual(
			[],
		);
	});

	it("map a kind to its declared owner and a feature to its declared show command, never by naming", () => {
		expect(registry.ownerOfJob("about.demoJob")).toBe("about");
		expect(registry.ownerOfJob("about.somethingElse")).toBeUndefined();
		expect(registry.showCommand("about")).toBe("about.show");
		expect(registry.showCommand("canvas")).toBeUndefined();
	});

	it("are refused when two features own one kind, or a show command is not the feature's", () => {
		const show = defineCommand({
			id: "a.show",
			title: "Show A",
			run: () => {},
		});
		const feature = (id: string, extra: object = {}) =>
			defineFeature({
				id,
				title: id,
				commands: [],
				capabilities: [],
				...extra,
			});
		expect(() =>
			buildRegistry([
				feature("a", { jobs: ["x.run"] }),
				feature("b", { jobs: ["x.run"] }),
			]),
		).toThrow(/features a and b both own job kind x\.run/);
		expect(() => feature("a", { jobs: ["x.run", "x.run"] })).toThrow(
			/listed twice/,
		);
		expect(() => feature("a", { show: "a.show" })).toThrow(
			/a\.show is not one of its commands/,
		);
		expect(() => feature("b", { show: "a.show", commands: [] })).toThrow(
			/not one of its commands/,
		);
		expect(feature("a", { show: "a.show", commands: [show] }).show).toBe(
			"a.show",
		);
		// A manifest not made by defineFeature is checked by the registry as well.
		expect(() =>
			buildRegistry([
				{
					id: "a",
					title: "A",
					commands: [],
					capabilities: [],
					show: "a.show",
				},
			]),
		).toThrow(/show command a\.show is not one of its commands/);
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
	it("never clash, on any platform, and leave Mod+K to the command palette and the native menu its accelerators", () => {
		for (const platform of SHORTCUT_PLATFORMS)
			expect(
				findShortcutClashes(registry.commands, platform),
				platform,
			).toEqual([]);
		expect(Object.keys(RESERVED_SHORTCUTS)).toContain("Mod+K");
		expect(NATIVE_MENU_SHORTCUTS.other).toContain("Control+R");
		expect(NATIVE_MENU_SHORTCUTS.mac).toContain("Meta+R");
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

	it("give Mod+K to shell.openCommandPalette, the command its reservation names", () => {
		expect(registry.command("shell.openCommandPalette").shortcut).toBe("Mod+K");
		expect(RESERVED_SHORTCUTS["Mod+K"]).toBe("shell.openCommandPalette");
		expect(registry.shortcutMap("other").get("Control+K")?.id).toBe(
			"shell.openCommandPalette",
		);
		expect(registry.shortcutMap("mac").get("Meta+K")?.id).toBe(
			"shell.openCommandPalette",
		);
	});
});

describe("the command palette's list", () => {
	it("has every command once, in manifest order, with its feature's title", () => {
		expect(registry.paletteCommands.map((entry) => entry.command)).toEqual(
			registry.commands,
		);
		for (const { command, featureTitle } of registry.paletteCommands) {
			const feature = features.find((f) => command.id.startsWith(`${f.id}.`));
			expect(featureTitle, command.id).toBe(feature?.title);
		}
		expect(
			registry.paletteCommands.find(
				(entry) => entry.command.id === "about.runDemoJob",
			)?.featureTitle,
		).toBe("About");
	});
});
