// The runtime's feature services, in one list: the browser-safe services that serve a feature's operations
// (architecture.md, Main-process services). Each entry is a factory that builds the service from its dependencies,
// passed to its constructor. The desktop's registerServices (the real ports from P2) and the browser's mock
// transport (the fakes from ports/fakes.ts) both call `registerFeatureServices`, so the mock serves every feature
// operation the app serves (P1b-plan ruling 9). `pnpm new:operation` creates a feature's service under
// src/<feature>/ and adds its factory to FEATURE_SERVICES; a service that needs Node or Electron itself lives in
// apps/desktop instead (`pnpm new:operation --desktop`).
import type { Operations } from "@ak-studio/contract";
import type { EventBus } from "./events";
import type { JobService } from "./jobs";
import type { CommandRunner } from "./ports/commandRunner";
import type { ProjectFs } from "./ports/projectFs";
import type { Watcher } from "./ports/watcher";
import type { RequestRegistrar } from "./registry";
import type { ProjectScopes } from "./scope";
import type { SecretMasker } from "./secrets";
import type { SessionService } from "./sessions";
import type { StreamHub } from "./streams";

/**
 * What a feature service is built with: the ports (the only way to run a process, touch the project folder or
 * watch it; optional until P2 provides the real ones) and the core services. A job kind's runner is given with
 * `jobs.define(name, runner)` and served with `handle(name, jobs.handler(name))`.
 */
export interface FeatureDeps {
	readonly commandRunner?: CommandRunner;
	readonly projectFs?: ProjectFs;
	readonly watcher?: Watcher;
	readonly jobs: JobService;
	readonly sessions: SessionService;
	readonly streams: StreamHub;
	readonly events: EventBus;
	readonly scopes: ProjectScopes;
	readonly masker: SecretMasker;
}

/** A feature's runtime service: one class per feature, registering a handler for each of its operations. */
export interface FeatureService {
	register(registry: RequestRegistrar<Operations>): void;
}

/** Every runtime feature service, as a factory (`pnpm new:operation` adds each feature's when it creates it). */
const FEATURE_SERVICES: readonly ((deps: FeatureDeps) => FeatureService)[] = [];

/**
 * Builds every runtime feature service from `deps` and registers its handlers on `registry` (before
 * `registry.start()`). Answers the services, in list order.
 */
export function registerFeatureServices(
	registry: RequestRegistrar<Operations>,
	deps: FeatureDeps,
): FeatureService[] {
	return FEATURE_SERVICES.map((create) => {
		const service = create(deps);
		service.register(registry);
		return service;
	});
}
