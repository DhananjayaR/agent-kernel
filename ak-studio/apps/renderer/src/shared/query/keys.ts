// The query-key factory (architecture.md, "Where each kind of data lives", rule 4). Every query key in the
// renderer is built here, shaped `[domain, projectId, ...detail]` (app-level data, which belongs to no project:
// `[domain, ...detail]`), so a `domain.changed` event invalidates a domain's queries by prefix (`[domain]`, or
// `[domain, projectId]`) without knowing what each feature caches.
import type { ProjectId } from "@ak-studio/contract";

export interface DomainKeys<D extends string> {
	/** Every query of the domain; also the key of app-level data that belongs to no project (`app.info`). */
	readonly all: readonly [D];
	/**
	 * One app-level query of the domain (data that belongs to no project), named by its parts: `[domain, ...parts]`.
	 * A domain with more than one app-level query gives each its own parts, so they never share a cache entry.
	 */
	app<P extends readonly unknown[]>(...parts: P): readonly [D, ...P];
	/** Every query of the domain for one project. */
	project(projectId: ProjectId): readonly [D, ProjectId];
	/** One query of the domain for one project, named by its parts. */
	detail<P extends readonly unknown[]>(
		projectId: ProjectId,
		...parts: P
	): readonly [D, ProjectId, ...P];
}

export function keys<D extends string>(domain: D): DomainKeys<D> {
	return Object.freeze({
		all: Object.freeze([domain] as const),
		app: <P extends readonly unknown[]>(...parts: P) =>
			[domain, ...parts] as const,
		project: (projectId: ProjectId) => [domain, projectId] as const,
		detail: <P extends readonly unknown[]>(projectId: ProjectId, ...parts: P) =>
			[domain, projectId, ...parts] as const,
	});
}
