// What the open project's OAK version can do (architecture.md, OAK versions in the code): `useCapability(id)`
// answers `available`, `needs-upgrade` or `removed` from the kernel capability catalog, for the version the
// CatalogProvider is given. No feature writes its own version check. In P1b the catalog is empty and nothing
// gives the provider a version; P2's KernelService feeds both (the provider takes them as props).
//
// An id the catalog does not have is a bug (a typo, or an entry not yet added): in development and tests it
// throws, so it is found at once; in a production build it answers "available", so a slip never hides a working
// control, and logs once per id.
import {
	type CapabilityCatalog,
	type CapabilityStatus,
	EMPTY_CATALOG,
} from "@ak-studio/kernel-catalog";
import { createContext, type ReactNode, useContext, useMemo } from "react";

interface CatalogContextValue {
	catalog: CapabilityCatalog;
	/** The project's OAK version; undefined with no project, when no capability can be asked about. */
	version: string | undefined;
}

const CatalogContext = createContext<CatalogContextValue>({
	catalog: EMPTY_CATALOG,
	version: undefined,
});

export interface CatalogProviderProps {
	catalog: CapabilityCatalog;
	/** The project's OAK version (P2: from KernelService). */
	version: string;
	children?: ReactNode;
}

/** Gives the views below it the catalog and the project's version. */
export function CatalogProvider({
	catalog,
	version,
	children,
}: CatalogProviderProps) {
	const value = useMemo(() => ({ catalog, version }), [catalog, version]);
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
