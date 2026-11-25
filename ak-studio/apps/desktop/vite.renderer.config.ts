// `pnpm --filter @ak-studio/renderer dev`: serves the renderer alone in a browser (mock transport, no Electron).
// It lives here, not in apps/renderer, so the renderer holds no Node-run file (dependency rule
// renderer-ui-no-node-builtins).
import { resolve } from "node:path";
import { defineConfig } from "vite";
import { assetsInlineLimit, rendererPlugins } from "./renderer.shared";

export default defineConfig({
	root: resolve(import.meta.dirname, "../renderer"),
	plugins: rendererPlugins(),
	build: { assetsInlineLimit },
	server: { host: "127.0.0.1" },
});
