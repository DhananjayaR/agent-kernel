// Electron main process: one window serving the renderer from app://studio/, with the security baseline, and the
// native quit and unload prompts (P1b ruling 11; their logic is in quit.ts).
// The only file in src/main that imports Electron values; the others take Electron objects as arguments.
import { join } from "node:path";
import { type Log, ServiceRegistry } from "@ak-studio/runtime";
import {
	app,
	BrowserWindow,
	dialog,
	ipcMain,
	Menu,
	nativeTheme,
	protocol,
	screen,
	session,
	type WebContents,
} from "electron";
import { BridgeServer, trustedOrigins } from "./bridge/ipcServer";
import { JOB_RECORDS_FOLDER } from "./infra/NodeJobRecordStore";
import { buildMenuTemplate } from "./menu";
import { createAppProtocolHandler } from "./protocol";
import { confirmUnload, type PromptDialog, QuitGate } from "./quit";
import {
	APP_SCHEME,
	APP_URL,
	buildCsp,
	denyAllPermissions,
	hardenWebContents,
	installDevCspHeader,
	installRequestGate,
	RequestGate,
	refusedPackagedSwitch,
	resolveDevServerUrl,
} from "./security";
import { PREFERENCES_FILE } from "./services/AppService";
import { registerServices, type Services } from "./services/registerServices";
import { defineTestJobs, type TestJobs, testJobKinds } from "./testJobs";
import {
	clampWindowState,
	MIN_SIZE,
	persistWindowState,
	readWindowState,
	WINDOW_STATE_FILE,
	windowBackground,
} from "./window";

/**
 * Hooks for the Electron e2e (tests/e2e/electron.spec.ts), called with Playwright's `electronApp.evaluate`. Present
 * only in development and e2e builds (`__STUDIO_DEV__`), run unpackaged, started with AK_STUDIO_TEST_HOOKS=1. The
 * request gate's counter is read-only; the test job kind (testJobs.ts, a job that survives quit) is started and
 * finished here, as no operation in the contract can start it.
 */
export interface StudioTestHooks extends TestJobs {
	cancelledRequestCount(): number;
	cancelledRequestUrls(): readonly string[];
}
declare global {
	var __akStudioTestHooks: StudioTestHooks | undefined;
}

// A release build: packaged (checked at run time), or a production build (`__STUDIO_DEV__` false, set at build
// time). Either check alone makes it one, so a packaged app that `app.isPackaged` misjudges still counts.
const releaseBuild = app.isPackaged || !__STUDIO_DEV__;

// The e2e test hooks: compiled out of the production build (`__STUDIO_DEV__` false, so this folds to false and every
// branch that tests it with `__STUDIO_DEV__` goes), refused at run time when packaged, and off unless asked for.
const testHooksOn =
	__STUDIO_DEV__ && !app.isPackaged && process.env.AK_STUDIO_TEST_HOOKS === "1";

// A release build refuses the remote-debugging switches (the DevTools protocol, unauthenticated; no fuse covers
// it). Checked first and synchronously, so the app exits (below, before the single-instance lock) before
// Chromium opens the port.
let startupError: string | undefined;
const refusedSwitch = refusedPackagedSwitch(releaseBuild, (name) =>
	app.commandLine.hasSwitch(name),
);
if (refusedSwitch) {
	startupError = `--${refusedSwitch} is not accepted by a packaged or production build`;
}

// The electron-vite dev server: trusted only in development and e2e builds (`__STUDIO_DEV__`, set at build time,
// so the production bundle holds no dev-server path), run unpackaged, and only on a loopback host.
let devServerUrl: string | undefined;
if (__STUDIO_DEV__ && !startupError) {
	try {
		devServerUrl = resolveDevServerUrl(
			app.isPackaged,
			process.env.ELECTRON_RENDERER_URL,
		);
	} catch (err) {
		startupError = err instanceof Error ? err.message : String(err);
	}
}

// The app icon (build/icon.png, from the OAK mark), set on the window on Linux, where the window manager takes the
// window's own icon; macOS and Windows take the packaged app's icon. Packaged, it is in resources/
// (electron-builder.yml, extraResources), outside app.asar; unpackaged, it is read from apps/desktop/build/.
const windowIcon = app.isPackaged
	? join(process.resourcesPath, "icon.png")
	: join(import.meta.dirname, "../../build/icon.png");

// The product name is the full name, "Open Agent Kernel Studio" (productName): the window title, the installer,
// the data folder and the About panel use it (brand name rule, branding/README.md). Linux's About dialog shows
// applicationName, applicationVersion and the icon (`credits` is macOS and Windows only, so it is not used).
app.setAboutPanelOptions({
	applicationName: "Open Agent Kernel Studio",
	applicationVersion: app.getVersion(),
	iconPath: windowIcon,
});

// Unpackaged builds get their own name and data folder, so `pnpm dev` and an installed app share neither data
// nor the single-instance lock (which is keyed on the data folder). An explicit --user-data-dir still wins.
if (!app.isPackaged) {
	app.setName(`${app.getName()} (dev)`);
	if (!app.commandLine.hasSwitch("user-data-dir")) {
		app.setPath("userData", join(app.getPath("appData"), app.getName()));
	}
}
const rendererDir = join(import.meta.dirname, "../renderer");
const preloadPath = join(import.meta.dirname, "../preload/index.cjs");

