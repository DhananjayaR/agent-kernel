// Window size, position and maximised state: saved to the app's data folder on close, restored on start and
// clamped to a visible display. No Electron value import: see security.ts.
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { BrowserWindow } from "electron";

export interface Rect {
	x: number;
	y: number;
	width: number;
	height: number;
}

export interface WindowState {
	/** Absent when the window should be centred by the system. */
	x?: number;
	y?: number;
	width: number;
	height: number;
	isMaximized: boolean;
}

/**
 * The window's background before the renderer paints (and behind it while resizing): the theme's surface colour,
 * `--role-surface` in packages/ui/src/theme.css (window.test.ts keeps the two equal). Without it a dark theme
 * opens with a white flash.
 */
export const WINDOW_BACKGROUND = { dark: "#011428", light: "#ffffff" } as const;

/**
 * The background for the theme main has applied: `nativeTheme.shouldUseDarkColors`, which follows the stored
 * preference (`themeSource`), and the system's setting for `system`.
 */
export function windowBackground(useDarkColors: boolean): string {
	return useDarkColors ? WINDOW_BACKGROUND.dark : WINDOW_BACKGROUND.light;
}

export const DEFAULT_SIZE = { width: 1280, height: 800 } as const;
// 1000 px wide: the compact top bar with the window controls (120 px) needs about 960 px (stories `At1000Compact`).
export const MIN_SIZE = { width: 1000, height: 600 } as const;
export const WINDOW_STATE_FILE = "window-state.json";

const isNum = (v: unknown): v is number =>
	typeof v === "number" && Number.isFinite(v);

/** Validates stored JSON; anything malformed yields null (the defaults are used instead). */
export function parseWindowState(value: unknown): WindowState | null {
	if (typeof value !== "object" || value === null) return null;
	const v = value as Record<string, unknown>;
	if (!isNum(v.width) || !isNum(v.height)) return null;
	if (v.width <= 0 || v.height <= 0) return null;
	const state: WindowState = {
		width: Math.round(v.width),
		height: Math.round(v.height),
		isMaximized: v.isMaximized === true,
	};
	if (isNum(v.x) && isNum(v.y)) {
		state.x = Math.round(v.x);
		state.y = Math.round(v.y);
	}
	return state;
}

function overlapArea(a: Rect, b: Rect): number {
	const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
	const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
	return w > 0 && h > 0 ? w * h : 0;
}

const clamp = (v: number, lo: number, hi: number): number =>
	Math.min(Math.max(v, lo), Math.max(lo, hi));

/**
 * Fits a saved state onto the current displays (their work areas; the first is the primary).
 * - No saved state: the default size, capped to the primary display, centred by the system.
 * - Saved position on no display (a monitor was removed): saved size, capped, centred.
 * - Otherwise: on the display it overlaps most, size capped to that display and moved fully inside it.
 */
export function clampWindowState(
	saved: WindowState | null,
	workAreas: readonly Rect[],
): WindowState {
	const primary = workAreas[0];
	const want = saved ?? { ...DEFAULT_SIZE, isMaximized: false };
	if (!primary) return { ...want };
	const sizeFor = (area: Rect) => ({
		width: clamp(want.width, Math.min(MIN_SIZE.width, area.width), area.width),
		height: clamp(
			want.height,
			Math.min(MIN_SIZE.height, area.height),
			area.height,
		),
	});
	if (want.x === undefined || want.y === undefined) {
		return { ...sizeFor(primary), isMaximized: want.isMaximized };
	}
	const rect = { x: want.x, y: want.y, width: want.width, height: want.height };
	let best: Rect | undefined;
	let bestArea = 0;
	for (const area of workAreas) {
		const a = overlapArea(rect, area);
		if (a > bestArea) {
			best = area;
			bestArea = a;
		}
	}
	if (!best) return { ...sizeFor(primary), isMaximized: want.isMaximized };
	const size = sizeFor(best);
	return {
		x: clamp(want.x, best.x, best.x + best.width - size.width),
		y: clamp(want.y, best.y, best.y + best.height - size.height),
		...size,
		isMaximized: want.isMaximized,
	};
}

export function readWindowState(file: string): WindowState | null {
	try {
		return parseWindowState(JSON.parse(readFileSync(file, "utf8")));
	} catch {
		return null;
	}
}

/** Writes atomically (temp file, then rename) so a crash mid-write cannot leave a corrupt file. */
export function writeWindowState(file: string, state: WindowState): void {
	mkdirSync(dirname(file), { recursive: true });
	const tmp = `${file}.tmp`;
	writeFileSync(tmp, `${JSON.stringify(state)}\n`, "utf8");
	renameSync(tmp, file);
}

/** Saves the window's normal (un-maximised) bounds and maximised flag when it closes. */
export function persistWindowState(win: BrowserWindow, file: string): void {
	win.on("close", () => {
		const b = win.getNormalBounds();
		try {
			writeWindowState(file, { ...b, isMaximized: win.isMaximized() });
		} catch (err) {
			console.warn(`[studio] could not save window state: ${String(err)}`);
		}
	});
}
