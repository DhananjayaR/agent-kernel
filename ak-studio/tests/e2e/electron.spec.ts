// Electron smoke test: the built, unpackaged app (apps/desktop/out/, from `pnpm build:e2e`) with the real main
// process. Started with AK_STUDIO_TEST_HOOKS=1 so main exposes the request gate's counter, and with a fresh
// --user-data-dir per test. Production and packaged builds have no hooks, and packaged builds lack the --inspect
// support Playwright needs.
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
}

/**
 * Launches the built app with a fresh data folder, runs `body`, then closes the app and removes the folder. The
 * folder is removed even if the launch, the body or `app.close()` throws; removal retries, since on Windows the
 * app's child processes can hold files for a moment after close.
 */
async function withStudio(body: (studio: Studio) => Promise<void>) {
	const desktopDir = resolve(test.info().project.testDir, "../../apps/desktop");
	const mainEntry = join(desktopDir, "out/main/index.js");
	if (!existsSync(mainEntry)) {
		throw new Error(
			`${mainEntry} is missing: run \`pnpm build:e2e\` first (pnpm test:e2e does)`,
		);
	}
	// The `electron` package's main export is the path of the binary it downloaded.
	const executablePath = createRequire(join(desktopDir, "package.json"))(
		"electron",
	) as string;
	const env: Record<string, string> = {};
	for (const [key, value] of Object.entries(process.env)) {
		if (value !== undefined && key !== "ELECTRON_RENDERER_URL")
			env[key] = value;
	}
	env.AK_STUDIO_TEST_HOOKS = "1";

	let userDataDir: string | undefined;
	let app: ElectronApplication | undefined;
	try {
		userDataDir = mkdtempSync(join(tmpdir(), "ak-studio-e2e-"));
		app = await electron.launch({
			executablePath,
			args: [desktopDir, `--user-data-dir=${userDataDir}`],
			cwd: desktopDir,
			env,
			// No emulation (null is Playwright's "no override"): prefers-color-scheme comes from Electron's
			// nativeTheme, which follows the stored preference.
			colorScheme: null,
		});
		await body({ app, page: await app.firstWindow() });
	} finally {
		try {
			await app?.close();
		} finally {
			if (userDataDir) {
				rmSync(userDataDir, {
					recursive: true,
					force: true,
					maxRetries: 5,
					retryDelay: 200,
				});
			}
		}
	}
}

/** The request gate's cancelled-request counter and newest URLs, read in main. */
function cancelledRequests(
	app: ElectronApplication,
): Promise<{ count: number; urls: readonly string[] }> {
	return app.evaluate(() => {
		const hooks = (globalThis as WithHooks).__akStudioTestHooks;
		if (!hooks)
			throw new Error(
				"test hooks missing: built with `pnpm build:e2e`, started with AK_STUDIO_TEST_HOOKS=1?",
			);
		return {
			count: hooks.cancelledRequestCount(),
			urls: hooks.cancelledRequestUrls(),
		};
	});
}

test("built app starts and shows the version from the real main process", async () => {
	await withStudio(async ({ app, page }) => {
		const main = await app.evaluate(({ app }) => ({
			version: app.getVersion(),
			platform: process.platform,
		}));
		await expect(page.getByTestId("bridge")).toHaveText("ipc");
		await expect(page.getByTestId("version")).toHaveText(main.version);
		await expect(page.getByTestId("platform")).toHaveText(main.platform);
		expect(page.url()).toBe("app://studio/");
	});
});

test("theme switch reaches the main process", async () => {
	await withStudio(async ({ app, page }) => {
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
	});
});

// The request gate sits on Chromium's network stack (session.webRequest): it sees the renderer's requests and
// main's `net` requests, not Node networking (`fetch`, `http`, `net` modules) in the main process.
test("makes no network request (Chromium requests only; Node networking in main is not covered)", async () => {
	await withStudio(async ({ app, page }) => {
		await expect(page.getByTestId("version")).not.toBeEmpty();
		await page.getByTestId("theme").selectOption("dark");
		await expect(page.getByTestId("stored-theme")).toHaveText("dark");
		// Fonts and the rest of the page have loaded.
		await page.evaluate(() => document.fonts.ready.then(() => undefined));
		// Read last, after everything the page does at start and on a theme switch.
		expect(await cancelledRequests(app)).toEqual({ count: 0, urls: [] });
	});
});

// A font the CSP blocks never reaches the request gate, so a zero count alone would not catch it: this test
// records `securitypolicyviolation` events from the first script on, and checks where the font file came from.
test("uses the bundled fonts (UI, heading, mono), loaded from app:// with no CSP violation", async () => {
	await withStudio(async ({ app, page }) => {
		// The window loaded before the test could add a listener: add it as an init script, then reload.
		await page.addInitScript(() => {
			const w = window as unknown as { __cspViolations: string[] };
			w.__cspViolations = [];
			document.addEventListener("securitypolicyviolation", (event) => {
				w.__cspViolations.push(
					`${event.effectiveDirective} ${event.blockedURI}`,
				);
			});
		});
		await page.reload();
		await expect(page.getByTestId("version")).not.toBeEmpty();
		const fonts = await page.evaluate(async () => {
			// Each family token on the placeholder page: body text (Inter), the heading (Archivo), the version
			// number (JetBrains Mono, tabular figures).
			const samples = {
				ui: document.querySelector("main"),
				heading: document.querySelector("main h1"),
				mono: document.querySelector('[data-testid="version"]'),
			};
			const used: Record<string, { family: string; numeric: string }> = {};
			const loaded: { family: string; status: string }[] = [];
			for (const [role, el] of Object.entries(samples)) {
				const style = el ? getComputedStyle(el) : null;
				used[role] = {
					family: style?.fontFamily ?? "",
					numeric: style?.fontVariantNumeric ?? "",
				};
				// The faces needed for that element's text, loaded (this waits for any load in progress).
				const family = style?.fontFamily.split(",")[0] ?? "";
				for (const face of await document.fonts.load(
					`16px ${family}`,
					el?.textContent ?? "",
				))
					loaded.push({ family: face.family, status: face.status });
			}
			await document.fonts.ready;
			return {
				used,
				loaded,
				files: performance
					.getEntriesByType("resource")
					.map((entry) => entry.name)
					.filter((name) => /\.woff2?$/.test(name)),
				violations: (window as unknown as { __cspViolations: string[] })
					.__cspViolations,
			};
		});
		expect(fonts.used.ui?.family).toMatch(/^"?Inter Variable"?,/);
		expect(fonts.used.heading?.family).toMatch(/^"?Archivo Variable"?,/);
		expect(fonts.used.mono?.family).toMatch(/^"?JetBrains Mono"?,/);
		expect(fonts.used.mono?.numeric).toBe("tabular-nums");
		expect(new Set(fonts.loaded.map((face) => face.family))).toEqual(
			new Set(["Inter Variable", "Archivo Variable", "JetBrains Mono"]),
		);
		for (const face of fonts.loaded) expect(face.status).toBe("loaded");
		expect(fonts.files.length).toBeGreaterThan(0);
		for (const file of fonts.files) {
			expect(file).toMatch(
				/^app:\/\/studio\/assets\/(inter|archivo|jetbrains-mono)-[^/]+\.woff2$/,
			);
		}
		expect(fonts.violations).toEqual([]);
		expect(await cancelledRequests(app)).toEqual({ count: 0, urls: [] });
	});
});

test("the request gate counts a refused request (so a zero count means something)", async () => {
	await withStudio(async ({ app, page }) => {
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
	});
});
