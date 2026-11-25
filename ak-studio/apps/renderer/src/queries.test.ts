import { QueryClient } from "@tanstack/react-query";
import { afterEach, describe, expect, it } from "vitest";
import {
	BRIDGE_MISSING_ERROR,
	createUnavailableTransport,
	isStudioFailure,
	setTransport,
} from "./bridge/client";
import { createMockTransport } from "./bridge/mockTransport";
import {
	appInfoQueryKey,
	cacheStoredTheme,
	createQueryClient,
	fetchAppInfo,
	storeTheme,
	themeFromInfo,
} from "./queries";

afterEach(() => setTransport(undefined));

describe("app.info", () => {
	it("answers from the mock transport", async () => {
		setTransport(createMockTransport());
		expect(await fetchAppInfo()).toMatchObject({ theme: "system" });
	});

	it("fails with a StudioFailure on the unavailable transport, and the system theme stays in force", async () => {
		setTransport(
			createUnavailableTransport(BRIDGE_MISSING_ERROR),
			"unavailable",
		);
		const client = createQueryClient();
		const result = await client
			.fetchQuery({ queryKey: appInfoQueryKey, queryFn: fetchAppInfo })
			.catch((error: unknown) => error);
		expect(isStudioFailure(result)).toBe(true);
		expect(client.getQueryData(appInfoQueryKey)).toBeUndefined();
		expect(themeFromInfo(client.getQueryData(appInfoQueryKey))).toBe("system");
	});
});

describe("themeFromInfo", () => {
	it("uses the stored preference once known", () => {
		expect(
			themeFromInfo({ version: "1", platform: "linux", theme: "dark" }),
		).toBe("dark");
	});
});

describe("app.setTheme", () => {
	it("stores through the transport and updates the app.info cache", async () => {
		setTransport(createMockTransport());
		const client = new QueryClient();
		client.setQueryData(appInfoQueryKey, await fetchAppInfo());
		const stored = await storeTheme("dark");
		cacheStoredTheme(client, stored);
		expect(client.getQueryData(appInfoQueryKey)).toMatchObject({
			theme: "dark",
		});
		expect((await fetchAppInfo()).theme).toBe("dark");
	});

	it("leaves an empty cache empty", () => {
		const client = new QueryClient();
		cacheStoredTheme(client, { theme: "light" });
		expect(client.getQueryData(appInfoQueryKey)).toBeUndefined();
	});
});

describe("createQueryClient", () => {
	it("does not retry or refetch on focus", () => {
		const defaults = createQueryClient().getDefaultOptions().queries;
		expect(defaults).toMatchObject({
			retry: false,
			refetchOnWindowFocus: false,
		});
	});
});