// Both must happen before the app is ready.
protocol.registerSchemesAsPrivileged([
	{
		scheme: APP_SCHEME,
		privileges: { standard: true, secure: true, supportFetchAPI: true },
	},
]);
app.enableSandbox();

// The macOS traffic lights (about 52 px wide, 12 px high) centred in the 48 px top bar, 16 px from its left edge.
const TRAFFIC_LIGHTS = { x: 16, y: 18 };

let mainWindow: BrowserWindow | null = null;
/** The web contents of every window the app created: the only senders the bridge accepts. */
const appContents = new WeakSet<WebContents>();
/** Decides every quit (startBridge creates it); unset only if the bridge failed to start, and the app exits. */
let quitGate: QuitGate | undefined;
/** The registered services (startBridge creates them); the window clears the unsaved list when its page reloads. */
let services: Services | undefined;
/** The test job kind's controls, while the test hooks are on (startBridge defines it). */
let testJobs: TestJobs | undefined;

/** The main process's log: the registry, the services and the quit rule report here (masked where it matters). */
const log: Log = (message) => console.error(`[studio] ${message}`);

/** The native message box for the quit rule, on the app's window when there is one. Answers the button index. */
async function askQuit(prompt: PromptDialog): Promise<number> {
	const options = { ...prompt, noLink: true };
	const win = mainWindow;
	const { response } = await (win && !win.isDestroyed()
		? dialog.showMessageBox(win, options)
		: dialog.showMessageBox(options));
	return response;
}

function createWindow(): BrowserWindow {
	const stateFile = join(app.getPath("userData"), WINDOW_STATE_FILE);
	const primary = screen.getPrimaryDisplay();
	const workAreas = [
		primary,
		...screen.getAllDisplays().filter((d) => d.id !== primary.id),
	].map((d) => d.workArea);
	const state = clampWindowState(readWindowState(stateFile), workAreas);

	const win = new BrowserWindow({
		...(state.x !== undefined && state.y !== undefined
			? { x: state.x, y: state.y }
			: {}),
		width: state.width,
		height: state.height,
		minWidth: MIN_SIZE.width,
		minHeight: MIN_SIZE.height,
		show: false,
		title: "Open Agent Kernel Studio",
		// Custom window chrome: the renderer's top bar draws the window controls and is the drag region. Linux and
		// Windows have no system frame (so no menu bar either); macOS keeps its traffic lights, inset into the bar.
		...(process.platform === "darwin"
			? {
					titleBarStyle: "hidden" as const,
					trafficLightPosition: TRAFFIC_LIGHTS,
				}
			: { frame: false }),
		...(process.platform === "linux" ? { icon: windowIcon } : {}),
		// The stored theme is already applied (startBridge sets nativeTheme.themeSource first): no white flash.
		backgroundColor: windowBackground(nativeTheme.shouldUseDarkColors),
		webPreferences: {
			preload: preloadPath,
			contextIsolation: true,
			sandbox: true,
			nodeIntegration: false,
			webSecurity: true,
			allowRunningInsecureContent: false,
			webviewTag: false,
			// The spellchecker downloads dictionaries; the app makes no network calls.
			spellcheck: false,
			devTools: !releaseBuild,
		},
	});
	appContents.add(win.webContents);
	win.once("ready-to-show", () => {
		if (state.isMaximized) win.maximize();
		win.show();
		// One line on stdout: the packaged smoke check (tools/packaged-smoke.mjs) waits for it, and for
		// "[studio] bridge ready", since a packaged build cannot be driven by Playwright or CDP.
		console.log("[studio] window shown");
	});
	win.on("closed", () => {
		if (mainWindow === win) mainWindow = null;
	});
	// Closing the last window quits on Linux and Windows (window-all-closed, below), so the quit rule decides
	// first, while the window is still there to come back to. macOS keeps its convention: the app stays open.
	win.on("close", (event) => {
		if (process.platform === "darwin" || !quitGate) return;
		const others = BrowserWindow.getAllWindows().filter(
			(other) => other !== win && !other.isDestroyed(),
		);
		if (others.length > 0 || quitGate.request()) return;
		event.preventDefault();
	});
	// The renderer's beforeunload refused (unsaved changes, P1b Task 7): ask natively, so it works even when the
	// renderer is busy. preventDefault is what lets the unload go on, and only works synchronously. A quit whose
	// "Quit without saving" was already answered passes without a second question. Staying also cancels a quit in
	// progress, so the next quit is decided afresh.
	win.webContents.on("will-prevent-unload", (event) => {
		const leave =
			quitGate?.unsavedConfirmed === true ||
			confirmUnload((prompt) =>
				dialog.showMessageBoxSync(win, { ...prompt, noLink: true }),
			);
		if (leave) event.preventDefault();
		else quitGate?.aborted();
	});
	// A page that loads again (a reload) or a renderer that crashed has lost what it held unsaved: the quit rule
	// must not ask about it. The renderer reports anew as the person edits.
	win.webContents.on("did-navigate", () => services?.app.setUnsaved([]));
	win.webContents.on("render-process-gone", () => services?.app.setUnsaved([]));
	persistWindowState(win, stateFile);
	const url = devServerUrl ?? APP_URL;
	win.loadURL(url).catch((err: unknown) => {
		console.error(`[studio] could not load ${url}: ${String(err)}`);
	});
	return win;
}

