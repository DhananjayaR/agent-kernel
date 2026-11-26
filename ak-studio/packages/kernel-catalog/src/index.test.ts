// The P1b catalog: the shapes are in place and the catalog is empty (P2 fills it), so nothing is known and asking
// the status of an unknown capability is a bug, not an answer.
import { describe, expect, it } from "vitest";
import { type CapabilityCatalog, EMPTY_CATALOG } from "./index";

describe("EMPTY_CATALOG", () => {
	it("has no capability, and refuses to give a status for one it does not have", () => {
		const catalog: CapabilityCatalog = EMPTY_CATALOG;
		expect(catalog.has("framework.maf")).toBe(false);
		expect(catalog.has("")).toBe(false);
		expect(() => catalog.status("framework.maf", "0.10.2")).toThrow(
			/no entry for framework\.maf/,
		);
		expect(Object.isFrozen(catalog)).toBe(true);
	});
});
