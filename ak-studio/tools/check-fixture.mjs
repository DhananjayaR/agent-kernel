// `pnpm check-fixture`: runs tools/check-fixture.py with the Python that has agentkernel: ak-py's virtual environment
// (repository-relative, ../ak-py/.venv) when it exists, else python3. Without agentkernel the check reports that it
// was skipped and exits 0.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const venv = [
	here("../../ak-py/.venv/bin/python"),
	here("../../ak-py/.venv/Scripts/python.exe"),
].find((path) => existsSync(path));
const python = venv ?? (process.platform === "win32" ? "python" : "python3");

// No __pycache__ in the fixture: the check imports hooks.py from it (fixture-tree.test.mjs lists its files).
const result = spawnSync(python, [here("./check-fixture.py")], {
	stdio: "inherit",
	env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
});
if (result.error) {
	console.error(
		`check-fixture: could not start ${python}: ${result.error.message}`,
	);
	process.exit(1);
}
process.exit(result.status ?? 1);
