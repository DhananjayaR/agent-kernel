// Segmented control: choose one of a few views or modes, shown side by side (the theme preference; a view
// switch). Added with the shadcn CLI as `toggle-group` (aria-nova, React Aria `ToggleButtonGroup`), restyled:
// a 32 px group with a 2 px control border; the selected segment fills with the primary (selection) colour
// and is edged in text-accent-primary (at least 3:1 on every surface). State colours: `segmentColours`.
// Keyboard (React Aria's toolbar model): Tab enters the group, arrow keys move between segments, Space or
// Enter selects; one segment is always selected.
import type { ReactNode } from "react";
import {
	type Key,
	ToggleButton,
	ToggleButtonGroup,
	type ToggleButtonProps,
} from "react-aria-components";
import { segmentColours } from "../lib/state";
import { motion } from "../lib/styles";
import { cn } from "../lib/utils";

type Labelled =
	| { "aria-label": string; "aria-labelledby"?: string }
	| { "aria-label"?: string; "aria-labelledby": string };

export type SegmentedControlProps = Labelled & {
	/** Help text for the whole group (its id). */
	"aria-describedby"?: string;
	selectedKey?: Key;
	defaultSelectedKey?: Key;
	onSelectionChange?: (key: Key) => void;
	isDisabled?: boolean;
	children: ReactNode;
	className?: string;
};

export function SegmentedControl({
	selectedKey,
	defaultSelectedKey,
	onSelectionChange,
	className,
	children,
	...props
}: SegmentedControlProps) {
	return (
		<ToggleButtonGroup
			data-slot="segmented-control"
			selectionMode="single"
			disallowEmptySelection
			selectedKeys={selectedKey === undefined ? undefined : [selectedKey]}
			defaultSelectedKeys={
				defaultSelectedKey === undefined ? undefined : [defaultSelectedKey]
			}
			onSelectionChange={(keys) => {
				const [key] = keys;
				if (key !== undefined) onSelectionChange?.(key);
			}}
			className={cn(
				"inline-flex h-control-m items-center gap-0.5 rounded-control border-2 border-border-control p-0.5",
				"data-disabled:border-disabled-border",
				className,
			)}
			{...props}
		>
			{children}
		</ToggleButtonGroup>
	);
}

export type SegmentedControlItemProps = Omit<
	ToggleButtonProps,
	"children" | "className" | "id"
> & {
	id: Key;
	/** Leading icon (lucide-react). With no text, give the item an `aria-label`. */
	icon?: ReactNode;
	children?: ReactNode;
};

export function SegmentedControlItem({
	icon,
	children,
	...props
}: SegmentedControlItemProps) {
	return (
		<ToggleButton
			className={({ isSelected, isHovered, isPressed, isDisabled }) =>
				cn(
					"press focus-ring flex h-full cursor-default items-center gap-text-to-visual rounded-sm border-2 px-2 text-ui font-action outline-none select-none",
					motion,
					segmentColours({
						selected: isSelected,
						hovered: isHovered,
						pressed: isPressed,
						disabled: isDisabled,
					}),
					"[&_svg]:size-4 [&_svg]:shrink-0",
				)
			}
			{...props}
		>
			{icon}
			{children}
		</ToggleButton>
	);
}
