import {
	DEFAULT_SHELL_LAYOUT,
	ERROR_CODES,
	type StudioBridge,
	type StudioError,
	StudioFailure,
} from "@ak-studio/contract";
import { describe, expect, it, vi } from "vitest";
import { createIpcTransport } from "./ipcTransport";

function fakeStudio(reply: () => Promise<unknown>) {
	const listeners = new Map<string, (message: unknown) => void>();
	const unsubscribed: string[] = [];
	let next = 0;
	const studio = {
		request: vi.fn((_op: string, _input: unknown) => reply()),
		subscribe: vi.fn(
			(_op: string, _input: unknown, onEvent: (m: unknown) => void) => {
				const id = `s${next++}`;
				listeners.set(id, onEvent);
				return () => {
					listeners.delete(id);
					unsubscribed.push(id);
				};
			},
		),
	} satisfies StudioBridge;
	return { studio, listeners, unsubscribed };
}

async function failureOf(promise: Promise<unknown>): Promise<StudioError> {
	const err = await promise.then(
		() => {
			throw new Error("expected a rejection");
		},
		(e: unknown) => e,
	);
	expect(err).toBeInstanceOf(StudioFailure);
	return (err as StudioFailure).error;
}

const info = {
	version: "1.0.0",
	platform: "linux",
	theme: "system",
	layout: DEFAULT_SHELL_LAYOUT,
} as const;

describe("ipcTransport.request", () => {
	it("sends the operation and input over window.studio and resolves with the value", async () => {
		const { studio } = fakeStudio(async () => ({ ok: true, value: info }));
		const transport = createIpcTransport(studio);
		await expect(transport.request("app.info", {})).resolves.toEqual(info);
		expect(studio.request).toHaveBeenCalledWith("app.info", {});
	});

	it("rejects with a StudioFailure carrying the StudioError value", async () => {
		const error = {
			code: ERROR_CODES.invalidInput,
			message: "The input for app.setTheme is not valid.",
			detail: "theme",
		};
		const { studio } = fakeStudio(async () => ({ ok: false, error }));
		const transport = createIpcTransport(studio);
		expect(
			await failureOf(transport.request("app.setTheme", { theme: "dark" })),
		).toEqual(error);
	});

	it("turns a reply that is not an envelope into bridge.unavailable", async () => {
		for (const reply of [undefined, "boom", { ok: false }, { value: 1 }]) {
			const { studio } = fakeStudio(async () => reply);
			const error = await failureOf(
				createIpcTransport(studio).request("app.info", {}),
			);
			expect(error.code).toBe(ERROR_CODES.unavailable);
		}
	});

	it("turns an IPC failure into bridge.unavailable", async () => {
		const { studio } = fakeStudio(() =>
			Promise.reject(new Error("An object could not be cloned.")),
		);
		const error = await failureOf(
			createIpcTransport(studio).request("app.info", {}),
		);
		expect(error).toMatchObject({
			code: ERROR_CODES.unavailable,
			detail: "An object could not be cloned.",
		});
	});
});

// P1a declares no stream, so stream names are cast; the transport itself is name-agnostic.
type AnySubscribe = (
	name: string,
	input: unknown,
	onEvent: (event: unknown) => void,
	onError?: (error: unknown) => void,
) => () => void;

describe("ipcTransport.subscribe", () => {
	it("delivers ok events and unsubscribes once", () => {
		const { studio, listeners, unsubscribed } = fakeStudio(async () => null);
		const transport = createIpcTransport(studio);
		const onEvent = vi.fn();
		const stop = (transport.subscribe as AnySubscribe)("t.ticks", {}, onEvent);
		expect(studio.subscribe).toHaveBeenCalledWith(
			"t.ticks",
			{},
			expect.any(Function),
		);
		listeners.get("s0")?.({ ok: true, event: 1 });
		stop();
		stop();
		expect(onEvent).toHaveBeenCalledExactlyOnceWith(1);
		expect(unsubscribed).toEqual(["s0"]);
	});

	it("ends the stream on an error message and reports it", () => {
		const { studio, listeners, unsubscribed } = fakeStudio(async () => null);
		const onStreamError = vi.fn();
		const transport = createIpcTransport(studio, onStreamError);
		const onEvent = vi.fn();
		const onError = vi.fn();
		const stop = (transport.subscribe as AnySubscribe)(
			"t.ticks",
			{},
			onEvent,
			onError,
		);
		const error = { code: ERROR_CODES.unknownOperation, message: "No." };
		listeners.get("s0")?.({ ok: false, error });
		listeners.get("s0")?.({ ok: true, event: 1 });
		stop();
		expect(onEvent).not.toHaveBeenCalled();
		expect(onStreamError).toHaveBeenCalledExactlyOnceWith("t.ticks", error);
		// The subscriber hears of the end too, once, so it can subscribe again.
		expect(onError).toHaveBeenCalledExactlyOnceWith(error);
		expect(unsubscribed).toEqual(["s0"]);
	});

	it("reports a message that is not a stream message, and keeps the stream", () => {
		const { studio, listeners } = fakeStudio(async () => null);
		const onStreamError = vi.fn();
		const onEvent = vi.fn();
		const onError = vi.fn();
		const transport = createIpcTransport(studio, onStreamError);
		(transport.subscribe as AnySubscribe)("t.ticks", {}, onEvent, onError);
		listeners.get("s0")?.("garbage");
		listeners.get("s0")?.({ ok: true, event: 2 });
		expect(onStreamError).toHaveBeenCalledOnce();
		// Not an end: the subscriber is not told to subscribe again.
		expect(onError).not.toHaveBeenCalled();
		expect(onEvent).toHaveBeenCalledExactlyOnceWith(2);
	});

	it("reports a subscribe that IPC refuses, and returns a no-op", () => {
		const studio: StudioBridge = {
			request: async () => null,
			subscribe: () => {
				throw new Error("An object could not be cloned.");
			},
		};
		const onStreamError = vi.fn();
		const onError = vi.fn();
		const transport = createIpcTransport(studio, onStreamError);
		const stop = (transport.subscribe as AnySubscribe)(
			"t.ticks",
			{},
			() => {},
			onError,
		);
		expect(() => stop()).not.toThrow();
		expect(onStreamError.mock.calls[0]?.[1]).toMatchObject({
			code: ERROR_CODES.unavailable,
		});
		expect(onError.mock.calls[0]?.[0]).toMatchObject({
			code: ERROR_CODES.unavailable,
		});
	});

	it("unsubscribes when the error arrives during subscribe", () => {
		const unsubscribe = vi.fn();
		const studio: StudioBridge = {
			request: async () => null,
			subscribe: (_op, _input, onEvent) => {
				onEvent({ ok: false, error: { code: "x.y", message: "No." } });
				return unsubscribe;
			},
		};
		const transport = createIpcTransport(studio, () => {});
		(transport.subscribe as AnySubscribe)("t.ticks", {}, () => {});
		expect(unsubscribe).toHaveBeenCalledOnce();
	});
});
