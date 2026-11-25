// The OAK mark in the top bar is the brand file itself, never a redraw: a byte-for-byte copy of
// branding/logo-mark/oak-mark-orange.svg (repository root). When the brand file changes, copy it again.
import { describe, expect, it } from "vitest";
import brand from "../../../../../branding/logo-mark/oak-mark-orange.svg?raw";
import copy from "./oak-mark-orange.svg?raw";

describe("the OAK mark asset", () => {
	it("is a byte-for-byte copy of the brand file", () => {
		expect(brand.length).toBeGreaterThan(0);
		expect(copy).toBe(brand);
	});
});
