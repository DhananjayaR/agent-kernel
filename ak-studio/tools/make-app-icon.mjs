// `pnpm make-app-icon`: renders the app icon, apps/desktop/build/icon.png (1024 x 1024), from the OAK mark.
//
// The mark is branding/logo-mark/oak-mark-orange.svg at the repository root, used as it is (never redrawn or
// recoloured): the orange mark on Prussian Blue, the background branding/README.md gives for the `orange`
// colourway. Rendered by Playwright's Chromium (already a workspace dependency; `pnpm exec playwright install
// chromium` once). electron-builder takes build/icon.png as the icon for every platform: it makes the Linux
// icon sizes, and the macOS .icns and Windows .ico, from it. The main process uses the same file as the window
// icon on Linux (shipped next to the app in resources/, see electron-builder.yml).
//
// Run it again when the mark changes, and commit the PNG and icon.source.sha256: the hash of the mark (line endings
// as LF) the PNG was rendered from, which apps/desktop/src/main/app-icon.test.ts compares with the brand file.
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const SIZE = 1024;
/** The mark's share of the icon's width: an even margin round it on the square. */
const MARK_SHARE = 0.625;
/** Prussian Blue (branding/README.md, "Colours"), the background for the orange mark. */
const BACKGROUND = "#02284F";

const markFile = fileURLToPath(
	new URL("../../branding/logo-mark/oak-mark-orange.svg", import.meta.url),
);
const outFile = fileURLToPath(
	new URL("../apps/desktop/build/icon.png", import.meta.url),
);

const hashFile = fileURLToPath(
	new URL("../apps/desktop/build/icon.source.sha256", import.meta.url),
);

const svg = readFileSync(markFile, "utf8");
const mark = Math.round(SIZE * MARK_SHARE);
const html = `<!doctype html>
<html><head><style>
html, body { margin: 0; width: ${SIZE}px; height: ${SIZE}px; background: ${BACKGROUND}; }
body { display: flex; align-items: center; justify-content: center; }
img { width: ${mark}px; height: ${mark}px; display: block; }
</style></head>
<body><img alt="" src="data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}"></body></html>`;

const browser = await chromium.launch();
try {
	const page = await browser.newPage({
		viewport: { width: SIZE, height: SIZE },
		deviceScaleFactor: 1,
	});
	await page.setContent(html);
	await page.locator("img").evaluate((img) => img.decode());
	await page.screenshot({ path: outFile, type: "png" });
} finally {
	await browser.close();
}
writeFileSync(
	hashFile,
	`${createHash("sha256").update(svg.replaceAll("\r\n", "\n")).digest("hex")}\n`,
);
console.log(`make-app-icon: wrote ${outFile} (${SIZE} x ${SIZE})`);
