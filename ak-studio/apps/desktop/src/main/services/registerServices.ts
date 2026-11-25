// Every service the app serves, registered against one ServiceRegistry. index.ts builds the app's registry with
// this, and the contract test (bridge/registry.test.ts) uses the same function, so a service dropped here fails
// the test and not only the app's start-up. No Electron import: index.ts passes Electron's values in.
import type { ServiceRegistry } from "../bridge/registry";
import { AppService, type AppServiceOptions } from "./AppService";

/** What the services need from the app (Electron's values, the data folder's files). */
export interface ServiceDeps {
	app: AppServiceOptions;
}

/** The registered services, for index.ts to read start-up state from (e.g. the stored theme). */
export interface Services {
	app: AppService;
}

/** Registers every service on `registry` and returns them. Call before `registry.start()`. */
export function registerServices(
	registry: ServiceRegistry,
	deps: ServiceDeps,
): Services {
	const app = new AppService(deps.app);
	registry.register(app);
	return { app };
}
