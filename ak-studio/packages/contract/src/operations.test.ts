import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ERROR_CODES, StudioFailure, studioError } from "./errors";
import {
	appInfo,
	appSetTheme,
	contract,
	defineOperation,
	lookup,
	operations,
	runOperation,
	streams,
	toStudioError,
} from "./operations";
import {
	bridgeResultSchema,
	streamMessageSchema,
	unknownOperationError,
} from "./transport";

const info = { version: "1.2.3", platform: "linux", theme: "dark" } as const;

describe("the operations map", () => {
	it("keys every operation by its own name", () => {
		for (const [key, op] of Object.entries(operations)) {
			expect(op.name).toBe(key);
			expect(op.kind).toBe("request");
		}
		expect(Object.keys(operations).sort()).toEqual([
			"app.info",
			"app.setTheme",
		]);
		expect(Object.keys(streams)).toEqual([]);
		expect(contract.operations).toBe(operations);
	});

	it("declares app.info with the P1a schemas", () => {
		expect(appInfo.input.safeParse({}).success).toBe(true);
		expect(appInfo.output.parse(info)).toEqual(info);
		expect(
			appInfo.output.safeParse({ ...info, platform: "browser" }).success,
		).toBe(true);
		expect(
			appInfo.output.safeParse({ ...info, platform: "freebsd" }).success,
		).toBe(false);
		expect(appInfo.output.safeParse({ ...info, theme: "blue" }).success).toBe(
			false,
		);
	});

	it("declares app.setTheme over the theme enum", () => {
		expect(appSetTheme.input.parse({ theme: "light" })).toEqual({
			theme: "light",
		});
		expect(appSetTheme.input.safeParse({ theme: "Light" }).success).toBe(false);
		expect(appSetTheme.input.safeParse({}).success).toBe(false);
	});

	it("freezes defined operations", () => {
		const op = defineOperation({
			name: "x.y",
			input: z.object({}),
			output: z.object({}),
		});
		expect(Object.isFrozen(op)).toBe(true);
	});

	it("looks names up as own keys only", () => {
		expect(lookup(operations, "app.info")).toBe(appInfo);
		expect(lookup(operations, "__proto__")).toBeUndefined();
		expect(lookup(operations, "toString")).toBeUndefined();
		expect(lookup(operations, 42)).toBeUndefined();
	});
});

describe("runOperation", () => {
	it("passes parsed input to the handler and answers with the output", async () => {
		const seen: unknown[] = [];
		const result = await runOperation(
			appSetTheme,
			(input) => {
				seen.push(input);
				return { theme: "dark" };
			},
			{ theme: "dark" },
		);
		expect(result).toEqual({ ok: true, value: { theme: "dark" } });
		expect(seen).toEqual([{ theme: "dark" }]);
	});

	it("rejects invalid input without calling the handler", async () => {
		let called = false;
		const handler = () => {
			called = true;
			return { theme: "dark" };
		};
		for (const bad of [{ theme: 1 }, { theme: "DARK" }, null, "dark", []]) {
			const result = await runOperation(appSetTheme, handler, bad);
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.code).toBe(ERROR_CODES.invalidInput);
				expect(result.error.message).toContain("app.setTheme");
				expect(result.error.detail).toBeTruthy();
			}
		}
		expect(called).toBe(false);
	});

	it("does not coerce: a number-like string is not a number", async () => {
		const op = defineOperation({
			name: "t.n",
			input: z.object({ ttl: z.number().int() }),
			output: z.object({}),
		});
		const result = await runOperation(op, () => ({}), { ttl: "30" });
		expect(result.ok).toBe(false);
	});

	it("strips undeclared input fields before the handler sees them", async () => {
		let seen: unknown;
		await runOperation(
			appInfo,
			(input) => {
				seen = input;
				return info;
			},
			{ extra: "x" },
		);
		expect(seen).toEqual({});
	});

	it("strips undeclared output fields", async () => {
		const result = await runOperation(
			appInfo,
			() => ({ ...info, secret: "do not send" }),
			{},
		);
		expect(result).toEqual({ ok: true, value: info });
	});

	it("turns an output that breaks the schema into bridge.invalidOutput", async () => {
		const result = await runOperation(
			appInfo,
			() => ({ ...info, theme: 3 }),
			{},
		);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error.code).toBe(ERROR_CODES.invalidOutput);
	});

	it("turns a thrown Error into internal.unexpected, as a value", async () => {
		const result = await runOperation(
			appInfo,
			() => {
				throw new Error("disk on fire");
			},
			{},
		);
		expect(result).toEqual({
			ok: false,
			error: {
				code: ERROR_CODES.internal,
				message: "Something went wrong in the app.",
				detail: "disk on fire",
			},
		});
	});

	it("keeps a StudioFailure's own error, sync or async", async () => {
		const error = studioError("app.thing", "The thing failed.");
		const sync = await runOperation(
			appInfo,
			() => {
				throw new StudioFailure(error);
			},
			{},
		);
		const async = await runOperation(
			appInfo,
			() => Promise.reject(new StudioFailure(error)),
			{},
		);
		expect(sync).toEqual({ ok: false, error });
		expect(async).toEqual({ ok: false, error });
	});

	it("converts a thrown non-Error", () => {
		expect(toStudioError("boom")).toMatchObject({
			code: ERROR_CODES.internal,
			detail: "boom",
		});
	});
});

describe("wire schemas", () => {
	it("accepts result envelopes and refuses anything else", () => {
		expect(bridgeResultSchema.safeParse({ ok: true, value: 1 }).success).toBe(
			true,
		);
		expect(
			bridgeResultSchema.safeParse({
				ok: false,
				error: { code: "a", message: "b" },
			}).success,
		).toBe(true);
		for (const bad of [
			undefined,
			{ ok: false },
			{ ok: false, error: "boom" },
			{ ok: "yes" },
		]) {
			expect(bridgeResultSchema.safeParse(bad).success).toBe(false);
		}
	});

	it("accepts stream messages", () => {
		expect(streamMessageSchema.safeParse({ ok: true, event: 1 }).success).toBe(
			true,
		);
		expect(
			streamMessageSchema.safeParse({ ok: true, event: undefined }).success,
		).toBe(true);
		expect(streamMessageSchema.safeParse({ ok: false }).success).toBe(false);
	});

	it("describes an unknown operation", () => {
		expect(unknownOperationError("nope")).toMatchObject({
			code: ERROR_CODES.unknownOperation,
			detail: "nope",
		});
		expect(unknownOperationError(7).detail).toBe("(number)");
	});
});
