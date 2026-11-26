// SessionService: runs the long-lived things (architecture.md, Sessions): a local server, an agent session. A
// feature declares a session kind with `defineSessionKind`, adds it to `sessionKinds`, and gives SessionService
// its starter with `define`. SessionService serves `session.start`, `session.stop` and `sessions.list`, keeps
// one session per kind per project, parses the kind's `args` and `info` at the boundary, owns each session's
// state (starting, running, stopping, then stopped or failed) and output stream, stops a project's sessions when
// its scope is disposed, and announces every change as a `session.updated` event, each one adding to the
// session's `seq`. Browser-safe, like the rest of the runtime: the desktop and the browser's mock transport both
// serve from it.
import {
	ERROR_CODES,
	isStudioFailure,
	type ProjectId,
	parseInput,
	parseSafely,
	type SafeParseResult,
	type Session,
	type SessionId,
	type SessionKind,
	type SessionKindMap,
	type SessionKinds,
	type StreamChannel,
	type StudioError,
	StudioFailure,
	type sessionStart,
	type sessionStop,
	type sessionsList,
	studioErrorSchema,
	sessionKinds as studioSessionKinds,
	toStudioError,
} from "@ak-studio/contract";
import type { z } from "zod";
import type { EventBus } from "./events";
import { defaultLog, type Log, maskedLog } from "./host";
import { describe, toData } from "./plain";
import type { RequestRegistrar } from "./registry";
import type { ProjectScope, ProjectScopes } from "./scope";
import type { SecretMasker } from "./secrets";
import type { StreamHub } from "./streams";
import { strings } from "./strings";

/** How many ended sessions `sessions.list` keeps (with their output streams); older ones leave and their streams are released. */
export const ENDED_SESSIONS_KEPT = 50;

/** What a starter gets besides its args: its session's id, the stop signal, and the ways it reports back. */
export interface SessionContext {
	readonly sessionId: SessionId;
	/** The project the session belongs to, from `session.start`'s `projectId`. */
	readonly projectId: ProjectId | undefined;
	/** Aborted when a stop arrives while the session is still starting. Give up starting then. */
	readonly signal: AbortSignal;
	/** The session's output stream (read with `stream.read`); masked by StreamHub. Ignored once it has ended. */
	readonly stream: { write(channel: StreamChannel, text: string): void };
	/** Notes a CommandRunner record behind the session. */
	addCommand(commandId: string): void;
	/**
	 * The session stopped by itself (its process exited, its connection dropped): it ends in `failed` with this
	 * error (a StudioFailure's own, or `session.failed`), and its `stop` is not called. Ignored once it has ended
	 * or while it is being stopped.
	 */
	fail(error: unknown): void;
}

/** A started session: its kind's `info` (parsed before it is shown) and how to stop it. */
export interface SessionHandle<Info = unknown> {
	info: Info;
	stop(): Promise<void>;
}

/** Starts one session of a kind. A throw ends the session in `failed`. */
export type SessionStarter<Args = unknown, Info = unknown> = (
	args: Args,
	ctx: SessionContext,
) => Promise<SessionHandle<Info>>;

type ArgsOfKind<K extends SessionKind> = z.output<K["args"]>;
type InfoOfKind<K extends SessionKind> = z.input<K["info"]>;

/** The session operations SessionService serves. */
export type SessionOperations = {
	"session.start": typeof sessionStart;
	"session.stop": typeof sessionStop;
	"sessions.list": typeof sessionsList;
};

export interface SessionServiceOptions<
	Kinds extends SessionKindMap = SessionKinds,
> {
	events: EventBus;
	streams: StreamHub;
	scopes: ProjectScopes;
	/** Masks every error a session carries, and the log (pass `registry.masker`). */
	masker: SecretMasker;
	/** The session kinds it may start. Defaults to the contract's; tests pass their own. */
	sessionKinds?: Kinds;
	log?: Log;
}

interface Entry {
	session: Session;
	kind: SessionKind;
	/**
	 * One per kind per project: the key in `#active` until the session has ended and its starter has settled (a
	 * session that failed while starting keeps the slot until what it started is stopped).
	 */
	slot: string;
	controller: AbortController;
	/** Set once the session is running: what `stop` stops. */
	handle: SessionHandle | undefined;
	starterSettled: boolean;
	ended: boolean;
	/** Resolves once the session has ended. */
	done: Promise<void>;
	markDone: () => void;
}

