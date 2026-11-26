// Root-level theme application (mounted by App, not by the shell, so it applies before the shell mounts). Shares
// the `app.info` query with the shell: the stored preference refines what main.tsx set from the system at boot, and
// while `app.info` is pending or has failed the system setting stays in force.
import { useEffect } from "react";
import { themeFromInfo, useAppInfo } from "../shared/queries";
import { applyTheme, browserThemeEnvironment } from "./theme";

export function useAppTheme(): void {
	const info = useAppInfo();
	const preference = themeFromInfo(info.data);
	useEffect(
		() => applyTheme(preference, browserThemeEnvironment()),
		[preference],
	);
}
