# P3 · See the project: read-only Canvas, Code and Config

| | |
|---|---|
| Status | Not started |
| Business aspect | Understanding a project: a visual view of its agents, tools, handoffs, channels and configuration |
| Issue milestone | 1 (Open and read), second half. Completes the milestone. |
| Depends on | [P2](P2-project-and-kernel-version.md) |
| Unlocks | P4 and P5 (editing), P6 (the coding agent's changes appear on this canvas) |
| Screens | Builder: Canvas tab, Code tab, Config tab, the inspector, the Problems panel |

## Outcome

A person opens any existing Agent Kernel project, including the examples in `examples/`, and sees its agents,
tools and handoffs as a graph, reads every file, and reads every `config.yaml` section as a form. Nothing is
editable yet. When a file changes on disk the views update. When the project cannot be read, the app says
which file is the problem. This is the first phase that showcases Agent Kernel visually.

## Scope

**In**

- The introspection helper and the project graph.
- Canvas tab, read-only, with selection and a read-only inspector.
- Code tab: file tree and read-only viewer.
- Config tab: forms generated from the installed version's schema, read-only.
- Problems panel: config validation and "cannot read" errors.
- Canvas layout stored in `.akstudio/`.

**Out**

- Any edit to project files (P4, P5). The Build with AI drawer (P6). Run control (P8).

## Design gate

Follow [design-process.md](design-process.md). Existing input: brief 04 and the Builder page of the canvas.
This is the gate that fixes the builder's overall layout, so later phases inherit it.

| Screen | Requirements (from the issue) | Questions to settle |
|---|---|---|
| Builder layout | Canvas, Code, Config, Test & Trace and Deploy tabs; a bottom panel; a Build with AI drawer later. | Where the inspector, the bottom panel and the future AI drawer sit. **Explore three layouts** before choosing; the choice must hold at 1100 px with the drawer open. |
| Canvas | Agents, tools, handoffs, channels, guardrails and stores are visible. | Node design for each kind, and how the framework of each agent shows. How edges differ by more than colour. How twenty agents stay readable (grouping, auto-layout, mini-map). What a mixed-framework project looks like. How capability groups (connect, remember, guard, scale, observe) are shown without crowding the agent graph. |
| Inspector | Read what a node is and where it lives. | Which properties show per node kind. A "defined in `app.py` line N" link into the Code tab. |
| Code | Read every generated file. | File tree markers. Whether the viewer is one file at a time or tabbed. |
| Config | Every `config.yaml` section as a form. | Navigation across about twenty sections. How a default value differs from a set value. How a value set by an `AK_*` environment variable shows. How a section the installed version lacks shows (the P2 pattern). |
| Cannot read | A clear state that points to the file. | Partial results: show what could be read and mark what could not. |

**Sign-off**

| Screen | Options explored | Decision | Approved by | Date |
|---|---|---|---|---|
| Builder layout | | | | |
| Canvas and inspector | | | | |
| Code | | | | |
| Config | | | | |
| Cannot-read states | | | | |

## Work packages

Built as feature slices (`canvas`, `code`, `config`, `problems`) on the [architecture](architecture.md).

### 3.0 Kernel-side commands

Per "Get data from the kernel, not around it" in [architecture.md](architecture.md):

- [ ] Write `design.md` for `ak inspect --json`, `ak config schema --json`, marking secret fields in
      `AKConfig`, and `ak config resolve --json` (which depends on the marking) in `ak-py`, through the repository's spec process. This runs alongside 3.1 and does not block it.
- [ ] Once released, add their catalog entries; the Studio uses them on versions that have them and the
      helper below on older ones.

### 3.1 Introspection helper (Python, runs in the project's environment)

- [ ] A small Python script shipped with the Studio. It is run with the project's own interpreter through
      `CommandRunner`, so it is visible in the Commands panel, and it prints one JSON document.
- [ ] It reports:
  - Agent Kernel version, Python version, installed frameworks.
  - The config schema of the **installed** version, from `AKConfig.model_json_schema()`. Checked on in-tree
    `ak-py`: it returns 28 top-level sections with types, defaults and descriptions, with no `config.yaml`
    present.
  - The resolved configuration, with secret values replaced by their key names. `AKConfig` does not mark
    secret fields today (they are plain `str`), so the helper uses the Studio's list of secret field paths
    and hides unknown strings in listed sections by default; see "Get data from the kernel" in
    [architecture.md](architecture.md).
  - The project graph: agents and their framework, tools, handoffs, hooks.
- [ ] How the graph is read is decided by a spike at the start of this phase. Two approaches:

  | Approach | How | Good | Bad |
  |---|---|---|---|
  | Import | Import the project module and read the agents registered with the kernel runtime (`Runtime.agents()` in `ak-py/src/agentkernel/core/runtime.py`) | Accurate for all eight frameworks; sees what the kernel sees | Runs the project's top-level code; needs dependencies installed and may need environment variables |
  | Static | Parse `app.py` without running it | Safe; works with a broken environment | Misses anything built dynamically; needs per-framework rules |

  Proposed: import first, static as the fallback that feeds the "cannot read" state with partial results.
- [ ] The helper never starts the server and has a timeout. The examples and the `ak-init` templates call
      `RESTAPI.run()` or `CLI.main()` only under `if __name__ == "__main__":`, so an import is safe for them.
      A hand-written project without that guard must hit the timeout and the static fallback, not hang.
- [ ] The helper's output format is versioned (`schemaVersion`) and typed in the bridge contract.
- [ ] The helper supports the version range the P2 floor allows. Differences between versions live in the
      helper, behind the one output format.

### 3.2 Project graph service (main process)

- [ ] Runs the helper on open and, debounced, when the watcher reports a change to a project file. Emits
      `graph.changed` when a new graph is ready; the renderer refetches on that event only.
- [ ] Keeps the last good graph while a new read is running or has failed.
- [ ] Maps helper errors to Problems entries with a file and, where known, a line.

### 3.3 Canvas tab

- [ ] Render the graph with the canvas library chosen in P0.
- [ ] Node kinds available per the P2 catalog; a kind the version lacks is not offered.
- [ ] Auto-layout for a project with no saved positions.
- [ ] Node positions while dragging are a working copy (the architecture's working-copy rule), written by
      one command on drag end.
- [ ] The canvas has the keyboard model from [conventions-and-skills.md](conventions-and-skills.md) and a
      scripted keyboard test.
- [ ] Positions, and nothing else, are saved to `.akstudio/canvas.json`: a documented, versioned, plain-text
      format with no absolute paths. This is the first file in `.akstudio/`; P3 defines the folder's rules
      (what is committed, what is ignored).
- [ ] Select a node to open the read-only inspector. Zoom, pan, fit, mini-map.

### 3.4 Code tab

- [ ] File tree of the working directory, with the same ignore list as the watcher.
- [ ] Read-only viewer with syntax highlighting, using the editor chosen in P0.
- [ ] "Open in editor" and "Reveal in file manager".
- [ ] `.env` shows key names only. Values never reach the renderer.

### 3.5 Config tab

- [ ] Forms generated from the installed version's schema: one section per top-level `AKConfig` block.
- [ ] Each field shows its description, its type, its default and whether it is set in `config.yaml`.
- [ ] Read-only in this phase. The form generator is built so that P4 only has to switch editing on.
- [ ] Validation uses Agent Kernel's own config loading, through the helper. Errors go to the Problems panel.

### 3.6 Problems panel

- [ ] Lists config validation errors and read errors, each linking to its file.

## Version awareness

- The config forms need no catalog entries: they come from the installed version's schema.
- Canvas node kinds and capability groups are gated by the catalog.
- The helper's compatibility range equals the supported floor from P2. A project below the floor opens with
  Code only, and a banner.

## Verification

- [ ] The secret-list test: every `AKConfig` field whose name or description looks like a secret is listed;
      no secret value appears in the helper's output for a fixture with every secret set.
- [ ] Unit tests for the helper against in-tree `ak-py`: one fixture project per framework, asserting agents,
      tools and handoffs.
- [ ] The helper runs against at least two released Agent Kernel versions in CI.
- [ ] Form generator tests: every top-level `AKConfig` section renders from the schema without a hand-written
      form.
- [ ] End-to-end: open three projects from `examples/` (single agent, multi-agent with handoffs, one with a
      messaging integration); the canvas matches the code.
- [ ] Break `app.py` with a syntax error: the cannot-read state appears, the last good graph stays, and fixing
      the file recovers without a restart.
- [ ] Edit `config.yaml` in an external editor: the Config tab updates and says the file changed on disk.

## Open decisions

- Import or static introspection as the primary path (spike in 3.1).
- The exact output of the kernel-side commands in 3.0. Proposed: the helper's output format becomes their
  first draft, so the switch-over changes no Studio code above the service.
- Whether `.akstudio/canvas.json` is committed by default.

## Risks

| Risk | Default |
|---|---|
| Importing the project has side effects or needs secrets | Timeout, no server start, static fallback, a clear message naming the missing variable |
| Eight frameworks expose handoffs and tools differently | Read through the kernel's own `Agent` abstraction where it carries the data; per-framework code only in the helper |
| Large graphs are unreadable | Settled at the design gate: grouping, auto-layout, mini-map |
| The schema is too raw for a good form (unions, nested optionals) | The form generator supports a small per-field override table for labels and widgets; the schema stays the source of fields |
