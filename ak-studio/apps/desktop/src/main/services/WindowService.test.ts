import {
	EventBus,
	InMemoryJobRecordStore,
	JobService,
	ProjectScopes,
	SecretMasker,
	ServiceRegistry,
	SessionService,
	StreamHub,
} from "@ak-studio/runtime";
import { describe, expect, it, vi } from "vitest";
import { type ControlledWindow, WindowService } from "./WindowService";

type Listener = () => void;

/** A fake window: records calls, keeps its maximised flag and its listeners. */
function fakeWindow(maximized = false) {
	const listeners = new Map<string, Set<Listener>>();
	const win = {
		maximized,
		minimize: vi.fn(),
		maximize: vi.fn(() => {
			win.maximized = true;
			fire("maximize");
		}),
		unmaximize: vi.fn(() => {
			win.maximized = false;
			fire("unmaximize");
		}),
		isMaximized: () => win.maximized,
		close: vi.fn(),
		on: vi.fn((event: string, l: Listener) => {
			if (!listeners.has(event)) listeners.set(event, new Set());
			listeners.get(event)?.add(l);
		}),
		removeListener: vi.fn((event: string, l: Listener) => {
			listeners.get(event)?.delete(l);
		}),
	};
	function fire(event: string) {
		for (const l of [...(listeners.get(event) ?? [])]) l();
	}
	const count = () =>
		[...listeners.values()].reduce((n, set) => n + set.size, 0);
	return { win: win satisfies ControlledWindow, count };
}

describe("WindowService", () => {
	it("minimises and closes the window, and answers an empty object", () => {
		const { win } = fakeWindow();
		const service = new WindowService(() => win);
		expect(service.minimize()).toEqual({});
		expect(service.close()).toEqual({});
		expect(win.minimize).toHaveBeenCalledOnce();
		expect(win.close).toHaveBeenCalledOnce();
	});

	it("maximises a normal window and restores a maximised one", () => {
		const { win } = fakeWindow(false);
		const service = new WindowService(() => win);
		expect(service.toggleMaximize()).toEqual({ maximized: true });
		expect(win.maximize).toHaveBeenCalledOnce();
		expect(service.toggleMaximize()).toEqual({ maximized: false });
		expect(win.unmaximize).toHaveBeenCalledOnce();
	});

	it("emits the current state at once, then on each change, then stops on unsubscribe", () => {
		const { win, count } = fakeWindow(true);
		const service = new WindowService(() => win);
		const events: boolean[] = [];
		const stop = service.watch((e) => events.push(e.maximized));
		expect(events).toEqual([true]);
		expect(count()).toBe(2);
		win.unmaximize();
		win.maximize();
		expect(events).toEqual([true, false, true]);
		stop();
		expect(count()).toBe(0);
		win.unmaximize();
		expect(events).toEqual([true, false, true]);
	});

	it("does nothing and answers normally with no window", () => {
		const service = new WindowService(() => null);
		expect(service.minimize()).toEqual({});
		expect(service.close()).toEqual({});
		expect(service.toggleMaximize()).toEqual({ maximized: false });
		const events: boolean[] = [];
		const stop = service.watch((e) => events.push(e.maximized));
		expect(events).toEqual([false]);
		expect(() => stop()).not.toThrow();
	});

	it("follows the window that exists when the call arrives", () => {
		let current: ControlledWindow | null = null;
		const service = new WindowService(() => current);
		expect(service.toggleMaximize()).toEqual({ maximized: false });
		const { win } = fakeWindow();
		current = win;
		expect(service.toggleMaximize()).toEqual({ maximized: true });
	});

	it("registers its three requests and its stream with the registry", async () => {
		const { win } = fakeWindow();
		const masker = new SecretMasker();
		const events = new EventBus({ masker });
		const streams = new StreamHub({ masker });
		const scopes = new ProjectScopes({ masker });
		const registry = new ServiceRegistry({ masker });
		registry
			.register(new WindowService(() => win))
			.register(events)
			.register(streams)
			.register(
				new JobService({
					events,
					streams,
					scopes,
					records: new InMemoryJobRecordStore(),
					masker,
				}),
			)
			.register(new SessionService({ events, streams, scopes, masker }));
		// The app's own requests are AppService's; the features' are their services'.
		expect(
			registry.missingHandlers().filter((name) => /^(app|window)\./.test(name)),
		).toEqual(["app.info", "app.setLayout", "app.setTheme", "app.setUnsaved"]);
	});
});
