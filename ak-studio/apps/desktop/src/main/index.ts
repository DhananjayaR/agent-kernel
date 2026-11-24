// Electron main process: one window serving the renderer from app://studio/, with the security baseline.
// The only file in src/main that imports Electron values; the others take Electron objects as arguments.
import { join } from "node:path";
import { app, BrowserWindow, Menu, protocol, screen, session } from "electron";
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
	resolveDevServerUrl,
} from "./security";
import {
	clampWindowState,
	MIN_SIZE,
	persistWindowState,
	readWindowState,
	WINDOW_STATE_FILE,
} from "./window";

/**
 * Read-only hooks for the Electron smoke test (Task 7), read with Playwright's `electronApp.evaluate`. Present
 * only in unpackaged builds started with AK_STUDIO_TEST_HOOKS=1.
 */
export interface StudioTestHooks {
	cancelledRequestCount(): number;
	cancelledRequestUrls(): readonly string[];
}
declare global {
	var __akStudioTestHooks: StudioTestHooks | undefined;
}

// The electron-vite dev server: trusted only in unpackaged builds, and only on a loopback host.
let devServerUrl: string | undefined;
let startupError: string | undefined;
try {
	devServerUrl = resolveDevServerUrl(
		app.isPackaged,
		process.env.ELECTRON_RENDERER_URL,
	);
} catch (err) {
	startupError = err instanceof Error ? err.message : String(err);
}

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

let mainWindow: BrowserWindow | null = null;

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
		title: "Agent Kernel Studio",
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
			devTools: !app.isPackaged,
		},
	});
	win.once("ready-to-show", () => {
		if (state.isMaximized) win.maximize();
		win.show();
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
					isPackaged: app.isPackaged,
				}),
			),
		);
		if (!app.isPackaged && process.env.AK_STUDIO_TEST_HOOKS === "1") {
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
