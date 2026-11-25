import { describe, expect, it } from "vitest";
import {
	applyTheme,
	DARK_QUERY,
	type MediaQueryLike,
	resolveTheme,
	type ThemeEnvironment,
} from "./theme";

function fakeEnvironment(dark: boolean) {
	const listeners = new Set<() => void>();
	const media: MediaQueryLike & { matches: boolean } = {
		matches: dark,
		addEventListener: (_type, listener) => listeners.add(listener),
		removeEventListener: (_type, listener) => listeners.delete(listener),
	};
	const queries: string[] = [];
	const env: ThemeEnvironment = {
		root: { dataset: {} },
		matchMedia: (query) => {
			queries.push(query);
			return media;
		},
	};
	return {
		env,
		queries,
		listeners,
		setSystemDark(value: boolean) {
			media.matches = value;
			for (const listener of [...listeners]) listener();
		},
	};
}

describe("resolveTheme", () => {
	it("follows the system for 'system'", () => {
		expect(resolveTheme("system", true)).toBe("dark");
		expect(resolveTheme("system", false)).toBe("light");
	});

	it("ignores the system for explicit values", () => {
		expect(resolveTheme("dark", false)).toBe("dark");
		expect(resolveTheme("light", true)).toBe("light");
	});
});

describe("applyTheme", () => {
	it("sets data-theme from prefers-color-scheme for 'system'", () => {
		const dark = fakeEnvironment(true);
		applyTheme("system", dark.env);
		expect(dark.env.root.dataset.theme).toBe("dark");
		expect(dark.queries).toEqual([DARK_QUERY]);

		const light = fakeEnvironment(false);
		applyTheme("system", light.env);
		expect(light.env.root.dataset.theme).toBe("light");
	});

	it("follows later system changes while 'system', until stopped", () => {
		const f = fakeEnvironment(false);
		const stop = applyTheme("system", f.env);
		f.setSystemDark(true);
		expect(f.env.root.dataset.theme).toBe("dark");
		stop();
		expect(f.listeners.size).toBe(0);
		f.setSystemDark(false);
		expect(f.env.root.dataset.theme).toBe("dark");
	});

	it.each(["dark", "light"] as const)(
		"sets data-theme to %s regardless of the system, and does not listen",
		(value) => {
			const f = fakeEnvironment(value === "light");
			applyTheme(value, f.env);
			expect(f.env.root.dataset.theme).toBe(value);
			expect(f.listeners.size).toBe(0);
		},
	);
});
