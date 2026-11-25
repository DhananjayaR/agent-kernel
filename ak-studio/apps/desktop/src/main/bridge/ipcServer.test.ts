import { EventEmitter } from "node:events";
import {
	defineOperation,
	defineStream,
	ERROR_CODES,
} from "@ak-studio/contract";
import type { IpcMain, IpcMainEvent, WebContents } from "electron";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { BRIDGE_CHANNELS } from "../../shared/channels";
import { APP_ORIGIN } from "../security";
import {
	BridgeServer,
	originOf,
	senderRefusal,
	trustedOrigins,
} from "./ipcServer";
import { ServiceRegistry } from "./registry";

// ---- Fakes: just enough of Electron's WebContents, WebFrameMain and ipcMain ----

class FakeContents extends EventEmitter {
	destroyed = false;
	readonly send = vi.fn();
	isDestroyed(): boolean {
		return this.destroyed;
	}
	destroy(): void {
		this.destroyed = true;
		this.emit("destroyed");
	}
}

interface FakeFrame {
	url: string;
	parent: FakeFrame | null;
}

const topFrame = (url = "app://studio/"): FakeFrame => ({ url, parent: null });

function fakeEvent(
	contents: FakeContents,
	frame: FakeFrame | null = topFrame(),
): IpcMainEvent {
	return { sender: contents, senderFrame: frame } as unknown as IpcMainEvent;
}

// ---- A registry over a test-local contract with one request and one stream ----

const echo = defineOperation({
	name: "t.echo",
	input: z.object({ text: z.string() }),
	output: z.object({ text: z.string() }),
});
const ticks = defineStream({
	name: "t.ticks",
	input: z.object({}),
	event: z.number(),
});

function setup(options: { devServerUrl?: string } = {}) {
	const emitters: Array<(n: number) => void> = [];
	const stops = vi.fn();
	const registry = new ServiceRegistry(
		{ operations: { "t.echo": echo }, streams: { "t.ticks": ticks } },
		() => {},
	);
	registry
		.handle("t.echo", (input) => input)
		.handleStream("t.ticks", (_input, emit) => {
			emitters.push(emit);
			return stops;
		});
	registry.start();
	const app = new FakeContents();
	const appContents = new Set<unknown>([app]);
	const log = vi.fn();
	const server = new BridgeServer({
		registry,
		isAppContents: (c) => appContents.has(c),
		allowedOrigins: trustedOrigins(options.devServerUrl),
		log,
	});
	return { server, app, appContents, emitters, stops, log };
}

describe("origins", () => {
	it("compares scheme and host, which works for the app: scheme", () => {
		expect(new URL("app://studio/").origin).toBe("null");
		expect(originOf("app://studio/index.html")).toBe(APP_ORIGIN);
		expect(originOf("http://localhost:5173/x")).toBe("http://localhost:5173");
		expect(originOf("about:blank")).toBeUndefined();
		expect(originOf("not a url")).toBeUndefined();
	});

	it("trusts the app origin, plus the dev server only when given", () => {
		expect(trustedOrigins()).toEqual([APP_ORIGIN]);
		expect(trustedOrigins("http://localhost:5173/")).toEqual([
			APP_ORIGIN,
			"http://localhost:5173",
		]);
	});
});

describe("senderRefusal", () => {
	const app = new FakeContents();
	const isApp = (c: WebContents) => (c as unknown) === app;
	const refuse = (event: IpcMainEvent) =>
		senderRefusal(event, isApp, [APP_ORIGIN]);

	it("accepts the top frame of an app window on app://studio", () => {
		expect(refuse(fakeEvent(app))).toBeUndefined();
	});

	it("refuses a missing frame, a subframe, a foreign window and a foreign origin", () => {
		expect(refuse(fakeEvent(app, null))).toMatch(/no sender frame/);
		expect(
			refuse(fakeEvent(app, { url: "app://studio/", parent: topFrame() })),
		).toMatch(/subframe/);
		expect(refuse(fakeEvent(new FakeContents()))).toMatch(/not one of/);
		for (const url of [
			"https://example.com/",
			"app://other/",
			"file:///index.html",
			"http://localhost:5173/",
			"about:blank",
		]) {
			expect(refuse(fakeEvent(app, topFrame(url)))).toMatch(/origin/);
		}
	});

	it("refuses when the frame throws on access (disposed)", () => {
		const frame = {
			parent: null,
			get url(): string {
				throw new Error("Render frame was disposed");
			},
		};
		expect(refuse(fakeEvent(app, frame as unknown as FakeFrame))).toMatch(
			/sender check failed/,
		);
	});
});

