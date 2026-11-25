import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { Button } from "./button";
import { InlineBanner } from "./inline-banner";

const meta = {
	title: "Display/Inline banner",
	component: InlineBanner,
	args: {
		tone: "info",
		title: "config.yaml changed on disk",
		children: "The Config tab now shows the file as it is on disk.",
		className: "w-dialog-m",
	},
} satisfies Meta<typeof InlineBanner>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Static: each tone has its own icon and edge (never colour alone). */
export const Default: Story = {
	render: (args) => (
		<div className="flex flex-col gap-3">
			<InlineBanner {...args} />
			<InlineBanner
				tone="warning"
				title="Opened read-only"
				className="w-dialog-m"
				actions={<Button variant="outline">Show upgrade command</Button>}
			>
				This project uses OAK 0.3.1. The Studio edits projects on 0.5 or later.
			</InlineBanner>
			<InlineBanner
				tone="danger"
				title="Cannot read app.py"
				className="w-dialog-m"
				actions={<Button variant="outline">Open file</Button>}
			>
				Line 14 has a syntax error. Fix it and the canvas updates.
			</InlineBanner>
			<InlineBanner
				tone="success"
				title="Toolchain ready"
				className="w-dialog-m"
			>
				Python 3.13 and uv are installed.
			</InlineBanner>
		</div>
	),
	play: async ({ canvasElement }) => {
		const banners = [
			...canvasElement.querySelectorAll("[data-slot=inline-banner]"),
		];
		await expect(banners).toHaveLength(4);
		const icons = new Set(
			banners.map((banner) =>
				banner.querySelector("svg")?.getAttribute("class"),
			),
		);
		await expect(icons.size).toBe(4);
		// Live regions: danger is an alert, the others are status messages.
		await expect(banners.map((banner) => banner.getAttribute("role"))).toEqual([
			"status",
			"status",
			"alert",
			"status",
		]);
		const danger = banners[2] as HTMLElement;
		await expect(getComputedStyle(danger).borderLeftWidth).toBe("4px");
		await expect(getComputedStyle(danger).borderLeftColor).not.toBe(
			getComputedStyle(danger).borderTopColor,
		);
	},
};

/** A banner shown with the view from the start can opt out of being announced. */
export const NotAnnounced: Story = {
	args: { role: "none" },
	play: async ({ canvasElement }) => {
		const banner = canvasElement.querySelector(
			"[data-slot=inline-banner]",
		) as HTMLElement;
		await expect(banner).not.toHaveAttribute("role");
	},
};
