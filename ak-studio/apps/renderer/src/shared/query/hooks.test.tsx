// The query and mutation hooks over TanStack Query, against the mock transport with fake timers: the pending
// state turns on only after 300 ms of a call that is still running (conventions-and-skills.md, feedback timing),
// and off as soon as it settles; failures arrive as StudioFailures.
import { DEFAULT_SHELL_LAYOUT, ERROR_CODES } from "@ak-studio/contract";
import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isStudioFailure, StudioFailure, setTransport } from "../bridge/client";
import { createMockTransport, MOCK_VERSION } from "../bridge/mockTransport";
import { createQueryClient } from "./client";
import { useStudioMutation, useStudioQuery } from "./hooks";
import { keys } from "./keys";
import { PENDING_DELAY_MS } from "./pending";

const info = {
	version: MOCK_VERSION,
	platform: "browser" as const,
	theme: "system" as const,
	layout: DEFAULT_SHELL_LAYOUT,
};

/** Answers after `ms` of (fake) time. */
const answerAfter = <T,>(ms: number, value: T) =>
	new Promise<T>((resolve) => setTimeout(() => resolve(value), ms));

function wrapper() {
	const client = createQueryClient();
	return {
		client,
		wrapper: ({ children }: { children: ReactNode }) => (
			<QueryClientProvider client={client}>{children}</QueryClientProvider>
		),
	};
}

/**
 * Moves fake time on one millisecond at a time, each step inside act: React renders (and starts effect timers)
 * at the end of an act, so one long step would render everything late. Zero first runs what is due now. An answer
 * due at t reaches the hook at t + 1 (TanStack notifies on a zero timer after the transport's promise chain).
 */
async function advance(ms: number): Promise<void> {
	await act(async () => {
		await vi.advanceTimersByTimeAsync(0);
	});
	for (let step = 0; step < ms; step++) {
		await act(async () => {
			await vi.advanceTimersByTimeAsync(1);
		});
	}
}

beforeEach(() => {
	vi.useFakeTimers();
});
afterEach(() => {
	vi.useRealTimers();
	setTransport(undefined);
});

describe("useStudioQuery", () => {
	it("never shows pending for a call that answers within 200 ms", async () => {
		setTransport(
			createMockTransport({
				handlers: { "app.info": () => answerAfter(200, info) },
			}),
		);
		const { wrapper: Wrapper } = wrapper();
		const seen: boolean[] = [];
		const { result } = renderHook(
			() => {
				const query = useStudioQuery("app.info", {}, { key: keys("app").all });
				seen.push(query.showPending);
				return query;
			},
			{ wrapper: Wrapper },
		);
		expect(result.current.isPending).toBe(true);
		await advance(199);
		expect(result.current.showPending).toBe(false);
		await advance(2);
		expect(result.current.data).toEqual(info);
		await advance(PENDING_DELAY_MS);
		expect(seen).not.toContain(true);
	});

	it("shows pending at 300 ms of a call still running, and stops as soon as it settles", async () => {
		setTransport(
			createMockTransport({
				handlers: { "app.info": () => answerAfter(1000, info) },
			}),
		);
		const { wrapper: Wrapper } = wrapper();
		const { result } = renderHook(
			() => useStudioQuery("app.info", {}, { key: keys("app").all }),
			{ wrapper: Wrapper },
		);
		await advance(PENDING_DELAY_MS - 1);
		expect(result.current.showPending).toBe(false);
		await advance(1);
		expect(result.current.showPending).toBe(true);
		await advance(1000 - PENDING_DELAY_MS);
		expect(result.current.showPending).toBe(true);
		expect(result.current.data).toBeUndefined();
		// The render that brings the answer also ends the pending state.
		await advance(1);
		expect(result.current.data).toEqual(info);
		expect(result.current.showPending).toBe(false);
	});

	it("adds showPending and still re-renders only for the fields a view reads", async () => {
		setTransport(createMockTransport());
		const { client, wrapper: Wrapper } = wrapper();
		let renders = 0;
		const { result } = renderHook(
			() => {
				renders += 1;
				const query = useStudioQuery("app.info", {}, { key: keys("app").all });
				// Reads data (and showPending reads isFetching); dataUpdatedAt is not read.
				return { data: query.data, query };
			},
			{ wrapper: Wrapper },
		);
		await advance(1);
		expect(result.current.data).toEqual(info);
		expect("showPending" in result.current.query).toBe(true);
		const rendersAfterData = renders;
		// Equal data again: structural sharing keeps `data`, only dataUpdatedAt changes.
		act(() => {
			client.setQueryData(keys("app").all, { ...info });
		});
		await advance(1);
		expect(renders).toBe(rendersAfterData);
	});

	it("reads under the key it is given, and waits while not enabled", async () => {
		const handler = vi.fn(() => info);
		setTransport(createMockTransport({ handlers: { "app.info": handler } }));
		const { client, wrapper: Wrapper } = wrapper();
		const { result, rerender } = renderHook(
			({ enabled }) =>
				useStudioQuery("app.info", {}, { key: keys("app").all, enabled }),
			{ wrapper: Wrapper, initialProps: { enabled: false } },
		);
		await advance(PENDING_DELAY_MS * 2);
		expect(handler).not.toHaveBeenCalled();
		// Not fetching, so no pending state, although there is no data yet.
		expect(result.current.showPending).toBe(false);
		rerender({ enabled: true });
		await advance(0);
		expect(handler).toHaveBeenCalledOnce();
		expect(client.getQueryData(["app"])).toEqual(info);
	});

	it("fails with the StudioFailure the transport rejected with", async () => {
		setTransport(
			createMockTransport({
				handlers: {
					"app.info": () => {
						throw new StudioFailure({
							code: ERROR_CODES.unavailable,
							message: "The app's bridge did not answer.",
						});
					},
				},
				log: vi.fn(),
			}),
		);
		const { wrapper: Wrapper } = wrapper();
		const { result } = renderHook(
			() => useStudioQuery("app.info", {}, { key: keys("app").all }),
			{ wrapper: Wrapper },
		);
		await advance(0);
		expect(isStudioFailure(result.current.error)).toBe(true);
		expect(result.current.error?.error.code).toBe(ERROR_CODES.unavailable);
	});
});

