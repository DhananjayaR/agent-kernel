// The unsaved-changes guard (conventions-and-skills.md: "nothing is lost silently"). While `dirty`, the view's
// label is in the window's unsaved list (unsaved.ts: reload and close are refused through `beforeunload`, and
// main's quit rule names the label), and leaving the route is held by TanStack Router's blocker. The answer is the
// blocker's state: while `status` is "blocked", the view shows the unsaved-changes prompt (Task 17) and calls
// `proceed()` to leave or `reset()` to stay.
import { useBlocker } from "@tanstack/react-router";
import { useEffect } from "react";
import { unsavedWork } from "./unsaved";

export type UnsavedGuard = ReturnType<typeof useUnsavedBlocker>;

function useUnsavedBlocker(dirty: boolean) {
	return useBlocker({
		shouldBlockFn: () => true,
		disabled: !dirty,
		// unsaved.ts refuses the unload for the whole window, once; the router's own listener would be a second.
		enableBeforeUnload: false,
		withResolver: true,
	});
}

/** Registers `label` (e.g. "Config: session section") as unsaved while `dirty`, and guards leaving the route. */
export function useUnsavedGuard(label: string, dirty: boolean): UnsavedGuard {
	useEffect(() => {
		if (!dirty) return;
		return unsavedWork.add(label);
	}, [label, dirty]);
	return useUnsavedBlocker(dirty);
}
