// The background job notice's parts (P1b gate step 4): the tab state icons, and the one toast template in its three
// events. The icons on the app's tabs are in DesktopShell's At1220WithBadges and BadgesComeAndGo stories.
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useState } from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { backgroundJobNotice, JobTabIcon } from "./background-job-notice";
import {
	createToastQueue,
	notifyBackgroundResult,
	type ToastQueue,
	ToastRegion,
} from "./toast";

const meta = {
	title: "Patterns/Background job notice",
	component: JobTabIcon,
	args: { event: "waiting" },
} satisfies Meta<typeof JobTabIcon>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The tab icons: waiting, finished and failed differ by icon, not colour alone, and each has an accessible name
 * (visually hidden text, read with the tab's label).
 */
export const TabIcons: Story = {
	render: () => (
		<div className="flex items-center gap-4">
			<JobTabIcon event="waiting" />
			<JobTabIcon event="finished" />
			<JobTabIcon event="failed" />
		</div>
	),
	play: async ({ canvasElement }) => {
		const icons = [
			...canvasElement.querySelectorAll<HTMLElement>("[data-job-event]"),
		];
		await expect(icons.map((icon) => icon.textContent)).toEqual([
			"Needs your answer",
			"Finished",
			"Failed",
		]);
		const shapes = new Set(
			icons.map((icon) => icon.querySelector("svg")?.getAttribute("class")),
		);
		await expect(shapes.size).toBe(3);
	},
};

const show = fn();

/** A region with its own queue, so no toast leaks into the next story; the notices are added once on mount. */
function Notices() {
	const [queue] = useState<ToastQueue>(createToastQueue);
	useEffect(() => {
		notifyBackgroundResult(
			queue,
			backgroundJobNotice({
				event: "finished",
				jobTitle: "Apply",
				description: "Deployed to AWS ECS Fargate.",
				onShow: show,
			}),
		);
		notifyBackgroundResult(
			queue,
			backgroundJobNotice({
				event: "failed",
				jobTitle: "Apply",
				description: "terraform apply exited with code 1.",
				onShow: show,
			}),
		);
		notifyBackgroundResult(
			queue,
			backgroundJobNotice({
				event: "waiting",
				jobTitle: "Demo job",
				description: "Run the last step?",
				onShow: show,
			}),
		);
		return () => queue.clear();
	}, [queue]);
	return <ToastRegion queue={queue} />;
}

/**
 * The toast template: "{Job} finished" (success), "{Job} failed" (danger), "{Job} is waiting for you" (info), each
 * with "Show", which takes the person to the job. A toast with an action stays until dismissed.
 */
export const Toasts: Story = {
	render: () => <Notices />,
	beforeEach: () => {
		show.mockClear();
	},
	play: async () => {
		const toasts = await waitFor(() => {
			const found = within(document.body).getAllByRole("alertdialog");
			expect(found).toHaveLength(3);
			return found;
		});
		const byTitle = (title: string) =>
			toasts.find((toast) => toast.textContent?.includes(title)) as HTMLElement;
		await expect(byTitle("Apply finished")).toHaveAttribute(
			"data-tone",
			"success",
		);
		await expect(byTitle("Apply failed")).toHaveAttribute(
			"data-tone",
			"danger",
		);
		const waiting = byTitle("Demo job is waiting for you");
		await expect(waiting).toHaveAttribute("data-tone", "info");
		await expect(waiting).toHaveTextContent("Run the last step?");
		await userEvent.click(
			within(waiting).getByRole("button", { name: "Show" }),
		);
		await expect(show).toHaveBeenCalledOnce();
	},
};
