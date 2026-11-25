// Combobox: type to filter a list, pick one (Spectrum 2 ComboBox); for values with many options or free text
// with suggestions. Added with the shadcn CLI (aria-nova, React Aria `ComboBox`), restyled and made a whole field
// (label, box with its button, help text, error). Spectrum 2 padding: 12 px before the text, 4 px after the
// button. State colours: `fieldBoxColours` (lib/state.ts). Read-only keeps the box, does not open and does not
// change on hover.
import { IconCheck, IconChevronDown } from "@tabler/icons-react";
import type { ReactNode } from "react";
import {
	ComboBox as AriaComboBox,
	type ComboBoxProps as AriaComboBoxProps,
	Button,
	Group,
	Input,
	type Key,
	ListBox,
	ListBoxItem,
	type ListBoxItemProps,
	Popover,
} from "react-aria-components";
import { fieldBoxColours } from "../lib/state";
import {
	fieldBox,
	fieldRoot,
	floatingLayer,
	floatingMotion,
	listItem,
} from "../lib/styles";
import { cn } from "../lib/utils";
import { uiStrings } from "../strings";
import { FieldFrame, type FieldTextProps } from "./field";

export type ComboboxProps<T extends object> = Omit<
	AriaComboBoxProps<T>,
	"children" | "className" | "aria-label" | "aria-labelledby"
> &
	FieldTextProps & {
		/** Options: `ComboboxItem`s, or a function of each of `items`. */
		children: ReactNode | ((item: T) => ReactNode);
		placeholder?: string;
		/** Shown in the list when nothing matches what was typed (default from strings.ts). */
		emptyText?: string;
		className?: string;
	};

export function Combobox<T extends object>({
	label,
	description,
	errorMessage,
	placeholder,
	emptyText = uiStrings.combobox.noMatches,
	children,
	className,
	...props
}: ComboboxProps<T>) {
	return (
		<AriaComboBox
			data-slot="combobox"
			// Keep the list open with the empty text when nothing matches, instead of closing it.
			allowsEmptyCollection
			className={cn(fieldRoot, className)}
			{...props}
		>
			{({ isDisabled, isInvalid, isReadOnly }) => (
				<>
					<FieldFrame
						label={label}
						description={description}
						errorMessage={errorMessage}
					>
						<Group
							className={({ isHovered, isFocusWithin }) =>
								cn(
									fieldBox,
									"focus-ring flex items-center gap-1 pr-0.5",
									fieldBoxColours({
										hovered: isHovered,
										focused: isFocusWithin,
										invalid: isInvalid,
										disabled: isDisabled,
										readOnly: isReadOnly,
									}),
								)
							}
						>
							<Input
								placeholder={placeholder}
								className={cn(
									"h-full min-w-0 flex-1 bg-transparent text-ui outline-none",
									isDisabled
										? "text-disabled-text placeholder:text-disabled-text"
										: "text-text placeholder:text-text-muted",
								)}
							/>
							<Button
								className={cn(
									"press flex size-6 shrink-0 cursor-default items-center justify-center rounded-sm outline-none",
									isDisabled
										? "text-disabled-text"
										: isReadOnly
											? "text-text"
											: "text-text data-hovered:bg-fill data-pressed:bg-fill-hover",
								)}
							>
								<IconChevronDown aria-hidden="true" className="size-4" />
							</Button>
						</Group>
					</FieldFrame>
					<Popover
						offset={4}
						className={cn(
							floatingLayer,
							floatingMotion,
							"w-(--trigger-width) min-w-field-width overflow-auto",
						)}
					>
						<ListBox
							className="flex flex-col outline-none"
							renderEmptyState={() => (
								<div className="flex min-h-control-m items-center px-edge text-ui text-text-muted">
									{emptyText}
								</div>
							)}
						>
							{children}
						</ListBox>
					</Popover>
				</>
			)}
		</AriaComboBox>
	);
}

export type ComboboxItemProps = Omit<
	ListBoxItemProps,
	"children" | "className"
> & {
	id?: Key;
	children: string;
};

/** One option; its text is what typing filters on. */
export function ComboboxItem({ children, ...props }: ComboboxItemProps) {
	return (
		<ListBoxItem
			textValue={children}
			className={cn(listItem, "pr-8")}
			{...props}
		>
			{({ isSelected }) => (
				<>
					<span className="flex-1 truncate">{children}</span>
					{isSelected ? (
						<IconCheck
							aria-hidden="true"
							className="absolute right-edge size-4"
						/>
					) : null}
				</>
			)}
		</ListBoxItem>
	);
}
