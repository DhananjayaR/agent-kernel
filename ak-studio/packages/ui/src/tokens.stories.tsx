// Token story: every colour pair the design system promises, rendered as it is used, in dark and light, with
// the WCAG 2 contrast ratio computed here from the values theme.css actually resolves to.
//
// - Text: each text role on each surface, and each fill's on-fill text, is drawn as real 14 px text, so the
//   accessibility check (axe's color-contrast rule, run on every story by `pnpm test:storybook`) judges it in
//   both themes. The play function also asserts at least 4.5:1 for each.
// - Non-text: the control border and the focus ring on each surface are drawn as bars (axe does not check
//   WCAG 1.4.11); the play function asserts at least 3:1. The decorative divider is shown with no minimum.
import type { Meta, StoryObj } from "@storybook/react-vite";
import { type ReactNode, useLayoutEffect, useRef, useState } from "react";
import { expect } from "storybook/test";
import {
	type ContrastGrade,
	contrastRatio,
	gradeContrast,
	parseHex,
	type Rgb,
} from "./contrast";

type Theme = "dark" | "light";

const SURFACES = ["surface", "surface-raised", "surface-overlay"] as const;
const TEXT_ROLES = [
	"text",
	"text-muted",
	"text-accent-primary",
	"text-accent-ai",
	"text-status-success",
	"text-status-warning",
	"text-status-danger",
] as const;
const FILLS = [
	"accent-primary",
	"accent-ai",
	"status-success",
	"status-warning",
	"status-danger",
] as const;
const ON_FILLS = FILLS.map((fill) => `on-${fill}` as const);
// Hover and pressed fills of the filled buttons, each with the on-* text of its base fill.
const HOVER_FILLS = ["accent-primary-hover", "status-danger-hover"] as const;
const HOVER_ON: Record<
	(typeof HOVER_FILLS)[number],
	(typeof ON_FILLS)[number]
> = {
	"accent-primary-hover": "on-accent-primary",
	"status-danger-hover": "on-status-danger",
};
const FILL_PAIRS: readonly (readonly [Role, Role])[] = [
	...FILLS.map((fill) => [fill, `on-${fill}` as const] as const),
	...HOVER_FILLS.map((fill) => [fill, HOVER_ON[fill]] as const),
];
const NON_TEXT_ROLES = ["border-control", "focus-ring"] as const;
const DECORATIVE_ROLES = ["border-default"] as const;

type Role =
	| (typeof SURFACES)[number]
	| (typeof TEXT_ROLES)[number]
	| (typeof FILLS)[number]
	| (typeof ON_FILLS)[number]
	| (typeof HOVER_FILLS)[number]
	| (typeof NON_TEXT_ROLES)[number]
	| (typeof DECORATIVE_ROLES)[number];
const ROLES: readonly Role[] = [
	...SURFACES,
	...TEXT_ROLES,
	...FILLS,
	...ON_FILLS,
	...HOVER_FILLS,
	...NON_TEXT_ROLES,
	...DECORATIVE_ROLES,
];

const TEXT_MIN = 4.5;
const NON_TEXT_MIN = 3;

const GRADE_LABEL: Record<ContrastGrade, string> = {
	text: "text",
	"non-text": "non-text only",
	fail: "fails",
};

/** Any CSS colour to sRGB channels, through a 1x1 canvas (hex is parsed directly). */
function toRgb(color: string): Rgb | null {
	const hex = parseHex(color);
	if (hex) return hex;
	const ctx = document.createElement("canvas").getContext("2d");
	if (!ctx || !color) return null;
	// An invalid colour leaves fillStyle unchanged; starting from transparent makes that visible (as "n/a")
	// instead of reading the default black.
	ctx.fillStyle = "transparent";
	const before = ctx.fillStyle;
	ctx.fillStyle = color;
	if (ctx.fillStyle === before) return null;
	ctx.fillRect(0, 0, 1, 1);
	const [r = 0, g = 0, b = 0] = ctx.getImageData(0, 0, 1, 1).data;
	return [r, g, b];
}

type Resolved = Partial<Record<Role, { value: string; rgb: Rgb | null }>>;

