// What the shell's app commands act on. The shell's state (the bottom panel's open state and its saving through
// `app.setLayout`) lives in the mounted Shell, so a command's `run` cannot reach it directly: the Shell binds its
// actions here while it is mounted (useBindShellActions), and the commands call them. Unbound (before app.info has
// answered, or with no shell), the commands' `when` is false: hidden, and their shortcuts do nothing.
import { useEffect, useLayoutEffect, useRef } from "react";

export interface ShellActions {
	toggleBottomPanel(): void;
}

let bound: ShellActions | undefined;

/** True while a Shell is mounted and has bound its actions. */
export function shellActionsBound(): boolean {
	return bound !== undefined;
}

/** The bound actions; throws if none are bound (a command's `when` keeps that from happening). */
export function shellActions(): ShellActions {
	if (!bound) throw new Error("no shell is mounted");
	return bound;
}

/** Binds the Shell's actions while it is mounted; each call reads the latest render's `actions`. */
export function useBindShellActions(actions: ShellActions): void {
	const latest = useRef(actions);
	useLayoutEffect(() => {
		latest.current = actions;
	});
	useEffect(() => {
		const mine: ShellActions = {
			toggleBottomPanel: () => latest.current.toggleBottomPanel(),
		};
		bound = mine;
		return () => {
			if (bound === mine) bound = undefined;
		};
	}, []);
}
