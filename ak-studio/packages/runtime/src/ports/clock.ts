// The Clock port: the time and the waits of feature services, so a service that works in steps or ticks (a job's
// one-second steps, a session's line a second) runs at full speed in tests. Browser-safe: `systemClock` uses only
// Date.now and setTimeout, so the desktop and the mock transport share it; tests use FakeClock (fakes.ts).

export interface Clock {
	/** Milliseconds since the epoch. */
	now(): number;
	/**
	 * Resolves after `ms` milliseconds. Rejects with the signal's reason as soon as `signal` aborts (or at once if it
	 * already has), so a cancelled job or a stopped session never waits out its step.
	 */
	sleep(ms: number, signal?: AbortSignal): Promise<void>;
}

/** The real clock. */
export const systemClock: Clock = Object.freeze({
	now: () => Date.now(),
	sleep: (ms: number, signal?: AbortSignal): Promise<void> =>
		new Promise<void>((resolve, reject) => {
			if (signal?.aborted) {
				reject(signal.reason);
				return;
			}
			const onAbort = (): void => {
				clearTimeout(handle);
				reject(signal?.reason);
			};
			const handle = setTimeout(() => {
				signal?.removeEventListener("abort", onAbort);
				resolve();
			}, ms);
			signal?.addEventListener("abort", onAbort, { once: true });
		}),
});
