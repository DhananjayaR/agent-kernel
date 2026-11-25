// Assertions shared by the component stories' play functions. Each state story proves it reached its state
// (React Aria's data attributes) and checks the Spectrum 2 measurement it is about, so a hover that did nothing
// cannot pass as a second default story. Used by *.stories.tsx only; not exported from the package.
import { expect, userEvent, waitFor } from "storybook/test";
import { contrastRatio, type Rgb } from "../contrast";

/** Waits until `el` and its descendants have no running transition or animation (150 ms state changes). */
export async function settle(el: Element): Promise<void> {
	await waitFor(() =>
		expect(
			el
				.getAnimations({ subtree: true })
				.filter((a) => a.playState === "running"),
		).toHaveLength(0),
	);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Moves the pointer onto `el`, checks React Aria marked it hovered, and waits for the transition to end.
 *
 * In the test run the real (Playwright) cursor rests somewhere over the story, and Chromium sends trusted
 * pointerover/pointerenter events to whatever is under it when the page changes under it, a little later. If
 * one lands after the simulated hover, React Aria ends the hover (the pointer "moved" elsewhere). So the hover
 * is repeated until it holds for a moment. Driving the real pointer instead (`userEvent.hover` from
 * `vitest/browser`) was tried in fix round 1 and failed 17 of 178 tests in one run: the real cursor stays where
 * the previous story left it, so a story can mount already hovered or lose the hover to the next story's
 * layout, and Storybook's own UI has no real-pointer API to share the code with.
 */
export async function hover(el: Element): Promise<void> {
	for (let attempt = 0; attempt < 5; attempt += 1) {
		await sleep(100);
		await userEvent.hover(el);
		await sleep(150);
		if (el.hasAttribute("data-hovered")) break;
	}
	await expect(el).toHaveAttribute("data-hovered");
	await settle(el);
}

/**
 * Moves the pointer onto `el` without expecting a hover state: for read-only and disabled controls, which React
 * Aria does not mark hovered. Use it to check that nothing changes.
 */
export async function pointerOver(el: Element): Promise<void> {
	await sleep(100);
	await userEvent.hover(el);
	await sleep(150);
	await settle(el);
}

/** Presses Tab until `el` (or an element inside it) has focus; fails after `max` presses. */
export async function tabTo(el: Element, max = 20): Promise<void> {
	for (let i = 0; i < max; i += 1) {
		await userEvent.tab();
		if (el.contains(document.activeElement)) return;
	}
	throw new Error(`Tab never reached ${el.outerHTML.slice(0, 80)}`);
}

/** The Spectrum 2 focus indicator: 2 px solid ring in the focus colour, 2 px from the element. */
export async function expectFocusRing(el: Element): Promise<void> {
	await waitFor(() => expect(el).toHaveAttribute("data-focus-visible"));
	await settle(el);
	const style = getComputedStyle(el);
	await expect(style.outlineStyle).toBe("solid");
	await expect(style.outlineWidth).toBe("2px");
	await expect(style.outlineOffset).toBe("2px");
}

/** The focus indicator of an item inside a list, menu, table or tree: 2 px solid, drawn 2 px inside its edge. */
export async function expectInsetFocusRing(el: Element): Promise<void> {
	await waitFor(() => expect(el).toHaveAttribute("data-focus-visible"));
	await settle(el);
	const style = getComputedStyle(el);
	await expect(style.outlineStyle).toBe("solid");
	await expect(style.outlineWidth).toBe("2px");
	await expect(style.outlineOffset).toBe("-2px");
}

/** No focus indicator (for example after a pointer click on a text field). */
export async function expectNoFocusRing(el: Element): Promise<void> {
	await settle(el);
	await expect(el).not.toHaveAttribute("data-focus-visible");
	await expect(getComputedStyle(el).outlineStyle).toBe("none");
}

/** The rendered height in CSS pixels. */
export async function expectHeight(el: Element, px: number): Promise<void> {
	await expect(el.getBoundingClientRect().height).toBe(px);
}

/** A computed style property, e.g. expectStyle(el, "border-top-left-radius", "8px"). */
export async function expectStyle(
	el: Element,
	property: string,
	value: string,
): Promise<void> {
	await expect(getComputedStyle(el).getPropertyValue(property)).toBe(value);
}

/** Disabled by dedicated colours, not by opacity (Spectrum 2). */
export async function expectDisabledLook(el: Element): Promise<void> {
	await expect(el).toHaveAttribute("data-disabled");
	await expect(getComputedStyle(el).opacity).toBe("1");
}

/**
 * Checks that `property` of `el` resolves to the same colour as the token utility `utility` (for example
 * "bg-disabled-fill") in the same theme, by measuring a probe beside `el`. Proves which of two state classes
 * that set the same property actually won.
 */
export async function expectTokenColour(
	el: Element,
	property: "background-color" | "color" | "border-top-color" | "outline-color",
	utility: string,
): Promise<void> {
	await settle(el);
	const probe = document.createElement("span");
	probe.className = utility;
	(el.parentElement ?? document.body).appendChild(probe);
	const expected = getComputedStyle(probe).getPropertyValue(property);
	probe.remove();
	await expect(getComputedStyle(el).getPropertyValue(property)).toBe(expected);
}

function rgbOf(value: string): Rgb {
	const m = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/.exec(value);
	if (!m) throw new Error(`not a computed sRGB colour: ${value}`);
	return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/**
 * Checks that the colour of `property` on `el` holds at least 3:1 (WCAG 1.4.11, non-text) against each of the
 * three surfaces of the current theme, measured with probes beside `el`.
 */
export async function expectNonTextContrastOnSurfaces(
	el: Element,
	property:
		| "background-color"
		| "border-top-color"
		| "border-left-color"
		| "color",
): Promise<void> {
	await settle(el);
	const colour = rgbOf(getComputedStyle(el).getPropertyValue(property));
	const ratios: Record<string, number> = {};
	for (const surface of [
		"bg-surface",
		"bg-surface-raised",
		"bg-surface-overlay",
	]) {
		const probe = document.createElement("span");
		probe.className = surface;
		(el.parentElement ?? document.body).appendChild(probe);
		const ground = rgbOf(getComputedStyle(probe).backgroundColor);
		probe.remove();
		ratios[surface] = Math.round(contrastRatio(colour, ground) * 100) / 100;
	}
	for (const ratio of Object.values(ratios)) {
		await expect(ratio, JSON.stringify(ratios)).toBeGreaterThanOrEqual(3);
	}
}

/** Checks a text field's placeholder colour against the token utility `utility` (a `text-*` class). */
export async function expectPlaceholderColour(
	input: Element,
	utility: string,
): Promise<void> {
	const probe = document.createElement("span");
	probe.className = utility;
	(input.parentElement ?? document.body).appendChild(probe);
	const expected = getComputedStyle(probe).color;
	probe.remove();
	await expect(getComputedStyle(input, "::placeholder").color).toBe(expected);
}

/**
 * A floating layer is solid (decided in P0): the overlay surface, fully opaque, no backdrop blur, and the
 * measured elevated shadow. `el` is the layer itself (it may be portalled to <body>; the theme is on <html>).
 */
export async function expectSolidLayer(el: Element): Promise<void> {
	await settle(el);
	await expectTokenColour(el, "background-color", "bg-surface-overlay");
	const style = getComputedStyle(el);
	await expect(style.opacity).toBe("1");
	await expect(style.backdropFilter).toBe("none");
	const probe = document.createElement("span");
	probe.className = "shadow-elevated";
	(el.parentElement ?? document.body).appendChild(probe);
	const shadow = getComputedStyle(probe).boxShadow;
	probe.remove();
	await expect(style.boxShadow).toBe(shadow);
}

/** Waits until focus is on `el` or inside it (focus moves after an overlay's entry or exit animation). */
export async function expectFocusWithin(el: Element): Promise<void> {
	await waitFor(() => expect(el.contains(document.activeElement)).toBe(true));
}

/**
 * The colour `top` (any CSS colour, possibly translucent) composited over the opaque `bottom`, as sRGB. For an
 * opaque colour, `composite(c, c)` resolves it to sRGB.
 */
export function composite(top: string, bottom: string): Rgb {
	const canvas = document.createElement("canvas");
	canvas.width = 1;
	canvas.height = 1;
	const ctx = canvas.getContext("2d");
	if (!ctx) throw new Error("no 2D canvas");
	ctx.fillStyle = bottom;
	ctx.fillRect(0, 0, 1, 1);
	ctx.fillStyle = top;
	ctx.fillRect(0, 0, 1, 1);
	const [r = 0, g = 0, b = 0] = ctx.getImageData(0, 0, 1, 1).data;
	return [r, g, b];
}

/** The resolved colour of a token utility (for example "bg-surface"), measured on a probe in `near`'s context. */
export function tokenColour(
	near: Element,
	utility: string,
	property: "background-color" | "color" = "background-color",
): string {
	const probe = document.createElement("span");
	probe.className = utility;
	(near.parentElement ?? document.body).appendChild(probe);
	const value = getComputedStyle(probe).getPropertyValue(property);
	probe.remove();
	return value;
}
