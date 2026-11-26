// In-memory fakes of the four ports, for tests and for the browser's mock transport (Task 7), which runs the
// runtime's real services over them. They keep the ports' rules (FakeProjectFs refuses paths outside the root
// and stale writes) so a service tested against them behaves the same against the desktop's Node versions.
import type { JobId, JobState, Revision } from "@ak-studio/contract";
import type {
	CommandOutputChannel,
	CommandRequest,
	CommandResult,
	CommandRunner,
} from "./commandRunner";
import type { JobRecord, JobRecordStore } from "./jobRecordStore";
import {
	FileChangedOnDiskFailure,
	type FileSnapshot,
	fileNotFound,
	outsideProject,
	type ProjectFs,
} from "./projectFs";
import type { Watcher } from "./watcher";

// ---- Revisions ----

/**
 * A content hash in the contract's Revision format (64 hex digits), in plain JavaScript: eight seeded FNV-1a
 * lanes. Not SHA-256 and not for security; only equal content gives equal revisions, as the real one does.
 */
export function fakeRevision(content: string): Revision {
	let out = "";
	for (let lane = 0; lane < 8; lane++) {
		let h = (0x811c9dc5 ^ Math.imul(lane + 1, 0x9e3779b1)) >>> 0;
		for (let i = 0; i < content.length; i++) {
			h ^= content.charCodeAt(i);
			h = Math.imul(h, 0x01000193);
		}
		h ^= content.length;
		h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
		h ^= h >>> 13;
		out += (h >>> 0).toString(16).padStart(8, "0");
	}
	return out;
}

// ---- ProjectFs ----

const SEPARATORS = /[\\/]+/;

function isAbsolute(path: string): boolean {
	return /^[\\/]/.test(path) || /^[A-Za-z]:/.test(path);
}

/** Resolves "." and ".." in `parts`; undefined if ".." climbs above the first part. */
function normalize(parts: string[]): string[] | undefined {
	const out: string[] = [];
	for (const part of parts) {
		if (part === "" || part === ".") continue;
		if (part === "..") {
			if (out.length === 0) return undefined;
			out.pop();
		} else out.push(part);
	}
	return out;
}

/** `path` as a normalised path relative to `root`, or undefined when it resolves outside it (or to it). */
export function resolveInRoot(root: string, path: string): string | undefined {
	const rootParts = normalize(root.split(SEPARATORS)) ?? [];
	let parts: string[] | undefined;
	if (isAbsolute(path)) {
		const absolute = normalize(path.split(SEPARATORS));
		if (!absolute || absolute.length <= rootParts.length) return undefined;
		if (rootParts.some((part, i) => absolute[i] !== part)) return undefined;
		parts = absolute.slice(rootParts.length);
	} else {
		parts = normalize(path.split(SEPARATORS));
	}
	if (!parts || parts.length === 0) return undefined;
	return parts.join("/");
}

/** A project folder in memory: files by path relative to `root`. */
export class FakeProjectFs implements ProjectFs {
	readonly root: string;
	readonly #files = new Map<string, string>();

	constructor(root: string, files: Readonly<Record<string, string>> = {}) {
		// A relative root would make every relative path resolve against nothing: a bug in the caller.
		if (!isAbsolute(root)) {
			throw new Error(`FakeProjectFs needs an absolute root, not "${root}"`);
		}
		this.root = root;
		for (const [path, content] of Object.entries(files)) {
			this.setFile(path, content);
		}
	}

	async read(path: string): Promise<FileSnapshot> {
		const key = this.#resolve(path);
		const content = this.#files.get(key);
		if (content === undefined) throw fileNotFound(key);
		return { content, revision: fakeRevision(content) };
	}

	async write(
		path: string,
		content: string,
		baseRevision: Revision | null,
	): Promise<{ revision: Revision }> {
		const key = this.#resolve(path);
		const current = this.#files.get(key);
		if (current === undefined && baseRevision !== null) {
			throw fileNotFound(key);
		}
		if (current !== undefined) {
			const revision = fakeRevision(current);
			if (revision !== baseRevision) {
				throw new FileChangedOnDiskFailure(key, {
					content: current,
					revision,
				});
			}
		}
		this.#files.set(key, content);
		return { revision: fakeRevision(content) };
	}