/** Reads the role variables as resolved inside `el` (which carries data-theme). */
function readRoles(el: HTMLElement): Resolved {
	const style = getComputedStyle(el);
	const out: Resolved = {};
	for (const role of ROLES) {
		const value = style.getPropertyValue(`--role-${role}`).trim();
		out[role] = { value, rgb: toRgb(value) };
	}
	return out;
}

function ratioOf(roles: Resolved, a: Role, b: Role): number | null {
	const x = roles[a]?.rgb;
	const y = roles[b]?.rgb;
	return x && y ? contrastRatio(x, y) : null;
}

function describeRatio(ratio: number | null): string {
	return ratio === null
		? "n/a"
		: `${ratio.toFixed(2)}:1 ${GRADE_LABEL[gradeContrast(ratio)]}`;
}

/** A line's ratio against the 3:1 non-text minimum, or as decorative (no minimum). */
function describeLineRatio(
	ratio: number | null,
	kind: "non-text" | "decorative",
): string {
	if (ratio === null) return "n/a";
	const verdict =
		kind === "decorative"
			? "decorative"
			: ratio >= NON_TEXT_MIN
				? "meets 3:1"
				: "below 3:1";
	return `${ratio.toFixed(2)}:1 ${verdict}`;
}

/** Data attributes the play function reads: the pair, its kind and its ratio. */
function pairData(
	kind: "text" | "non-text" | "decorative",
	fg: Role,
	bg: Role,
	ratio: number | null,
) {
	return {
		"data-pair": kind,
		"data-fg": fg,
		"data-bg": bg,
		"data-ratio": ratio?.toFixed(2) ?? "n/a",
	};
}

function SurfaceHeaders({ roles }: { roles: Resolved }) {
	return (
		<thead>
			<tr>
				<th scope="col" className="px-cell text-left">
					Role
				</th>
				{SURFACES.map((surface) => (
					<th key={surface} scope="col" className="px-cell text-left">
						on {surface}{" "}
						<code className="font-normal">{roles[surface]?.value}</code>
					</th>
				))}
			</tr>
		</thead>
	);
}

function RoleHeader({ role, roles }: { role: Role; roles: Resolved }) {
	return (
		<th scope="row" className="px-cell text-left font-normal">
			{role} <code>{roles[role]?.value}</code>
		</th>
	);
}

