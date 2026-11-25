// Renderer build settings shared by electron-vite (electron.vite.config.ts) and the browser-only dev server
// (vite.renderer.config.ts). Lives here, not in apps/renderer, so the renderer holds no Node-run file.
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";

const FONT_FILE = /\.(woff2?|ttf|otf)$/;
/** Image files: the OAK mark in the top bar. */
const IMAGE_FILE = /\.(svg|png)$/;

export const rendererPlugins = () => [react(), tailwindcss()];

/**
 * Vite inlines small assets as data: URIs; the renderer CSP (`font-src 'self'`) blocks data: fonts. Emit
 * fonts as files instead of loosening the CSP. Images are emitted as files too, so the OAK mark is served from
 * app://studio/ like the rest of the app (`img-src 'self' data:` would allow either). Returning undefined keeps
 * Vite's default for other assets.
 */
export function assetsInlineLimit(file: string): boolean | undefined {
	return FONT_FILE.test(file) || IMAGE_FILE.test(file) ? false : undefined;
}
