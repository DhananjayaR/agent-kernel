// AppService: the app's version, the platform, and the app preferences (the theme and the shell layout), stored
// together in one file in the app's data folder.
// No Electron import: index.ts passes the version, platform and file path in.
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import {
	DEFAULT_SHELL_LAYOUT,
	ERROR_CODES,
	type Platform,
	type ShellLayout,
	StudioFailure,
	shellLayoutSchema,
	type ThemePreference,
	themePreferenceSchema,
} from "@ak-studio/contract";
import type { Service, ServiceRegistry } from "@ak-studio/runtime";

export const PREFERENCES_FILE = "preferences.json";
export const DEFAULT_THEME: ThemePreference = "system";

export interface Preferences {
	theme: ThemePreference;
	layout: ShellLayout;
}

export interface AppServiceOptions {
	version: string;
	platform: NodeJS.Platform;
	/** Absolute path of the preferences file in the app's data folder. */
	preferencesFile: string;
	/** Called after a new theme preference is stored (index.ts applies it to `nativeTheme`). */
	onThemeChange?: (theme: ThemePreference) => void;
}

/** The contract's platform for a Node platform. The app ships for Linux, macOS and Windows only. */
export function toPlatform(platform: NodeJS.Platform): Platform {
	return platform === "darwin" || platform === "win32" ? platform : "linux";
}

/**
 * Reads the preferences file. Each preference is checked on its own: a missing or malformed one falls back to its
 * default without resetting the others (a bad layout keeps the stored theme).
 */
export function readPreferences(file: string): Preferences {
	let raw: unknown;
	try {
		raw = JSON.parse(readFileSync(file, "utf8"));
	} catch {
		raw = undefined;
	}
	const fields =
		typeof raw === "object" && raw !== null && !Array.isArray(raw)
			? (raw as { theme?: unknown; layout?: unknown })
			: {};
	const theme = themePreferenceSchema.safeParse(fields.theme);
	const layout = shellLayoutSchema.safeParse(fields.layout);
	return {
		theme: theme.success ? theme.data : DEFAULT_THEME,
		layout: layout.success ? layout.data : DEFAULT_SHELL_LAYOUT,
	};
}

/** Writes atomically (temp file, then rename) so a crash mid-write cannot leave a corrupt file. */
export function writePreferences(file: string, prefs: Preferences): void {
	mkdirSync(dirname(file), { recursive: true });
	const tmp = `${file}.tmp`;
	writeFileSync(tmp, `${JSON.stringify(prefs)}\n`, "utf8");
	renameSync(tmp, file);
}

export class AppService implements Service {
	readonly #version: string;
	readonly #platform: Platform;
	readonly #file: string;
	readonly #onThemeChange: ((theme: ThemePreference) => void) | undefined;
	#prefs: Preferences;

	constructor(options: AppServiceOptions) {
		this.#version = options.version;
		this.#platform = toPlatform(options.platform);
		this.#file = options.preferencesFile;
		this.#onThemeChange = options.onThemeChange;
		this.#prefs = readPreferences(this.#file);
	}

	get theme(): ThemePreference {
		return this.#prefs.theme;
	}

	get layout(): ShellLayout {
		return this.#prefs.layout;
	}

	info(): {
		version: string;
		platform: Platform;
		theme: ThemePreference;
		layout: ShellLayout;
	} {
		return {
			version: this.#version,
			platform: this.#platform,
			theme: this.#prefs.theme,
			layout: this.#prefs.layout,
		};
	}

	/**
	 * Writes every preference (the file holds them all), then keeps the new set in memory. On failure nothing in
	 * memory changes, and the error names what could not be saved.
	 */
	#store(next: Preferences, what: string): void {
		try {
			writePreferences(this.#file, next);
		} catch (err) {
			throw new StudioFailure({
				code: ERROR_CODES.preferencesNotSaved,
				message: `The ${what} could not be saved.`,
				detail: err instanceof Error ? err.message : String(err),
			});
		}
		this.#prefs = next;
	}

	/** Stores the preference first; the in-memory value changes only once the file is written. */
	setTheme(theme: ThemePreference): { theme: ThemePreference } {
		this.#store({ ...this.#prefs, theme }, "theme preference");
		this.#onThemeChange?.(theme);
		return { theme };
	}

	/** Stores the shell layout (the bottom panel's open state and height) beside the theme. */
	setLayout(layout: ShellLayout): { layout: ShellLayout } {
		this.#store({ ...this.#prefs, layout }, "panel layout");
		return { layout };
	}

	register(registry: ServiceRegistry): void {
		registry
			.handle("app.info", () => this.info())
			.handle("app.setLayout", ({ layout }) => this.setLayout(layout))
			.handle("app.setTheme", ({ theme }) => this.setTheme(theme));
	}
}
