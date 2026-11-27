// Electron end-to-end tests: the built, unpackaged app (apps/desktop/out/, from `pnpm build:e2e`) with the real main
// process. Started with AK_STUDIO_TEST_HOOKS=1 so main exposes its test hooks (the request gate's counter, and the
// test job kind that survives quit), and with a fresh --user-data-dir per test. Production and packaged builds have
// no hooks, and packaged builds lack the --inspect support Playwright needs. Main's native dialogs are stubbed in
// every test (stubDialogs). The About slice (P1b Task 18) runs here through every shape, as in the browser, plus
// what only the real main process has: reattach after a reload, the quit rule, a crash's interrupted job, and the
// 10,000-line burst's frame times.
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
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
import {
	checkInfo,
	checkJobApproved,
	checkJobCancelled,
	checkJobDenied,
	checkNoteStaleWrite,
	checkPaletteRunsDemoJob,
	checkTicker,
	newestJob,
	openAbout,
	STEP_TIMEOUT,
	section,
} from "./aboutSteps";

/** Main's test hooks (apps/desktop/src/main/index.ts, StudioTestHooks). */
interface StudioTestHooks {
	cancelledRequestCount(): number;
	cancelledRequestUrls(): readonly string[];
	startSurvivingJob(): string;
	finishSurvivingJobs(): void;
}
type WithHooks = { __akStudioTestHooks?: StudioTestHooks };

interface Studio {
	app: ElectronApplication;
	page: Page;
}

/** Launches the built app with test hooks on, on `userDataDir`; the caller closes it (or kills it). */
async function launchStudio(userDataDir: string): Promise<Studio> {
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
	const app = await electron.launch({
		executablePath,
		args: [desktopDir, `--user-data-dir=${userDataDir}`],
		cwd: desktopDir,
		env,
		// No emulation (null is Playwright's "no override"): prefers-color-scheme comes from Electron's
		// nativeTheme, which follows the stored preference.
		colorScheme: null,
	});
	try {
		await stubDialogs(app);
		return { app, page: await app.firstWindow() };
	} catch (err) {
		// The caller never gets the app: close it here, so it does not outlive its data folder.
		await app.close().catch(() => {});
		throw err;
	}
}

/**
 * Launches the built app, runs `body`, then closes the app. With no `userDataDir` it uses a fresh data folder and
 * removes it afterwards, even if the launch, the body or `app.close()` throws; removal retries, since on Windows the
 * app's child processes can hold files for a moment after close. A caller that passes `userDataDir` (a restart
 * test) owns the folder. Main's native dialogs are stubbed (stubDialogs): a test that leaves a job running or a note
 * unsaved still closes, as the stub lets the quit go on.
 */
async function withStudio(
	body: (studio: Studio) => Promise<void>,
	options: { userDataDir?: string } = {},
) {
	const ownFolder = options.userDataDir === undefined;
	let userDataDir = options.userDataDir;
	let studio: Studio | undefined;
	try {
		userDataDir ??= mkdtempSync(join(tmpdir(), "ak-studio-e2e-"));
		studio = await launchStudio(userDataDir);
		await body(studio);
	} finally {
		try {
			await studio?.app.close();
		} finally {
			if (ownFolder && userDataDir) removeFolder(userDataDir);
		}
	}
}

/** A native message box main showed, as the stub recorded it. */
interface DialogCall {
	message: string;
	buttons: string[];
	answer: string;
}
type WithDialogStub = {
	__dialogCalls?: DialogCall[];
	__dialogAnswers?: string[];
};

/**
 * Replaces main's native message boxes (the quit and unload prompts, P1b ruling 11) with a stub that records each
 * call and answers by button label: the next label queued with `answerDialogs`, else the one that lets the quit or
 * unload go on. A real dialog would wait for a person and hang the test.
 */
