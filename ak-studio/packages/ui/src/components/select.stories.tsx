import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import {
	expectFocusRing,
	expectHeight,
	expectInsetFocusRing,
	expectStyle,
	expectTokenColour,
	hover,
	settle,
	tabTo,
} from "../lib/story-checks";
import { Select, SelectItem, type SelectProps } from "./select";

function SessionStores(args: SelectProps<object>) {
	return (
		<Select {...args}>
			<SelectItem id="in-memory">In memory</SelectItem>
			<SelectItem id="redis">Redis</SelectItem>
			<SelectItem id="dynamodb">DynamoDB</SelectItem>
			<SelectItem id="cosmosdb">Cosmos DB</SelectItem>
		</Select>
	);
}

const meta = {
	title: "Controls/Select",
	component: Select,
	args: {
		label: "Session store",
		description: "Where conversations are kept between runs.",
		defaultSelectedKey: "redis",
		children: null,
	},
	render: (args) => <SessionStores {...args} />,
} satisfies Meta<typeof Select>;

export default meta;
type Story = StoryObj<typeof meta>;

const trigger = (canvasElement: HTMLElement) =>
	within(canvasElement).getByRole("button", { name: /Session store/ });

export const Default: Story = {
	play: async ({ canvasElement }) => {
		const button = trigger(canvasElement);
		await expect(button).toHaveTextContent("Redis");
		await expectHeight(button, 32);
		await expectStyle(button, "border-top-left-radius", "8px");
		await expectStyle(button, "padding-left", "12px");
		await expect(button.getBoundingClientRect().width).toBe(208);
	},
};

export const WithPlaceholder: Story = {
	args: { defaultSelectedKey: undefined, placeholder: "Choose a store" },
};

export const Hover: Story = {
	play: async ({ canvasElement }) => {
		const button = trigger(canvasElement);
		await hover(button);
		await expectTokenColour(button, "border-top-color", "border-text-muted");
	},
};

export const Focus: Story = {
	play: async ({ canvasElement }) => {
		const button = trigger(canvasElement);
		await tabTo(button);
		await expectFocusRing(button);
	},
};

/** Disabled wins: with a value, while invalid, and empty (the placeholder too takes the disabled colour). */
export const Disabled: Story = {
	args: { isDisabled: true },
	render: (args) => (
		<div className="flex flex-col gap-4">
			<SessionStores {...args} />
			<SessionStores
				{...args}
				label="Fallback store"
				description={undefined}
				defaultSelectedKey={undefined}
				placeholder="Choose a store"
				isInvalid
				errorMessage="Choose a fallback store."
			/>
		</div>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		for (const name of [/Session store/, /Fallback store/]) {
			const button = canvas.getByRole("button", { name });
			await expect(button).toBeDisabled();
			await expectTokenColour(
				button,
				"border-top-color",
				"border-disabled-border",
			);
			await expectTokenColour(button, "color", "text-disabled-text");
		}
		const placeholder = canvas
			.getByRole("button", { name: /Fallback store/ })
			.querySelector("[data-placeholder]") as HTMLElement;
		await expectTokenColour(placeholder, "color", "text-disabled-text");
	},
};

export const Invalid: Story = {
	args: {
		defaultSelectedKey: undefined,
		placeholder: "Choose a store",
		isInvalid: true,
		errorMessage: "Choose where to keep sessions.",
	},
	play: async ({ canvasElement }) => {
		const button = trigger(canvasElement);
		await expectTokenColour(
			button,
			"border-top-color",
			"border-text-status-danger",
		);
		// Focused, it stays danger (Spectrum 2: focused invalid is negative too).
		await tabTo(button);
		await expectTokenColour(
			button,
			"border-top-color",
			"border-text-status-danger",
		);
		await expect(
			within(canvasElement).getByText("Choose where to keep sessions."),
		).toBeVisible();
	},
};

/**
 * Open: the listbox is a solid floating layer in a portal on <body>, in the story's theme (the overlay
 * surface, compared with a probe inside the story).
 */
/**
 * Read-only, as in P3's config forms: React Aria's Select has no read-only mode, so it renders as a read-only
 * text field showing the selected option's text. Focusable, never opens, no hover change.
 */
export const ReadOnly: Story = {
	args: { isReadOnly: true, description: "Set in config.yaml." },
	play: async ({ canvasElement }) => {
		const field = within(canvasElement).getByRole("textbox", {
			name: "Session store",
		});
		await expect(field).toHaveValue("Redis");
		await expect(field).toHaveAttribute("readonly");
		await expect(within(canvasElement).queryByRole("button")).toBeNull();
		await hover(field);
		await expectTokenColour(field, "border-top-color", "border-border-control");
	},
};

/**
 * Read-only keeps the field's invalid, required and error state, and submits the selected key (not its text)
 * under `name`, as the editable Select does.
 */
