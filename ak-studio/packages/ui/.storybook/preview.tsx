import type { Preview } from "@storybook/react-vite";
import { type ReactNode, useLayoutEffect } from "react";
import "./preview.css";

type Theme = "dark" | "light";

/**
 * Sets data-theme on <html> as well, as the app does: popovers, listboxes and tooltips render in a portal on
 * <body>, outside the story's wrapper, and would otherwise always resolve the default (dark) theme.
 */
function DocumentTheme({
	theme,
	children,
}: {
	theme: Theme;
	children: ReactNode;
}) {
	useLayoutEffect(() => {
		document.documentElement.dataset.theme = theme;
	}, [theme]);
	return children;
}

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
			// `fullBleed` (the shell stories): the story fills the viewport edge to edge, as the app does, so a
			// story at 1100 px measures 1100 px.
			const fullBleed = context.parameters.fullBleed === true;
			return (
				<DocumentTheme theme={theme}>
					<div
						data-theme={theme}
						className={
							fullBleed
								? "bg-surface text-text"
								: "min-h-screen bg-surface p-6 text-text"
						}
					>
						<Story />
					</div>
				</DocumentTheme>
			);
		},
	],
};

export default preview;
