// StreamingListView's states (P1b gate step 4, design gate row (b)): output with ANSI colour collapsed to the text
// tokens, empty, following the end as lines arrive, scrolled up with "Jump to latest", earlier lines not kept, copy
// (everything held, or the selection), clear, long lines (no wrap: the list scrolls sideways, the page never does),
// 10,000 lines (only the rows in view are in the page), a failed stream, and the keyboard.
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useRef, useState } from "react";
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
function Arriving({
	start = 40,
	limit,
	clearable = false,
	resizable = false,
}: {
	start?: number;
	/** Keep only the newest `limit` lines, as the store's bounded buffer does. */
	limit?: number;
	clearable?: boolean;
	/** A story-only button that makes the list taller, as a resized panel does. */
	resizable?: boolean;
}) {
	const [lines, setLines] = useState(() => ticks(start));
	const [tall, setTall] = useState(false);
	const next = useRef(start + 1);
	const add = () => {
		const from = next.current;
		next.current += 10;
		setLines((prev) => {
			const all = [...prev, ...ticks(10, from)];
			return limit === undefined ? all : all.slice(-limit);
		});
	};
	return (
		<div className="flex flex-col gap-3">
			<StreamingListView
				label="Ticker output"
				lines={lines}
				onCopy={() => undefined}
				onClear={clearable ? () => setLines([]) : undefined}
				className={tall ? "h-96 max-w-dialog-l" : "h-64 max-w-dialog-l"}
			/>
			{resizable ? (
				<Button
					variant="outline"
					className="self-start"
					onPress={() => setTall(true)}
				>
					Make the list taller
				</Button>
			) : null}
			<Button variant="outline" className="self-start" onPress={add}>
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
		const status = within(canvasElement).getByRole("status");
		await expect(status).toHaveTextContent("Output copied");
		// The check mark goes back to the copy icon after a moment: the screenshot shows the settled state.
		await waitFor(() => expect(status.textContent).toBe(""), { timeout: 3000 });
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
		const status = within(canvasElement).getByRole("status");
		await waitFor(() => expect(status.textContent).toBe(""), { timeout: 3000 });
	},
};

/**
 * Clear empties the view (the caller hides what it held; the record stays), and following starts again: cleared
 * while scrolled up, the next lines still come into view with no "Jump to latest".
 */
export const Clear: Story = {
	render: () => <Arriving clearable />,
	play: async ({ canvasElement }) => {
		const rows = tickerRows(canvasElement);
		await waitFor(() => expect(atEnd(rows)).toBe(true));
		rows.scrollTop = 0;
		await within(canvasElement).findByRole("button", {
			name: "Jump to latest",
		});
		await userEvent.click(
			within(canvasElement).getByRole("button", { name: "Clear" }),
		);
		await expect(rows).toHaveTextContent("No output yet");
		await expect(
			within(canvasElement).queryByRole("button", { name: "Jump to latest" }),
		).toBeNull();
		const add = within(canvasElement).getByRole("button", {
			name: "Add 10 lines",
		});
		await userEvent.click(add);
		await userEvent.click(add);
		await waitFor(() =>
			expect(within(rows).getByText("Tick 60")).toBeVisible(),
		);
		await expect(atEnd(rows)).toBe(true);
		await expect(
			within(canvasElement).queryByRole("button", { name: "Jump to latest" }),
		).toBeNull();
	},
};

/** Scrolled up while the bounded buffer drops its oldest lines: the lines in view stay where they are. */
export const KeepsPlaceWhileEvicting: Story = {
	render: () => <Arriving start={60} limit={60} />,
	play: async ({ canvasElement }) => {
		const rows = tickerRows(canvasElement);
		await waitFor(() => expect(atEnd(rows)).toBe(true));
		rows.scrollTop = 20 * STREAM_ROW_HEIGHT;
		await within(canvasElement).findByRole("button", {
			name: "Jump to latest",
		});
		const before = within(rows)
			.getByText("Tick 22")
			.getBoundingClientRect().top;
		await userEvent.click(
			within(canvasElement).getByRole("button", { name: "Add 10 lines" }),
		);
		// Ticks 1 to 10 have gone from the top; Tick 22 has not moved.
		await waitFor(() => expect(within(rows).queryByText("Tick 1")).toBeNull());
		const after = within(rows).getByText("Tick 22").getBoundingClientRect().top;
		await expect(Math.abs(after - before)).toBeLessThanOrEqual(1);
		await expect(
			within(canvasElement).getByRole("button", { name: "Jump to latest" }),
		).toBeVisible();
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
		// Nothing to scroll up to: an upward wheel or ArrowUp does not stop following (no "Jump to latest").
		rows.dispatchEvent(new WheelEvent("wheel", { deltaY: -40, bubbles: true }));
		rows.dispatchEvent(
			new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }),
		);
		// Long enough for a "Jump to latest" to have rendered, had either stopped following.
		await new Promise((done) => setTimeout(done, 300));
		await expect(
			within(canvasElement).queryByRole("button", { name: "Jump to latest" }),
		).toBeNull();
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

