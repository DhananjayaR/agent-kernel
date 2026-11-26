// StreamHub: the output of jobs, sessions and recorded commands, served as `stream.read` (ruling 6). Each
// stream keeps a bounded backlog, so a late subscriber first receives what it missed and a burst of output
// cannot grow without limit. Each subscriber receives batches: at most one per scheduled flush (16 ms by
// default, about one animation frame) and at most `batchLines` lines each, so 10,000 lines written at once
// cross the bridge as 20 messages, each parsed once by the registry (ruling 8). Text is masked before it is
// kept. Browser-safe: the only host API is setTimeout, and it can be replaced.
import {
	ERROR_CODES,
	type StreamBatch,
	type StreamChannel,
	type StreamChunk,
	type StreamId,
	StudioFailure,
	type streamRead,
} from "@ak-studio/contract";
import { defaultLog, type Log } from "./host";
import type { StreamRegistrar } from "./registry";
import type { SecretMasker } from "./secrets";
import { strings } from "./strings";

/** Runs `fn` later; answers the function that cancels it. */
export type Schedule = (fn: () => void) => () => void;

/** How long the default schedule waits before a flush: about one animation frame. */
export const DEFAULT_FLUSH_MS = 16;

export const DEFAULT_BACKLOG_LINES = 5000;
export const DEFAULT_BATCH_LINES = 500;

export interface StreamHubOptions {
	masker: SecretMasker;
	/** Defaults to setTimeout with DEFAULT_FLUSH_MS. Tests pass a scheduler they drive. */
	schedule?: Schedule;
	/** Lines each stream keeps for late or slow subscribers. */
	backlogLines?: number;
	/** The most lines one batch carries. */
	batchLines?: number;
	/** Milliseconds since the epoch, for each chunk's `at`. */
	now?: () => number;
	/** Where a subscriber whose send fails is reported. */
	log?: Log;
}

const defaultSchedule: Schedule = (fn) => {
	const handle = setTimeout(fn, DEFAULT_FLUSH_MS);
	return () => clearTimeout(handle);
};

const LINE_BREAK = /\r\n|\n|\r/;

/** The newest `limit` chunks of one stream. Chunk `seq` values are consecutive, so a seq is an index. */
class Backlog {
	#chunks: StreamChunk[] = [];
	#head = 0;
	readonly #limit: number;

	constructor(limit: number) {
		this.#limit = limit;
	}

	/** The seq of the oldest chunk kept; every seq before it has fallen out. */
	firstSeq(nextSeq: number): number {
		return this.#chunks[this.#head]?.seq ?? nextSeq;
	}

	push(chunk: StreamChunk): void {
		this.#chunks.push(chunk);
		if (this.#chunks.length - this.#head > this.#limit) {
			this.#head = this.#chunks.length - this.#limit;
			// Compact now and then, not on every line, so a burst costs no more than its own length.
			if (this.#head >= this.#limit) {
				this.#chunks = this.#chunks.slice(this.#head);
				this.#head = 0;
			}
		}
	}

	/** Up to `max` chunks from `seq` on (`seq` must not be before firstSeq). */
	from(seq: number, max: number, nextSeq: number): StreamChunk[] {
		const start = this.#head + (seq - this.firstSeq(nextSeq));
		return this.#chunks.slice(start, start + max);
	}
}

interface Reader {
	state: StreamState;
	/** The seq of the next chunk this subscriber has not received. */
	cursor: number;
	send: (batch: StreamBatch) => void;
	cancelFlush: (() => void) | undefined;
	endedSent: boolean;
	closed: boolean;
}

interface StreamState {
	nextSeq: number;
	ended: boolean;
	backlog: Backlog;
	readers: Set<Reader>;
}

export class StreamHub {
	readonly #masker: SecretMasker;
	readonly #schedule: Schedule;
	readonly #backlogLines: number;
	readonly #batchLines: number;
	readonly #now: () => number;
	readonly #log: Log;
	readonly #streams = new Map<StreamId, StreamState>();
	// Ids stay unique across restarts (a job record can name a stream from an earlier run): a random prefix per
	// hub, then a counter.
	readonly #idPrefix = Math.random().toString(36).slice(2, 10);
	#created = 0;

