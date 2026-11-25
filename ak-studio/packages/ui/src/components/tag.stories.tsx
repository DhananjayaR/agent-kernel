import type { Meta, StoryObj } from "@storybook/react-vite";
import { IconBox } from "@tabler/icons-react";
import { expect } from "storybook/test";
import { expectHeight, expectStyle } from "../lib/story-checks";
import { Tag } from "./tag";

const meta = {
	title: "Display/Tag",
	component: Tag,
	args: { children: "OpenAI Agents SDK" },
} satisfies Meta<typeof Tag>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Static (no hover, focus or disabled state): 24 px, 8 px radius, 12 px text. */
export const Default: Story = {
	render: (args) => (
		<div className="flex flex-wrap gap-2">
			<Tag {...args} />
			<Tag>LangGraph</Tag>
			<Tag>CrewAI</Tag>
			<Tag icon={<IconBox aria-hidden="true" />}>redis extra</Tag>
		</div>
	),
	play: async ({ canvasElement }) => {
		const tags = canvasElement.querySelectorAll("[data-slot=tag]");
		await expect(tags).toHaveLength(4);
		for (const tag of tags) {
			await expectHeight(tag, 24);
			await expectStyle(tag, "border-top-left-radius", "8px");
			await expectStyle(tag, "font-size", "12px");
		}
	},
};

/** A long name is cut with an ellipsis inside its container. */
export const Truncated: Story = {
	args: { children: "Microsoft Agent Framework with Azure AI Foundry" },
	render: (args) => (
		<div className="w-field-width">
			<Tag {...args} />
		</div>
	),
};
