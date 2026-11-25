// The renderer's queries against the bridge. Everything goes through `getTransport()`, so the same code runs on
// IPC in the app and on the mock in a browser.
import type { ThemePreference } from "@ak-studio/contract";
import { QueryClient } from "@tanstack/react-query";
import { getTransport } from "./bridge/client";

export const appInfoQueryKey = ["app.info"] as const;

export const fetchAppInfo = () => getTransport().request("app.info", {});

export const storeTheme = (theme: ThemePreference) =>
	getTransport().request("app.setTheme", { theme });

export function createQueryClient(): QueryClient {
	// A failed bridge call is a StudioFailure the page shows; retrying would only delay that.
	return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}
