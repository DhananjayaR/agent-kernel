// CommandPaletteView's states (P1b gate step 4, design gate row (b)): every command with its feature prefix and
// shortcut, filtered by typing, nothing matching, a version-gated command listed with its reason (not runnable),
// macOS shortcuts, and the keyboard (type, arrows, Enter runs and closes, focus back to the trigger; Enter after
// Backspace; Escape closes with text typed). Each story opens it from a trigger, as the app does from Mod+K.
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import {
	expectFocusWithin,
	expectInsetFocusRing,
	expectSolidLayer,
	expectTokenColour,
} from "../lib/story-checks";
import { Button } from "./button";
import {
	type CommandPaletteItem,
	CommandPaletteView,
	type CommandPaletteViewProps,
} from "./command-palette";
import { isModalOpen } from "./modal";

const items: CommandPaletteItem[] = [
	{
		id: "shell.toggleBottomPanel",
		title: "View: Show or hide the panel",
		shortcut: { label: "Ctrl+J", aria: "Control+J" },
	},
	{ id: "shell.showCommands", title: "View: Show commands" },
	{ id: "about.show", title: "About: Open About" },
	{ id: "about.runDemoJob", title: "About: Run the demo job" },
	{
		id: "deploy.toAzureFunctions",
		title: "Deploy: Deploy to Azure Functions",
		unavailable: "Needs OAK 0.12.0",
	},
];

/** A trigger that opens the palette, standing in for Mod+K. */
function WithTrigger(
	props: Omit<CommandPaletteViewProps, "isOpen" | "onOpenChange"> & {
		startOpen?: boolean;
	},
) {
	const { startOpen = false, ...rest } = props;
	const [open, setOpen] = useState(startOpen);
	return (
		<>
			<Button variant="outline" onPress={() => setOpen(true)}>
				Open the command palette
			</Button>
			<CommandPaletteView {...rest} isOpen={open} onOpenChange={setOpen} />
		</>
	);
}

const meta = {
	title: "Patterns/Command palette",
	component: CommandPaletteView,
	args: {
		isOpen: true,
		onOpenChange: fn(),
		items,
		onRun: fn(),
	},
	render: ({ isOpen: _open, onOpenChange: _change, ...args }) => (
		<WithTrigger {...args} />
	),
	parameters: {
		a11y: {
			config: {
				// A row's shortcut or reason is its description (React Aria links it), so its name stays the title;
				// axe's label-content-name-mismatch counts that visible text as label text (WCAG 2.5.3 concerns the
				// label, not a shortcut hint). The same ruling as the Menu's Shortcuts story.
				rules: [{ id: "label-content-name-mismatch", enabled: false }],
			},
		},
	},
} satisfies Meta<typeof CommandPaletteView>;

export default meta;
type Story = StoryObj<typeof meta>;

const body = () => within(document.body);
const triggerOf = (root: HTMLElement) =>
	within(root).getByRole("button", { name: "Open the command palette" });
/** Opens the palette from its trigger by keyboard (the app opens it with Mod+K) and answers the dialog. */
const open = async (root: HTMLElement) => {
	triggerOf(root).focus();
	await userEvent.keyboard("{Enter}");
	return palette();
};
/** The search field shows focus as Input does: the text-coloured edge, and the inset focus ring by keyboard. */
const expectSearchFocus = async () => {
	const field = search();
	await waitFor(() => expect(field).toHaveFocus());
	await expectInsetFocusRing(field);
	await expectTokenColour(field, "border-top-color", "border-text");
};
/** The row Enter acts on: marked (selected, the input's active descendant) and drawn with the inset focus ring. */
const expectMarked = async (row: Element | undefined) => {
	await waitFor(() => expect(row).toHaveAttribute("aria-selected", "true"));
	const el = row as HTMLElement;
	await expect(search()).toHaveAttribute("aria-activedescendant", el.id);
	const style = getComputedStyle(el);
	await expect(style.outlineStyle).toBe("solid");
	await expect(style.outlineWidth).toBe("2px");
	await expect(style.outlineOffset).toBe("-2px");
	await expectTokenColour(el, "outline-color", "outline-focus-ring");
};
const palette = () => body().findByRole("dialog", { name: "Command palette" });
const search = () => body().getByRole("combobox", { name: "Search commands" });
/** The command rows (options of the search field's list). */
const rows = () => body().queryAllByRole("option");

/**
 * Open: a 640 px solid layer near the top, the search field focused (with the focus ring), every command with its
 * prefix and shortcut, and the first marked: Enter with nothing typed runs it.
 */
