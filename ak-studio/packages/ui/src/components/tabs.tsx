// Tabs: switch between views of the same place, inside a screen (the bottom panel's Problems, Run log and
// Commands; P3's file viewer). Added with the shadcn CLI (aria-nova, React Aria `Tabs`, `TabList`, `Tab` and
// `TabPanel`), restyled to Spectrum 2's underlined tabs: 48 px items 24 px apart, 14 px labels, a 2 px indicator
// under the selected tab on a decorative rule. The selected tab is marked by the indicator (a shape) and the full
// text colour, not by colour alone; the indicator is text-accent-primary, the selection colour as a thin line
// (at least 3:1 on every surface). State colours: `tabColour` and `tabIndicatorColour` (lib/state.ts).
//
// Keyboard (React Aria, APG tabs with automatic activation): Tab enters the list on the selected tab and leaves
// it to the panel; ArrowLeft and ArrowRight move to the previous or next tab and select it (wrapping), Home and End
// to the first and last; disabled tabs are skipped. The panel is focusable when it has nothing focusable inside.
import type { ReactNode } from "react";
import {
	Tab as AriaTab,
	TabList as AriaTabList,
	type TabListProps as AriaTabListProps,
	TabPanel as AriaTabPanel,
	type TabPanelProps as AriaTabPanelProps,
	type TabProps as AriaTabProps,
	Tabs as AriaTabs,
	type TabsProps as AriaTabsProps,
} from "react-aria-components";
import { tabColour, tabIndicatorColour } from "../lib/state";
import { motion } from "../lib/styles";
import { cn } from "../lib/utils";

export type TabsProps = Omit<AriaTabsProps, "className" | "orientation"> & {
	className?: string;
};

/** The tabs and their panels. Horizontal only (the Studio has no vertical tabs). */
export function Tabs({ className, ...props }: TabsProps) {
	return (
		<AriaTabs
			data-slot="tabs"
			className={cn("flex min-h-0 flex-col", className)}
			{...props}
		/>
	);
}

export type TabListProps<T extends object> = Omit<
	AriaTabListProps<T>,
	"className" | "aria-label" | "aria-labelledby"
> & {
	className?: string;
} & ( // Named by type, like the fields: a visible heading elsewhere (`aria-labelledby`) or `aria-label`.
		| { "aria-label": string; "aria-labelledby"?: string }
		| { "aria-label"?: undefined; "aria-labelledby": string }
	);

export function TabList<T extends object>({
	className,
	...props
}: TabListProps<T>) {
	return (
		<AriaTabList
			data-slot="tab-list"
			className={cn(
				"flex shrink-0 gap-tab-gap border-b border-border-default",
				className,
			)}
			{...props}
		/>
	);
}

export type TabProps = Omit<AriaTabProps, "className" | "children"> & {
	/** The label, and optionally a Badge after it (a count, the background job notice). */
	children: ReactNode;
	/** Leading icon (Tabler outline, `@tabler/icons-react`), decorative. */
	icon?: ReactNode;
};

export function Tab({ children, icon, ...props }: TabProps) {
	return (
		<AriaTab
			data-slot="tab"
			className={({ isSelected, isHovered, isPressed, isDisabled }) =>
				cn(
					"focus-ring relative -mb-px flex h-tab cursor-default items-center gap-text-to-visual rounded-sm",
					"text-ui whitespace-nowrap outline-none select-none [&_svg]:size-4 [&_svg]:shrink-0",
					motion,
					tabColour({
						selected: isSelected,
						hovered: isHovered,
						pressed: isPressed,
						disabled: isDisabled,
					}),
				)
			}
			{...props}
		>
			{({ isSelected, isDisabled }) => {
				const indicator = tabIndicatorColour({
					selected: isSelected,
					disabled: isDisabled,
				});
				return (
					<>
						{icon ? (
							<span aria-hidden="true" className="flex">
								{icon}
							</span>
						) : null}
						{children}
						{indicator ? (
							<span
								data-slot="tab-indicator"
								aria-hidden="true"
								className={cn(
									"absolute inset-x-0 bottom-0 h-0.5 rounded-pill",
									indicator,
								)}
							/>
						) : null}
					</>
				);
			}}
		</AriaTab>
	);
}

export type TabPanelProps = Omit<AriaTabPanelProps, "className"> & {
	className?: string;
};

export function TabPanel({ className, ...props }: TabPanelProps) {
	return (
		<AriaTabPanel
			data-slot="tab-panel"
			className={cn(
				"focus-ring min-h-0 flex-1 rounded-sm pt-4 outline-none",
				className,
			)}
			{...props}
		/>
	);
}
