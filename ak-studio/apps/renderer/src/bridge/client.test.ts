import type { StudioBridge } from "@ak-studio/contract";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	BRIDGE_MISSING_ERROR,
	getTransport,
	getTransportKind,
	readStudioGlobal,
	StudioFailure,
	selectTransport,
	setTransport,
} from "./client";
import { createMockTransport } from "./mockTransport";

const info = { version: "1.0.0", platform: "linux", theme: "dark" } as const;

function fakeStudio(): StudioBridge {
	return {
		request: vi.fn(async () => ({ ok: true, value: info })),
		subscribe: vi.fn(() => () => {}),
	};
}

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
	setTransport(undefined);
});

describe("client", () => {
	it("picks the mock when window.studio is absent", async () => {
		expect(readStudioGlobal()).toBeUndefined();
		vi.stubGlobal("window", {});
		expect(getTransportKind()).toBe("mock");
		await expect(getTransport().request("app.info", {})).resolves.toMatchObject(
			{ platform: "browser" },
		);
	});

	it("picks IPC when the preload exposed window.studio", async () => {
		const studio = fakeStudio();
		vi.stubGlobal("window", { studio });
		expect(getTransportKind()).toBe("ipc");
		await expect(getTransport().request("app.info", {})).resolves.toEqual(info);
		expect(studio.request).toHaveBeenCalledWith("app.info", {});
	});

	it("ignores a window.studio that is not the bridge", () => {
		vi.stubGlobal("window", { studio: { request: "nope" } });
		expect(getTransportKind()).toBe("mock");
	});

	it("chooses once, and setTransport replaces the choice", () => {
		vi.stubGlobal("window", {});
		const first = getTransport();
		vi.stubGlobal("window", { studio: fakeStudio() });
		expect(getTransport()).toBe(first);

		const mock = createMockTransport();
		setTransport(mock);
		expect(getTransport()).toBe(mock);
		setTransport(undefined);
		expect(getTransportKind()).toBe("ipc");
	});

	it("selectTransport maps presence to the kind", () => {
		expect(selectTransport(undefined).kind).toBe("mock");
		expect(selectTransport(fakeStudio()).kind).toBe("ipc");
	});

	it("never uses fixtures on the app's own page: no window.studio there is bridge.unavailable", async () => {
		vi.stubGlobal("window", {});
		vi.stubGlobal("location", { protocol: "app:" });
		vi.spyOn(console, "error").mockImplementation(() => {});
		expect(getTransportKind()).toBe("unavailable");
		const err = await getTransport()
			.request("app.info", {})
			.catch((e: unknown) => e);
		expect(err).toBeInstanceOf(StudioFailure);
		expect((err as StudioFailure).error).toEqual(BRIDGE_MISSING_ERROR);
		expect((err as StudioFailure).error.code).toBe("bridge.unavailable");
		const subscribe = getTransport().subscribe as (
			name: string,
			input: unknown,
			onEvent: (event: unknown) => void,
		) => () => void;
		const onEvent = vi.fn();
		expect(() => subscribe("t.ticks", {}, onEvent)()).not.toThrow();
		expect(onEvent).not.toHaveBeenCalled();
		expect(console.error).toHaveBeenCalledOnce();
	});

	it("still uses IPC on the app's page, and the mock on a browser page", () => {
		vi.stubGlobal("window", { studio: fakeStudio() });
		vi.stubGlobal("location", { protocol: "app:" });
		expect(getTransportKind()).toBe("ipc");
		setTransport(undefined);
		vi.stubGlobal("window", {});
		vi.stubGlobal("location", { protocol: "http:" });
		expect(getTransportKind()).toBe("mock");
		expect(selectTransport(undefined, true).kind).toBe("unavailable");
	});
});
