// The renderer's queries against the bridge. Everything goes through `getTransport()`, so the same code runs on
// IPC in the app and on the mock in a browser.
import type { OutputOf, ThemePreference } from "@ak-studio/contract";
import { QueryClient } from "@tanstack/react-query";
import { getTransport } from "./bridge/client";

export const appInfoQueryKey = ["app.info"] as const;

export const fetchAppInfo = () => getTransport().request("app.info", {});

export const storeTheme = (theme: ThemePreference) =>
	getTransport().request("app.setTheme", { theme });

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

export function createQueryClient(): QueryClient {
	// A failed bridge call is a StudioFailure the page shows; retrying would only delay that.
	return new QueryClient({
		defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
	});
}
