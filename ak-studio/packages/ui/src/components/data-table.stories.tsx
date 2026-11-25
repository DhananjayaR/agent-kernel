import type { Meta, StoryObj } from "@storybook/react-vite";
import { useMemo, useState } from "react";
import type { SortDescriptor } from "react-aria-components";
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
import { Button } from "./button";
import {
	DataTable,
	DataTableBody,
	DataTableCell,
	DataTableColumn,
	DataTableHeader,
	type DataTableProps,
	DataTableRow,
} from "./data-table";
import { Modal } from "./modal";
import { StatusChip } from "./status-chip";

type Run = {
	id: string;
	command: string;
	status: "passed" | "failed";
	seconds: number;
};

const runs: Run[] = [
	{ id: "r1", command: "uv sync", status: "passed", seconds: 2.4 },
	{ id: "r2", command: "python --version", status: "passed", seconds: 0.1 },
	{ id: "r3", command: "ak inspect --json", status: "failed", seconds: 5.8 },
	// Not "running": its spinner never settles, and the checks wait for animations to end.
	{ id: "r4", command: "git rev-parse HEAD", status: "passed", seconds: 0.3 },
];

const onRowAction = fn();

/** The Commands panel's runs, sortable by command and duration. */
function Runs({
	rows = runs,
	...args
}: Partial<DataTableProps> & { rows?: Run[] }) {
	const [sort, setSort] = useState<SortDescriptor>({
		column: "command",
		direction: "ascending",
	});
	const sorted = useMemo(() => {
		const key = sort.column as "command" | "seconds";
		const list = [...rows].sort((a, b) =>
			a[key] < b[key] ? -1 : a[key] > b[key] ? 1 : 0,
		);
		return sort.direction === "descending" ? list.reverse() : list;
	}, [rows, sort]);
	return (
		<div className="flex max-w-2xl flex-col gap-4">
			<DataTable
				aria-label="Commands run"
				sortDescriptor={sort}
				onSortChange={setSort}
				{...args}
			>
				<DataTableHeader>
					<DataTableColumn id="command" isRowHeader allowsSorting>
						Command
					</DataTableColumn>
					<DataTableColumn id="status">Status</DataTableColumn>
					<DataTableColumn id="seconds" allowsSorting>
						Duration
					</DataTableColumn>
				</DataTableHeader>
				<DataTableBody
					items={sorted}
					renderEmptyState={() => (
						<p className="px-cell py-4">No commands have run yet.</p>
					)}
				>
					{(run) => (
						<DataTableRow id={run.id}>
							<DataTableCell>
								<span className="font-mono">{run.command}</span>
							</DataTableCell>
							<DataTableCell>
								<StatusChip status={run.status} />
							</DataTableCell>
							<DataTableCell>
								<span className="mono-figures">{run.seconds.toFixed(1)} s</span>
							</DataTableCell>
						</DataTableRow>
					)}
				</DataTableBody>
			</DataTable>
			<Button>After the table</Button>
		</div>
	);
}

const meta = {
	title: "Structure/Data table",
	component: DataTable,
	args: { "aria-label": "Commands run", children: null },
	render: (args) => <Runs {...args} />,
	beforeEach: () => {
		onRowAction.mockClear();
	},
} satisfies Meta<typeof DataTable>;

export default meta;
type Story = StoryObj<typeof meta>;

const rowNamed = (canvasElement: HTMLElement, name: RegExp) =>
	within(canvasElement).getByRole("row", { name });
const column = (canvasElement: HTMLElement, name: RegExp) =>
	within(canvasElement).getByRole("columnheader", { name });

/**
 * A 32 px bold header on the raised surface, 40 px rows, 16 px cell padding, a 6 px radius on a decorative
 * border; sorted by command, ascending, shown with an arrow and aria-sort.
 */
