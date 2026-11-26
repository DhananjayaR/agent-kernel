// The fixture reader: the project's identity comes from the fixture's own files, at or above the P2 floor.
import { expect, test } from "vitest";
import { FIXTURE_FILES, FIXTURE_PROJECT } from "./fixtures";

test("the fixture reads from the support-triage project", () => {
	expect(FIXTURE_PROJECT.name).toBe("support-triage");
	expect(FIXTURE_PROJECT.tools).toEqual([
		"lookup_order",
		"refund_payment",
		"search_docs",
		"create_ticket",
	]);
	expect(FIXTURE_FILES["config.yaml"]).toContain("rest_sync");
});

test("its OAK version is at least 0.10", () => {
	const [major = 0, minor = 0] = FIXTURE_PROJECT.oakVersion
		.split(".")
		.map(Number);
	expect(major > 0 || minor >= 10).toBe(true);
});
