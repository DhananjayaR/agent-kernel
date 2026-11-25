// electron-vite builds main (ESM), preload (CommonJS: sandboxed preloads cannot be ES modules) and the renderer
// from apps/renderer. The config lives here, not in apps/renderer, so the renderer holds no Node-run file.
import { resolve } from "node:path";
import { defineConfig } from "electron-vite";

const here = import.meta.dirname;
const rendererRoot = resolve(here, "../renderer");

export default defineConfig({
	main: {
		build: {
			outDir: resolve(here, "out/main"),
			// The contract is a workspace package whose entry is TypeScript source: bundle it (and its zod) into
			// main rather than leave a runtime import that Node cannot load from the packaged app.
			externalizeDeps: { exclude: ["@ak-studio/contract"] },
		},
	},
	preload: {
		build: {
			outDir: resolve(here, "out/preload"),
			// Bundle everything into one file: a sandboxed preload can require only `electron`.
			externalizeDeps: false,
			rolldownOptions: {
				output: { format: "cjs", entryFileNames: "[name].cjs" },
			},
		},
	},
	renderer: {
		root: rendererRoot,
		build: {
			outDir: resolve(here, "out/renderer"),
			rolldownOptions: { input: resolve(rendererRoot, "index.html") },
		},
	},
});
