// Select: pick one value from a list (Spectrum 2 Picker); for enum-like config fields. Added with the shadcn
// CLI (aria-nova, React Aria `Select`), restyled and made a whole field (label, trigger, help text, error).
// Deviation from Spectrum 2: the trigger is outlined like a text field instead of filled, because the muted
// placeholder text drops below 4.5:1 on any neutral fill of the Studio palette (theme.css, state colours).
import { CheckIcon, ChevronDownIcon } from "lucide-react";
import type { ReactNode } from "react";
import {
	Select as AriaSelect,
	type SelectProps as AriaSelectProps,
	Button,
	type Key,
	ListBox,
	ListBoxItem,
	type ListBoxItemProps,
	Popover,
	SelectValue,
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

export type SelectProps<T extends object> = Omit<
	AriaSelectProps<T, "single">,
	"children" | "className" | "selectionMode"
> &
	FieldTextProps & {
		/** Options: `SelectItem`s, or a function of each of `items`. */
		children: ReactNode | ((item: T) => ReactNode);
		items?: Iterable<T>;
		className?: string;
	};

export function Select<T extends object>({
	label,
	description,
	errorMessage,
	children,
	items,
	className,
	...props
}: SelectProps<T>) {
	return (
		<AriaSelect
			data-slot="select"
			className={cn(fieldRoot, className)}
			{...props}
		>
			{({ isInvalid }) => (
				<>
					<FieldFrame
						label={label}
						description={description}
						errorMessage={errorMessage}
					>
						<Button
							// The trigger carries the field's invalid state, so the box styles apply to it directly.
							data-invalid={isInvalid || undefined}
							className={cn(
								fieldBox,
								"press focus-ring flex cursor-default items-center justify-between gap-text-to-visual text-left",
								"not-data-invalid:aria-expanded:border-text",
							)}
						>
							<SelectValue className="flex-1 truncate data-placeholder:text-text-muted" />
							<ChevronDownIcon aria-hidden="true" className="size-4 shrink-0" />
						</Button>
					</FieldFrame>
					<Popover
						offset={4}
						className={cn(
							floatingLayer,
							floatingMotion,
							"w-(--trigger-width) min-w-field-width overflow-auto",
						)}
					>
						<ListBox items={items} className="flex flex-col outline-none">
							{children}
						</ListBox>
					</Popover>
				</>
			)}
		</AriaSelect>
	);
}

export type SelectItemProps = Omit<
	ListBoxItemProps,
	"children" | "className"
> & {
	id?: Key;
	children: string;
};

/** One option; its text is also what type-to-select matches. */
export function SelectItem({ children, ...props }: SelectItemProps) {
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
