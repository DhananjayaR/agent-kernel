import type { MenuItemConstructorOptions } from "electron";
import { describe, expect, it } from "vitest";
import { buildMenuTemplate } from "./menu";

function roles(items: MenuItemConstructorOptions[]): string[] {
	return items.flatMap((i) => [
		...(i.role ? [i.role] : []),
		...(Array.isArray(i.submenu) ? roles(i.submenu) : []),
	]);
}

describe("buildMenuTemplate", () => {
	it("has the macOS app menu only on macOS, Edit and View everywhere, and Help with About elsewhere", () => {
		const mac = buildMenuTemplate({ platform: "darwin", isPackaged: true });
		expect(mac.map((i) => i.role ?? i.label)).toEqual([
			"appMenu",
			"editMenu",
			"View",
		]);
		for (const platform of ["linux", "win32"] as const) {
			const menu = buildMenuTemplate({ platform, isPackaged: true });
			expect(menu.map((i) => i.role ?? i.label)).toEqual([
				"editMenu",
				"View",
				"help",
			]);
			expect(roles(menu)).toContain("about");
		}
	});

	it("uses only the roles whose accelerators the renderer reserves (NATIVE_MENU_SHORTCUTS in apps/renderer/src/shared/commands/shortcuts.ts)", () => {
		// A role added here brings its own accelerator: add it to NATIVE_MENU_SHORTCUTS, then to this list, so no
		// app command can take it.
		const used = new Set(
			(["darwin", "linux", "win32"] as const).flatMap((platform) =>
				roles(buildMenuTemplate({ platform, isPackaged: false })),
			),
		);
		expect([...used].sort()).toEqual([
			"about",
			"appMenu",
			"editMenu",
			"forceReload",
			"help",
			"reload",
			"resetZoom",
			"toggleDevTools",
			"togglefullscreen",
			"zoomIn",
			"zoomOut",
		]);
	});

	it("offers developer tools only in unpackaged builds", () => {
		for (const platform of ["darwin", "linux", "win32"] as const) {
			expect(
				roles(buildMenuTemplate({ platform, isPackaged: true })),
			).not.toContain("toggleDevTools");
			expect(
				roles(buildMenuTemplate({ platform, isPackaged: false })),
			).toContain("toggleDevTools");
		}
	});
});
