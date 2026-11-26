// SecretMasker: hides known secret values in text before it leaves a service: error messages and details (the
// registry) and stream output (StreamHub). Values arrive through `add` (from P4 the SecretStore calls it;
// until then tests and fakes do, ruling 10). Masking is plain text matching: a value split across two writes
// is not caught.

/** What a known value becomes. */
export const MASK = "••••";

/** Values shorter than this are not masked: too short to be a secret, too likely to match ordinary text. */
export const MIN_SECRET_LENGTH = 4;

export class SecretMasker {
	readonly #values = new Set<string>();

	/** Starts masking `value` (ignored when shorter than 4 characters). */
	add(value: string): void {
		if (value.length >= MIN_SECRET_LENGTH) this.#values.add(value);
	}

	/** Stops masking `value`. */
	remove(value: string): void {
		this.#values.delete(value);
	}

	/**
	 * Replaces each known value in `text` with "••••". Every occurrence of every value is found first, longest
	 * values first, and overlapping or nested occurrences are merged into one masked span, so no part of a
	 * secret shows when two secrets overlap.
	 */
	mask(text: string): string {
		if (this.#values.size === 0 || text.length === 0) return text;
		const spans: Array<[start: number, end: number]> = [];
		const longestFirst = [...this.#values].sort((a, b) => b.length - a.length);
		for (const value of longestFirst) {
			for (
				let at = text.indexOf(value);
				at !== -1;
				at = text.indexOf(value, at + 1)
			) {
				spans.push([at, at + value.length]);
			}
		}
		if (spans.length === 0) return text;
		spans.sort((a, b) => a[0] - b[0]);
		let out = "";
		let cursor = 0;
		let open: [number, number] | undefined;
		for (const span of spans) {
			if (open && span[0] <= open[1]) {
				open[1] = Math.max(open[1], span[1]);
				continue;
			}
			if (open) {
				out += MASK;
				cursor = open[1];
			}
			out += text.slice(cursor, span[0]);
			open = [span[0], span[1]];
		}
		if (open) {
			out += MASK;
			cursor = open[1];
		}
		return out + text.slice(cursor);
	}
}
