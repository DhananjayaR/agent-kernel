// @ak-studio/kernel-catalog: the capability catalog, which answers one question for the whole app: does this
// project's OAK version support capability F? (P2-project-and-kernel-version.md, 2.5; architecture.md, OAK
// versions in the code). The shapes are fixed here in P1b; the catalog is empty until P2 adds the entries and
// the version comparison (pre-flight ruling 10). Pure data and types: it imports nothing.

/** One capability: what it is, the first OAK version that has it, and (once retired) the first that does not. */
export interface Capability {
	/** "deploy.azure.serverless", "config.schedule", "framework.maf". */
	id: string;
	title: string;
	/** The first version that has it. */
	since: string;
	/** The first version that no longer has it. */
	until?: string;
	/** The capability id to point the user to instead. */
	replacedBy?: string;
	/** A link to the versioned docs page. */
	docs?: string;
	/** One line shown in the UI for a breaking change. */
	note?: string;
}

/** What a project's version has of a capability: it has it, it is too old for it, or it is too new for it. */
export type CapabilityStatus = "available" | "needs-upgrade" | "removed";

/** The one API over the entries. */
export interface CapabilityCatalog {
	/** Whether the catalog has an entry for `id`. */
	has(id: string): boolean;
	/** The entry for `id` (its `since`, `until`, `replacedBy`: what a version gate says), if the catalog has one. */
	get(id: string): Capability | undefined;
	/** The capability's status for an OAK `version`. Only for an id `has` knows: anything else throws. */
	status(id: string, version: string): CapabilityStatus;
}

/** The catalog until P2: it has no capability, so asking the status of any throws. */
export const EMPTY_CATALOG: CapabilityCatalog = Object.freeze({
	has: () => false,
	get: () => undefined,
	status: (id: string): CapabilityStatus => {
		throw new Error(`the capability catalog has no entry for ${id}`);
	},
});
