import type { Meta, StoryObj } from "@storybook/react-vite";
import { ExternalLinkIcon, FolderOpenIcon } from "lucide-react";
import {
	expect,
	fireEvent,
	fn,
	userEvent,
	waitFor,
	within,
} from "storybook/test";
import {
	expectInsetFocusRing,
	expectSolidLayer,
	tabTo,
} from "../lib/story-checks";
import { FileTreeItem, projectFiles } from "../lib/story-fixtures";
import { ContextMenu } from "./context-menu";
import { MenuItem } from "./menu";
import { Tree } from "./tree";

const meta = {
	title: "Overlays/Context menu",
	component: ContextMenu,
	args: {
		"aria-label": "File actions",
		onAction: fn(),
		menu: (target: string | null) =>
			target === null ? null : (
				<>
					<MenuItem id="open-editor" icon={<ExternalLinkIcon />}>
						Open in editor
					</MenuItem>
					<MenuItem id="reveal" icon={<FolderOpenIcon />}>
						Reveal in file manager
					</MenuItem>
				</>
			),
		children: null,
	},
	render: (args) => (
		<div className="flex h-96 w-80 flex-col">
			<ContextMenu {...args}>
				<Tree
					aria-label="Project files"
					items={projectFiles}
					defaultExpandedKeys={["agents"]}
				>
					{(node) => <FileTreeItem node={node} />}
				</Tree>
			</ContextMenu>
		</div>
	),
} satisfies Meta<typeof ContextMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

const row = (canvasElement: HTMLElement, name: RegExp) =>
	within(canvasElement).getByRole("row", { name });
const menu = () => within(document.body).findByRole("menu");

/**
 * Keyboard: Shift+F10 on the focused row opens the menu for that row with focus on its first item; Enter runs
 * the item for the row; focus returns to the row. The ContextMenu key does the same; Escape closes.
 */
export const Keyboard: Story = {
	play: async ({ canvasElement, args }) => {
		const app = row(canvasElement, /^app\.py/);
		await tabTo(row(canvasElement, /^agents/));
		await userEvent.keyboard("{End}{ArrowUp}{ArrowUp}");
		await expect(app).toHaveFocus();
		await userEvent.keyboard("{Shift>}{F10}{/Shift}");
		let el = await menu();
		await expect(el).toHaveAccessibleName("File actions");
		await expectSolidLayer(
			el.closest("[data-slot=context-menu-popover]") as HTMLElement,
		);
		const first = within(el).getByRole("menuitem", { name: "Open in editor" });
		await waitFor(() => expect(first).toHaveFocus());
		await expectInsetFocusRing(first);
		await userEvent.keyboard("{ArrowDown}{Enter}");
		await expect(args.onAction).toHaveBeenCalledWith("reveal", "app.py");
		await waitFor(() => expect(el).not.toBeInTheDocument());
		await waitFor(() => expect(app).toHaveFocus());

		await userEvent.keyboard("{ArrowDown}{ContextMenu}");
		el = await menu();
		await waitFor(() =>
			expect(
				within(el).getByRole("menuitem", { name: "Open in editor" }),
			).toHaveFocus(),
		);
		await userEvent.keyboard("{Escape}");
		await waitFor(() => expect(el).not.toBeInTheDocument());
		await waitFor(() =>
			expect(row(canvasElement, /^config\.yaml/)).toHaveFocus(),
		);
		await expect(args.onAction).toHaveBeenCalledOnce();
	},
};

/** Pointer: a right click on a row opens the menu for that row, placed at the pointer. */
export const RightClick: Story = {
	play: async ({ canvasElement, args }) => {
		const triage = row(canvasElement, /^triage\.py/);
		const rowBox = triage.getBoundingClientRect();
		// A right click at a point on the row (user-event's pointer gives no coordinates).
		fireEvent.contextMenu(triage, {
			button: 2,
			clientX: rowBox.left + 40,
			clientY: rowBox.top + rowBox.height / 2,
		});
		const el = await menu();
		const layer = el.closest("[data-slot=context-menu-popover]") as HTMLElement;
		const layerBox = layer.getBoundingClientRect();
		// Placed at the pointer: just below it, starting at its x.
		await expect(layerBox.top).toBeGreaterThanOrEqual(
			rowBox.top + rowBox.height / 2,
		);
		await expect(layerBox.top).toBeLessThanOrEqual(rowBox.bottom);
		await expect(Math.round(layerBox.left)).toBe(Math.round(rowBox.left + 40));
		await userEvent.click(
			within(el).getByRole("menuitem", { name: "Open in editor" }),
		);
		await expect(args.onAction).toHaveBeenCalledWith(
			"open-editor",
			"agents/triage.py",
		);
		await waitFor(() => expect(el).not.toBeInTheDocument());
	},
};