/**
 * Registers every service against the contract and serves it over IPC. Throws if any declared operation has no
 * handler, so the app refuses to start.
 */
function startBridge(): void {
	// registerServices hands the registry's masker to the services, so errors and stream output share it, and
	// the registry's log, so every service reports to the same place.
	const registry = new ServiceRegistry({ log });
	const registered = registerServices(registry, {
		window: () => mainWindow,
		jobRecordsDir: join(app.getPath("userData"), JOB_RECORDS_FOLDER),
		log,
		...(__STUDIO_DEV__ && testHooksOn ? { jobKinds: testJobKinds() } : {}),
		app: {
			version: app.getVersion(),
			platform: process.platform,
			preferencesFile: join(app.getPath("userData"), PREFERENCES_FILE),
			onThemeChange: (theme) => {
				nativeTheme.themeSource = theme;
				syncWindowBackground();
			},
		},
	});
	services = registered;
	if (__STUDIO_DEV__ && testHooksOn) testJobs = defineTestJobs(registered.jobs);
	nativeTheme.themeSource = registered.app.theme;
	registry.start();
	quitGate = new QuitGate({
		jobs: registered.jobs,
		sessions: registered.sessions,
		// What the renderer last reported as unsaved: asked about before any job.
		unsaved: () => registered.app.unsaved,
		ask: askQuit,
		// Once allowed, this quit passes before-quit (the gate answers true) and closes the window.
		quit: () => app.quit(),
		// Its lines can carry an exception's text: masked like the services' lines.
		log: (message) => log(registered.masker.mask(message)),
	});
	new BridgeServer({
		registry,
		isAppContents: (contents) => appContents.has(contents),
		allowedOrigins: trustedOrigins(devServerUrl),
		// The renderer loaded from app:// (or the dev server), its preload works, and main answered it.
		onFirstAnswer: () => console.log("[studio] bridge ready"),
	}).install(ipcMain);
}

/** Keeps the window's background on the applied theme (a stored change, or the system's for `system`). */
function syncWindowBackground(): void {
	mainWindow?.setBackgroundColor(
		windowBackground(nativeTheme.shouldUseDarkColors),
	);
}

function focusMainWindow(): void {
	if (!mainWindow) return;
	if (mainWindow.isMinimized()) mainWindow.restore();
	mainWindow.show();
	mainWindow.focus();
}

function start(): void {
	// Every web contents, including any created later, refuses navigation (bar the dev server), new windows and
	// webviews.
	app.on("web-contents-created", (_event, contents) =>
		hardenWebContents(contents, devServerUrl),
	);
	app.on("second-instance", focusMainWindow);
	// Every quit (the menu, Cmd+Q, the OS, app.quit) goes through the quit rule: with jobs or sessions running it is
	// stopped here and the gate quits again once it may.
	app.on("before-quit", (event) => {
		if (!quitGate || quitGate.request()) return;
		event.preventDefault();
	});
	nativeTheme.on("updated", syncWindowBackground);

	void app.whenReady().then(() => {
		const ses = session.defaultSession;
		const csp = buildCsp(devServerUrl);
		const gate = new RequestGate(devServerUrl);
		denyAllPermissions(ses);
		installRequestGate(ses, gate);
		if (devServerUrl) installDevCspHeader(ses, csp);
		protocol.handle(APP_SCHEME, createAppProtocolHandler(rendererDir, csp));
		Menu.setApplicationMenu(
			Menu.buildFromTemplate(
				buildMenuTemplate({
					platform: process.platform,
					isPackaged: releaseBuild,
				}),
			),
		);
		try {
			startBridge();
		} catch (err) {
			console.error(`[studio] refusing to start: ${String(err)}`);
			app.exit(1);
			return;
		}
		// Compiled out of the production build (`__STUDIO_DEV__` false); refused at run time when packaged.
		if (__STUDIO_DEV__ && testHooksOn && testJobs) {
			globalThis.__akStudioTestHooks = {
				cancelledRequestCount: () => gate.cancelledCount,
				cancelledRequestUrls: () => gate.cancelledUrls,
				...testJobs,
			};
		}

		mainWindow = createWindow();
		app.on("activate", () => {
			if (BrowserWindow.getAllWindows().length === 0)
				mainWindow = createWindow();
		});
	});

	app.on("window-all-closed", () => {
		if (process.platform !== "darwin") app.quit();
	});
}

if (startupError) {
	console.error(`[studio] refusing to start: ${startupError}`);
	app.exit(1);
} else if (app.requestSingleInstanceLock()) {
	// One instance: a second launch hands over to the first (which focuses its window) and exits.
	start();
} else {
	app.quit();
}
