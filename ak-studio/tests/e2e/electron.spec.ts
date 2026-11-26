// Electron smoke test: the built, unpackaged app (apps/desktop/out/, from `pnpm build:e2e`) with the real main
// process. Started with AK_STUDIO_TEST_HOOKS=1 so main exposes the request gate's counter, and with a fresh
// --user-data-dir per test. Production and packaged builds have no hooks, and packaged builds lack the --inspect
// support Playwright needs.
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
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
 * Launches the built app, runs `body`, then closes the app. With no `userDataDir` it uses a fresh data folder and
 * removes it afterwards, even if the launch, the body or `app.close()` throws; removal retries, since on Windows the
 * app's child processes can hold files for a moment after close. A caller that passes `userDataDir` (a restart
 * test) owns the folder.
 */
async function withStudio(
	body: (studio: Studio) => Promise<void>,
	options: { userDataDir?: string } = {},
) {
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

	const ownFolder = options.userDataDir === undefined;
	let userDataDir = options.userDataDir;
	let app: ElectronApplication | undefined;
	try {
		userDataDir ??= mkdtempSync(join(tmpdir(), "ak-studio-e2e-"));
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
			if (ownFolder && userDataDir) removeFolder(userDataDir);
		}
	}
}

function removeFolder(dir: string): void {
	rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}

/** A data folder shared by several launches (a restart), removed afterwards. */
async function withDataFolder(body: (dir: string) => Promise<void>) {
	const dir = mkdtempSync(join(tmpdir(), "ak-studio-e2e-"));
	try {
		await body(dir);
	} finally {
		removeFolder(dir);
	}
}

/** The stored preferences (apps/desktop/src/main/services/AppService.ts, PREFERENCES_FILE). */
function readPreferences(dir: string): unknown {
	try {
		return JSON.parse(readFileSync(join(dir, "preferences.json"), "utf8"));
	} catch {
		return undefined;
	}
}

/** The Studio's version in the status bar. */
const appVersion = (page: Page) =>
	page.locator('[data-slot="app-version-number"]');

