import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import {
	expectHeight,
	expectInsetFocusRing,
	expectNonTextContrastOnSurfaces,
	expectStyle,
	expectTokenColour,
	hover,
	tabTo,
} from "../lib/story-checks";
import { FileTreeItem, projectFiles } from "../lib/story-fixtures";
import { Button } from "./button";
import { Modal } from "./modal";
import { Tree } from "./tree";

const meta = {
	title: "Structure/Tree",
	component: Tree,
	args: {
		"aria-label": "Project files",
		items: projectFiles,
		defaultExpandedKeys: ["agents"],
		onAction: fn(),
		children: (node: (typeof projectFiles)[number]) => (
			<FileTreeItem node={node} />
		),
	},
	render: (args) => (
		<div className="flex w-80 flex-col gap-4">
			<Tree {...args} />
			<p data-slot="marker-legend" className="text-ui-sm text-text-muted">
				<span className="font-mono font-control text-text">M</span> Changed ·{" "}
				<span className="font-mono font-control text-text">N</span> New
			</p>
			<Button>After the tree</Button>
		</div>
	),
} satisfies Meta<typeof Tree<(typeof projectFiles)[number]>>;

export default meta;
type Story = StoryObj<typeof meta>;

const row = (canvasElement: HTMLElement, name: string | RegExp) =>
	within(canvasElement).getByRole("row", { name });

/**
 * 40 px rows with a 4 px radius; each level is indented 16 px more; parents have a chevron; changed and new files
 * carry a letter marker with a hidden label (never a coloured dot).
 */
export const Default: Story = {
	play: async ({ canvasElement }) => {
		const agents = row(canvasElement, /^agents/);
		const triage = row(canvasElement, /^triage\.py/);
		await expectHeight(agents, 40);
		await expectStyle(agents, "border-top-left-radius", "4px");
		await expect(agents).toHaveAttribute("aria-expanded", "true");
		await expect(agents).toHaveAttribute("aria-level", "1");
		await expect(triage).toHaveAttribute("aria-level", "2");
		const indent = (el: HTMLElement) =>
			Number.parseFloat(getComputedStyle(el).paddingInlineStart);
		await expect(indent(triage) - indent(agents)).toBe(16);
		// The marker's meaning is in the row's name and on the marker, and a visible legend explains the letters.
		const marker = triage.querySelector(
			"[data-slot=tree-marker]",
		) as HTMLElement;
		await expect(marker).toHaveTextContent("MChanged");
		await expect(marker.querySelector(".sr-only")).toHaveTextContent("Changed");
		await expect(
			canvasElement.querySelector("[data-slot=marker-legend]"),
		).toHaveTextContent("M Changed · N New");
		await expect(triage).toHaveAccessibleName("triage.py, Changed");
		await expect(triage).toHaveTextContent("M");
		await expect(row(canvasElement, /^escalation\.py/)).toHaveAccessibleName(
			"escalation.py, New",
		);
		await expect(
			within(canvasElement).queryByRole("row", { name: /^tickets\.py/ }),
		).toBeNull();
	},
};

/** Hover moves a row to the next fill stop. */
export const Hover: Story = {
	args: { selectionMode: "single" },
	play: async ({ canvasElement }) => {
		const config = row(canvasElement, /^config\.yaml/);
		await hover(config);
		await expectTokenColour(config, "background-color", "bg-fill");
		await expectTokenColour(config, "color", "text-text");
	},
};

/**
 * Selected: the neutral fill and a 2 px start edge in text-accent-primary, which holds 3:1 on every surface (the
 * fill alone is not a cue). Hovered while selected moves the fill one more stop.
 */
export const Selected: Story = {
	args: { selectionMode: "single", defaultSelectedKeys: ["app.py"] },
	play: async ({ canvasElement }) => {
		const app = row(canvasElement, /^app\.py/);
		await expect(app).toHaveAttribute("aria-selected", "true");
		await expectTokenColour(app, "background-color", "bg-fill");
		const edge = app.querySelector("[data-slot=selection-edge]") as HTMLElement;
		await expect(edge.getBoundingClientRect().width).toBe(2);
		await expectTokenColour(edge, "background-color", "bg-text-accent-primary");
		await expectNonTextContrastOnSurfaces(edge, "background-color");
		await hover(app);
		await expectTokenColour(app, "background-color", "bg-fill-hover");
		await expect(
			row(canvasElement, /^config\.yaml/).querySelector(
				"[data-slot=selection-edge]",
			),
		).toBeNull();
	},
};

/** Disabled wins: no fill, no edge even when selected, the disabled text colour. */
export const Disabled: Story = {
	args: {
		selectionMode: "single",
		disabledKeys: ["pyproject.toml"],
		defaultSelectedKeys: ["pyproject.toml"],
	},
	play: async ({ canvasElement }) => {
		const pyproject = row(canvasElement, /^pyproject\.toml/);
		await expect(pyproject).toHaveAttribute("aria-disabled", "true");
		await expectTokenColour(pyproject, "color", "text-disabled-text");
		await expectTokenColour(pyproject, "background-color", "bg-transparent");
		await expect(
			pyproject.querySelector("[data-slot=selection-edge]"),
		).toBeNull();
	},
};

