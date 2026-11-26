// Visual regression (`pnpm test:visual`, conventions-and-skills.md "Development techniques"): a screenshot of every
// story in the built Storybook (packages/ui/storybook-static, which indexes the renderer's stories too), dark and
// light, compared with the baselines committed under tests/visual/__screenshots__/linux/. Linux only: fonts render
// differently on each operating system, so baselines from one would fail on another. A separate config from
// playwright.config.ts so the end-to-end run neither needs a Storybook build nor starts its server.
//
// Update the baselines after an intended change: `pnpm test:visual --update-snapshots`, on Linux.
import { defineConfig } from "@playwright/test";

if (process.platform !== "linux") {
	throw new Error(
		"pnpm test:visual runs on Linux only: its baselines are Linux screenshots (fonts render differently elsewhere)",
	);
}

/** The built Storybook's static server; a fixed port, refused if already taken. */
const STORYBOOK_PORT = 6107;

export default defineConfig({
	testDir: "./tests/visual",
	outputDir: "./test-results/visual",
	snapshotPathTemplate: "{testDir}/__screenshots__/{platform}/{arg}{ext}",
	forbidOnly: Boolean(process.env.CI),
	retries: 0,
	fullyParallel: true,
	reporter: "list",
	timeout: 60_000,
	expect: {
		toHaveScreenshot: {
			// Finite animations jump to their end and infinite ones (spinner, skeleton) to their start; the text
			// caret is hidden.
			animations: "disabled",
			caret: "hide",
			scale: "css",
		},
	},
	use: {
		baseURL: `http://127.0.0.1:${STORYBOOK_PORT}`,
		browserName: "chromium",
		viewport: { width: 1280, height: 800 },
		deviceScaleFactor: 1,
		colorScheme: "dark",
		locale: "en-GB",
		timezoneId: "UTC",
		launchOptions: {
			// Fewer machine-dependent pixels: no font hinting, one colour profile.
			args: ["--font-render-hinting=none", "--force-color-profile=srgb"],
		},
	},
	webServer: {
		command: `pnpm --filter @ak-studio/ui exec vite preview --outDir storybook-static --port ${STORYBOOK_PORT} --strictPort --host 127.0.0.1`,
		url: `http://127.0.0.1:${STORYBOOK_PORT}/index.json`,
		reuseExistingServer: false,
		timeout: 60_000,
	},
});
