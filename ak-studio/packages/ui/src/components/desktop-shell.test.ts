// The shell's pure parts: the app tab ids and the copy placeholders. (The bottom panel's Mod+J is the app's command
// shell.toggleBottomPanel now; its key matching is tested in the renderer, shared/commands.)
import { describe, expect, it } from "vitest";
import { fillString, uiStrings } from "../strings";
import { BOTTOM_PANEL_TABS } from "./bottom-panel";
import { APP_TABS, isAppTabId } from "./desktop-shell";

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