/**
 * The keyboard model (tree.tsx header): one Tab stop; arrows move, expand and collapse; Home and End; type-ahead;
 * Enter runs the action; Space selects; Tab leaves.
 */
export const Keyboard: Story = {
	args: { selectionMode: "single" },
	play: async ({ canvasElement, args }) => {
		const agents = row(canvasElement, /^agents/);
		await tabTo(agents);
		await expect(agents).toHaveFocus();
		await expectInsetFocusRing(agents);
		await userEvent.keyboard("{ArrowDown}");
		await expect(row(canvasElement, /^triage\.py/)).toHaveFocus();
		// ArrowLeft on a child moves to its parent; on an expanded parent it collapses.
		await userEvent.keyboard("{ArrowLeft}");
		await expect(agents).toHaveFocus();
		await userEvent.keyboard("{ArrowLeft}");
		await waitFor(() =>
			expect(agents).toHaveAttribute("aria-expanded", "false"),
		);
		await expect(
			within(canvasElement).queryByRole("row", { name: /^triage\.py/ }),
		).toBeNull();
		// ArrowRight expands a collapsed parent.
		await userEvent.keyboard("{ArrowRight}");
		await waitFor(() =>
			expect(agents).toHaveAttribute("aria-expanded", "true"),
		);
		await expect(agents).toHaveFocus();
		// On an expanded parent ArrowRight does nothing (React Aria); ArrowDown reaches the first child.
		await userEvent.keyboard("{ArrowRight}");
		await expect(agents).toHaveFocus();
		await userEvent.keyboard("{ArrowDown}");
		await expect(row(canvasElement, /^triage\.py/)).toHaveFocus();
		// Selection follows focus (highlight selection): End moves to the last row and selects it.
		await userEvent.keyboard("{End}");
		const pyproject = row(canvasElement, /^pyproject\.toml/);
		await expect(pyproject).toHaveFocus();
		await expect(pyproject).toHaveAttribute("aria-selected", "true");
		// Space toggles the focused row's selection.
		await userEvent.keyboard(" ");
		await expect(pyproject).toHaveAttribute("aria-selected", "false");
		await userEvent.keyboard(" ");
		await expect(pyproject).toHaveAttribute("aria-selected", "true");
		await userEvent.keyboard("{Home}");
		await expect(agents).toHaveFocus();
		// Type-ahead: "c" moves focus (not the selection) to the next visible row starting with it.
		await userEvent.keyboard("c");
		const config = row(canvasElement, /^config\.yaml/);
		await expect(config).toHaveFocus();
		// Enter runs the action (open the file) on the focused row.
		await userEvent.keyboard("{Enter}");
		await expect(args.onAction).toHaveBeenCalledWith("config.yaml");
		// Escape (outside an overlay) clears the selection; Mod+A does nothing with single selection.
		await userEvent.keyboard("{Escape}");
		await expect(
			canvasElement.querySelectorAll('[aria-selected="true"]'),
		).toHaveLength(0);
		await userEvent.keyboard("{Control>}a{/Control}");
		await expect(
			canvasElement.querySelectorAll('[aria-selected="true"]'),
		).toHaveLength(0);
		// One Tab stop: Tab leaves the tree, Shift+Tab comes back to the row last focused.
		await userEvent.tab();
		await expect(
			within(canvasElement).getByRole("button", { name: "After the tree" }),
		).toHaveFocus();
		await userEvent.tab({ shift: true });
		await expect(config).toHaveFocus();
	},
};

/** Multiple selection: Mod+A selects every visible row; Escape clears the selection. */
export const SelectAll: Story = {
	args: { selectionMode: "multiple" },
	play: async ({ canvasElement }) => {
		const rows = within(canvasElement).getAllByRole("row");
		const selected = () =>
			canvasElement.querySelectorAll('[role="row"][aria-selected="true"]');
		await tabTo(row(canvasElement, /^agents/));
		await userEvent.keyboard("{Control>}a{/Control}");
		await expect(selected()).toHaveLength(rows.length);
		await userEvent.keyboard("{Escape}");
		await expect(selected()).toHaveLength(0);
	},
};

/** Inside a modal, Escape closes the modal even while a row is selected. */
export const InAModal: Story = {
	args: { selectionMode: "single", defaultSelectedKeys: ["app.py"] },
	render: (args) => (
		<Modal title="Project files" trigger={<Button>Show files</Button>}>
			<Tree {...args} />
		</Modal>
	),
	play: async ({ canvasElement }) => {
		const opener = within(canvasElement).getByRole("button", {
			name: "Show files",
		});
		await tabTo(opener);
		await userEvent.keyboard("{Enter}");
		const dialog = await within(document.body).findByRole("dialog");
		const app = within(dialog).getByRole("row", { name: /^app\.py/ });
		await expect(app).toHaveAttribute("aria-selected", "true");
		app.focus();
		await expect(app).toHaveFocus();
		await userEvent.keyboard("{Escape}");
		await waitFor(() => expect(dialog).not.toBeInTheDocument());
		await waitFor(() => expect(opener).toHaveFocus());
	},
};
