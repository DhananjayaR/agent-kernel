import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEFAULT_SHELL_LAYOUT, ERROR_CODES } from "@ak-studio/contract";
import {
	EventBus,
	SecretMasker,
	ServiceRegistry,
	StreamHub,
} from "@ak-studio/runtime";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	AppService,
	PREFERENCES_FILE,
	readPreferences,
	toPlatform,
} from "./AppService";
import { PendingP1bService } from "./PendingP1bService";
import { WindowService } from "./WindowService";

let dir: string;
let file: string;
beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), "ak-studio-app-"));
	file = join(dir, "data", PREFERENCES_FILE);
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

function serve(service: AppService) {
	// The window, event and stream services serve the rest, so the registry (which needs every handler) can
	// start. TEMPORARY (P1b Task 3): PendingP1bService serves the job and session operations until Task 6.
	const registry = new ServiceRegistry()
		.register(service)
		.register(new WindowService(() => null))
		.register(new EventBus())
		.register(new StreamHub({ masker: new SecretMasker() }))
		.register(new PendingP1bService());
	registry.start();
	return registry;
}

describe("AppService", () => {
	it("answers app.info with version, platform, the default theme and the default layout", async () => {
		const registry = serve(
			new AppService({
				version: "1.2.3",
				platform: "linux",
				preferencesFile: file,
			}),
		);
		await expect(registry.request("app.info", {})).resolves.toEqual({
			ok: true,
			value: {
				version: "1.2.3",
				platform: "linux",
				theme: "system",
				layout: DEFAULT_SHELL_LAYOUT,
			},
		});
		// Strict inputs: an unknown key is refused, not dropped.
		await expect(
			registry.request("app.info", { extra: 1 }),
		).resolves.toMatchObject({
			ok: false,
			error: { code: ERROR_CODES.invalidInput },
		});
	});

	it("stores the theme in the data folder, and a new service reads it back", async () => {
		const onThemeChange = vi.fn();
		const registry = serve(
			new AppService({
				version: "1",
				platform: "darwin",
				preferencesFile: file,
				onThemeChange,
			}),
		);
		await expect(
			registry.request("app.setTheme", { theme: "dark" }),
		).resolves.toEqual({ ok: true, value: { theme: "dark" } });
		expect(onThemeChange).toHaveBeenCalledExactlyOnceWith("dark");
		expect(JSON.parse(readFileSync(file, "utf8"))).toEqual({
			theme: "dark",
			layout: DEFAULT_SHELL_LAYOUT,
		});

		const again = serve(
			new AppService({
				version: "1",
				platform: "darwin",
				preferencesFile: file,
			}),
		);
		await expect(again.request("app.info", {})).resolves.toMatchObject({
			value: { platform: "darwin", theme: "dark" },
		});
	});

	it("rejects an invalid theme without touching the file", async () => {
		const onThemeChange = vi.fn();
		const registry = serve(
			new AppService({
				version: "1",
				platform: "linux",
				preferencesFile: file,
				onThemeChange,
			}),
		);
		const result = await registry.request("app.setTheme", { theme: "blue" });
		expect(result).toMatchObject({
			ok: false,
			error: { code: ERROR_CODES.invalidInput },
		});
		expect(onThemeChange).not.toHaveBeenCalled();
		expect(() => readFileSync(file)).toThrow();
	});

	it("answers preferencesNotSaved, and keeps the old theme, when the file cannot be written", async () => {
		// The data folder's parent is a file, so the folder cannot be created.
		writeFileSync(join(dir, "blocker"), "");
		const service = new AppService({
			version: "1",
			platform: "linux",
			preferencesFile: join(dir, "blocker", PREFERENCES_FILE),
		});
		const registry = serve(service);
		const result = await registry.request("app.setTheme", { theme: "light" });
		expect(result).toMatchObject({
			ok: false,
			error: { code: ERROR_CODES.preferencesNotSaved },
		});
		expect(service.theme).toBe("system");
	});

	it("stores the layout beside the theme, and each setter keeps the other", async () => {
		const registry = serve(
			new AppService({
				version: "1",
				platform: "linux",
				preferencesFile: file,
			}),
		);
		const layout = { bottomPanel: { open: false, height: 312 } };
		await registry.request("app.setTheme", { theme: "light" });
		await expect(
			registry.request("app.setLayout", { layout }),
		).resolves.toEqual({ ok: true, value: { layout } });
		expect(JSON.parse(readFileSync(file, "utf8"))).toEqual({
			theme: "light",
			layout,
		});
		await registry.request("app.setTheme", { theme: "dark" });
		expect(JSON.parse(readFileSync(file, "utf8"))).toEqual({
			theme: "dark",
			layout,
		});

		const again = serve(
			new AppService({
				version: "1",
				platform: "linux",
				preferencesFile: file,
			}),
		);
		await expect(again.request("app.info", {})).resolves.toMatchObject({
			value: { theme: "dark", layout },
		});
	});

	it("rejects an invalid layout without touching the file", async () => {
		const registry = serve(
			new AppService({
				version: "1",
				platform: "linux",
				preferencesFile: file,
			}),
		);
		for (const layout of [
			{ bottomPanel: { open: true, height: 10 } },
			{ bottomPanel: { open: true, height: 240, extra: 1 } },
			{ bottomPanel: { open: "no", height: 240 } },
		]) {
			await expect(
				registry.request("app.setLayout", { layout }),
			).resolves.toMatchObject({
				ok: false,
				error: { code: ERROR_CODES.invalidInput },
			});
		}
		expect(() => readFileSync(file)).toThrow();
	});

	it("answers preferencesNotSaved, and keeps the old layout, when the file cannot be written", async () => {
		writeFileSync(join(dir, "blocker"), "");
		const service = new AppService({
			version: "1",
			platform: "linux",
			preferencesFile: join(dir, "blocker", PREFERENCES_FILE),
		});
		const result = await serve(service).request("app.setLayout", {
			layout: { bottomPanel: { open: false, height: 300 } },
		});
		expect(result).toMatchObject({
			ok: false,
			error: {
				code: ERROR_CODES.preferencesNotSaved,
				message: "The panel layout could not be saved.",
			},
		});
		expect(service.layout).toEqual(DEFAULT_SHELL_LAYOUT);
	});

	it("reads each preference on its own: a bad layout keeps the theme, a bad theme keeps the layout", () => {
		mkdirSync(join(dir, "data"), { recursive: true });
		const layout = { bottomPanel: { open: false, height: 400 } };
		writeFileSync(
			file,
			JSON.stringify({ theme: "light", layout: { bottomPanel: { open: 1 } } }),
		);
		expect(readPreferences(file)).toEqual({
			theme: "light",
			layout: DEFAULT_SHELL_LAYOUT,
		});
		writeFileSync(file, JSON.stringify({ theme: "blue", layout }));
		expect(readPreferences(file)).toEqual({ theme: "system", layout });
		// A file from before the layout existed (theme only) keeps its theme.
		writeFileSync(file, '{"theme":"dark"}');
		expect(readPreferences(file)).toEqual({
			theme: "dark",
			layout: DEFAULT_SHELL_LAYOUT,
		});
	});

	it("falls back to the default theme for a missing, malformed or unknown file", () => {
		expect(readPreferences(file)).toEqual({
			theme: "system",
			layout: DEFAULT_SHELL_LAYOUT,
		});
		mkdirSync(join(dir, "data"), { recursive: true });
		for (const text of ["not json", "null", '{"theme":"blue"}', "[]", "7"]) {
			writeFileSync(file, text);
			expect(readPreferences(file)).toEqual({
				theme: "system",
				layout: DEFAULT_SHELL_LAYOUT,
			});
		}
		writeFileSync(file, '{"theme":"light","other":1}');
		expect(readPreferences(file).theme).toBe("light");
	});

	it("maps Node platforms onto the contract's", () => {
		expect(toPlatform("linux")).toBe("linux");
		expect(toPlatform("darwin")).toBe("darwin");
		expect(toPlatform("win32")).toBe("win32");
		expect(toPlatform("freebsd")).toBe("linux");
	});
});
