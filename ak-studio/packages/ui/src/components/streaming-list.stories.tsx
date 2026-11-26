// StreamingListView's states (P1b gate step 4, design gate row (b)): output with ANSI colour collapsed to the text
// tokens, empty, following the end as lines arrive, scrolled up with "Jump to latest", earlier lines not kept, copy
// (everything held, or the selection), clear, long lines (no wrap: the list scrolls sideways, the page never does),
// 10,000 lines (only the rows in view are in the page), a failed stream, and the keyboard.
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { expectFocusRing, tabTo, tokenColour } from "../lib/story-checks";
import { Button } from "./button";
import {
	STREAM_ROW_HEIGHT,
	StreamingListView,
	type StreamLine,
} from "./streaming-list";

const ESC = "\x1b";

/** `count` plain lines from `from`: "Tick 12". */
const ticks = (count: number, from = 1): StreamLine[] =>
	Array.from({ length: count }, (_, i) => ({
		seq: from + i - 1,
		text: `Tick ${from + i}`,
	}));

/** A test run's output, as a tool that forces colour prints it. */
const testRun: StreamLine[] = [
	{ seq: 0, channel: "info", text: "$ uv run pytest tests" },
	{ seq: 1, text: "============ test session starts ============" },
	{
		seq: 2,
		text: `tests/test_triage.py ${ESC}[32m.${ESC}[0m${ESC}[32m.${ESC}[0m${ESC}[31mF${ESC}[0m   [100%]`,
	},
	{
		seq: 3,
		text: `${ESC}[33mWARNING${ESC}[0m slack.channels is not set; skipped`,
	},
	{
		seq: 4,
		text: `${ESC}[1;31mERROR${ESC}[0m test_billing_handoff: expected billing, got triage`,
	},
	{ seq: 5, text: `${ESC}[2m(hidden lines: 12)${ESC}[0m` },
	{
		seq: 6,
		text: `${ESC}[34mblue${ESC}[0m, ${ESC}[36mcyan${ESC}[0m and ${ESC}[38;5;201m256-colour${ESC}[0m read as plain text`,
	},
	{
		seq: 7,
		text: `${ESC}[1;32m2 passed${ESC}[0m, ${ESC}[1;31m1 failed${ESC}[0m in 0.42s`,
	},
];

const meta = {
	title: "Patterns/Streaming list",
	component: StreamingListView,
	args: {
		label: "Test run output",
		lines: testRun,
		onCopy: fn(),
		onClear: fn(),
		className: "h-64 max-w-dialog-l",
	},
} satisfies Meta<typeof StreamingListView>;

export default meta;
type Story = StoryObj<typeof meta>;

const rowsOf = (root: HTMLElement) =>
	within(root).getByRole("region", { name: "Test run output" });

/** Output with colour: red, yellow and green as the status text colours, dim muted, bold kept, the rest plain. */
export const Default: Story = {
	play: async ({ canvasElement }) => {
		const rows = rowsOf(canvasElement);
		await expect(rows).toHaveAttribute("tabindex", "0");
		const row = rows.querySelector("[data-slot=stream-row]") as HTMLElement;
		await expect(row.getBoundingClientRect().height).toBe(STREAM_ROW_HEIGHT);
		await expect(getComputedStyle(row).fontFamily).toContain("JetBrains Mono");
		await expect(getComputedStyle(row).whiteSpace).toBe("pre");
		const error = within(rows).getByText("ERROR");
		await expect(error).toHaveAttribute("data-tone", "danger");
		await expect(getComputedStyle(error).color).toBe(
			tokenColour(error, "text-text-status-danger", "color"),
		);
		await expect(
			Number(getComputedStyle(error).fontWeight),
		).toBeGreaterThanOrEqual(700);
		await expect(within(rows).getByText("WARNING")).toHaveAttribute(
			"data-tone",
			"warning",
		);
		await expect(within(rows).getByText("(hidden lines: 12)")).toHaveAttribute(
			"data-tone",
			"muted",
		);
		// Blue, cyan and 256-colour codes collapse to the plain text colour: no span, no escape left.
		await expect(rows).toHaveTextContent(
			"blue, cyan and 256-colour read as plain text",
		);
		await expect(rows.textContent).not.toContain(ESC);
		// No "Jump to latest" while the end is in view.
		await expect(
			within(canvasElement).queryByRole("button", { name: "Jump to latest" }),
		).toBeNull();
	},
};

