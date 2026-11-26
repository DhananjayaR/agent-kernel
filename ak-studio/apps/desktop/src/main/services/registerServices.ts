// Every service the app serves, registered against one ServiceRegistry. index.ts builds the app's registry with
// this, and the contract test (registerServices.test.ts) uses the same function, so a service dropped here
// fails the test and not only the app's start-up. No Electron import: index.ts passes Electron's values in.
import {
	EventBus,
	type SecretMasker,
	type ServiceRegistry,
	StreamHub,
} from "@ak-studio/runtime";
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
	masker: SecretMasker;
	events: EventBus;
	streams: StreamHub;
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
	// One masker: the registry's (errors) is the hub's (stream output), so a secret added once is hidden in both.
	const masker = registry.masker;
	const events = new EventBus({ masker });
	registry.register(events);
	const streams = new StreamHub({ masker });
	registry.register(streams);
	// TEMPORARY (P1b Task 3): the job and session operations answer bridge.unavailable until their services
	// exist (Task 5); Task 6 replaces this line with them.
	registry.register(new PendingP1bService());
	return { app, window, masker, events, streams };
}
