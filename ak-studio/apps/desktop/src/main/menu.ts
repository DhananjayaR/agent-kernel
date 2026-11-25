// Application menu: the macOS app menu, then Edit and View everywhere, and on Linux and Windows a Help menu whose
// About item names the app (macOS has it in the app menu). The About panel's text is set in index.ts
// (`app.setAboutPanelOptions`). Developer tools only in unpackaged builds. No Electron value import: see
// security.ts.
import type { MenuItemConstructorOptions } from "electron";

export function buildMenuTemplate(options: {
	platform: NodeJS.Platform;
	isPackaged: boolean;
}): MenuItemConstructorOptions[] {
	const view: MenuItemConstructorOptions[] = [
		{ role: "reload" },
		{ role: "forceReload" },
		...(options.isPackaged
			? []
			: [{ role: "toggleDevTools" } satisfies MenuItemConstructorOptions]),
		{ type: "separator" },
		{ role: "resetZoom" },
		{ role: "zoomIn" },
		{ role: "zoomOut" },
		{ type: "separator" },
		{ role: "togglefullscreen" },
	];
	return [
		...(options.platform === "darwin"
			? [{ role: "appMenu" } satisfies MenuItemConstructorOptions]
			: []),
		{ role: "editMenu" },
		{ label: "View", submenu: view },
		...(options.platform === "darwin"
			? []
			: [
					{
						role: "help",
						submenu: [{ role: "about" }],
					} satisfies MenuItemConstructorOptions,
				]),
	];
}
