import { EventEmitter } from "node:events";
import type { WebContents } from "electron";
import { describe, expect, it } from "vitest";
import {
	APP_URL,
	buildCsp,
	hardenWebContents,
	isNavigationAllowed,
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

describe("isNavigationAllowed", () => {
	it.each([
		APP_URL,
		"app://studio/other",
		"https://example.com/",
		"http://localhost:5173/",
		"file:///x",
	])("refuses %s in production", (url) => {
		expect(isNavigationAllowed(url)).toBe(false);
	});

	it("allows only the dev server's own origin in development (Vite full reload)", () => {
		expect(isNavigationAllowed(`${DEV}/`, DEV)).toBe(true);
		expect(isNavigationAllowed(`${DEV}/index.html?t=1`, DEV)).toBe(true);
		expect(isNavigationAllowed("http://localhost:5174/", DEV)).toBe(false);
		expect(isNavigationAllowed("https://example.com/", DEV)).toBe(false);
		expect(isNavigationAllowed(APP_URL, DEV)).toBe(false);
		expect(isNavigationAllowed("not a url", DEV)).toBe(false);
	});
});

describe("hardenWebContents", () => {
	function fakeContents(devServerUrl?: string) {
		const emitter = new EventEmitter();
		let openHandler: ((d: { url: string }) => { action: string }) | undefined;
		const contents = Object.assign(emitter, {
			setWindowOpenHandler(h: typeof openHandler) {
				openHandler = h;
			},
		});
		hardenWebContents(contents as unknown as WebContents, devServerUrl);
		const prevented = (eventName: string, url: string): boolean => {
			let result = false;
			emitter.emit(eventName, {
				url,
				preventDefault: () => {
					result = true;
				},
			});
			return result;
		};
		return { prevented, open: (url: string) => openHandler?.({ url }) };
	}

	it.each([
		"will-navigate",
		"will-frame-navigate",
		"will-redirect",
		"will-attach-webview",
	])("prevents %s, whatever the target, in production", (eventName) => {
		const { prevented } = fakeContents();
		for (const url of [APP_URL, "https://example.com/", "file:///x"]) {
			expect(prevented(eventName, url)).toBe(true);
		}
	});

	it("lets the page navigate within the dev server only, in development", () => {
		const { prevented } = fakeContents(DEV);
		for (const eventName of ["will-navigate", "will-frame-navigate"]) {
			expect(prevented(eventName, `${DEV}/`)).toBe(false);
			expect(prevented(eventName, "https://example.com/")).toBe(true);
		}
		expect(prevented("will-redirect", `${DEV}/`)).toBe(true);
		expect(prevented("will-attach-webview", `${DEV}/`)).toBe(true);
	});

	it("denies every new window", () => {
		const { open } = fakeContents(DEV);
		expect(open("https://example.com/")).toEqual({ action: "deny" });
		expect(open(APP_URL)).toEqual({ action: "deny" });
		expect(open(`${DEV}/`)).toEqual({ action: "deny" });
	});
});
