// Planted for tools/check-classes.test.mjs: inline colour styles in every form the check reads.
import type { CSSProperties } from "react";

const swatch: CSSProperties = { width: 8, background: "var(--role-surface)" };
const ring = { outlineColor: "Highlight" } satisfies CSSProperties;

export function InlineColour({ el, tone }: { el: HTMLElement; tone: string }) {
	const [color, backgroundColor, stroke, padding] = [tone, tone, tone, 4];
	el.style.borderColor = tone;
	el.style.setProperty("background-color", tone);
	return (
		<div
			style={{
				padding: 4,
				backgroundColor: "var(--role-accent)",
			}}
		>
			<span style={{ color: "red" }} />
			<span style={{ ...swatch, ...ring }} />
			<svg fill="red" aria-hidden="true" />
			<Icon color="#fff" />
			<span style={tone ? { borderColor: tone } : undefined} />
			<span style={{ color }} />
			<span style={{ padding, backgroundColor }} />
			<span style={{ ...swatch, color }} />
			<span
				style={{
					// a comment before the key
					color: "red",
				}}
			/>
			<span style={{ ["fill"]: tone }} />
			{createElement("p", { style: { stroke } })}
		</div>
	);
}
