import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { Spinner } from "./spinner";

const meta = {
	title: "Display/Spinner",
	component: Spinner,
	args: { label: "Checking the toolchain" },
} satisfies Meta<typeof Spinner>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Static: always labelled, announced as a status. */
export const Default: Story = {
	play: async ({ canvasElement }) => {
		await expect(within(canvasElement).getByRole("status")).toHaveTextContent(
			"Checking the toolchain",
		);
	},
};

/** The label for assistive technology only, where the context already says it. */
export const HiddenLabel: Story = {
	args: { hideLabel: true },
	play: async ({ canvasElement }) => {
		await expect(within(canvasElement).getByRole("status")).toHaveTextContent(
			"Checking the toolchain",
		);
	},
};
