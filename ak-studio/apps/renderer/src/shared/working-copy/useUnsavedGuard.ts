// The two halves of the unsaved-changes guard (conventions-and-skills.md: "nothing is lost silently"), for
// patterns/UnsavedChangesGuard.tsx only (views mount that component, never these hooks):
// - `useUnsavedLabel`: while `dirty`, the view's label is in the window's unsaved list (unsaved.ts: reload and close
//   are refused through `beforeunload`, and main's quit rule names the label).
// - `useUnsavedBlocker`: TanStack Router's blocker, held by one guard for every unsaved view (patterns/
//   unsavedGuards.ts), so leaving asks once. Its state is the answer: while `status` is "blocked", the dialog shows
//   and the guard calls `proceed()` to leave or `reset()` to stay. It is the app's only router blocker (a test
//   checks), so a `proceed()` always navigates.
import { useBlocker } from "@tanstack/react-router";
import { useEffect } from "react";
import { unsavedWork } from "./unsaved";

/** One function for every render: a new one each render would re-register the blocker each render. */
const blockAlways = () => true;

/** Holds in-app navigation while `enabled`; its state is the answer (see the header). */
export function useUnsavedBlocker(enabled: boolean) {
	return useBlocker({
		shouldBlockFn: blockAlways,
		disabled: !enabled,
		// unsaved.ts refuses the unload for the whole window, once; the router's own listener would be a second.
		enableBeforeUnload: false,
		withResolver: true,
	});
}

/** Lists `label` in the window's unsaved list while `dirty` (refused reload and close; main's quit dialog). */
export function useUnsavedLabel(label: string, dirty: boolean): void {
	useEffect(() => {
		if (!dirty) return;
		return unsavedWork.add(label);
	}, [label, dirty]);
}
