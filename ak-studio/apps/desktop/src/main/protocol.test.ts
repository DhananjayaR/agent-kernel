import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	contentTypeFor,
	createAppProtocolHandler,
	resolveAppPath,
} from "./protocol";
import { buildCsp } from "./security";

const ROOT = "/srv/renderer";

describe("resolveAppPath", () => {
	it.each([
		["app://studio/", "/srv/renderer/index.html"],
		["app://studio/index.html", "/srv/renderer/index.html"],
		["app://studio/assets/index-abc.js", "/srv/renderer/assets/index-abc.js"],
		["app://studio/assets/", "/srv/renderer/assets/index.html"],
		["app://studio/a%20b.css?x=1#h", "/srv/renderer/a b.css"],
		["app://studio/assets/../index.html", "/srv/renderer/index.html"],
	])("maps %s", (url, file) => {
		expect(resolveAppPath(ROOT, url)).toBe(file);
	});

	it.each([
		"app://other/index.html", // wrong host
		"https://studio/index.html", // wrong scheme
		"app://studio/..%2f..%2fetc%2fpasswd", // encoded traversal
		"app://studio/%2e%2e%2fsecret",
		"app://studio/%00.html", // NUL
		"app://studio/%E0%A4%A", // malformed escape
		"not a url",
	])("refuses %s", (url) => {
		expect(resolveAppPath(ROOT, url)).toBeNull();
	});

	it("keeps an encoded backslash inside the root (an ordinary character on POSIX)", () => {
		const file = resolveAppPath(ROOT, "app://studio/..%5c..%5cwindows");
		expect(file === null || file.startsWith(`${ROOT}/`)).toBe(true);
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
	let dir: string;
	const csp = buildCsp();

	beforeAll(() => {
		dir = mkdtempSync(join(tmpdir(), "ak-studio-protocol-"));
		mkdirSync(join(dir, "assets"));
		writeFileSync(join(dir, "index.html"), "<!doctype html><p>hi</p>");
		writeFileSync(join(dir, "assets", "app.js"), "export {};");
		writeFileSync(join(dir, "..", "ak-studio-outside.txt"), "secret");
	});
	afterAll(() => {
		rmSync(dir, { recursive: true, force: true });
		rmSync(join(dir, "..", "ak-studio-outside.txt"), { force: true });
	});

	it("serves index.html for / with the CSP and nosniff", async () => {
		const res = await createAppProtocolHandler(
			dir,
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
			dir,
			csp,
		)(new Request("app://studio/assets/app.js"));
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toBe(
			"text/javascript; charset=utf-8",
		);
	});

	it("answers 404, still with the CSP, for missing files, traversal and other methods", async () => {
		const handle = createAppProtocolHandler(dir, csp);
		for (const req of [
			new Request("app://studio/missing.js"),
			new Request("app://studio/..%2fak-studio-outside.txt"),
			new Request("app://studio/assets"), // a directory
			new Request("app://studio/index.html", { method: "POST", body: "x" }),
		]) {
			const res = await handle(req);
			expect(res.status).toBe(404);
			expect(res.headers.get("content-security-policy")).toBe(csp);
		}
	});
});
