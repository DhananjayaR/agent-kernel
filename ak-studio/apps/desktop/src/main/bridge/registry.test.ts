import {
	appInfo,
	appSetTheme,
	contract,
	defineOperation,
	defineStream,
	ERROR_CODES,
	operations,
	type StreamMessage,
	StudioFailure,
} from "@ak-studio/contract";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { AppService } from "../services/AppService";
import { ServiceRegistry } from "./registry";

// A test-local contract: the real one declares no stream.
const echo = defineOperation({
	name: "t.echo",
	input: z.object({ text: z.string() }),
	output: z.object({ text: z.string() }),
});
const ticks = defineStream({
	name: "t.ticks",
	input: z.object({ count: z.number().int().min(0) }),
	event: z.object({ n: z.number() }),
});
const testContract = {
	operations: { "t.echo": echo },
	streams: { "t.ticks": ticks },
} as const;

function testRegistry(log = vi.fn()) {
	const registry = new ServiceRegistry(testContract, log);
	return { registry, log };
}

describe("ServiceRegistry start-up", () => {
	it("fails start-up when a declared operation has no handler", () => {
		const { registry } = testRegistry();
		registry.handleStream("t.ticks", () => () => {});
		expect(registry.missingHandlers()).toEqual(["t.echo"]);
		expect(() => registry.start()).toThrow(
			/no handler registered for: t\.echo/,
		);
		expect(registry.started).toBe(false);
	});

	it("fails start-up when a declared stream has no handler", () => {
		const { registry } = testRegistry();
		registry.handle("t.echo", (input) => input);
		expect(() => registry.start()).toThrow(/t\.ticks/);
	});

	it("starts when every operation and stream has a handler", () => {
		const { registry } = testRegistry();
		registry
			.handle("t.echo", (input) => input)
			.handleStream("t.ticks", () => () => {});
		expect(registry.missingHandlers()).toEqual([]);
		registry.start();
		expect(registry.started).toBe(true);
	});

	it("refuses a handler for an undeclared name, a second handler, and late registration", () => {
		const { registry } = testRegistry();
		expect(() =>
			registry.handle("t.nope" as "t.echo", (input) => input),
		).toThrow(/not declared/);
		expect(() =>
			registry.handle("t.ticks" as "t.echo", (input) => input),
		).toThrow(/not declared/);
		registry.handle("t.echo", (input) => input);
		expect(() => registry.handle("t.echo", (input) => input)).toThrow(
			/already has a handler/,
		);
		registry.handleStream("t.ticks", () => () => {});
		registry.start();
		expect(() => registry.handle("t.echo", (input) => input)).toThrow(
			/has started/,
		);
	});

	it("serves the real contract completely once AppService is registered", () => {
		const registry = new ServiceRegistry();
		expect(registry.missingHandlers()).toEqual(Object.keys(operations).sort());
		registry.register(
			new AppService({
				version: "1.0.0",
				platform: "linux",
				preferencesFile: "/nonexistent/preferences.json",
			}),
		);
		expect(registry.missingHandlers()).toEqual([]);
		expect(() => registry.start()).not.toThrow();
		expect(Object.keys(contract.operations)).toContain(appInfo.name);
		expect(Object.keys(contract.operations)).toContain(appSetTheme.name);
	});
});