/** Following, the box grows (a panel made taller): the browser moves the position up to fit, which is not the person scrolling, so it goes on following. */
export const FollowsWhenResized: Story = {
	render: () => <Arriving resizable />,
	play: async ({ canvasElement }) => {
		const rows = tickerRows(canvasElement);
		await waitFor(() => expect(atEnd(rows)).toBe(true));
		const before = rows.clientHeight;
		await userEvent.click(
			within(canvasElement).getByRole("button", {
				name: "Make the list taller",
			}),
		);
		await waitFor(() => expect(rows.clientHeight).toBeGreaterThan(before));
		// Let the clamped position's scroll event arrive, and anything it would render.
		await new Promise((done) => setTimeout(done, 300));
		await expect(
			within(canvasElement).queryByRole("button", { name: "Jump to latest" }),
		).toBeNull();
		await userEvent.click(
			within(canvasElement).getByRole("button", { name: "Add 10 lines" }),
		);
		await waitFor(() =>
			expect(within(rows).getByText("Tick 50")).toBeVisible(),
		);
		await expect(atEnd(rows)).toBe(true);
	},
};

/** A stream in a burst: 5 lines every 20 ms, 60 times (300 lines), then it stops, so the end state is fixed. */
function Burst() {
	const [lines, setLines] = useState(() => ticks(40));
	const [done, setDone] = useState(false);
	useEffect(() => {
		let sent = 0;
		const timer = setInterval(() => {
			sent += 1;
			setLines((prev) => [...prev, ...ticks(5, prev.length + 1)]);
			if (sent === 60) {
				clearInterval(timer);
				setDone(true);
			}
		}, 20);
		return () => clearInterval(timer);
	}, []);
	return (
		<div className="flex flex-col gap-3">
			<StreamingListView
				label="Ticker output"
				lines={lines}
				onCopy={() => undefined}
				className="h-64 max-w-dialog-l"
			/>
			<p className="text-ui text-text">{done ? "Burst over" : "Bursting"}</p>
		</div>
	);
}

/**
 * Scrolled up during a burst, by less than half a row: the list stops following at the wheel, before the next batch,
 * and stays where the person left it while lines keep arriving.
 */
export const ScrollUpDuringBurst: Story = {
	render: () => <Burst />,
	play: async ({ canvasElement }) => {
		const rows = tickerRows(canvasElement);
		await waitFor(() =>
			expect(within(rows).getByText("Tick 80")).toBeVisible(),
		);
		await expect(atEnd(rows)).toBe(true);
		// A synthetic wheel does not scroll: the wheel and its scroll, in one task, as the browser does them.
		rows.dispatchEvent(new WheelEvent("wheel", { deltaY: -4, bubbles: true }));
		rows.scrollTop -= 4;
		const left = rows.scrollTop;
		await within(canvasElement).findByText("Burst over", undefined, {
			timeout: 5000,
		});
		await expect(Math.abs(rows.scrollTop - left)).toBeLessThanOrEqual(1);
		await expect(atEnd(rows)).toBe(false);
		await expect(
			within(canvasElement).getByRole("button", { name: "Jump to latest" }),
		).toBeVisible();
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
		// ArrowUp stops following at once (before the browser has scrolled), and End follows again.
		await userEvent.keyboard("{ArrowUp}");
		await within(canvasElement).findByRole("button", {
			name: "Jump to latest",
		});
		await userEvent.keyboard("{End}");
		await waitFor(() =>
			expect(
				within(canvasElement).queryByRole("button", { name: "Jump to latest" }),
			).toBeNull(),
		);
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
