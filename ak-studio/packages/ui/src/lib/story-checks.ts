// Assertions shared by the component stories' play functions. Each state story proves it reached its state
// (React Aria's data attributes) and checks the Spectrum 2 measurement it is about, so a hover that did nothing
// cannot pass as a second default story. Used by *.stories.tsx only; not exported from the package.
import { expect, userEvent, waitFor } from "storybook/test";

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
 * is repeated until it holds for a moment.
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