export const Default: Story = {
	play: async ({ canvasElement }) => {
		const header = column(canvasElement, /Command/);
		await expectHeight(header, 32);
		await expectStyle(header, "font-weight", "700");
		await expectStyle(header, "padding-left", "16px");
		await expect(header).toHaveAttribute("aria-sort", "ascending");
		await expect(header.querySelector("svg")).not.toBeNull();
		// A sortable column at rest shows an up-down icon (3:1 on the header); a column that does not sort shows none.
		const duration = column(canvasElement, /Duration/);
		const resting = duration.querySelector(
			"[data-slot=sort-icon]",
		) as SVGElement;
		await expect(resting).toHaveClass("lucide-chevrons-up-down");
		await expectNonTextContrastOnSurfaces(resting, "color");
		await expect(
			column(canvasElement, /Status/).querySelector("[data-slot=sort-icon]"),
		).toBeNull();
		const headerRow = header.closest("thead") as HTMLElement;
		await expectTokenColour(headerRow, "background-color", "bg-surface-raised");
		const first = rowNamed(canvasElement, /ak inspect/);
		await expectHeight(first, 40);
		const frame = canvasElement.querySelector(
			"[data-slot=data-table-frame]",
		) as HTMLElement;
		await expectStyle(frame, "border-top-left-radius", "6px");
		await expectTokenColour(frame, "border-top-color", "border-border-default");
		const bodyRows = within(canvasElement).getAllByRole("row").slice(1);
		await expect(bodyRows.map((r) => r.textContent?.split(" ")[0])).toEqual([
			"ak",
			"git",
			"python",
			"uv",
		]);
	},
};

/** Compact: 32 px rows (tables only). */
export const Compact: Story = {
	args: { density: "compact" },
	play: async ({ canvasElement }) => {
		await expectHeight(rowNamed(canvasElement, /uv sync/), 32);
	},
};

/** Hover moves a row to the next fill stop; a sortable header shows the neutral fill on hover. */
export const Hover: Story = {
	args: { selectionMode: "single" },
	play: async ({ canvasElement }) => {
		const row = rowNamed(canvasElement, /uv sync/);
		await hover(row);
		await expectTokenColour(row, "background-color", "bg-fill");
		const duration = column(canvasElement, /Duration/);
		await hover(duration);
		await expectTokenColour(duration, "background-color", "bg-fill");
	},
};

/**
 * Selected: the neutral fill and a 2 px start edge in text-accent-primary, 3:1 on every surface, so selection is
 * not colour alone.
 */
export const Selected: Story = {
	args: { selectionMode: "single", defaultSelectedKeys: ["r3"] },
	play: async ({ canvasElement }) => {
		const row = rowNamed(canvasElement, /ak inspect/);
		await expect(row).toHaveAttribute("aria-selected", "true");
		await expectTokenColour(row, "background-color", "bg-fill");
		const edges = canvasElement.querySelectorAll("[data-slot=selection-edge]");
		await expect(edges).toHaveLength(1);
		const edge = edges[0] as HTMLElement;
		await expect(row.contains(edge)).toBe(true);
		await expect(edge.getBoundingClientRect().width).toBe(2);
		await expectTokenColour(edge, "background-color", "bg-text-accent-primary");
		await expectNonTextContrastOnSurfaces(edge, "background-color");
	},
};

/** Disabled rows take the disabled text colour and no selection edge, even when selected. */
export const Disabled: Story = {
	args: {
		selectionMode: "single",
		disabledKeys: ["r4"],
		defaultSelectedKeys: ["r4"],
	},
	play: async ({ canvasElement }) => {
		const row = rowNamed(canvasElement, /git rev-parse/);
		await expect(row).toHaveAttribute("aria-disabled", "true");
		await expectTokenColour(row, "color", "text-disabled-text");
		await expect(row.querySelector("[data-slot=selection-edge]")).toBeNull();
	},
};

/** Empty: the body says what this place is for. */
export const Empty: Story = {
	render: (args) => <Runs {...args} rows={[]} />,
	play: async ({ canvasElement }) => {
		await expect(
			within(canvasElement).getByText("No commands have run yet."),
		).toBeVisible();
	},
};

/**
 * The keyboard model (data-table.tsx header): one Tab stop; arrows between rows, into cells and up to the
 * headers; Enter on a sortable header sorts; Space selects; Enter runs the row action; Tab leaves.
 */
