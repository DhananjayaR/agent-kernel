// JobService: runs every slow, finite thing as a job (architecture.md, Jobs). A feature declares a job kind in
// the contract with `job()`, gives JobService its runner with `define`, and serves the kind's operation with
// `handler`, which starts a job and answers `{ jobId }` at once. JobService owns the job's state (queued,
// running, waiting-for-user, then succeeded, failed or cancelled), its one open question to the user, its
// output stream and its crash record, and announces every change as a `job.updated` event, each one adding to
// the job's `seq`. Jobs of one kind on one project run one at a time, in order. It also serves the operations
// every job shares: `job.respond`, `job.cancel`, `jobs.list`, `jobs.interrupted` and `jobs.dismissInterrupted`.
// Browser-safe, like the rest of the runtime: the desktop runs it over NodeJobRecordStore, the mock transport
// over InMemoryJobRecordStore.
import {
	CONFIRM_OPTION_IDS,
	ERROR_CODES,
	type Job,
	type JobId,
	type JobKindMap,
	type JobKinds,
	type JobOperation,
	type JobState,
	type jobCancel,
	jobProgressSchema,
	type jobRespond,
	type jobsDismissInterrupted,
	type jobsInterrupted,
	type jobsList,
	type ProjectId,
	parseSafely,
	type StreamChannel,
	type StudioError,
	StudioFailure,
	studioErrorSchema,
	jobKinds as studioJobKinds,
	toStudioError,
	type UserRequest,
	userRequestSchema,
} from "@ak-studio/contract";
import type { z } from "zod";
import type { EventBus } from "./events";
import { defaultLog, type Log, maskedLog } from "./host";
import { describe, toData } from "./plain";
import type { JobRecord, JobRecordStore } from "./ports/jobRecordStore";
import type { RequestHandler, RequestRegistrar } from "./registry";
import type { ProjectScope, ProjectScopes } from "./scope";
import type { SecretMasker } from "./secrets";
import type { StreamHub } from "./streams";
import { strings } from "./strings";

/** How many ended jobs `jobs.list` keeps (with their output streams); older ones leave and their streams are released. */
export const FINISHED_JOBS_KEPT = 50;

/** The user's answer to a job's request (what `job.respond` carries). */
export type JobAnswer = z.output<typeof jobRespond.input>["answer"];

/** What a runner asks: a UserRequest without its id (JobService gives each request its own). */
export type JobRequest = Omit<UserRequest, "id">;

/** What a runner gets besides its input: its job's id, the cancel signal, and the ways it reports back. */
export interface JobContext {
	readonly jobId: JobId;
	/** The project the job belongs to, from its input's `projectId`. */
	readonly projectId: ProjectId | undefined;
	/** Aborted when the job is cancelled (by the user, by quit, or by its project closing). Stop work then. */
	readonly signal: AbortSignal;
	/** Reports progress: step `step` of `steps`, labelled. Throws on values the progress schema refuses. */
	step(step: number, steps: number, label: string): void;
	/**
	 * Asks the user and waits for the answer (`job.respond`). One request is open at a time: a second `ask`
	 * waits until the first is answered. Rejects with the signal's reason if the job is cancelled, and at once
	 * for a request that is not a valid UserRequest.
	 */
	ask(request: JobRequest): Promise<JobAnswer>;
	/**
	 * Asks the user to approve or deny (the approval pattern): a `confirm` request, or `confirm-by-name` when
	 * `expectedName` is given, with the shared options `approve` and `deny` (CONFIRM_OPTION_IDS). Resolves true on
	 * approve, false on deny; rejects as `ask` does.
	 */
	confirm(request: JobConfirmRequest): Promise<boolean>;
	/**
	 * Ends the job as cancelled, from inside its runner (a denied confirm, say). It aborts the signal and throws, so
	 * nothing after it runs; JobService ends the job `cancelled` once the runner settles. A runner may always cancel
	 * itself, whether or not its kind is cancellable by the user. A runner that catches the throw and carries on
	 * still ends `cancelled` once it returns: its signal is aborted, and what it returns is dropped.
	 */
	cancel(): never;
	/** The job's output stream (read with `stream.read`); masked by StreamHub. Ignored once the job has ended. */
	readonly stream: { write(channel: StreamChannel, text: string): void };
	/** Notes a CommandRunner record behind the job; it is also written to the job's crash record. */
	addCommand(commandId: string): void;
}

