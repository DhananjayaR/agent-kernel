// Boundary rules for the Studio workspace. Paths are relative to the directory depcruise runs in
// (ak-studio/ for the real run, the fixture directory for the self-test). The swc parser is required:
// under TypeScript 7 dependency-cruiser's default parser silently reports "1 modules, 0 dependencies".
// `pnpm depcruise:selftest` proves the rules can fail and that the parser actually found modules.

// Whole member folders (so .storybook, stories and config files are covered), minus installed and built files.
const RENDERER_OR_UI = {
	path: "^(apps/renderer|packages/ui)/",
	pathNot: "(^|/)(node_modules|dist)/",
};

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
	forbidden: [
		{
			name: "renderer-ui-no-electron",
			comment:
				"The renderer and packages/ui run in a plain browser; they never import electron.",
			severity: "error",
			from: RENDERER_OR_UI,
			// Both forms: unresolved ("electron") and resolved (node_modules/electron/...).
			to: { path: "(^|/)node_modules/electron/|^electron($|/)" },
		},
		{
			name: "renderer-ui-no-node-builtins",
			comment:
				"The renderer and packages/ui import no Node built-in (node: prefixed or bare).",
			severity: "error",
			from: RENDERER_OR_UI,
			to: { dependencyTypes: ["core"] },
		},
		{
			name: "contract-only-zod",
			comment:
				"packages/contract imports only zod (and itself). Its unit tests (*.test.ts) may also import vitest.",
			severity: "error",
			from: { path: "^packages/contract/src/", pathNot: "\\.test\\.ts$" },
			to: {
				pathNot: [
					"^packages/contract/src/",
					"^zod($|/)",
					"(^|/)node_modules/zod/",
				],
			},
		},
		{
			name: "ui-no-apps-or-contract",
			comment: "packages/ui imports neither apps/* nor @ak-studio/contract.",
			severity: "error",
			from: { path: "^packages/ui/src/" },
			to: {
				path: [
					"^apps/",
					"^packages/contract/",
					"^@ak-studio/(contract|renderer|desktop)($|/)",
				],
			},
		},
		{
			name: "desktop-is-private",
			comment: "Nothing imports apps/desktop except apps/desktop itself.",
			severity: "error",
			from: { pathNot: "^apps/desktop/" },
			to: { path: ["^apps/desktop/", "^@ak-studio/desktop($|/)"] },
		},
	],
	options: {
		parser: "swc",
		tsConfig: { fileName: "tsconfig.json" },
		doNotFollow: { path: "node_modules" },
		// Build output (tsc declarations in dist/, electron-vite bundles in out/) is not source.
		exclude: { path: "^(apps|packages)/[^/]+/(dist|out)/" },
	},
};