/** Nothing has arrived yet: says so; Copy and Clear wait for output. */
export const Empty: Story = {
	args: { lines: [] },
	play: async ({ canvasElement }) => {
		await expect(rowsOf(canvasElement)).toHaveTextContent("No output yet");
		await expect(
			within(canvasElement).getByRole("button", { name: "Copy" }),
		).toBeDisabled();
		await expect(
			within(canvasElement).getByRole("button", { name: "Clear" }),
		).toBeDisabled();
	},
};

/** A view with lines arriving: a story-only button adds lines, as a stream's batches do. */
function Arriving({ start = 40 }: { start?: number }) {
	const [lines, setLines] = useState(() => ticks(start));
	return (
		<div className="flex flex-col gap-3">
			<StreamingListView
				label="Ticker output"
				lines={lines}
				onCopy={() => {}}
				className="h-64 max-w-dialog-l"
			/>
			<Button
				variant="outline"
				className="self-start"
				onPress={() =>
					setLines((prev) => [...prev, ...ticks(10, prev.length + 1)])
				}
			>
				Add 10 lines
			</Button>
		</div>
	);
}

const tickerRows = (root: HTMLElement) =>
	within(root).getByRole("region", { name: "Ticker output" });
const atEnd = (el: HTMLElement) =>
	el.scrollHeight - el.scrollTop - el.clientHeight <= STREAM_ROW_HEIGHT / 2;

/** Follows the end: new lines scroll into view by themselves while the person has not scrolled up. */
export const Following: Story = {
	render: () => <Arriving />,
	play: async ({ canvasElement }) => {
		const rows = tickerRows(canvasElement);
		await waitFor(() => expect(atEnd(rows)).toBe(true));
		await userEvent.click(
			within(canvasElement).getByRole("button", { name: "Add 10 lines" }),
		);
		await waitFor(() =>
			expect(within(rows).getByText("Tick 50")).toBeVisible(),
		);
		await expect(atEnd(rows)).toBe(true);
		await expect(
			within(canvasElement).queryByRole("button", { name: "Jump to latest" }),
		).toBeNull();
	},
};

/** Scrolled up: following stops, new lines do not move the view, and "Jump to latest" brings the end back. */
export const ScrolledUp: Story = {
	render: () => <Arriving />,
	play: async ({ canvasElement }) => {
		const rows = tickerRows(canvasElement);
		await waitFor(() => expect(atEnd(rows)).toBe(true));
		rows.scrollTop = 0;
		const jump = await within(canvasElement).findByRole("button", {
			name: "Jump to latest",
		});
		await userEvent.click(
			within(canvasElement).getByRole("button", { name: "Add 10 lines" }),
		);
		await expect(rows.scrollTop).toBe(0);
		await expect(within(rows).getByText("Tick 1")).toBeVisible();
		await userEvent.click(jump);
		await waitFor(() => expect(atEnd(rows)).toBe(true));
		await expect(within(rows).getByText("Tick 50")).toBeVisible();
		// The button went away: focus is on the rows it scrolled, not the page.
		await expect(rows).toHaveFocus();
		await waitFor(() =>
			expect(
				within(canvasElement).queryByRole("button", { name: "Jump to latest" }),
			).toBeNull(),
		);
		// Scrolled up again, for the screenshot: the button at the bottom right.
		rows.scrollTop = 0;
		await within(canvasElement).findByRole("button", {
			name: "Jump to latest",
		});
	},
};

/** The buffer is bounded: the header says how many earlier lines were not kept (Copy copies what is held). */
export const Dropped: Story = {
	args: { label: "Test run output", lines: ticks(30, 1205), dropped: 1204 },
	play: async ({ canvasElement }) => {
		await expect(
			within(canvasElement).getByText("1,204 earlier lines not kept"),
		).toBeVisible();
	},
};

/** Copy: every line held, escape sequences removed, one line per line; "Copied" is announced. */
export const Copy: Story = {
	play: async ({ canvasElement, args }) => {
		await userEvent.click(
			within(canvasElement).getByRole("button", { name: "Copy" }),
		);
		await expect(args.onCopy).toHaveBeenCalledOnce();
		const copied = (args.onCopy as ReturnType<typeof fn>).mock
			.calls[0]?.[0] as string;
		await expect(copied.split("\n")).toHaveLength(testRun.length);
		await expect(copied).toContain("ERROR test_billing_handoff");
		await expect(copied).not.toContain(ESC);
		await expect(within(canvasElement).getByRole("status")).toHaveTextContent(
			"Output copied",
		);
	},
};

