// Keeping focus when the control that had it goes away (conventions-and-skills.md, focus: "never lost to the page
// body"). A pattern whose buttons disappear as its state changes (an approval answered, a job that ends and loses
// its "Stop") would otherwise drop focus to <body>. The container remembers that focus was inside it; when `key`
// changes and focus has fallen to the body, the container itself takes it (it needs tabIndex -1).
import { type RefObject, useLayoutEffect, useRef } from "react";

/**
 * Returns a ref for the container. Focus moving inside marks it; focus moving to another element outside clears
 * the mark. A removal (no related target) keeps it, so after `key` changes a container whose focused child went
 * away takes focus back, but only when nothing else has it.
 */
export function useKeepFocus<T extends HTMLElement>(
	key: unknown,
): RefObject<T | null> {
	const ref = useRef<T>(null);
	const within = useRef(false);
	useLayoutEffect(() => {
		const el = ref.current;
		if (!el) return;
		const onIn = () => {
			within.current = true;
		};
		const onOut = (event: FocusEvent) => {
			const next = event.relatedTarget;
			if (next instanceof Node && !el.contains(next)) within.current = false;
		};
		el.addEventListener("focusin", onIn);
		el.addEventListener("focusout", onOut);
		return () => {
			el.removeEventListener("focusin", onIn);
			el.removeEventListener("focusout", onOut);
		};
	}, []);
	// biome-ignore lint/correctness/useExhaustiveDependencies: runs when the state named by `key` changes
	useLayoutEffect(() => {
		const el = ref.current;
		if (!el || !within.current) return;
		const active = el.ownerDocument.activeElement;
		if (active === null || active === el.ownerDocument.body) el.focus();
	}, [key]);
	return ref;
}
