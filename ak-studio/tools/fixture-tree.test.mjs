// Checks that ak-studio/fixtures/support-triage holds exactly the files of the brief's project tree, no more
// and no fewer. EXPECTED mirrors the "Project files" tree in
// docs/specs/950-agent-kernel-studio-phase-1/00-project-brief.md ("Fixture data"); update both together.
// Two deliberate differences: the empty folders `.claude/commands/` and `.akstudio/` hold a `.gitkeep` (git does
// not keep empty folders), and `.akstudio/runs/` is git-ignored in a real project and so absent.
import { readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";

const ROOT = fileURLToPath(
	new URL("../fixtures/support-triage/", import.meta.url),
);
const EXPECTED = [
	".akstudio/.gitkeep",
	".claude/commands/.gitkeep",
	".env",
	"README.md",
	"app.py",
	"app_test.py",
	"build.sh",
	"config.yaml",
	"deploy/Dockerfile",
	"deploy/deploy.sh",
	"deploy/main.tf",
	"deploy/outputs.tf",
	"deploy/providers.tf",
	"deploy/terraform.tfvars",
	"deploy/variables.tf",
	"hooks.py",
	"pyproject.toml",
	"test-config.yaml",
	"tool.py",
	"uv.lock",
];

test("the fixture's files match the brief's tree", () => {
	const found = readdirSync(ROOT, { recursive: true, withFileTypes: true })
		.filter((e) => e.isFile())
		.map((e) => relative(ROOT, join(e.parentPath, e.name)))
		// Python's bytecode cache (git-ignored) is not part of the fixture.
		.filter((path) => !path.split(/[\\/]/).includes("__pycache__"))
		.sort();
	expect(found).toEqual([...EXPECTED].sort());
});

test("the fixture's .env holds placeholders only", async () => {
	const { readFileSync } = await import("node:fs");
	const lines = readFileSync(`${ROOT}.env`, "utf8")
		.split("\n")
		.filter((l) => l && !l.startsWith("#"));
	expect(lines).toHaveLength(7);
	for (const l of lines) expect(l).toMatch(/=\[YOUR [A-Z]+\]$/);
});
