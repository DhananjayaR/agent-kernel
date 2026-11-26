// What the open project's OAK version can do (architecture.md, OAK versions in the code): `useCapability(id)`
// answers `available`, `needs-upgrade` or `removed` from the kernel capability catalog, for the version the
// CatalogProvider is given. No feature writes its own version check. In P1b the catalog is empty and nothing
// gives the provider a version; P2's KernelService feeds both (the provider takes them as props).
//
// An id the catalog does not have is a bug (a typo, or an entry not yet added): in development and tests it
// throws, so it is found at once; in a production build it answers "available", so a slip never hides a working
// control, and logs once per id.
//
// Commands are gated outside React too: `runCommand` refuses a command whose capability the project lacks, and the
// command palette (mounted in the shell, perhaps above any provider) lists it with the reason. Both read the
// capability scope, a small store the mounted CatalogProvider writes its catalog and version into, through
// `capabilityGate`. With no project version (no project open, all of P1b) nothing is gated: there is no version to
// compare, and a command that makes no sense without a project hides itself with `when`.
//
// The provider also takes P2's upgrade command builder and docs opener, which the version gate
// (patterns/CapabilityGate.tsx) reads with `useCapabilityNotice` to say why and what to do. The command is shown to
// copy, never run.
import {
	type Capability,
	type CapabilityCatalog,
	type CapabilityStatus,
	EMPTY_CATALOG,
} from "@ak-studio/kernel-catalog";
import {
	createContext,
	type ReactNode,
	useContext,
	useLayoutEffect,
	useMemo,
} from "react";
import { create } from "zustand";
import { capabilityStrings } from "./strings";

/**
 * The capability catalog the app uses: empty until P2 adds its entries (pre-flight ruling 10). The one place it is
 * chosen: the provider's default below, and what the manifest test (app/registry.test.ts) checks every capability
 * a manifest names against.
 */
export const APP_CATALOG: CapabilityCatalog = EMPTY_CATALOG;

interface CatalogContextValue {
	catalog: CapabilityCatalog;
	/** The project's OAK version; undefined with no project, when no capability can be asked about. */
	version: string | undefined;
	/** The upgrade command for a lower bound (P2: from the project's own dependency line, keeping its extras). */
	upgradeCommand?: ((since: string) => string) | undefined;
	/** Opens a capability's docs page (P2: through the main process; the window opens no links itself). */
	openDocs?: ((url: string) => void) | undefined;
}

/** No provider mounted: the app's catalog and no version. */
const NO_PROJECT_SCOPE: CatalogContextValue = Object.freeze({
	catalog: APP_CATALOG,
	version: undefined,
});

const CatalogContext = createContext<CatalogContextValue>(NO_PROJECT_SCOPE);

/**
 * The catalog and version of the mounted CatalogProvider (or none), for what cannot read the context: runCommand,
 * and the command palette. The provider writes it; nothing else should.
 */
export const useCapabilityScope = create<CatalogContextValue>()(
	() => NO_PROJECT_SCOPE,
);

export interface CatalogProviderProps {
	catalog: CapabilityCatalog;
	/** The project's OAK version (P2: from KernelService). */
	version: string;
	/**
	 * Builds the upgrade command for a lower bound ("0.12.0" to `uv add "agentkernel[openai]>=0.12"`). P2's
	 * KernelService builds it from the project's own dependency line, keeping its extras. The version gate shows it
	 * to copy and never runs it; without it, the gate says to upgrade with no command.
	 */
	upgradeCommand?: (since: string) => string;
	/** Opens a capability's docs page. Without it, the version gate shows no docs link. */
	openDocs?: (url: string) => void;
	children?: ReactNode;
}

/** Gives the views below it the catalog and the project's version, and writes both into the capability scope. */
export function CatalogProvider({
	catalog,
	version,
	upgradeCommand,
	openDocs,
	children,
}: CatalogProviderProps) {
	const value = useMemo(
		() => ({ catalog, version, upgradeCommand, openDocs }),
		[catalog, version, upgradeCommand, openDocs],
	);
	useLayoutEffect(() => {
		useCapabilityScope.setState(value, true);
		return () => {
			// A later provider may have taken over: only the scope this one wrote is reset.
			if (useCapabilityScope.getState() === value)
				useCapabilityScope.setState(NO_PROJECT_SCOPE, true);
		};
	}, [value]);
	return (
		<CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>
	);
}