	/** Changes a file as something outside the app would (no revision check). */
	setFile(path: string, content: string): void {
		this.#files.set(this.#resolve(path), content);
	}

	/** Removes a file as something outside the app would. */
	deleteFile(path: string): void {
		this.#files.delete(this.#resolve(path));
	}

	/** Every file, by path relative to the root. */
	snapshot(): Record<string, string> {
		return Object.fromEntries(this.#files);
	}

	#resolve(path: string): string {
		const key = resolveInRoot(this.root, path);
		if (key === undefined) throw outsideProject(path);
		return key;
	}
}

// ---- CommandRunner ----

/** What a fake run does: the output it writes, then how it exits. */
export interface FakeCommandScript {
	output?: ReadonlyArray<readonly [CommandOutputChannel, string]>;
	exitCode?: number | null;
	durationMs?: number;
}

/** Runs nothing: answers what `script` says for each request (it may wait, to hold a run open). */
export class FakeCommandRunner implements CommandRunner {
	readonly calls: CommandRequest[] = [];
	readonly #script: (
		request: CommandRequest,
	) => FakeCommandScript | Promise<FakeCommandScript>;
	#count = 0;

	constructor(
		script: (
			request: CommandRequest,
		) => FakeCommandScript | Promise<FakeCommandScript> = () => ({}),
	) {
		this.#script = script;
	}

	async run(request: CommandRequest): Promise<CommandResult> {
		this.#count += 1;
		const commandId = `cmd-${this.#count}`;
		this.calls.push(request);
		const script = request.signal.aborted ? {} : await this.#script(request);
		if (request.signal.aborted) {
			return { commandId, exitCode: null, durationMs: script.durationMs ?? 0 };
		}
		for (const [channel, text] of script.output ?? []) {
			request.onOutput?.(channel, text);
		}
		return {
			commandId,
			exitCode: script.exitCode === undefined ? 0 : script.exitCode,
			durationMs: script.durationMs ?? 0,
		};
	}
}

// ---- Watcher ----

/** Reports only the changes a test announces with `change`. */
export class FakeWatcher implements Watcher {
	readonly #watches = new Map<string, Set<(paths: string[]) => void>>();

	watch(root: string, onChange: (paths: string[]) => void): () => void {
		let set = this.#watches.get(root);
		if (!set) {
			set = new Set();
			this.#watches.set(root, set);
		}
		set.add(onChange);
		return () => {
			set.delete(onChange);
			if (set.size === 0) this.#watches.delete(root);
		};
	}

	/** Announces that `paths` changed under `root`. */
	change(root: string, paths: string[]): void {
		for (const onChange of [...(this.#watches.get(root) ?? [])]) {
			onChange([...paths]);
		}
	}

	watching(root: string): boolean {
		return this.#watches.has(root);
	}
}

// ---- JobRecordStore ----

/**
 * Records in a Map. Pass one store's `data` to a new store to model a restart: the unfinished records are
 * still there.
 */
export class InMemoryJobRecordStore implements JobRecordStore {
	readonly data: Map<JobId, JobRecord>;

	constructor(data: Map<JobId, JobRecord> = new Map()) {
		this.data = data;
	}

	async started(record: JobRecord): Promise<void> {
		this.data.set(record.jobId, copy(record));
	}

	async ended(jobId: JobId, _state: JobState): Promise<void> {
		this.data.delete(jobId);
	}

	async unfinished(): Promise<JobRecord[]> {
		return [...this.data.values()]
			.map(copy)
			.sort((a, b) => a.startedAt - b.startedAt);
	}

	async dismiss(jobId: JobId): Promise<boolean> {
		return this.data.delete(jobId);
	}
}

function copy(record: JobRecord): JobRecord {
	return { ...record, commandIds: [...record.commandIds] };
}
