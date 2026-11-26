// `pnpm biome:selftest` (run by `pnpm lint`): proves Biome's restricted-import rules can fail, alongside
// dependency-cruiser (architecture.md, Enforcement: "No electron or Node import in the renderer or ui"). The planted
// files in ./fixture mirror the workspace layout; they are copied to a temporary folder whose biome.json extends the
// real one, so the real overrides judge them by the same relative paths, while the real `biome check` skips the
// fixture. Exits 0 only if every expected diagnostic appears and the allowed files are clean of these rules.
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const biome = here("../../node_modules/@biomejs/biome/bin/biome");
const RULES = new Set([
	"lint/style/noRestrictedImports",
	"lint/correctness/noNodejsModules",
	"lint/style/noRestrictedGlobals",
]);
const expected = [
	["lint/style/noRestrictedImports", "apps/renderer/src/electron.ts"],
	["lint/style/noRestrictedImports", "apps/renderer/src/electronSubpath.ts"],
	["lint/correctness/noNodejsModules", "apps/renderer/src/nodeFs.ts"],
	["lint/correctness/noNodejsModules", "packages/ui/src/barePath.ts"],
	["lint/style/noRestrictedImports", "packages/ui/src/lucide.ts"],
	["lint/style/noRestrictedImports", "packages/runtime/src/electron.ts"],
	["lint/style/noRestrictedGlobals", "packages/runtime/src/globals.ts"], // window
	["lint/style/noRestrictedGlobals", "packages/runtime/src/globals.ts"], // document
];
// Must not be reported by these rules: the main process may import electron and Node built-ins.
const clean = ["apps/desktop/src/main/index.ts", "apps/renderer/src/clean.ts"];

function fail(message, output = "") {
	console.error(`biome self-test FAILED: ${message}`);
	if (output) console.error(output);
	process.exit(1);
}

const dir = mkdtempSync(join(tmpdir(), "ak-studio-biome-selftest-"));
let result;
try {
	cpSync(here("./fixture/"), dir, { recursive: true });
	writeFileSync(
		join(dir, "biome.json"),
		JSON.stringify({
			extends: [here("../../biome.json")],
			// The temporary folder is not a git checkout.
			vcs: { enabled: false },
		}),
	);
	result = spawnSync(
		process.execPath,
		[biome, "lint", "--reporter=json", "."],
		{
			cwd: dir,
			encoding: "utf8",
		},
	);
} finally {
	rmSync(dir, { recursive: true, force: true });
}

let report;
try {
	report = JSON.parse(result.stdout);
} catch {
	fail(`Biome produced no JSON (exit ${result.status})`, result.stderr);
}
const found = report.diagnostics
	.filter((d) => RULES.has(d.category))
	.map((d) => `${d.category}|${d.location.path.replaceAll("\\", "/")}`)
	.sort();
const want = expected.map(([rule, file]) => `${rule}|${file}`).sort();
if (JSON.stringify(found) !== JSON.stringify(want)) {
	fail(
		`expected these diagnostics:\n  ${want.join("\n  ")}\ngot:\n  ${found.join("\n  ")}`,
	);
}
const dirty = clean.filter((file) => found.some((f) => f.endsWith(`|${file}`)));
if (dirty.length > 0) fail(`reported in allowed files: ${dirty.join(", ")}`);
if (result.status === 0) fail("Biome exited 0 on the planted violations");
console.log(
	`biome self-test OK: ${expected.length} planted violations reported, ${clean.length} allowed files clean`,
);
