// Root-level theme application (mounted by App, not by any page, so replacing the page keeps it). Shares the
// `app.info` query with the page: the stored preference refines what main.tsx set from the system at boot, and
// while `app.info` is pending or has failed the system setting stays in force.
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { appInfoQueryKey, fetchAppInfo, themeFromInfo } from "./queries";
import { applyTheme, browserThemeEnvironment } from "./theme";

export function useAppTheme(): void {
	const info = useQuery({ queryKey: appInfoQueryKey, queryFn: fetchAppInfo });
	const preference = themeFromInfo(info.data);
	useEffect(
		() => applyTheme(preference, browserThemeEnvironment()),
		[preference],
	);
}
