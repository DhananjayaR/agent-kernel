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
/** Opens the palette from its trigger (the app opens it with Mod+K) and answers the dialog. */
const open = async (root: HTMLElement) => {
	await userEvent.click(triggerOf(root));
	return palette();
};
const palette = () => body().findByRole("dialog", { name: "Command palette" });
const search = () => body().getByRole("textbox", { name: "Search commands" });
/** The command rows (the empty state is rendered in a row of its own, with no key). */
const rows = () =>
	body()
		.queryAllByRole("menuitem")
		.filter((row) => row.hasAttribute("data-key"));

/** Open: a 640 px solid layer near the top, the search field focused, every command with its prefix and shortcut. */
export const Default: Story = {
	play: async ({ canvasElement }) => {
		const dialog = await open(canvasElement);
		await expectFocusWithin(dialog);
		await expect(search()).toHaveFocus();
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
		await waitFor(() => expect(rows()[0]).toHaveAttribute("data-focused"));
	},
};

/** Nothing matches: says so. */
export const NoMatches: Story = {
	args: { defaultQuery: "terraform" },
	play: async ({ canvasElement }) => {
		const dialog = await open(canvasElement);
		await expect(rows()).toHaveLength(0);
		await expect(dialog).toHaveTextContent("No matching commands");
	},
};

/** A version-gated command: listed with its reason, reachable, read with it, but Enter does not run it. */
export const VersionGated: Story = {
	args: { onRun: fn() },
	play: async ({ canvasElement, args }) => {
		await open(canvasElement);
		await userEvent.type(search(), "azure");
		const gated = rows()[0] as HTMLElement;
		await waitFor(() => expect(gated).toHaveAttribute("data-focused"));
		await expect(gated).toHaveAttribute("data-unavailable");
		await expect(gated).toHaveAccessibleDescription("Needs OAK 0.12.0");
		await userEvent.keyboard("{Enter}");
		await expect(args.onRun).not.toHaveBeenCalled();
		await expect(await palette()).toBeVisible();
		await userEvent.click(gated);
		await expect(args.onRun).not.toHaveBeenCalled();
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
		await waitFor(() => expect(search()).toHaveFocus());
		await userEvent.keyboard("about");
		await waitFor(() => expect(rows()).toHaveLength(2));
		await waitFor(() => expect(rows()[0]).toHaveAttribute("data-focused"));
		await userEvent.keyboard("{ArrowDown}");
		const second = rows()[1] as HTMLElement;
		await waitFor(() => expect(second).toHaveAttribute("data-focused"));
		await expectInsetFocusRing(second);
		await userEvent.keyboard("{Enter}");
		await expect(args.onRun).toHaveBeenCalledWith("about.runDemoJob");
		await waitFor(() => expect(body().queryByRole("dialog")).toBeNull());
		await waitFor(() => expect(trigger).toHaveFocus());
	},
};

/** Enter after Backspace (React Aria leaves the list then) runs the first match. */
export const EnterAfterBackspace: Story = {
	args: { onRun: fn() },
	play: async ({ canvasElement, args }) => {
		await open(canvasElement);
		await userEvent.type(search(), "panelx");
		await waitFor(() => expect(rows()).toHaveLength(0));
		await userEvent.keyboard("{Backspace}");
		await waitFor(() => expect(rows()).toHaveLength(1));
		await userEvent.keyboard("{Enter}");
		await expect(args.onRun).toHaveBeenCalledWith("shell.toggleBottomPanel");
		await waitFor(() => expect(body().queryByRole("dialog")).toBeNull());
	},
};
