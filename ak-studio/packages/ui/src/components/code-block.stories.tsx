import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { expectFocusRing, hover, tabTo } from "../lib/story-checks";
import { CodeBlock } from "./code-block";

const meta = {
	title: "Display/Code block",
	component: CodeBlock,
	args: {
		label: "Upgrade command",
		code: 'uv add "agentkernel[openai]>=0.6"',
		onCopy: fn(),
		className: "w-dialog-m",
	},
} satisfies Meta<typeof CodeBlock>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
	play: async ({ canvasElement }) => {
		const pre = canvasElement.querySelector("pre") as HTMLElement;
		await expect(getComputedStyle(pre).fontFamily).toContain("JetBrains Mono");
		await expect(
			within(canvasElement).getByRole("button", {
				name: "Copy code",
			}),
		).toHaveAccessibleDescription("Upgrade command");
		// The focusable scroll region is named by the caption.
		await expect(
			within(canvasElement).getByRole("region", { name: "Upgrade command" }),
		).toHaveAttribute("tabindex", "0");
	},
};

/** Several lines, wider than the block: it scrolls sideways and can be focused to scroll by keyboard. */
export const Long: Story = {
	args: {
		label: "config.yaml",
		onCopy: undefined,
		code: [
			"session:",
			"  type: redis",
			"  redis:",
			"    url: redis://localhost:6379/0  # set AK_SESSION__REDIS__URL to override this value in each environment",
			"    ttl: 604800",
		].join("\n"),
	},
};

export const Hover: Story = {
	play: async ({ canvasElement }) => {
		const copy = within(canvasElement).getByRole("button", {
			name: "Copy code",
		});
		// React Aria shows a tooltip on hover only in pointer modality (earlier stories may have left keyboard).
		await userEvent.click(canvasElement);
		await hover(copy);
		await expect(
			await within(document.body).findByRole("tooltip"),
		).toHaveTextContent("Copy code");
	},
};

/** Keyboard focus: the copy button, then the code itself (so it can be scrolled). */
export const Focus: Story = {
	play: async ({ canvasElement }) => {
		const copy = within(canvasElement).getByRole("button", {
			name: "Copy code",
		});
		await tabTo(copy);
		await expectFocusRing(copy);
		await userEvent.tab();
		const region = within(canvasElement).getByRole("region", {
			name: "Upgrade command",
		});
		await expect(region).toHaveFocus();
		await expect(getComputedStyle(region).outlineStyle).toBe("solid");
	},
};

export const Copy: Story = {
	play: async ({ args, canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(canvas.getByRole("button", { name: "Copy code" }));
		await expect(args.onCopy).toHaveBeenCalledWith(args.code);
		await waitFor(() =>
			expect(canvas.getByRole("status")).toHaveTextContent("Code copied"),
		);
	},
};
