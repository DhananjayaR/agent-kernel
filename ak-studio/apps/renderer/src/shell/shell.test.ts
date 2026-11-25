// The shell's wiring that needs no DOM: tab routes, the copy that names each phase, and the panel bounds the
// design system and the contract must agree on.
import { BOTTOM_PANEL_HEIGHT, DEFAULT_SHELL_LAYOUT } from "@ak-studio/contract";
import {
	APP_TABS,
	BOTTOM_PANEL_MAX_HEIGHT,
	BOTTOM_PANEL_MIN_HEIGHT,
	BOTTOM_PANEL_TABS,
} from "@ak-studio/ui";
import { describe, expect, it } from "vitest";
import { DEFAULT_TAB, tabFromPath } from "./routes";
import { panelEmptyStates, tabEmptyStates } from "./strings";

describe("tab routes", () => {
	it("maps each tab's path to the tab", () => {
		for (const tab of APP_TABS) {
			expect(tabFromPath(`/${tab}`)).toBe(tab);
			expect(tabFromPath(`/${tab}/`)).toBe(tab);
		}
	});

	it("opens the canvas for the root and for anything unknown", () => {
		expect(DEFAULT_TAB).toBe("canvas");
		for (const path of ["/", "", "/nope", "/Canvas", "/problems"])
			expect(tabFromPath(path)).toBe("canvas");
	});
});

describe("empty states", () => {
	it("name the phase that fills each tab (later-phases.md, P3.md)", () => {
		const phases = {
			canvas: ["P3"],
			code: ["P3"],
			config: ["P3"],
			"test-trace": ["P8", "P9"],
			deploy: ["P10"],
		} as const;
		for (const tab of APP_TABS) {
			for (const phase of phases[tab])
				expect(tabEmptyStates[tab].description).toContain(phase);
		}
	});

	it("name the phase that fills each bottom panel view", () => {
		const phases = { problems: "P3", "run-log": "P8", commands: "P2" } as const;
		for (const tab of BOTTOM_PANEL_TABS)
			expect(panelEmptyStates[tab].description).toContain(phases[tab]);
	});

	it("have final copy: sentence case titles, no placeholder text", () => {
		const copy = [
			...Object.values(tabEmptyStates),
			...Object.values(panelEmptyStates),
		];
		for (const { title, description } of copy) {
			expect(title.slice(1)).toBe(title.slice(1).toLowerCase());
			expect(`${title} ${description}`).not.toMatch(
				/\[|TODO|lorem|placeholder/i,
			);
		}
	});
});

describe("copy", () => {
	it("names the coding agent feature Claude Agent (copy rules)", async () => {
		const { shellStrings } = await import("./strings");
		expect(shellStrings.buildWithAI.description).toMatch(/^Claude Agent /);
		expect(JSON.stringify(shellStrings)).not.toMatch(/coding agent/i);
	});
});

describe("panel bounds", () => {
	it("agree between the design system and the contract", () => {
		expect(BOTTOM_PANEL_MIN_HEIGHT).toBe(BOTTOM_PANEL_HEIGHT.min);
		expect(BOTTOM_PANEL_MAX_HEIGHT).toBe(BOTTOM_PANEL_HEIGHT.max);
		expect(DEFAULT_SHELL_LAYOUT.bottomPanel.height).toBeGreaterThanOrEqual(
			BOTTOM_PANEL_MIN_HEIGHT,
		);
	});
});