export const Keyboard: Story = {
	args: { selectionMode: "single", onRowAction },
	play: async ({ canvasElement }) => {
		const first = rowNamed(canvasElement, /ak inspect/);
		await tabTo(first);
		await expect(first).toHaveFocus();
		await expectInsetFocusRing(first);
		await userEvent.keyboard("{ArrowDown}");
		const second = rowNamed(canvasElement, /git rev-parse/);
		await expect(second).toHaveFocus();
		// Selection follows focus (highlight selection); Space toggles it.
		await expect(second).toHaveAttribute("aria-selected", "true");
		await userEvent.keyboard(" ");
		await expect(second).toHaveAttribute("aria-selected", "false");
		await userEvent.keyboard(" ");
		await expect(second).toHaveAttribute("aria-selected", "true");
		await userEvent.keyboard("{Enter}");
		await expect(onRowAction).toHaveBeenCalledWith("r4");
		// ArrowRight moves into the row's cells, ArrowLeft back.
		await userEvent.keyboard("{ArrowRight}");
		const cell = within(second).getAllByRole("rowheader")[0] as HTMLElement;
		await expect(cell).toHaveFocus();
		await expectInsetFocusRing(cell);
		await userEvent.keyboard("{ArrowLeft}");
		await expect(second).toHaveFocus();
		await userEvent.keyboard("{End}");
		await expect(rowNamed(canvasElement, /uv sync/)).toHaveFocus();
		await userEvent.keyboard("{Home}");
		await expect(first).toHaveFocus();
		// From the first row's cell, ArrowUp reaches the column header; Enter sorts by it.
		await userEvent.keyboard("{ArrowRight}{ArrowUp}");
		const command = column(canvasElement, /Command/);
		await expect(command).toHaveFocus();
		await userEvent.keyboard("{Enter}");
		await waitFor(() =>
			expect(command).toHaveAttribute("aria-sort", "descending"),
		);
		// Escape (outside an overlay) clears the selection; Mod+A does nothing with single selection.
		await userEvent.keyboard("{ArrowDown}");
		await expect(
			canvasElement.querySelectorAll('[aria-selected="true"]'),
		).toHaveLength(1);
		await userEvent.keyboard("{Escape}");
		await expect(
			canvasElement.querySelectorAll('[aria-selected="true"]'),
		).toHaveLength(0);
		await userEvent.keyboard("{Control>}a{/Control}");
		await expect(
			canvasElement.querySelectorAll('[aria-selected="true"]'),
		).toHaveLength(0);
		// One Tab stop: Tab leaves the table.
		await userEvent.tab();
		await expect(
			within(canvasElement).getByRole("button", { name: "After the table" }),
		).toHaveFocus();
	},
};

/** Multiple selection: Mod+A selects every row; Escape clears the selection. */
export const SelectAll: Story = {
	args: { selectionMode: "multiple" },
	play: async ({ canvasElement }) => {
		const selected = () =>
			canvasElement.querySelectorAll('[role="row"][aria-selected="true"]');
		await tabTo(rowNamed(canvasElement, /ak inspect/));
		await userEvent.keyboard("{Control>}a{/Control}");
		await expect(selected()).toHaveLength(runs.length);
		await userEvent.keyboard("{Escape}");
		await expect(selected()).toHaveLength(0);
	},
};

/**
 * Inside a modal, Escape closes the modal even while a row is selected: the table leaves Escape to the overlay
 * instead of clearing its selection.
 */
export const InAModal: Story = {
	args: { selectionMode: "single", defaultSelectedKeys: ["r3"] },
	render: (args) => (
		<Modal title="Commands run" trigger={<Button>Show commands</Button>}>
			<Runs {...args} />
		</Modal>
	),
	play: async ({ canvasElement }) => {
		const opener = within(canvasElement).getByRole("button", {
			name: "Show commands",
		});
		await tabTo(opener);
		await userEvent.keyboard("{Enter}");
		const dialog = await within(document.body).findByRole("dialog");
		const row = within(dialog).getByRole("row", { name: /ak inspect/ });
		await expect(row).toHaveAttribute("aria-selected", "true");
		row.focus();
		await expect(row).toHaveFocus();
		await userEvent.keyboard("{Escape}");
		await waitFor(() => expect(dialog).not.toBeInTheDocument());
		await waitFor(() => expect(opener).toHaveFocus());
	},
};
