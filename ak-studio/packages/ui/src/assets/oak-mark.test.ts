// The OAK mark in the top bar is the brand file itself, never a redraw: a byte-for-byte copy of
// branding/logo-mark/oak-mark-orange.svg (repository root). When the brand file changes, copy it again. Line
// endings are normalised first: ak-studio/.gitattributes checks the copy out with LF everywhere, but the brand
// file is outside it and may check out with CRLF on Windows (core.autocrlf); the blobs in git are identical.
import { describe, expect, it } from "vitest";
import brand from "../../../../../branding/logo-mark/oak-mark-orange.svg?raw";
import copy from "./oak-mark-orange.svg?raw";

describe("the OAK mark asset", () => {
	it("is a byte-for-byte copy of the brand file", () => {
		const lf = (text: string) => text.replaceAll("\r\n", "\n");
		expect(brand.length).toBeGreaterThan(0);
		expect(lf(copy)).toBe(lf(brand));
	});
});
