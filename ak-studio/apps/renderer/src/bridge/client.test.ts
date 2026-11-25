import type { StudioBridge } from "@ak-studio/contract";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	getTransport,
	getTransportKind,
	readStudioGlobal,
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
});
