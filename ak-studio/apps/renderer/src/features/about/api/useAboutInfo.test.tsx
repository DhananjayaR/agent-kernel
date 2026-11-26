// useAboutInfo's test: the hook calls `about.info` through the mock transport, which serves it as the app does (the
// feature's service behind a real registry, or its fixture for a desktop-only service).
import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { setTransport } from "../../../shared/bridge/client";
import {
	createMockBackend,
	MOCK_VERSION,
} from "../../../shared/bridge/mockTransport";
import { createQueryClient } from "../../../shared/query/client";
import { useAboutInfo } from "./useAboutInfo";

afterEach(() => {
	setTransport(undefined);
});

function withQueries() {
	const client = createQueryClient();
	return ({ children }: { children: ReactNode }) => (
		<QueryClientProvider client={client}>{children}</QueryClientProvider>
	);
}

describe("useAboutInfo", () => {
	it("reads about.info: the app's version, and the browser as its platform under the mock", async () => {
		const backend = createMockBackend();
		setTransport(backend.transport);
		const { result } = renderHook(() => useAboutInfo(), {
			wrapper: withQueries(),
		});
		await waitFor(() => expect(result.current.isSuccess).toBe(true));
		expect(result.current.data).toEqual({
			version: MOCK_VERSION,
			platform: "browser",
		});
	});
});
