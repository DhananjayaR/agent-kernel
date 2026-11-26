// StreamingListView: streamed output, one line per row (the streaming list pattern: logs, command output, agent
// events; P1b design gate row (b), signed off 26 November 2026). Presentational: the connected StreamingList (the
// renderer's shared/patterns) fills it from the stream store, which keeps a bounded buffer (the newest lines).
//
// - **No wrapping.** Every row is one fixed height (STREAM_ROW_HEIGHT), so the list is virtualised with TanStack
//   Virtual: only the rows in view (and a few either side) are in the page, whatever the buffer holds. A long line
//   scrolls sideways inside the list; the page itself never does. Copy gives the full text of every line.
// - **Colour.** ANSI colour is collapsed to the text tokens by lib/ansi.ts (red, yellow and green to the status text
//   colours, dim to muted, bold kept, the rest plain); the text still says "ERROR", so it is never colour alone.
//   The app's own notes (channel `info`) are muted.
// - **Follows the end** until the person scrolls up; then "Jump to latest" shows at the bottom right. Following is
//   decided by what the person does, never by the position alone: an upward wheel, ArrowUp, Page Up or Home on the
//   rows, or grabbing the scrollbar stops it at once (when there is anything to scroll), before the next batch can
//   snap the list back (a batch can land every frame); so does a scroll of theirs that moved up away from the end.
//   The box growing (the browser moves the position up to fit) is not the person, and does not stop it. It resumes
//   when they move down to the end (by wheel, keys or the scrollbar), press End, or press "Jump to latest", and when
//   the box grows until the end is in view. The list's own scrolls (following, keeping place) never change it.
//   While not following, lines evicted from the top of the buffer do not move what is in view.
// - **Header.** The label, a note when earlier lines were not kept ("120 earlier lines not kept": Copy then copies
//   less than the whole output), "Copy" (the selection inside the list if there is one, else every line held; a
//   callback: this package makes no clipboard call) and "Clear" (empties the view; the record stays).
// - **Keyboard.** The rows are one focusable region named by the label: arrows, Page Up and Down, Home and End
//   scroll it. Lines are not announced as they arrive (a burst would drown a screen reader); "Copied" is.
import {
	IconArrowDown,
	IconCheck,
	IconCopy,
	IconEraser,
} from "@tabler/icons-react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
	type HTMLAttributes,
	type KeyboardEvent,
	memo,
	type PointerEvent,
	useCallback,
	useEffect,
	useId,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
	type WheelEvent,
} from "react";
import {
	ANSI_BOLD_CLASS,
	ANSI_TONE_CLASS,
	parseAnsiLine,
	stripAnsi,
} from "../lib/ansi";
import { cn } from "../lib/utils";
import { fillString, type StreamingListStrings, uiStrings } from "../strings";
import { Button } from "./button";
import { ErrorBanner, type ErrorSlots } from "./state-message";

/** Every row's height in px (`h-5`: 20 px, 12 px monospace text). The virtualiser's estimate is exact. */
export const STREAM_ROW_HEIGHT = 20;

/** Rows kept in the page beyond those in view, on each side. */
const OVERSCAN = 20;

/** Within this many px of the end counts as at the end (half a row: sub-pixel scroll positions). */
const AT_END_SLACK = STREAM_ROW_HEIGHT / 2;

const COPIED_MS = 1500;

/** One line of output. A stream chunk from the contract fits as it is. */
export interface StreamLine {
	/** The line's place in its stream, rising; its row's key. */
	seq: number;
	text: string;
	/** `info` lines are the app's own notes, shown muted. */
	channel?: "stdout" | "stderr" | "info";
}

export type StreamingListViewProps = Omit<
	HTMLAttributes<HTMLDivElement>,
	"children" | "onCopy"
