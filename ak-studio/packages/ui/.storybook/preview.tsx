import type { Preview } from "@storybook/react-vite";
import "./preview.css";

type Theme = "dark" | "light";

const preview: Preview = {
	parameters: {
		layout: "fullscreen",
		// Every story is checked by axe in the Vitest run (`pnpm test:storybook`); a violation fails it.
		a11y: { test: "error" },
	},
	globalTypes: {
		theme: {
			description: "Theme (data-theme)",
			toolbar: { title: "Theme", items: ["dark", "light"], dynamicTitle: true },
		},
	},
	// A viewing default for Storybook only; the app defaults to `system`, dark when unknown (apps/renderer/src/theme.ts).
	initialGlobals: { theme: "dark" },
	decorators: [
		(Story, context) => {
			const theme: Theme = context.globals.theme === "light" ? "light" : "dark";
			return (
				<div
					data-theme={theme}
					className="min-h-screen bg-surface p-6 text-text"
				>
					<Story />
				</div>
			);
		},
	],
};

export default preview;
