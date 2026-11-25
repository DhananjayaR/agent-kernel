// electron-vite builds main (ESM), preload (CommonJS: sandboxed preloads cannot be ES modules) and the renderer
// from apps/renderer. The config lives here, not in apps/renderer, so the renderer holds no Node-run file.
import { resolve } from "node:path";
import { defineConfig } from "electron-vite";
import { assetsInlineLimit, rendererPlugins } from "./renderer.shared";

const here = import.meta.dirname;
const rendererRoot = resolve(here, "../renderer");

/** The build mode of `pnpm build:e2e`: a production build that keeps main's development and test-hook code. */
export const E2E_MODE = "e2e";

export default defineConfig(({ command, mode }) => {
	// __STUDIO_DEV__ is true for `electron-vite dev` and the e2e build, false for the production build that
	// `pnpm build` and `pnpm package` make. Main's dev-server and test-hook branches test it first, so the
	// production bundle drops them; `app.isPackaged` stays as the run-time check behind it.
	const studioDev = command === "serve" || mode === E2E_MODE;
	return {
		main: {
			define: { __STUDIO_DEV__: JSON.stringify(studioDev) },
			build: {
				outDir: resolve(here, "out/main"),
				// The contract is a workspace package whose entry is TypeScript source: bundle it (and its zod)
				// into main rather than leave a runtime import that Node cannot load from the packaged app.
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
			plugins: rendererPlugins(),
			build: {
				outDir: resolve(here, "out/renderer"),
				assetsInlineLimit,
				rolldownOptions: { input: resolve(rendererRoot, "index.html") },
			},
		},
	};
});
