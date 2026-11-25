import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import {
	expectFocusRing,
	expectHeight,
	expectNonTextContrastOnSurfaces,
	expectTokenColour,
	hover,
	tabTo,
} from "../lib/story-checks";
import { Badge } from "./badge";
import { Tab, TabList, TabPanel, Tabs, type TabsProps } from "./tabs";

function BottomPanel(args: TabsProps) {
	return (
		<Tabs {...args}>
			<TabList aria-label="Bottom panel">
				<Tab id="problems">
					Problems <Badge>3</Badge>
				</Tab>
				<Tab id="run-log">Run log</Tab>
				<Tab id="commands">Commands</Tab>
				<Tab id="trace" isDisabled>
					Trace
				</Tab>
			</TabList>
			<TabPanel id="problems">Three problems in config.yaml.</TabPanel>
			<TabPanel id="run-log">No run yet.</TabPanel>
			<TabPanel id="commands">uv sync finished in 2.4 s.</TabPanel>
			<TabPanel id="trace">Traces arrive in a later phase.</TabPanel>
		</Tabs>
	);
}

const meta = {
	title: "Structure/Tabs",
	component: Tabs,
	render: (args) => <BottomPanel {...args} />,
} satisfies Meta<typeof Tabs>;

export default meta;
type Story = StoryObj<typeof meta>;

const tab = (canvasElement: HTMLElement, name: RegExp) =>
	within(canvasElement).getByRole("tab", { name });

/**
 * 48 px tabs 24 px apart; the selected one has the full text colour and a 2 px indicator in text-accent-primary
 * (3:1 on every surface); the others are text-muted; the disabled one has the disabled colour.
 */
export const Default: Story = {
	play: async ({ canvasElement }) => {
		const problems = tab(canvasElement, /Problems/);
		const runLog = tab(canvasElement, /Run log/);
		await expect(problems).toHaveAttribute("aria-selected", "true");
		await expectHeight(problems, 48);
		await expect(
			runLog.getBoundingClientRect().left -
				problems.getBoundingClientRect().right,
		).toBe(24);
		await expectTokenColour(problems, "color", "text-text");
		await expectTokenColour(runLog, "color", "text-text-muted");
		await expectTokenColour(
			tab(canvasElement, /Trace/),
			"color",
			"text-disabled-text",
		);
		const indicator = problems.querySelector(
			"[data-slot=tab-indicator]",
		) as HTMLElement;
		await expectHeight(indicator, 2);
		await expectTokenColour(
			indicator,
			"background-color",
			"bg-text-accent-primary",
		);
		await expectNonTextContrastOnSurfaces(indicator, "background-color");
		await expect(runLog.querySelector("[data-slot=tab-indicator]")).toBeNull();
	},
};

/** Hover takes an unselected tab to the full text colour. */
export const Hover: Story = {
	play: async ({ canvasElement }) => {
		const runLog = tab(canvasElement, /Run log/);
		await hover(runLog);
		await expectTokenColour(runLog, "color", "text-text");
	},
};

/** Keyboard focus shows the 2 px ring on the selected tab. */
export const Focus: Story = {
	play: async ({ canvasElement }) => {
		const problems = tab(canvasElement, /Problems/);
		await tabTo(problems);
		await expectFocusRing(problems);
	},
};

/**
 * Keyboard model (tabs.tsx header): arrows move and select, skipping the disabled tab and wrapping; Home and
 * End; Tab moves from the list to the panel.
 */
export const Keyboard: Story = {
	play: async ({ canvasElement }) => {
		const problems = tab(canvasElement, /Problems/);
		await tabTo(problems);
		await userEvent.keyboard("{ArrowRight}");
		const runLog = tab(canvasElement, /Run log/);
		await expect(runLog).toHaveFocus();
		await expect(runLog).toHaveAttribute("aria-selected", "true");
		await userEvent.keyboard("{ArrowRight}{ArrowRight}");
		// The disabled Trace tab is skipped; the list wraps to the first tab.
		await expect(problems).toHaveFocus();
		await expect(problems).toHaveAttribute("aria-selected", "true");
		await userEvent.keyboard("{End}");
		const commands = tab(canvasElement, /Commands/);
		await expect(commands).toHaveFocus();
		await userEvent.keyboard("{Home}");
		await expect(problems).toHaveFocus();
		await userEvent.keyboard("{ArrowLeft}");
		await expect(commands).toHaveAttribute("aria-selected", "true");
		await userEvent.tab();
		const panel = within(canvasElement).getByRole("tabpanel");
		await expect(panel).toHaveFocus();
		await expect(panel).toHaveTextContent("uv sync finished");
	},
};
