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

beforeAll(async () => {
	await import("./index");
	studio = mocks.exposed.get("studio") as StudioApi;
});
beforeEach(() => {
	vi.clearAllMocks();
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

		const [eventChannel, listener] = mocks.on.mock.calls[0] as [
			string,
			(e: unknown, m: unknown) => void,
		];
		expect(eventChannel).toBe(BRIDGE_CHANNELS.event);
		listener({}, { id: msg.id, event: "mine" });
		listener({}, { id: "someone-else", event: "theirs" });
		expect(onEvent).toHaveBeenCalledExactlyOnceWith("mine");

		unsubscribe();
		unsubscribe();
		expect(mocks.removeListener).toHaveBeenCalledExactlyOnceWith(
			BRIDGE_CHANNELS.event,
			listener,
		);
		expect(mocks.send).toHaveBeenLastCalledWith(BRIDGE_CHANNELS.unsubscribe, {
			id: msg.id,
		});
		expect(mocks.send).toHaveBeenCalledTimes(2);
	});
});
