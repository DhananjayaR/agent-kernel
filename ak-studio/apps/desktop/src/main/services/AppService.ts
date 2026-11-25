// AppService: the app's version, the platform, and the theme preference (stored in the app's data folder).
// No Electron import: index.ts passes the version, platform and file path in.
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import {
	ERROR_CODES,
	type Platform,
	StudioFailure,
	type ThemePreference,
	themePreferenceSchema,
} from "@ak-studio/contract";
import type { Service, ServiceRegistry } from "../bridge/registry";

export const PREFERENCES_FILE = "preferences.json";
export const DEFAULT_THEME: ThemePreference = "system";

export interface Preferences {
	theme: ThemePreference;
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

/** Reads the preferences file; anything missing or malformed falls back to the defaults. */
export function readPreferences(file: string): Preferences {
	try {
		const raw: unknown = JSON.parse(readFileSync(file, "utf8"));
		const theme =
			typeof raw === "object" && raw !== null
				? themePreferenceSchema.safeParse((raw as { theme?: unknown }).theme)
				: undefined;
		return { theme: theme?.success ? theme.data : DEFAULT_THEME };
	} catch {
		return { theme: DEFAULT_THEME };
	}
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
	#theme: ThemePreference;

	constructor(options: AppServiceOptions) {
		this.#version = options.version;
		this.#platform = toPlatform(options.platform);
		this.#file = options.preferencesFile;
		this.#onThemeChange = options.onThemeChange;
		this.#theme = readPreferences(this.#file).theme;
	}

	get theme(): ThemePreference {
		return this.#theme;
	}

	info(): { version: string; platform: Platform; theme: ThemePreference } {
		return {
			version: this.#version,
			platform: this.#platform,
			theme: this.#theme,
		};
	}

	/** Stores the preference first; the in-memory value changes only once the file is written. */
	setTheme(theme: ThemePreference): { theme: ThemePreference } {
		try {
			writePreferences(this.#file, { theme });
		} catch (err) {
			throw new StudioFailure({
				code: ERROR_CODES.preferencesNotSaved,
				message: "The theme preference could not be saved.",
				detail: err instanceof Error ? err.message : String(err),
			});
		}
		this.#theme = theme;
		this.#onThemeChange?.(theme);
		return { theme };
	}

	register(registry: ServiceRegistry): void {
		registry
			.handle("app.info", () => this.info())
			.handle("app.setTheme", ({ theme }) => this.setTheme(theme));
	}
}
