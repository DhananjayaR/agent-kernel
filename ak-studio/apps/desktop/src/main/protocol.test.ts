import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	contentTypeFor,
	createAppProtocolHandler,
	resolveAppPath,
} from "./protocol";
import { buildCsp } from "./security";

// A platform-native absolute root; resolveAppPath does not touch the disk.
const ROOT = resolve(tmpdir(), "ak-studio-renderer-root");

describe("resolveAppPath", () => {
	it.each([
		["app://studio/", ["index.html"]],
		["app://studio/index.html", ["index.html"]],
		["app://studio/assets/index-abc.js", ["assets", "index-abc.js"]],
		["app://studio/assets/", ["assets", "index.html"]],
		["app://studio/a%20b.css?x=1#h", ["a b.css"]],
		["app://studio/assets/../index.html", ["index.html"]],
		// The URL parser folds %2e%2e segments itself, so this stays inside the root.
		["app://studio/%2e%2e/%2e%2e/etc/passwd", ["etc", "passwd"]],
	])("maps %s", (url, parts) => {
		expect(resolveAppPath(ROOT, url)).toBe(join(ROOT, ...parts));
	});

	it.each([
		"app://other/index.html", // wrong host
		"https://studio/index.html", // wrong scheme
		"app://studio/..%2f..%2fetc%2fpasswd", // encoded traversal
		"app://studio/%2e%2e%2fsecret",
		"app://studio/..%5c..%5cwindows", // encoded backslash: refused on every platform
		"app://studio/assets%5cindex.js",
		"app://studio/%00.html", // NUL
		"app://studio/%E0%A4%A", // malformed escape
		"not a url",
	])("refuses %s", (url) => {
		expect(resolveAppPath(ROOT, url)).toBeNull();
	});
});

describe("contentTypeFor", () => {
	it("knows the renderer's file types and falls back to octet-stream", () => {
		expect(contentTypeFor("a/index.html")).toBe("text/html; charset=utf-8");
		expect(contentTypeFor("a/x.JS")).toBe("text/javascript; charset=utf-8");
		expect(contentTypeFor("a/f.woff2")).toBe("font/woff2");
		expect(contentTypeFor("a/blob.bin")).toBe("application/octet-stream");
	});
});

describe("createAppProtocolHandler", () => {
	// A unique parent per run: the served root inside it, and a file beside the root that must stay unreachable.
	let parent: string;
	let root: string;
	const csp = buildCsp();

	beforeAll(() => {
		parent = mkdtempSync(join(tmpdir(), "ak-studio-protocol-"));
		root = join(parent, "renderer");
		mkdirSync(join(root, "assets"), { recursive: true });
		writeFileSync(join(root, "index.html"), "<!doctype html><p>hi</p>");
		writeFileSync(join(root, "assets", "app.js"), "export {};");
		writeFileSync(join(parent, "outside.txt"), "secret");
	});
	afterAll(() => {
		rmSync(parent, { recursive: true, force: true });
	});

	it("serves index.html for / with the CSP and nosniff", async () => {
		const res = await createAppProtocolHandler(
			root,
			csp,
		)(new Request("app://studio/"));
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toBe("text/html; charset=utf-8");
		expect(res.headers.get("content-security-policy")).toBe(csp);
		expect(res.headers.get("x-content-type-options")).toBe("nosniff");
		expect(await res.text()).toBe("<!doctype html><p>hi</p>");
	});

	it("serves assets with their content type", async () => {
		const res = await createAppProtocolHandler(
			root,
			csp,
		)(new Request("app://studio/assets/app.js"));
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toBe(
			"text/javascript; charset=utf-8",
		);
	});

	it("answers 404, still with the CSP, for missing files, traversal and other methods", async () => {
		const handle = createAppProtocolHandler(root, csp);
		for (const req of [
			new Request("app://studio/missing.js"),
			new Request("app://studio/..%2foutside.txt"),
			new Request("app://studio/..%5coutside.txt"),
			new Request("app://studio/assets"), // a directory
			new Request("app://studio/index.html", { method: "POST", body: "x" }),
		]) {
			const res = await handle(req);
			expect(res.status).toBe(404);
			expect(res.headers.get("content-security-policy")).toBe(csp);
		}
	});
});
