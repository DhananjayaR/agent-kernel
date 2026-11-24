// Proves the boundary check can fail. Under TypeScript 7 dependency-cruiser silently reports zero
// modules when its swc parser is missing, so a green `depcruise` alone proves nothing.
// Exits 0 only if the fixture run (a) cruised at least 2 modules and (b) reported every rule.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const bin = here(
	"../../node_modules/dependency-cruiser/bin/dependency-cruiser.mjs",
);
const fixture = here("./fixture/");
const config = here("./.dependency-cruiser.cjs");
const expected = [
	"renderer-ui-no-electron",
	"renderer-ui-no-node-builtins",
	"contract-only-zod",
	"ui-no-apps-or-contract",
	"desktop-is-private",
];

const r = spawnSync(
	process.execPath,
	[bin, "apps", "packages", "--config", config, "--output-type", "json"],
	{ cwd: fixture, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
);

function fail(msg) {
	console.error(`depcruise self-test FAILED: ${msg}`);
	if (r.stderr) console.error(r.stderr);
	process.exit(1);
}

let result;
try {
	result = JSON.parse(r.stdout);
} catch {
	fail(`depcruise produced no JSON (exit ${r.status})`);
}
const { totalCruised, violations } = result.summary;
if (totalCruised < 2) {
	fail(
		`only ${totalCruised} module(s) cruised; the parser is not working (D13 silent pass)`,
	);
}
const reported = new Set(violations.map((v) => v.rule.name));
const missing = expected.filter((n) => !reported.has(n));
if (missing.length > 0) {
	fail(`rules not reported on the fixture: ${missing.join(", ")}`);
}
console.log(
	`depcruise self-test OK: ${totalCruised} modules cruised, ${violations.length} violations, all ${expected.length} rules reported`,
);
