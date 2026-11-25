// Storybook for packages/ui. Node-run, but it imports no Node built-in, so the renderer-ui-no-node-builtins
// boundary rule needs no exemption for it.
import type { StorybookConfig } from "@storybook/react-vite";
import tailwindcss from "@tailwindcss/vite";

const config: StorybookConfig = {
	stories: ["../src/**/*.stories.@(ts|tsx)"],
	addons: ["@storybook/addon-a11y", "@storybook/addon-vitest"],
	framework: "@storybook/react-vite",
	core: { disableTelemetry: true },
	viteFinal(viteConfig) {
		viteConfig.plugins = [...(viteConfig.plugins ?? []), tailwindcss()];
		return viteConfig;
	},
};

export default config;
