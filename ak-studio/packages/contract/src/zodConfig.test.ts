// The probe must never run: count every `new Function` from before the contract (and zod) are loaded.
import { describe, expect, it, vi } from "vitest";

const probe = vi.hoisted(() => {
	const counter = { calls: 0 };
	const Original = globalThis.Function;
	globalThis.Function = new Proxy(Original, {
		construct(target, args, newTarget) {
			counter.calls++;
			return Reflect.construct(target, args, newTarget);
		},
		apply(target, thisArg, args) {
			counter.calls++;
			return Reflect.apply(target, thisArg, args);
		},
	});
	return { counter, restore: () => (globalThis.Function = Original) };
});

import { z } from "zod";
import { appInfo, appSetTheme, bridgeResultSchema } from "./index";

describe("zod configuration", () => {
	it("is jitless once the contract is imported", () => {
		expect(z.config().jitless).toBe(true);
	});

	it("never calls new Function: not on import, construction or parse", () => {
		expect(
			appInfo.output.parse({ version: "1", platform: "linux", theme: "dark" }),
		).toBeTruthy();
		appSetTheme.input.parse({ theme: "light" });
		bridgeResultSchema.parse({ ok: true, value: 1 });
		z.object({ a: z.string(), b: z.object({ c: z.number() }) }).parse({
			a: "x",
			b: { c: 1 },
		});
		expect(probe.counter.calls).toBe(0);
		probe.restore();
	});
});