export const Default: Story = {
	play: async ({ canvasElement }) => {
		const dialog = await open(canvasElement);
		await expectFocusWithin(dialog);
		await expectSearchFocus();
		await expectMarked(rows()[0]);
		await expect(isModalOpen()).toBe(true);
		const surface = dialog.closest("[data-slot=modal]") as HTMLElement;
		await expect(surface.getBoundingClientRect().width).toBe(640);
		await expect(surface.getBoundingClientRect().top).toBeLessThan(100);
		await expectSolidLayer(surface);
		await expect(rows().map((row) => row.textContent)).toEqual([
			"View: Show or hide the panelCtrl+J",
			"View: Show commands",
			"About: Open About",
			"About: Run the demo job",
			"Deploy: Deploy to Azure FunctionsNeeds OAK 0.12.0",
		]);
		const first = rows()[0] as HTMLElement;
		await expect(first.getBoundingClientRect().height).toBe(40);
		const shortcut = first.querySelector("kbd") as HTMLElement;
		await expect(getComputedStyle(shortcut).fontFamily).toContain(
			"JetBrains Mono",
		);
		await expect(shortcut).toHaveAttribute("aria-keyshortcuts", "Control+J");
	},
};

/** Typing filters (anywhere in the title, any case) and moves to the first match. */
export const Filtered: Story = {
	play: async ({ canvasElement }) => {
		await open(canvasElement);
		await userEvent.type(search(), "DEMO");
		await waitFor(() =>
			expect(rows().map((row) => row.textContent)).toEqual([
				"About: Run the demo job",
			]),
		);
		// Once typing pauses, how many match is said.
		const count = (await palette()).querySelector(
			"[data-slot=palette-count]",
		) as HTMLElement;
		await waitFor(() => expect(count).toHaveTextContent("1 command"));
		await expect(search()).toHaveAttribute("aria-expanded", "true");
		await expectMarked(rows()[0]);
	},
};

/** Nothing matches: says so. */
export const NoMatches: Story = {
	args: { defaultQuery: "terraform" },
	play: async ({ canvasElement }) => {
		const dialog = await open(canvasElement);
		await expect(rows()).toHaveLength(0);
		await expect(dialog).toHaveTextContent("No matching commands");
		// Nothing to expand: the field says so.
		await expect(search()).toHaveAttribute("aria-expanded", "false");
		await expect(search()).not.toHaveAttribute("aria-activedescendant");
		await userEvent.click(within(dialog).getByText("No matching commands"));
		await expect(search()).toHaveFocus();
	},
};

/** A version-gated command: listed with its reason, reachable, read with it, but Enter does not run it. */
export const VersionGated: Story = {
	args: { onRun: fn() },
	play: async ({ canvasElement, args }) => {
		await open(canvasElement);
		await userEvent.type(search(), "azure");
		const gated = rows()[0] as HTMLElement;
		// The only match is gated: marked, read as unavailable with its reason.
		await expectMarked(gated);
		await expect(gated).toHaveAttribute("aria-disabled", "true");
		await expect(gated).toHaveAttribute("data-unavailable");
		await expect(gated).toHaveAccessibleDescription("Needs OAK 0.12.0");
		await userEvent.keyboard("{Enter}");
		await expect(args.onRun).not.toHaveBeenCalled();
		await expect(await palette()).toBeVisible();
		// The refusal is said, politely, so pressing Enter is never met with silence; pressed again, it is said again
		// (a new node in the live region).
		const refusal = (await palette()).querySelector(
			"[data-slot=palette-refusal]",
		) as HTMLElement;
		await expect(refusal).toHaveTextContent("Needs OAK 0.12.0");
		const said = refusal.firstElementChild;
		await userEvent.keyboard("{Enter}");
		await expect(refusal).toHaveTextContent("Needs OAK 0.12.0");
		await expect(refusal.firstElementChild).not.toBe(said);
		// A click on the row (or anywhere below the field) does not take focus from the field.
		await userEvent.click(gated);
		await expect(args.onRun).not.toHaveBeenCalled();
		await expect(search()).toHaveFocus();
	},
};

/** A gated match is never marked first: the first runnable match is, so Enter with nothing moved runs something. */
export const MarksFirstRunnable: Story = {
	args: {
		items: [
			{
				id: "deploy.toAzureFunctions",
				title: "Deploy: Deploy to Azure Functions",
				unavailable: "Needs OAK 0.12.0",
			},
			{ id: "deploy.plan", title: "Deploy: Plan the deployment" },
		],
		onRun: fn(),
	},
	play: async ({ canvasElement, args }) => {
		await open(canvasElement);
		// Manifest order is kept; the mark skips the gated row.
		await expect(rows().map((row) => row.getAttribute("data-key"))).toEqual([
			"deploy.toAzureFunctions",
			"deploy.plan",
		]);
		await expectMarked(rows()[1]);
		await userEvent.keyboard("{Enter}");
		await expect(args.onRun).toHaveBeenCalledWith("deploy.plan");
		// For the screenshot: open again (focus came back to the trigger), the runnable row marked.
		await waitFor(() => expect(body().queryByRole("dialog")).toBeNull());
		await waitFor(() => expect(triggerOf(canvasElement)).toHaveFocus());
		await userEvent.keyboard("{Enter}");
		await palette();
		await expectMarked(rows()[1]);
	},
};

