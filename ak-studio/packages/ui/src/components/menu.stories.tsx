import type { Meta, StoryObj } from "@storybook/react-vite";
import {
	EllipsisIcon,
	ExternalLinkIcon,
	FolderOpenIcon,
	RefreshCwIcon,
} from "lucide-react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import {
	expectFocusRing,
	expectHeight,
	expectInsetFocusRing,
	expectSolidLayer,
	expectStyle,
	expectTokenColour,
	hover,
	tabTo,
} from "../lib/story-checks";
import { Button, IconButton } from "./button";
import { Menu, MenuItem, MenuSection, MenuSeparator } from "./menu";

const meta = {
	title: "Overlays/Menu",
	component: Menu,
	args: {
		trigger: (
			<IconButton
				aria-label="Project actions"
				icon={<EllipsisIcon aria-hidden="true" />}
			/>
		),
		onAction: fn(),
		children: null,
	},
	render: (args) => (
		<div className="flex h-72 items-start">
			<Menu {...args}>
				<MenuItem id="open-editor" icon={<ExternalLinkIcon />}>
					Open in editor
				</MenuItem>
				<MenuItem id="reveal" icon={<FolderOpenIcon />}>
					Reveal in file manager
				</MenuItem>
				<MenuItem id="reload" icon={<RefreshCwIcon />}>
					Reload project
				</MenuItem>
				<MenuSeparator />
				<MenuItem id="close" isDisabled>
					Close project
				</MenuItem>
			</Menu>
		</div>
	),
} satisfies Meta<typeof Menu>;

export default meta;
type Story = StoryObj<typeof meta>;

const triggerOf = (canvasElement: HTMLElement) =>
	within(canvasElement).getByRole("button", { name: "Project actions" });
const menu = () => within(document.body).findByRole("menu");

/** Open: the solid floating layer, 32 px items with an 8 px radius, a disabled item. */
export const Open: Story = {
	args: { defaultOpen: true },
	play: async () => {
		const el = await menu();
		const layer = el.closest("[data-slot=menu-popover]") as HTMLElement;
		await expectSolidLayer(layer);
		await expectStyle(layer, "border-top-left-radius", "10px");
		await expectStyle(layer, "padding-left", "8px");
		const items = within(el).getAllByRole("menuitem");
		await expect(items).toHaveLength(4);
		const first = items[0] as HTMLElement;
		await expectHeight(first, 32);
		await expectStyle(first, "border-top-left-radius", "8px");
		await expect(first).toHaveAccessibleName("Open in editor");
		const disabled = items[3] as HTMLElement;
		await expect(disabled).toHaveAttribute("aria-disabled", "true");
		await expectTokenColour(disabled, "color", "text-disabled-text");
	},
};

/** Hover moves an item to the next fill stop; only text-coloured content sits on it. */
export const HoverItem: Story = {
	args: { defaultOpen: true },
	play: async () => {
		const el = await menu();
		const item = within(el).getByRole("menuitem", { name: /Reveal/ });
		await hover(item);
		await expectTokenColour(item, "background-color", "bg-fill-hover");
		await expectTokenColour(item, "color", "text-text");
	},
};

/**
 * Keyboard model (APG menu button): Enter opens on the first item, arrows move and skip the disabled item,
 * End and Home jump, a letter moves by type-ahead, Enter runs the item and closes, Escape closes, and focus
 * returns to the trigger each time.
 */
export const Keyboard: Story = {
	play: async ({ canvasElement, args }) => {
		const trigger = triggerOf(canvasElement);
		await tabTo(trigger);
		await expectFocusRing(trigger);
		await userEvent.keyboard("{Enter}");
		let el = await menu();
		const item = (name: RegExp) => within(el).getByRole("menuitem", { name });
		await waitFor(() => expect(item(/Open in editor/)).toHaveFocus());
		await expectInsetFocusRing(item(/Open in editor/));
		await userEvent.keyboard("{ArrowDown}");
		await expect(item(/Reveal/)).toHaveFocus();
		await userEvent.keyboard("{End}");
		await expect(item(/Reload/)).toHaveFocus();
		await userEvent.keyboard("{ArrowDown}");
		await expect(item(/Open in editor/)).toHaveFocus();
		await userEvent.keyboard("{Home}");
		await expect(item(/Open in editor/)).toHaveFocus();
		await userEvent.keyboard("r");
		await expect(item(/Reveal/)).toHaveFocus();
		await userEvent.keyboard("{Escape}");
		await waitFor(() => expect(el).not.toBeInTheDocument());
		await waitFor(() => expect(trigger).toHaveFocus());
		await expect(args.onAction).not.toHaveBeenCalled();

		await userEvent.keyboard("{ArrowUp}");
		el = await menu();
		await waitFor(() => expect(item(/Reload/)).toHaveFocus());
		await userEvent.keyboard("{Enter}");
		await expect(args.onAction).toHaveBeenCalledWith("reload", undefined);
		await waitFor(() => expect(el).not.toBeInTheDocument());
		await waitFor(() => expect(trigger).toHaveFocus());
	},
};

/** With a selection: the chosen item shows a check mark as well as its checked state. */
export const Selection: Story = {
	args: {
		defaultOpen: true,
		selectionMode: "single",
		defaultSelectedKeys: ["system"],
		trigger: <Button>Theme</Button>,
	},
	render: (args) => (
		<div className="flex h-72 items-start">
			<Menu {...args}>
				<MenuSection title="Theme">
					<MenuItem id="system">Follow the system</MenuItem>
					<MenuItem id="light">Light</MenuItem>
					<MenuItem id="dark">Dark</MenuItem>
				</MenuSection>
			</Menu>
		</div>
	),
	play: async () => {
		const el = await menu();
		const checked = within(el).getByRole("menuitemradio", { checked: true });
		await expect(checked).toHaveTextContent("Follow the system");
		await expect(checked.querySelector("svg")).not.toBeNull();
		await expect(
			within(el)
				.getByRole("menuitemradio", { name: "Light" })
				.querySelector("svg"),
		).toBeNull();
	},
};

/**
 * Shortcuts: an item shows its keyboard shortcut; React Aria exposes it as the item's description, so the name
 * stays the label. axe's label-content-name-mismatch counts the visible shortcut as label text (WCAG 2.5.3
 * concerns the label, not a shortcut hint), so it is off for this story only.
 */
export const Shortcuts: Story = {
	args: { defaultOpen: true },
	parameters: {
		a11y: {
			config: {
				rules: [{ id: "label-content-name-mismatch", enabled: false }],
			},
		},
	},
	render: (args) => (
		<div className="flex h-72 items-start">
			<Menu {...args}>
				<MenuItem
					id="open-editor"
					icon={<ExternalLinkIcon />}
					shortcut="Ctrl+E"
				>
					Open in editor
				</MenuItem>
				<MenuItem id="reveal" icon={<FolderOpenIcon />} shortcut="Ctrl+R">
					Reveal in file manager
				</MenuItem>
			</Menu>
		</div>
	),
	play: async () => {
		const el = await menu();
		const first = within(el).getAllByRole("menuitem")[0] as HTMLElement;
		await expect(first).toHaveTextContent("Ctrl+E");
		await expect(first).toHaveAccessibleName("Open in editor");
		await expect(first).toHaveAccessibleDescription("Ctrl+E");
	},
};