async function stubDialogs(app: ElectronApplication): Promise<void> {
	await app.evaluate(({ dialog }) => {
		const g = globalThis as WithDialogStub;
		g.__dialogCalls = [];
		g.__dialogAnswers = [];
		const goOn = [
			"Quit without saving",
			"Cancel jobs and quit",
			"Quit anyway",
			"Leave",
		];
		type Options = { message: string; buttons?: string[]; cancelId?: number };
		const answer = (first: unknown, second?: unknown): number => {
			const options = (second ?? first) as Options;
			const buttons = options.buttons ?? [];
			const wanted =
				g.__dialogAnswers?.shift() ??
				buttons.find((label) => goOn.includes(label));
			const index = wanted === undefined ? -1 : buttons.indexOf(wanted);
			const chosen = index >= 0 ? index : (options.cancelId ?? 0);
			g.__dialogCalls?.push({
				message: options.message,
				buttons,
				answer: buttons[chosen] ?? "",
			});
			return chosen;
		};
		const stub = dialog as unknown as {
			showMessageBox: (a: unknown, b?: unknown) => Promise<unknown>;
			showMessageBoxSync: (a: unknown, b?: unknown) => number;
		};
		stub.showMessageBox = async (a, b) => ({
			response: answer(a, b),
			checkboxChecked: false,
		});
		stub.showMessageBoxSync = (a, b) => answer(a, b);
	});
}

/** Queues the labels the stubbed dialogs answer next, in order. */
function answerDialogs(app: ElectronApplication, labels: string[]) {
	return app.evaluate((_electron, queued) => {
		(globalThis as WithDialogStub).__dialogAnswers = [...queued];
	}, labels);
}

