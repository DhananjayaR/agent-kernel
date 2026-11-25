# P2 · Open a project and know its Open Agent Kernel version

| | |
|---|---|
| Status | Not started |
| Business aspect | Getting into a project: open a folder, see what is installed, know which OAK features apply |
| PRD milestone | 1 (Open and read), first half |
| Depends on | [P1b](P1b-data-layer-and-patterns.md) |
| Unlocks | Every later phase. All of them ask this phase "what does this project's version support?" |
| Screens | Welcome, the shell's status bar, the Commands panel |

## Outcome

A person launches the Studio, sees whether their toolchain is ready, opens a folder, and the app says: this is
an OAK project on version X, with these frameworks installed. Every command the app ran to learn that
is listed in the Commands panel. Opening a project on an older version works, and features that version lacks
are marked unavailable instead of failing.

## Scope

**In**

- Welcome screen: open a folder, recent projects, toolchain check, first-launch state. The entry points
  "New project" and "Describe a project" (the AI entry) show their not-yet states until P4 and P6 fill them.
- Project detection and the "not an Open Agent Kernel (OAK) project" state, with "Create a project here" (wired in P4),
  "Choose another folder" and "Cancel".
- Toolchain detection.
- The command runner and the Commands panel.
- File watching and the "changed on disk" notice.
- OAK version detection and the capability catalog.

**Out**

- Showing the project's agents (P3). Creating a project (P4). Settings pages (P4; the "Coding agents" section
  in P6).

## Design gate

Follow [design-process.md](design-process.md). Existing input: briefs 00, 01 and 02 on the feature branch.

| Screen | Requirements (from the PRD and brief 02) | Questions to settle |
|---|---|---|
| Welcome | Open a folder. See recent projects. See a toolchain check. Start a new project, or describe one to the coding agent (entry points only in this phase). | What a first-time user with nothing installed sees first. Whether a missing optional tool (Terraform, Docker) looks different from a missing required one (Python, `uv`). Where the OAK version of each recent project is shown. |
| Status bar | Working directory, git branch, Python environment state, file sync state. | Where the project's OAK version lives, and what it looks like when the version is below the supported floor. |
| Commands panel | Every command with its output and exit status. | How a long output is shown. How a running command is cancelled. How commands run by the app differ from those run by the coding agent (later). |
| Version states | Not in the PRD; needed by the versioning requirement. | One shared pattern for "this needs OAK ≥ X": on a tab, on a form section, on a palette tile. An upgrade hint that shows the command and never runs it silently. |

**Sign-off**

| Screen | Options explored | Decision | Approved by | Date |
|---|---|---|---|---|
| Welcome | | | | |
| Status bar and Commands panel | | | | |
| Version-unavailable pattern | | | | |

## Work packages

Built as feature slices on the [architecture](architecture.md) with the `ak-studio-new-feature`
skill: features `welcome`, `commands`, `status`; services `ToolchainService`,
`ProjectService`, `KernelService`.

### 2.1 Command runner (main process)

- [ ] One class, `CommandRunner`, is the only place the app starts a process. P1b defined its interface and
      a fake; this is the real implementation.
  - Takes an executable and an argument list. Never a shell string.
  - Runs in the working directory. Streams stdout and stderr as events. Reports exit status and duration.
  - Supports cancel. Kills the process tree on Windows, macOS and Linux.
  - Resolves executables per platform (`PATH`, `.exe` and `.cmd` on Windows).
- [ ] Every run is recorded and pushed to the renderer for the Commands panel.
- [ ] Environment values that hold secrets are masked in the recorded command.

### 2.2 Toolchain service

- [ ] Detect, with path and version: Python (3.12 or 3.13), `uv`, git, Claude Code, Terraform, Docker, and the
      AWS, Azure and Google Cloud command-line tools.
- [ ] Three states per tool: found, missing, wrong version. Each has an install link.
- [ ] Required for everything: Python and `uv`. All others are required only by the feature that uses them.
      Docker is needed only by targets that ship a container image: both containerized targets and Google
      Cloud serverless; AWS serverless needs it only when the Lambda is packaged as an image.
- [ ] The app installs nothing. Detection reads the user's own shell environment; a missing tool shows its
      install link.
- [ ] Detection runs through `CommandRunner`, so it is visible.

### 2.3 Project service

- [ ] Open a folder; keep a recent-projects list in the app's own data folder (not in the project).
- [ ] Detect an OAK project: `pyproject.toml` depends on `agentkernel`, or `config.yaml` and `app.py` exist,
      or (the team's signal, brief 02) `config.yaml` and a Python file that registers an OAK module. Record
      which signal matched.
- [ ] States: OAK project, Python project without OAK, empty folder, unreadable folder.
- [ ] Open creates the project scope from the [architecture](architecture.md); close disposes it. One
      project per window.
- [ ] Watch the folder for changes. Ignore `.venv/`, `.git/`, `node_modules/`, `.terraform/`,
      `.akstudio/runs/`. Debounce, then pass the changed paths to the services, which emit domain events
      (`files.changed`, `kernel.changed`). The renderer never sees raw paths for invalidation.
- [ ] Read git branch when the folder is a repository. git is optional.

### 2.4 Kernel version service

- [ ] Resolve the project's OAK version, in this order, and record which source answered:
  1. The installed package in the project's environment (`importlib.metadata.version("agentkernel")`, the same
     call the package uses in `ak-py/src/agentkernel/__init__.py`).
  2. The `agentkernel` entry in `uv.lock`.
  3. The constraint in `pyproject.toml` (a range, shown as "not installed yet").
