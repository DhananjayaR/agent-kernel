// State colours of the controls, decided in one place with an explicit precedence instead of by CSS order.
//
// Two state classes of equal specificity that set the same property (say `data-selected:bg-…` and
// `data-disabled:bg-…`) resolve by their order in the generated CSS, which nobody chooses; that hid real defects
// (a disabled switch that looked on). So each control's colours are a function of its React Aria render props,
// and the precedence is written down here and enumerated by `state.test.ts`:
//
//   1. disabled wins over everything (dedicated disabled colours; hover, press, selection and invalid are not shown);
//   2. invalid wins the border over focus, open, hover and selection;
//   3. read-only shows no hover or press change (it shows focus);
//   4. selection (selected or indeterminate) wins over hover for the edge; hover and press move a fill one stop.
//
// The class names are literal strings so Tailwind generates them.

export type ControlState = {
	hovered?: boolean;
	pressed?: boolean;
	focused?: boolean;
	selected?: boolean;
	indeterminate?: boolean;
	invalid?: boolean;
	disabled?: boolean;
	readOnly?: boolean;
	open?: boolean;
};

/**
 * A text field's box (Input, Textarea, Select trigger, Combobox group): border, text and placeholder colours.
 * Focus (or an open list) makes the border the text colour; hover strengthens it to text-muted.
 */
export function fieldBoxColours(s: ControlState): string {
	if (s.disabled) {
		return "border-disabled-border text-disabled-text placeholder:text-disabled-text";
	}
	const border = s.invalid
		? "border-text-status-danger"
		: s.focused || s.open
			? "border-text"
			: s.hovered && !s.readOnly
				? "border-text-muted"
				: "border-border-control";
	return `${border} text-text placeholder:text-text-muted`;
}

/** Colour of a Select's value text: muted while it shows the placeholder. */
export function fieldValueColour(
	s: ControlState & { placeholder?: boolean },
): string {
	if (s.disabled) return "text-disabled-text";
	return s.placeholder ? "text-text-muted" : "text-text";
}

/**
 * The indicator of a two-state control: a Checkbox's box or a Switch's track. When on (selected or
 * indeterminate) it fills with the primary (selection) colour and its edge is drawn in text-accent-primary, which
 * holds at least 3:1 on all three surfaces in both themes (the fill alone does not in light theme). The mark on
 * the fill is on-accent-primary.
 */
export function toggleIndicatorColours(s: ControlState): string {
	const on = Boolean(s.selected || s.indeterminate);
	if (s.disabled) {
		return on
			? "border-disabled-border bg-disabled-fill text-disabled-text"
			: "border-disabled-border bg-transparent text-disabled-text";
	}
	const live = !s.readOnly;
	const border = s.invalid
		? "border-text-status-danger"
		: on
			? "border-text-accent-primary"
			: s.hovered && live
				? "border-text-muted"
				: "border-border-control";
	const fill = on
		? (s.hovered || s.pressed) && live
			? "bg-accent-primary-hover"
			: "bg-accent-primary"
		: "bg-transparent";
	return `${border} ${fill} text-on-accent-primary`;
}

/** A Switch's thumb: on-accent-primary on the filled track, text-muted on the empty one. */
export function switchThumbColour(s: ControlState): string {
	if (s.disabled) return "bg-disabled-text";
	return s.selected ? "bg-on-accent-primary" : "bg-text-muted";
}

/**
 * A SegmentedControl segment. Selected: primary fill, text-accent-primary edge (the selection cue that holds 3:1
 * on every surface), on-accent-primary label. Unselected: transparent, a neutral fill on hover and press.
 */
export function segmentColours(s: ControlState): string {
	if (s.disabled) {
		return s.selected
			? "border-disabled-border bg-disabled-fill text-disabled-text"
			: "border-transparent bg-transparent text-disabled-text";
	}
	if (s.selected) {
		return `border-text-accent-primary ${s.hovered || s.pressed ? "bg-accent-primary-hover" : "bg-accent-primary"} text-on-accent-primary`;
	}
	const fill = s.pressed
		? "bg-fill-hover"
		: s.hovered
			? "bg-fill"
			: "bg-transparent";
	return `border-transparent ${fill} text-text`;
}

/** The label next to a Checkbox or Switch. */
export function toggleLabelColour(s: ControlState): string {
	return s.disabled ? "text-disabled-text" : "text-text";
}