/** The dialogs main has shown so far. */
function dialogCalls(app: ElectronApplication): Promise<DialogCall[]> {
	return app.evaluate(() => [
		...((globalThis as WithDialogStub).__dialogCalls ?? []),
	]);
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
		// The five product tabs, then About's temporary one (it goes with the About feature when P2 lands).
		await expect(
			page.getByRole("tablist", { name: "Project views" }).getByRole("tab"),
		).toHaveText([...tabs.map(([name]) => name), "About"]);
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

// ---- The About slice (P1b Task 18) on the real main process ----

/** Starts a job of main's test kind (testJobs.ts): it survives quit, so it blocks one until it finishes. */
function startSurvivingJob(app: ElectronApplication): Promise<string> {
	return app.evaluate(() => {
		const hooks = (globalThis as WithHooks).__akStudioTestHooks;
		if (!hooks) throw new Error("test hooks missing");
		return hooks.startSurvivingJob();
	});
}

function finishSurvivingJobs(app: ElectronApplication): Promise<void> {
	return app.evaluate(() => {
		(globalThis as WithHooks).__akStudioTestHooks?.finishSurvivingJobs();
	});
}

/** Asks main to quit (as the menu, Cmd+Q or the OS would): the quit rule decides. */
function requestQuit(app: ElectronApplication): Promise<void> {
	return app.evaluate(({ app }) => {
		app.quit();
	});
}

/** Resolves with the exit code once the app's main process has exited. */
function exited(app: ElectronApplication): Promise<number | null> {
	const child = app.process();
	if (child.exitCode !== null) return Promise.resolve(child.exitCode);
	return new Promise((resolve) => child.once("exit", (code) => resolve(code)));
}

/** Starts the demo job on the About screen and waits for its question (it then waits there indefinitely). */
async function parkDemoJobAtQuestion(page: Page): Promise<void> {
	await section(page, "Jobs")
		.getByRole("button", { name: "Run the demo job" })
		.click();
	await expect(
		newestJob(page).getByRole("region", { name: "Run the last step?" }),
	).toBeVisible({ timeout: STEP_TIMEOUT });
}

/** The crash records main has on disk (`<userData>/jobs/*.json`, NodeJobRecordStore). */
function jobRecords(dir: string): string[] {
	try {
		return readdirSync(join(dir, "jobs")).filter((name) =>
			name.endsWith(".json"),
		);
	} catch {
		return [];
	}
}

test("the About screen works through every shape on the real main process", async () => {
	await withStudio(async ({ app, page }) => {
		const version = await app.evaluate(({ app }) => app.getVersion());
		await openAbout(page);
		expect(page.url()).toBe("app://studio/#/about");
		await checkInfo(page, version, process.platform);
		await checkNoteStaleWrite(page);
		await checkJobApproved(page);
		await checkJobDenied(page);
		await checkJobCancelled(page);
		await checkTicker(page);
		await checkPaletteRunsDemoJob(page);
	});
});

test("a reload mid-job reattaches to the job and its stream: the lines continue and the question is still answerable", async () => {
	await withStudio(async ({ page }) => {
		await openAbout(page);
		const output = () =>
			section(page, "Jobs").getByRole("region", { name: "Demo job output" });
		await section(page, "Jobs")
			.getByRole("button", { name: "Run the demo job" })
			.click();
		await expect(
			output().getByText("Step 1 of 3: Checking the app"),
		).toBeVisible();
		await page.reload();
		await expect(
			page.getByRole("heading", { name: "About", level: 2 }),
		).toBeVisible();
		// The same job, from `jobs.list`, and its stream's backlog; then the lines go on to the question.
		const job = newestJob(page);
		await expect(job).toHaveAttribute("data-state", /running|waiting/);
		await expect(
			output().getByText("Step 1 of 3: Checking the app"),
		).toBeVisible();
		const card = job.getByRole("region", { name: "Run the last step?" });
		await expect(card).toBeVisible({ timeout: STEP_TIMEOUT });
		await expect(
			output().getByText("Step 2 of 3: Preparing the demo"),
		).toBeVisible();
		await card.getByRole("button", { name: "Run the last step" }).click();
		await expect(job).toHaveAttribute("data-state", "succeeded", {
			timeout: STEP_TIMEOUT,
		});
		await expect(
			output().getByText("Step 3 of 3: Finishing the demo"),
		).toBeVisible();
	});
});

test("quitting with the demo job running asks first: Keep working stays, Cancel jobs and quit exits", async () => {
	await withStudio(async ({ app, page }) => {
		await openAbout(page);
		await parkDemoJobAtQuestion(page);
		await answerDialogs(app, ["Keep working"]);
		await requestQuit(app);
		await expect.poll(() => dialogCalls(app)).toHaveLength(1);
		expect((await dialogCalls(app))[0]).toEqual({
			message: "Quit and cancel 1 job?",
			buttons: ["Cancel jobs and quit", "Keep working"],
			answer: "Keep working",
		});
		// Still here, the job still waiting for its answer.
		await page.waitForTimeout(500);
		expect(app.process().exitCode).toBeNull();
		await expect(newestJob(page)).toHaveAttribute("data-state", "waiting");

		const exit = exited(app);
		await answerDialogs(app, ["Cancel jobs and quit"]);
		await requestQuit(app);
		expect(await exit).toBe(0);
	});
});

test("a started job that survives quit blocks it: the dialog offers Wait, and Wait keeps the app open", async () => {
	await withStudio(async ({ app, page }) => {
		await expect(appVersion(page)).not.toBeEmpty();
		await startSurvivingJob(app);
		await answerDialogs(app, ["Wait"]);
		await requestQuit(app);
		await expect.poll(() => dialogCalls(app)).toHaveLength(1);
		const [call] = await dialogCalls(app);
		expect(call?.message).toBe("1 job must finish before the app can quit");
		expect(call?.buttons).toEqual(["Wait", "Quit anyway"]);
		expect(call?.answer).toBe("Wait");
		// Wait only keeps the app open.
		await page.waitForTimeout(500);
		expect(app.process().exitCode).toBeNull();
		await expect(appVersion(page)).not.toBeEmpty();
		// Once the job has finished, quitting asks nothing: were it still asked, "Wait" would keep the app open.
		await finishSurvivingJobs(app);
		const exit = exited(app);
		await answerDialogs(app, ["Wait"]);
		await requestQuit(app);
		expect(await exit).toBe(0);
	});
});

test("quitting with an unsaved note and a running job asks about the unsaved work first, then the job", async () => {
	await withStudio(async ({ app, page }) => {
		await openAbout(page);
		const field = section(page, "Note").getByRole("textbox", {
			name: "Note",
		});
		await expect(field).toBeEnabled();
		await field.fill("Not saved yet");
		await parkDemoJobAtQuestion(page);
		// Quit without saving, then keep working when asked about the job: both questions, in order, and the app
		// stays.
		await answerDialogs(app, ["Quit without saving", "Keep working"]);
		await requestQuit(app);
		await expect.poll(() => dialogCalls(app)).toHaveLength(2);
		const [unsaved, jobs] = await dialogCalls(app);
		expect(unsaved).toEqual({
			message: "Quit without saving?",
			buttons: ["Quit without saving", "Stay"],
			answer: "Quit without saving",
		});
		expect(unsaved && jobs && [jobs.message, jobs.answer]).toEqual([
			"Quit and cancel 1 job?",
			"Keep working",
		]);
		await page.waitForTimeout(500);
		expect(app.process().exitCode).toBeNull();
		await expect(field).toHaveValue("Not saved yet");

		// Answered the same way to leave: it quits, with no unload question after "Quit without saving" (were the
		// window's unload asked, the queued "Stay" would keep it open).
		const exit = exited(app);
		await answerDialogs(app, [
			"Quit without saving",
			"Cancel jobs and quit",
			"Stay",
		]);
		await requestQuit(app);
		expect(await exit).toBe(0);
	});
});

test("killing the app mid-job shows the job as interrupted on the next launch; Dismiss removes its record", async () => {
	await withDataFolder(async (dir) => {
		const first = await launchStudio(dir);
		const exit = exited(first.app);
		try {
			await openAbout(first.page);
			await section(first.page, "Jobs")
				.getByRole("button", { name: "Run the demo job" })
				.click();
			await expect(newestJob(first.page)).toHaveAttribute(
				"data-state",
				"running",
			);
			// The job's start record is on disk before the kill.
			await expect.poll(() => jobRecords(dir)).toHaveLength(1);
		} finally {
			const pid = first.app.process().pid;
			if (pid !== undefined) process.kill(pid, "SIGKILL");
		}
		expect(await exit).toBeNull();
		expect(jobRecords(dir)).toHaveLength(1);

		await withStudio(
			async ({ page }) => {
				await openAbout(page);
				const notice = page
					.locator('[data-slot="inline-banner"]')
					.filter({ hasText: "Demo job was interrupted" });
				await expect(notice).toBeVisible();
				await expect(notice).toContainText(
					"The app closed while it ran, so it did not finish.",
				);
				// This run has no such job: nothing is running.
				await expect(newestJob(page)).toHaveCount(0);
				await notice.getByRole("button", { name: "Dismiss" }).click();
				await expect(notice).toBeHidden();
				await expect.poll(() => jobRecords(dir)).toEqual([]);
			},
			{ userDataDir: dir },
		);
	});
});

test("a 10,000-line burst on the ticker keeps the window responsive, and the list shows its last line", async () => {
	await withStudio(async ({ page }) => {
		await openAbout(page);
		const ticker = section(page, "Ticker");
		const burst = ticker.getByRole("switch", {
			name: "Write 10,000 lines at once after the first tick",
		});
		// The switch's input is visually hidden: press its label, as a person would.
		await ticker
			.getByText("Write 10,000 lines at once after the first tick")
			.click();
		await expect(burst).toBeChecked();
		// Frame times from before the start: the burst lands after the first tick, a second in.
		await page.evaluate(() => {
			const w = window as unknown as {
				__frames: number[];
				__sampling: boolean;
			};
			w.__frames = [];
			w.__sampling = true;
			let last = performance.now();
			const sample = (now: number) => {
				w.__frames.push(now - last);
				last = now;
				if (w.__sampling) requestAnimationFrame(sample);
			};
			requestAnimationFrame(sample);
		});
		await ticker.getByRole("button", { name: "Start" }).click();
		const output = ticker.getByRole("region", { name: "Ticker output" });
		// The list follows the end: the burst's last line (the stream keeps the newest 5,000), then the ticks.
		await expect(output.getByText("Burst line 10000 of 10000")).toBeVisible({
			timeout: STEP_TIMEOUT,
		});
		await page.waitForTimeout(500);
		const frames = await page.evaluate(() => {
			const w = window as unknown as {
				__frames: number[];
				__sampling: boolean;
			};
			w.__sampling = false;
			return w.__frames.slice(1);
		});
		const sorted = [...frames].sort((a, b) => a - b);
		const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
		const longest = sorted[sorted.length - 1] ?? 0;
		const measured = `${frames.length} frames, median ${median.toFixed(1)} ms, longest ${longest.toFixed(1)} ms`;
		console.log(`[burst] ${measured}`);
		test
			.info()
			.annotations.push({ type: "burst frame times", description: measured });
		// At least a second and a half of frames was sampled (so a stalled rAF cannot pass), with no frame gap long
		// enough to feel frozen.
		expect(frames.length).toBeGreaterThan(30);
		expect(longest).toBeLessThan(200);
		expect(median).toBeLessThan(50);
		await ticker.getByRole("button", { name: "Stop" }).click();
		await expect(ticker.getByRole("button", { name: "Start" })).toBeVisible();
	});
});
