// The shell's pure parts: the app tab ids, the bottom panel shortcut and the copy placeholders.
import { describe, expect, it } from "vitest";
import { fillString, uiStrings } from "../strings";
import { BOTTOM_PANEL_TABS, isBottomPanelShortcut } from "./bottom-panel";
import { APP_TABS, isAppTabId } from "./desktop-shell";

const key = (
	k: string,
	mods: Partial<{
		ctrlKey: boolean;
		metaKey: boolean;
		altKey: boolean;
		shiftKey: boolean;
	}>,
) => ({
	key: k,
	ctrlKey: false,
	metaKey: false,
	altKey: false,
	shiftKey: false,
	...mods,
});

describe("app tabs", () => {
	it("are the five areas, in order", () => {
		expect(APP_TABS).toEqual([
			"canvas",
			"code",
			"config",
			"test-trace",
			"deploy",
		]);
		expect(BOTTOM_PANEL_TABS).toEqual(["problems", "run-log", "commands"]);
	});

	it("recognises only their ids", () => {
		for (const id of APP_TABS) expect(isAppTabId(id)).toBe(true);
		for (const other of ["", "Canvas", "problems", 1, null, undefined])
			expect(isAppTabId(other)).toBe(false);
	});
});

describe("the bottom panel shortcut (Mod+J)", () => {
	it("matches Ctrl+J and Cmd+J, either case", () => {
		expect(isBottomPanelShortcut(key("j", { ctrlKey: true }))).toBe(true);
		expect(isBottomPanelShortcut(key("J", { metaKey: true }))).toBe(true);
	});

	it("does not match J alone or with Shift or Alt", () => {
		expect(isBottomPanelShortcut(key("j", {}))).toBe(false);
		expect(
			isBottomPanelShortcut(key("j", { ctrlKey: true, shiftKey: true })),
		).toBe(false);
		expect(
			isBottomPanelShortcut(key("j", { ctrlKey: true, altKey: true })),
		).toBe(false);
		expect(isBottomPanelShortcut(key("k", { ctrlKey: true }))).toBe(false);
	});
});

describe("fillString", () => {
	it("fills named placeholders and leaves unknown ones", () => {
		expect(fillString(uiStrings.runControl.runningOnPort, { port: 8000 })).toBe(
			"Running on port 8000",
		);
		expect(
			fillString(uiStrings.deployStatus.deployedAgo, { ago: "2 h ago" }),
		).toBe("Deployed 2 h ago");
		expect(fillString("{a} and {b}", { a: 1 })).toBe("1 and {b}");
	});
});
