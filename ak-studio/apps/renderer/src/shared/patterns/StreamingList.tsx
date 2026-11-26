// StreamingList: the streaming list pattern over one stream in the stream store (architecture.md, Streams; P1b design
// gate row (b)). It reads the stream with `useStream` (which holds the subscription open while the list is mounted)
// and fills StreamingListView, which virtualises the rows: the store appends one batch per update, and only the rows
// in view are rendered, so a 10,000-line burst costs a few renders, never one per line.
//
// - **Copy** writes the text to the clipboard (`navigator.clipboard`); a failure is logged and "copied" is not shown.
// - **Clear** hides the lines held so far, in this view only: the stream and its record stay, and later lines show
//   as they arrive. It is remembered by `seq`, so it survives a re-render and a stream that keeps evicting.
// - **Not kept:** the header says how many earlier lines the view lacks: those the main process's backlog or this
//   buffer dropped (`dropped`), or, after a clear, those evicted since that are newer than the clear.
// - **A failed stream** (`stream.notFound` for one that is gone) shows its error above what arrived.
import type { StreamId } from "@ak-studio/contract";
import { StreamingListView } from "@ak-studio/ui";
import { useMemo, useState } from "react";
import { useStream } from "../streams/streamStore";
import { presentError } from "./presentError";

export interface StreamingListProps {
	/** The stream to show; none shows the empty list and subscribes to nothing. */
	streamId: StreamId | undefined;
	/** What the output is ("Demo ticker output"). */
	label: string;
	className?: string;
}

/** Copies `text` to the clipboard; rejects (and logs) when the clipboard refuses. */
export async function copyToClipboard(text: string): Promise<void> {
	try {
		await navigator.clipboard.writeText(text);
	} catch (error) {
		console.error(
			`[studio] copying to the clipboard failed: ${error instanceof Error ? error.message : String(error)}`,
		);
		throw error;
	}
}

export function StreamingList({
	streamId,
	label,
	className,
}: StreamingListProps) {
	const view = useStream(streamId);
	// The last seq cleared away, for this stream; a new stream starts uncleared.
	const [cleared, setCleared] = useState<{ streamId: StreamId; seq: number }>();
	const clearedSeq =
		cleared !== undefined && cleared.streamId === streamId
			? cleared.seq
			: undefined;

	const lines = useMemo(() => {
		if (clearedSeq === undefined) return view.lines;
		const from = view.lines.findIndex((line) => line.seq > clearedSeq);
		return from < 0 ? [] : view.lines.slice(from);
	}, [view.lines, clearedSeq]);

	// After a clear, only lines newer than it that the buffer evicted are missing.
	const first = lines[0];
	const dropped =
		clearedSeq === undefined
			? view.dropped
			: first === undefined
				? 0
				: Math.max(0, first.seq - clearedSeq - 1);

	const last = view.lines[view.lines.length - 1];
	return (
		<StreamingListView
			label={label}
			lines={lines}
			dropped={dropped}
			onCopy={copyToClipboard}
			onClear={
				streamId === undefined
					? undefined
					: () => {
							if (last) setCleared({ streamId, seq: last.seq });
						}
			}
			error={view.error ? presentError(view.error) : undefined}
			className={className}
		/>
	);
}
