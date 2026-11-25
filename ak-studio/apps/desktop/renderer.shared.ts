// Renderer build settings shared by electron-vite (electron.vite.config.ts) and the browser-only dev server
// (vite.renderer.config.ts). Lives here, not in apps/renderer, so the renderer holds no Node-run file.
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";

const FONT_FILE = /\.(woff2?|ttf|otf)$/;

export const rendererPlugins = () => [react(), tailwindcss()];

/**
 * Vite inlines small assets as data: URIs; the renderer CSP (`font-src 'self'`) blocks data: fonts. Emit
 * fonts as files instead of loosening the CSP. Returning undefined keeps Vite's default for other assets.
 */
export function assetsInlineLimit(file: string): boolean | undefined {
	return FONT_FILE.test(file) ? false : undefined;
}