/** What `confirm` asks: the request's words, and the name to type for a destructive action. */
export interface JobConfirmRequest {
	/** Sentence case: the question. */
	title: string;
	/** What will happen. */
	summary: string;
	/** What it touches: a cloud account, files, resources. */
	affects?: string[];
	/** Marks the approve option as destructive. Needs `expectedName`: destructive always asks for the name. */
	destructive?: boolean;
	/** The name the user types to approve (`confirm-by-name`). Denying never needs it. */
	expectedName?: string;
	/** The approve button's label: what happens ("Apply plan"). Defaults to "Approve". */
	approveLabel?: string;
	/** The deny button's label: what happens ("Stop the job"). Defaults to "Deny". */
	denyLabel?: string;
}

/** What `ctx.cancel()` throws: the runner's own cancel, told apart from a failure by #settle. Never leaves the service. */
class RunnerCancelled extends Error {
	constructor() {
		super("the job cancelled itself");
		this.name = "RunnerCancelled";
	}
}

/** Does a job's work. Its result is parsed against the kind's `result` schema; a throw fails the job. */
export type JobRunner<Input = unknown, Result = unknown> = (
	input: Input,
	ctx: JobContext,
) => Promise<Result>;

/** The input a kind's runner receives (parsed) and the result it returns (before parsing). */
type InputOfKind<K extends JobOperation> = z.output<K["input"]>;
type ResultOfKind<K extends JobOperation> = z.input<K["result"]>;

/** The shared job operations JobService serves. */
export type JobOperations = {
	"job.respond": typeof jobRespond;
	"job.cancel": typeof jobCancel;
	"jobs.list": typeof jobsList;
	"jobs.interrupted": typeof jobsInterrupted;
	"jobs.dismissInterrupted": typeof jobsDismissInterrupted;
};

export interface JobServiceOptions<Kinds extends JobKindMap = JobKinds> {
	events: EventBus;
	streams: StreamHub;
	scopes: ProjectScopes;
	records: JobRecordStore;
	/** Masks every error a job carries, and the log (pass `registry.masker`). */
	masker: SecretMasker;
	/** The job kinds it may run. Defaults to the contract's; tests pass their own. */
	jobKinds?: Kinds;
	/** Milliseconds since the epoch, for a record's `startedAt`. */
	now?: () => number;
	log?: Log;
}

/** What quitting has to deal with: jobs it may cancel, and started jobs that must finish first. */
export interface QuitPlan {
	/**
	 * Every queued job, and started jobs that do not survive quit: cancelled on quit. A queued job has touched
	 * nothing, so it is safe to cancel whatever its kind; left queued, it would start while quit waits.
	 */
	toCancel: Job[];
	/** Started jobs that survive quit (killing them risks damage): quit waits for them, or is overridden. */
	blocking: Job[];
}

interface OpenAsk {
	request: UserRequest;
	resolve: (answer: JobAnswer) => void;
	reject: (reason: unknown) => void;
}

interface Entry {
	job: Job;
	op: JobOperation;
	input: unknown;
	runner: JobRunner;
	lane: string;
	controller: AbortController;
	/** The open request first, then the asks waiting behind it. */
	asks: OpenAsk[];
	started: boolean;
	startedAt: number;
	ended: boolean;
	/** Resolves once the job has ended and its record's end is written. */
	done: Promise<void>;
	markDone: () => void;
}

export class JobService<Kinds extends JobKindMap = JobKinds> {
	readonly #events: EventBus;
	readonly #streams: StreamHub;
	readonly #scopes: ProjectScopes;
	readonly #records: JobRecordStore;
	readonly #masker: SecretMasker;
	readonly #kinds: JobKindMap;
	readonly #now: () => number;
	readonly #log: Log;
	readonly #runners = new Map<string, JobRunner>();
	/** Every job of this run still listed, in the order they were created. */
	readonly #jobs = new Map<JobId, Entry>();
	/** Jobs that may not overlap (same kind, same project), in order: the head runs, the rest are queued. */
	readonly #lanes = new Map<string, Entry[]>();
	/** The project scopes that cancel their jobs when disposed. */
	readonly #watchedScopes = new WeakSet<ProjectScope>();
	/** Ended jobs, oldest first, for the bound on the list. */
	readonly #ended: JobId[] = [];
	// Ids must be unique across restarts, since crash records outlive the run: a random prefix, then a counter.
	// Records whose id has this run's prefix are this run's own jobs, never "interrupted".
	readonly #idPrefix = `job-${Math.random().toString(36).slice(2, 10)}-`;
	#count = 0;
	#requestCount = 0;
	/** Record writes, one after another, so a job's end never lands before its start. */
	#recordWrites: Promise<void> = Promise.resolve();

