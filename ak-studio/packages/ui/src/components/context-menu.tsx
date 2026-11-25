// ContextMenu: the actions for the thing under the pointer or the keyboard focus, in a region such as the Code
// tab's file tree or a table ("Open in editor", "Reveal in file manager"). Added with the shadcn CLI
// (aria-nova); its React Aria `MenuTrigger trigger="contextMenu"` wraps one pressable, and a tree or table row is
// not one (spike S1), so this version wraps a whole region and finds the row the menu is for. It shows the same
// items as Menu (MenuItem, MenuSection, MenuSeparator) in the same solid floating layer.
//
// Opening: a right click (or long press) anywhere in the region opens the menu at the pointer; Shift+F10 or the
// ContextMenu key opens it at the focused element. The target is the nearest element with a `data-key` (React
// Aria puts it on every collection row), passed to `menu` and `onAction` as a string; `null` for the region
// itself. Keyboard inside the menu as in Menu (focus starts on the first item); Escape or running an item closes
// it, and focus returns to the row it was opened from.
import {
	type KeyboardEvent,
	type MouseEvent,
	type ReactNode,
	useRef,
	useState,
} from "react";
import { type Key, Popover } from "react-aria-components";
import { cn } from "../lib/utils";
import { MenuList, menuPopover } from "./menu";

export type ContextMenuProps = {
	/** The menu's name ("File actions"). */
	"aria-label": string;
	/** The region the menu belongs to: a Tree, a DataTable, a list. */
	children: ReactNode;
	/** The items for a target (`MenuItem`s with an `id` each); return null for no menu. */
	menu: (target: string | null) => ReactNode;
	/** Called with the chosen item's id and the target. */
	onAction?: (action: Key, target: string | null) => void;
	/** Classes for the region's wrapper (it is a block box). */
	className?: string;
};

type Opened = { target: string | null; items: ReactNode };

/** The nearest element inside `region` that carries a `data-key`, starting at `from`. */
function targetOf(region: HTMLElement, from: EventTarget | null) {
	const el =
		from instanceof Element ? from.closest<HTMLElement>("[data-key]") : null;
	return el && region.contains(el) ? el : null;
}

export function ContextMenu({
	"aria-label": ariaLabel,
	children,
	menu,
	onAction,
	className,
}: ContextMenuProps) {
	const regionRef = useRef<HTMLDivElement>(null);
	// The element the menu is placed against: a zero-size point at the pointer, or the focused row.
	const pointRef = useRef<HTMLSpanElement>(null);
	const anchorRef = useRef<Element | null>(null);
	const [point, setPoint] = useState({ x: 0, y: 0 });
	// The last target and items stay while the menu animates out; `isOpen` says whether it is showing.
	const [opened, setOpened] = useState<Opened | null>(null);
	const [isOpen, setIsOpen] = useState(false);

	function open(anchor: Element, from: EventTarget | null) {
		const region = regionRef.current;
		if (!region) return;
		const row = targetOf(region, from);
		const target = row?.dataset.key ?? null;
		const items = menu(target);
		if (items === null || items === undefined) return;
		anchorRef.current = anchor;
		setOpened({ target, items });
		setIsOpen(true);
	}

	function onContextMenu(e: MouseEvent<HTMLDivElement>) {
		const region = regionRef.current;
		if (!region || !pointRef.current) return;
		e.preventDefault();
		const rect = region.getBoundingClientRect();
		setPoint({ x: e.clientX - rect.left, y: e.clientY - rect.top });
		open(pointRef.current, e.target);
	}

	function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
		const keyboardMenu =
			e.key === "ContextMenu" || (e.key === "F10" && e.shiftKey);
		if (!keyboardMenu) return;
		// Handled here on every platform, so the browser's own contextmenu event does not open a second menu.
		e.preventDefault();
		e.stopPropagation();
		const focused =
			document.activeElement instanceof Element
				? document.activeElement
				: e.currentTarget;
		open(targetOf(e.currentTarget, focused) ?? focused, focused);
	}

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: a delegate for the region's own focusable rows.
		<div
			ref={regionRef}
			data-slot="context-menu-region"
			className={cn("relative", className)}
			onContextMenu={onContextMenu}
			onKeyDown={onKeyDown}
		>
			{children}
			<span
				ref={pointRef}
				aria-hidden="true"
				className="pointer-events-none absolute size-0"
				style={{ left: point.x, top: point.y }}
			/>
			<Popover
				data-slot="context-menu-popover"
				triggerRef={anchorRef}
				isOpen={isOpen}
				onOpenChange={setIsOpen}
				placement="bottom start"
				offset={2}
				className={menuPopover}
			>
				<MenuList
					aria-label={ariaLabel}
					autoFocus="first"
					onAction={(key) => onAction?.(key, opened?.target ?? null)}
					onClose={() => setIsOpen(false)}
				>
					{opened?.items}
				</MenuList>
			</Popover>
		</div>
	);
}
