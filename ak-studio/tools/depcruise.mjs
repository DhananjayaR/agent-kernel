// `pnpm depcruise`: the real boundary check, guarded against the D13 silent pass.
import { fileURLToPath } from "node:url";
import { cruise } from "./cruise-lib.mjs";

const MIN_MODULES = 5; // at least one source module per workspace member
const cwd = fileURLToPath(new URL("../", import.meta.url));
const { summary, parserMissing, stderr } = cruise({
	cwd,
	config: ".dependency-cruiser.cjs",
	targets: ["apps", "packages"],
});

const problems = [];
if (parserMissing)
	problems.push(
		"dependency-cruiser reports a missing swc/TypeScript transpiler",
	);
if (summary.totalCruised < MIN_MODULES) {
	problems.push(
		`only ${summary.totalCruised} module(s) cruised, expected at least ${MIN_MODULES}`,
	);
}
for (const v of summary.violations) {
	problems.push(`${v.rule.name}: ${v.from} -> ${v.to}`);
}
if (problems.length > 0) {
	console.error(`depcruise FAILED:\n  ${problems.join("\n  ")}`);
	if (stderr) console.error(stderr);
	process.exit(1);
}
console.log(
	`depcruise OK: ${summary.totalCruised} modules, ${summary.totalDependenciesCruised} dependencies, no violations`,
);
