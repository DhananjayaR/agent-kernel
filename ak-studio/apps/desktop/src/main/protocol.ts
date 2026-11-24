// The `app://studio/` protocol: serves the built renderer from disk. Files are read with `fs`, not `net.fetch`,
// so serving the app never passes through the network gate. No Electron value import: see security.ts.
import { readFile } from "node:fs/promises";
import { extname, isAbsolute, relative, resolve, sep } from "node:path";
import { APP_HOST, APP_SCHEME } from "./security";

const CONTENT_TYPES: Readonly<Record<string, string>> = {
	".html": "text/html; charset=utf-8",
	".js": "text/javascript; charset=utf-8",
	".mjs": "text/javascript; charset=utf-8",
	".css": "text/css; charset=utf-8",
	".json": "application/json; charset=utf-8",
	".map": "application/json; charset=utf-8",
	".svg": "image/svg+xml",
	".png": "image/png",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".webp": "image/webp",
	".ico": "image/x-icon",
	".woff": "font/woff",
	".woff2": "font/woff2",
	".ttf": "font/ttf",
	".otf": "font/otf",
	".txt": "text/plain; charset=utf-8",
};

export function contentTypeFor(filePath: string): string {
	return (
		CONTENT_TYPES[extname(filePath).toLowerCase()] ?? "application/octet-stream"
	);
}

/**
 * Maps an `app://studio/...` URL to a file under `rootDir`, or null if the URL is not ours or would escape
 * `rootDir` (`..`, encoded separators, absolute paths, NUL bytes, backslashes). `/` maps to `index.html`.
 */
export function resolveAppPath(rootDir: string, rawUrl: string): string | null {
	let url: URL;
	try {
		url = new URL(rawUrl);
	} catch {
		return null;
	}
	if (url.protocol !== `${APP_SCHEME}:` || url.host !== APP_HOST) return null;
	let pathname: string;
	try {
		pathname = decodeURIComponent(url.pathname);
	} catch {
		return null;
	}
	// NUL never; a backslash is a separator on Windows and never appears in the built renderer's paths.
	if (pathname.includes("\0") || pathname.includes("\\")) return null;
	if (pathname.endsWith("/")) pathname += "index.html";
	const root = resolve(rootDir);
	const file = resolve(root, `.${sep}${pathname}`);
	const rel = relative(root, file);
	if (rel === "" || rel.startsWith("..") || isAbsolute(rel)) return null;
	return file;
}

/** A `protocol.handle` handler serving `rootDir`, with the CSP on every response. */
export function createAppProtocolHandler(
	rootDir: string,
	csp: string,
): (request: Request) => Promise<Response> {
	const headers = (contentType: string): Record<string, string> => ({
		"Content-Type": contentType,
		"Content-Security-Policy": csp,
		"X-Content-Type-Options": "nosniff",
	});
	return async (request) => {
		const file =
			request.method === "GET" || request.method === "HEAD"
				? resolveAppPath(rootDir, request.url)
				: null;
		if (!file) {
			return new Response("Not found", {
				status: 404,
				headers: headers("text/plain; charset=utf-8"),
			});
		}
		try {
			const body = await readFile(file);
			return new Response(request.method === "HEAD" ? null : body, {
				status: 200,
				headers: headers(contentTypeFor(file)),
			});
		} catch {
			return new Response("Not found", {
				status: 404,
				headers: headers("text/plain; charset=utf-8"),
			});
		}
	};
}