export const ReadOnlyInvalidRequired: Story = {
	args: {
		isReadOnly: true,
		isRequired: true,
		isInvalid: true,
		name: "session_store",
		errorMessage: "Redis is not installed in this environment.",
	},
	render: (args) => (
		<form aria-label="Config">
			<SessionStores {...args} />
		</form>
	),
	play: async ({ canvasElement }) => {
		const field = within(canvasElement).getByRole("textbox", {
			name: /Session store/,
		});
		await expect(field).toHaveValue("Redis");
		await expect(field).toHaveAttribute("readonly");
		await expect(field).toHaveAttribute("aria-invalid", "true");
		await expect(field).toBeRequired();
		await expect(field).not.toHaveAttribute("name");
		await expectTokenColour(
			field,
			"border-top-color",
			"border-text-status-danger",
		);
		await expect(
			within(canvasElement).getByText(
				"Redis is not installed in this environment.",
			),
		).toBeVisible();
		const form = canvasElement.querySelector("form") as HTMLFormElement;
		await expect(new FormData(form).get("session_store")).toBe("redis");
	},
};

/** Read-only and disabled: like a disabled editable Select, it submits nothing under `name`. */
export const ReadOnlyDisabled: Story = {
	args: { isReadOnly: true, isDisabled: true, name: "session_store" },
	render: (args) => (
		<form aria-label="Config">
			<SessionStores {...args} />
		</form>
	),
	play: async ({ canvasElement }) => {
		const form = canvasElement.querySelector("form") as HTMLFormElement;
		await expect(new FormData(form).has("session_store")).toBe(false);
	},
};

const stores = [
	{ id: "in-memory", name: "In memory" },
	{ id: "redis", name: "Redis" },
	{ id: "dynamodb", name: "DynamoDB" },
];

/** Read-only with `items` and options without an explicit `id`: the key comes from each item's `id`. */
export const ReadOnlyFromItems: Story = {
	args: { isReadOnly: true, defaultSelectedKey: "dynamodb" },
	render: (args) => (
		<Select {...args} items={stores}>
			{(store: (typeof stores)[number]) => (
				<SelectItem>{store.name}</SelectItem>
			)}
		</Select>
	),
	play: async ({ canvasElement }) => {
		const field = within(canvasElement).getByRole("textbox", {
			name: "Session store",
		});
		await expect(field).toHaveValue("DynamoDB");
	},
};

/** The same `items` editable: React Aria keys them the same way, so both views agree. */
export const FromItems: Story = {
	args: { defaultSelectedKey: "dynamodb" },
	render: ReadOnlyFromItems.render,
	play: async ({ canvasElement }) => {
		await expect(trigger(canvasElement)).toHaveTextContent("DynamoDB");
	},
};

export const Open: Story = {
	render: (args) => (
		<div className="flex flex-col gap-4">
			<span
				data-probe
				aria-hidden="true"
				className="block size-4 bg-surface-overlay"
			/>
			<SessionStores {...args} />
		</div>
	),
	play: async ({ canvasElement }) => {
		await userEvent.click(trigger(canvasElement));
		const listbox = await within(document.body).findByRole("listbox");
		const popover = listbox.parentElement as HTMLElement;
		await settle(popover);
		const probe = canvasElement.querySelector("[data-probe]") as HTMLElement;
		await expect(getComputedStyle(popover).backgroundColor).toBe(
			getComputedStyle(probe).backgroundColor,
		);
		await expectStyle(popover, "border-top-left-radius", "10px");
		const options = within(listbox).getAllByRole("option");
		await expect(options).toHaveLength(4);
		await expectHeight(options[0] as HTMLElement, 32);
	},
};

/** Keyboard: Tab to the trigger, arrows open and move, Enter picks, Escape-free close; type-ahead works. */
export const Keyboard: Story = {
	play: async ({ canvasElement }) => {
		const button = trigger(canvasElement);
		await tabTo(button);
		await userEvent.keyboard("{ArrowDown}");
		const listbox = await within(document.body).findByRole("listbox");
		await waitFor(() =>
			expect(
				within(listbox).getByRole("option", { name: "Redis" }),
			).toHaveFocus(),
		);
		// The focused option shows the inset 2 px ring (keyboard only).
		await expectInsetFocusRing(
			within(listbox).getByRole("option", { name: "Redis" }),
		);
		await userEvent.keyboard("{ArrowDown}");
		await expect(
			within(listbox).getByRole("option", { name: "DynamoDB" }),
		).toHaveFocus();
		await userEvent.keyboard("{Enter}");
		await waitFor(() => expect(listbox).not.toBeInTheDocument());
		await expect(button).toHaveTextContent("DynamoDB");
		await expect(button).toHaveFocus();
		// Type-ahead on the closed trigger selects by the option's text.
		await userEvent.keyboard("c");
		await waitFor(() => expect(button).toHaveTextContent("Cosmos DB"));
	},
};
