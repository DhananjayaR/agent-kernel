// Theme application: the stored preference becomes `data-theme="dark" | "light"` on <html>. `system` is resolved
// here from `prefers-color-scheme` (and follows it while the app runs), so styles only ever see two values.
import type { ThemePreference } from "@ak-studio/contract";

export type ResolvedTheme = "dark" | "light";

export const DARK_QUERY = "(prefers-color-scheme: dark)";

/** The slice of `window.matchMedia` the logic needs, so tests need no DOM. */
export interface MediaQueryLike {
	readonly matches: boolean;
	addEventListener(type: "change", listener: () => void): void;
	removeEventListener(type: "change", listener: () => void): void;
}

export interface ThemeEnvironment {
	/** The <html> element. */
	root: { dataset: Record<string, string | undefined> };
	matchMedia(query: string): MediaQueryLike;
}

export function resolveTheme(
	preference: ThemePreference,
	systemIsDark: boolean,
): ResolvedTheme {
	if (preference === "system") return systemIsDark ? "dark" : "light";
	return preference;
}

/**
 * Sets `data-theme` for `preference` and, for `system`, keeps it in step with the OS. Returns a function that
 * stops following the OS.
 */
export function applyTheme(
	preference: ThemePreference,
	env: ThemeEnvironment,
): () => void {
	const media = env.matchMedia(DARK_QUERY);
	const apply = (): void => {
		env.root.dataset.theme = resolveTheme(preference, media.matches);
	};
	apply();
	if (preference !== "system") return () => {};
	media.addEventListener("change", apply);
	return () => media.removeEventListener("change", apply);
}

/** The browser's environment. */
export function browserThemeEnvironment(): ThemeEnvironment {
	return {
		root: document.documentElement,
		matchMedia: (query) => window.matchMedia(query),
	};
}
