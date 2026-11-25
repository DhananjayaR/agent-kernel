import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { expectHeight, expectStyle } from "../lib/story-checks";
import { Badge } from "./badge";

const meta = {
	title: "Display/Badge",
	component: Badge,
	args: { children: "3" },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Static: a count on something else. One look; a state is a StatusChip. */
export const Default: Story = {
	render: (args) => (
		<div className="flex items-center gap-4">
			<span className="inline-flex items-center gap-text-to-visual">
				Problems <Badge {...args} />
			</span>
			<span className="inline-flex items-center gap-text-to-visual">
				Commands <Badge>128</Badge>
			</span>
		</div>
	),
	play: async ({ canvasElement }) => {
		const badges = canvasElement.querySelectorAll("[data-slot=badge]");
		for (const badge of badges) {
			await expectHeight(badge, 20);
			await expectStyle(badge, "border-top-left-radius", "9999px");
		}
		await expect(badges).toHaveLength(2);
	},
};
