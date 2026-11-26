// Storybook for packages/ui and the renderer. Node-run, but it imports no Node built-in, so the
// renderer-ui-no-node-builtins boundary rule needs no exemption for it. It also indexes the renderer's stories
// (features/ and shared/; P1b-plan ruling 16), so they get the same axe check, icon check and both theme runs. The
// glob is a path string, not an import, so ui-no-apps-or-contract does not see it: the one exemption ruling 16 makes.
import type { StorybookConfig } from "@storybook/react-vite";
import tailwindcss from "@tailwindcss/vite";

const config: StorybookConfig = {
	stories: [
		"../src/**/*.stories.@(ts|tsx)",
		"../../../apps/renderer/src/**/*.stories.@(ts|tsx)",
	],
	addons: ["@storybook/addon-a11y", "@storybook/addon-vitest"],
	framework: "@storybook/react-vite",
	core: { disableTelemetry: true },
	viteFinal(viteConfig) {
		viteConfig.plugins = [...(viteConfig.plugins ?? []), tailwindcss()];
		return viteConfig;
	},
};

export default config;
