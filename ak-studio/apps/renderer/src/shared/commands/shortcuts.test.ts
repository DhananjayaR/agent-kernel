// The shortcut model, with no DOM: how a manifest's shortcut ("Mod+J") resolves on each platform (Mod is Cmd on
// macOS and Ctrl elsewhere), how it is shown, how a key press is named so it can be looked up, which platform the
// app is on (the browser falls back to the navigator), and the clash check, platform by platform.
import { describe, expect, it } from "vitest";
import { defineCommand } from "./command";
import {
	describeShortcut,
	eventShortcut,
	findShortcutClashes,
	formatShortcut,
	parseShortcut,
	RESERVED_SHORTCUTS,
	resolveShortcut,
	SHORTCUT_PLATFORMS,
	shortcutPlatform,
} from "./shortcuts";

const press = (
	key: string,
	mods: Partial<{
		ctrlKey: boolean;
		metaKey: boolean;
		altKey: boolean;
		shiftKey: boolean;
		code: string;
	}> = {},
) => ({
	key,
	code: "",
	ctrlKey: false,
	metaKey: false,
	altKey: false,
	shiftKey: false,
	...mods,
});

const command = (id: string, shortcut?: string) =>
	defineCommand({ id, title: id, shortcut, run: () => {} });

describe("parseShortcut", () => {
	it("reads modifiers and one key, in any order of modifiers", () => {
		expect(parseShortcut("Mod+J")).toEqual({
			mod: true,
			ctrl: false,
			alt: false,
			shift: false,
			key: "J",
		});
		expect(parseShortcut("Shift+Mod+p")).toMatchObject({
			mod: true,
			shift: true,
			key: "P",
		});
		expect(parseShortcut("F6")).toMatchObject({ mod: false, key: "F6" });
	});

	it("refuses a shortcut with no key, two keys, an unknown or repeated modifier, both Mod and Ctrl, or Shift with punctuation", () => {
		for (const bad of [
			"Mod+Shift+/",
			"Shift+.",
			"",
			"Mod",
			"Mod+",
			"J+K",
			"Hyper+J",
			"Mod+Mod+J",
			"Mod+Ctrl+J",
			"Mod+Enterr",
		])
			expect(() => parseShortcut(bad), bad).toThrow();
	});
});

describe("resolveShortcut and formatShortcut", () => {
	it("makes Mod Cmd (Meta) on macOS and Ctrl (Control) elsewhere", () => {
		expect(resolveShortcut("Mod+J", "mac")).toBe("Meta+J");
		expect(resolveShortcut("Mod+J", "other")).toBe("Control+J");
		expect(resolveShortcut("Shift+Mod+K", "mac")).toBe("Shift+Meta+K");
		expect(resolveShortcut("Ctrl+Alt+J", "mac")).toBe("Control+Alt+J");
	});

	it("shows the shortcut in the platform's form", () => {
		expect(formatShortcut("Mod+J", "mac")).toBe("⌘J");
		expect(formatShortcut("Mod+J", "other")).toBe("Ctrl+J");
		expect(formatShortcut("Mod+Shift+Alt+K", "mac")).toBe("⌥⇧⌘K");
		expect(formatShortcut("Mod+Shift+Alt+K", "other")).toBe("Ctrl+Alt+Shift+K");
	});

	it("describes it for a tooltip and for aria-keyshortcuts", () => {
		expect(describeShortcut("Mod+J", "mac")).toEqual({
			label: "⌘J",
			aria: "Meta+J",
		});
		expect(describeShortcut("Mod+J", "other")).toEqual({
			label: "Ctrl+J",
			aria: "Control+J",
		});
	});
});

