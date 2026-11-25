// Combobox: type to filter a list, pick one (Spectrum 2 ComboBox); for values with many options or free text
// with suggestions. Added with the shadcn CLI (aria-nova, React Aria `ComboBox`), restyled and made a whole field
// (label, box with its button, help text, error). Spectrum 2 padding: 12 px before the text, 4 px after the
// button.
import { CheckIcon, ChevronDownIcon } from "lucide-react";
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
import {
	fieldBox,
	fieldRoot,
	floatingLayer,
	floatingMotion,
	listItem,
} from "../lib/styles";
import { cn } from "../lib/utils";
import { FieldFrame, type FieldTextProps } from "./field";

export type ComboboxProps<T extends object> = Omit<
	AriaComboBoxProps<T>,
	"children" | "className"
> &
	FieldTextProps & {
		/** Options: `ComboboxItem`s, or a function of each of `items`. */
		children: ReactNode | ((item: T) => ReactNode);
		placeholder?: string;
		/** Shown in the list when nothing matches what was typed. */
		emptyText?: string;
		className?: string;
	};

export function Combobox<T extends object>({
	label,
	description,
	errorMessage,
	placeholder,
	emptyText = "No matches",
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
			<FieldFrame
				label={label}
				description={description}
				errorMessage={errorMessage}
			>
				<Group
					className={cn(fieldBox, "focus-ring flex items-center gap-1 pr-0.5")}
				>
					<Input
						placeholder={placeholder}
						className="h-full min-w-0 flex-1 bg-transparent text-ui text-text outline-none placeholder:text-text-muted disabled:text-disabled-text"
					/>
					<Button className="press flex size-6 shrink-0 cursor-default items-center justify-center rounded-sm text-text outline-none data-disabled:text-disabled-text data-hovered:bg-fill data-pressed:bg-fill-hover">
						<ChevronDownIcon aria-hidden="true" className="size-4" />
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
						<CheckIcon
							aria-hidden="true"
							className="absolute right-edge size-4"
						/>
					) : null}
				</>
			)}
		</ListBoxItem>
	);
}
