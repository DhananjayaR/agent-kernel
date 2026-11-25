import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
	clampWindowState,
	DEFAULT_SIZE,
	parseWindowState,
	type Rect,
	readWindowState,
	WINDOW_BACKGROUND,
	windowBackground,
	writeWindowState,
} from "./window";

const PRIMARY: Rect = { x: 0, y: 0, width: 1920, height: 1040 };
const RIGHT: Rect = { x: 1920, y: 0, width: 1280, height: 984 };

describe("parseWindowState", () => {
	it("accepts a full state and rounds it", () => {
		expect(
			parseWindowState({
				x: 10.4,
				y: 20.6,
				width: 1000,
				height: 700,
				isMaximized: true,
			}),
		).toEqual({ x: 10, y: 21, width: 1000, height: 700, isMaximized: true });
	});

	it("drops a partial position and treats a missing flag as not maximised", () => {
		expect(parseWindowState({ x: 5, width: 900, height: 600 })).toEqual({
			width: 900,
			height: 600,
			isMaximized: false,
		});
	});

	it.each([
		null,
		"x",
		{},
		{ width: "900", height: 600 },
		{ width: 0, height: 600 },
		{ width: Number.NaN, height: 600 },
		{ width: 900, height: Number.POSITIVE_INFINITY },
	])("rejects %j", (value) => {
		expect(parseWindowState(value)).toBeNull();
	});
});

describe("clampWindowState", () => {
	it("uses the default size, centred, when nothing is saved", () => {
		expect(clampWindowState(null, [PRIMARY])).toEqual({
			...DEFAULT_SIZE,
			isMaximized: false,
		});
	});

	it("keeps a state that fits its display", () => {
		const s = { x: 100, y: 50, width: 1000, height: 700, isMaximized: true };
		expect(clampWindowState(s, [PRIMARY, RIGHT])).toEqual(s);
	});

	it("keeps a window on a secondary display", () => {
		const s = { x: 2000, y: 100, width: 1000, height: 700, isMaximized: false };
		expect(clampWindowState(s, [PRIMARY, RIGHT])).toEqual(s);
	});

	it("centres on the primary display when the saved display is gone", () => {
		const s = { x: 2000, y: 100, width: 1000, height: 700, isMaximized: true };
		expect(clampWindowState(s, [PRIMARY])).toEqual({
			width: 1000,
			height: 700,
			isMaximized: true,
		});
	});

	it("moves a window hanging off the edge fully onto the display it overlaps most", () => {
		const s = {
			x: 1200,
			y: -200,
			width: 1000,
			height: 700,
			isMaximized: false,
		};
		expect(clampWindowState(s, [PRIMARY, RIGHT])).toEqual({
			x: 920,
			y: 0,
			width: 1000,
			height: 700,
			isMaximized: false,
		});
	});

	it("shrinks a window larger than its display to fit", () => {
		const s = { x: 0, y: 0, width: 4000, height: 3000, isMaximized: false };
		expect(clampWindowState(s, [PRIMARY])).toEqual({
			x: 0,
			y: 0,
			width: 1920,
			height: 1040,
			isMaximized: false,
		});
	});

	it("raises a too-small saved size to the minimum, and a small display caps it", () => {
		const tiny = { x: 0, y: 0, width: 100, height: 100, isMaximized: false };
		expect(clampWindowState(tiny, [PRIMARY])).toMatchObject({
			width: 800,
			height: 600,
		});
		const small: Rect = { x: 0, y: 0, width: 700, height: 500 };
		expect(clampWindowState(null, [small])).toEqual({
			width: 700,
			height: 500,
			isMaximized: false,
		});
	});

	it("respects a work area offset (taskbar at the top or left)", () => {
		const area: Rect = { x: 64, y: 32, width: 1856, height: 1048 };
		const s = { x: 0, y: 0, width: 1000, height: 700, isMaximized: false };
		expect(clampWindowState(s, [area])).toMatchObject({ x: 64, y: 32 });
	});
});

describe("readWindowState / writeWindowState", () => {
	let dir: string | undefined;
	afterEach(() => {
		if (dir) rmSync(dir, { recursive: true, force: true });
	});

	it("round-trips through the data folder, creating it if needed", () => {
		dir = mkdtempSync(join(tmpdir(), "ak-studio-window-"));
		const file = join(dir, "nested", "window-state.json");
		const s = { x: 1, y: 2, width: 1000, height: 700, isMaximized: false };
		writeWindowState(file, s);
		expect(readWindowState(file)).toEqual(s);
		expect(JSON.parse(readFileSync(file, "utf8"))).toEqual(s);
	});

	it("reads a missing or corrupt file as no state", () => {
		dir = mkdtempSync(join(tmpdir(), "ak-studio-window-"));
		expect(readWindowState(join(dir, "missing.json"))).toBeNull();
		const corrupt = join(dir, "corrupt.json");
		writeFileSync(corrupt, "{not json");
		expect(readWindowState(corrupt)).toBeNull();
	});
});

describe("windowBackground", () => {
	it("is the theme's surface colour", () => {
		expect(windowBackground(true)).toBe(WINDOW_BACKGROUND.dark);
		expect(windowBackground(false)).toBe(WINDOW_BACKGROUND.light);
	});

	it("matches --role-surface in the design tokens, so the first paint does not change colour", () => {
		const css = readFileSync(
			join(import.meta.dirname, "../../../../packages/ui/src/theme.css"),
			"utf8",
		);
		const surface = (selector: string) => {
			const start = css.indexOf(selector);
			const block = css.slice(start, css.indexOf("}", start));
			return /--role-surface:\s*(#[0-9a-f]{6})/i
				.exec(block)?.[1]
				?.toLowerCase();
		};
		expect(surface(':root,\n[data-theme="dark"]')).toBe(WINDOW_BACKGROUND.dark);
		expect(surface('[data-theme="light"] {')).toBe(WINDOW_BACKGROUND.light);
	});
});
