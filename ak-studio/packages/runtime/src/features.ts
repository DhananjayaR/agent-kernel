// The runtime's feature services, in one list: the browser-safe services that serve a feature's operations
// (architecture.md, Main-process services). The desktop's registerServices and the browser's mock transport both
// call `registerFeatureServices`, so the mock serves every feature operation the app serves (P1b-plan ruling 9).
// `pnpm new:operation` creates a feature's service under src/<feature>/ and adds it to FEATURE_SERVICES; a service
// that needs Node or Electron lives in apps/desktop instead (`pnpm new:operation --desktop`).
import type { Operations } from "@ak-studio/contract";
import type { EventBus } from "./events";
import type { JobService } from "./jobs";
import type { RequestRegistrar } from "./registry";
import type { ProjectScopes } from "./scope";
import type { SessionService } from "./sessions";

/**
 * What a feature service registers with: the request handlers, plus the shared services it builds on. A job
 * kind's runner is given with `jobs.define(name, runner)` and served with `handle(name, jobs.handler(name))`.
 */
export interface FeatureRegistry extends RequestRegistrar<Operations> {
	readonly jobs: JobService;
	readonly sessions: SessionService;
	readonly events: EventBus;
	readonly scopes: ProjectScopes;
}

/** A feature's runtime service: one class per feature, registering a handler for each of its operations. */
export interface FeatureService {
	register(registry: FeatureRegistry): void;
}

/** Every runtime feature service, by class (`pnpm new:operation` adds each feature's when it creates it). */
const FEATURE_SERVICES: readonly (new () => FeatureService)[] = [];

/** The shared services a feature service builds on, as registerServices and the mock transport hold them. */
export type FeatureServiceDeps = Omit<FeatureRegistry, "handle">;

/**
 * Creates every runtime feature service and registers its handlers on `registry` (before `registry.start()`).
 * Answers the services, in list order.
 */
export function registerFeatureServices(
	registry: RequestRegistrar<Operations>,
	deps: FeatureServiceDeps,
): FeatureService[] {
	const features: FeatureRegistry = {
		...deps,
		handle: (name, handler) => registry.handle(name, handler),
	};
	return FEATURE_SERVICES.map((Service) => {
		const service = new Service();
		service.register(features);
		return service;
	});
}
