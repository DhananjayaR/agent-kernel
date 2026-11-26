// ServiceRegistry tests (moved from apps/desktop in P1b Task 4): start-up, requests and streams over a
// test-local contract, plus the P1b additions: capability refusal, masking of every error, and the log line for
// a code an operation does not list. The desktop's registerServices.test.ts checks the real contract is served.
import {
	command,
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
import { type CapabilityChecker, ServiceRegistry } from "./registry";
import { SecretMasker } from "./secrets";

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
	const registry = new ServiceRegistry({ contract: testContract, log });
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

	it("defaults to the app's contract", () => {
		const registry = new ServiceRegistry();
		expect(registry.missingHandlers()).toEqual(
			[...Object.keys(operations), ...Object.keys(contract.streams)].sort(),
		);
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
		const { registry, log } = testRegistry();
		registry
			.handle("t.echo", (input) => input)
			.handleStream("t.ticks", handler);
		registry.start();
		return Object.assign(registry, { log });
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

	it("parses each event: strips undeclared fields; an invalid event ends the stream, logged", () => {
		let emit: ((event: { n: number }) => void) | undefined;
		const stopHandler = vi.fn();
		const registry = started((_input, e) => {
			emit = e;
			return stopHandler;
		});
		const sent: StreamMessage[] = [];
		registry.subscribe("t.ticks", { count: 1 }, (m) => sent.push(m));
		emit?.({ n: 1, secret: "x" } as { n: number });
		emit?.({ n: "two" } as unknown as { n: number });
		emit?.({ n: 3 });
		expect(sent).toEqual([
			{ ok: true, event: { n: 1 } },
			{
				ok: false,
				error: expect.objectContaining({ code: ERROR_CODES.invalidOutput }),
			},
		]);
		expect(stopHandler).toHaveBeenCalledOnce();
		expect(registry.log).toHaveBeenCalledOnce();
	});
});

describe("ServiceRegistry validation that throws", () => {
	it("logs a throwing output transform as invalidOutput", async () => {
		const throwing = defineOperation({
			name: "t.throws",
			input: z.object({}),
			output: z.object({}).transform(() => {
				throw new Error("transform broke");
			}),
		});
		const log = vi.fn();
		const registry = new ServiceRegistry({
			contract: { operations: { "t.throws": throwing }, streams: {} },
			log,
		});
		registry.handle("t.throws", () => ({}));
		registry.start();
		await expect(registry.request("t.throws", {})).resolves.toMatchObject({
			ok: false,
			error: { code: ERROR_CODES.invalidOutput },
		});
		expect(log).toHaveBeenCalledOnce();
	});
});

// ---- P1b: capability refusal, masking, undeclared codes ----

const gated = command({
	name: "t.gated",
	input: z.strictObject({ projectId: z.string().optional() }),
	output: z.object({}),
	capability: "t.capability",
});
const declared = command({
	name: "t.declared",
	input: z.strictObject({ code: z.string(), detail: z.string().optional() }),
	output: z.object({}),
	errors: [ERROR_CODES.jobNotFound],
});
const lines = defineStream({
	name: "t.lines",
	input: z.strictObject({}),
	// A transform that throws repeats the bad value in the error's detail, as some zod messages do.
	event: z.object({
		text: z.string().transform((text) => {
			if (text.startsWith("bad")) throw new Error(`cannot send ${text}`);
			return text;
		}),
	}),
});
const p1bContract = {
	operations: { "t.gated": gated, "t.declared": declared },
	streams: { "t.lines": lines },
} as const;

const SECRET = "sk-live-0123456789";

function p1bRegistry(
	options: {
		capabilities?: CapabilityChecker;
		masker?: SecretMasker;
		lines?: Parameters<
			ServiceRegistry<
				typeof p1bContract.operations,
				typeof p1bContract.streams
			>["handleStream"]
		>[1];
	} = {},
) {
	const log = vi.fn();
	const gatedHandler = vi.fn(() => ({}));
	const registry = new ServiceRegistry({
		contract: p1bContract,
		log,
		capabilities: options.capabilities,
		masker: options.masker,
	});
	registry
		.handle("t.gated", gatedHandler)
		.handle("t.declared", (input) => {
			throw new StudioFailure({
				code: input.code,
				message: `It failed: ${input.detail ?? ""}`,
				...(input.detail === undefined ? {} : { detail: input.detail }),
			});
		})
		.handleStream("t.lines", options.lines ?? (() => () => {}));
	registry.start();
	return { registry, log, gatedHandler };
}

describe("ServiceRegistry capability refusal", () => {
	it("refuses an operation whose capability is not available, without calling the handler", async () => {
		for (const status of ["needs-upgrade", "removed"] as const) {
			const status_ = vi.fn<CapabilityChecker["status"]>(() => status);
			const { registry, gatedHandler, log } = p1bRegistry({
				capabilities: { status: status_ },
			});
			const result = await registry.request("t.gated", { projectId: "p1" });
			expect(result, status).toMatchObject({
				ok: false,
				error: {
					code: ERROR_CODES.capabilityUnavailable,
					detail: "t.capability",
				},
			});
			expect(status_).toHaveBeenCalledWith("t.capability", "p1");
			expect(gatedHandler).not.toHaveBeenCalled();
			expect(log).not.toHaveBeenCalled();
		}
	});

	it("says what to do: upgrade for needs-upgrade, a different message for removed", async () => {
		const messages: string[] = [];
		for (const status of ["needs-upgrade", "removed"] as const) {
			const { registry } = p1bRegistry({
				capabilities: { status: () => status },
			});
			const result = await registry.request("t.gated", {});
			if (!result.ok) messages.push(result.error.message);
		}
		expect(messages).toHaveLength(2);
		expect(messages[0]).not.toBe(messages[1]);
		expect(messages[0]).toMatch(/upgrade/i);
	});

	it("serves the operation when the capability is available, asking without a project when none is given", async () => {
		const status = vi.fn<CapabilityChecker["status"]>(() => "available");
		const { registry, gatedHandler } = p1bRegistry({
			capabilities: { status },
		});
		await expect(registry.request("t.gated", {})).resolves.toEqual({
			ok: true,
			value: {},
		});
		expect(status).toHaveBeenCalledWith("t.capability", undefined);
		expect(gatedHandler).toHaveBeenCalledOnce();
	});

	it("parses the input before checking: invalid input is invalidInput and asks nothing", async () => {
		const status = vi.fn<CapabilityChecker["status"]>(() => "removed");
		const { registry } = p1bRegistry({ capabilities: { status } });
		await expect(
			registry.request("t.gated", { projectId: 5 }),
		).resolves.toMatchObject({
			ok: false,
			error: { code: ERROR_CODES.invalidInput },
		});
		expect(status).not.toHaveBeenCalled();
	});

	it("never asks about an operation that names no capability", async () => {
		const status = vi.fn<CapabilityChecker["status"]>(() => "removed");
		const { registry } = p1bRegistry({ capabilities: { status } });
		await registry.request("t.declared", { code: ERROR_CODES.jobNotFound });
		expect(status).not.toHaveBeenCalled();
	});

	it("treats every capability as available when no checker is given", async () => {
		const { registry, gatedHandler } = p1bRegistry();
		await expect(registry.request("t.gated", {})).resolves.toMatchObject({
			ok: true,
		});
		expect(gatedHandler).toHaveBeenCalledOnce();
	});
});

describe("ServiceRegistry masking", () => {
	function masked() {
		const masker = new SecretMasker();
		masker.add(SECRET);
		return masker;
	}

	it("masks a StudioFailure's message and detail", async () => {
		const { registry } = p1bRegistry({ masker: masked() });
		const result = await registry.request("t.declared", {
			code: ERROR_CODES.jobNotFound,
			detail: `token=${SECRET} refused`,
		});
		expect(result).toEqual({
			ok: false,
			error: {
				code: ERROR_CODES.jobNotFound,
				message: "It failed: token=•••• refused",
				detail: "token=•••• refused",
			},
		});
	});

	it("masks an unexpected exception's detail, in the answer and in the log", async () => {
		const log = vi.fn();
		const registry = new ServiceRegistry({
			contract: testContract,
			log,
			masker: masked(),
		});
		registry
			.handle("t.echo", () => {
				throw new Error(`could not reach ${SECRET}`);
			})
			.handleStream("t.ticks", () => () => {});
		registry.start();
		const result = await registry.request("t.echo", { text: "a" });
		expect(result).toMatchObject({
			ok: false,
			error: { code: ERROR_CODES.internal, detail: "could not reach ••••" },
		});
		expect(log).toHaveBeenCalledOnce();
		expect(String(log.mock.calls[0]?.[0])).not.toContain(SECRET);
	});

	it("masks the unknown-operation answer, which repeats the caller's name", async () => {
		const { registry } = p1bRegistry({ masker: masked() });
		await expect(registry.request(`t.${SECRET}`, {})).resolves.toMatchObject({
			ok: false,
			error: { code: ERROR_CODES.unknownOperation, detail: "t.••••" },
		});
		expect(registry.subscribe(`t.${SECRET}`, {}, () => {})).toMatchObject({
			ok: false,
			error: { code: ERROR_CODES.unknownOperation, detail: "t.••••" },
		});
	});

	it("masks the error of a stream that fails to start", () => {
		const { registry } = p1bRegistry({
			masker: masked(),
			lines: () => {
				throw new Error(`bad ${SECRET}`);
			},
		});
		expect(registry.subscribe("t.lines", {}, () => {})).toMatchObject({
			ok: false,
			error: { code: ERROR_CODES.internal, detail: "bad ••••" },
		});
	});

	it("masks the error message that ends a running stream", () => {
		let emit: ((event: { text: string }) => void) | undefined;
		const { registry } = p1bRegistry({
			masker: masked(),
			lines: (_input, e) => {
				emit = e;
				return () => {};
			},
		});
		const sent: StreamMessage[] = [];
		registry.subscribe("t.lines", {}, (m) => sent.push(m));
		emit?.({ text: `bad ${SECRET}` });
		expect(sent).toEqual([
			{
				ok: false,
				error: expect.objectContaining({
					code: ERROR_CODES.invalidOutput,
					detail: expect.stringContaining("cannot send bad ••••"),
				}),
			},
		]);
		expect(JSON.stringify(sent)).not.toContain(SECRET);
	});
});

describe("ServiceRegistry undeclared error codes", () => {
	it("returns a code the operation does not list, and logs it as a bug", async () => {
		const { registry, log } = p1bRegistry();
		const result = await registry.request("t.declared", {
			code: ERROR_CODES.jobNotWaiting,
		});
		expect(result).toMatchObject({
			ok: false,
			error: { code: ERROR_CODES.jobNotWaiting },
		});
		expect(log).toHaveBeenCalledOnce();
		expect(log.mock.calls[0]?.[0]).toMatch(/t\.declared.*job\.notWaiting/);
	});

	it("does not log a listed code, the bridge's own codes or a capability refusal", async () => {
		const { registry, log } = p1bRegistry({
			capabilities: { status: () => "removed" },
		});
		await registry.request("t.declared", { code: ERROR_CODES.jobNotFound });
		await registry.request("t.declared", { code: ERROR_CODES.unavailable });
		await registry.request("t.declared", {});
		await registry.request("t.gated", {});
		expect(log).not.toHaveBeenCalled();
	});
});