function ThemePanel({ theme }: { theme: Theme }) {
	const ref = useRef<HTMLElement>(null);
	const [roles, setRoles] = useState<Resolved>({});
	// Layout effect: the values are in place before paint (and before the accessibility check runs).
	useLayoutEffect(() => {
		if (ref.current) setRoles(readRoles(ref.current));
	}, []);

	return (
		<section
			ref={ref}
			data-theme={theme}
			aria-labelledby={`tokens-${theme}`}
			className="flex flex-col gap-6 rounded-popover border border-border-default bg-surface p-6 text-text"
		>
			<h2 id={`tokens-${theme}`} className="text-heading font-bold">
				{theme === "dark" ? "Dark" : "Light"}
			</h2>

			<table className="border-collapse text-ui">
				<caption className="pb-2 text-left">
					Text roles on each surface, as 14 px text. Each must be at least
					4.5:1.
				</caption>
				<SurfaceHeaders roles={roles} />
				<tbody>
					{TEXT_ROLES.map((fg) => (
						<tr key={fg}>
							<RoleHeader role={fg} roles={roles} />
							{SURFACES.map((bg) => {
								const ratio = ratioOf(roles, fg, bg);
								return (
									<td
										key={bg}
										className="px-cell py-2"
										style={{ backgroundColor: `var(--role-${bg})` }}
									>
										<span
											style={{ color: `var(--role-${fg})` }}
											{...pairData("text", fg, bg, ratio)}
										>
											Sample text {describeRatio(ratio)}
										</span>
									</td>
								);
							})}
						</tr>
					))}
				</tbody>
			</table>

			<div>
				<h3 className="pb-2 text-ui-lg font-bold">
					Text on fills, and on the hovered primary and danger fills (button and
					badge labels; at least 4.5:1)
				</h3>
				<ul className="flex flex-wrap gap-cell">
					{FILL_PAIRS.map(([fill, on]) => {
						const ratio = ratioOf(roles, on, fill);
						return (
							<li key={fill}>
								<span
									className="inline-flex h-control-m items-center rounded-pill px-pill-edge"
									style={{
										backgroundColor: `var(--role-${fill})`,
										color: `var(--role-${on})`,
									}}
									{...pairData("text", on, fill, ratio)}
								>
									{on} on {fill} {describeRatio(ratio)}
								</span>
							</li>
						);
					})}
				</ul>
			</div>

			<table className="border-collapse text-ui">
				<caption className="pb-2 text-left">
					Lines on each surface. border-control and focus-ring must be at least
					3:1 (WCAG 1.4.11); border-default is a decorative divider with no
					minimum.
				</caption>
				<SurfaceHeaders roles={roles} />
				<tbody>
					{[...NON_TEXT_ROLES, ...DECORATIVE_ROLES].map((fg) => (
						<tr key={fg}>
							<RoleHeader role={fg} roles={roles} />
							{SURFACES.map((bg) => {
								const ratio = ratioOf(roles, fg, bg);
								const kind = (NON_TEXT_ROLES as readonly Role[]).includes(fg)
									? "non-text"
									: "decorative";
								return (
									<td
										key={bg}
										className="px-cell py-2"
										style={{ backgroundColor: `var(--role-${bg})` }}
										{...pairData(kind, fg, bg, ratio)}
									>
										<div className="flex items-center gap-text-to-visual">
											<span
												aria-hidden="true"
												className="inline-block h-2 w-10 rounded-sm"
												style={{ backgroundColor: `var(--role-${fg})` }}
											/>
											<span>{describeLineRatio(ratio, kind)}</span>
										</div>
									</td>
								);
							})}
						</tr>
					))}
				</tbody>
			</table>
		</section>
	);
}

const SIZE_TOKENS = [
	"--spacing-control-s",
	"--spacing-control-m",
	"--spacing-control-l",
	"--spacing-control-xl",
	"--spacing-edge",
	"--spacing-pill-edge",
	"--spacing-text-to-visual",
	"--spacing-row",
	"--spacing-row-compact",
	"--spacing-topbar",
	"--spacing-tab",
	"--spacing-tab-gap",
	"--spacing-cell",
	"--spacing-popover",
	"--spacing-dialog",
	"--spacing-focus-ring",
	"--spacing-focus-gap",
	"--spacing-border-field",
	"--radius-sm",
	"--radius-control",
	"--radius-table",
	"--radius-popover",
	"--radius-dialog",
	"--text-ui-xs",
	"--text-ui-sm",
	"--text-ui",
	"--text-ui-lg",
	"--text-ui-xl",
	"--text-ui-2xl",
	"--text-ui-3xl",
	"--text-heading",
] as const;

function Stack({ children }: { children: ReactNode }) {
	return <div className="flex flex-col gap-6">{children}</div>;
}

