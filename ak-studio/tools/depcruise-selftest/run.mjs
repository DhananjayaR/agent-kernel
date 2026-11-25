// Proves the boundary check can fail. Under TypeScript 7 dependency-cruiser silently reports zero
// modules when its swc parser is missing, so a green `depcruise` alone proves nothing.
// Exits 0 only if the fixture run cruised every fixture module and reported each expected violation
// (rule + offending file).
import { fileURLToPath } from "node:url";
import { cruise } from "../cruise-lib.mjs";

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const EXPECTED_MODULES = 19;
const expected = [
	["renderer-ui-no-electron", "apps/renderer/src/violation.ts"], // resolves via fixture node_modules
	["renderer-ui-no-electron", "apps/renderer/src/required.ts"], // require()
	["renderer-ui-no-electron", "apps/renderer/src/typeonly.ts"], // import type
	["renderer-ui-no-electron", "packages/ui/src/index.ts"], // unresolved
	["renderer-ui-no-node-builtins", "apps/renderer/src/builtins.ts"], // node:fs
	["renderer-ui-no-node-builtins", "apps/renderer/src/barefs.ts"], // bare fs
	["renderer-ui-no-node-builtins", "apps/renderer/.storybook/main.ts"], // outside src
	["renderer-ui-no-node-builtins", "packages/ui/src/index.ts"],
	["renderer-ui-no-node-builtins", "packages/ui/.storybook/main.ts"], // Node-run config: no exemption
	["contract-only-zod", "packages/contract/src/index.ts"],
	["contract-tests-only-zod-vitest", "packages/contract/src/violation.test.ts"], // node:fs in a test
	["ui-no-apps-or-contract", "packages/ui/src/index.ts"],
	["desktop-is-private", "apps/renderer/src/violation.ts"],
];
// Must NOT be reported: a contract test importing vitest, zod and contract files is allowed, and the
// test-only rule (not contract-only-zod) is the one that judges contract tests.
const unexpected = [
	["*", "packages/contract/src/allowed.test.ts"],
	["contract-only-zod", "packages/contract/src/violation.test.ts"],
];

const { summary, parserMissing, stderr } = cruise({
	cwd: here("./fixture/"),
	config: here("./.dependency-cruiser.cjs"),
	targets: ["apps", "packages"],
});

function fail(msg) {
	console.error(`depcruise self-test FAILED: ${msg}`);
	if (stderr) console.error(stderr);
	process.exit(1);
}

if (parserMissing) fail("dependency-cruiser reports a missing transpiler");
if (summary.totalCruised !== EXPECTED_MODULES) {
	fail(
		`cruised ${summary.totalCruised} module(s), expected ${EXPECTED_MODULES} (parser not working?)`,
	);
}
const got = new Set(summary.violations.map((v) => `${v.rule.name}|${v.from}`));
const missing = expected.filter(([rule, file]) => !got.has(`${rule}|${file}`));
if (missing.length > 0) {
	fail(`not reported: ${missing.map(([r, f]) => `${r} in ${f}`).join("; ")}`);
}
const wrong = summary.violations.filter((v) =>
	unexpected.some(
		([rule, file]) => v.from === file && (rule === "*" || rule === v.rule.name),
	),
);
if (wrong.length > 0) {
	fail(
		`unexpected: ${wrong.map((v) => `${v.rule.name} in ${v.from} -> ${v.to}`).join("; ")}`,
	);
}
console.log(
	`depcruise self-test OK: ${summary.totalCruised} modules cruised, ${expected.length} expected violations found, ${unexpected.length} allowed cases clean`,
);
