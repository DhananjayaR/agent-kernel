// Class recipes shared by the components, so one Spectrum 2 measurement lives in one place (spike S1 table in
// docs/specs/950-agent-kernel-studio/research/spike-s1-components.md; tokens in theme.css). React Aria sets the
// state attributes these read: data-hovered, data-pressed, data-focused, data-focus-visible, data-disabled,
// data-invalid, data-selected, data-readonly.

/** Hover and focus transitions: 150 ms, none under reduced motion. */
export const motion = "transition duration-150 motion-reduce:transition-none";

/**
 * A text field's box (TextField, Picker, ComboBox), shape only: 32 px, 2 px border, 8 px radius, 12 px edge
 * padding, 14 px text. Its colours per state come from `fieldBoxColours` (lib/state.ts); the focus ring from
 * `focus-ring` on the element React Aria marks.
 */
export const fieldBox = [
	"h-control-m w-full min-w-0 rounded-control border-2 bg-transparent px-edge text-ui outline-none",
	motion,
].join(" ");

/** A field's root (label, box, help text): Spectrum 2's default field width, 208 px. */
export const fieldRoot = "group/field flex w-field-width flex-col gap-1";

/** Field label: 12 px, medium weight, above the field. */
export const fieldLabel =
	"text-ui-sm font-action text-text-muted group-data-disabled/field:text-disabled-text";

/** Help text under a field. */
export const fieldDescription = "text-ui-sm text-text-muted";

/** Error text under a field: danger text with an icon, so it is never colour alone. */
export const fieldError =
	"flex items-center gap-text-to-visual text-ui-sm text-text-status-danger [&_svg]:size-4 [&_svg]:shrink-0";

/**
 * A floating layer (listbox, tooltip and, in the overlays dispatch, popover and menu): solid as in Spectrum 2
 * (decided in P0), overlay surface, 10 px radius, decorative hairline, elevated shadow, 8 px inner padding.
 */
export const floatingLayer =
	"rounded-popover border border-border-default bg-surface-overlay p-popover text-text shadow-elevated outline-none";

/** Entry and exit animation of a floating layer (tw-animate-css), none under reduced motion. */
export const floatingMotion =
	"data-entering:animate-in data-entering:fade-in-0 data-exiting:animate-out data-exiting:fade-out-0 motion-reduce:animate-none";

/**
 * A listbox or menu item: at least 32 px, 8 px radius, edge padding, the neutral fill on hover and keyboard
 * focus (only `text`-coloured content sits on it), an inset focus ring, disabled colours.
 */
export const listItem = [
	"relative flex min-h-control-m w-full cursor-default items-center gap-text-to-visual rounded-control px-edge",
	"text-ui text-text outline-none select-none",
	// Spectrum 2's next stop; the scale's 12% step stands in for the spike's 14% mix (no 14% step exists).
	"data-hovered:bg-fill-hover data-focused:bg-fill-hover",
	"data-focus-visible:outline-2 data-focus-visible:-outline-offset-2 data-focus-visible:outline-focus-ring",
	"data-disabled:text-disabled-text",
	"[&_svg]:size-4 [&_svg]:shrink-0",
].join(" ");