export class SessionService<Kinds extends SessionKindMap = SessionKinds> {
	readonly #events: EventBus;
	readonly #streams: StreamHub;
	readonly #scopes: ProjectScopes;
	readonly #masker: SecretMasker;
	readonly #kinds: SessionKindMap;
	readonly #log: Log;
	readonly #starters = new Map<string, SessionStarter>();
	/** Every session of this run still listed, in the order they started. */
	readonly #sessions = new Map<SessionId, Entry>();
	/** The session holding each kind-and-project slot, until it ends. */
	readonly #active = new Map<string, Entry>();
	readonly #watchedScopes = new WeakSet<ProjectScope>();
	readonly #ended: SessionId[] = [];
	readonly #idPrefix = `session-${Math.random().toString(36).slice(2, 10)}-`;
	#count = 0;

	constructor(options: SessionServiceOptions<Kinds>) {
		this.#events = options.events;
		this.#streams = options.streams;
		this.#scopes = options.scopes;
		this.#masker = options.masker;
		this.#kinds =
			options.sessionKinds ?? (studioSessionKinds as SessionKindMap);
		this.#log = maskedLog(options.log ?? defaultLog, options.masker);
	}

	/** Gives a session kind its starter. Throws (a start-up bug) for a kind not in the map or defined twice. */
	define<K extends keyof Kinds & string>(
		kind: K,
		starter: SessionStarter<ArgsOfKind<Kinds[K]>, InfoOfKind<Kinds[K]>>,
	): this {
		if (!Object.hasOwn(this.#kinds, kind)) {
			throw new Error(`${kind} is not a session kind in the contract`);
		}
		if (this.#starters.has(kind)) {
			throw new Error(`session kind ${kind} already has a starter`);
		}
		this.#starters.set(kind, starter as SessionStarter);
		return this;
	}

	/** Serves `session.start`, `session.stop` and `sessions.list`. */
	register(registry: RequestRegistrar<SessionOperations>): void {
		registry.handle("session.start", ({ kind, projectId, args }) => ({
			sessionId: this.#start(kind, projectId, args),
		}));
		registry.handle("session.stop", ({ sessionId }) => {
			const entry = this.#sessions.get(sessionId);
			if (!entry) {
				throw new StudioFailure({
					code: ERROR_CODES.sessionNotFound,
					message: strings.sessionNotFound,
					detail: sessionId,
				});
			}
			void this.#stop(entry);
			return {};
		});
		registry.handle("sessions.list", () => ({ sessions: this.list() }));
	}

	/** Every session of this run still listed: the live ones and the newest ended ones, oldest first. */
	list(): Session[] {
		return [...this.#sessions.values()].map((entry) => snapshot(entry.session));
	}

	/** Stops every live session at once; resolves once they have all ended (quit uses it). */
	async stopAll(): Promise<void> {
		await Promise.all([...this.#active.values()].map((e) => this.#stop(e)));
	}

	// ---- Starting ----

	#start(kindName: string, projectId: ProjectId | undefined, args: unknown) {
		const kind = Object.hasOwn(this.#kinds, kindName)
			? this.#kinds[kindName]
			: undefined;
		const starter = this.#starters.get(kindName);
		if (!kind || !starter) {
			if (kind) this.#log(`session kind ${kindName} has no starter`);
			throw new StudioFailure({
				code: ERROR_CODES.sessionUnknownKind,
				message: strings.sessionUnknownKind,
				detail: kindName,
			});
		}
		const parsedArgs = parseInput(
			kind.args,
			`session.start (${kindName})`,
			args,
		);
		if (!parsedArgs.ok) throw new StudioFailure(parsedArgs.error);
		const scope =
			projectId === undefined ? undefined : this.#scopes.require(projectId);
		const slot = `${kindName}\u0000${projectId ?? ""}`;
		if (this.#active.has(slot)) {
			throw new StudioFailure({
				code: ERROR_CODES.sessionAlreadyRunning,
				message: strings.sessionAlreadyRunning,
				detail:
					projectId === undefined ? kindName : `${kindName} in ${projectId}`,
			});
		}
		this.#count += 1;
		let markDone!: () => void;
		const done = new Promise<void>((resolve) => {
			markDone = resolve;
		});
		const entry: Entry = {
			session: {
				id: `${this.#idPrefix}${this.#count}`,
				kind: kindName,
				state: "starting",
				streamId: this.#streams.create(),
				commandIds: [],
				...(projectId === undefined ? {} : { projectId }),
				seq: 0,
			},
			kind,
			slot,
			controller: new AbortController(),
			handle: undefined,
			starterSettled: false,
			ended: false,
			done,
			markDone,
		};
		if (scope && !this.#watchedScopes.has(scope)) {
			// One disposer per project, so closing it stops all its sessions at once and waits for them all.
			this.#watchedScopes.add(scope);
			scope.onDispose(() =>
				Promise.all(
					[...this.#active.values()]
						.filter((other) => other.session.projectId === projectId)
						.map((other) => this.#stop(other)),
				).then(() => {}),
			);
		}
		this.#sessions.set(entry.session.id, entry);
		this.#active.set(slot, entry);
		this.#emit(entry);
		void this.#run(entry, starter, parsedArgs.value);
		return entry.session.id;
	}

	async #run(
		entry: Entry,
		starter: SessionStarter,
		args: unknown,
	): Promise<void> {
		try {
			await this.#runStarter(entry, starter, args);
		} catch (err) {
			// Nothing after the starter may leave the session starting with its slot held.
			this.#end(
				entry,
				"failed",
				this.#internal(`starting the session failed: ${describe(err)}`),
			);
		} finally {
			entry.starterSettled = true;
			this.#releaseSlot(entry);
		}
	}

	async #runStarter(
		entry: Entry,
		starter: SessionStarter,
		args: unknown,
	): Promise<void> {
		let handle: SessionHandle;
		try {
			handle = await starter(args, this.#context(entry));
		} catch (err) {
			if (entry.ended) return;
			if (entry.session.state === "stopping") this.#end(entry, "stopped");
			else this.#end(entry, "failed", this.#failure(err));
			return;
		}
		if (entry.ended) {
			// It failed by itself while starting: what started must not keep running.
			await this.#quietStop(entry, handle);
			return;
		}
		if (entry.session.state === "stopping") {
			await this.#stopHandle(entry, handle);
			return;
		}
		// The info must match the kind and be plain data (it is copied into every event and list). A failure
		// stops what was started; `handle` is not kept until then, so a stop meanwhile cannot stop it twice.
		const parsed = readInfo(entry.kind, handle);
		const data = parsed.success ? toData(parsed.data) : undefined;
		if (!data?.ok) {
			const error = this.#masker.maskError({
				code: ERROR_CODES.invalidOutput,
				message: strings.sessionInvalidInfo,
				detail: parsed.success
					? `the info is not plain data: ${data?.detail ?? ""}`
					: parsed.detail,
			});
			this.#log(
				`${entry.session.kind} failed with ${error.code}: ${error.detail ?? ""}`,
			);
			await this.#quietStop(entry, handle);
			this.#end(entry, "failed", error);
			return;
		}
		entry.handle = handle;
		entry.session.info = data.value;
		entry.session.state = "running";
		this.#emit(entry);
	}

	#context(entry: Entry): SessionContext {
		const { session } = entry;
		return {
			sessionId: session.id,
			projectId: session.projectId,
			signal: entry.controller.signal,
			stream: {
				write: (channel, text) => {
					if (entry.ended || session.streamId === undefined) return;
					this.#streams.write(session.streamId, channel, text);
				},
			},
			addCommand: (commandId) => {
				if (typeof commandId !== "string" || commandId.length === 0) {
					throw new TypeError(
						"addCommand needs a command id (a non-empty string)",
					);
				}
				if (entry.ended) return;
				session.commandIds.push(commandId);
				this.#emit(entry);
			},
			fail: (error) => {
				if (entry.ended || session.state === "stopping") return;
				this.#end(entry, "failed", this.#failure(error));
			},
		};
	}

