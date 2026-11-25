import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { expectHeight } from "../lib/story-checks";
import { type Status, StatusChip } from "./status-chip";

const meta = {
	title: "Display/Status chip",
	component: StatusChip,
	args: { status: "passed" },
} satisfies Meta<typeof StatusChip>;

export default meta;
type Story = StoryObj<typeof meta>;

const STATUSES: Status[] = [
	"passed",
	"running",
	"waiting",
	"failed",
	"not-set-up",
];

/**
 * Static: every state, each with its own icon and label (never colour alone). 24 px pills. The spinner of
 * "running" stops under reduced motion.
 */
export const Default: Story = {
	render: () => (
		<div className="flex flex-wrap gap-2">
			{STATUSES.map((status) => (
				<StatusChip key={status} status={status} />
			))}
		</div>
	),
	play: async ({ canvasElement }) => {
		const chips = [
			...canvasElement.querySelectorAll("[data-slot=status-chip]"),
		];
		await expect(chips.map((chip) => chip.textContent)).toEqual([
			"Passed",
			"Running",
			"Waiting",
			"Failed",
			"Not set up",
		]);
		const icons = new Set<string>();
		for (const chip of chips) {
			await expectHeight(chip, 24);
			const icon = chip.querySelector("svg");
			await expect(icon).not.toBeNull();
			icons.add(icon?.getAttribute("class") ?? "");
		}
		// Five different icons: the state reads without colour.
		await expect(icons.size).toBe(5);
	},
};

/** A more specific label in the same meaning, as P2's toolchain check uses it. */
export const Relabelled: Story = {
	render: () => (
		<div className="flex flex-wrap gap-2">
			<StatusChip status="passed" label="Found" />
			<StatusChip status="not-set-up" label="Missing" />
			<StatusChip status="failed" label="Wrong version" />
		</div>
	),
};
