import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useState } from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import {
	expectFocusRing,
	expectNonTextContrastOnSurfaces,
	expectSolidLayer,
	expectTokenColour,
	tabTo,
} from "../lib/story-checks";
import { Button } from "./button";
import { Modal } from "./modal";
import {
	type BackgroundResult,
	createToastQueue,
	notifyBackgroundResult,
	type ToastQueue,
	ToastRegion,
} from "./toast";

const showResults = fn();

/** A region with its own queue, so no toast leaks into the next story; the toasts are added once on mount. */
function Harness({ results }: { results: BackgroundResult[] }) {
	const [queue] = useState<ToastQueue>(createToastQueue);
	useEffect(() => {
		for (const result of results) notifyBackgroundResult(queue, result);
		return () => queue.clear();
	}, [queue, results]);
	return (
		<>
			<Button>Before the toasts</Button>
			<ToastRegion queue={queue} />
		</>
	);
}

const tones: BackgroundResult[] = [
	{
		tone: "success",
		title: "Tests passed",
		description: "42 tests in 3.1 s",
		action: { label: "Show", onAction: showResults },
	},
	{ tone: "danger", title: "Deploy failed", description: "Open the run log." },
	{ tone: "info", title: "Environment synced" },
];

const meta = {
	title: "Overlays/Toast",
	component: Harness,
	args: { results: tones },
	beforeEach: () => {
		showResults.mockClear();
	},
} satisfies Meta<typeof Harness>;

export default meta;
type Story = StoryObj<typeof meta>;

const toasts = async () => {
	const region = await within(document.body).findByRole("region", {
		name: /notifications/i,
	});
	await waitFor(() =>
		expect(within(region).getAllByRole("alertdialog")).toHaveLength(3),
	);
	return { region, items: within(region).getAllByRole("alertdialog") };
};

/**
 * Three tones, each with its own icon and a coloured start edge (never colour alone), on the solid overlay
 * surface. The edges hold 3:1 on every surface.
 */
export const Tones: Story = {
	play: async () => {
		const { items } = await toasts();
		const icons = new Set<string>();
		for (const toast of items) {
			await expectSolidLayer(toast);
			await expect(getComputedStyle(toast).borderLeftWidth).toBe("4px");
			icons.add(toast.querySelector("svg")?.getAttribute("class") ?? "");
			const tone = toast.dataset.tone;
			if (tone !== "info")
				await expectNonTextContrastOnSurfaces(toast, "border-left-color");
		}
		await expect(icons.size).toBe(3);
		const success = items.find((t) => t.dataset.tone === "success");
		await expectTokenColour(
			success?.querySelector("svg") as Element,
			"color",
			"text-text-status-success",
		);
		await expect(success).toHaveAccessibleName(/Tests passed/);
	},
};

/**
 * Keyboard: F6 moves focus to the notifications region; Tab reaches a toast's action; Enter runs it and closes
 * the toast; focus moves on rather than being lost.
 */
export const Keyboard: Story = {
	play: async ({ canvasElement }) => {
		const before = within(canvasElement).getByRole("button", {
			name: "Before the toasts",
		});
		await tabTo(before);
		const { region } = await toasts();
		// F6 moves to the region, which shows the focus ring; Shift+F6 goes back.
		await userEvent.keyboard("{F6}");
		await waitFor(() => expect(region).toHaveFocus());
		await expectFocusRing(region);
		await userEvent.keyboard("{Shift>}{F6}{/Shift}");
		await waitFor(() => expect(before).toHaveFocus());
		await userEvent.keyboard("{F6}");
		await waitFor(() => expect(region).toHaveFocus());
		// Tab reaches a toast's action; Enter runs it and closes the toast; focus moves to the next toast.
		const show = within(region).getByRole("button", { name: "Show" });
		await tabTo(show);
		await expectFocusRing(show);
		await userEvent.keyboard("{Enter}");
		await expect(showResults).toHaveBeenCalledOnce();
		await waitFor(() =>
			expect(within(region).getAllByRole("alertdialog")).toHaveLength(2),
		);
		const next = document.activeElement as HTMLElement;
		await expect(next).toHaveAttribute("role", "alertdialog");
		await expectFocusRing(next);
		// Dismissing the rest: when the last toast closes, focus returns to where it was before F6.
		await userEvent.keyboard("{Tab}{Enter}");
		await waitFor(() =>
			expect(within(region).getAllByRole("alertdialog")).toHaveLength(1),
		);
		await userEvent.keyboard("{Tab}{Enter}");
		await waitFor(() => expect(before).toHaveFocus());
		await expect(showResults).toHaveBeenCalledOnce();
	},
};

/** A toast shown before a modal opens stays visible above the modal's scrim. */
export const AboveAModal: Story = {
	args: { results: [tones[1] as BackgroundResult] },
	render: (args) => (
		<>
			<Harness {...args} />
			<Modal
				defaultOpen
				title="Python environment"
				trigger={<Button>Show environment</Button>}
			>
				<p>The project runs on Python 3.12.</p>
			</Modal>
		</>
	),
	play: async () => {
		const region = await within(document.body).findByRole("region", {
			name: /notification/i,
		});
		const toast = within(region).getByRole("alertdialog");
		await within(document.body).findByRole("dialog");
		const box = toast.getBoundingClientRect();
		const top = document.elementFromPoint(
			box.left + box.width / 2,
			box.top + box.height / 2,
		);
		await expect(toast.contains(top)).toBe(true);
	},
};
