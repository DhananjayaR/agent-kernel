// The clock the shared patterns read (the job progress pattern's elapsed time). The app uses the wall clock; a test
// or a story passes its own `now` (a FakeClock's, or a fixed time) through ClockProvider, so the elapsed time can be
// frozen. While a pattern is active it re-renders once a second, so the time moves on.
import {
	createContext,
	type ReactNode,
	useContext,
	useEffect,
	useState,
} from "react";

/** Milliseconds since the epoch. */
export type Now = () => number;

const ClockContext = createContext<Now>(Date.now);

/** Replaces the wall clock below it (tests, stories). */
export function ClockProvider({
	now,
	children,
}: {
	now: Now;
	children: ReactNode;
}) {
	return <ClockContext.Provider value={now}>{children}</ClockContext.Provider>;
}

/** The time now; while `active`, re-renders every `intervalMs` so a shown time moves on. */
export function useNow(active: boolean, intervalMs = 1000): number {
	const now = useContext(ClockContext);
	const [, setTick] = useState(0);
	useEffect(() => {
		if (!active) return;
		const timer = setInterval(() => setTick((tick) => tick + 1), intervalMs);
		return () => clearInterval(timer);
	}, [active, intervalMs]);
	return now();
}
