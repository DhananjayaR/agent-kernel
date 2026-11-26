// Helpers for values a service did not build (a runner's result, a starter's info, a thrown error): copying
// them as plain data before they are stored, and describing a throw without throwing again. JobService and
// SessionService use them so that nothing a feature returns can break an event, a list or the terminal path.

/** `value` as plain data (a structured clone), or why it is not: a function, a symbol, a throwing getter. */
export function toData(
	value: unknown,
): { ok: true; value: unknown } | { ok: false; detail: string } {
	try {
		return { ok: true, value: structuredClone(value) };
	} catch (err) {
		return { ok: false, detail: describe(err) };
	}
}

/** A thrown value's message, or its string form; never throws itself. */
export function describe(err: unknown): string {
	try {
		return err instanceof Error ? err.message : String(err);
	} catch {
		return "an error that cannot be described";
	}
}