describe("BridgeServer requests", () => {
	it("answers a request from the app's window", async () => {
		const { server, app } = setup();
		await expect(
			server.request(fakeEvent(app), "t.echo", { text: "hi" }),
		).resolves.toEqual({ ok: true, value: { text: "hi" } });
	});

	it("rejects a request from a foreign frame with bridge.forbidden, as a value", async () => {
		const { server, app, log } = setup();
		const foreign = [
			fakeEvent(app, topFrame("https://evil.example/")),
			fakeEvent(app, { url: "app://studio/", parent: topFrame() }),
			fakeEvent(new FakeContents()),
			fakeEvent(app, null),
		];
		for (const event of foreign) {
			await expect(
				server.request(event, "t.echo", { text: "hi" }),
			).resolves.toMatchObject({
				ok: false,
				error: { code: ERROR_CODES.forbidden },
			});
		}
		expect(log).toHaveBeenCalledTimes(foreign.length);
	});

	it("accepts the dev server origin only when it is configured", async () => {
		const dev = "http://localhost:5173";
		const withDev = setup({ devServerUrl: `${dev}/` });
		await expect(
			withDev.server.request(
				fakeEvent(withDev.app, topFrame(`${dev}/`)),
				"t.echo",
				{
					text: "a",
				},
			),
		).resolves.toMatchObject({ ok: true });
		const without = setup();
		await expect(
			without.server.request(
				fakeEvent(without.app, topFrame(`${dev}/`)),
				"t.echo",
				{
					text: "a",
				},
			),
		).resolves.toMatchObject({
			ok: false,
			error: { code: ERROR_CODES.forbidden },
		});
	});

	it("never throws, even if the registry does", async () => {
		const app = new FakeContents();
		const server = new BridgeServer({
			registry: {
				request: () => {
					throw new Error("registry broke");
				},
				subscribe: () => {
					throw new Error("registry broke");
				},
			},
			isAppContents: () => true,
			allowedOrigins: [APP_ORIGIN],
			log: () => {},
		});
		await expect(
			server.request(fakeEvent(app), "x", {}),
		).resolves.toMatchObject({
			ok: false,
			error: { code: ERROR_CODES.internal },
		});
		server.subscribe(fakeEvent(app), { id: "s1", op: "x", input: {} });
		expect(app.send).toHaveBeenCalledWith(BRIDGE_CHANNELS.event, {
			id: "s1",
			event: {
				ok: false,
				error: expect.objectContaining({ code: ERROR_CODES.internal }),
			},
		});
	});
});

