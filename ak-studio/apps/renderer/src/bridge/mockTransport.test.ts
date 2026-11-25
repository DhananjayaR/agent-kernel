import {
	contract,
	DEFAULT_SHELL_LAYOUT,
	defineStream,
	ERROR_CODES,
	StudioFailure,
} from "@ak-studio/contract";
import { describe, expect, it, vi } from "vitest";
import { createMockTransport, MOCK_VERSION } from "./mockTransport";

async function errorOf(promise: Promise<unknown>) {
	try {
		await promise;
	} catch (err) {
		expect(err).toBeInstanceOf(StudioFailure);
		return (err as StudioFailure).error;
	}
	throw new Error("expected a rejection");
}

describe("mockTransport", () => {
	it("answers app.info with fixture values and the browser platform", async () => {
		const transport = createMockTransport();
		await expect(transport.request("app.info", {})).resolves.toEqual({
			version: MOCK_VERSION,
			platform: "browser",
			theme: "system",
			layout: DEFAULT_SHELL_LAYOUT,
		});
	});

	it("keeps the layout set with app.setLayout, beside the theme", async () => {
		const transport = createMockTransport();
		const layout = { bottomPanel: { open: false, height: 300 } };
		await transport.request("app.setTheme", { theme: "light" });
		await expect(
			transport.request("app.setLayout", { layout }),
		).resolves.toEqual({ layout });
		await expect(transport.request("app.info", {})).resolves.toMatchObject({
			theme: "light",
			layout,
		});
		const error = await errorOf(
			transport.request("app.setLayout", {
				layout: { bottomPanel: { open: true, height: 1 } },
			}),
		);
		expect(error.code).toBe(ERROR_CODES.invalidInput);
	});

	it("keeps the theme set with app.setTheme", async () => {
		const transport = createMockTransport();
		await expect(
			transport.request("app.setTheme", { theme: "dark" }),
		).resolves.toEqual({ theme: "dark" });
		await expect(transport.request("app.info", {})).resolves.toMatchObject({
			theme: "dark",
		});
		// Each transport has its own state.
		await expect(
			createMockTransport().request("app.info", {}),
		).resolves.toMatchObject({ theme: "system" });
	});

	it("validates input like the main process", async () => {
		const transport = createMockTransport();
		const error = await errorOf(
			transport.request("app.setTheme", {
				theme: "blue",
			} as unknown as { theme: "dark" }),
		);
		expect(error.code).toBe(ERROR_CODES.invalidInput);
	});

	it("strips undeclared output fields and checks the output schema", async () => {
		const transport = createMockTransport({
			handlers: {
				"app.info": () =>
					({
						version: "9",
						platform: "browser",
						theme: "light",
						layout: DEFAULT_SHELL_LAYOUT,
						extra: true,
					}) as never,
			},
		});
		await expect(transport.request("app.info", {})).resolves.toEqual({
			version: "9",
			platform: "browser",
			theme: "light",
			layout: DEFAULT_SHELL_LAYOUT,
		});
		const broken = createMockTransport({
			handlers: { "app.info": () => ({ version: 9 }) as never },
		});
		expect((await errorOf(broken.request("app.info", {}))).code).toBe(
			ERROR_CODES.invalidOutput,
		);
	});

	it("turns a fixture's exception into a StudioFailure", async () => {
		const transport = createMockTransport({
			handlers: {
				"app.info": () => {
					throw new Error("fixture broke");
				},
			},
		});
		expect(await errorOf(transport.request("app.info", {}))).toMatchObject({
			code: ERROR_CODES.internal,
			detail: "fixture broke",
		});
	});

	it("refuses an unknown operation", async () => {
		const transport = createMockTransport();
		const error = await errorOf(transport.request("nope" as "app.info", {}));
		expect(error.code).toBe(ERROR_CODES.unknownOperation);
	});

	it("waits latencyMs before answering", async () => {
		vi.useFakeTimers();
		try {
			const transport = createMockTransport({ latencyMs: 300 });
			let done = false;
			const answer = transport.request("app.info", {}).then(() => {
				done = true;
			});
			await vi.advanceTimersByTimeAsync(299);
			expect(done).toBe(false);
			await vi.advanceTimersByTimeAsync(1);
			await answer;
			expect(done).toBe(true);
		} finally {
			vi.useRealTimers();
		}
	});

	it("reports a subscribe to an undeclared stream (P1a declares none)", () => {
		const onStreamError = vi.fn();
		const transport = createMockTransport({ onStreamError });
		const subscribe = transport.subscribe as (
			name: string,
			input: unknown,
			onEvent: (event: unknown) => void,
		) => () => void;
		const stop = subscribe("t.ticks", {}, () => {});
		expect(() => stop()).not.toThrow();
		expect(onStreamError.mock.calls[0]?.[1]).toMatchObject({
			code: ERROR_CODES.unknownOperation,
		});
	});

	it("parses stream events like main: strips, and ends on an invalid event", () => {
		// The renderer has no zod; the test stream's schemas come from contract schemas.
		const ticks = defineStream({
			name: "t.ticks",
			input: contract.operations["app.info"].input,
			event: contract.operations["app.setTheme"].output,
		});
		let emit: (event: unknown) => void = () => {};
		const stop = vi.fn();
		const onStreamError = vi.fn();
		const transport = createMockTransport({
			contract: {
				operations: contract.operations,
				streams: { "t.ticks": ticks },
			},
			streams: {
				"t.ticks": (_input: unknown, e: (event: unknown) => void) => {
					emit = e;
					return stop;
				},
			} as never,
			onStreamError,
		});
		const subscribe = transport.subscribe as (
			name: string,
			input: unknown,
			onEvent: (event: unknown) => void,
		) => () => void;
		const onEvent = vi.fn();
		expect(subscribe("t.ticks", { extra: 1 }, onEvent)).toBeTypeOf("function");
		expect(onStreamError.mock.calls[0]?.[1]).toMatchObject({
			code: ERROR_CODES.invalidInput,
		});

		const unsubscribe = subscribe("t.ticks", {}, onEvent);
		emit({ theme: "dark", secret: "x" });
		emit({ theme: "purple" });
		emit({ theme: "light" });
		unsubscribe();
		expect(onEvent).toHaveBeenCalledExactlyOnceWith({ theme: "dark" });
		expect(onStreamError.mock.calls[1]?.[1]).toMatchObject({
			code: ERROR_CODES.invalidOutput,
		});
		expect(stop).toHaveBeenCalledOnce();
	});
});
