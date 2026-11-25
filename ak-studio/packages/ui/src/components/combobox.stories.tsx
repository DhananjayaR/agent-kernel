import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import {
	expectFocusRing,
	expectHeight,
	expectNoFocusRing,
	expectPlaceholderColour,
	expectStyle,
	expectTokenColour,
	hover,
	tabTo,
} from "../lib/story-checks";
import { Combobox, ComboboxItem } from "./combobox";

const MODELS = [
	"claude-sonnet-4-5",
	"claude-opus-4-1",
	"claude-haiku-4-5",
	"gpt-5",
	"gpt-5-mini",
	"gemini-2.5-pro",
];

const meta = {
	title: "Controls/Combobox",
	component: Combobox,
	args: {
		label: "Model",
		description: "Any model the framework supports.",
		allowsCustomValue: true,
		defaultInputValue: "",
		children: null,
	},
	render: (args) => (
		<Combobox {...args}>
			{MODELS.map((model) => (
				<ComboboxItem key={model} id={model}>
					{model}
				</ComboboxItem>
			))}
		</Combobox>
	),
} satisfies Meta<typeof Combobox>;

export default meta;
type Story = StoryObj<typeof meta>;

const input = (canvasElement: HTMLElement) =>
	within(canvasElement).getByRole("combobox");

export const Default: Story = {
	args: { defaultSelectedKey: "gpt-5" },
	play: async ({ canvasElement }) => {
		const field = input(canvasElement);
		await expect(field).toHaveValue("gpt-5");
		await expect(field).toHaveAccessibleName("Model");
		const group = field.parentElement as HTMLElement;
		await expectHeight(group, 32);
		await expectStyle(group, "border-top-left-radius", "8px");
		await expectStyle(group, "padding-left", "12px");
		await expectStyle(group, "padding-right", "2px");
	},
};

export const Hover: Story = {
	play: async ({ canvasElement }) => {
		const group = input(canvasElement).parentElement as HTMLElement;
		await hover(group);
		await expectTokenColour(group, "border-top-color", "border-text-muted");
	},
};

/** Keyboard focus puts the ring on the whole box; a pointer click does not. */
export const Focus: Story = {
	play: async ({ canvasElement }) => {
		const field = input(canvasElement);
		await tabTo(field);
		await expectFocusRing(field.parentElement as HTMLElement);
	},
};

export const PointerFocus: Story = {
	play: async ({ canvasElement }) => {
		const field = input(canvasElement);
		await userEvent.click(field);
		await expect(field).toHaveFocus();
		await expectNoFocusRing(field.parentElement as HTMLElement);
		await userEvent.keyboard("{Escape}");
	},
};

/** Disabled wins: with a value, while invalid, and empty (the placeholder too takes the disabled colour). */
export const Disabled: Story = {
	args: { isDisabled: true, defaultSelectedKey: "gpt-5" },
	render: (args) => (
		<div className="flex flex-col gap-4">
			<Combobox {...args}>
				{MODELS.map((model) => (
					<ComboboxItem key={model} id={model}>
						{model}
					</ComboboxItem>
				))}
			</Combobox>
			<Combobox
				label="Fallback model"
				placeholder="Choose a model"
				isDisabled
				isInvalid
				errorMessage="Choose a fallback model."
			>
				{MODELS.map((model) => (
					<ComboboxItem key={model} id={model}>
						{model}
					</ComboboxItem>
				))}
			</Combobox>
		</div>
	),
	play: async ({ canvasElement }) => {
		const fields = within(canvasElement).getAllByRole("combobox");
		for (const field of fields) {
			await expect(field).toBeDisabled();
			const group = field.parentElement as HTMLElement;
			await expect(group).toHaveAttribute("data-disabled");
			await expectTokenColour(
				group,
				"border-top-color",
				"border-disabled-border",
			);
			await expectTokenColour(field, "color", "text-disabled-text");
		}
		await expectPlaceholderColour(
			fields[1] as HTMLElement,
			"text-disabled-text",
		);
	},
};

export const Invalid: Story = {
	args: {
		defaultInputValue: "gpt-9",
		isInvalid: true,
		errorMessage:
			"This framework has no model called gpt-9. Pick one from the list.",
	},
	play: async ({ canvasElement }) => {
		const field = input(canvasElement);
		await expect(field).toHaveAttribute("aria-invalid", "true");
		const group = field.parentElement as HTMLElement;
		await expect(group).toHaveAttribute("data-invalid");
		await expectTokenColour(
			group,
			"border-top-color",
			"border-text-status-danger",
		);
	},
};

/** Read-only: shows the value, does not open, no hover change. */
export const ReadOnly: Story = {
	args: { isReadOnly: true, defaultSelectedKey: "gpt-5" },
	play: async ({ canvasElement }) => {
		const field = input(canvasElement);
		await expect(field).toHaveValue("gpt-5");
		await expect(field).toHaveAttribute("readonly");
		const group = field.parentElement as HTMLElement;
		await hover(group);
		await expectTokenColour(group, "border-top-color", "border-border-control");
	},
};

/** Keyboard: typing filters, arrows move, Enter picks; nothing matching shows the empty text. */
export const Keyboard: Story = {
	play: async ({ canvasElement }) => {
		const field = input(canvasElement);
		await tabTo(field);
		await userEvent.keyboard("claude");
		const listbox = await within(document.body).findByRole("listbox");
		await waitFor(() =>
			expect(within(listbox).getAllByRole("option")).toHaveLength(3),
		);
		await userEvent.keyboard("{ArrowDown}{ArrowDown}");
		await expect(field).toHaveAttribute(
			"aria-activedescendant",
			within(listbox).getByRole("option", { name: "claude-opus-4-1" }).id,
		);
		await userEvent.keyboard("{Enter}");
		await waitFor(() => expect(listbox).not.toBeInTheDocument());
		await expect(field).toHaveValue("claude-opus-4-1");
		await expect(field).toHaveFocus();

		await userEvent.clear(field);
		await userEvent.keyboard("llama");
		const empty = await within(document.body).findByText("No matches");
		await expect(empty).toBeVisible();
		await userEvent.keyboard("{Escape}");
	},
};
