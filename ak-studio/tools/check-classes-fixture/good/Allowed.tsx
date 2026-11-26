// For tools/check-classes.test.mjs: what the check must let through.
// - an arbitrary variant (data-[state=open]:) and a named group variant, not values;
// - React Aria's --trigger-width through the variable shorthand;
// - a style prop with no colour; neutral SVG colour attributes;
// - an object with a `color` key that is not a style (a variant map), and a comparison, not an assignment.
const variants = { color: "danger", tone: "quiet" };

export function Allowed({ el, inset }: { el: HTMLElement; inset: number }) {
	const same = el.style.color === "";
	return (
		<div
			className="data-[state=open]:bg-surface group-data-[open]/menu:text-text w-(--trigger-width) p-2"
			style={{ paddingInlineStart: inset }}
			data-variant={variants.color}
			data-same={same}
		>
			<svg fill="currentColor" stroke="none" aria-hidden="true" />
		</div>
	);
}
