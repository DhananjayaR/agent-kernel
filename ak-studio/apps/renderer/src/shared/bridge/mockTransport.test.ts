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

	it("serves the window requests and window.state with a fake maximised flag", async () => {
		const transport = createMockTransport();
		const events: boolean[] = [];
		const stop = transport.subscribe("window.state", {}, (e) =>
			events.push(e.maximized),
		);
		await expect(transport.request("window.minimize", {})).resolves.toEqual({});
		await expect(
			transport.request("window.toggleMaximize", {}),
		).resolves.toEqual({ maximized: true });
		await expect(
			transport.request("window.toggleMaximize", {}),
		).resolves.toEqual({ maximized: false });
		await expect(transport.request("window.close", {})).resolves.toEqual({});
		expect(events).toEqual([false, true, false]);
		stop();
		await transport.request("window.toggleMaximize", {});
		expect(events).toEqual([false, true, false]);
		// A new subscriber starts from the current flag.
		const later: boolean[] = [];
		transport.subscribe("window.state", {}, (e) => later.push(e.maximized))();
		expect(later).toEqual([true]);
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

	// TEMPORARY (P1b Task 3): replaced in Task 7, when the mock runs the runtime's job, session and event services.
	it("answers bridge.unavailable for the job, session and event operations until their services exist", async () => {
		const transport = createMockTransport({ onStreamError: vi.fn() });
		for (const call of [
			transport.request("jobs.list", {}),
			transport.request("job.cancel", { jobId: "j1" }),
			transport.request("sessions.list", {}),
		]) {
			expect((await errorOf(call)).code).toBe(ERROR_CODES.unavailable);
		}
		const onStreamError = vi.fn();
		const failing = createMockTransport({ onStreamError });
		const onEvent = vi.fn();
		failing.subscribe("events", {}, onEvent)();
		failing.subscribe("stream.read", { streamId: "s1" }, onEvent)();
		expect(onEvent).not.toHaveBeenCalled();
		expect(
			onStreamError.mock.calls.map(([name, error]) => [name, error.code]),
		).toEqual([
			["events", ERROR_CODES.unavailable],
			["stream.read", ERROR_CODES.unavailable],
		]);
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
