// The app-level data the shell and the root read and write: `app.info` (version, platform and the stored
// preferences) under its key from the key factory, through the shared hooks, and the cache updates after a
// preference is stored. The same code runs on IPC in the app and on the mock in a browser.
import type { OutputOf, ThemePreference } from "@ak-studio/contract";
import type { QueryClient } from "@tanstack/react-query";
import { type StudioQueryResult, useStudioQuery } from "./query/hooks";
import { keys } from "./query/keys";

/** The `app` domain: app-level data that belongs to no project. */
export const appKeys = keys("app");

/** `app.info`'s key: the `app` domain itself, so a `domain.changed` for `app` refreshes it. */
export const appInfoQueryKey = appKeys.all;

/** The app's version, platform and stored preferences. */
export function useAppInfo(): StudioQueryResult<"app.info"> {
	return useStudioQuery("app.info", {}, { key: appInfoQueryKey });
}

/** The preference to apply for the current `app.info` result: the system's until (or unless) it arrives. */
export function themeFromInfo(
	info: OutputOf<"app.info"> | undefined,
): ThemePreference {
	return info?.theme ?? "system";
}

/** After `app.setTheme` succeeds: put the stored value in the `app.info` cache without a refetch. */
export function cacheStoredTheme(
	queryClient: QueryClient,
	stored: OutputOf<"app.setTheme">,
): void {
	queryClient.setQueryData<OutputOf<"app.info">>(appInfoQueryKey, (old) =>
		old ? { ...old, theme: stored.theme } : old,
	);
}

/** After `app.setLayout` succeeds: put the stored layout in the `app.info` cache without a refetch. */
export function cacheStoredLayout(
	queryClient: QueryClient,
	stored: OutputOf<"app.setLayout">,
): void {
	queryClient.setQueryData<OutputOf<"app.info">>(appInfoQueryKey, (old) =>
		old ? { ...old, layout: stored.layout } : old,
	);
}
