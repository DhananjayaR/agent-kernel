import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { Skeleton } from "./skeleton";

const meta = {
	title: "Display/Skeleton",
	component: Skeleton,
} satisfies Meta<typeof Skeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Static stand-in for a recent-projects row while it loads; the region carries aria-busy. */
export const Default: Story = {
	render: () => (
		<section
			aria-busy="true"
			aria-label="Recent projects"
			className="flex w-dialog-m flex-col gap-2"
		>
			<Skeleton className="h-5 w-1/3" />
			<Skeleton className="w-2/3" />
			<Skeleton className="h-control-s w-1/2 rounded-pill" />
		</section>
	),
	play: async ({ canvasElement }) => {
		for (const bar of canvasElement.querySelectorAll("[data-slot=skeleton]")) {
			await expect(bar).toHaveAttribute("aria-hidden", "true");
		}
	},
};