const meta = {
	title: "Design system/Tokens",
	parameters: {
		docs: {
			description: {
				component:
					"Tokens decided at the P1a design gate (25 November 2026): Agent Kernel's palette, Inter, Archivo and JetBrains Mono, Spectrum 2 medium density.",
			},
		},
	},
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Colours: Story = {
	render: () => (
		<Stack>
			<h1 className="text-ui-3xl font-bold">Role colours</h1>
			<ThemePanel theme="dark" />
			<ThemePanel theme="light" />
		</Stack>
	),
	// The ratios come from the CSS as loaded (an empty or invalid variable gives "n/a", which fails here).
	play: async ({ canvasElement }) => {
		const pairs = (kind: string) =>
			[...canvasElement.querySelectorAll(`[data-pair="${kind}"]`)].map(
				(el) => ({
					name: `${el.closest("[data-theme]")?.getAttribute("data-theme")} ${el.getAttribute("data-fg")} on ${el.getAttribute("data-bg")}`,
					ratio: Number(el.getAttribute("data-ratio")),
				}),
			);
		const text = pairs("text");
		const nonText = pairs("non-text");
		await expect(text).toHaveLength(
			2 * (TEXT_ROLES.length * SURFACES.length + FILL_PAIRS.length),
		);
		await expect(nonText).toHaveLength(
			2 * NON_TEXT_ROLES.length * SURFACES.length,
		);
		const below = (list: typeof text, min: number) =>
			list
				.filter((pair) => !(pair.ratio >= min))
				.map((pair) => `${pair.name}: ${pair.ratio}`);
		await expect(below(text, TEXT_MIN)).toEqual([]);
		await expect(below(nonText, NON_TEXT_MIN)).toEqual([]);
	},
};

const SAMPLE = "Agent Kernel Studio 0123456789";

export const Fonts: Story = {
	render: () => (
		<Stack>
			<h1 className="text-ui-3xl font-bold">Fonts</h1>
			<section aria-labelledby="font-ui" className="font-ui">
				<h2 id="font-ui" className="text-ui-lg font-bold">
					font-ui: Inter (UI and body text, button labels)
				</h2>
				{[400, 500, 700].map((weight) => (
					<p key={weight} className="text-ui" style={{ fontWeight: weight }}>
						{weight} at 14 px: {SAMPLE}
					</p>
				))}
			</section>
			<section aria-labelledby="font-heading">
				<h2 id="font-heading" className="text-ui-lg font-bold">
					font-heading: Archivo (headings, the default for h1 to h6)
				</h2>
				<p className="font-heading text-heading font-bold">
					Heading 22 px: {SAMPLE}
				</p>
				<p className="font-heading text-ui-xl font-bold">
					Heading 18 px: {SAMPLE}
				</p>
			</section>
			<section aria-labelledby="font-mono">
				<h2 id="font-mono" className="text-ui-lg font-bold">
					font-mono: JetBrains Mono (code, paths, identifiers, numbers)
				</h2>
				<p className="font-mono text-ui">src/agents/review.py run_7f3a2c</p>
				<p className="mono-figures text-ui">
					mono-figures (tabular): 1,204 tokens 12.5 s $0.42
				</p>
				<p className="mono-figures text-ui">
					mono-figures (tabular): 98,311 tokens 1.0 s $13.07
				</p>
			</section>
			<section aria-labelledby="font-control">
				<h2 id="font-control" className="text-ui-lg font-bold">
					Button labels at 14 px, 700: Inter (chosen) and Archivo (for
					comparison)
				</h2>
				<p className="font-ui text-ui font-control">
					Run agent Deploy Discard changes
				</p>
				<p className="font-heading text-ui font-control">
					Run agent Deploy Discard changes
				</p>
			</section>
		</Stack>
	),
};

function SizeRow({ token }: { token: (typeof SIZE_TOKENS)[number] }) {
	const ref = useRef<HTMLTableRowElement>(null);
	const [value, setValue] = useState("");
	useLayoutEffect(() => {
		if (ref.current)
			setValue(getComputedStyle(ref.current).getPropertyValue(token).trim());
	}, [token]);
	return (
		<tr ref={ref}>
			<th scope="row" className="px-cell text-left font-normal">
				<code>{token}</code>
			</th>
			<td className="px-cell">{value}</td>
			<td className="px-cell py-1">
				<span
					aria-hidden="true"
					className="block h-2 bg-accent-ai"
					style={{ width: `var(${token})` }}
				/>
			</td>
		</tr>
	);
}

export const Sizes: Story = {
	render: () => (
		<Stack>
			<h1 className="text-ui-3xl font-bold">
				Sizes, spacing and radii (Spectrum 2 medium, one density)
			</h1>
			<table className="border-collapse text-ui">
				<thead>
					<tr>
						<th scope="col" className="px-cell text-left">
							Token
						</th>
						<th scope="col" className="px-cell text-left">
							Value
						</th>
						<th scope="col" className="px-cell text-left">
							Length
						</th>
					</tr>
				</thead>
				<tbody>
					{SIZE_TOKENS.map((token) => (
						<SizeRow key={token} token={token} />
					))}
				</tbody>
			</table>
		</Stack>
	),
};
