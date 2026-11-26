// Vitest projects for the renderer: `*.test.ts` run in plain Node (logic with no DOM), `*.test.tsx` in happy-dom
// (components rendered with Testing Library). One project each, so a test never gets a DOM it did not ask for.
import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		projects: [
			{
				test: {
					name: "node",
					include: ["src/**/*.test.ts"],
					environment: "node",
				},
			},
			{
				test: {
					name: "dom",
					include: ["src/**/*.test.tsx"],
					environment: "happy-dom",
					setupFiles: ["./src/test/domSetup.ts"],
				},
			},
		],
	},
});
