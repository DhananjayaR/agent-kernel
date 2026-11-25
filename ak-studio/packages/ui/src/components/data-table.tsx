// DataTable: rows of records with columns (the Commands panel's runs, the toolchain check, the Problems panel).
// Added with the shadcn CLI as `table` (aria-nova, React Aria `Table`), restyled to Spectrum 2's TableView: a
// decorative 1 px border with a 6 px radius, a 32 px header in bold on the raised surface, 40 px rows (32 px
// with `density="compact"`), 16 px cell padding, decorative rules between rows. Not virtualised: it renders
// every row. Virtualising it (React Aria `Virtualizer` with `TableLayout`, as spike S1 did) is left to the
// first table that needs thousands of rows.
//
// Rows: hover moves the fill a stop; a selected row takes a stronger fill and a 2 px start edge in
// text-accent-primary, so selection is not colour alone and holds 3:1 on every surface; disabled rows take the
// disabled text colour. Colours come from `rowColours` and `rowEdgeColour` (lib/state.ts). Cells show `text`-
// coloured content only: muted text drops below 4.5:1 on a row fill. Sortable columns show the direction with an
// arrow icon (and `aria-sort`).
//
// Keyboard model (React Aria Table, APG grid; every line is asserted by the Keyboard story):
// - Tab enters the table once, on the last focused row (the first row the first time); the next Tab leaves it.
// - ArrowDown and ArrowUp move between rows; Home and End to the first and last row. With `selectionMode`,
//   selection follows focus (Spectrum's highlight selection, `selectionBehavior="replace"`, the default here);
//   Space toggles the focused row's selection.
// - Enter runs `onRowAction` on the focused row.
// - ArrowRight moves from a row into its cells, ArrowLeft back to the row; ArrowUp from a cell in the first row
//   reaches the column header, where Enter sorts a sortable column (again: the other direction).
import { ArrowDownIcon, ArrowUpIcon } from "lucide-react";
import { createContext, type ReactNode, useContext } from "react";
import {
	Table as AriaTable,
	type TableProps as AriaTableProps,
	Cell,
	type CellProps,
	Column,
	type ColumnProps,
	Row,
	type RowProps,
	TableBody,
	type TableBodyProps,
	TableHeader,
	type TableHeaderProps,
} from "react-aria-components";
import { rowColours, rowEdgeColour } from "../lib/state";
import { motion } from "../lib/styles";
import { cn } from "../lib/utils";

export type TableDensity = "regular" | "compact";

const DensityContext = createContext<TableDensity>("regular");

/** An inset 2 px focus ring on the focused row, cell or header (the cells sit edge to edge). */
const insetFocus = "outline-none focus-ring-inset";

export type DataTableProps = Omit<
	AriaTableProps,
	"className" | "aria-label" | "aria-labelledby"
> & {
	/** 40 px rows (default) or 32 px. */
	density?: TableDensity;
	/** Classes for the scrolling frame around the table (a height, for example). */
	className?: string;
} & ( // Named by type: a visible heading elsewhere (`aria-labelledby`) or `aria-label`.
		| { "aria-label": string; "aria-labelledby"?: string }
		| { "aria-label"?: undefined; "aria-labelledby": string }
	);

export function DataTable({
	density = "regular",
	selectionBehavior = "replace",
	className,
	...props
}: DataTableProps) {
	return (
		<DensityContext.Provider value={density}>
			<div
				data-slot="data-table-frame"
				className={cn(
					"relative w-full overflow-auto rounded-table border border-border-default",
					className,
				)}
			>
				<AriaTable
					data-slot="data-table"
					data-density={density}
					selectionBehavior={selectionBehavior}
					className="w-full border-collapse text-left text-ui text-text"
					{...props}
				/>
			</div>
		</DensityContext.Provider>
	);
}

export function DataTableHeader<T extends object>({
	className,
	...props
}: Omit<TableHeaderProps<T>, "className"> & { className?: string }) {
	return (
		<TableHeader
			data-slot="data-table-header"
			className={cn(
				"sticky top-0 z-10 border-b border-border-default bg-surface-raised",
				className,
			)}
			{...props}
		/>
	);
}

export type DataTableColumnProps = Omit<
	ColumnProps,
	"className" | "children"
> & {
	/** The column's name. */
	children: string;
	className?: string;
};

export function DataTableColumn({
	children,
	className,
	...props
}: DataTableColumnProps) {
	return (
		<Column
			data-slot="data-table-column"
			className={({ allowsSorting, isHovered }) =>
				cn(
					"h-row-compact px-cell text-ui font-control whitespace-nowrap",
					insetFocus,
					motion,
					allowsSorting && isHovered ? "bg-fill" : null,
					className,
				)
			}
			{...props}
		>
			{({ sortDirection }) => (
				<span className="flex items-center gap-text-to-visual">
					{children}
					{sortDirection === "ascending" ? (
						<ArrowUpIcon aria-hidden="true" className="size-4 shrink-0" />
					) : sortDirection === "descending" ? (
						<ArrowDownIcon aria-hidden="true" className="size-4 shrink-0" />
					) : null}
				</span>
			)}
		</Column>
	);
}

export function DataTableBody<T extends object>({
	className,
	...props
}: Omit<TableBodyProps<T>, "className"> & { className?: string }) {
	return (
		<TableBody
			data-slot="data-table-body"
			className={cn(
				"[&>tr:last-child]:border-b-0 data-empty:text-text-muted",
				className,
			)}
			{...props}
		/>
	);
}

export function DataTableRow<T extends object>({
	className,
	...props
}: Omit<RowProps<T>, "className"> & { className?: string }) {
	const density = useContext(DensityContext);
	return (
		<Row
			data-slot="data-table-row"
			className={({ isHovered, isPressed, isSelected, isDisabled }) =>
				cn(
					"border-b border-border-default",
					density === "compact" ? "h-row-compact" : "h-row",
					insetFocus,
					motion,
					rowColours({
						hovered: isHovered,
						pressed: isPressed,
						selected: isSelected,
						disabled: isDisabled,
					}),
					className,
				)
			}
			{...props}
		/>
	);
}

export type DataTableCellProps = Omit<CellProps, "className" | "children"> & {
	children?: ReactNode;
	className?: string;
};

export function DataTableCell({
	children,
	className,
	...props
}: DataTableCellProps) {
	return (
		<Cell
			data-slot="data-table-cell"
			className={cn("relative px-cell", insetFocus, className)}
			{...props}
		>
			{({ isSelected, isDisabled, columnIndex }) => {
				const edge =
					columnIndex === 0
						? rowEdgeColour({ selected: isSelected, disabled: isDisabled })
						: null;
				return (
					<>
						{edge ? (
							<span
								data-slot="selection-edge"
								aria-hidden="true"
								className={cn("absolute inset-y-0 start-0 w-0.5", edge)}
							/>
						) : null}
						{children}
					</>
				);
			}}
		</Cell>
	);
}
