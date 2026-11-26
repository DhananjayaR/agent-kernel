// The app tabs are routes (hash history): `#/canvas`, `#/code`, `#/config`, `#/test-trace`, `#/deploy`, from the
// feature manifests through the registry. Anything else opens the first tab, the canvas.
import { registry } from "../registry";

/** The tab `#/` and unknown paths open. */
export const DEFAULT_TAB: string = registry.defaultTab.id;

/** The tab a location's pathname shows ("/code" is the Code tab; anything unknown is the default tab). */
export function tabFromPath(pathname: string): string {
	const segment = `/${pathname.replace(/^\/+/, "").split("/")[0] ?? ""}`;
	return registry.tabs.find((tab) => tab.path === segment)?.id ?? DEFAULT_TAB;
}

/** The route path of the tab with `id` (the default tab's for an unknown id). */
export function pathOfTab(id: string): string {
	return (
		registry.tabs.find((tab) => tab.id === id)?.path ?? registry.defaultTab.path
	);
}
