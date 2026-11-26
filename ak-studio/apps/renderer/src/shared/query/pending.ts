// The automatic pending state (conventions-and-skills.md, feedback timing; architecture.md, the contract): no
// indicator for a call under 300 ms, then a pending state until it settles. Applied by the shared hooks, not
// chosen per screen. The clock belongs to one call: a new call restarts it, even when it starts in the same
// update the last one settled in (so the flag never turned false in between).
import { useEffect, useState } from "react";

/** How long a call runs before its pending state shows. */
export const PENDING_DELAY_MS = 300;

/**
 * True once the call `call` has stayed `active` for `delayMs`; false again in the same render that `active` turns
 * false or `call` changes. `call` identifies the call (a fetch's promise, a mutation's `submittedAt`, a save
 * counter): the timer is started for one call and counts only for it. `undefined` means "not known yet" (a query's
 * first render, before its fetch has started): a timer started then counts for the call it finds in flight.
 */
export function usePendingAfter(
	active: boolean,
	call: unknown,
	delayMs: number = PENDING_DELAY_MS,
): boolean {
	const [lateFor, setLateFor] = useState<{ call: unknown } | undefined>();
	useEffect(() => {
		if (!active) {
			setLateFor(undefined);
			return;
		}
		const timer = setTimeout(() => setLateFor({ call }), delayMs);
		return () => clearTimeout(timer);
	}, [active, call, delayMs]);
	// Compared in render: a timer that fired for an earlier call never shows for this one.
	return (
		active &&
		lateFor !== undefined &&
		(lateFor.call === undefined || Object.is(lateFor.call, call))
	);
}