- [ ] Report the installed extras and frameworks (which of the eight framework packages import).
- [ ] Report the project's Python version.
- [ ] Re-resolve when `pyproject.toml` or `uv.lock` changes on disk.

### 2.5 Capability catalog

The catalog answers one question for the whole app: **does this project's OAK version support
feature F?**

- [ ] A data package in `ak-studio/` holding one entry per capability:

  ```ts
  type Capability = {
    id: string;               // "deploy.azure.serverless", "config.schedule", "framework.maf"
    title: string;
    since: string;            // first version that has it
    until?: string;           // first version that no longer has it
    replacedBy?: string;      // capability id to point the user to
    docs?: string;            // link to the versioned docs page
    note?: string;            // one line shown in the UI for a breaking change
  };
  ```

- [ ] One API: `catalog.status(id, version)` returns `available`, `needs-upgrade` (with `since`) or `removed`
      (with `until` and `replacedBy`).
- [ ] One renderer hook and one component for the version-unavailable pattern from the design gate.
- [ ] **Supported floor.** Studio declares the oldest OAK version it opens with full support.
      Proposed: the latest minor at the time P2 ships. Below the floor the project opens read-only with a
      banner. The floor is recorded in the README decision log.
- [ ] **Seed entries**, enough to prove the mechanism in this phase:
  - The eight frameworks under `ak-py/src/agentkernel/framework/`.
  - The Terraform targets under `ak-deployment/`, with Azure Functions as the worked example of a removal
    (`docs/specs/957-retire-azure-functions/design.md`).
  - The top-level `AKConfig` sections (`ak-py/src/agentkernel/core/config.py`).
- [ ] **Drift test.** Because the Studio lives in this repository, a test compares the catalog with the
      in-tree `ak-py`: every framework folder and every top-level `AKConfig` section has a catalog entry. A
      feature PR that adds a section fails the test until the catalog is updated. This is what keeps the
      catalog honest.
- [ ] Write the `ak-studio-kernel-capability` skill: how to add, change or retire a catalog entry and gate
      the UI on it.
- [ ] **Rule for what goes in the catalog:** only what cannot be read from the installed package. Config
      fields, defaults and descriptions come from the installed version's own schema (P3), so they are always
      right for that version without a catalog entry.

### 2.6 Welcome screen, status bar, Commands panel

- [ ] Build the screens approved at the design gate, on the P1a shell and components and the P1b patterns.
- [ ] Recent projects show name, path, OAK version and last opened.
- [ ] The status bar shows the resolved version and its source.

## How later phases use the version

| Phase | Uses the version for |
|---|---|
| P3 | Config form generated from the installed version's schema; canvas node kinds gated by the catalog |
| P6, P7 | Which bundled skills exist; whether `ak rules check` exists in the installed version |
| P4 | New project wizard picks the OAK version; templates are chosen by version range |
| P5 | Palette tiles gated by the catalog |
| P8, P9 | Which stream event types and tracing options exist |
| P10, P11 | Which deploy targets exist; which module version matches the package version |

### 2.7 Skills from real code

These are the first real features, so the skills are checked against them.

- [ ] Revise `ak-studio-new-feature` against what building `welcome`, `commands` and `status` actually took.
- [ ] Write `ak-studio-testing` and `ak-studio-design-gate` from this phase's tests and design gate.
- [ ] Run each skill's sample task three times, as in [conventions-and-skills.md](conventions-and-skills.md).

## Verification

- [ ] Unit tests: `CommandRunner` (arguments, cancel, exit status), version resolution from each of the three
      sources, `catalog.status` for available, needs-upgrade and removed.
- [ ] Fixture projects: one current, one on an older minor, one with no environment yet, one that is not an
      OAK project. Each opens to the right state.
- [ ] The drift test passes against in-tree `ak-py` and fails when an entry is removed.
- [ ] End-to-end (Playwright): launch, open a fixture folder, see the version in the status bar and the
      detection commands in the Commands panel.
- [ ] Manual pass on Windows, macOS and Linux for executable lookup and process cancel.

## Open decisions

- The supported floor version.
- Whether the catalog later moves into the `agentkernel` package itself (for example an `ak` subcommand that
  prints it), so the kernel owns its own feature list. Older versions would still need the Studio-side
  catalog. Decide after P3, when the catalog's real shape is known.
- How the Studio handles a project whose version is **newer** than the Studio knows. Proposed: treat unknown
  newer versions as the latest known, with a "Studio update available" notice.

## Risks

| Risk | Default |
|---|---|
| The catalog goes stale | The drift test, and a line in the PR checklist for feature PRs |
| Version resolution is slow (starting Python) | Read `uv.lock` first for the fast answer, confirm from the environment in the background |
| File watching is heavy on large folders | Ignore list, debounce, and watch only known project paths if needed |
