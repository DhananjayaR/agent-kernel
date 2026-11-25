// Tree: a hierarchy of items, such as the Code tab's file tree. Spike S1: shadcn's registry has no tree, so this
// is written by hand on React Aria `Tree` in the same style, to Spectrum 2's TreeView: 40 px rows with a 4 px
// radius, 16 px indent per level, a chevron that turns when the item is expanded, an optional icon, the title, and
// markers at the end for changed or new files: a letter shown, its label added to the row's name and kept as
// visually hidden text on the marker itself (never a dot). Show a legend near the tree (the Default story does).
//
// Rows: hover moves the fill a stop; a selected row takes the neutral fill (8%, 12% while hovered) and a 2 px start edge in
// text-accent-primary (not colour alone, at least 3:1 on every surface); disabled rows take the disabled text
// colour. Colours: `rowColours` and `rowEdgeColour` (lib/state.ts). Rows show `text`-coloured content only.
//
// Keyboard model (React Aria Tree, APG treegrid rows; asserted by the Keyboard, SelectAll and InAModal stories):
// - Tab enters the tree once, on the last focused row (the first row the first time); the next Tab leaves it.
// - ArrowDown and ArrowUp move to the next and previous visible row; Home and End to the first and last. With
//   `selectionMode`, selection follows focus (Spectrum's highlight selection, `selectionBehavior="replace"`, the
//   default here); Space toggles the focused row's selection.
// - ArrowRight expands a collapsed parent (on an expanded one it does nothing: React Aria differs from APG here,
//   and ArrowDown reaches the first child).
// - ArrowLeft collapses an expanded parent; on a child (or a collapsed parent) it moves to the parent.
// - Enter runs `onAction` (open the file).
// - Typing a letter moves focus (not the selection) to the next visible row whose title starts with it (a Space
//   typed within a second continues that search).
// - Escape: inside an overlay (Modal, Popover) it closes the overlay, even with rows selected (the collection does
//   not take it); outside, it clears a non-empty selection. Mod+A (Ctrl+A, Cmd+A on macOS) selects all visible rows with
//   `selectionMode="multiple"` and does nothing otherwise.
// The chevron is a pointer target only (not in the Tab order); Shift+F10 opens a ContextMenu wrapped around it.
import { IconChevronRight } from "@tabler/icons-react";
import type { ReactNode } from "react";
import {
	Tree as AriaTree,
	TreeItem as AriaTreeItem,
	type TreeItemProps as AriaTreeItemProps,
	type TreeProps as AriaTreeProps,
	Button,
	TreeItemContent,
} from "react-aria-components";
import { useInOverlay } from "../lib/overlay";
import { rowColours, rowEdgeColour } from "../lib/state";
import { motion } from "../lib/styles";
import { cn } from "../lib/utils";

export type TreeProps<T extends object> = Omit<
	AriaTreeProps<T>,
	"className" | "aria-label" | "aria-labelledby"
> & {
	className?: string;
} & ( // Named by type: a visible heading elsewhere (`aria-labelledby`) or `aria-label`.
		| { "aria-label": string; "aria-labelledby"?: string }
		| { "aria-label"?: undefined; "aria-labelledby": string }
	);

export function Tree<T extends object>({
	className,
	selectionBehavior = "replace",
	escapeKeyBehavior,
	...props
}: TreeProps<T>) {
	const inOverlay = useInOverlay();
	return (
		<AriaTree
			data-slot="tree"
			selectionBehavior={selectionBehavior}
			escapeKeyBehavior={
				escapeKeyBehavior ?? (inOverlay ? "none" : "clearSelection")
			}
			className={cn("flex flex-col overflow-auto outline-none", className)}
			{...props}
		/>
	);
}

export type TreeItemProps<T extends object = object> = Omit<
	AriaTreeItemProps<T>,
	"className" | "children" | "textValue"
> & {
	/** The row's text (a file or folder name); also what typing a letter matches. */
	title: string;
	/** Leading icon (Tabler outline, `@tabler/icons-react`), decorative. */
	icon?: ReactNode;
	/** At the end of the row: markers for changed or new files. Their labels are added to the row's name. */
	markers?: TreeMarker[];
	/** Child `TreeItem`s (or a `Collection` of them). */
	children?: ReactNode;
};

export function TreeItem<T extends object = object>({
	title,
	icon,
	markers,
	children,
	...props
}: TreeItemProps<T>) {
	return (
		<AriaTreeItem
			data-slot="tree-item"
			textValue={title}
			aria-label={
				markers?.length
					? [title, ...markers.map((m) => m.label)].join(", ")
					: undefined
			}
			className={({ isHovered, isPressed, isSelected, isDisabled }) =>
				cn(
					"tree-indent relative flex h-row cursor-default items-center gap-text-to-visual rounded-sm pe-edge",
					"text-ui outline-none select-none",
					"focus-ring-inset menu-target",
					motion,
					rowColours({
						hovered: isHovered,
						pressed: isPressed,
						selected: isSelected,
						disabled: isDisabled,
					}),
				)
			}
			{...props}
		>
			<TreeItemContent>
				{({ hasChildItems, isExpanded, isSelected, isDisabled }) => {
					const edge = rowEdgeColour({
						selected: isSelected,
						disabled: isDisabled,
					});
					return (
						<>
							{edge ? (
								<span
									data-slot="selection-edge"
									aria-hidden="true"
									className={cn(
										"absolute inset-y-0 start-0 w-0.5 rounded-pill",
										edge,
									)}
								/>
							) : null}
							{hasChildItems ? (
								<Button
									slot="chevron"
									className="flex size-control-s shrink-0 cursor-default items-center justify-center rounded-sm outline-none"
								>
									<IconChevronRight
										aria-hidden="true"
										className={cn(
											"size-4 transition-transform duration-150 motion-reduce:transition-none",
											isExpanded ? "rotate-90" : null,
										)}
									/>
								</Button>
							) : (
								<span aria-hidden="true" className="size-control-s shrink-0" />
							)}
							{icon ? (
								<span
									aria-hidden="true"
									className="flex shrink-0 [&_svg]:size-4"
								>
									{icon}
								</span>
							) : null}
							<span className="min-w-0 flex-1 truncate">{title}</span>
							{markers?.length ? (
								<span className="flex shrink-0 items-center gap-1 font-mono text-ui-sm font-control">
									{markers.map((m) => (
										<span key={m.label} data-slot="tree-marker" title={m.label}>
											<span aria-hidden="true">{m.letter}</span>
											<span className="sr-only">{m.label}</span>
										</span>
									))}
								</span>
							) : null}
						</>
					);
				}}
			</TreeItemContent>
			{children}
		</AriaTreeItem>
	);
}

/**
 * A file marker: a monospace letter in the text colour (a status colour would drop below 4.5:1 on a selected
 * row's fill) whose label joins the row's name, so the meaning is never a colour or a lone letter. P3's design
 * gate settles which markers exist; this is the slot's shape.
 */
export type TreeMarker = {
	/** One or two characters shown ("M", "N"). */
	letter: string;
	/** What it means ("Changed", "New"). */
	label: string;
};
