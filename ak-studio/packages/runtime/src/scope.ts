// ProjectScopes: one scope per open project. Anything that belongs to a project (a job, a session, a watcher)
// registers a disposer on the project's scope, so closing the project stops all of it. `require` is how a
// handler refuses an operation for a project that is not open (`project.notOpen`). ProjectService opens and
// closes scopes from P2; in P1b only tests do (ruling 10).
import {
	ERROR_CODES,
	type ProjectId,
	StudioFailure,
} from "@ak-studio/contract";
import { defaultLog, type Log, maskedLog } from "./host";
import { SecretMasker } from "./secrets";
import { strings } from "./strings";

/** Stops something a project owns. May be async; disposal waits for it. */
export type Disposer = () => void | Promise<void>;

export interface ProjectScopeOptions {
	/** The project's folder. */
	root: string;
}

export class ProjectScope {
	readonly projectId: ProjectId;
	readonly root: string;
	readonly #log: Log;
	readonly #disposers = new Set<Disposer>();
	#disposing: Promise<void> | undefined;

	constructor(projectId: ProjectId, options: ProjectScopeOptions, log: Log) {
		this.projectId = projectId;
		this.root = options.root;
		this.#log = log;
	}

	get disposed(): boolean {
		return this.#disposing !== undefined;
	}

	/**
	 * Registers `fn` to run when the scope is disposed; answers the function that unregisters it (call it when
	 * the thing stops by itself). On a scope already disposed, `fn` runs at once.
	 */
	onDispose(fn: Disposer): () => void {
		if (this.#disposing) {
			void this.#run(fn);
			return () => {};
		}
		this.#disposers.add(fn);
		return () => {
			this.#disposers.delete(fn);
		};
	}

	/**
	 * Runs every disposer once, newest first, each after the previous one finishes. A disposer that fails is
	 * logged and the rest still run. A second call answers the same promise.
	 */
	dispose(): Promise<void> {
		this.#disposing ??= (async () => {
			const disposers = [...this.#disposers].reverse();
			this.#disposers.clear();
			for (const fn of disposers) await this.#run(fn);
		})();
		return this.#disposing;
	}

	async #run(fn: Disposer): Promise<void> {
		try {
			await fn();
		} catch (err) {
			this.#log(
				`disposing project ${this.projectId} failed: ${err instanceof Error ? err.message : String(err)}`,
			);
		}
	}
}

export interface ProjectScopesOptions {
	log?: Log;
	/** Masks the log line for a failing disposer (pass `registry.masker`). Defaults to one that knows none. */
	masker?: SecretMasker;
}

export class ProjectScopes {
	readonly #scopes = new Map<ProjectId, ProjectScope>();
	readonly #log: Log;

	constructor(options: ProjectScopesOptions = {}) {
		this.#log = maskedLog(
			options.log ?? defaultLog,
			options.masker ?? new SecretMasker(),
		);
	}

	/** Opens the project's scope. Throws (a bug in the caller) if the project is already open. */
	open(projectId: ProjectId, options: ProjectScopeOptions): ProjectScope {
		if (this.#scopes.has(projectId)) {
			throw new Error(`project ${projectId} is already open`);
		}
		const scope = new ProjectScope(projectId, options, this.#log);
		this.#scopes.set(projectId, scope);
		return scope;
	}

	get(projectId: ProjectId): ProjectScope | undefined {
		return this.#scopes.get(projectId);
	}

	/** The project's scope; throws a `project.notOpen` StudioFailure if it is not open. */
	require(projectId: ProjectId): ProjectScope {
		const scope = this.#scopes.get(projectId);
		if (!scope) {
			throw new StudioFailure({
				code: ERROR_CODES.projectNotOpen,
				message: strings.projectNotOpen,
				detail: projectId,
			});
		}
		return scope;
	}

	/** Closes the project: it is no longer open from this call on, and its scope is disposed. */
	close(projectId: ProjectId): Promise<void> {
		const scope = this.#scopes.get(projectId);
		if (!scope) return Promise.resolve();
		this.#scopes.delete(projectId);
		return scope.dispose();
	}

	/** Closes every open project, the most recently opened first. */
	async closeAll(): Promise<void> {
		for (const projectId of [...this.#scopes.keys()].reverse()) {
			await this.close(projectId);
		}
	}
}