/** Opens settings and picks a theme there (the settings modal's segmented control). */
async function chooseTheme(page: Page, theme: "System" | "Dark" | "Light") {
	const dialog = page.getByRole("dialog", { name: "Settings" });
	if (!(await dialog.isVisible()))
		await page.getByRole("button", { name: "Settings" }).click();
	await dialog.getByRole("radio", { name: theme }).click();
	await expect(dialog.getByRole("radio", { name: theme })).toBeChecked();
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

test("built app starts and shows the shell with the version from the real main process", async () => {
	await withStudio(async ({ app, page }) => {
		const main = await app.evaluate(({ app }) => app.getVersion());
		// The real version (the mock would say 0.0.0-mock), so the renderer is on the IPC bridge.
		await expect(appVersion(page)).toHaveText(main);
		expect(page.url()).toBe("app://studio/#/canvas");
		// The full name: the window title, and the app name (unpackaged builds add "(dev)").
		await expect(page).toHaveTitle("Open Agent Kernel Studio");
		expect(
			await app.evaluate(({ app, BrowserWindow }) => [
				app.getName(),
				BrowserWindow.getAllWindows()[0]?.getTitle(),
			]),
		).toEqual(["Open Agent Kernel Studio (dev)", "Open Agent Kernel Studio"]);
		await expect(page.getByRole("banner")).toBeVisible();
		await expect(page.getByText("No project open")).toBeVisible();
		await expect(page.getByRole("group", { name: "Local run" })).toHaveText(
			"No project to run",
		);
		await expect(page.locator('[data-slot="deploy-status"]')).toHaveText(
			"Deployment: Not deployed",
		);
		await expect(page.getByRole("region", { name: "Panel" })).toBeVisible();
	});
});

test("the OAK mark loads from app:// under the production CSP, with no network request", async () => {
	await withStudio(async ({ app, page }) => {
		const mark = page
			.getByRole("banner")
			.getByRole("img", { name: "OAK Studio" });
		await expect(mark).toBeVisible();
		await expect
			.poll(() => mark.evaluate((img: HTMLImageElement) => img.naturalWidth))
			.toBeGreaterThan(0);
		const src = await mark.evaluate((img: HTMLImageElement) => img.currentSrc);
		expect(src).toMatch(
			/^app:\/\/studio\/assets\/oak-mark-orange-[\w-]+\.svg$/,
		);
		expect(await mark.boundingBox()).toMatchObject({ width: 20, height: 20 });
		expect((await cancelledRequests(app)).count).toBe(0);
	});
});

test("each tab opens its empty state, naming the phase that fills it", async () => {
	await withStudio(async ({ page }) => {
		const tabs = [
			["Canvas", "canvas", /P3/],
			["Code", "code", /P3/],
			["Config", "config", /P3/],
			["Test & trace", "test-trace", /P8.*P9/],
			["Deploy", "deploy", /P10/],
		] as const;
		for (const [name, path, phase] of tabs) {
			await page.getByRole("tab", { name }).click();
			expect(page.url()).toBe(`app://studio/#/${path}`);
			const panel = page.getByRole("tabpanel", { name });
			await expect(
				panel.getByRole("heading", { name, level: 2 }),
			).toBeVisible();
			await expect(panel).toContainText(phase);
		}
	});
});

test("the theme switches from the settings modal and reaches the main process", async () => {
	await withStudio(async ({ app, page }) => {
		const html = page.locator("html");
		await expect(appVersion(page)).not.toBeEmpty();
		for (const theme of ["Dark", "Light"] as const) {
			await chooseTheme(page, theme);
			const value = theme.toLowerCase();
			await expect(html).toHaveAttribute("data-theme", value);
			const native = await app.evaluate(({ BrowserWindow, nativeTheme }) => ({
				source: nativeTheme.themeSource,
				dark: nativeTheme.shouldUseDarkColors,
				background: BrowserWindow.getAllWindows()[0]
					?.getBackgroundColor()
					.toLowerCase(),
			}));
			expect(native).toEqual({
				source: value,
				dark: value === "dark",
				background: value === "dark" ? "#011428" : "#ffffff",
			});
		}
	});
});

// The window's background before the renderer paints (no white flash): the stored theme's surface colour, read
// from a preferences file written before the launch. `system` follows the OS (nativeTheme).
test("the window opens with the stored theme's background colour", async () => {
	for (const theme of ["dark", "light", "system"] as const) {
		await withDataFolder(async (dir) => {
			mkdirSync(dir, { recursive: true });
			writeFileSync(join(dir, "preferences.json"), JSON.stringify({ theme }));
			await withStudio(
				async ({ app }) => {
					const window = await app.evaluate(
						({ BrowserWindow, nativeTheme }) => ({
							background: BrowserWindow.getAllWindows()[0]
								?.getBackgroundColor()
								.toLowerCase(),
							dark: nativeTheme.shouldUseDarkColors,
						}),
					);
					const dark = theme === "system" ? window.dark : theme === "dark";
					expect(window.background).toBe(dark ? "#011428" : "#ffffff");
				},
				{ userDataDir: dir },
			);
		});
	}
});

test("the bottom panel's open state and height persist across a restart", async () => {
	await withDataFolder(async (dir) => {
		await withStudio(
			async ({ page }) => {
				const panel = page.locator('[data-panel][id="bottom-panel"]');
				await expect(panel).toHaveJSProperty("offsetHeight", 240);
				// Taller from the keyboard (the handle's window splitter keys), then hidden with its toggle.
				await page.getByRole("separator", { name: "Resize the panel" }).focus();
				await page.keyboard.press("ArrowUp");
				await expect
					.poll(() => readPreferences(dir))
					.toMatchObject({ layout: { bottomPanel: { open: true } } });
				const stored = readPreferences(dir) as {
					layout: { bottomPanel: { height: number } };
				};
				expect(stored.layout.bottomPanel.height).toBeGreaterThan(240);
				await page.getByRole("button", { name: "Hide the panel" }).click();
				// Wait for the write before quitting, or it races the close.
				await expect
					.poll(() => readPreferences(dir))
					.toMatchObject({ layout: { bottomPanel: { open: false } } });
			},
			{ userDataDir: dir },
		);
		const { height } = (
			readPreferences(dir) as { layout: { bottomPanel: { height: number } } }
		).layout.bottomPanel;
		await withStudio(
			async ({ page }) => {
				const panel = page.locator('[data-panel][id="bottom-panel"]');
				const show = page.getByRole("button", { name: "Show the panel" });
				await expect(show).toBeVisible();
				await expect(panel).toHaveJSProperty("offsetHeight", 48);
				await show.click();
				await expect
					.poll(() => panel.evaluate((el) => el.getBoundingClientRect().height))
					.toBeCloseTo(height, 0);
			},
			{ userDataDir: dir },
		);
	});
});

test("holds at 1100 px: the top bar in one row (compact, with the window controls), no horizontal scroll", async () => {
	await withStudio(async ({ app, page }) => {
		await expect(appVersion(page)).not.toBeEmpty();
		await app.evaluate(({ BrowserWindow }) => {
			BrowserWindow.getAllWindows()[0]?.setContentSize(1100, 720);
		});
		// Polled: the resize reaches the page, then the top bar measures itself again.
		await expect
			.poll(() =>
				page.evaluate(() => {
					const bar = document.querySelector(
						'[data-slot="top-bar"]',
					) as HTMLElement;
					return {
						innerWidth: window.innerWidth,
						scrollWidth: document.documentElement.scrollWidth,
						barHeight: bar.getBoundingClientRect().height,
						barScroll: bar.scrollWidth - bar.clientWidth,
						compact: bar.hasAttribute("data-compact"),
					};
				}),
			)
			.toEqual({
				innerWidth: 1100,
				scrollWidth: 1100,
				barHeight: 48,
				barScroll: 0,
				compact: true,
			});
	});
});

// The custom window chrome: no system title bar or menu (Linux and Windows draw the controls in the top bar),
// Maximise and Restore work through the bridge, and the button's name follows. Close and Minimise are not driven
// here: a closed window ends the test's app, and a minimised one is not reliable on a headless or nested display
// (covered by the WindowService unit tests).
test("the window is frameless and its Maximise and Restore buttons work", async () => {
	await withStudio(async ({ app, page }) => {
		await expect(appVersion(page)).not.toBeEmpty();
		// No frame: the window and its content have the same bounds, and no menu bar shows.
		const frame = await app.evaluate(({ BrowserWindow }) => {
			const win = BrowserWindow.getAllWindows()[0];
			return {
				bounds: win?.getBounds(),
				content: win?.getContentBounds(),
				menuBar: win?.isMenuBarVisible(),
			};
		});
		if (process.platform !== "darwin") {
			expect(frame.content).toEqual(frame.bounds);
			expect(frame.menuBar).toBe(false);
		}
		const isMaximized = () =>
			app.evaluate(
				({ BrowserWindow }) =>
					BrowserWindow.getAllWindows()[0]?.isMaximized() ?? false,
			);
		expect(await isMaximized()).toBe(false);
		if (process.platform === "darwin") return; // macOS has the system's traffic lights, not ours.
		const controls = page.getByRole("group", { name: "Window controls" });
		await expect(controls).toBeVisible();
		await controls.getByRole("button", { name: "Maximise" }).click();
		await expect.poll(isMaximized).toBe(true);
		await controls.getByRole("button", { name: "Restore" }).click();
		await expect.poll(isMaximized).toBe(false);
		await expect(
			controls.getByRole("button", { name: "Maximise" }),
		).toBeVisible();
	});
});

// Closing the last window quits on Linux and Windows, and goes through the quit rule first (P1b ruling 11): with no
// job or session running, the rule lets it go on at once. The prompt for a running job is Task 18's test (the
// About job). macOS keeps its convention: closing the window does not quit.
test("closing the window with nothing running quits the app at once", async () => {
	test.skip(
		process.platform === "darwin",
		"macOS keeps the app open when its window closes",
	);
	await withStudio(async ({ app, page }) => {
		await expect(appVersion(page)).not.toBeEmpty();
		const exited = new Promise<number | null>((resolve) =>
			app.process().once("exit", (code) => resolve(code)),
		);
		const close = page
			.getByRole("group", { name: "Window controls" })
			.getByRole("button", { name: "Close" });
		// The page goes away with the window, so the click may not see its own end.
		await close.click().catch(() => {});
		expect(await exited).toBe(0);
	});
});

test("makes no network request (Chromium requests only; Node networking in main is not covered)", async () => {
	await withStudio(async ({ app, page }) => {
		await expect(appVersion(page)).not.toBeEmpty();
		await chooseTheme(page, "Dark");
		await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
		// Fonts and the rest of the page have loaded.
		await page.evaluate(() => document.fonts.ready.then(() => undefined));
		// Read last, after everything the page does at start and on a theme switch.
		expect(await cancelledRequests(app)).toEqual({ count: 0, urls: [] });
	});
});

// A font the CSP blocks never reaches the request gate, so a zero count alone would not catch it: this test
// records `securitypolicyviolation` events from the first script on, and checks where the loaded faces' files are
// declared (their @font-face sources, resolved) and, when resource timing records them, where they were fetched.
test("uses the bundled fonts (UI, heading, mono), loaded from app:// with no CSP violation", async () => {
	await withStudio(async ({ app, page }) => {
		// The window loaded before the test could add a listener: add it as an init script, then load again.
		await page.addInitScript(() => {
			const w = window as unknown as { __cspViolations: string[] };
			w.__cspViolations = [];
			document.addEventListener("securitypolicyviolation", (event) => {
				w.__cspViolations.push(
					`${event.effectiveDirective} ${event.blockedURI}`,
				);
			});
		});
		// From the root (it redirects to `#/canvas`). Resource timing is not dependable here: in Electron 45 some
		// loads record no resource entry at all (not even the script's), so the sources come from the CSS.
		await page.goto("app://studio/");
		await expect(appVersion(page)).not.toBeEmpty();
		const fonts = await page.evaluate(async () => {
			// Each family token in the shell: body text (Inter), a tab's empty-state heading (Archivo), the
			// version number in the status bar (JetBrains Mono, tabular figures).
			const samples = {
				ui: document.querySelector("main"),
				heading: document.querySelector("main h2"),
				mono: document.querySelector('[data-slot="app-version-number"]'),
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
			// Where each loaded family's files are declared: the @font-face `src` URLs, resolved against their
			// stylesheet (the bundled CSS on app://).
			const families = new Set(loaded.map((face) => face.family));
			const sources: string[] = [];
			for (const sheet of document.styleSheets) {
				for (const rule of sheet.cssRules) {
					if (!(rule instanceof CSSFontFaceRule)) continue;
					const family = rule.style
						.getPropertyValue("font-family")
						.replace(/["']/g, "");
					if (!families.has(family)) continue;
					const src = rule.style.getPropertyValue("src");
					for (const m of src.matchAll(/url\(["']?([^"')]+)["']?\)/g))
						sources.push(new URL(m[1] ?? "", sheet.href ?? location.href).href);
				}
			}
			return {
				used,
				loaded,
				sources,
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
		// Every file the loaded faces can come from is a bundled asset on app://. Resource timing, when it records
		// the fetches (not on every load in Electron 45), must agree.
		for (const family of ["inter", "archivo", "jetbrains-mono"])
			expect(
				fonts.sources.some((src) => src.includes(`/assets/${family}-`)),
			).toBe(true);
		for (const file of [...fonts.sources, ...fonts.files]) {
			expect(file).toMatch(
				/^app:\/\/studio\/assets\/(inter|archivo|jetbrains-mono)-[^/]+\.woff2?$/,
			);
		}
		expect(fonts.violations).toEqual([]);
		expect(await cancelledRequests(app)).toEqual({ count: 0, urls: [] });
	});
});

test("the request gate counts a refused request (so a zero count means something)", async () => {
	await withStudio(async ({ app, page }) => {
		await expect(appVersion(page)).not.toBeEmpty();
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