	constructor(options: JobServiceOptions<Kinds>) {
		this.#events = options.events;
		this.#streams = options.streams;
		this.#scopes = options.scopes;
		this.#records = options.records;
		this.#masker = options.masker;
		this.#kinds = options.jobKinds ?? (studioJobKinds as JobKindMap);
		this.#now = options.now ?? Date.now;
		this.#log = maskedLog(options.log ?? defaultLog, options.masker);
	}

	/** Gives a job kind its runner. Throws (a start-up bug) for a kind not in the map or defined twice. */
	define<N extends keyof Kinds & string>(
		name: N,
		runner: JobRunner<InputOfKind<Kinds[N]>, ResultOfKind<Kinds[N]>>,
	): this {
		this.#kind(name);
		if (this.#runners.has(name)) {
			throw new Error(`job kind ${name} already has a runner`);
		}
		this.#runners.set(name, runner as JobRunner);
		return this;
	}

	/**
	 * The request handler for a job kind's operation: starts a job and answers `{ jobId }` at once. An input with
	 * a `projectId` needs that project open (`project.notOpen`). Throws (a start-up bug) for a kind not in the
	 * map or with no runner yet.
	 */
	handler<N extends keyof Kinds & string>(name: N): RequestHandler<Kinds[N]> {
		const op = this.#kind(name);
		const runner = this.#runners.get(name);
		if (!runner) {
			throw new Error(`job kind ${name} has no runner: define it first`);
		}
		const handle = (input: unknown): { jobId: JobId } => ({
			jobId: this.#create(op, runner, input),
		});
		return handle as RequestHandler<Kinds[N]>;
	}

	/** Serves the operations every job shares. */
	register(registry: RequestRegistrar<JobOperations>): void {
		registry.handle("job.respond", ({ jobId, requestId, answer }) => {
			this.#respond(jobId, requestId, answer);
			return {};
		});
		registry.handle("job.cancel", ({ jobId }) => {
			const entry = this.#require(jobId);
			if (entry.ended) return {};
			if (!entry.job.cancellable) {
				throw new StudioFailure({
					code: ERROR_CODES.jobNotCancellable,
					message: strings.jobNotCancellable,
					detail: jobId,
				});
			}
			this.#cancel(entry);
			return {};
		});
		registry.handle("jobs.list", () => ({ jobs: this.list() }));
		registry.handle("jobs.interrupted", async () => ({
			records: (await this.#records.unfinished()).filter(
				(record) => !this.#isOwn(record.jobId),
			),
		}));
		registry.handle("jobs.dismissInterrupted", async ({ jobId }) => {
			if (this.#isOwn(jobId) || !(await this.#records.dismiss(jobId))) {
				throw notFound(jobId);
			}
			return {};
		});
	}

