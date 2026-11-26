// The support-triage fixture project as data, read at build time from ak-studio/fixtures/support-triage (Vite
// raw imports), so stories, the mock transport and end-to-end tests share one source. Only what the fixture
// holds is read here; app-level preferences (theme, layout) stay in the mock.
import appPy from "../../../../../fixtures/support-triage/app.py?raw";
import configYaml from "../../../../../fixtures/support-triage/config.yaml?raw";
import hooksPy from "../../../../../fixtures/support-triage/hooks.py?raw";
import pyproject from "../../../../../fixtures/support-triage/pyproject.toml?raw";
import toolPy from "../../../../../fixtures/support-triage/tool.py?raw";

/** The raw text of the fixture's project files. */
export const FIXTURE_FILES = {
	"app.py": appPy,
	"config.yaml": configYaml,
	"hooks.py": hooksPy,
	"pyproject.toml": pyproject,
	"tool.py": toolPy,
} as const;

const AGENTKERNEL_FLOOR = /"agentkernel\[[^\]]*\]>=(\d+\.\d+\.\d+)"/;

/** The fixture project's identity, derived from its files (the brief's "Fixture data" gives the rest). */
export const FIXTURE_PROJECT = {
	name: /^name = "([^"]+)"/m.exec(pyproject)?.[1] ?? "support-triage",
	path: "~/code/support-triage",
	branch: "main",
	/** The OAK version the project requires (the floor in `pyproject.toml`). */
	oakVersion: AGENTKERNEL_FLOOR.exec(pyproject)?.[1] ?? "",
	agents: ["triage", "billing", "kb-researcher"],
	tools: [...toolPy.matchAll(/^def (\w+)\(/gm)].map((m) => m[1]),
} as const;