describe("BridgeServer subscriptions", () => {
	it("streams events to the subscribing window and stops on unsubscribe", () => {
		const { server, app, emitters, stops } = setup();
		server.subscribe(fakeEvent(app), { id: "s1", op: "t.ticks", input: {} });
		expect(server.subscriptionCount(app as unknown as WebContents)).toBe(1);
		emitters[0]?.(1);
		expect(app.send).toHaveBeenCalledExactlyOnceWith(BRIDGE_CHANNELS.event, {
			id: "s1",
			event: { ok: true, event: 1 },
		});
		server.unsubscribe(fakeEvent(app), { id: "s1" });
		expect(stops).toHaveBeenCalledOnce();
		expect(server.subscriptionCount()).toBe(0);
		emitters[0]?.(2);
		expect(app.send).toHaveBeenCalledOnce();
	});

	it("sends a failure to start back as the stream's one error message", () => {
		const { server, app } = setup();
		server.subscribe(fakeEvent(app), { id: "s1", op: "t.nope", input: {} });
		server.subscribe(fakeEvent(app), { id: "s2", op: "t.ticks", input: 5 });
		expect(app.send.mock.calls).toEqual([
			[
				BRIDGE_CHANNELS.event,
				{
					id: "s1",
					event: {
						ok: false,
						error: expect.objectContaining({
							code: ERROR_CODES.unknownOperation,
						}),
					},
				},
			],
			[
				BRIDGE_CHANNELS.event,
				{
					id: "s2",
					event: {
						ok: false,
						error: expect.objectContaining({ code: ERROR_CODES.invalidInput }),
					},
				},
			],
		]);
		expect(server.subscriptionCount()).toBe(0);
	});

	it("ignores and logs subscribe and unsubscribe from a foreign frame", () => {
		const { server, app, emitters, stops, log } = setup();
		const foreign = fakeEvent(app, topFrame("https://evil.example/"));
		server.subscribe(foreign, { id: "s1", op: "t.ticks", input: {} });
		expect(emitters).toHaveLength(0);
		expect(server.subscriptionCount()).toBe(0);

		server.subscribe(fakeEvent(app), { id: "s1", op: "t.ticks", input: {} });
		server.unsubscribe(foreign, { id: "s1" });
		expect(stops).not.toHaveBeenCalled();
		expect(server.subscriptionCount()).toBe(1);
		expect(log).toHaveBeenCalledTimes(2);
	});

	it("ignores malformed messages and a reused live id", () => {
		const { server, app, emitters } = setup();
		for (const msg of [
			null,
			"s",
			{},
			{ id: 1 },
			{ id: "" },
			{ id: "x".repeat(129) },
		]) {
			server.subscribe(fakeEvent(app), msg);
			server.unsubscribe(fakeEvent(app), msg);
		}
		expect(emitters).toHaveLength(0);
		server.subscribe(fakeEvent(app), { id: "s1", op: "t.ticks", input: {} });
		server.subscribe(fakeEvent(app), { id: "s1", op: "t.ticks", input: {} });
		expect(emitters).toHaveLength(1);
	});

	it("lets only the owning window end a subscription", () => {
		const { server, app, appContents, stops } = setup();
		const other = new FakeContents();
		appContents.add(other);
		server.subscribe(fakeEvent(app), { id: "s1", op: "t.ticks", input: {} });
		server.unsubscribe(fakeEvent(other), { id: "s1" });
		expect(stops).not.toHaveBeenCalled();
		other.destroy();
		expect(server.subscriptionCount()).toBe(1);
		server.unsubscribe(fakeEvent(app), { id: "s1" });
		expect(stops).toHaveBeenCalledOnce();
	});

	it.each(["destroyed", "render-process-gone", "did-navigate"])(
		"ends a window's subscriptions on %s",
		(eventName) => {
			const { server, app, emitters, stops } = setup();
			server.subscribe(fakeEvent(app), { id: "s1", op: "t.ticks", input: {} });
			server.subscribe(fakeEvent(app), { id: "s2", op: "t.ticks", input: {} });
			if (eventName === "destroyed") app.destroy();
			else app.emit(eventName);
			expect(stops).toHaveBeenCalledTimes(2);
			expect(server.subscriptionCount()).toBe(0);
			emitters[0]?.(1);
			expect(app.send).not.toHaveBeenCalled();
		},
	);

	it("keeps subscriptions across a navigation that only starts (it may be blocked)", () => {
		const { server, app, stops } = setup();
		server.subscribe(fakeEvent(app), { id: "s1", op: "t.ticks", input: {} });
		app.emit("did-start-navigation", {
			isMainFrame: true,
			isSameDocument: false,
		});
		app.emit("did-navigate-in-page");
		expect(stops).not.toHaveBeenCalled();
		expect(server.subscriptionCount()).toBe(1);
	});

	it("hooks each window once, however many subscriptions it opens", () => {
		const { server, app } = setup();
		for (let i = 0; i < 5; i++) {
			server.subscribe(fakeEvent(app), {
				id: `s${i}`,
				op: "t.ticks",
				input: {},
			});
		}
		expect(app.listenerCount("did-navigate")).toBe(1);
		expect(app.listenerCount("render-process-gone")).toBe(1);
		expect(app.listenerCount("destroyed")).toBe(1);
	});

	it("does not send to a destroyed window", () => {
		const { server, app, emitters } = setup();
		server.subscribe(fakeEvent(app), { id: "s1", op: "t.ticks", input: {} });
		app.destroyed = true;
		emitters[0]?.(1);
		expect(app.send).not.toHaveBeenCalled();
	});
});

describe("BridgeServer.install", () => {
	it("registers one handler and two listeners, and removes them", async () => {
		const { server, app, stops } = setup();
		const handlers = new Map<string, (...args: unknown[]) => unknown>();
		const listeners = new Map<string, (...args: unknown[]) => void>();
		const ipcMain = {
			handle: vi.fn((ch: string, fn: (...args: unknown[]) => unknown) =>
				handlers.set(ch, fn),
			),
			removeHandler: vi.fn((ch: string) => handlers.delete(ch)),
			on: vi.fn((ch: string, fn: (...args: unknown[]) => void) =>
				listeners.set(ch, fn),
			),
			removeListener: vi.fn((ch: string) => listeners.delete(ch)),
		};
		const uninstall = server.install(ipcMain as unknown as IpcMain);
		expect([...handlers.keys()]).toEqual([BRIDGE_CHANNELS.request]);
		expect([...listeners.keys()].sort()).toEqual(
			[BRIDGE_CHANNELS.subscribe, BRIDGE_CHANNELS.unsubscribe].sort(),
		);

		await expect(
			handlers.get(BRIDGE_CHANNELS.request)?.(fakeEvent(app), "t.echo", {
				text: "via ipc",
			}),
		).resolves.toEqual({ ok: true, value: { text: "via ipc" } });
		listeners.get(BRIDGE_CHANNELS.subscribe)?.(fakeEvent(app), {
			id: "s1",
			op: "t.ticks",
			input: {},
		});
		expect(server.subscriptionCount()).toBe(1);

		uninstall();
		expect(handlers.size).toBe(0);
		expect(listeners.size).toBe(0);
		expect(stops).toHaveBeenCalledOnce();
	});
});
