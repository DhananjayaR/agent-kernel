// Electron smoke test: the built, unpackaged app (apps/desktop/out/, from `pnpm build`) with the real main
// process. Started with AK_STUDIO_TEST_HOOKS=1 so main exposes the request gate's counter, and with a fresh
// --user-data-dir per test. Packaged builds have neither the hooks nor the --inspect support Playwright needs.
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
	type ElectronApplication,
	_electron as electron,
	expect,
	type Page,
	test,
} from "@playwright/test";

/** Main's read-only test hooks (apps/desktop/src/main/index.ts, StudioTestHooks). */
interface StudioTestHooks {
	cancelledRequestCount(): number;
	cancelledRequestUrls(): readonly string[];
}
type WithHooks = { __akStudioTestHooks?: StudioTestHooks };

interface Studio {
	app: ElectronApplication;
	page: Page;
	close(): Promise<void>;
}

async function launchStudio(): Promise<Studio> {
	const desktopDir = resolve(test.info().project.testDir, "../../apps/desktop");
	const mainEntry = join(desktopDir, "out/main/index.js");
	if (!existsSync(mainEntry)) {
		throw new Error(
			`${mainEntry} is missing: run \`pnpm build\` first (pnpm test:e2e does)`,
		);
	}
	// The `electron` package's main export is the path of the binary it downloaded.
	const executablePath = createRequire(join(desktopDir, "package.json"))(
		"electron",
	) as string;
	const userDataDir = mkdtempSync(join(tmpdir(), "ak-studio-e2e-"));
	const env: Record<string, string> = {};
	for (const [key, value] of Object.entries(process.env)) {
		if (value !== undefined && key !== "ELECTRON_RENDERER_URL")
			env[key] = value;
	}
	env.AK_STUDIO_TEST_HOOKS = "1";

	const app = await electron.launch({
		executablePath,
		args: [desktopDir, `--user-data-dir=${userDataDir}`],
		cwd: desktopDir,
		env,
		// No emulation (null is Playwright's "no override"): prefers-color-scheme comes from Electron's nativeTheme,
		// which follows the stored preference.
		colorScheme: null,
	});
	const page = await app.firstWindow();
	return {
		app,
		page,
		async close() {
			await app.close();
			rmSync(userDataDir, { recursive: true, force: true });
		},
	};
}

/** The request gate's cancelled-request counter and newest URLs, read in main. */
function cancelledRequests(
	app: ElectronApplication,
): Promise<{ count: number; urls: readonly string[] }> {
	return app.evaluate(() => {
		const hooks = (globalThis as WithHooks).__akStudioTestHooks;
		if (!hooks) throw new Error("test hooks missing: AK_STUDIO_TEST_HOOKS=1?");
		return {
			count: hooks.cancelledRequestCount(),
			urls: hooks.cancelledRequestUrls(),
		};
	});
}

test("built app starts and shows the version from the real main process", async () => {
	const studio = await launchStudio();
	try {
		const { page, app } = studio;
		const main = await app.evaluate(({ app }) => ({
			version: app.getVersion(),
			platform: process.platform,
		}));
		await expect(page.getByTestId("bridge")).toHaveText("ipc");
		await expect(page.getByTestId("version")).toHaveText(main.version);
		await expect(page.getByTestId("platform")).toHaveText(main.platform);
		expect(page.url()).toBe("app://studio/");
	} finally {
		await studio.close();
	}
});

test("theme switch reaches the main process", async () => {
	const studio = await launchStudio();
	try {
		const { page, app } = studio;
		const html = page.locator("html");
		const select = page.getByTestId("theme");
		await expect(page.getByTestId("stored-theme")).toHaveText("system");

		for (const theme of ["dark", "light"] as const) {
			await select.selectOption(theme);
			await expect(page.getByTestId("stored-theme")).toHaveText(theme);
			await expect(html).toHaveAttribute("data-theme", theme);
			const native = await app.evaluate(({ nativeTheme }) => ({
				source: nativeTheme.themeSource,
				dark: nativeTheme.shouldUseDarkColors,
			}));
			expect(native).toEqual({ source: theme, dark: theme === "dark" });
		}
	} finally {
		await studio.close();
	}
});

// The request gate sits on Chromium's network stack (session.webRequest): it sees the renderer's requests and
// main's `net` requests, not Node networking (`fetch`, `http`, `net` modules) in the main process.
test("makes no network request (Chromium requests only; Node networking in main is not covered)", async () => {
	const studio = await launchStudio();
	try {
		const { page } = studio;
		await expect(page.getByTestId("version")).not.toBeEmpty();
		await page.getByTestId("theme").selectOption("dark");
		await expect(page.getByTestId("stored-theme")).toHaveText("dark");
		// Fonts and the rest of the page have loaded.
		await page.evaluate(() => document.fonts.ready.then(() => undefined));
		// Read last, after everything the page does at start and on a theme switch.
		expect(await cancelledRequests(studio.app)).toEqual({ count: 0, urls: [] });
	} finally {
		await studio.close();
	}
});

test("the request gate counts a refused request (so a zero count means something)", async () => {
	const studio = await launchStudio();
	try {
		const { app, page } = studio;
		await expect(page.getByTestId("version")).not.toBeEmpty();
		const outcome = await app.evaluate(async ({ net }) => {
			try {
				await net.fetch("https://example.invalid/");
				return "completed";
			} catch {
				return "refused";
			}
		});
		expect(outcome).toBe("refused");
		expect(await cancelledRequests(app)).toEqual({
			count: 1,
			urls: ["https://example.invalid/"],
		});
	} finally {
		await studio.close();
	}
});
