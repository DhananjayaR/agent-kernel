// Moving to a feature's screen from an app command (the background job notice's "Show" runs the command the owning
// feature's manifest names as `show`, such as `about.show`). The router lives in app/, which features and shared/ cannot import, so the mounted
// Shell binds its navigate here while it is mounted, as it binds its shell actions (app/shell/shellActions.ts).
// Unbound (no shell), `canNavigate` is false: a command that navigates sets it as its `when`, so it is hidden and
// does nothing.

type Navigate = (path: string) => void;

let bound: Navigate | undefined;

/** Binds the router's navigate; returns the unbind. The Shell calls it while it is mounted. */
export function bindNavigate(navigate: Navigate): () => void {
	bound = navigate;
	return () => {
		if (bound === navigate) bound = undefined;
	};
}

/** True while a Shell has bound its navigate. */
export function canNavigate(): boolean {
	return bound !== undefined;
}

/** Shows the screen at `path` (a feature route: "/about"); throws if nothing is bound (a command's `when` prevents it). */
export function navigateTo(path: string): void {
	if (!bound) throw new Error("no shell is mounted to navigate");
	bound(path);
}
