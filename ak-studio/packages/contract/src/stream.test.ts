import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { ERROR_CODES } from "./errors";
import { defineStream, startStream } from "./operations";
import type { StreamMessage } from "./transport";

const ticks = defineStream({
	name: "t.ticks",
	input: z.strictObject({ count: z.number() }),
	event: z.object({ n: z.number() }),
});

function start(
	handler: (input: unknown, emit: (event: unknown) => void) => () => void,
	input: unknown = { count: 1 },
) {
	const sent: StreamMessage[] = [];
	const result = startStream(ticks, handler, input, (m) => sent.push(m));
	return { sent, result };
}

describe("startStream", () => {
	it("parses each event against the event schema, stripping undeclared fields", () => {
		let emit: (event: unknown) => void = () => {};
		const { sent, result } = start((_input, e) => {
			emit = e;
			return () => {};
		});
		expect(result.ok).toBe(true);
		emit({ n: 1, secret: "do not send" });
		expect(sent).toEqual([{ ok: true, event: { n: 1 } }]);
	});

	it("drops an invalid event and ends the stream with invalidOutput", () => {
		let emit: (event: unknown) => void = () => {};
		const stop = vi.fn();
		const { sent } = start((_input, e) => {
			emit = e;
			return stop;
		});
		emit({ n: "one" });
		emit({ n: 2 });
		expect(sent).toHaveLength(1);
		expect(sent[0]).toMatchObject({
			ok: false,
			error: { code: ERROR_CODES.invalidOutput },
		});
		expect(stop).toHaveBeenCalledOnce();
	});

	it("ends the stream when an invalid event arrives while the handler starts", () => {
		const stop = vi.fn();
		const { sent, result } = start((_input, emit) => {
			emit({ n: null });
			return stop;
		});
		expect(result.ok).toBe(true);
		if (result.ok) result.value();
		expect(stop).toHaveBeenCalledOnce();
		expect(sent).toEqual([
			expect.objectContaining({
				ok: false,
				error: expect.objectContaining({ code: ERROR_CODES.invalidOutput }),
			}),
		]);
	});

	it("turns a throwing event refine into invalidOutput", () => {
		const strict = defineStream({
			name: "t.strict",
			input: z.object({}),
			event: z.number().refine(() => {
				throw new Error("refine broke");
			}),
		});
		const sent: StreamMessage[] = [];
		startStream(
			strict,
			(_input, emit) => {
				emit(1);
				return () => {};
			},
			{},
			(m) => sent.push(m),
		);
		expect(sent[0]).toMatchObject({
			ok: false,
			error: {
				code: ERROR_CODES.invalidOutput,
				detail: "validation threw: refine broke",
			},
		});
	});

	it("refuses invalid or unknown-keyed input and a throwing handler without sending", () => {
		const handler = vi.fn(() => () => {});
		expect(start(handler, { count: "1" }).result).toMatchObject({
			ok: false,
			error: { code: ERROR_CODES.invalidInput },
		});
		expect(start(handler, { count: 1, extra: 1 }).result.ok).toBe(false);
		expect(handler).not.toHaveBeenCalled();
		const { sent, result } = start(() => {
			throw new Error("no ticks");
		});
		expect(result).toMatchObject({
			ok: false,
			error: { code: ERROR_CODES.internal, detail: "no ticks" },
		});
		expect(sent).toEqual([]);
	});

	it("stops once, sends nothing after stop, and reports a throwing stop", () => {
		let emit: (event: unknown) => void = () => {};
		const onStopError = vi.fn();
		const sent: StreamMessage[] = [];
		const result = startStream(
			ticks,
			(_input, e) => {
				emit = e;
				return () => {
					throw new Error("stop broke");
				};
			},
			{ count: 1 },
			(m) => sent.push(m),
			onStopError,
		);
		if (result.ok) {
			result.value();
			result.value();
		}
		emit({ n: 1 });
		expect(sent).toEqual([]);
		expect(onStopError).toHaveBeenCalledOnce();
	});
});
