// Shared by `pnpm depcruise` and `pnpm depcruise:selftest`: run dependency-cruiser with JSON output.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const bin = fileURLToPath(
	new URL(
		"../node_modules/dependency-cruiser/bin/dependency-cruiser.mjs",
		import.meta.url,
	),
);

export function cruise({ cwd, config, targets }) {
	const r = spawnSync(
		process.execPath,
		[bin, ...targets, "--config", config, "--output-type", "json"],
		{ cwd, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
	);
	let result;
	try {
		result = JSON.parse(r.stdout);
	} catch {
		throw new Error(
			`depcruise produced no JSON (exit ${r.status})\n${r.stderr}`,
		);
	}
	// Missing swc under TypeScript 7 is the P0 D13 silent pass: no violations, zero modules.
	const parserMissing = /missing-(swc|typescript)-transpiler/.test(
		r.stdout + r.stderr,
	);
	return {
		summary: result.summary,
		modules: result.modules,
		parserMissing,
		stderr: r.stderr,
	};
}