describe("useStudioMutation", () => {
	it("shows pending only after 300 ms, and calls onSuccess with the output and the input", async () => {
		setTransport(
			createMockTransport({
				handlers: {
					"app.setTheme": (input) => answerAfter(500, { theme: input.theme }),
				},
			}),
		);
		const onSuccess = vi.fn();
		const { wrapper: Wrapper } = wrapper();
		const { result } = renderHook(
			() => useStudioMutation("app.setTheme", { onSuccess }),
			{ wrapper: Wrapper },
		);
		act(() => result.current.mutate({ theme: "dark" }));
		await advance(0);
		await advance(200);
		expect(result.current.isPending).toBe(true);
		expect(result.current.showPending).toBe(false);
		await advance(PENDING_DELAY_MS - 200);
		expect(result.current.showPending).toBe(true);
		await advance(200);
		expect(result.current.showPending).toBe(true);
		await advance(1);
		expect(result.current.isSuccess).toBe(true);
		expect(result.current.showPending).toBe(false);
		expect(onSuccess).toHaveBeenCalledExactlyOnceWith(
			{ theme: "dark" },
			{ theme: "dark" },
		);
	});

	it("never shows pending for a 200 ms write, and reports a failure through onError", async () => {
		setTransport(
			createMockTransport({
				handlers: {
					"app.setLayout": () =>
						answerAfter(200, null).then(() => {
							throw new StudioFailure({
								code: ERROR_CODES.preferencesNotSaved,
								message: "The panel layout could not be saved.",
							});
						}),
				},
			}),
		);
		const onError = vi.fn();
		const seen: boolean[] = [];
		const { wrapper: Wrapper } = wrapper();
		const { result } = renderHook(
			() => {
				const mutation = useStudioMutation("app.setLayout", { onError });
				seen.push(mutation.showPending);
				return mutation;
			},
			{ wrapper: Wrapper },
		);
		act(() => result.current.mutate({ layout: DEFAULT_SHELL_LAYOUT }));
		await advance(PENDING_DELAY_MS * 2);
		expect(result.current.isError).toBe(true);
		expect(result.current.error?.error.code).toBe(
			ERROR_CODES.preferencesNotSaved,
		);
		expect(onError).toHaveBeenCalledOnce();
		expect(seen).not.toContain(true);
	});
});