describe("eventShortcut", () => {
	it("names a key press the way a shortcut resolves, so it can be looked up", () => {
		expect(eventShortcut(press("j", { ctrlKey: true }))).toBe("Control+J");
		expect(eventShortcut(press("J", { metaKey: true, shiftKey: true }))).toBe(
			"Shift+Meta+J",
		);
		expect(eventShortcut(press("F6"))).toBe("F6");
	});

	it("reads the physical key when Option or the layout turns the letter into another character", () => {
		expect(
			eventShortcut(press("∆", { altKey: true, metaKey: true, code: "KeyJ" })),
		).toBe("Alt+Meta+J");
		expect(eventShortcut(press("о", { ctrlKey: true, code: "KeyJ" }))).toBe(
			"Control+J",
		);
	});

	it("keeps the typed letter over the physical key on a Latin layout (AZERTY's A is on the Q key)", () => {
		expect(eventShortcut(press("a", { ctrlKey: true, code: "KeyQ" }))).toBe(
			"Control+A",
		);
	});

	it("names nothing for a modifier pressed alone", () => {
		expect(eventShortcut(press("Control", { ctrlKey: true }))).toBeUndefined();
		expect(eventShortcut(press("Meta", { metaKey: true }))).toBeUndefined();
	});
});

describe("shortcutPlatform", () => {
	it("takes the platform app.info reports", () => {
		expect(shortcutPlatform("darwin")).toBe("mac");
		expect(shortcutPlatform("linux")).toBe("other");
		expect(shortcutPlatform("win32")).toBe("other");
	});

	it("asks the navigator in the browser, or before app.info answers", () => {
		expect(shortcutPlatform("browser", { platform: "MacIntel" })).toBe("mac");
		expect(shortcutPlatform("browser", { platform: "Linux x86_64" })).toBe(
			"other",
		);
		expect(shortcutPlatform("browser", { platform: "Win32" })).toBe("other");
		expect(
			shortcutPlatform("browser", {
				platform: "",
				userAgentData: { platform: "macOS" },
			}),
		).toBe("mac");
		expect(shortcutPlatform(undefined, { platform: "MacIntel" })).toBe("mac");
		expect(shortcutPlatform(undefined, undefined)).toBe("other");
	});
});

describe("findShortcutClashes", () => {
	it("fails two commands with one shortcut, on every platform", () => {
		const commands = [command("a.one", "Mod+J"), command("b.two", "Mod+J")];
		for (const platform of SHORTCUT_PLATFORMS)
			expect(findShortcutClashes(commands, platform)).toEqual([
				{
					shortcut: resolveShortcut("Mod+J", platform),
					ids: ["a.one", "b.two"],
				},
			]);
	});

	it("checks platform by platform: Mod+J and Ctrl+J clash only where Mod is Ctrl", () => {
		const commands = [command("a.one", "Mod+J"), command("b.two", "Ctrl+J")];
		expect(findShortcutClashes(commands, "mac")).toEqual([]);
		expect(findShortcutClashes(commands, "other")).toEqual([
			{ shortcut: "Control+J", ids: ["a.one", "b.two"] },
		]);
	});

	it("keeps Mod+K for the command palette: any other command taking it clashes", () => {
		expect(RESERVED_SHORTCUTS).toEqual({ "Mod+K": "shell.openCommandPalette" });
		for (const platform of SHORTCUT_PLATFORMS) {
			expect(
				findShortcutClashes([command("a.one", "Mod+K")], platform),
			).toEqual([
				{
					shortcut: resolveShortcut("Mod+K", platform),
					ids: ["shell.openCommandPalette", "a.one"],
				},
			]);
			expect(
				findShortcutClashes(
					[command("shell.openCommandPalette", "Mod+K")],
					platform,
				),
			).toEqual([]);
		}
	});

	it("passes commands with different shortcuts, or none", () => {
		const commands = [
			command("a.one", "Mod+J"),
			command("b.two", "Mod+Shift+J"),
			command("c.three"),
			command("d.four"),
		];
		for (const platform of SHORTCUT_PLATFORMS)
			expect(findShortcutClashes(commands, platform)).toEqual([]);
	});
});
