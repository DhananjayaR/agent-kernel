// `cn` for the Studio's components: class-name joining and Tailwind conflict merging (shadcn's `cn` package),
// taught the custom theme keys from theme.css.
//
// Out of the box `cn` (like tailwind-merge) knows only Tailwind's default scales. With the Studio's tokens it
// merges wrongly (spike S1): it reads `text-ui` (a size) and `text-text` (a colour) as one group and drops the
// size, and keeps both `rounded-pill` and `rounded-control`. Each list below must name every key of its scale
// in theme.css; `utils.test.ts` reads theme.css and fails when one is missing.
//
// shadcn generates `import { cn } from "cn"` in every component it adds: point those at this file instead
// (a test fails while any component imports "cn" directly).
import { createCn } from "cn/config";

/** The custom theme keys, per `cn` theme scale, as declared in theme.css. */
export const THEME_KEYS = {
	text: [
		"ui-xs",
		"ui-sm",
		"ui",
		"ui-lg",
		"ui-xl",
		"ui-2xl",
		"ui-3xl",
		"heading",
	],
	radius: ["sm", "control", "card", "popover", "dialog", "pill"],
	spacing: [
		"control-s",
		"control-m",
		"control-l",
		"control-xl",
		"edge",
		"button-edge",
		"text-to-visual",
		"row",
		"row-compact",
		"topbar",
		"tab",
		"tab-gap",
		"cell",
		"popover",
		"dialog",
		"field-width",
		"dialog-m",
		"popover-s",
		"focus-ring",
		"focus-gap",
		"border-field",
		"tree-indent",
	],
	"font-weight": ["control", "action", "cta"],
	font: ["ui", "heading", "mono"],
	shadow: ["elevated"],
} as const;

const toMutable = (keys: readonly string[]): string[] => [...keys];

export const cn = createCn({
	extend: {
		theme: {
			text: toMutable(THEME_KEYS.text),
			radius: toMutable(THEME_KEYS.radius),
			spacing: toMutable(THEME_KEYS.spacing),
			"font-weight": toMutable(THEME_KEYS["font-weight"]),
			font: toMutable(THEME_KEYS.font),
			shadow: toMutable(THEME_KEYS.shadow),
		},
	},
});
