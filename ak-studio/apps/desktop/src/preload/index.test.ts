import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { BRIDGE_CHANNELS } from "../shared/channels";

// The preload runs only inside Electron; here `electron` is replaced by a recorder.
const mocks = vi.hoisted(() => ({
	exposed: new Map<string, unknown>(),
	invoke: vi.fn(),
	send: vi.fn(),
	on: vi.fn(),
	removeListener: vi.fn(),
}));
vi.mock("electron", () => ({
	contextBridge: {
		exposeInMainWorld: (key: string, api: unknown) =>
			mocks.exposed.set(key, api),
	},
	ipcRenderer: {
		invoke: mocks.invoke,
		send: mocks.send,
		on: mocks.on,
		removeListener: mocks.removeListener,
	},
}));

interface StudioApi {
	request(op: string, input: unknown): Promise<unknown>;
	subscribe(
		op: string,
		input: unknown,
		onEvent: (event: unknown) => void,
	): () => void;
}

let studio: StudioApi;
let activeSubscriptionCount: () => number;
let eventListener: (e: unknown, m: unknown) => void;
let listenersAddedAtLoad: unknown[][];

beforeAll(async () => {
	({ activeSubscriptionCount } = await import("./index"));
	studio = mocks.exposed.get("studio") as StudioApi;
	listenersAddedAtLoad = [...mocks.on.mock.calls];
	eventListener = mocks.on.mock.calls[0]?.[1] as typeof eventListener;
});
beforeEach(() => {
	vi.clearAllMocks();
	mocks.send.mockReset();
});

describe("preload", () => {
	it("exposes exactly one global, studio, with request and subscribe", () => {
		expect([...mocks.exposed.keys()]).toEqual(["studio"]);
		expect(Object.keys(studio).sort()).toEqual(["request", "subscribe"]);
	});

	it("forwards request to bridge:request", async () => {
		mocks.invoke.mockResolvedValue({ ok: true });
		await expect(studio.request("app.info", {})).resolves.toEqual({ ok: true });
		expect(mocks.invoke).toHaveBeenCalledWith(
			BRIDGE_CHANNELS.request,
			"app.info",
			{},
		);
	});

	it("rejects a non-string operation name without sending anything", () => {
		expect(() => studio.request(42 as unknown as string, {})).toThrow(
			TypeError,
		);
		expect(mocks.invoke).not.toHaveBeenCalled();
	});

	it("registers exactly one bridge:event listener, at load", () => {
		expect(listenersAddedAtLoad).toHaveLength(1);
		expect(listenersAddedAtLoad[0]?.[0]).toBe(BRIDGE_CHANNELS.event);
	});

	it("subscribes, delivers only its own events, and unsubscribes once", () => {
		const onEvent = vi.fn();
		const unsubscribe = studio.subscribe("app.events", { a: 1 }, onEvent);

		expect(mocks.send).toHaveBeenCalledTimes(1);
		const [channel, msg] = mocks.send.mock.calls[0] as [
			string,
			{ id: string; op: string; input: unknown },
		];
		expect(channel).toBe(BRIDGE_CHANNELS.subscribe);
		expect(msg).toMatchObject({ op: "app.events", input: { a: 1 } });
		expect(typeof msg.id).toBe("string");
		expect(activeSubscriptionCount()).toBe(1);

		eventListener({}, { id: msg.id, event: "mine" });
		eventListener({}, { id: "someone-else", event: "theirs" });
		eventListener({}, null);
		expect(onEvent).toHaveBeenCalledExactlyOnceWith("mine");

		unsubscribe();
		unsubscribe();
		expect(activeSubscriptionCount()).toBe(0);
		expect(mocks.send).toHaveBeenLastCalledWith(BRIDGE_CHANNELS.unsubscribe, {
			id: msg.id,
		});
		expect(mocks.send).toHaveBeenCalledTimes(2);
		eventListener({}, { id: msg.id, event: "late" });
		expect(onEvent).toHaveBeenCalledTimes(1);
		expect(mocks.on).not.toHaveBeenCalled();
		expect(mocks.removeListener).not.toHaveBeenCalled();
	});

	it("leaves nothing behind when the subscribe send fails", () => {
		mocks.send.mockImplementationOnce(() => {
			throw new Error("An object could not be cloned.");
		});
		const onEvent = vi.fn();
		expect(() => studio.subscribe("x", () => {}, onEvent)).toThrow(
			"could not be cloned",
		);
		expect(activeSubscriptionCount()).toBe(0);
		const [, msg] = mocks.send.mock.calls[0] as [string, { id: string }];
		eventListener({}, { id: msg.id, event: "e" });
		expect(onEvent).not.toHaveBeenCalled();
	});

	it("keeps one listener and no entries across 20 subscribe/unsubscribe cycles", () => {
		for (let i = 0; i < 20; i++) {
			studio.subscribe("app.events", {}, () => {})();
		}
		expect(activeSubscriptionCount()).toBe(0);
		expect(mocks.on).not.toHaveBeenCalled();
		expect(listenersAddedAtLoad).toHaveLength(1);
		expect(mocks.send).toHaveBeenCalledTimes(40);
	});
});
