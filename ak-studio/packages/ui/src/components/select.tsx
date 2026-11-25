// Select: pick one value from a list (Spectrum 2 Picker); for enum-like config fields. Added with the shadcn
// CLI (aria-nova, React Aria `Select`), restyled and made a whole field (label, trigger, help text, error).
// Deviation from Spectrum 2: the trigger is outlined like a text field instead of filled, because the muted
// placeholder text drops below 4.5:1 on any neutral fill of the Studio palette (theme.css, state colours).
//
// Read-only (P3's config forms): React Aria's Select has no read-only mode, so `isReadOnly` renders the field as
// a read-only Input showing the selected option's text: focusable and selectable, never opens, same label,
// help text, error, required state and look as every other read-only field. Under `name` it submits the
// selected key (a hidden input), as the editable Select does. The option is found by React Aria's key rule
// (lib/collection.ts), so static options need an `id`.
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
import { collectionItemText } from "../lib/collection";
import { fieldBoxColours, fieldValueColour } from "../lib/state";
import {
	fieldBox,
	fieldRoot,
	floatingLayer,
	floatingMotion,
	listItem,
} from "../lib/styles";
import { cn } from "../lib/utils";
import { FieldFrame, type FieldTextProps } from "./field";
import { Input } from "./input";

export type SelectProps<T extends object> = Omit<
	AriaSelectProps<T, "single">,
	"children" | "className" | "selectionMode" | "aria-label" | "aria-labelledby"
> &
	FieldTextProps & {
		/** Options: `SelectItem`s, or a function of each of `items`. */
		children: ReactNode | ((item: T) => ReactNode);
		items?: Iterable<T>;
		/** Show the value as a read-only field (no list). */
		isReadOnly?: boolean;
		className?: string;
	};

export function Select<T extends object>({
	label,
	description,
	errorMessage,
	children,
	items,
	isReadOnly,
	className,
	...props
}: SelectProps<T>) {
	if (isReadOnly) {
		const key = props.selectedKey ?? props.defaultSelectedKey;
		const value = collectionItemText(children, items, key);
		return (
			<>
				<Input
					label={label as string}
					aria-label={props["aria-label"]}
					aria-labelledby={props["aria-labelledby"]}
					description={description}
					errorMessage={errorMessage}
					placeholder={props.placeholder}
					value={value ?? ""}
					isReadOnly
					isDisabled={props.isDisabled}
					isInvalid={props.isInvalid}
					isRequired={props.isRequired}
					className={className}
				/>
				{/* The editable Select submits the selected key under `name`; so does the read-only one. */}
				{props.name && key !== null && key !== undefined ? (
					<input
						type="hidden"
						name={props.name}
						form={props.form}
						value={String(key)}
					/>
				) : null}
			</>
		);
	}

	return (
		<AriaSelect
			data-slot="select"
			className={cn(fieldRoot, className)}
			{...props}
		>
			{({ isInvalid, isOpen, isDisabled }) => (
				<>
					<FieldFrame
						label={label}
						description={description}
						errorMessage={errorMessage}
					>
						<Button
							className={({ isHovered, isFocused }) =>
								cn(
									fieldBox,
									"press focus-ring flex cursor-default items-center justify-between gap-text-to-visual text-left",
									fieldBoxColours({
										hovered: isHovered,
										focused: isFocused,
										open: isOpen,
										invalid: isInvalid,
										disabled: isDisabled,
									}),
								)
							}
						>
							<SelectValue
								className={({ isPlaceholder }) =>
									cn(
										"flex-1 truncate",
										fieldValueColour({
											disabled: isDisabled,
											placeholder: isPlaceholder,
										}),
									)
								}
							/>
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
	/**
	 * The option's key. Give it on static options: `selectedKey` and the read-only field match on it. With
	 * `items`, it defaults (as in React Aria) to the data object's `key`, then its `id`.
	 */
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
