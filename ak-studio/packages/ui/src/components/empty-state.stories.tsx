import type { Meta, StoryObj } from "@storybook/react-vite";
import { IconFolderOpen, IconListCheck } from "@tabler/icons-react";
import { expect, within } from "storybook/test";
import { Button } from "./button";
import { EmptyState } from "./empty-state";

const meta = {
	title: "Display/Empty state",
	component: EmptyState,
	args: {
		title: "No projects yet",
		description:
			"Open a folder that holds an Agent Kernel project to see its agents, code and configuration.",
		icon: <IconFolderOpen aria-hidden="true" />,
		action: (
			<>
				<Button variant="primary" icon={<IconFolderOpen aria-hidden="true" />}>
					Open folder
				</Button>
				<Button variant="outline">New project</Button>
			</>
		),
	},
} satisfies Meta<typeof EmptyState>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Says what the place is for and offers the first action. */
export const Default: Story = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(
			canvas.getByRole("heading", { level: 2, name: "No projects yet" }),
		).toBeVisible();
		await expect(
			canvas.getByRole("button", { name: "Open folder" }),
		).toBeVisible();
	},
};

/** No action where there is nothing to do, as in an empty Problems panel. */
export const WithoutAction: Story = {
	args: {
		title: "No problems",
		description: "Configuration and code errors in this project appear here.",
		icon: <IconListCheck aria-hidden="true" />,
		action: undefined,
		headingLevel: 3,
	},
};
