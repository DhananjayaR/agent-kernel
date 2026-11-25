// Reading a React Aria collection's children outside React Aria: used by the read-only Select, which shows the
// selected option's text without rendering a listbox.
import {
	Children,
	isValidElement,
	type ReactElement,
	type ReactNode,
} from "react";
import type { Key } from "react-aria-components";

type ItemProps = { id?: Key; textValue?: string; children?: unknown };

/**
 * The key React Aria gives an item rendered from `items`: the rendered element's `id`, else the data object's
 * `key`, else its `id` (react-aria `useCachedChildren`, 1.22.1). Static children have only their `id` prop.
 */
function itemKey(
	element: ReactElement<ItemProps>,
	item?: unknown,
): Key | undefined {
	if (element.props.id !== undefined) return element.props.id;
	if (item !== null && typeof item === "object") {
		const data = item as { key?: Key; id?: Key };
		return data.key ?? data.id;
	}
	return undefined;
}

/** An item's text: its string children, else its `textValue`. */
function itemText(element: ReactElement<ItemProps>): string | undefined {
	const { children, textValue } = element.props;
	if (typeof children === "string") return children;
	return textValue;
}

/**
 * The text of the item whose key is `key`, from static children (each with an `id`) or from `items` and a
 * render function (keyed as React Aria keys them). Undefined when no item matches.
 */
export function collectionItemText<T>(
	children: ReactNode | ((item: T) => ReactNode),
	items: Iterable<T> | undefined,
	key: Key | null | undefined,
): string | undefined {
	if (key === null || key === undefined) return undefined;
	if (typeof children === "function") {
		for (const item of items ?? []) {
			const element = children(item);
			if (!isValidElement<ItemProps>(element)) continue;
			if (itemKey(element, item) === key) return itemText(element);
		}
		return undefined;
	}
	for (const element of Children.toArray(children)) {
		if (!isValidElement<ItemProps>(element)) continue;
		if (itemKey(element) === key) return itemText(element);
	}
	return undefined;
}
