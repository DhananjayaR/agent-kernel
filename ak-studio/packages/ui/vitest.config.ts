// Two Vitest projects: `unit` (plain Node, *.test.ts) and `storybook` (every story rendered in headless
// Chromium, with the accessibility addon's axe check failing the run on a violation). Run from packages/ui:
// the Storybook plugin finds .storybook relative to the working directory.
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		projects: [
			{
				test: {
					name: "unit",
					include: ["src/**/*.test.ts"],
					environment: "node",
				},
			},
			{
				extends: true,
				plugins: [storybookTest({ configDir: ".storybook" })],
				test: {
					name: "storybook",
					browser: {
						enabled: true,
						headless: true,
						provider: playwright({}),
						instances: [{ browser: "chromium" }],
					},
				},
			},
		],
	},
});
