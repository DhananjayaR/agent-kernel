import { EventEmitter } from "node:events";
import type { WebContents } from "electron";
import { describe, expect, it } from "vitest";
import {
	APP_URL,
	buildCsp,
	hardenWebContents,
	isRequestAllowed,
	RequestGate,
} from "./security";

const DEV = "http://localhost:5173";

describe("buildCsp", () => {
	it("is exactly the P1a policy in production", () => {
		expect(buildCsp()).toBe(
			"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; " +
				"font-src 'self'; connect-src 'self'",
		);
	});

	it("also lets the dev server connect, over HTTP and WebSocket, in development", () => {
		expect(buildCsp(`${DEV}/`)).toBe(
			"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; " +
				"font-src 'self'; connect-src 'self' http://localhost:5173 ws://localhost:5173",
		);
	});
});

describe("isRequestAllowed", () => {
	it.each([
		APP_URL,
		"app://studio/assets/index.js",
		"devtools://devtools/bundled/inspector.html",
	])("allows %s", (url) => {
		expect(isRequestAllowed(url)).toBe(true);
	});

	it.each([
		"https://example.com/",
		"http://localhost:5173/",
		"ws://localhost:5173/",
		"file:///etc/passwd",
		"wss://example.com/socket",
		"not a url",
	])("cancels %s in production", (url) => {
		expect(isRequestAllowed(url)).toBe(false);
	});

	it("allows the dev server's HTTP and WebSocket origin in development only", () => {
		expect(isRequestAllowed(`${DEV}/src/main.ts`, DEV)).toBe(true);
		expect(isRequestAllowed("ws://localhost:5173/?token=x", DEV)).toBe(true);
		expect(isRequestAllowed("http://localhost:5174/", DEV)).toBe(false);
		expect(isRequestAllowed("http://127.0.0.1:5173/", DEV)).toBe(false);
		expect(isRequestAllowed("https://example.com/", DEV)).toBe(false);
	});
});

describe("RequestGate", () => {
	it("counts and records only the requests it cancels", () => {
		const gate = new RequestGate();
		expect(gate.shouldCancel(APP_URL)).toBe(false);
		expect(gate.shouldCancel("devtools://devtools/x")).toBe(false);
		expect(gate.cancelledCount).toBe(0);
		expect(gate.shouldCancel("https://example.com/a")).toBe(true);
		expect(gate.shouldCancel("http://example.com/b")).toBe(true);
		expect(gate.cancelledCount).toBe(2);
		expect(gate.cancelledUrls).toEqual([
			"https://example.com/a",
			"http://example.com/b",
		]);
	});
});

describe("hardenWebContents", () => {
	function fakeContents() {
		const emitter = new EventEmitter();
		let openHandler: ((d: { url: string }) => { action: string }) | undefined;
		const contents = Object.assign(emitter, {
			setWindowOpenHandler(h: typeof openHandler) {
				openHandler = h;
			},
		});
		hardenWebContents(contents as unknown as WebContents);
		return { emitter, open: (url: string) => openHandler?.({ url }) };
	}

	it.each([
		"will-navigate",
		"will-frame-navigate",
		"will-redirect",
		"will-attach-webview",
	])("prevents %s, whatever the target", (eventName) => {
		const { emitter } = fakeContents();
		for (const url of [APP_URL, "https://example.com/", "file:///x"]) {
			let prevented = false;
			emitter.emit(eventName, {
				url,
				preventDefault: () => {
					prevented = true;
				},
			});
			expect(prevented).toBe(true);
		}
	});

	it("denies every new window", () => {
		const { open } = fakeContents();
		expect(open("https://example.com/")).toEqual({ action: "deny" });
		expect(open(APP_URL)).toEqual({ action: "deny" });
	});
});
