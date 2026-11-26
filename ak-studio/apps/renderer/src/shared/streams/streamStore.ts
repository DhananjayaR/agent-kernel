// The renderer's stream store (architecture.md, Streams): the output of jobs, sessions and recorded commands,
// read with `stream.read`. One subscription per stream, shared by every view that shows it and counted by view:
// it opens with the first view and closes when the last one unmounts (and its lines go with it: a view that comes
// back reads the backlog again from the main process). Each stream keeps a bounded buffer, the newest
// STREAM_BUFFER_LINES lines; `dropped` counts the lines the main process's backlog lost before they were sent and
// the lines this buffer evicted. A batch is appended in one store update, so a 10,000-line burst is a few updates
// (one per batch the main process sends), never one per line.
import type {
	StreamBatch,
	StreamChunk,
	StreamId,
	StudioError,
} from "@ak-studio/contract";
import { useEffect } from "react";
import { create } from "zustand";
import { getTransport } from "../bridge/client";

/** How many lines each stream keeps; older ones are evicted and counted in `dropped`. */
export const STREAM_BUFFER_LINES = 5000;

/** What a view of one stream shows. */
export interface StreamView {
	/** The newest lines, oldest first, at most STREAM_BUFFER_LINES. */
	readonly lines: readonly StreamChunk[];
	/** Lines lost before this view: dropped by the main process's backlog, or evicted from the buffer. */
	readonly dropped: number;
	/** The stream has ended: nothing more will arrive. */
	readonly ended: boolean;
	/** Why the stream ended early, when it failed (e.g. `stream.notFound` for one that is gone). */
	readonly error?: StudioError;
}

export interface StreamStoreState {
	readonly streams: Readonly<Record<StreamId, StreamView>>;
}

/** The store itself; views read it through `useStream`, which also holds the subscription open. */
export const useStreamStore = create<StreamStoreState>()(() => ({
	streams: {},
}));

/** What a stream shows before its first batch (and when no stream is given). One object, so selectors are stable. */
export const EMPTY_STREAM: StreamView = Object.freeze({
	lines: Object.freeze([]) as readonly StreamChunk[],
	dropped: 0,
	ended: false,
});

/**
 * `view` with `batch` appended, keeping the newest `limit` lines. Answers `view` itself when the batch changes
 * nothing, so no view re-renders for it.
 */
export function appendBatch(
	view: StreamView,
	batch: StreamBatch,
	limit: number = STREAM_BUFFER_LINES,
): StreamView {
	const { chunks } = batch;
	if (chunks.length === 0 && batch.dropped === 0 && batch.ended === view.ended)
		return view;
	const total = view.lines.length + chunks.length;
	const evicted = Math.max(0, total - limit);
	let lines: readonly StreamChunk[];
	if (evicted === 0) lines = view.lines.concat(chunks);
	else if (chunks.length >= limit) lines = chunks.slice(chunks.length - limit);
	else lines = view.lines.slice(evicted).concat(chunks);
	return {
		...view,
		lines,
		dropped: view.dropped + batch.dropped + evicted,
		ended: view.ended || batch.ended,
	};
}

interface OpenStream {
	views: number;
	close: () => void;
}

/** The open subscriptions, by stream: how many views hold each, and how to close it. */
const openStreams = new Map<StreamId, OpenStream>();

function update(streamId: StreamId, next: (view: StreamView) => StreamView) {
	useStreamStore.setState((state) => {
		const current = state.streams[streamId] ?? EMPTY_STREAM;
		const view = next(current);
		if (view === current) return state;
		return { streams: { ...state.streams, [streamId]: view } };
	});
}

/** A view of `streamId` mounted: the first one opens the subscription. */
function acquire(streamId: StreamId): void {
	const existing = openStreams.get(streamId);
	if (existing) {
		existing.views += 1;
		return;
	}
	const entry: OpenStream = { views: 1, close: () => {} };
	openStreams.set(streamId, entry);
	// Callbacks of a subscription that has since closed (and perhaps reopened) are ignored.
	const current = () => openStreams.get(streamId) === entry;
	entry.close = getTransport().subscribe(
		"stream.read",
		{ streamId },
		(batch) => {
			if (current()) update(streamId, (view) => appendBatch(view, batch));
		},
		(error) => {
			if (current())
				update(streamId, (view) => ({ ...view, ended: true, error }));
		},
	);
}

/** A view of `streamId` unmounted: the last one closes the subscription and forgets the lines. */
function release(streamId: StreamId): void {
	const entry = openStreams.get(streamId);
	if (!entry) return;
	entry.views -= 1;
	if (entry.views > 0) return;
	openStreams.delete(streamId);
	entry.close();
	useStreamStore.setState((state) => {
		if (!(streamId in state.streams)) return state;
		const { [streamId]: _gone, ...rest } = state.streams;
		return { streams: rest };
	});
}

/**
 * The lines of one stream, for as long as the calling view is mounted: the backlog first, then new output. No
 * stream (`undefined`, e.g. a job without one) shows nothing and subscribes to nothing.
 */
export function useStream(streamId: StreamId | undefined): StreamView {
	useEffect(() => {
		if (streamId === undefined) return;
		acquire(streamId);
		return () => release(streamId);
	}, [streamId]);
	return useStreamStore((state) =>
		streamId === undefined
			? EMPTY_STREAM
			: (state.streams[streamId] ?? EMPTY_STREAM),
	);
}
