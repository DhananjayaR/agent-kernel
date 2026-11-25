import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { expectStyle } from "../lib/story-checks";
import { Badge } from "./badge";
import { Button } from "./button";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "./card";
import { PathChip } from "./path-chip";
import { StatusChip } from "./status-chip";
import { Tag } from "./tag";

const meta = {
	title: "Display/Card",
	component: Card,
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Static container on the raised surface (no hover, focus or disabled state of its own; its controls have
 * theirs). Here as a recent project, the way P2's welcome screen lists them.
 */
export const Default: Story = {
	render: () => (
		<Card className="w-dialog-m">
			<CardHeader>
				<CardTitle>claude</CardTitle>
				<CardDescription>Agent Kernel 0.6.2, opened 2 days ago</CardDescription>
				<CardAction>
					<StatusChip status="passed" label="Ready" />
				</CardAction>
			</CardHeader>
			<CardContent>
				<PathChip path="examples/api/claude/app.py" />
				<div className="flex flex-wrap gap-2">
					<Tag>Claude Agent SDK</Tag>
					<Tag>FastAPI</Tag>
				</div>
			</CardContent>
			<CardFooter>
				<span className="mr-auto inline-flex items-center gap-text-to-visual text-text-muted">
					Problems <Badge>2</Badge>
				</span>
				<Button variant="ghost">Remove from list</Button>
				<Button variant="primary">Open project</Button>
			</CardFooter>
		</Card>
	),
	play: async ({ canvasElement }) => {
		const card = canvasElement.querySelector("[data-slot=card]") as HTMLElement;
		await expectStyle(card, "border-top-left-radius", "16px");
		await expectStyle(card, "padding-left", "16px");
		await expect(
			within(card).getByRole("heading", { level: 3, name: "claude" }),
		).toBeVisible();
	},
};
