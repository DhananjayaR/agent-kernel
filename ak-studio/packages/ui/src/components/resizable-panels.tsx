// ResizablePanels: panels the person can resize, whose sizes the app remembers (the shell's bottom panel and
// inspector; "panels resize and remember their size"). Added with the shadcn CLI as `resizable`, on
// react-resizable-panels 4.24.1 (P0 D1: one of the two components that use a second library), restyled: a 1 px
// decorative rule between panels that turns into a 2 px line in the control colour while hovered or dragged, and
// the 2 px focus ring while it has keyboard focus. The library keeps a larger invisible hit area around it. A
// `disabled` handle is a dashed rule in the disabled colour, has no tab stop and does not react to the pointer.
//
// Sizes are remembered by the caller, not here: `defaultLayout` restores them and `onLayoutChange` reports the
// layout the person asked for after each resize (pointer released or key pressed), as panel id to percentage.
// A panel can instead be sized in pixels (`defaultSize`, `minSize`, `collapsedSize` as numbers) and driven through
// its `panelRef` (collapse, resize, read its size), as the shell's bottom panel is.
// Panel ids are required so a saved layout maps to the same panels. This component never touches storage.
//
// Keyboard (react-resizable-panels, APG window splitter): Tab reaches each handle; ArrowLeft and ArrowRight (or
// Up and Down for a vertical group) resize by a step; Home and End move to the minimum and maximum; Enter
// collapses or restores a collapsible panel.
import type { ReactNode } from "react";
import {
	Group,
	type Layout,
	Panel,
	type PanelImperativeHandle,
	type PanelProps,
	Separator,
} from "react-resizable-panels";
import { cn } from "../lib/utils";

export type PanelLayout = Layout;

export type ResizablePanelsProps = {
	/** Stable id of the group (where the caller keeps its layout). */
	id: string;
	/** "horizontal": panels side by side; "vertical": stacked. */
	orientation?: "horizontal" | "vertical";
	/** The remembered layout, panel id to percentage; omitted, each panel's `defaultSize` applies. */
	defaultLayout?: PanelLayout;
	/** Called after the person resizes, with the layout to remember. */
	onLayoutChange?: (layout: PanelLayout) => void;
	/** `ResizablePanel`s with `ResizableHandle`s between them. */
	children: ReactNode;
	className?: string;
};

export function ResizablePanels({
	id,
	orientation = "horizontal",
	defaultLayout,
	onLayoutChange,
	children,
	className,
}: ResizablePanelsProps) {
	return (
		<Group
			data-slot="resizable-panels"
			id={id}
			orientation={orientation}
			defaultLayout={defaultLayout}
			onLayoutChanged={(layout, meta) => {
				if (meta.isUserInteraction)
					onLayoutChange?.(meta.requestedLayout ?? layout);
			}}
			className={cn("flex size-full", className)}
		>
			{children}
		</Group>
	);
}

/** A panel's imperative handle (`collapse`, `expand`, `resize`, `getSize`, `isCollapsed`), from `panelRef`. */
export type ResizablePanelHandle = PanelImperativeHandle;

export type ResizablePanelProps = Omit<
	PanelProps,
	"id" | "className" | "style" | "elementRef"
> & {
	/** Stable id; the key of this panel's size in a remembered layout. */
	id: string;
	children?: ReactNode;
	className?: string;
};

export function ResizablePanel({ className, ...props }: ResizablePanelProps) {
	return (
		<Panel
			data-slot="resizable-panel"
			className={cn("size-full min-h-0 min-w-0", className)}
			{...props}
		/>
	);
}

export type ResizableHandleProps = {
	/** What the handle resizes ("Resize the bottom panel"). */
	"aria-label": string;
	/** Fixed: the handle cannot be moved. */
	disabled?: boolean;
};

/**
 * The handle between two panels (role "separator", focusable). The library sets `data-separator` to its state:
 * "inactive", "hover", "active" (dragging), "focus" or "disabled".
 */
export function ResizableHandle({
	"aria-label": ariaLabel,
	disabled,
}: ResizableHandleProps) {
	return (
		<Separator
			data-slot="resizable-handle"
			aria-label={ariaLabel}
			disabled={disabled}
			className={cn(
				"group/handle relative flex shrink-0 items-center justify-center bg-border-default outline-none",
				"aria-[orientation=vertical]:w-px aria-[orientation=horizontal]:h-px",
				"focus-visible:focus-outline",
				// Fixed: a dashed rule in the disabled colour, so the person sees it cannot be dragged.
				"data-[separator=disabled]:bg-transparent data-[separator=disabled]:border-dashed data-[separator=disabled]:border-disabled-border",
				"aria-[orientation=vertical]:data-[separator=disabled]:border-s aria-[orientation=horizontal]:data-[separator=disabled]:border-t",
			)}
		>
			<span
				aria-hidden="true"
				className={cn(
					"pointer-events-none absolute bg-transparent transition-colors duration-150 motion-reduce:transition-none",
					"group-aria-[orientation=vertical]/handle:inset-y-0 group-aria-[orientation=vertical]/handle:w-0.5",
					"group-aria-[orientation=horizontal]/handle:inset-x-0 group-aria-[orientation=horizontal]/handle:h-0.5",
					"group-data-[separator=hover]/handle:bg-border-control group-data-[separator=active]/handle:bg-border-control",
				)}
			/>
		</Separator>
	);
}
