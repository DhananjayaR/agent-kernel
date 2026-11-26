// The version gate's copy for one command (P1b design gate, command palette: a version-gated command is listed with
// its reason where its shortcut would be). One strings module, reviewed and later translated together. `{since}`
// and `{until}` are OAK versions from the capability catalog.
export const capabilityStrings = {
	/** A command the project's OAK version is too old for. */
	needsUpgrade: "Needs OAK {since}",
	/** The same, when the catalog's entry names no version (it always should). */
	needsUpgradeUnknown: "Needs a newer OAK",
	/** A command the project's OAK version no longer has. */
	removed: "Removed in OAK {until}",
	removedUnknown: "Not in this OAK version",
} as const;