	constructor(options: StreamHubOptions) {
		this.#masker = options.masker;
		this.#schedule = options.schedule ?? defaultSchedule;
		this.#backlogLines = positive(
			options.backlogLines ?? DEFAULT_BACKLOG_LINES,
			"backlogLines",
		);
		this.#batchLines = positive(
			options.batchLines ?? DEFAULT_BATCH_LINES,
			"batchLines",
		);
		this.#now = options.now ?? Date.now;
		this.#log = options.log ?? defaultLog;
	}

	/** Creates an empty stream and answers its id. */
	create(): StreamId {
		this.#created += 1;
		const id = `stream-${this.#idPrefix}-${this.#created}`;
		this.#streams.set(id, {
			nextSeq: 0,
			ended: false,
			backlog: new Backlog(this.#backlogLines),
			readers: new Set(),
		});
		return id;
	}

	/**
	 * Adds `text` to the stream, one chunk per line: it is masked, then split on \n, \r\n or \r. A final line
	 * break adds no empty line, and empty text adds nothing. Each write is whole lines: a line is not joined
	 * with the next write. Ignored once the stream has ended; throws for a stream this hub never created.
	 */
	write(streamId: StreamId, channel: StreamChannel, text: string): void {
		const state = this.#state(streamId);
		if (state.ended || text.length === 0) return;
		const lines = this.#masker.mask(text).split(LINE_BREAK);
		if (lines.length > 1 && lines[lines.length - 1] === "") lines.pop();
		const at = this.#now();
		for (const line of lines) {
			state.backlog.push({ seq: state.nextSeq, at, channel, text: line });
			state.nextSeq += 1;
		}
		for (const reader of state.readers) this.#wake(reader);
	}

	/** Ends the stream: each subscriber gets `ended: true` once, in the batch that drains what it has not seen. */
	end(streamId: StreamId): void {
		const state = this.#state(streamId);
		if (state.ended) return;
		state.ended = true;
		for (const reader of state.readers) this.#wake(reader);
	}

	/**
	 * Forgets the stream: its backlog is dropped, its readers get nothing more, and a later `stream.read` of it
	 * fails with `stream.notFound`. Call it once nobody can need the output again (JobService and SessionService
	 * do, for the oldest of the ended jobs and sessions they keep). Unknown or released ids are ignored.
	 */
	release(streamId: StreamId): void {
		const state = this.#streams.get(streamId);
		if (!state) return;
		this.#streams.delete(streamId);
		for (const reader of [...state.readers]) close(reader);
	}

	/** Serves the `stream.read` stream. An unknown stream id fails with `stream.notFound`. */
	register(registry: StreamRegistrar<"stream.read", typeof streamRead>): void {
		registry.handleStream("stream.read", ({ streamId }, send) => {
			const state = this.#streams.get(streamId);
			if (!state) {
				throw new StudioFailure({
					code: ERROR_CODES.streamNotFound,
					message: strings.streamNotFound,
					detail: streamId,
				});
			}
			const reader: Reader = {
				state,
				cursor: 0,
				send,
				cancelFlush: undefined,
				endedSent: false,
				closed: false,
			};
			state.readers.add(reader);
			// The backlog goes out on the first flush, never inside subscribe.
			if (state.nextSeq > 0 || state.ended) this.#wake(reader);
			return () => close(reader);
		});
	}

	#state(streamId: StreamId): StreamState {
		const state = this.#streams.get(streamId);
		if (!state) throw new Error(`no stream ${streamId} in this StreamHub`);
		return state;
	}

	/** Schedules one flush for `reader`, unless one is already scheduled or it has nothing more to receive. */
	#wake(reader: Reader): void {
		if (reader.closed || reader.endedSent || reader.cancelFlush) return;
		reader.cancelFlush = this.#schedule(() => {
			reader.cancelFlush = undefined;
			this.#flush(reader);
		});
	}

	/** Sends `reader` one batch: what it missed, capped at batchLines; schedules the next flush if more is left. */
	#flush(reader: Reader): void {
		if (reader.closed || reader.endedSent) return;
		const { state } = reader;
		const first = state.backlog.firstSeq(state.nextSeq);
		let dropped = 0;
		if (reader.cursor < first) {
			dropped = first - reader.cursor;
			reader.cursor = first;
		}
		const chunks = state.backlog.from(
			reader.cursor,
			this.#batchLines,
			state.nextSeq,
		);
		reader.cursor += chunks.length;
		const caughtUp = reader.cursor === state.nextSeq;
		const ended = state.ended && caughtUp;
		if (chunks.length === 0 && dropped === 0 && !ended) return;
		if (ended) reader.endedSent = true;
		try {
			reader.send({ chunks, dropped, ended });
		} catch (err) {
			// This runs in a timer: nothing above can catch it. Drop only this subscriber; the others carry on.
			close(reader);
			this.#log(
				`a stream.read subscriber failed and was closed: ${err instanceof Error ? err.message : String(err)}`,
			);
			return;
		}
		if (!caughtUp) this.#wake(reader);
	}
}

/** Stops sending to `reader`: no more flushes, and it leaves its stream. */
function close(reader: Reader): void {
	reader.closed = true;
	reader.cancelFlush?.();
	reader.cancelFlush = undefined;
	reader.state.readers.delete(reader);
}

function positive(value: number, name: string): number {
	if (!Number.isInteger(value) || value < 1) {
		throw new Error(`${name} must be a whole number of at least 1`);
	}
	return value;
}
