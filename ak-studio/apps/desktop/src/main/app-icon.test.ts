// build/icon.png is a committed render of the OAK mark (tools/make-app-icon.mjs). It records the hash of the
// mark it was rendered from (build/icon.source.sha256); this fails when the brand file changed and the icon was
// not rendered again (`pnpm make-app-icon`, then commit both files).
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const buildDir = join(import.meta.dirname, "../../build");
const brandMark = join(
	import.meta.dirname,
	"../../../../../branding/logo-mark/oak-mark-orange.svg",
);

describe("the app icon", () => {
	it("was rendered from the current brand mark", () => {
		const svg = readFileSync(brandMark, "utf8").replaceAll("\r\n", "\n");
		const hash = createHash("sha256").update(svg).digest("hex");
		const recorded = readFileSync(
			join(buildDir, "icon.source.sha256"),
			"utf8",
		).trim();
		expect(
			recorded,
			"branding/logo-mark/oak-mark-orange.svg changed: run `pnpm make-app-icon` and commit build/icon.png and build/icon.source.sha256",
		).toBe(hash);
		expect(readFileSync(join(buildDir, "icon.png")).length).toBeGreaterThan(0);
	});
});
