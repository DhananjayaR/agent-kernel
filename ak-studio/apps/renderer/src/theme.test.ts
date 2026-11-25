import { describe, expect, it } from "vitest";
import {
	applyTheme,
	DARK_QUERY,
	LIGHT_QUERY,
	type MediaQueryLike,
	resolveTheme,
	type SystemScheme,
	type ThemeEnvironment,
} from "./theme";

type Listener = () => void;

/** A system whose scheme can change; `unknown` makes both queries false. */
function fakeEnvironment(initial: SystemScheme) {
	let scheme = initial;
	const listeners = new Map<string, Set<Listener>>();
	const queries: string[] = [];
	const media = (query: string): MediaQueryLike => {
		const set = listeners.get(query) ?? new Set<Listener>();
		listeners.set(query, set);
		return {
			get matches() {
				return (
					(query === DARK_QUERY && scheme === "dark") ||
					(query === LIGHT_QUERY && scheme === "light")
				);
			},
			addEventListener: (_type, listener) => set.add(listener),
			removeEventListener: (_type, listener) => set.delete(listener),
		};
	};
	const env: ThemeEnvironment = {
		root: { dataset: {} },
		matchMedia: (query) => {
			queries.push(query);
			return media(query);
		},
	};
	return {
		env,
		queries,
		listenerCount: () =>
			[...listeners.values()].reduce((n, set) => n + set.size, 0),
		setSystem(value: SystemScheme) {
			scheme = value;
			// Like a browser: each query whose result may have changed notifies its own listeners.
			for (const set of listeners.values())
				for (const listener of [...set]) listener();
		},
	};
}

describe("resolveTheme", () => {
	it("follows the system for 'system'", () => {
		expect(resolveTheme("system", "dark")).toBe("dark");
		expect(resolveTheme("system", "light")).toBe("light");
	});

	it("is dark for 'system' when the system reports neither", () => {
		expect(resolveTheme("system", "unknown")).toBe("dark");
	});

	it("ignores the system for explicit values", () => {
		expect(resolveTheme("dark", "light")).toBe("dark");
		expect(resolveTheme("light", "dark")).toBe("light");
		expect(resolveTheme("light", "unknown")).toBe("light");
	});
});

describe("applyTheme", () => {
	it("sets data-theme from prefers-color-scheme for 'system', asking both queries", () => {
		const dark = fakeEnvironment("dark");
		applyTheme("system", dark.env);
		expect(dark.env.root.dataset.theme).toBe("dark");
		expect(dark.queries).toEqual([DARK_QUERY, LIGHT_QUERY]);

		const light = fakeEnvironment("light");
		applyTheme("system", light.env);
		expect(light.env.root.dataset.theme).toBe("light");
	});

	it("is dark for 'system' when neither query matches", () => {
		const f = fakeEnvironment("unknown");
		applyTheme("system", f.env);
		expect(f.env.root.dataset.theme).toBe("dark");
	});

	it("is dark for 'system' when matchMedia is unavailable", () => {
		const env: ThemeEnvironment = { root: { dataset: {} } };
		const stop = applyTheme("system", env);
		expect(env.root.dataset.theme).toBe("dark");
		stop();
	});

	it("is dark for 'system' when matchMedia throws", () => {
		const env: ThemeEnvironment = {
			root: { dataset: {} },
			matchMedia: () => {
				throw new Error("not supported");
			},
		};
		applyTheme("system", env);
		expect(env.root.dataset.theme).toBe("dark");
	});

	it("follows later system changes while 'system', until stopped", () => {
		const f = fakeEnvironment("light");
		const stop = applyTheme("system", f.env);
		f.setSystem("dark");
		expect(f.env.root.dataset.theme).toBe("dark");
		f.setSystem("light");
		expect(f.env.root.dataset.theme).toBe("light");
		f.setSystem("unknown");
		expect(f.env.root.dataset.theme).toBe("dark");
		stop();
		expect(f.listenerCount()).toBe(0);
		f.setSystem("light");
		expect(f.env.root.dataset.theme).toBe("dark");
	});

	it.each(["dark", "light"] as const)(
		"sets data-theme to %s regardless of the system, and does not listen",
		(value) => {
			const f = fakeEnvironment(value === "light" ? "dark" : "light");
			applyTheme(value, f.env);
			expect(f.env.root.dataset.theme).toBe(value);
			expect(f.listenerCount()).toBe(0);
		},
	);
});
