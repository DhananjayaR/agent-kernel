import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ERROR_CODES, StudioFailure, studioError } from "./errors";
import {
	appInfo,
	appSetLayout,
	appSetTheme,
	appSetUnsaved,
	BOTTOM_PANEL_HEIGHT,
	contract,
	DEFAULT_SHELL_LAYOUT,
	lookup,
	operations,
	parseSafely,
	platformSchema,
	runOperation,
	shellLayoutSchema,
	streams,
	themePreferenceSchema,
	toStudioError,
	windowClose,
	windowMinimize,
	windowState,
	windowToggleMaximize,
} from "./operations";
import { defineOperation } from "./shapes";
import {
	bridgeResultSchema,
	streamMessageSchema,
	unknownOperationError,
} from "./transport";

const layout = { bottomPanel: { open: false, height: 320 } };
const info = {
	version: "1.2.3",
	platform: "linux",
	theme: "dark",
	layout,
} as const;

describe("the operations map", () => {
	it("keys every operation by its own name", () => {
		for (const [key, op] of Object.entries(operations)) {
			expect(op.name).toBe(key);
			expect(op.kind).toBe("request");
		}
		expect(Object.keys(operations).sort()).toEqual([
			"app.info",
			"app.setLayout",
			"app.setTheme",
			"app.setUnsaved",
			"job.cancel",
			"job.respond",
			"jobs.dismissInterrupted",
			"jobs.interrupted",
			"jobs.list",
			"session.start",
			"session.stop",
			"sessions.list",
			"window.close",
			"window.minimize",
			"window.toggleMaximize",
		]);
		expect(Object.keys(streams).sort()).toEqual([
			"events",
			"stream.read",
			"window.state",
		]);
		for (const [key, stream] of Object.entries(streams)) {
			expect(stream.name).toBe(key);
			expect(stream.kind).toBe("stream");
		}
		expect(contract.operations).toBe(operations);
	});

	it("declares the window operations with strict inputs and plain outputs", () => {
		for (const op of [windowMinimize, windowToggleMaximize, windowClose]) {
			expect(op.input.safeParse({}).success).toBe(true);
			expect(op.input.safeParse({ extra: 1 }).success).toBe(false);
		}
		expect(windowMinimize.output.parse({ extra: 1 })).toEqual({});
		expect(windowClose.output.parse({ extra: 1 })).toEqual({});
		expect(
			windowToggleMaximize.output.parse({ maximized: true, extra: 1 }),
		).toEqual({ maximized: true });
		expect(windowToggleMaximize.output.safeParse({}).success).toBe(false);
		expect(
			windowToggleMaximize.output.safeParse({ maximized: 1 }).success,
		).toBe(false);
	});

	it("declares the window.state stream", () => {
		expect(windowState.input.safeParse({}).success).toBe(true);
		expect(windowState.input.safeParse({ extra: 1 }).success).toBe(false);
		expect(windowState.event.parse({ maximized: false, extra: 1 })).toEqual({
			maximized: false,
		});
		expect(windowState.event.safeParse({}).success).toBe(false);
		expect(windowState.event.safeParse({ maximized: "yes" }).success).toBe(
			false,
		);
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

	it("declares app.setUnsaved over labels only, strict, answering nothing", () => {
		expect(appSetUnsaved.shape).toBe("command");
		expect(
			appSetUnsaved.input.parse({ items: ["Config: session section"] }),
		).toEqual({ items: ["Config: session section"] });
		expect(appSetUnsaved.input.parse({ items: [] })).toEqual({ items: [] });
		for (const bad of [
			{},
			{ items: "Config" },
			{ items: [""] },
			{ items: [1] },
			{ items: [], extra: true },
		]) {
			expect(
				appSetUnsaved.input.safeParse(bad).success,
				JSON.stringify(bad),
			).toBe(false);
		}
		expect(appSetUnsaved.output.parse({ stray: 1 })).toEqual({});
	});

	it("declares app.setLayout with a strict layout and bounded height", () => {
		expect(appSetLayout.input.parse({ layout })).toEqual({ layout });
		expect(appSetLayout.output.parse({ layout })).toEqual({ layout });
		const bad = [
			{},
			{ layout: {} },
			{ layout: { bottomPanel: { open: true } } },
			{ layout: { bottomPanel: { open: "yes", height: 200 } } },
			{ layout: { bottomPanel: { open: true, height: 200.5 } } },
			{
				layout: {
					bottomPanel: { open: true, height: BOTTOM_PANEL_HEIGHT.min - 1 },
				},
			},
			{
				layout: {
					bottomPanel: { open: true, height: BOTTOM_PANEL_HEIGHT.max + 1 },
				},
			},
			// Strict inputs: unknown keys at every level are refused.
			{ layout, extra: 1 },
			{ layout: { ...layout, sidebar: {} } },
			{ layout: { bottomPanel: { ...layout.bottomPanel, width: 1 } } },
		];
		for (const input of bad)
			expect(appSetLayout.input.safeParse(input).success).toBe(false);
	});

	it("strips undeclared layout fields from outputs instead of refusing them", () => {
		const parsed = appInfo.output.parse({
			...info,
			layout: { bottomPanel: { ...layout.bottomPanel, extra: 1 }, more: 2 },
		});
		expect(parsed.layout).toEqual(layout);
	});

	it("has a default layout inside the bounds", () => {
		expect(shellLayoutSchema.parse(DEFAULT_SHELL_LAYOUT)).toEqual(
			DEFAULT_SHELL_LAYOUT,
		);
		expect(DEFAULT_SHELL_LAYOUT.bottomPanel.height).toBe(
			BOTTOM_PANEL_HEIGHT.default,
		);
		expect(Object.isFrozen(DEFAULT_SHELL_LAYOUT.bottomPanel)).toBe(true);
	});

	it("uses one schema each for platform and theme", () => {
		const shape = appInfo.output.shape;
		expect(shape.platform).toBe(platformSchema);
		expect(shape.theme).toBe(themePreferenceSchema);
		expect(appSetTheme.input.shape.theme).toBe(themePreferenceSchema);
		expect(platformSchema.options).toEqual([
			"linux",
			"darwin",
			"win32",
			"browser",
		]);
		expect(themePreferenceSchema.options).toEqual(["system", "dark", "light"]);
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

describe("parseSafely", () => {
	it("answers the parsed value, or zod's summary, and never throws, even when a refine, transform or getter throws", () => {
		expect(parseSafely(z.object({ a: z.number() }), { a: 1, b: 2 })).toEqual({
			success: true,
			data: { a: 1 },
		});
		expect(parseSafely(z.number(), "x")).toMatchObject({ success: false });
		const throwing = [
			z.number().refine(() => {
				throw new Error("refine boom");
			}),
			z.number().transform(() => {
				throw new Error("transform boom");
			}),
		];
		for (const schema of throwing) {
			expect(parseSafely(schema, 1)).toEqual({
				success: false,
				detail: expect.stringMatching(/^validation threw: .* boom$/),
			});
		}
		const getter = {
			get a(): number {
				throw new Error("getter boom");
			},
		};
		expect(parseSafely(z.object({ a: z.number() }), getter)).toEqual({
			success: false,
			detail: "validation threw: getter boom",
		});
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

	it("rejects undeclared input fields (strict inputs, D12)", async () => {
		let called = false;
		const handler = () => {
			called = true;
			return info;
		};
		const result = await runOperation(appInfo, handler, { extra: 1 });
		expect(result).toMatchObject({
			ok: false,
			error: { code: ERROR_CODES.invalidInput },
		});
		const theme = await runOperation(appSetTheme, () => ({ theme: "dark" }), {
			theme: "dark",
			extra: 1,
		});
		expect(theme.ok).toBe(false);
		expect(called).toBe(false);
	});

	it("turns a throwing input refine into invalidInput, as a value", async () => {
		const op = defineOperation({
			name: "t.refine",
			input: z.object({}).refine(() => {
				throw new Error("refine broke");
			}),
			output: z.object({}),
		});
		const result = await runOperation(op, () => ({}), {});
		expect(result).toMatchObject({
			ok: false,
			error: {
				code: ERROR_CODES.invalidInput,
				detail: "validation threw: refine broke",
			},
		});
	});

	it("turns a throwing output transform into invalidOutput, as a value", async () => {
		const op = defineOperation({
			name: "t.transform",
			input: z.object({}),
			output: z.object({ a: z.string() }).transform(() => {
				throw new Error("transform broke");
			}),
		});
		const result = await runOperation(op, () => ({ a: "x" }), {});
		expect(result).toMatchObject({
			ok: false,
			error: {
				code: ERROR_CODES.invalidOutput,
				detail: "validation threw: transform broke",
			},
		});
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
