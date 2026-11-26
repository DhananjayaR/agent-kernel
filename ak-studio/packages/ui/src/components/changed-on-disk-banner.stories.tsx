// ChangedOnDiskBanner's states (P1b gate step 4, design gate row (c)): with no working copy an info banner that can be
// dismissed; with a conflicting copy a warning banner with "Keep mine" and "Take theirs", and "Compare" only when a
// compare view exists; "Keep mine" saving; floating at the top of a canvas; and the keyboard.
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { expectFocusRing, tabTo } from "../lib/story-checks";
import { ChangedOnDiskBanner } from "./changed-on-disk-banner";

const meta = {
	title: "Patterns/Changed on disk",
	component: ChangedOnDiskBanner,
	args: {
		file: "src/support/config.yaml",
		conflict: false,
		onDismiss: fn(),
	},
	render: (args) => (
		<div className="max-w-dialog-l">
			<ChangedOnDiskBanner {...args} />
		</div>
	),
} satisfies Meta<typeof ChangedOnDiskBanner>;

export default meta;
type Story = StoryObj<typeof meta>;

const banner = (root: HTMLElement) =>
	root.querySelector("[data-slot=changed-on-disk]") as HTMLElement;

/** No working copy: the view re-read the file. Info, a polite status, and "Dismiss". */
export const Updated: Story = {
	play: async ({ canvasElement, args }) => {
		const el = banner(canvasElement);
		await expect(el).toHaveAttribute("data-tone", "info");
		await expect(el).toHaveAttribute("role", "status");
		await expect(el).toHaveTextContent("File changed on disk");
		await expect(el.querySelector("[data-slot=path-chip]")).toHaveTextContent(
			"config.yaml",
		);
		await expect(
			within(el).queryByRole("button", { name: "Keep mine" }),
		).toBeNull();
		await userEvent.click(within(el).getByRole("button", { name: "Dismiss" }));
		await expect(args.onDismiss).toHaveBeenCalledOnce();
	},
};

/** In the view's own words: the canvas says what it did. */
export const UpdatedInTheViewsWords: Story = {
	args: { file: "src/support/app.py", description: "The canvas was updated." },
	play: async ({ canvasElement }) => {
		await expect(banner(canvasElement)).toHaveTextContent(
			"The canvas was updated.",
		);
	},
};

/** A conflicting working copy: warning, the edits kept, "Keep mine" and "Take theirs"; no compare view yet. */
export const Conflict: Story = {
	args: {
		conflict: true,
		onKeepMine: fn(),
		onTakeTheirs: fn(),
		onDismiss: undefined,
	},
	play: async ({ canvasElement, args }) => {
		const el = banner(canvasElement);
		await expect(el).toHaveAttribute("data-tone", "warning");
		await expect(el).toHaveTextContent(
			"File changed on disk while you were editing",
		);
		await expect(
			within(el).queryByRole("button", { name: "Compare" }),
		).toBeNull();
		await expect(
			within(el).queryByRole("button", { name: "Dismiss" }),
		).toBeNull();
		await userEvent.click(
			within(el).getByRole("button", { name: "Keep mine" }),
		);
		await expect(args.onKeepMine).toHaveBeenCalledOnce();
		await userEvent.click(
			within(el).getByRole("button", { name: "Take theirs" }),
		);
		await expect(args.onTakeTheirs).toHaveBeenCalledOnce();
	},
};

/** With a compare view (once one exists): "Compare" too. */
export const ConflictWithCompare: Story = {
	args: {
		conflict: true,
		onKeepMine: fn(),
		onTakeTheirs: fn(),
		onCompare: fn(),
		onDismiss: undefined,
	},
	play: async ({ canvasElement, args }) => {
		const el = banner(canvasElement);
		await userEvent.click(within(el).getByRole("button", { name: "Compare" }));
		await expect(args.onCompare).toHaveBeenCalledOnce();
	},
};

