// Theme application: the stored preference becomes `data-theme="dark" | "light"` on <html>. `system` (the stored
// default) is resolved here from `prefers-color-scheme` (and follows it while the app runs), so styles only ever
// see two values. When the system reports neither dark nor light, the theme is dark.
import type { ThemePreference } from "@ak-studio/contract";

export type ResolvedTheme = "dark" | "light";

export const DARK_QUERY = "(prefers-color-scheme: dark)";
export const LIGHT_QUERY = "(prefers-color-scheme: light)";

/** The slice of `window.matchMedia` the logic needs, so tests need no DOM. */
export interface MediaQueryLike {
	readonly matches: boolean;
	addEventListener(type: "change", listener: () => void): void;
	removeEventListener(type: "change", listener: () => void): void;
}

export interface ThemeEnvironment {
	/** The <html> element. */
	root: { dataset: Record<string, string | undefined> };
	/** Absent where the platform has no matchMedia. */
	matchMedia?: (query: string) => MediaQueryLike;
}

/** What the system reports: dark, light, or neither (no matchMedia, or both queries false). */
export type SystemScheme = ResolvedTheme | "unknown";

/**
 * The theme for a preference. `system` follows the system's scheme, and is dark when the system reports neither
 * (decided at the P1a design gate: dark matches the brand's navy ground).
 */
export function resolveTheme(
	preference: ThemePreference,
	system: SystemScheme,
): ResolvedTheme {
	if (preference !== "system") return preference;
	return system === "light" ? "light" : "dark";
}

/** Reads the system scheme from both queries; a missing or throwing matchMedia counts as unknown. */
function querySystem(env: ThemeEnvironment): {
	read(): SystemScheme;
	listen(listener: () => void): () => void;
} {
	let dark: MediaQueryLike | undefined;
	let light: MediaQueryLike | undefined;
	try {
		dark = env.matchMedia?.(DARK_QUERY);
		light = env.matchMedia?.(LIGHT_QUERY);
	} catch {
		dark = undefined;
		light = undefined;
	}
	const queries = [dark, light].filter((q) => q !== undefined);
	return {
		read() {
			if (dark?.matches) return "dark";
			if (light?.matches) return "light";
			return "unknown";
		},
		listen(listener) {
			for (const q of queries) q.addEventListener("change", listener);
			return () => {
				for (const q of queries) q.removeEventListener("change", listener);
			};
		},
	};
}

/**
 * Sets `data-theme` for `preference` and, for `system`, keeps it in step with the OS. Returns a function that
 * stops following the OS.
 */
export function applyTheme(
	preference: ThemePreference,
	env: ThemeEnvironment,
): () => void {
	if (preference !== "system") {
		env.root.dataset.theme = preference;
		return () => {};
	}
	const system = querySystem(env);
	const apply = (): void => {
		env.root.dataset.theme = resolveTheme(preference, system.read());
	};
	apply();
	return system.listen(apply);
}

/** The browser's environment. */
export function browserThemeEnvironment(): ThemeEnvironment {
	return {
		root: document.documentElement,
		matchMedia:
			typeof window.matchMedia === "function"
				? (query) => window.matchMedia(query)
				: undefined,
	};
}