describe("ServiceRegistry.request", () => {
	function started() {
		const { registry, log } = testRegistry();
		const handler = vi.fn((input: { text: string }) => ({
			text: input.text,
			extra: "undeclared",
		}));
		registry.handle("t.echo", handler).handleStream("t.ticks", () => () => {});
		registry.start();
		return { registry, handler, log };
	}

	it("answers unavailable before start", async () => {
		const { registry } = testRegistry();
		const result = await registry.request("t.echo", { text: "a" });
		expect(result).toMatchObject({
			ok: false,
			error: { code: ERROR_CODES.unavailable },
		});
	});

	it("answers the parsed output, without undeclared fields", async () => {
		const { registry, handler } = started();
		await expect(registry.request("t.echo", { text: "hi" })).resolves.toEqual({
			ok: true,
			value: { text: "hi" },
		});
		expect(handler).toHaveBeenCalledWith({ text: "hi" });
	});

	it("parses input in the main process: invalid input never reaches the handler", async () => {
		const { registry, handler } = started();
		for (const bad of [{}, { text: 1 }, null, undefined, "hi"]) {
			const result = await registry.request("t.echo", bad);
			expect(result).toMatchObject({
				ok: false,
				error: { code: ERROR_CODES.invalidInput },
			});
		}
		expect(handler).not.toHaveBeenCalled();
	});

	it("answers unknownOperation for unknown, inherited and non-string names, and for streams", async () => {
		const { registry } = started();
		for (const name of [
			"t.nope",
			"__proto__",
			"toString",
			5,
			null,
			"t.ticks",
		]) {
			const result = await registry.request(name, {});
			expect(result).toMatchObject({
				ok: false,
				error: { code: ERROR_CODES.unknownOperation },
			});
		}
	});

	it("turns an exception into a StudioError value and logs it", async () => {
		const { registry, log } = testRegistry();
		registry
			.handle("t.echo", () => {
				throw new Error("kaput");
			})
			.handleStream("t.ticks", () => () => {});
		registry.start();
		await expect(registry.request("t.echo", { text: "a" })).resolves.toEqual({
			ok: false,
			error: {
				code: ERROR_CODES.internal,
				message: "Something went wrong in the app.",
				detail: "kaput",
			},
		});
		expect(log).toHaveBeenCalledOnce();
	});

	it("passes a StudioFailure's error through without logging", async () => {
		const { registry, log } = testRegistry();
		const error = { code: "t.failed", message: "It failed." };
		registry
			.handle("t.echo", async () => {
				throw new StudioFailure(error);
			})
			.handleStream("t.ticks", () => () => {});
		registry.start();
		await expect(registry.request("t.echo", { text: "a" })).resolves.toEqual({
			ok: false,
			error,
		});
		expect(log).not.toHaveBeenCalled();
	});

	it("reports an output that breaks the schema as invalidOutput", async () => {
		const { registry, log } = testRegistry();
		registry
			.handle("t.echo", () => ({ text: 7 }) as unknown as { text: string })
			.handleStream("t.ticks", () => () => {});
		registry.start();
		const result = await registry.request("t.echo", { text: "a" });
		expect(result).toMatchObject({
			ok: false,
			error: { code: ERROR_CODES.invalidOutput },
		});
		expect(log).toHaveBeenCalledOnce();
	});
});

describe("ServiceRegistry.subscribe", () => {
	function started(
		handler: Parameters<
			ServiceRegistry<
				typeof testContract.operations,
				typeof testContract.streams
			>["handleStream"]
		>[1],
	) {
		const { registry } = testRegistry();
		registry
			.handle("t.echo", (input) => input)
			.handleStream("t.ticks", handler);
		registry.start();
		return registry;
	}

	it("delivers events until stopped, then stops the handler once", () => {
		let emit: ((event: { n: number }) => void) | undefined;
		const stopHandler = vi.fn();
		const registry = started((input, e) => {
			expect(input).toEqual({ count: 2 });
			emit = e;
			return stopHandler;
		});
		const sent: StreamMessage[] = [];
		const result = registry.subscribe("t.ticks", { count: 2 }, (m) =>
			sent.push(m),
		);
		expect(result.ok).toBe(true);
		emit?.({ n: 1 });
		if (result.ok) {
			result.value();
			result.value();
		}
		emit?.({ n: 2 });
		expect(sent).toEqual([{ ok: true, event: { n: 1 } }]);
		expect(stopHandler).toHaveBeenCalledOnce();
	});

	it("refuses invalid input and unknown streams without starting anything", () => {
		const handler = vi.fn(() => () => {});
		const registry = started(handler);
		expect(
			registry.subscribe("t.ticks", { count: -1 }, () => {}),
		).toMatchObject({ ok: false, error: { code: ERROR_CODES.invalidInput } });
		expect(registry.subscribe("t.echo", { text: "a" }, () => {})).toMatchObject(
			{ ok: false, error: { code: ERROR_CODES.unknownOperation } },
		);
		expect(registry.subscribe("constructor", {}, () => {})).toMatchObject({
			ok: false,
			error: { code: ERROR_CODES.unknownOperation },
		});
		expect(handler).not.toHaveBeenCalled();
	});

	it("turns a handler that throws on start into a StudioError", () => {
		const registry = started(() => {
			throw new Error("no ticks today");
		});
		expect(registry.subscribe("t.ticks", { count: 1 }, () => {})).toMatchObject(
			{
				ok: false,
				error: { code: ERROR_CODES.internal, detail: "no ticks today" },
			},
		);
	});
});
