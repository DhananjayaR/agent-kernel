// Templates for `pnpm new:component <name>`: a presentational component of @ak-studio/ui and its stories (the
// component library's rules: role tokens only, no data access, no contract import, copy passed in as props).
// `n` is the component's names (lib.mjs's `namesOf`); `group` the Storybook group it is listed under.
import { comment } from "../lib.mjs";

export const component = (
	n,
) => `${comment(`${n.pascal}: a presentational component of @ak-studio/ui (no data access, no contract import; its copy comes in as props or children). It renders its children in a block that takes the usual HTML attributes. Each state it gains gets a story in ${n.kebab}.stories.tsx.`)}
import type { HTMLAttributes } from "react";
import { cn } from "../lib/utils";

export type ${n.pascal}Props = HTMLAttributes<HTMLDivElement>;

export function ${n.pascal}({ className, ...props }: ${n.pascal}Props) {
	return (
		<div
			data-slot="${n.kebab}"
			className={cn("text-ui text-text", className)}
			{...props}
		/>
	);
}
`;

export const stories = (
	n,
	group,
) => `${comment(`Storybook stories for ${n.pascal}, one per state (axe and both themes run on each).`)}
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { ${n.pascal} } from "./${n.kebab}";

const meta = {
	title: "${group}/${n.title}",
	component: ${n.pascal},
	args: { children: "${n.title}" },
} satisfies Meta<typeof ${n.pascal}>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The component with its children. */
export const Default: Story = {
	play: async ({ canvasElement }) => {
		const root = canvasElement.querySelector("[data-slot=${n.kebab}]");
		await expect(root).toHaveTextContent("${n.title}");
	},
};
`;