> & {
	/** What the output is ("Demo ticker output"): the header, and the name of the scrollable rows. */
	label: string;
	/** The lines held, oldest first. */
	lines: readonly StreamLine[];
	/** How many earlier lines were not kept (the buffer is bounded); a note in the header when more than none. */
	dropped?: number;
	/**
	 * Copies the text (escape sequences removed, one line per line); shows "Copy" when given. A promise it answers is
	 * waited for: "copied" shows only once it resolves.
	 */
	onCopy?: (text: string) => Promise<unknown> | undefined;
	/** Empties the view; shows "Clear" when given. */
	onClear?: () => void;
	/** Why the output stopped early (the stream failed), above the rows. */
	error?: ErrorSlots;
	/** Overrides of the default copy (strings.ts). */
	strings?: Partial<StreamingListStrings>;
};

/** One row: its line parsed once (rows are memoised and keyed by `seq`). */
const Row = memo(function Row({
	text,
	channel,
	start,
}: {
	text: string;
	channel: StreamLine["channel"];
	start: number;
}) {
	const segments = useMemo(() => parseAnsiLine(text), [text]);
	return (
		<div
			data-slot="stream-row"
			className={cn(
				"absolute top-0 left-0 h-5 w-max min-w-full px-edge mono-literal text-ui-sm leading-5 whitespace-pre",
				channel === "info" ? "text-text-muted" : "text-text",
			)}
			style={{ transform: `translateY(${start}px)` }}
		>
			{segments.map((segment, i) =>
				segment.tone === "default" && !segment.bold ? (
					segment.text
				) : (
					<span
						// Segments never reorder: the index is the segment.
						// biome-ignore lint/suspicious/noArrayIndexKey: a line's runs are fixed for the row's life
						key={i}
						data-tone={segment.tone}
						className={cn(
							segment.tone !== "default" && ANSI_TONE_CLASS[segment.tone],
							segment.bold && ANSI_BOLD_CLASS,
						)}
					>
						{segment.text}
					</span>
				),
			)}
		</div>
	);
});

/** The rows are taller than the box: there is somewhere to scroll up to. */
function overflows(el: HTMLElement): boolean {
	return el.scrollHeight > el.clientHeight + 1;
}

function isAtEnd(el: HTMLElement): boolean {
	return el.scrollHeight - el.scrollTop - el.clientHeight <= AT_END_SLACK;
}

