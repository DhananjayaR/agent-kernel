// WindowService: minimise, maximise or restore, and close the app's window from the renderer's own window controls
// (the window has no system title bar on Linux and Windows), and report when it is maximised.
// No Electron import: it works on a small structural view of the window (`ControlledWindow`), and index.ts passes
// a function that answers the current BrowserWindow. With no window, requests do nothing and answer normally, and
// the stream reports not maximised.
import type { Service, ServiceRegistry } from "../bridge/registry";

/** The part of a BrowserWindow this service uses (Electron's BrowserWindow satisfies it). */
export interface ControlledWindow {
	minimize(): void;
	maximize(): void;
	unmaximize(): void;
	isMaximized(): boolean;
	close(): void;
	on(event: "maximize" | "unmaximize", listener: () => void): unknown;
	removeListener(
		event: "maximize" | "unmaximize",
		listener: () => void,
	): unknown;
}

export class WindowService implements Service {
	readonly #getWindow: () => ControlledWindow | null;

	constructor(getWindow: () => ControlledWindow | null) {
		this.#getWindow = getWindow;
	}

	minimize(): Record<string, never> {
		this.#getWindow()?.minimize();
		return {};
	}

	/** Maximises, or restores when already maximised; answers with the state it asked for. */
	toggleMaximize(): { maximized: boolean } {
		const win = this.#getWindow();
		if (!win) return { maximized: false };
		if (win.isMaximized()) {
			win.unmaximize();
			return { maximized: false };
		}
		win.maximize();
		return { maximized: true };
	}

	close(): Record<string, never> {
		this.#getWindow()?.close();
		return {};
	}

	/**
	 * Emits the current state at once, then on every maximise and unmaximise. Entering or leaving full screen is
	 * not reported: Electron's `maximize` and `unmaximize` events do not fire for it, so full screen shows as
	 * whatever the window was before. Answers the function that removes the listeners.
	 */
	watch(emit: (event: { maximized: boolean }) => void): () => void {
		const win = this.#getWindow();
		if (!win) {
			emit({ maximized: false });
			return () => {};
		}
		const onMaximize = () => emit({ maximized: true });
		const onUnmaximize = () => emit({ maximized: false });
		win.on("maximize", onMaximize);
		win.on("unmaximize", onUnmaximize);
		emit({ maximized: win.isMaximized() });
		return () => {
			win.removeListener("maximize", onMaximize);
			win.removeListener("unmaximize", onUnmaximize);
		};
	}

	register(registry: ServiceRegistry): void {
		registry
			.handle("window.minimize", () => this.minimize())
			.handle("window.toggleMaximize", () => this.toggleMaximize())
			.handle("window.close", () => this.close())
			.handleStream("window.state", (_input, emit) => this.watch(emit));
	}
}