export interface CapabilityCheckOptions {
	/** Throw on an id the catalog lacks (development and tests), rather than answer "available" and log. */
	strict: boolean;
	log: (message: string) => void;
}

/** The ids already logged as unknown in a production build: each is logged once. */
const loggedUnknown = new Set<string>();

/** For tests: log unknown ids again. */
export function resetCapabilityLog(): void {
	loggedUnknown.clear();
}

/** The status of `id` for `version`, by the rules above. Pure apart from the log, so both builds' rules are tested. */
export function capabilityStatus(
	catalog: CapabilityCatalog,
	id: string,
	version: string | undefined,
	options: CapabilityCheckOptions,
): CapabilityStatus {
	if (catalog.has(id) && version !== undefined)
		return catalog.status(id, version);
	const problem = catalog.has(id)
		? `capability ${id} was asked about with no project version (no CatalogProvider above the view)`
		: `capability ${id} is not in the kernel capability catalog`;
	if (options.strict) throw new Error(problem);
	if (!loggedUnknown.has(id)) {
		loggedUnknown.add(id);
		options.log(`${problem}; treated as available`);
	}
	return "available";
}

const consoleLog = (message: string) => console.error(`[studio] ${message}`);

/** Whether the project's OAK version has capability `id`. Throws in development and tests for an id it lacks. */
export function useCapability(id: string): CapabilityStatus {
	const { catalog, version } = useContext(CatalogContext);
	return capabilityStatus(catalog, id, version, {
		// Read on each call (not once at load), so a test can stub the build mode.
		strict: !import.meta.env.PROD,
		log: consoleLog,
	});
}

/** What a version gate shows for a capability: its status, its catalog entry, and the project's version and tools. */
export interface CapabilityNotice {
	status: CapabilityStatus;
	/** The catalog's entry (its title, `since`, `until`, `replacedBy`, `docs`); none only for an unknown id in a build. */
	entry: Capability | undefined;
	/** The title of the capability that replaces it, when the entry names one the catalog knows. */
	replacement: string | undefined;
	version: string | undefined;
	upgradeCommand: string | undefined;
	openDocs: (() => void) | undefined;
}

/** `useCapability` with what the version gate needs to say why (CapabilityGate). */
export function useCapabilityNotice(id: string): CapabilityNotice {
	const status = useCapability(id);
	const { catalog, version, upgradeCommand, openDocs } =
		useContext(CatalogContext);
	const entry = catalog.get(id);
	const docs = entry?.docs;
	return {
		status,
		entry,
		replacement:
			entry?.replacedBy === undefined
				? undefined
				: (catalog.get(entry.replacedBy)?.title ?? entry.replacedBy),
		version,
		upgradeCommand:
			status === "needs-upgrade" && entry && upgradeCommand
				? upgradeCommand(entry.since)
				: undefined,
		openDocs: docs !== undefined && openDocs ? () => openDocs(docs) : undefined,
	};
}

/** Whether something that needs a capability can run, and if not, why (the version gate's reason, in one line). */
export type CapabilityGateResult =
	| { readonly available: true }
	| {
			readonly available: false;
			readonly status: "needs-upgrade" | "removed";
			/** "Needs OAK 0.12.0", "Removed in OAK 0.14.0". */
			readonly reason: string;
	  };

const AVAILABLE: CapabilityGateResult = Object.freeze({ available: true });

/**
 * The gate for capability `id` (none: available) in `scope` (default: the capability scope). With no project
 * version nothing is gated (see the header). An id the catalog lacks follows `capabilityStatus`'s rules: it throws
 * in development and tests, and is available in a production build.
 */
export function capabilityGate(
	id: string | undefined,
	scope: CatalogContextValue = useCapabilityScope.getState(),
): CapabilityGateResult {
	if (id === undefined) return AVAILABLE;
	const { catalog, version } = scope;
	if (version === undefined && catalog.has(id)) return AVAILABLE;
	const status = capabilityStatus(catalog, id, version, {
		strict: !import.meta.env.PROD,
		log: consoleLog,
	});
	if (status === "available") return AVAILABLE;
	const entry = catalog.get(id);
	const reason =
		status === "needs-upgrade"
			? entry?.since
				? capabilityStrings.needsUpgrade.replace("{since}", entry.since)
				: capabilityStrings.needsUpgradeUnknown
			: entry?.until
				? capabilityStrings.removed.replace("{until}", entry.until)
				: capabilityStrings.removedUnknown;
	return { available: false, status, reason };
}
