// The unsaved-changes guard (conventions-and-skills.md: "nothing is lost silently"). While `dirty`, the view's
// label is in the window's unsaved list (unsaved.ts: reload and close are refused through `beforeunload`, and
// main's quit rule names the label), and leaving the route is held by TanStack Router's blocker. The answer is the
// blocker's state: while `status` is "blocked", the view shows the unsaved-changes prompt and calls `proceed()` to
// leave or `reset()` to stay.
//
// The two halves are exported apart for patterns/UnsavedChangesGuard.tsx, where every dirty view lists its label
// but only one guard holds the blocker, so leaving with several unsaved views asks once, naming them all.
import { useBlocker } from "@tanstack/react-router";
import { useEffect } from "react";
import { unsavedWork } from "./unsaved";

export type UnsavedGuard = ReturnType<typeof useUnsavedBlocker>;

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

/** Registers `label` (e.g. "Config: session section") as unsaved while `dirty`, and guards leaving the route. */
export function useUnsavedGuard(label: string, dirty: boolean): UnsavedGuard {
	useUnsavedLabel(label, dirty);
	return useUnsavedBlocker(dirty);
}
