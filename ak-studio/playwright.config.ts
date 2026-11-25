// End-to-end tests (`pnpm test:e2e`, which builds first and runs Electron under `xvfb-run -a` on Linux without a
// display). Two projects:
// - browser: the renderer alone on the mock transport, served by its Vite dev server, in Playwright's Chromium.
// - electron: the built app (apps/desktop/out/), unpackaged, through Playwright's Electron support.
import { defineConfig, devices } from "@playwright/test";

/** The renderer's dev server for the browser project; a fixed port, refused if already taken. */
const RENDERER_PORT = 5199;
const rendererUrl = `http://127.0.0.1:${RENDERER_PORT}`;

export default defineConfig({
	testDir: "./tests/e2e",
	outputDir: "./test-results",
	forbidOnly: Boolean(process.env.CI),
	retries: 0,
	reporter: "list",
	timeout: 60_000,
	projects: [
		{
			name: "browser",
			testMatch: "browser.spec.ts",
			use: { ...devices["Desktop Chrome"], baseURL: rendererUrl },
		},
		{
			name: "electron",
			testMatch: "electron.spec.ts",
		},
	],
	webServer: {
		command: `pnpm --filter @ak-studio/renderer dev --port ${RENDERER_PORT} --strictPort`,
		url: rendererUrl,
		reuseExistingServer: false,
		timeout: 120_000,
	},
});
