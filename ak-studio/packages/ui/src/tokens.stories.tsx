// Token story: every role colour against every surface, in dark and light, with the WCAG 2 contrast ratio
// computed here from the values theme.css actually resolves to. The values are provisional (P1a design gate);
// the story shows where they fall short instead of hiding it. Colour samples are drawn as bars, not text, so
// the accessibility check judges the story's own labels, which are always `text` on a surface.
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
const FOREGROUNDS = [
	"text",
	"text-muted",
	"accent-primary",
	"accent-ai",
	"status-success",
	"status-warning",
	"status-danger",
	"border-default",
] as const;
type Role = (typeof SURFACES)[number] | (typeof FOREGROUNDS)[number];

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
	for (const role of [...SURFACES, ...FOREGROUNDS]) {
		const value = style.getPropertyValue(`--role-${role}`).trim();
		out[role] = { value, rgb: toRgb(value) };
	}
	return out;
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
			className="rounded-popover border border-border-default bg-surface p-6 text-text"
		>
			<h2 id={`tokens-${theme}`} className="text-heading font-bold">
				{theme === "dark" ? "Dark" : "Light"}
			</h2>
			<table className="mt-4 border-collapse text-ui">
				<caption className="pb-2 text-left">
					Contrast of each role colour on each surface (WCAG 2). "text" is at
					least 4.5:1; "non-text only" is 3 to 4.5:1.
				</caption>
				<thead>
					<tr>
						<th scope="col" className="px-cell text-left">
							Role
						</th>
						{SURFACES.map((surface) => (
							<th key={surface} scope="col" className="px-cell text-left">
								on {surface}{" "}
								<span className="font-normal">{roles[surface]?.value}</span>
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{FOREGROUNDS.map((fg) => (
						<tr key={fg}>
							<th scope="row" className="px-cell text-left font-normal">
								{fg} <code>{roles[fg]?.value}</code>
							</th>
							{SURFACES.map((surface) => (
								<RatioCell
									key={surface}
									fg={fg}
									surface={surface}
									fgRgb={roles[fg]?.rgb ?? null}
									bgRgb={roles[surface]?.rgb ?? null}
								/>
							))}
						</tr>
					))}
				</tbody>
			</table>
		</section>
	);
}

function RatioCell(props: {
	fg: Role;
	surface: Role;
	fgRgb: Rgb | null;
	bgRgb: Rgb | null;
}) {
	const { fg, surface, fgRgb, bgRgb } = props;
	const ratio = fgRgb && bgRgb ? contrastRatio(fgRgb, bgRgb) : null;
	return (
		<td
			className="px-cell py-2"
			style={{ backgroundColor: `var(--role-${surface})` }}
			data-fg={fg}
			data-surface={surface}
			data-ratio={ratio?.toFixed(2)}
		>
			<div className="flex items-center gap-text-to-visual">
				<span
					aria-hidden="true"
					className="inline-block h-2 w-10 rounded-sm"
					style={{ backgroundColor: `var(--role-${fg})` }}
				/>
				<span>
					{ratio === null
						? "n/a"
						: `${ratio.toFixed(2)} ${GRADE_LABEL[gradeContrast(ratio)]}`}
				</span>
			</div>
		</td>
	);
}

const FONTS: ReadonlyArray<{
	name: string;
	variable: string;
	weights: number[];
}> = [
	{
		name: "Archivo",
		variable: "--font-family-archivo",
		weights: [400, 500, 700],
	},
	{ name: "Inter", variable: "--font-family-inter", weights: [400, 500, 700] },
	{
		name: "JetBrains Mono",
		variable: "--font-family-jetbrains-mono",
		weights: [400],
	},
];

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
				component: "Provisional values pending the P1a design gate.",
			},
		},
	},
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Colours: Story = {
	render: () => (
		<Stack>
			<h1 className="text-ui-3xl font-bold">
				Role colours (provisional: P1a design gate)
			</h1>
			<ThemePanel theme="dark" />
			<ThemePanel theme="light" />
		</Stack>
	),
	// The ratios come from the CSS as loaded (empty variables would give "n/a"), and the story's own labels,
	// `text` on each surface, must stay readable whatever the palette.
	play: async ({ canvasElement }) => {
		const cells = [...canvasElement.querySelectorAll("td[data-ratio]")];
		await expect(cells).toHaveLength(2 * FOREGROUNDS.length * SURFACES.length);
		for (const cell of cells) {
			const ratio = Number(cell.getAttribute("data-ratio"));
			await expect(ratio).toBeGreaterThanOrEqual(1);
			await expect(ratio).toBeLessThanOrEqual(21);
			if (cell.getAttribute("data-fg") === "text") {
				await expect(ratio).toBeGreaterThanOrEqual(4.5);
			}
		}
	},
};

export const Fonts: Story = {
	render: () => (
		<Stack>
			<h1 className="text-ui-3xl font-bold">Bundled fonts</h1>
			<p>Which family is used where waits for the P1a design gate.</p>
			{FONTS.map((font) => (
				<section key={font.name} aria-label={font.name}>
					<h2 className="text-ui-lg font-bold">{font.name}</h2>
					{font.weights.map((weight) => (
						<p
							key={weight}
							className="text-ui-xl"
							style={{
								fontFamily: `var(${font.variable})`,
								fontWeight: weight,
							}}
						>
							{weight}: Agent Kernel Studio 0123456789
						</p>
					))}
				</section>
			))}
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
				Sizes, spacing and radii (Spectrum 2 medium; provisional: P1a design
				gate)
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
