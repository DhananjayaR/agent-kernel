// Boundary rules for the Studio workspace. Paths are relative to the directory depcruise runs in
// (ak-studio/ for the real run, the fixture directory for the self-test). The swc parser is required:
// under TypeScript 7 dependency-cruiser's default parser silently reports "1 modules, 0 dependencies".
// `pnpm depcruise:selftest` proves the rules can fail and that the parser actually found modules.

// Whole member folders (so .storybook, stories and config files are covered), minus installed and built files.
const NOT_INSTALLED_OR_BUILT = "(^|/)(node_modules|dist|storybook-static)/";
const RENDERER_OR_UI = {
	path: "^(apps/renderer|packages/ui)/",
	pathNot: NOT_INSTALLED_OR_BUILT,
};

// What contract source may import: itself and zod (unresolved or resolved).
const CONTRACT_ALLOWED = [
	"^packages/contract/src/",
	"^zod($|/)",
	"(^|/)node_modules/zod/",
];

// What runtime source may import: itself, @ak-studio/contract and zod (unresolved or resolved).
const RUNTIME_ALLOWED = [
	"^packages/runtime/src/",
	"^@ak-studio/contract($|/)",
	"^packages/contract/",
	"^zod($|/)",
	"(^|/)node_modules/zod/",
];

// The renderer's layers (apps/renderer/src): app/ composes features/, which build on shared/. main.tsx is the
// entry at the src root and may import app/.
const RENDERER_APP = "^apps/renderer/src/app/";
const RENDERER_FEATURES = "^apps/renderer/src/features/";

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
			comment: "packages/contract imports only zod (and itself).",
			severity: "error",
			from: { path: "^packages/contract/src/", pathNot: "\\.test\\.ts$" },
			to: { pathNot: CONTRACT_ALLOWED },
		},
		{
			name: "contract-tests-only-zod-vitest",
			comment:
				"packages/contract unit tests (*.test.ts) import only zod, vitest and the contract itself.",
			severity: "error",
			from: { path: "^packages/contract/src/.*\\.test\\.ts$" },
			to: {
				pathNot: [
					...CONTRACT_ALLOWED,
					"^vitest($|/)",
					"(^|/)node_modules/vitest/",
				],
			},
		},
		{
			name: "ui-no-apps-or-contract",
			comment:
				"packages/ui (the whole member: src, .storybook, config files) imports neither apps/* nor @ak-studio/contract.",
			severity: "error",
			from: { path: "^packages/ui/", pathNot: NOT_INSTALLED_OR_BUILT },
			to: {
				path: [
					"^apps/",
					"^packages/contract/",
					"^@ak-studio/(contract|renderer|desktop)($|/)",
				],
			},
		},
		{
			name: "runtime-only-contract-zod",
			comment:
				"packages/runtime is browser-safe: it imports only @ak-studio/contract, zod and itself (no Node built-in, no electron).",
			severity: "error",
			from: { path: "^packages/runtime/src/", pathNot: "\\.test\\.ts$" },
			to: { pathNot: RUNTIME_ALLOWED },
		},
		{
			name: "runtime-tests-only-contract-zod-vitest",
			comment:
				"packages/runtime unit tests (*.test.ts) import only @ak-studio/contract, zod, vitest and the runtime itself.",
			severity: "error",
			from: { path: "^packages/runtime/src/.*\\.test\\.ts$" },
			to: {
				pathNot: [
					...RUNTIME_ALLOWED,
					"^vitest($|/)",
					"(^|/)node_modules/vitest/",
				],
			},
		},
		{
			name: "renderer-feature-isolation",
			comment:
				"A feature (features/<a>) never imports another feature (features/<b>): features compose through app/ and share through shared/.",
			severity: "error",
			from: { path: "^apps/renderer/src/features/([^/]+)/" },
			to: {
				path: RENDERER_FEATURES,
				pathNot: "^apps/renderer/src/features/$1/",
			},
		},
		{
			name: "renderer-shared-is-a-leaf",
			comment: "shared/ imports neither features/ nor app/.",
			severity: "error",
			from: { path: "^apps/renderer/src/shared/" },
			to: { path: [RENDERER_FEATURES, RENDERER_APP] },
		},
		{
			name: "renderer-features-not-app",
			comment:
				"features/ never imports app/ (app/ composes features, not the reverse).",
			severity: "error",
			from: { path: RENDERER_FEATURES },
			to: { path: RENDERER_APP },
		},
		{
			name: "electron-only-in-entry-points",
			comment:
				"Electron's values are imported only by the main process entry (apps/desktop/src/main/index.ts) and the preload script, so everything else in main (quit rule, menu, window options, services) is tested without Electron. A type-only import carries no Electron code and is allowed.",
			severity: "error",
			from: {
				pathNot: [
					"^apps/desktop/src/main/index\\.ts$",
					"^apps/desktop/src/preload/index\\.ts$",
				],
			},
			to: {
				path: "(^|/)node_modules/electron/|^electron($|/)",
				dependencyTypesNot: ["type-only"],
			},
		},
		{
			name: "renderer-runtime-only-in-bridge",
			comment:
				"The renderer reaches @ak-studio/runtime only in shared/bridge/ (the mock transport serves a real ServiceRegistry from it); everything else goes through the bridge client. Unit tests may read runtime's constants to test against the mock (architecture.md, Layers).",
			severity: "error",
			from: {
				path: "^apps/renderer/",
				pathNot: [
					"^apps/renderer/src/shared/bridge/",
					"\\.test\\.tsx?$",
					NOT_INSTALLED_OR_BUILT,
				],
			},
			to: { path: ["^packages/runtime/", "^@ak-studio/runtime($|/)"] },
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
		// Build output (tsc declarations in dist/, electron-vite bundles in out/, the Storybook build in
		// storybook-static/) is not source.
		exclude: { path: "^(apps|packages)/[^/]+/(dist|out|storybook-static)/" },
	},
};