	/** Every job of this run still listed: unfinished ones and the newest ended ones, oldest first. */
	list(): Job[] {
		return [...this.#jobs.values()].map((entry) => snapshot(entry.job));
	}

	/** Splits the unfinished jobs for the quit rule (architecture.md, Jobs). */
	quitPlan(): QuitPlan {
		const plan: QuitPlan = { toCancel: [], blocking: [] };
		for (const entry of this.#jobs.values()) {
			if (entry.ended) continue;
			const blocks = entry.started && entry.job.survivesQuit;
			(blocks ? plan.blocking : plan.toCancel).push(snapshot(entry.job));
		}
		return plan;
	}

	/**
	 * Cancels the given jobs, whether or not they are cancellable by the user (quit and project close use it),
	 * and resolves once each has ended and its record's end is written. Jobs that have ended or are unknown are
	 * skipped. A runner that ignores its signal keeps this waiting: the caller bounds the wait.
	 */
	async cancelAll(jobs: readonly Pick<Job, "id">[]): Promise<void> {
		const waits: Promise<void>[] = [];
		for (const { id } of jobs) {
			const entry = this.#jobs.get(id);
			if (!entry) continue;
			this.#cancel(entry);
			waits.push(entry.done);
		}
		await Promise.all(waits);
	}

	// ---- Starting and running ----

	#create(op: JobOperation, runner: JobRunner, input: unknown): JobId {
		const projectId = projectIdOf(input);
		const scope =
			projectId === undefined ? undefined : this.#scopes.require(projectId);
		this.#count += 1;
		const id = `${this.#idPrefix}${this.#count}`;
		let markDone!: () => void;
		const done = new Promise<void>((resolve) => {
			markDone = resolve;
		});
		const entry: Entry = {
			job: {
				id,
				kind: op.name,
				title: op.title,
				state: "queued",
				commandIds: [],
				streamId: this.#streams.create(),
				cancellable: op.cancellable,
				survivesQuit: op.survivesQuit,
				...(projectId === undefined ? {} : { projectId }),
				seq: 0,
			},
			op,
			input,
			runner,
			lane: `${op.name}\u0000${projectId ?? ""}`,
			controller: new AbortController(),
			asks: [],
			started: false,
			startedAt: 0,
			ended: false,
			done,
			markDone,
		};
		if (scope && !this.#watchedScopes.has(scope)) {
			// One disposer per project, so closing it cancels all its jobs at once (whatever their kind says) and
			// waits for them all, instead of one after another.
			this.#watchedScopes.add(scope);
			scope.onDispose(() =>
				this.cancelAll(
					[...this.#jobs.values()]
						.filter((other) => other.job.projectId === projectId)
						.map((other) => other.job),
				),
			);
		}
		this.#jobs.set(id, entry);
		const lane = this.#lanes.get(entry.lane) ?? [];
		lane.push(entry);
		this.#lanes.set(entry.lane, lane);
		this.#emit(entry);
		if (lane.length === 1) this.#start(entry);
		return id;
	}

	#start(entry: Entry): void {
		// Started only once the clock has answered: a throwing clock leaves the job queued, still cancellable.
		const startedAt = this.#now();
		entry.started = true;
		entry.startedAt = startedAt;
		entry.job.startedAt = startedAt;
		entry.job.state = "running";
		this.#emit(entry);
		void this.#run(entry);
	}