/** Copy with text selected inside the list copies the selection. */
export const CopySelection: Story = {
	play: async ({ canvasElement, args }) => {
		const warning = within(rowsOf(canvasElement)).getByText("WARNING");
		const range = document.createRange();
		range.selectNodeContents(warning);
		const selection = document.getSelection();
		selection?.removeAllRanges();
		selection?.addRange(range);
		await userEvent.click(
			within(canvasElement).getByRole("button", { name: "Copy" }),
		);
		await expect(args.onCopy).toHaveBeenCalledWith("WARNING");
		selection?.removeAllRanges();
	},
};

/** Clear empties the view (the caller hides what it held; the record stays). */
export const Clear: Story = {
	render: function Render(args) {
		const [lines, setLines] = useState(args.lines);
		return (
			<StreamingListView {...args} lines={lines} onClear={() => setLines([])} />
		);
	},
	play: async ({ canvasElement }) => {
		await userEvent.click(
			within(canvasElement).getByRole("button", { name: "Clear" }),
		);
		await expect(rowsOf(canvasElement)).toHaveTextContent("No output yet");
	},
};

/** No wrapping: a long line keeps its row height and scrolls sideways inside the list; the page does not. */
export const LongLines: Story = {
	args: {
		lines: [
			{
				seq: 0,
				text: `{"level":"info","agent":"triage","event":"handoff","to":"billing","reason":"the customer asked about an invoice","trace_id":"4bf92f3577b34da6a3ce929d0e0e4736"}`,
			},
			...ticks(3, 2),
		],
	},
	play: async ({ canvasElement }) => {
		const rows = rowsOf(canvasElement);
		const row = rows.querySelector("[data-slot=stream-row]") as HTMLElement;
		await expect(row.getBoundingClientRect().height).toBe(STREAM_ROW_HEIGHT);
		await expect(rows.scrollWidth).toBeGreaterThan(rows.clientWidth);
		await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(
			window.innerWidth,
		);
	},
};

/** 10,000 lines: only the rows in view (and a few either side) are in the page; the end is in view. */
export const TenThousandLines: Story = {
	args: { label: "Test run output", lines: ticks(10_000) },
	play: async ({ canvasElement }) => {
		const rows = rowsOf(canvasElement);
		await waitFor(() =>
			expect(within(rows).getByText("Tick 10000")).toBeVisible(),
		);
		const inPage = rows.querySelectorAll("[data-slot=stream-row]").length;
		await expect(inPage).toBeGreaterThan(0);
		await expect(inPage).toBeLessThan(60);
		await expect(rows.scrollHeight).toBeGreaterThanOrEqual(
			10_000 * STREAM_ROW_HEIGHT,
		);
	},
};

/** The stream failed (it is gone): what happened and what to do, above what was received. */
export const StreamFailed: Story = {
	args: {
		lines: testRun.slice(0, 3),
		error: {
			title: "The output stopped",
			description:
				"The command's output is no longer available. Run it again to see it.",
		},
	},
	play: async ({ canvasElement }) => {
		await expect(within(canvasElement).getByRole("alert")).toHaveTextContent(
			"The output stopped",
		);
	},
};

/** Keyboard: Copy, Clear, then the rows (a focusable region: arrows and Page Up and Down scroll, End follows again). */
export const Keyboard: Story = {
	render: () => <Arriving start={60} />,
	play: async ({ canvasElement }) => {
		const copy = within(canvasElement).getByRole("button", { name: "Copy" });
		await tabTo(copy);
		await expectFocusRing(copy);
		await userEvent.tab();
		const rows = tickerRows(canvasElement);
		await expect(rows).toHaveFocus();
		await expect(getComputedStyle(rows).outlineStyle).toBe("solid");
		await userEvent.keyboard("{Home}");
		await waitFor(() => expect(rows.scrollTop).toBe(0));
		await within(canvasElement).findByRole("button", {
			name: "Jump to latest",
		});
		await userEvent.keyboard("{End}");
		await waitFor(() => expect(atEnd(rows)).toBe(true));
		await waitFor(() =>
			expect(
				within(canvasElement).queryByRole("button", { name: "Jump to latest" }),
			).toBeNull(),
		);
	},
};
