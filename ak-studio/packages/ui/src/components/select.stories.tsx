import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import {
	expectFocusRing,
	expectHeight,
	expectStyle,
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
		const before = getComputedStyle(button).borderTopColor;
		await hover(button);
		await expect(getComputedStyle(button).borderTopColor).not.toBe(before);
	},
};

export const Focus: Story = {
	play: async ({ canvasElement }) => {
		const button = trigger(canvasElement);
		await tabTo(button);
		await expectFocusRing(button);
	},
};

export const Disabled: Story = {
	args: { isDisabled: true },
	play: async ({ canvasElement }) => {
		await expect(trigger(canvasElement)).toBeDisabled();
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
		await expect(button).toHaveAttribute("data-invalid");
		await expect(
			within(canvasElement).getByText("Choose where to keep sessions."),
		).toBeVisible();
	},
};

/**
 * Open: the listbox is a solid floating layer in a portal on <body>, in the story's theme (the overlay
 * surface, compared with a probe inside the story).
 */
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
