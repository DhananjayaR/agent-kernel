// Every service the app serves, registered against one ServiceRegistry. index.ts builds the app's registry with
// this, and the contract test (registerServices.test.ts) uses the same function, so a service dropped here
// fails the test and not only the app's start-up. No Electron import: index.ts passes Electron's values in.
import {
	EventBus,
	JobService,
	type Log,
	ProjectScopes,
	type SecretMasker,
	type ServiceRegistry,
	SessionService,
	StreamHub,
} from "@ak-studio/runtime";
import { NodeJobRecordStore } from "../infra/NodeJobRecordStore";
import { AppService, type AppServiceOptions } from "./AppService";
import { type ControlledWindow, WindowService } from "./WindowService";

/** What the services need from the app (Electron's values, the data folder's files). */
export interface ServiceDeps {
	app: AppServiceOptions;
	/** The app's window, or null before it exists and after it closes. */
	window: () => ControlledWindow | null;
	/** The crash records' folder: `<userData>/jobs` (JOB_RECORDS_FOLDER). */
	jobRecordsDir: string;
	/** The main process's log, the one the registry was given; the services' lines reach it masked. */
	log: Log;
}

/** The registered services, for index.ts to read start-up state from (the stored theme) and to quit with. */
export interface Services {
	app: AppService;
	window: WindowService;
	masker: SecretMasker;
	events: EventBus;
	streams: StreamHub;
	scopes: ProjectScopes;
	jobs: JobService;
	sessions: SessionService;
}

/** Registers every service on `registry` and returns them. Call before `registry.start()`. */
export function registerServices(
	registry: ServiceRegistry,
	deps: ServiceDeps,
): Services {
	// One masker, the registry's: errors, stream output, job and session errors and every log line share it, so a
	// secret added once is hidden everywhere.
	const masker = registry.masker;
	// The services that mask their own lines get the plain log; the hub and the record store get it masked.
	const log = deps.log;
	const maskedLog: Log = (message) => log(masker.mask(message));
	const app = new AppService(deps.app);
	registry.register(app);
	const window = new WindowService(deps.window);
	registry.register(window);
	const events = new EventBus({ masker, log });
	registry.register(events);
	const streams = new StreamHub({ masker, log: maskedLog });
	registry.register(streams);
	const scopes = new ProjectScopes({ masker, log });
	const jobs = new JobService({
		events,
		streams,
		scopes,
		records: new NodeJobRecordStore(deps.jobRecordsDir, { log: maskedLog }),
		masker,
		log,
	});
	registry.register(jobs);
	const sessions = new SessionService({ events, streams, scopes, masker, log });
	registry.register(sessions);
	return { app, window, masker, events, streams, scopes, jobs, sessions };
}
