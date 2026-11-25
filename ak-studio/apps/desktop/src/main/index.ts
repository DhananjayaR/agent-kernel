// Electron main process: one window serving the renderer from app://studio/, with the security baseline.
// The only file in src/main that imports Electron values; the others take Electron objects as arguments.
import { join } from "node:path";
import {
	app,
	BrowserWindow,
	ipcMain,
	Menu,
	nativeTheme,
	protocol,
	screen,
	session,
	type WebContents,
} from "electron";
import { BridgeServer, trustedOrigins } from "./bridge/ipcServer";
import { ServiceRegistry } from "./bridge/registry";
import { buildMenuTemplate } from "./menu";
import { createAppProtocolHandler } from "./protocol";
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
import { registerServices } from "./services/registerServices";
import {
	clampWindowState,
	MIN_SIZE,
	persistWindowState,
	readWindowState,
	WINDOW_STATE_FILE,
	windowBackground,
} from "./window";

/**
 * Read-only hooks for the Electron smoke test (Task 7), read with Playwright's `electronApp.evaluate`. Present
 * only in development and e2e builds (`__STUDIO_DEV__`), run unpackaged, started with AK_STUDIO_TEST_HOOKS=1.
 */
export interface StudioTestHooks {
	cancelledRequestCount(): number;
	cancelledRequestUrls(): readonly string[];
}
declare global {
	var __akStudioTestHooks: StudioTestHooks | undefined;
}

// A release build: packaged (checked at run time), or a production build (`__STUDIO_DEV__` false, set at build
// time). Either check alone makes it one, so a packaged app that `app.isPackaged` misjudges still counts.
const releaseBuild = app.isPackaged || !__STUDIO_DEV__;

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
	const registry = new ServiceRegistry();
	const services = registerServices(registry, {
		window: () => mainWindow,
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
	nativeTheme.themeSource = services.app.theme;
	registry.start();
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
		if (
			__STUDIO_DEV__ &&
			!app.isPackaged &&
			process.env.AK_STUDIO_TEST_HOOKS === "1"
		) {
			globalThis.__akStudioTestHooks = {
				cancelledRequestCount: () => gate.cancelledCount,
				cancelledRequestUrls: () => gate.cancelledUrls,
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