	async #run(entry: Entry): Promise<void> {
		// The crash record is on disk before the runner can start anything (a failed write is logged, not fatal).
		await this.#writeRecord(entry);
		if (entry.controller.signal.aborted) {
			this.#end(entry, "cancelled");
			return;
		}
		let outcome: { ok: true; value: unknown } | { ok: false; err: unknown };
		try {
			outcome = {
				ok: true,
				value: await entry.runner(entry.input, this.#context(entry)),
			};
		} catch (err) {
			outcome = { ok: false, err };
		}
		try {
			this.#settle(entry, outcome);
		} catch (err) {
			// Nothing after the runner may leave the job running and its lane blocked.
			this.#end(entry, "failed", {
				error: this.#internal(`ending the job failed: ${describe(err)}`),
			});
		}
	}

	/** Ends a job whose runner has settled: cancelled, failed, or succeeded with its parsed result. */
	#settle(
		entry: Entry,
		outcome: { ok: true; value: unknown } | { ok: false; err: unknown },
	): void {
		if (entry.ended) return;
		const cancelledItself =
			!outcome.ok && outcome.err instanceof RunnerCancelled;
		if (entry.controller.signal.aborted || cancelledItself) {
			this.#end(entry, "cancelled");
			return;
		}
		if (!outcome.ok) {
			this.#end(entry, "failed", { error: this.#failure(entry, outcome.err) });
			return;
		}
		// The result must match the kind and be plain data (it is copied into every event and list).
		const parsed = parseSafely(entry.op.result, outcome.value);
		const data = parsed.success ? toData(parsed.data) : undefined;
		if (data?.ok) {
			this.#end(entry, "succeeded", { result: data.value });
			return;
		}
		const error = this.#masker.maskError({
			code: ERROR_CODES.invalidOutput,
			message: strings.jobInvalidResult,
			detail: parsed.success
				? `the result is not plain data: ${data?.detail ?? ""}`
				: parsed.detail,
		});
		this.#log(
			`${entry.op.name} failed with ${error.code}: ${error.detail ?? ""}`,
		);
		this.#end(entry, "failed", { error });
	}

	#context(entry: Entry): JobContext {
		const { job } = entry;
		return {
			jobId: job.id,
			projectId: job.projectId,
			signal: entry.controller.signal,
			step: (step, steps, label) => {
				const progress = jobProgressSchema.parse({ step, steps, label });
				if (entry.ended) return;
				job.progress = progress;
				this.#emit(entry);
			},
			ask: (request) => this.#ask(entry, request),
			confirm: async (request) => {
				const answer = await this.#ask(entry, confirmRequest(request));
				return answer.optionId === CONFIRM_OPTION_IDS.approve;
			},
			cancel: () => {
				this.#cancel(entry);
				throw new RunnerCancelled();
			},
			stream: {
				write: (channel, text) => {
					if (entry.ended || job.streamId === undefined) return;
					this.#streams.write(job.streamId, channel, text);
				},
			},
			addCommand: (commandId) => {
				if (typeof commandId !== "string" || commandId.length === 0) {
					throw new TypeError(
						"addCommand needs a command id (a non-empty string)",
					);
				}
				if (entry.ended) return;
				job.commandIds.push(commandId);
				this.#emit(entry);
				this.#writeRecord(entry);
			},
		};
	}

	// ---- Asking and answering ----

	#ask(entry: Entry, request: JobRequest): Promise<JobAnswer> {
		if (entry.ended || entry.controller.signal.aborted) {
			return Promise.reject(
				entry.controller.signal.aborted
					? entry.controller.signal.reason
					: new Error(`job ${entry.job.id} has ended`),
			);
		}
		this.#requestCount += 1;
		const parsed = parseSafely(userRequestSchema, {
			...request,
			id: `request-${this.#requestCount}`,
		});
		if (!parsed.success) {
			return Promise.reject(
				new Error(
					`job ${entry.job.id} asked an invalid request: ${parsed.detail}`,
				),
			);
		}
		return new Promise<JobAnswer>((resolve, reject) => {
			entry.asks.push({
				request: parsed.data as UserRequest,
				resolve,
				reject,
			});
			if (entry.asks.length === 1) this.#openNext(entry);
		});
	}

	/** Shows the next waiting request, or goes back to running when there is none. */
	#openNext(entry: Entry): void {
		const next = entry.asks[0];
		if (next) {
			entry.job.state = "waiting-for-user";
			entry.job.request = next.request;
		} else {
			entry.job.state = "running";
			delete entry.job.request;
		}
		this.#emit(entry);
	}

	#respond(jobId: JobId, requestId: string, answer: JobAnswer): void {
		const entry = this.#require(jobId);
		const open = entry.asks[0];
		if (entry.ended || !open) {
			throw new StudioFailure({
				code: ERROR_CODES.jobNotWaiting,
				message: strings.jobNotWaiting,
				detail: jobId,
			});
		}
		if (open.request.id !== requestId) {
			throw new StudioFailure({
				code: ERROR_CODES.jobRequestMismatch,
				message: strings.jobRequestMismatch,
				detail: `${jobId} is asking ${open.request.id}, not ${requestId}`,
			});
		}
		const problem = answerProblem(open.request, answer);
		if (problem) {
			throw new StudioFailure({
				code: ERROR_CODES.invalidInput,
				message: strings.jobAnswerInvalid,
				detail: problem,
			});
		}
		entry.asks.shift();
		open.resolve(answer);
		this.#openNext(entry);
	}

	/** Rejects the open request and every waiting one (a cancel denies them). */
	#denyAsks(entry: Entry, reason: unknown): void {
		const asks = entry.asks.splice(0);
		for (const ask of asks) ask.reject(reason);
		if (entry.job.request) {
			delete entry.job.request;
			if (!entry.ended) entry.job.state = "running";
		}
	}

	// ---- Cancelling and ending ----

	/**
	 * Cancels without asking whether the job may be cancelled (the caller checks that). A queued job ends at
	 * once; a running one has its signal aborted and its requests denied, and ends when its runner settles, so
	 * the next job in its lane never overlaps it.
	 */
	#cancel(entry: Entry): void {
		if (entry.ended) return;
		if (!entry.started) {
			this.#end(entry, "cancelled");
			return;
		}
		if (entry.controller.signal.aborted) return;
		entry.controller.abort();
		const hadRequest = entry.asks.length > 0;
		this.#denyAsks(entry, entry.controller.signal.reason);
		if (hadRequest) this.#emit(entry);
	}

	#end(
		entry: Entry,
		state: Extract<JobState, "succeeded" | "failed" | "cancelled">,
		outcome: { result?: unknown; error?: StudioError } = {},
	): void {
		if (entry.ended) return;
		entry.ended = true;
		const { job } = entry;
		try {
			job.state = state;
			if (outcome.result !== undefined) job.result = outcome.result;
			if (outcome.error !== undefined) job.error = outcome.error;
			this.#denyAsks(entry, new Error(`job ${job.id} has ended`));
		} catch (err) {
			this.#log(`ending job ${job.id} went wrong: ${describe(err)}`);
		} finally {
			// Whatever happened above, the end is announced (its seq moves on, so a list never carries a terminal
			// state at an old seq), then the stream ends, then the end is recorded and the lane moves on.
			this.#emit(entry);
			if (job.streamId !== undefined) {
				try {
					this.#streams.end(job.streamId);
				} catch (err) {
					this.#log(
						`ending the stream of job ${job.id} went wrong: ${describe(err)}`,
					);
				}
			}
			const recorded = entry.started
				? this.#queueRecordWrite(() => this.#records.ended(job.id, state))
				: Promise.resolve();
			void recorded.then(entry.markDone);
			this.#leaveLane(entry);
			this.#ended.push(job.id);
			this.#trimEnded();
		}
	}

	#leaveLane(entry: Entry): void {
		const lane = this.#lanes.get(entry.lane);
		if (!lane) return;
		const at = lane.indexOf(entry);
		if (at !== -1) lane.splice(at, 1);
		const next = lane[0];
		if (!next) {
			this.#lanes.delete(entry.lane);
		} else if (!next.started) {
			this.#start(next);
		}
	}

	/** Keeps the newest FINISHED_JOBS_KEPT ended jobs; the older ones leave the list and their streams go. */
	#trimEnded(): void {
		while (this.#ended.length > FINISHED_JOBS_KEPT) {
			const id = this.#ended.shift() as JobId;
			const streamId = this.#jobs.get(id)?.job.streamId;
			this.#jobs.delete(id);
			if (streamId !== undefined) this.#streams.release(streamId);
		}
	}

	/** The error a failed runner leaves: its own StudioError, or internal.unexpected; valid and masked. */
	#failure(entry: Entry, err: unknown): StudioError {
		const raw = toStudioError(err);
		const valid = parseSafely(studioErrorSchema, raw);
		const data = valid.success ? toData(valid.data) : undefined;
		const error = data?.ok
			? this.#masker.maskError(data.value as StudioError)
			: this.#internal(
					`the job failed with an error that is not a valid StudioError (code ${String(raw.code)})`,
				);
		const exempt =
			error.code.startsWith("bridge.") || error.code === ERROR_CODES.internal;
		if (!exempt && !entry.op.errors.includes(error.code as never)) {
			this.#log(
				`${entry.op.name} failed with ${error.code}, which it does not list in its errors (a bug in its runner)`,
			);
		}
		return error;
	}

	// ---- Records and events ----

	#writeRecord(entry: Entry): Promise<void> {
		const { job } = entry;
		const record: JobRecord = {
			jobId: job.id,
			kind: job.kind,
			title: job.title,
			startedAt: entry.startedAt,
			commandIds: [...job.commandIds],
			...(job.projectId === undefined ? {} : { projectId: job.projectId }),
		};
		return this.#queueRecordWrite(() => this.#records.started(record));
	}

	/** Runs `write` after every earlier write; a failure is logged, never thrown. */
	#queueRecordWrite(write: () => Promise<void>): Promise<void> {
		this.#recordWrites = this.#recordWrites.then(write).catch((err) => {
			this.#log(`writing a job record failed: ${describe(err)}`);
		});
		return this.#recordWrites;
	}

	/** Announces a change: every change to a job passes here, so its `seq` counts them (the newest is highest). */
	#emit(entry: Entry): void {
		entry.job.seq += 1;
		try {
			this.#events.emit({ type: "job.updated", job: snapshot(entry.job) });
		} catch (err) {
			this.#log(`announcing job ${entry.job.id} failed: ${describe(err)}`);
		}
	}

	/** An `internal.unexpected` error with `detail`, masked. */
	#internal(detail: string): StudioError {
		return this.#masker.maskError(toStudioError(new Error(detail)));
	}

	#isOwn(jobId: JobId): boolean {
		return jobId.startsWith(this.#idPrefix);
	}

	#kind(name: string): JobOperation {
		if (!Object.hasOwn(this.#kinds, name)) {
			throw new Error(`${name} is not a job kind in the contract`);
		}
		return this.#kinds[name] as JobOperation;
	}

	#require(jobId: JobId): Entry {
		const entry = this.#jobs.get(jobId);
		if (!entry) throw notFound(jobId);
		return entry;
	}
}

