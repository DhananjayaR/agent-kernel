// Boundary rules for the Studio workspace. Paths are relative to the directory depcruise runs in
// (ak-studio/ for the real run, the fixture directory for the self-test). The swc parser is required:
// under TypeScript 7 dependency-cruiser's default parser silently reports "1 modules, 0 dependencies".
// `pnpm depcruise:selftest` proves the rules can fail and that the parser actually found modules.

const RENDERER_OR_UI = "^(apps/renderer|packages/ui)/src/";

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
	forbidden: [
		{
			name: "renderer-ui-no-electron",
			comment:
				"The renderer and packages/ui run in a plain browser; they never import electron.",
			severity: "error",
			from: { path: RENDERER_OR_UI },
			to: { path: "^electron($|/)" },
		},
		{
			name: "renderer-ui-no-node-builtins",
			comment:
				"The renderer and packages/ui import no Node built-in (node: prefixed or bare).",
			severity: "error",
			from: { path: RENDERER_OR_UI },
			to: { dependencyTypes: ["core"] },
		},
		{
			name: "contract-only-zod",
			comment: "packages/contract imports only zod (and itself).",
			severity: "error",
			from: { path: "^packages/contract/src/" },
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
	},
};
