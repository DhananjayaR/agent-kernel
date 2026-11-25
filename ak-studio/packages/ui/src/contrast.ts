// WCAG 2 contrast ratio, used by the token story to report every role colour against every surface.

export type Rgb = readonly [number, number, number];

/** WCAG 2 relative luminance of an sRGB colour with 0-255 channels. */
export function relativeLuminance([r, g, b]: Rgb): number {
	const channel = (value: number): number => {
		const c = value / 255;
		return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
	};
	return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG 2 contrast ratio between two opaque colours, 1 to 21. */
export function contrastRatio(a: Rgb, b: Rgb): number {
	const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort(
		(x, y) => y - x,
	) as [number, number];
	return (hi + 0.05) / (lo + 0.05);
}

/** What a ratio allows: body text (4.5:1, WCAG AA), non-text and large text only (3:1), or neither. */
export type ContrastGrade = "text" | "non-text" | "fail";

export function gradeContrast(ratio: number): ContrastGrade {
	if (ratio >= 4.5) return "text";
	if (ratio >= 3) return "non-text";
	return "fail";
}

/** Parses `#rgb` or `#rrggbb`; returns null for anything else. */
export function parseHex(hex: string): Rgb | null {
	const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
	if (!m?.[1]) return null;
	const digits =
		m[1].length === 3 ? [...m[1]].map((d) => d + d).join("") : m[1];
	return [0, 2, 4].map((i) =>
		Number.parseInt(digits.slice(i, i + 2), 16),
	) as unknown as Rgb;
}
