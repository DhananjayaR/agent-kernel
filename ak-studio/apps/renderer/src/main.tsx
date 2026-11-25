import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { applyTheme, browserThemeEnvironment } from "./theme";
import "./styles.css";

// Before the first paint: main sets the native theme from the stored preference, so prefers-color-scheme
// already reflects it. `app.info` refines this (see useAppTheme) once it answers.
applyTheme("system", browserThemeEnvironment());

const root = document.getElementById("root");
if (!root) throw new Error("#root is missing from index.html");
createRoot(root).render(
	<StrictMode>
		<App />
	</StrictMode>,
);
