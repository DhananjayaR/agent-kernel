import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { contrastRatio } from "../contrast";
import {
	composite,
	expectFocusRing,
	expectFocusWithin,
	expectSolidLayer,
	expectStyle,
	expectTokenColour,
	settle,
	tabTo,
	tokenColour,
} from "../lib/story-checks";
import { Button } from "./button";
import { Modal } from "./modal";

const meta = {
	title: "Overlays/Modal",
	component: Modal,
	args: {
		title: "Python environment",
		trigger: <Button>Show environment</Button>,
		children: (
			<p>
				The project runs on Python 3.12 from <code>.venv</code>. Agent Kernel
				0.9.2 is installed with the OpenAI Agents and LangGraph extras.
			</p>
		),
		actions: (close: () => void) => (
			<Button variant="primary" onPress={close}>
				Done
			</Button>
		),
	},
} satisfies Meta<typeof Modal>;

export default meta;
type Story = StoryObj<typeof meta>;

const dialog = () => within(document.body).findByRole("dialog");
const triggerOf = (canvasElement: HTMLElement) =>
	within(canvasElement).getByRole("button", { name: "Show environment" });

/**
 * Open: Spectrum 2 Dialog M on the solid overlay surface (480 px, 16 px radius, 32 px padding, 22/26 bold title),
 * over the scrim, in the story's theme.
 */
export const Open: Story = {
	args: { defaultOpen: true },
	play: async () => {
		const el = await dialog();
		const surface = el.closest("[data-slot=modal]") as HTMLElement;
		await expectSolidLayer(surface);
		await expect(surface.getBoundingClientRect().width).toBe(480);
		await expectStyle(surface, "border-top-left-radius", "16px");
		const heading = within(el).getByRole("heading", {
			name: "Python environment",
		});
		await expectStyle(heading, "font-size", "22px");
		await expectStyle(heading, "line-height", "26px");
		await expectStyle(heading, "font-weight", "700");
		await expectStyle(heading.parentElement as Element, "padding-left", "32px");
		const overlay = surface.closest("[data-slot=modal-overlay]") as HTMLElement;
		await expectTokenColour(overlay, "background-color", "bg-scrim");
		await expect(el).toHaveAccessibleName("Python environment");
		// A short body is not a tab stop.
		await expect(
			el.querySelector("[data-slot=modal-body]"),
		).not.toHaveAttribute("tabindex");
		// Separation from the scrimmed page (whatever surface the page is on): in light theme the fills differ by
		// at least 1.5:1; in dark theme no existing colour can do that (theme.css), so the edge holds 3:1.
		const dark = document.documentElement.dataset.theme === "dark";
		const scrim = getComputedStyle(overlay).backgroundColor;
		const fillColour = getComputedStyle(surface).backgroundColor;
		const edgeColour = getComputedStyle(surface).borderTopColor;
		const fill = composite(fillColour, fillColour);
		const edge = composite(edgeColour, edgeColour);
		for (const page of [
			"bg-surface",
			"bg-surface-raised",
			"bg-surface-overlay",
		]) {
			const behind = composite(scrim, tokenColour(surface, page));
			if (dark) {
				await expect(contrastRatio(edge, behind), page).toBeGreaterThanOrEqual(
					3,
				);
			} else {
				await expect(contrastRatio(fill, behind), page).toBeGreaterThanOrEqual(
					1.5,
				);
			}
		}
	},
};

/** Focus moves into the modal when it opens and back to the trigger when Escape closes it. */
export const KeyboardAndEscape: Story = {
	play: async ({ canvasElement }) => {
		const trigger = triggerOf(canvasElement);
		await tabTo(trigger);
		await userEvent.keyboard("{Enter}");
		const el = await dialog();
		await expectFocusWithin(el);
		// Focus is contained: Tab and Shift+Tab wrap inside the dialog.
		const close = within(el).getByRole("button", { name: "Close" });
		const done = within(el).getByRole("button", { name: "Done" });
		await userEvent.tab();
		await expectFocusWithin(el);
		await userEvent.tab();
		await expectFocusWithin(el);
		close.focus();
		await userEvent.tab({ shift: true });
		await expect(done).toHaveFocus();
		await userEvent.tab();
		await expect(close).toHaveFocus();
		await userEvent.keyboard("{Escape}");
		await waitFor(() => expect(el).not.toBeInTheDocument());
		await waitFor(() => expect(trigger).toHaveFocus());
	},
};

/** The close button: keyboard focus ring, and pressing it closes and returns focus. */
export const CloseButton: Story = {
	play: async ({ canvasElement }) => {
		const trigger = triggerOf(canvasElement);
		await tabTo(trigger);
		await userEvent.keyboard("{Enter}");
		const el = await dialog();
		const close = within(el).getByRole("button", { name: "Close" });
		await tabTo(close);
		await expectFocusRing(close);
		await userEvent.keyboard("{Enter}");
		await waitFor(() => expect(el).not.toBeInTheDocument());
		await waitFor(() => expect(trigger).toHaveFocus());
	},
};

/** A click on the scrim does not close a modal unless it is `isDismissable` (a stray click must not lose work). */
export const ScrimClick: Story = {
	play: async ({ canvasElement }) => {
		await userEvent.click(triggerOf(canvasElement));
		const el = await dialog();
		await settle(el);
		const overlay = el.closest("[data-slot=modal-overlay]") as HTMLElement;
		await userEvent.click(overlay);
		await expect(el).toBeInTheDocument();
	},
};

