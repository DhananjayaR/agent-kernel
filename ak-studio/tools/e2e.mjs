// Runs the Playwright end-to-end tests (playwright.config.ts). Electron needs an X server on Linux, so with no
// DISPLAY the run goes under `xvfb-run -a`. Extra arguments go to `playwright test` (e.g. `--project browser`).
// `pnpm test:e2e` builds the app first; this script only runs the tests.
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { join } from "node:path";

const cli = createRequire(import.meta.url).resolve("@playwright/test/cli");
const playwright = [process.execPath, cli, "test", ...process.argv.slice(2)];
const needsXvfb = process.platform === "linux" && !process.env.DISPLAY;
const [command, ...args] = needsXvfb
	? ["xvfb-run", "-a", ...playwright]
	: playwright;

if (needsXvfb) console.log("e2e: no DISPLAY, running under xvfb-run -a");
const result = spawnSync(command, args, {
	cwd: join(import.meta.dirname, ".."),
	stdio: "inherit",
});
if (result.error) {
	console.error(`e2e: could not start ${command}: ${result.error.message}`);
	process.exit(1);
}
process.exit(result.status ?? 1);
