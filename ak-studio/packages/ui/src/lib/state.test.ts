// Enumerates every combination of the states each control can be in at once and checks the precedence that
// state.ts promises. The stories check the resolved colours of the risky combinations in a browser, in both themes.
import { describe, expect, it } from "vitest";
import {
	type ControlState,
	fieldBoxColours,
	fieldValueColour,
	rowColours,
	rowEdgeColour,
	segmentColours,
	switchThumbColour,
	tabColour,
	tabIndicatorColour,
	toggleIndicatorColours,
} from "./state";

type Flag = keyof ControlState;

/** Every combination of `flags` set or unset (2^n states). */
function combinations(flags: Flag[]): ControlState[] {
	const out: ControlState[] = [];
	for (let mask = 0; mask < 1 << flags.length; mask += 1) {
		const state: ControlState = {};
		flags.forEach((flag, i) => {
			if (mask & (1 << i)) state[flag] = true;
		});
		out.push(state);
	}
	return out;
}

const tokens = (classes: string) => classes.split(" ");
const border = (classes: string) =>
	tokens(classes).find((t) => t.startsWith("border-"));
const fill = (classes: string) =>
	tokens(classes).find((t) => t.startsWith("bg-"));
const describeState = (s: ControlState) => Object.keys(s).join("+") || "rest";

/** Disabled shows only disabled colours (or transparent): no accent, danger, muted or hover stop. */
function expectOnlyDisabledColours(classes: string) {
	for (const token of tokens(classes)) {
		expect(token).toMatch(/disabled|transparent/);
	}
}

describe("field box (Input, Textarea, Select, Combobox)", () => {
	const states = combinations([
		"hovered",
		"focused",
		"open",
		"invalid",
		"disabled",
		"readOnly",
	]);
	for (const s of states) {
		it(describeState(s), () => {
			const classes = fieldBoxColours(s);
			if (s.disabled) return expectOnlyDisabledColours(classes);
			if (s.invalid)
				return expect(border(classes)).toBe("border-text-status-danger");
			if (s.focused || s.open)
				return expect(border(classes)).toBe("border-text");
			if (s.hovered && !s.readOnly)
				return expect(border(classes)).toBe("border-text-muted");
			expect(border(classes)).toBe("border-border-control");
		});
	}

	it("read-only never changes on hover", () => {
		for (const s of states) {
			expect(fieldBoxColours({ ...s, readOnly: true, hovered: true })).toBe(
				fieldBoxColours({ ...s, readOnly: true, hovered: false }),
			);
		}
	});

	it("a disabled placeholder uses the disabled text colour", () => {
		expect(fieldBoxColours({ disabled: true })).toContain(
			"placeholder:text-disabled-text",
		);
		expect(fieldValueColour({ disabled: true, placeholder: true })).toBe(
			"text-disabled-text",
		);
		expect(fieldValueColour({ placeholder: true })).toBe("text-text-muted");
	});
});

describe("toggle indicator (Checkbox box, Switch track)", () => {
	const states = combinations([
		"hovered",
		"pressed",
		"selected",
		"indeterminate",
		"invalid",
		"disabled",
		"readOnly",
	]);
	for (const s of states) {
		it(describeState(s), () => {
			const classes = toggleIndicatorColours(s);
			const on = s.selected || s.indeterminate;
			if (s.disabled) {
				expectOnlyDisabledColours(classes);
				expect(fill(classes)).toBe(on ? "bg-disabled-fill" : "bg-transparent");
				return;
			}
			expect(border(classes)).toBe(
				s.invalid
					? "border-text-status-danger"
					: on
						? "border-text-accent-primary"
						: s.hovered && !s.readOnly
							? "border-text-muted"
							: "border-border-control",
			);
			expect(fill(classes)).toBe(
				on
					? (s.hovered || s.pressed) && !s.readOnly
						? "bg-accent-primary-hover"
						: "bg-accent-primary"
					: "bg-transparent",
			);
		});
	}

	it("read-only never changes on hover or press", () => {
		for (const s of states) {
			const still = toggleIndicatorColours({
				...s,
				readOnly: true,
				hovered: false,
				pressed: false,
			});
			expect(
				toggleIndicatorColours({ ...s, readOnly: true, hovered: true }),
			).toBe(still);
			expect(
				toggleIndicatorColours({ ...s, readOnly: true, pressed: true }),
			).toBe(still);
		}
	});

	it("the switch thumb is disabled-coloured whenever disabled", () => {
		expect(switchThumbColour({ disabled: true, selected: true })).toBe(
			"bg-disabled-text",
		);
		expect(switchThumbColour({ selected: true })).toBe("bg-on-accent-primary");
		expect(switchThumbColour({})).toBe("bg-text-muted");
	});
});

describe("segment (SegmentedControl)", () => {
	const states = combinations(["hovered", "pressed", "selected", "disabled"]);
	for (const s of states) {
		it(describeState(s), () => {
			const classes = segmentColours(s);
			if (s.disabled) {
				expectOnlyDisabledColours(classes);
				expect(fill(classes)).toBe(
					s.selected ? "bg-disabled-fill" : "bg-transparent",
				);
				return;
			}
			if (s.selected) {
				expect(border(classes)).toBe("border-text-accent-primary");
				expect(fill(classes)).toBe(
					s.hovered || s.pressed
						? "bg-accent-primary-hover"
						: "bg-accent-primary",
				);
				expect(classes).toContain("text-on-accent-primary");
				return;
			}
			expect(fill(classes)).toBe(
				s.pressed ? "bg-fill-hover" : s.hovered ? "bg-fill" : "bg-transparent",
			);
		});
	}
});

describe("tab (Tabs)", () => {
	const states = combinations(["hovered", "pressed", "selected", "disabled"]);
	for (const s of states) {
		it(describeState(s), () => {
			const label = tabColour(s);
			const indicator = tabIndicatorColour(s);
			if (s.disabled) {
				expect(label).toBe("text-disabled-text");
				expect(indicator).toBe(s.selected ? "bg-disabled-text" : null);
				return;
			}
			expect(label).toBe(
				s.selected || s.hovered || s.pressed ? "text-text" : "text-text-muted",
			);
			expect(indicator).toBe(s.selected ? "bg-text-accent-primary" : null);
		});
	}
});

describe("row (DataTable, Tree)", () => {
	const states = combinations(["hovered", "pressed", "selected", "disabled"]);
	for (const s of states) {
		it(describeState(s), () => {
			const classes = rowColours(s);
			const edge = rowEdgeColour(s);
			if (s.disabled) {
				expectOnlyDisabledColours(classes);
				expect(edge).toBeNull();
				return;
			}
			expect(classes).toContain("text-text");
			expect(classes).not.toContain("muted");
			expect(fill(classes)).toBe(
				s.selected
					? s.hovered || s.pressed
						? "bg-fill-pressed"
						: "bg-fill-hover"
					: s.pressed
						? "bg-fill-hover"
						: s.hovered
							? "bg-fill"
							: "bg-transparent",
			);
			expect(edge).toBe(s.selected ? "bg-text-accent-primary" : null);
		});
	}
});