export function StreamingListView({
	label,
	lines,
	dropped = 0,
	onCopy,
	onClear,
	error,
	strings,
	className,
	...props
}: StreamingListViewProps) {
	const text = { ...uiStrings.streamingList, ...strings };
	const labelId = useId();
	const scrollRef = useRef<HTMLElement>(null);
	const following = useRef(true);
	const [showJump, setShowJump] = useState(false);
	const [copied, setCopied] = useState(false);

	// Stable while the lines are: TanStack Virtual rebuilds its measurements when this function changes.
	const getItemKey = useCallback(
		(index: number) => lines[index]?.seq ?? index,
		[lines],
	);
	const virtualizer = useVirtualizer({
		count: lines.length,
		getScrollElement: () => scrollRef.current,
		estimateSize: () => STREAM_ROW_HEIGHT,
		getItemKey,
		overscan: OVERSCAN,
	});

	// The list's own scroll positions (following the end, keeping its place): the scroll events they cause are not the
	// person's. `lastTop` is where the list last was: after its own scroll, or the last scroll event.
	const ownTop = useRef<number | undefined>(undefined);
	const lastTop = useRef(0);
	const setTop = useCallback((el: HTMLElement, top: number) => {
		el.scrollTop = top;
		ownTop.current = el.scrollTop;
		// Where the list now is, so the person's next scroll is measured from here even if the scroll event of this
		// one never comes on its own (scroll events of one frame are merged).
		lastTop.current = el.scrollTop;
	}, []);
	const follow = useCallback((on: boolean) => {
		following.current = on;
		setShowJump(!on);
	}, []);
	const scrollToEnd = useCallback(() => {
		const el = scrollRef.current;
		if (el) setTop(el, el.scrollHeight);
	}, [setTop]);

	// New lines: follow the end, or (not following) keep the rows in view still when lines leave the top.
	const previousLines = useRef(lines);
	useLayoutEffect(() => {
		const el = scrollRef.current;
		const before = previousLines.current;
		previousLines.current = lines;
		if (!el) return;
		const first = lines[0]?.seq;
		const firstBefore = before[0]?.seq;
		// Emptied (Clear) or a different stream (it starts before the old first line): follow again, as at the start.
		// No scroll event would say so: the list may already be at the top.
		if (
			first === undefined ||
			(firstBefore !== undefined && first < firstBefore)
		)
			follow(true);
		if (following.current) {
			scrollToEnd();
			return;
		}
		if (first === undefined || before === lines) return;
		// Lines are in seq order: those of the previous lines older than the new first one have gone.
		let gone = 0;
		while (gone < before.length && (before[gone]?.seq ?? first) < first)
			gone += 1;
		if (gone > 0)
			setTop(el, Math.max(0, el.scrollTop - gone * STREAM_ROW_HEIGHT));
	}, [lines, scrollToEnd, follow, setTop]);

	const onScroll = () => {
		const el = scrollRef.current;
		if (!el) return;
		const top = el.scrollTop;
		const own =
			ownTop.current !== undefined && Math.abs(top - ownTop.current) < 1;
		ownTop.current = undefined;
		const moved = top - lastTop.current;
		lastTop.current = top;
		if (own) return;
		// The person's scroll: up and away from the end stops following; down to the end resumes it. A move up that
		// stays at the end is the box growing (the browser clamps the position), not the person: it changes nothing.
		const atEnd = isAtEnd(el);
		if (moved < 0 && !atEnd) follow(false);
		else if (moved > 0 && atEnd) follow(true);
	};

	// Not following, and the box grew until the end is in view (a resized panel): the latest line shows, so it follows
	// again and "Jump to latest" goes. Only a change of size: the person's own small move up stays where they put it.
	useEffect(() => {
		const el = scrollRef.current;
		if (!el) return;
		const observer = new ResizeObserver(() => {
			if (!following.current && isAtEnd(el)) follow(true);
		});
		observer.observe(el);
		return () => observer.disconnect();
	}, [follow]);

	// An upward wheel stops following before the browser scrolls, so no batch in between can snap the list back.
	const onWheel = (event: WheelEvent<HTMLElement>) => {
		const el = scrollRef.current;
		if (event.deltaY < 0 && following.current && el && overflows(el))
			follow(false);
	};

	// Grabbing the scrollbar (a press on the rows' own box, not on a row) stops following while it is held; let go
	// at the end, it follows again.
	const releaseScrollbar = useRef<(() => void) | undefined>(undefined);
	const onPointerDown = (event: PointerEvent<HTMLElement>) => {
		const el = scrollRef.current;
		if (!el || event.target !== el || !overflows(el)) return;
		follow(false);
		releaseScrollbar.current?.();
		const release = () => {
			window.removeEventListener("pointerup", release);
			window.removeEventListener("pointercancel", release);
			releaseScrollbar.current = undefined;
			if (isAtEnd(el)) follow(true);
		};
		releaseScrollbar.current = () => {
			window.removeEventListener("pointerup", release);
			window.removeEventListener("pointercancel", release);
		};
		window.addEventListener("pointerup", release);
		window.addEventListener("pointercancel", release);
	};
	// Unmounted while the scrollbar is held: stop listening.
	useEffect(() => () => releaseScrollbar.current?.(), []);

	useEffect(() => {
		if (!copied) return;
		const timer = setTimeout(() => setCopied(false), COPIED_MS);
		return () => clearTimeout(timer);
	}, [copied]);

	const copy = () => {
		if (!onCopy) return;
		const el = scrollRef.current;
		const selection = el?.ownerDocument.getSelection();
		const selected =
			selection &&
			!selection.isCollapsed &&
			el?.contains(selection.anchorNode) &&
			el.contains(selection.focusNode)
				? selection.toString()
				: undefined;
		const done = onCopy(
			selected ?? lines.map((line) => stripAnsi(line.text)).join("\n"),
		);
		// A copy that answers a promise shows "copied" once it has; one that failed shows nothing.
		if (done instanceof Promise)
			done.then(
				() => setCopied(true),
				() => {},
			);
		else setCopied(true);
	};

	// Home and End go to the first and last line (End follows again); ArrowUp, Page Up and Home stop following at
	// once. The arrows and Page Up and Down scroll natively.
	const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
		const el = scrollRef.current;
		if (!el || event.target !== el) return;
		if (event.key === "End") {
			event.preventDefault();
			follow(true);
			scrollToEnd();
		} else if (event.key === "Home") {
			event.preventDefault();
			if (overflows(el)) follow(false);
			setTop(el, 0);
		} else if (
			(event.key === "ArrowUp" || event.key === "PageUp") &&
			overflows(el)
		) {
			follow(false);
		}
	};

	const jump = () => {
		follow(true);
		scrollToEnd();
		// The button goes away: focus moves to the rows it scrolled, not to the page.
		scrollRef.current?.focus();
	};

	const items = virtualizer.getVirtualItems();
	const empty = lines.length === 0;

	return (
		<div
			data-slot="streaming-list"
			className={cn(
				"flex min-h-0 min-w-0 flex-col rounded-control border border-border-default bg-surface-raised",
				className,
			)}
			{...props}
		>
			<header className="flex min-h-control-l shrink-0 items-center gap-2 border-b border-border-default pr-1 pl-edge">
				<h3
					id={labelId}
					className="min-w-0 truncate text-ui-sm font-action text-text"
				>
					{label}
				</h3>
				{dropped > 0 ? (
					<span
						data-slot="stream-dropped"
						className="min-w-0 truncate text-ui-sm text-text-muted"
					>
						{fillString(dropped === 1 ? text.droppedOne : text.dropped, {
							count: dropped.toLocaleString("en"),
						})}
					</span>
				) : null}
				<span className="flex-1" />
				{onCopy ? (
					<Button
						variant="ghost"
						icon={
							copied ? (
								<IconCheck aria-hidden="true" />
							) : (
								<IconCopy aria-hidden="true" />
							)
						}
						isDisabled={empty}
						onPress={copy}
					>
						{text.copy}
					</Button>
				) : null}
				{onClear ? (
					<Button
						variant="ghost"
						icon={<IconEraser aria-hidden="true" />}
						isDisabled={empty}
						onPress={onClear}
					>
						{text.clear}
					</Button>
				) : null}
			</header>
			{error ? (
				<div className="shrink-0 p-2">
					<ErrorBanner error={error} />
				</div>
			) : null}
			<div className="relative flex min-h-0 flex-1 flex-col">
				<section
					ref={scrollRef}
					data-slot="stream-rows"
					aria-labelledby={labelId}
					// biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region must be reachable by keyboard (WCAG 2.1.1).
					tabIndex={0}
					onScroll={onScroll}
					onWheel={onWheel}
					onPointerDown={onPointerDown}
					onKeyDown={onKeyDown}
					className="min-h-0 flex-1 overflow-auto rounded-b-control py-1 outline-none focus-visible:focus-outline"
				>
					{empty ? (
						<p className="px-edge text-ui-sm leading-5 text-text-muted">
							{text.empty}
						</p>
					) : (
						<div
							className="relative"
							style={{ height: virtualizer.getTotalSize() }}
						>
							{items.map((item) => {
								const line = lines[item.index];
								if (!line) return null;
								return (
									<Row
										key={item.key}
										text={line.text}
										channel={line.channel}
										start={item.start}
									/>
								);
							})}
						</div>
					)}
				</section>
				{showJump && !empty ? (
					// A solid layer under the button, so the rows never show through its fill.
					<div className="absolute right-3 bottom-3 rounded-control bg-surface-overlay shadow-elevated">
						<Button
							variant="secondary"
							icon={<IconArrowDown aria-hidden="true" />}
							onPress={jump}
						>
							{text.jumpToLatest}
						</Button>
					</div>
				) : null}
			</div>
			{onCopy ? (
				<span role="status" className="sr-only">
					{copied ? text.copied : ""}
				</span>
			) : null}
		</div>
	);
}
