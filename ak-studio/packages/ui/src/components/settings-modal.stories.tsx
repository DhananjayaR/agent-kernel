import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { atViewport, FixtureShell, supportTriage } from "../lib/shell-fixtures";
import { expectFocusRing, expectSolidLayer, tabTo } from "../lib/story-checks";
import { Popover } from "./popover";
import { SegmentedControl, SegmentedControlItem } from "./segmented-control";
import { SettingsModal, type ThemeChoice } from "./settings-modal";
import { SettingsButton } from "./top-bar-controls";

const onThemeChange = fn();

/** The settings control and its modal, as the shell wires them (the theme kept in state, as the bridge does). */
function SettingsFromTopBar({
	initialTheme = "system",
	error,
}: {
	initialTheme?: ThemeChoice;
	error?: { title: string; description?: string };
}) {
	const [open, setOpen] = useState(false);
	const [theme, setTheme] = useState<ThemeChoice>(initialTheme);
	return (
		<FixtureShell
			project={supportTriage}
			settings={<SettingsButton onPress={() => setOpen(true)} />}
			content={
				<SettingsModal
					isOpen={open}
					onOpenChange={setOpen}
					theme={theme}
					onThemeChange={(next) => {
						setTheme(next);
						onThemeChange(next);
					}}
					error={error}
				/>
			}
		/>
	);
}

const meta = {
	title: "Shell/Settings",
	component: SettingsFromTopBar,
	beforeEach: () => {
		onThemeChange.mockClear();
	},
	...atViewport("studio1100"),
} satisfies Meta<typeof SettingsFromTopBar>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Gate question (c), the recommended answer: settings open in a Modal from the settings control at the end of the
 * top bar. In P1a it holds the theme (System, Dark, Light), applied and stored at once. Keyboard: Enter on the
 * control opens it with focus inside; arrows move between the segments and Space selects; Escape closes it and
 * focus returns to the control.
 */
export const InModal: Story = {
	play: async ({ canvasElement }) => {
		const control = within(canvasElement).getByRole("button", {
			name: "Settings",
		});
		await tabTo(control);
		await userEvent.keyboard("{Enter}");
		const dialog = await within(document.body).findByRole("dialog", {
			name: "Settings",
		});
		await expectSolidLayer(dialog.closest('[data-slot="modal"]') as Element);
		const group = within(dialog).getByRole("radiogroup", { name: "Theme" });
		await expect(group).toHaveAccessibleDescription(
			"System follows your computer's light or dark setting.",
		);
		const system = within(dialog).getByRole("radio", { name: "System" });
		await expect(system).toBeChecked();
		await tabTo(system);
		await expectFocusRing(system);
		await userEvent.keyboard("{ArrowRight} ");
		await expect(
			within(dialog).getByRole("radio", { name: "Dark" }),
		).toBeChecked();
		await expect(onThemeChange).toHaveBeenCalledWith("dark");
		await userEvent.keyboard("{Escape}");
		await waitFor(() =>
			expect(within(document.body).queryByRole("dialog")).toBeNull(),
		);
		await waitFor(() => expect(control).toHaveFocus());
	},
};

/** The theme could not be stored: an inline banner in the modal says so and what to do. */
export const SaveFailed: Story = {
	args: {
		error: {
			title: "The theme preference could not be saved.",
			description:
				"It applies until the app closes. Check that the app's data folder can be written to.",
		},
	},
	play: async ({ canvasElement }) => {
		await userEvent.click(
			within(canvasElement).getByRole("button", { name: "Settings" }),
		);
		const dialog = await within(document.body).findByRole("dialog");
		await expect(within(dialog).getByRole("alert")).toHaveTextContent(
			"The theme preference could not be saved.",
		);
	},
};

/**
 * Gate question (c), option B (not recommended): the theme in a Popover under the settings control. Quicker for
 * one setting, but P4 adds the toolchain, secrets and general settings, which do not fit a popover; the modal
 * grows into them without moving.
 */
export const OptionInPopover: Story = {
	render: () => (
		<FixtureShell
			project={supportTriage}
			settings={
				<Popover
					title="Settings"
					placement="bottom end"
					trigger={<SettingsButton />}
				>
					<SegmentedControl aria-label="Theme" defaultSelectedKey="system">
						<SegmentedControlItem id="system">System</SegmentedControlItem>
						<SegmentedControlItem id="dark">Dark</SegmentedControlItem>
						<SegmentedControlItem id="light">Light</SegmentedControlItem>
					</SegmentedControl>
				</Popover>
			}
		/>
	),
	play: async ({ canvasElement }) => {
		await userEvent.click(
			within(canvasElement).getByRole("button", { name: "Settings" }),
		);
		const dialog = await within(document.body).findByRole("dialog", {
			name: "Settings",
		});
		await waitFor(() =>
			expect(within(dialog).getByRole("radiogroup")).toBeVisible(),
		);
	},
};