function notFound(jobId: JobId): StudioFailure {
	return new StudioFailure({
		code: ERROR_CODES.jobNotFound,
		message: strings.jobNotFound,
		detail: jobId,
	});
}

/**
 * A copy that later changes to the job do not reach (events and lists hold these). Every field is plain data by
 * construction (results and errors pass `toData` before they are stored), so the copy does not fail; if it ever
 * did, the copy leaves out the result and the error's extras rather than throw.
 */
function snapshot(job: Job): Job {
	try {
		return structuredClone(job);
	} catch {
		const { result: _result, error, ...rest } = job;
		const plain: Job = structuredClone({
			...rest,
			commandIds: [...rest.commandIds],
		});
		if (error) {
			plain.error = { code: error.code, message: error.message };
			if (error.detail !== undefined) plain.error.detail = error.detail;
		}
		return plain;
	}
}

/** The UserRequest (without its id) a `confirm` asks: the shared approve and deny options, labelled from strings. */
function confirmRequest(request: JobConfirmRequest): JobRequest {
	// The approval pattern's rule: a destructive action always asks for the thing's name (a modal with a typed name).
	if (request.destructive && !request.expectedName)
		throw new TypeError(
			"a destructive confirm needs expectedName: the person types the thing's name",
		);
	const approve: NonNullable<UserRequest["options"]>[number] = {
		id: CONFIRM_OPTION_IDS.approve,
		label: request.approveLabel ?? strings.confirmApprove,
	};
	if (request.destructive) approve.destructive = true;
	return {
		kind: request.expectedName === undefined ? "confirm" : "confirm-by-name",
		title: request.title,
		summary: request.summary,
		affects: [...(request.affects ?? [])],
		...(request.expectedName === undefined
			? {}
			: { expectedName: request.expectedName }),
		options: [
			approve,
			{
				id: CONFIRM_OPTION_IDS.deny,
				label: request.denyLabel ?? strings.confirmDeny,
			},
		],
	};
}

/**
 * Why `answer` does not fit `request`, or undefined when it does. Denying a `confirm-by-name` request needs no
 * typed name: the name guards the action, and saying no to it is always safe.
 */
function answerProblem(
	request: UserRequest,
	answer: JobAnswer,
): string | undefined {
	if (request.options && request.options.length > 0) {
		if (!request.options.some((option) => option.id === answer.optionId)) {
			return `the answer's optionId (${String(answer.optionId)}) is not one of the request's options`;
		}
	}
	if (
		request.kind === "confirm-by-name" &&
		request.expectedName !== undefined &&
		answer.optionId !== CONFIRM_OPTION_IDS.deny &&
		answer.name !== request.expectedName
	) {
		return "the typed name is not the name the request asks for";
	}
	return undefined;
}

/** The `projectId` of a job's parsed input, if it has one. */
function projectIdOf(input: unknown): ProjectId | undefined {
	if (typeof input !== "object" || input === null) return undefined;
	const projectId = (input as { projectId?: unknown }).projectId;
	return typeof projectId === "string" ? projectId : undefined;
}
