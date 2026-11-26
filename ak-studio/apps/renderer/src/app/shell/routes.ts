// The app tabs are routes (hash history): `#/canvas`, `#/code`, `#/config`, `#/test-trace`, `#/deploy`. Anything
// else opens the canvas.
import { type AppTabId, isAppTabId } from "@ak-studio/ui";

export const DEFAULT_TAB: AppTabId = "canvas";

/** The tab a location's pathname shows ("/code" is the Code tab; anything unknown is the canvas). */
export function tabFromPath(pathname: string): AppTabId {
	const segment = pathname.replace(/^\/+/, "").split("/")[0];
	return isAppTabId(segment) ? segment : DEFAULT_TAB;
}
