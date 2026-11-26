// Every service the app serves, registered against one ServiceRegistry. index.ts builds the app's registry with
// this, and the contract test (bridge/registry.test.ts) uses the same function, so a service dropped here fails
// the test and not only the app's start-up. No Electron import: index.ts passes Electron's values in.
import type { ServiceRegistry } from "../bridge/registry";
import { AppService, type AppServiceOptions } from "./AppService";
import { PendingP1bService } from "./PendingP1bService";
import { type ControlledWindow, WindowService } from "./WindowService";

/** What the services need from the app (Electron's values, the data folder's files). */
export interface ServiceDeps {
	app: AppServiceOptions;
	/** The app's window, or null before it exists and after it closes. */
	window: () => ControlledWindow | null;
}

/** The registered services, for index.ts to read start-up state from (e.g. the stored theme). */
export interface Services {
	app: AppService;
	window: WindowService;
}

/** Registers every service on `registry` and returns them. Call before `registry.start()`. */
export function registerServices(
	registry: ServiceRegistry,
	deps: ServiceDeps,
): Services {
	const app = new AppService(deps.app);
	registry.register(app);
	const window = new WindowService(deps.window);
	registry.register(window);
	// TEMPORARY (P1b Task 3): the job, session and event operations answer bridge.unavailable until their
	// services exist (Tasks 4 and 5); Task 6 replaces this line with them.
	registry.register(new PendingP1bService());
	return { app, window };
}