export const Dismissable: Story = {
	args: { isDismissable: true },
	play: async ({ canvasElement }) => {
		const trigger = triggerOf(canvasElement);
		await userEvent.click(trigger);
		const el = await dialog();
		await settle(el);
		const overlay = el.closest("[data-slot=modal-overlay]") as HTMLElement;
		await userEvent.click(overlay);
		await waitFor(() => expect(el).not.toBeInTheDocument());
	},
};

const openChanged = fn();

/** Opened from the caller's state, as the approval pattern and the unsaved-changes guard open it. */
function ControlledModal() {
	const [isOpen, setOpen] = useState(false);
	return (
		<>
			<Button onPress={() => setOpen(true)}>Review changes</Button>
			<Modal
				isOpen={isOpen}
				onOpenChange={(open) => {
					openChanged(open);
					setOpen(open);
				}}
				title="Unsaved changes in config.yaml"
				actions={(close) => <Button onPress={close}>Stay</Button>}
			>
				<p>The session store section has changes that are not saved.</p>
			</Modal>
		</>
	);
}

/**
 * Controlled (`isOpen` and `onOpenChange`, no trigger): focus moves in when the caller opens it; Escape asks the
 * caller to close it; focus returns to the element that had it.
 */
export const Controlled: Story = {
	render: () => <ControlledModal />,
	beforeEach: () => {
		openChanged.mockClear();
	},
	play: async ({ canvasElement }) => {
		const opener = within(canvasElement).getByRole("button", {
			name: "Review changes",
		});
		await tabTo(opener);
		await userEvent.keyboard("{Enter}");
		const el = await dialog();
		await expect(el).toHaveAccessibleName("Unsaved changes in config.yaml");
		await expectFocusWithin(el);
		await userEvent.keyboard("{Escape}");
		await expect(openChanged).toHaveBeenCalledWith(false);
		await waitFor(() => expect(el).not.toBeInTheDocument());
		await waitFor(() => expect(opener).toHaveFocus());
	},
};

/** The page behind an open modal does not scroll; it scrolls again when the modal closes. */
export const ScrollLock: Story = {
	play: async ({ canvasElement }) => {
		const html = document.documentElement;
		const before = getComputedStyle(html).overflow;
		await userEvent.click(triggerOf(canvasElement));
		const el = await dialog();
		await waitFor(() => expect(getComputedStyle(html).overflow).toBe("hidden"));
		await userEvent.keyboard("{Escape}");
		await waitFor(() => expect(el).not.toBeInTheDocument());
		await waitFor(() => expect(getComputedStyle(html).overflow).toBe(before));
	},
};

/** A modal opened from a modal: Escape closes only the top one, and focus returns into the first. */
export const ModalOnModal: Story = {
	args: {
		children: (
			<div className="flex flex-col items-start gap-3">
				<p>The project runs on Python 3.12 from .venv.</p>
				<Modal title="Installed extras" trigger={<Button>Show extras</Button>}>
					<p>OpenAI Agents, LangGraph.</p>
				</Modal>
			</div>
		),
	},
	play: async ({ canvasElement }) => {
		await userEvent.click(triggerOf(canvasElement));
		const first = await within(document.body).findByRole("dialog", {
			name: "Python environment",
		});
		const showExtras = within(first).getByRole("button", {
			name: "Show extras",
		});
		await tabTo(showExtras);
		await userEvent.keyboard("{Enter}");
		const second = await within(document.body).findByRole("dialog", {
			name: "Installed extras",
		});
		await expectFocusWithin(second);
		await userEvent.keyboard("{Escape}");
		await waitFor(() => expect(second).not.toBeInTheDocument());
		await expect(first).toBeInTheDocument();
		await waitFor(() => expect(showExtras).toHaveFocus());
	},
};

/**
 * A body taller than the window scrolls between the header and the footer, which stay visible; with nothing
 * focusable in it, it becomes a named, focusable region so the keyboard can scroll it.
 */
export const LongBody: Story = {
	args: {
		defaultOpen: true,
		children: (
			<div className="flex flex-col gap-3">
				{Array.from({ length: 40 }, (_, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: static filler lines
					<p key={i}>Line {i + 1} of the environment report.</p>
				))}
			</div>
		),
	},
	render: (args) => (
		<div className="h-96">
			<Modal {...args} />
		</div>
	),
	play: async () => {
		const el = await dialog();
		const body = el.querySelector("[data-slot=modal-body]") as HTMLElement;
		await waitFor(() => expect(body).toHaveAttribute("tabindex", "0"));
		await expect(body).toHaveAttribute("role", "region");
		await expect(body).toHaveAccessibleName("Python environment");
		await expect(body.scrollHeight).toBeGreaterThan(body.clientHeight);
		const done = within(el).getByRole("button", { name: "Done" });
		const surface = el.closest("[data-slot=modal]") as HTMLElement;
		await expect(done.getBoundingClientRect().bottom).toBeLessThanOrEqual(
			surface.getBoundingClientRect().bottom,
		);
		await tabTo(body);
		await expect(body.matches(":focus-visible")).toBe(true);
		await expect(getComputedStyle(body).outlineStyle).toBe("solid");
	},
};
