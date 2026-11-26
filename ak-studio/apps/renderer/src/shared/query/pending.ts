// The automatic pending state (conventions-and-skills.md, feedback timing; architecture.md, the contract): no
// indicator for a call under 300 ms, then a pending state until it settles. Applied by the shared hooks, not
// chosen per screen.
import { useEffect, useState } from "react";

/** How long a call runs before its pending state shows. */
export const PENDING_DELAY_MS = 300;

/** True once `active` has stayed true for `delayMs`; false again in the same render that `active` turns false. */
export function usePendingAfter(
	active: boolean,
	delayMs: number = PENDING_DELAY_MS,
): boolean {
	const [late, setLate] = useState(false);
	useEffect(() => {
		if (!active) {
			setLate(false);
			return;
		}
		const timer = setTimeout(() => setLate(true), delayMs);
		return () => clearTimeout(timer);
	}, [active, delayMs]);
	return active && late;
}