	// ---- Stopping and ending ----

	/** Asks the session to stop; resolves once it has ended. A session still starting stops once its starter settles. */
	#stop(entry: Entry): Promise<void> {
		if (entry.ended || entry.session.state === "stopping") return entry.done;
		entry.session.state = "stopping";
		entry.controller.abort();
		this.#emit(entry);
		if (entry.handle) void this.#stopHandle(entry, entry.handle);
		return entry.done;
	}

	async #stopHandle(entry: Entry, handle: SessionHandle): Promise<void> {
		try {
			await handle.stop();
		} catch (err) {
			this.#end(entry, "failed", this.#failure(err));
			return;
		}
		this.#end(entry, "stopped");
	}

	/** Stops what a starter started, when the session cannot use it; a failure is only logged. */
	async #quietStop(entry: Entry, handle: SessionHandle): Promise<void> {
		try {
			await handle.stop();
		} catch (err) {
			this.#log(
				`stopping ${entry.session.kind} (${entry.session.id}) failed: ${describe(err)}`,
			);
		}
	}

	#end(entry: Entry, state: "stopped" | "failed", error?: StudioError): void {
		if (entry.ended) return;
		entry.ended = true;
		const { session } = entry;
		try {
			session.state = state;
			if (error) session.error = error;
			if (session.streamId !== undefined) this.#streams.end(session.streamId);
			this.#emit(entry);
		} catch (err) {
			this.#log(`ending session ${session.id} went wrong: ${describe(err)}`);
		} finally {
			// Whatever happened above, the slot is freed (once its starter has settled) and waiters resume.
			this.#releaseSlot(entry);
			entry.markDone();
			this.#ended.push(session.id);
			while (this.#ended.length > ENDED_SESSIONS_KEPT) {
				const id = this.#ended.shift() as SessionId;
				const streamId = this.#sessions.get(id)?.session.streamId;
				this.#sessions.delete(id);
				if (streamId !== undefined) this.#streams.release(streamId);
			}
		}
	}

	/** Frees the kind-and-project slot of a session that has ended and whose starter has settled. */
	#releaseSlot(entry: Entry): void {
		if (!entry.ended || !entry.starterSettled) return;
		if (this.#active.get(entry.slot) === entry) this.#active.delete(entry.slot);
	}

	/** The error a failing session carries: a StudioFailure's own, or `session.failed`; valid and masked. */
	#failure(err: unknown): StudioError {
		if (!isStudioFailure(err)) {
			return this.#masker.maskError({
				code: ERROR_CODES.sessionFailed,
				message: strings.sessionFailed,
				detail: describe(err),
			});
		}
		const valid = parseSafely(studioErrorSchema, err.error);
		const data = valid.success ? toData(valid.data) : undefined;
		return data?.ok
			? this.#masker.maskError(data.value as StudioError)
			: this.#internal(
					`the session failed with an error that is not a valid StudioError (code ${describe(err.error.code)})`,
				);
	}

	/** An `internal.unexpected` error with `detail`, masked. */
	#internal(detail: string): StudioError {
		return this.#masker.maskError(toStudioError(new Error(detail)));
	}

	/** Announces a change: every change to a session passes here, so its `seq` counts them (the newest is highest). */
	#emit(entry: Entry): void {
		entry.session.seq += 1;
		try {
			this.#events.emit({
				type: "session.updated",
				session: snapshot(entry.session),
			});
		} catch (err) {
			this.#log(
				`announcing session ${entry.session.id} failed: ${describe(err)}`,
			);
		}
	}
}

/**
 * A copy that later changes to the session do not reach. Every field is plain data by construction (info and
 * errors pass `toData` before they are stored), so the copy does not fail; if it ever did, the copy leaves out
 * the info and the error's extras rather than throw.
 */
function snapshot(session: Session): Session {
	try {
		return structuredClone(session);
	} catch {
		const { info: _info, error, ...rest } = session;
		const plain: Session = structuredClone({
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

/** The handle's `info`, parsed against the kind's schema; a getter that throws is a parse failure. */
function readInfo(kind: SessionKind, handle: SessionHandle): SafeParseResult {
	try {
		return parseSafely(kind.info, handle.info);
	} catch (err) {
		return {
			success: false,
			detail: `reading the info threw: ${describe(err)}`,
		};
	}
}
