// The About feature's store: it holds UI state only, here the selection.
import { afterEach, describe, expect, it } from "vitest";
import { useAboutStore } from "./store";

afterEach(() => {
	useAboutStore.setState({ selectedId: undefined });
});

describe("useAboutStore", () => {
	it("selects an id and clears it", () => {
		useAboutStore.getState().select("first");
		expect(useAboutStore.getState().selectedId).toBe("first");
		useAboutStore.getState().select(undefined);
		expect(useAboutStore.getState().selectedId).toBeUndefined();
	});
});
