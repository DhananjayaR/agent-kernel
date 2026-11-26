// The query-key factory (architecture rule 4): every key is `[domain, projectId, ...detail]`, so a domain event
// can invalidate a whole domain or one project's part of it by prefix.
import { describe, expect, it } from "vitest";
import { keys } from "./keys";

describe("keys", () => {
	it("builds the domain, project and detail keys as prefixes of each other", () => {
		const config = keys("config");
		expect(config.all).toEqual(["config"]);
		expect(config.project("p1")).toEqual(["config", "p1"]);
		expect(config.detail("p1", "section", "session")).toEqual([
			"config",
			"p1",
			"section",
			"session",
		]);
		expect(config.detail("p1")).toEqual(["config", "p1"]);
	});

	it("answers a new array each time, so a caller cannot change another's key", () => {
		const config = keys("config");
		expect(config.project("p1")).not.toBe(config.project("p1"));
		expect(Object.isFrozen(config.all)).toBe(true);
	});
});