/** macOS: shortcuts in the platform's form. */
export const MacShortcuts: Story = {
	args: {
		items: items.map((item) =>
			item.shortcut
				? { ...item, shortcut: { label: "⌘J", aria: "Meta+J" } }
				: item,
		),
	},
	play: async ({ canvasElement }) => {
		await open(canvasElement);
		const shortcut = (rows()[0] as HTMLElement).querySelector("kbd");
		await expect(shortcut).toHaveTextContent("⌘J");
		await expect(shortcut).toHaveAttribute("aria-keyshortcuts", "Meta+J");
	},
};

/** Escape closes it at once, even with text typed, and focus goes back to the trigger. */
export const EscapeCloses: Story = {
	args: { onRun: fn() },
	play: async ({ canvasElement, args }) => {
		await open(canvasElement);
		await userEvent.type(search(), "abo");
		await userEvent.keyboard("{Escape}");
		await waitFor(() => expect(body().queryByRole("dialog")).toBeNull());
		await expect(isModalOpen()).toBe(false);
		await expect(args.onRun).not.toHaveBeenCalled();
		const trigger = within(canvasElement).getByRole("button", {
			name: "Open the command palette",
		});
		await waitFor(() => expect(trigger).toHaveFocus());
		// Opened again, it starts afresh: for the screenshot, the open palette filtered by "abo".
		await userEvent.keyboard("{Enter}");
		await palette();
		await expect(search()).toHaveValue("");
		await userEvent.keyboard("abo");
		await expectMarked(rows()[0]);
	},
};

/** Keyboard: open from the trigger, type, ArrowDown to the next match, Enter runs it and closes; focus returns. */
export const Keyboard: Story = {
	args: { onRun: fn() },
	play: async ({ canvasElement, args }) => {
		const trigger = within(canvasElement).getByRole("button", {
			name: "Open the command palette",
		});
		await userEvent.tab();
		await expect(trigger).toHaveFocus();
		await userEvent.keyboard("{Enter}");
		await palette();
		await expectSearchFocus();
		// Nothing typed: the first row is already marked.
		await expectMarked(rows()[0]);
		await userEvent.keyboard("about");
		await waitFor(() => expect(rows()).toHaveLength(2));
		await waitFor(() => expect(rows()[0]).toHaveAttribute("data-focused"));
		await userEvent.keyboard("{ArrowDown}");
		await expectMarked(rows()[1]);
		await expect(rows()[0]).toHaveAttribute("aria-selected", "false");
		// With a modifier the arrows are the field's own: the mark stays.
		await userEvent.keyboard("{Shift>}{ArrowUp}{/Shift}");
		await expectMarked(rows()[1]);
		await userEvent.keyboard("{Enter}");
		await expect(args.onRun).toHaveBeenCalledWith("about.runDemoJob");
		await waitFor(() => expect(body().queryByRole("dialog")).toBeNull());
		await waitFor(() => expect(trigger).toHaveFocus());
		// For the screenshot: open again, filter, and move to the second match.
		await userEvent.keyboard("{Enter}");
		await palette();
		await userEvent.keyboard("about");
		await expectMarked(rows()[0]);
		await userEvent.keyboard("{ArrowDown}");
		await expectMarked(rows()[1]);
	},
};

/**
 * Backspace keeps a row marked (the first match), so Enter after it runs the row shown; with nothing matching,
 * Enter does nothing.
 */
export const EnterAfterBackspace: Story = {
	args: { onRun: fn() },
	play: async ({ canvasElement, args }) => {
		await open(canvasElement);
		await userEvent.keyboard("panelx");
		await waitFor(() => expect(rows()).toHaveLength(0));
		await userEvent.keyboard("{Enter}");
		await expect(args.onRun).not.toHaveBeenCalled();
		await userEvent.keyboard("{Backspace}");
		await waitFor(() => expect(rows()).toHaveLength(1));
		await expectMarked(rows()[0]);
		await userEvent.keyboard("{Enter}");
		await expect(args.onRun).toHaveBeenCalledWith("shell.toggleBottomPanel");
		await waitFor(() => expect(body().queryByRole("dialog")).toBeNull());
		// For the screenshot: the state this story is about, the match marked after Backspace.
		await userEvent.keyboard("{Enter}");
		await palette();
		await userEvent.keyboard("panelx{Backspace}");
		await expectMarked(rows()[0]);
	},
};
