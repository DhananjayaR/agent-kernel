import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ERROR_CODES } from "@ak-studio/contract";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ServiceRegistry } from "../bridge/registry";
import {
	AppService,
	PREFERENCES_FILE,
	readPreferences,
	toPlatform,
} from "./AppService";

let dir: string;
let file: string;
beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), "ak-studio-app-"));
	file = join(dir, "data", PREFERENCES_FILE);
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

function serve(service: AppService) {
	const registry = new ServiceRegistry().register(service);
	registry.start();
	return registry;
}

describe("AppService", () => {
	it("answers app.info with version, platform and the default theme", async () => {
		const registry = serve(
			new AppService({
				version: "1.2.3",
				platform: "linux",
				preferencesFile: file,
			}),
		);
		await expect(registry.request("app.info", {})).resolves.toEqual({
			ok: true,
			value: { version: "1.2.3", platform: "linux", theme: "system" },
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
		expect(JSON.parse(readFileSync(file, "utf8"))).toEqual({ theme: "dark" });

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

	it("falls back to the default theme for a missing, malformed or unknown file", () => {
		expect(readPreferences(file).theme).toBe("system");
		mkdirSync(join(dir, "data"), { recursive: true });
		for (const text of ["not json", "null", '{"theme":"blue"}', "[]"]) {
			writeFileSync(file, text);
			expect(readPreferences(file).theme).toBe("system");
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