/** "Keep mine" saving: it is pending (presses ignored); the others are disabled. */
export const Saving: Story = {
	args: {
		conflict: true,
		onKeepMine: fn(),
		onTakeTheirs: fn(),
		onCompare: fn(),
		saving: true,
		pending: true,
		onDismiss: undefined,
	},
	play: async ({ canvasElement, args }) => {
		const el = banner(canvasElement);
		const keep = within(el).getByRole("button", { name: "Keep mine" });
		await expect(keep).toHaveAttribute("data-pending");
		await userEvent.click(keep);
		await expect(args.onKeepMine).not.toHaveBeenCalled();
		await expect(
			within(el).getByRole("button", { name: "Take theirs" }),
		).toBeDisabled();
		await expect(
			within(el).getByRole("button", { name: "Compare" }),
		).toBeDisabled();
	},
};

/** A Keep mine that failed for another reason: the banner stays, with what happened and what to do under the choices. */
export const KeepMineFailed: Story = {
	args: {
		conflict: true,
		onKeepMine: fn(),
		onTakeTheirs: fn(),
		onDismiss: undefined,
		error: {
			title: "The app's bridge is not available",
			description: "Restart the app, then keep yours again.",
		},
	},
	play: async ({ canvasElement, args }) => {
		const el = banner(canvasElement);
		await expect(el).toHaveAttribute("data-tone", "warning");
		const alert = within(el).getByRole("alert");
		await expect(alert).toHaveTextContent(
			"Restart the app, then keep yours again.",
		);
		await userEvent.click(
			within(el).getByRole("button", { name: "Keep mine" }),
		);
		await expect(args.onKeepMine).toHaveBeenCalledOnce();
	},
};

/** A conflict over a canvas: floating, with its choices under the words. */
export const FloatingConflict: Story = {
	render: () => (
		<div className="relative h-96 max-w-dialog-l overflow-hidden rounded-card border border-border-default bg-surface-raised">
			<ChangedOnDiskBanner
				file="src/support/app.py"
				conflict
				placement="floating"
				onKeepMine={() => {}}
				onTakeTheirs={() => {}}
			/>
		</div>
	),
	play: async ({ canvasElement }) => {
		const el = banner(canvasElement);
		await expect(el).toHaveAttribute("data-tone", "warning");
		await expect(getComputedStyle(el).position).toBe("absolute");
		await expect(
			within(el).getByRole("button", { name: "Keep mine" }),
		).toBeVisible();
	},
};

/** Over a canvas: floating at the top of the viewport, solid, with the elevated shadow; the canvas stays under it. */
export const Floating: Story = {
	render: () => (
		<div className="relative h-96 max-w-dialog-l overflow-hidden rounded-card border border-border-default bg-surface-raised">
			<ChangedOnDiskBanner
				file="src/support/app.py"
				conflict={false}
				placement="floating"
				description="The canvas was updated."
			/>
			<div className="flex h-full items-center justify-center gap-6 text-ui text-text">
				<span className="rounded-control border border-border-control px-3 py-2">
					triage
				</span>
				<span className="rounded-control border border-border-control px-3 py-2">
					billing
				</span>
			</div>
		</div>
	),
	play: async ({ canvasElement }) => {
		const el = banner(canvasElement);
		await expect(el).toHaveAttribute("data-placement", "floating");
		const style = getComputedStyle(el);
		await expect(style.position).toBe("absolute");
		await expect(style.boxShadow).not.toBe("none");
		// 16 px from the top of the canvas.
		await expect(el.offsetTop).toBe(16);
	},
};

/** The keyboard: Tab reaches the path's actions (none here), then "Take theirs" and "Keep mine"; Enter presses. */
export const Keyboard: Story = {
	args: {
		conflict: true,
		onKeepMine: fn(),
		onTakeTheirs: fn(),
		onDismiss: undefined,
	},
	play: async ({ canvasElement, args }) => {
		const el = banner(canvasElement);
		const take = within(el).getByRole("button", { name: "Take theirs" });
		await tabTo(take);
		await expectFocusRing(take);
		const keep = within(el).getByRole("button", { name: "Keep mine" });
		await userEvent.tab();
		await expect(keep).toHaveFocus();
		await userEvent.keyboard("{Enter}");
		await expect(args.onKeepMine).toHaveBeenCalledOnce();
	},
};
