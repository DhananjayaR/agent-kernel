// Vitest projects: `unit` (plain Node, *.test.ts) and one Storybook project per theme, which render every
// story in headless Chromium with the accessibility addon's axe check failing the run on a violation. Run
// from packages/ui: the Storybook plugin finds .storybook relative to the working directory.
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig, type TestProjectConfiguration } from "vitest/config";

const storybookProject = (
	theme: "dark" | "light",
): TestProjectConfiguration => ({
	extends: true,
	plugins: [
		storybookTest({ configDir: ".storybook", initialGlobals: { theme } }),
	],
	test: {
		name: `storybook-${theme}`,
		browser: {
			enabled: true,
			headless: true,
			provider: playwright({}),
			instances: [{ browser: "chromium" }],
		},
	},
});

export default defineConfig({
	test: {
		projects: [
			{
				test: {
					name: "unit",
					include: ["src/**/*.test.ts"],
					environment: "node",
					// Process theme.css so `theme.css?raw` (lib/utils.test.ts) yields the file, not an empty string.
					css: { include: [/theme\.css/] },
				},
			},
			storybookProject("dark"),
			storybookProject("light"),
		],
	},
});
