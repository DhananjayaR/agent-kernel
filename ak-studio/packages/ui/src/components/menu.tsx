// Menu: a list of actions opened from a button (APG menu button). Added with the shadcn CLI as `dropdown-menu`
// (aria-nova, React Aria `MenuTrigger`, `Popover` and `Menu`), restyled to Spectrum 2: the solid floating layer
// (overlay surface, decorative hairline, elevated shadow, 10 px radius, 8 px padding) and 32 px items with an 8 px
// radius and the neutral fill on hover and keyboard focus. Items can show an icon and the keyboard
// shortcut (shortcuts are shown in menus, conventions section 1). ContextMenu (context-menu.tsx) uses the same
// items. Destructive actions do not run from a menu item directly: the item opens a ConfirmModal.
//
// Keyboard (React Aria, APG menu button): Enter, Space or ArrowDown on the trigger opens the menu on the first
// item, ArrowUp on the last; ArrowUp and ArrowDown move (wrapping), Home and End jump, typing a letter moves to the
// next item starting with it; Enter or Space runs the item and closes the menu; Escape closes it; either way focus
// returns to the trigger. Tab closes the menu and moves on.
import { IconCheck } from "@tabler/icons-react";
import type { ReactElement, ReactNode } from "react";
import {
	Menu as AriaMenu,
	MenuItem as AriaMenuItem,
	type MenuItemProps as AriaMenuItemProps,
	type MenuProps as AriaMenuProps,
	MenuSection as AriaMenuSection,
	Header,
	Keyboard,
	MenuTrigger,
	type MenuTriggerProps,
	Popover,
	Separator,
	Text,
} from "react-aria-components";
import { floatingLayer, floatingMotion, listItem } from "../lib/styles";
import { cn } from "../lib/utils";

/** The menu's floating layer: solid, at least as wide as its trigger, scrolls when tall. */
export const menuPopover = cn(
	floatingLayer,
	floatingMotion,
	"min-w-(--trigger-width) overflow-auto",
);

/** The list of items inside the layer. */
export function MenuList<T extends object>({
	className,
	...props
}: Omit<AriaMenuProps<T>, "className"> & { className?: string }) {
	return (
		<AriaMenu
			data-slot="menu"
			className={cn("flex flex-col outline-none", className)}
			{...props}
		/>
	);
}

export type MenuProps<T extends object> = Omit<
	MenuTriggerProps,
	"children" | "trigger"
> &
	Omit<AriaMenuProps<T>, "className" | "children"> & {
		/** A React Aria pressable (a Button or IconButton from this package). */
		trigger: ReactElement;
		/** `MenuItem`s, `MenuSection`s and `MenuSeparator`s, or a function of each of `items`. */
		children: ReactNode | ((item: T) => ReactElement);
		placement?: "bottom start" | "bottom end" | "top start" | "top end";
	};

export function Menu<T extends object>({
	trigger,
	children,
	placement = "bottom start",
	isOpen,
	defaultOpen,
	onOpenChange,
	...props
}: MenuProps<T>) {
	return (
		<MenuTrigger
			isOpen={isOpen}
			defaultOpen={defaultOpen}
			onOpenChange={onOpenChange}
		>
			{trigger}
			<Popover
				data-slot="menu-popover"
				placement={placement}
				offset={4}
				className={menuPopover}
			>
				<MenuList {...props}>{children}</MenuList>
			</Popover>
		</MenuTrigger>
	);
}

export type MenuItemProps<T extends object = object> = Omit<
	AriaMenuItemProps<T>,
	"children" | "className" | "textValue"
> & {
	/** The label: what happens ("Open in editor"). Also what typing a letter matches. */
	children: string;
	/** Leading icon (Tabler outline, `@tabler/icons-react`), decorative. */
	icon?: ReactNode;
	/** The shortcut, as shown ("Ctrl+E"); assistive technology reads it as the item's description. */
	shortcut?: string;
};

/** One action. In a menu with `selectionMode`, a selected item shows a check mark as well as its state. */
export function MenuItem<T extends object = object>({
	children,
	icon,
	shortcut,
	...props
}: MenuItemProps<T>) {
	return (
		<AriaMenuItem
			data-slot="menu-item"
			textValue={children}
			className={listItem}
			{...props}
		>
			{({ isSelected, selectionMode }) => (
				<>
					{selectionMode !== "none" ? (
						<span className="flex size-4 shrink-0 items-center justify-center">
							{isSelected ? <IconCheck aria-hidden="true" /> : null}
						</span>
					) : null}
					{icon ? (
						<span aria-hidden="true" className="flex shrink-0">
							{icon}
						</span>
					) : null}
					<Text slot="label" className="min-w-0 flex-1 truncate">
						{children}
					</Text>
					{shortcut ? (
						// React Aria links it to the item as its description; the name stays the label.
						<Keyboard className="ms-4 shrink-0 font-ui text-ui-sm">
							{shortcut}
						</Keyboard>
					) : null}
				</>
			)}
		</AriaMenuItem>
	);
}

/** A group of items under a small heading. */
export function MenuSection<T extends object = object>({
	title,
	children,
}: {
	title: string;
	children: ReactNode | ((item: T) => ReactElement);
}) {
	return (
		<AriaMenuSection className="flex flex-col">
			<Header className="px-edge pt-2 pb-1 text-ui-sm font-action text-text-muted">
				{title}
			</Header>
			{children as ReactNode}
		</AriaMenuSection>
	);
}

/** A decorative rule between groups of items. */
export function MenuSeparator() {
	return <Separator className="mx-2 my-1 h-px bg-border-default" />;
}
