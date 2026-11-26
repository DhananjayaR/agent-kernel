# P2 design gate: options for Welcome, the status bar, the Commands panel and version states

**Date:** 26 November 2026. **Gate steps covered:** 1 (requirements), 2 (review of the sketch) and 3 (options),
for the four rows of the [P2 design gate](../../implementation/P2-project-and-kernel-version.md#design-gate). The
options are written here, not drawn: the last sign-off row lets the owner ask for any of them to be drawn on the
canvas first. **Nothing here is approved.** The owner picks; the pick is recorded in the P2 sign-off table and the
README decision log.

The P1b gate already settled the shared patterns P2 uses (all five rows approved on 26 November 2026). This note
applies them and does not reopen them; the next section lists what they decide for P2.

## Sources

- The PRD ([PHASE-1-PRD.md](../../PHASE-1-PRD.md), sections 2 and 4) and briefs
  [00](../../00-project-brief.md) (desktop shell, working-directory rules), [01](../../01-app-components.md)
  (`CommandRow`, `LogStream`, `ToolchainRow`), [02](../../02-welcome.md) (Welcome), and the lines of
  [05](../../05-build-with-ai.md), [07](../../07-builder-test-and-trace.md) and
  [08](../../08-builder-deploy.md) that mention the Commands panel.
- The P2 work packages (2.1 to 2.6) and the decisions of 26 November 2026: the supported floor is OAK 0.10;
  a newer project is treated as the newest known version, with a "Studio update available" notice.
- [design-process.md](../../implementation/design-process.md) and
  [conventions-and-skills.md](../../implementation/conventions-and-skills.md) sections 1 and 2.
- The [P1b options note](p1b-design-gate-options.md) and the
  [P1b sign-off](../../implementation/P1b-data-layer-and-patterns.md#design-gate).
- The components already built in `ak-studio/packages/ui/src/components/`: `status-bar.tsx` (with a
  `kernelVersion` slot left for P2), `bottom-panel.tsx` (three fixed tabs), `empty-state.tsx`,
  `inline-banner.tsx`, `status-chip.tsx` (five states), `path-chip.tsx`, `desktop-shell.tsx`,
  `project-switcher.tsx`, `top-bar-controls.tsx`, and `settings-modal.tsx` (P1a: the theme only).
- The Claude Design "OAK Studio Phases" (<https://claude.ai/artifact/HxwXUwENoUhpnjKdQb1k8j>), read on 26
  November 2026 at version `1795693123-abc2`, the same version as the P1b note's last check, and checked again
  at the end of this work (unchanged). Every artboard named below is a board in `canvas.json` at that version;
  links use the board's file stem (`Start-Welcome` is `Main`, `Settings-Toolchain` is `Settings`).

### The changed and the new boards

The owner added `Start-Welcome-Settings` and `Settings-AgentPermissions`, and changed `Main` (`Start-Welcome`),
on purpose, as P2 input. No earlier copy of `Main` was available to compare, so the change is described against
brief 02, not as a diff.

- [`Start-Welcome`](https://claude.ai/artifact/HxwXUwENoUhpnjKdQb1k8j#artboard-Main), compared with brief 02:
  a settings control (the sliders icon, "App settings") sits in the header beside the lockup; the toolchain
  card's link reads "Toolchain settings"; both open settings **as a dialog over Welcome**, where brief 02 sends
  the link to the `Settings-Toolchain` page. The line "A project is a folder on this computer. Everything the app
  creates stays in it." now shows in every view, not only on first launch. **Verdict:** no requirement changes.
  One behaviour line of brief 02 changes (settings is a dialog), which matches the `SettingsModal` P1a built.
- [`Start-Welcome-Settings`](https://claude.ai/artifact/HxwXUwENoUhpnjKdQb1k8j#artboard-Start-Welcome-Settings):
  Welcome with the settings dialog open on Toolchain. The dialog's navigation has two groups: "This computer"
  (Toolchain, Coding agents, Cloud, General) and "This project" (Agent permissions, Secrets). With no project
  open, the project group is disabled at 55 % opacity with the line "No project is open. Open one to change its
  agent permissions and secrets." The Toolchain section lists the same tools as Welcome with path and version,
  "Recheck", and a field "A tool that was not found automatically".
- [`Settings-AgentPermissions`](https://claude.ai/artifact/HxwXUwENoUhpnjKdQb1k8j#artboard-Settings-AgentPermissions):
  the same dialog over the canvas, on "Agent permissions": skills installed in the project with "Update
  skills", "Edit project files", "Running commands" ("Ask every time" or "Allow listed commands", with
  `uv run pytest` listed), a locked row "Never apply or destroy Terraform", and "Take a checkpoint before each
  turn".

**Do they bear on P2?** Yes, in three places: where Welcome's settings entry goes (section 1), what a
first-run person can reach from Welcome (section 1), and, for `Settings-AgentPermissions`, how commands the
coding agent runs will be told apart in the Commands panel (section 3, question 3). Neither board is a first-run
flow. The rest of their content is listed as "drawn here, built in Pn" below.

## What P1b already decides for P2

| P1b decision (row) | What it settles in P2 | Left for this gate |
|---|---|---|
| Job progress inline in the view that started it; "Stop", "Show commands", elapsed time; commands in the Commands panel; several jobs stacked (a) | Toolchain detection and opening a project are jobs shown on Welcome. "Show commands" opens the Commands panel filtered to the job, so the panel has a job filter. The label is "Stop", not "Cancel". | Where Welcome shows commands, since Welcome has no shell (section 1, question 4) |
| Background notice: a state icon on the tab, one toast template; no running-jobs list until P6 (a) | Nothing new in P2: its jobs are short and run in the view in front of the person. | None |
| Streaming list: no wrap, ANSI collapsed to existing tokens, copy, clear, "Jump to latest"; bounded buffer (b) | Command output in the Commands panel uses it as is. P2 confirms that `CommandRunner` runs without a terminal, so most tools print no colour. | How a long output is shown and how a run is stopped (section 3) |
| Command palette: version-gated commands listed with their reason; `when` commands hidden (b) | The command palette's gated rows. | The node palette's tiles, a different palette (section 4) |
| Bottom panel stays at three fixed tabs (P1b plan ruling 4, cited in the P1b note under row a) | No option below adds a tab. | None |
| Changed on disk: a banner at the top of the view, info tone without a working copy (c) | P2 has no editable view and no Builder view (P3), so its change notice is the status bar's file sync item; a change to `pyproject.toml` or `uv.lock` re-reads the version and updates the version item. | None |
| Version gate: a tab shows the `EmptyState` frame with the version needed and the upgrade command to copy; a form section is tagged "Needs {since}" and opens to a banner over read-only fields; "Removed" uses the same frames; the upgrade command is shown, never run (d) | The tab and section sizes, the "removed" wording and the upgrade hint. P1b leaned, for one control: it keeps its place, shows a version tag, and its popover gives the version and the command. | The palette tile (section 4); the below-floor banner, which P1b left for P2 to draw (section 2) |
| One family for empty, cannot read and error: centred when nothing is left to show, a banner otherwise (d) | Welcome's first-launch box, the "not an OAK project" state, an unreadable folder and a missing recent folder all take these frames. | None |

## 1. Welcome

### Step 1: requirements

From the PRD (section 2), brief 02 and P2's scope and work packages 2.2, 2.3 and 2.6.

| # | Requirement | Source |
|---|---|---|
| W1 | Open a folder | PRD, brief 02 |
| W2 | See recent projects: name, path, frameworks, last opened | Brief 02 |
| W3 | See each recent project's OAK version | P2 2.6 |
| W4 | A recent project whose folder is gone or cannot be read | UX checklist ("cannot read") |
| W5 | Toolchain check: each tool with what it is needed for, version, path, state (found, missing, wrong version) and an install link | Brief 02, brief 01 `ToolchainRow`, P2 2.2 |
| W6 | Tools: Python 3.12 or 3.13, `uv`, git, Claude Code, Terraform, Docker, and the AWS, Azure and Google Cloud command-line tools | P2 2.2 |
| W7 | Python and `uv` are required for everything; every other tool only by the feature that uses it | P2 2.2 |
| W8 | "Recheck" and a link to app settings | Brief 02 |
| W9 | First launch: no recent projects | Brief 02 |
| W10 | Toolchain missing: a banner, "New project" disabled, "Open folder" still works, the Terraform row says only deploying is affected | Brief 02 |
| W11 | A first-time person with nothing installed | P2 gate question |
| W12 | "New project" and "Describe a project" as entry points, in a not-yet state until P4 and P6 | P2 scope |
| W13 | Not an OAK project: "Create a project here", "Choose another folder", "Cancel"; and the states Python project without OAK, empty folder, unreadable folder | Brief 02, P2 2.3 |
| W14 | Progress while the toolchain is checked and a project opens | P1b row a, UX checklist |
| W15 | Every command the app ran is visible, detection included | PRD 4.2, P2 2.2 |

### Step 2: review of the artboards

| # | Status | What the artboards draw |
|---|---|---|
| W1 | Covered | "Open folder", primary, on [`Start-Welcome`](https://claude.ai/artifact/HxwXUwENoUhpnjKdQb1k8j#artboard-Main) |
| W2 | Partly | Two rows: name, path, framework marks, last opened ("today", "3 days ago"). The path is plain monospace text, not a `PathChip`. |
| W3 | Missing | No version on any row. (The built `Card` story shows a recent project on "OAK 0.6.2", now below the floor.) |
| W4 | Missing | Not drawn |
| W5 | Partly | Each row: tool, "needed for" caption, `[VERSION]`, a state ("Found", "Missing", "Signed in"). No path on Welcome (the settings dialog shows `[PATH] · [VERSION]`). No "wrong version" state. No install link on a row; only the banner's "How to install uv". |
| W6 | Partly | Python, `uv`, Claude Code, Terraform, Docker, "AWS CLI, profile `default`", git. The Azure and Google Cloud tools: not drawn. The AWS row checks a signed-in profile, which P2 does not detect (sign-in is a deploy prerequisite). |
| W7 | Partly | The caption says it ("Everything", "Deploy. Only deploying is affected."), but [`Start-Welcome-ToolchainMissing`](https://claude.ai/artifact/HxwXUwENoUhpnjKdQb1k8j#artboard-Start-Welcome-ToolchainMissing) gives missing `uv` and missing Terraform the same red "Missing". |
| W8 | Covered | "Recheck" and "Toolchain settings"; also the header's settings control. Both open the dialog of [`Start-Welcome-Settings`](https://claude.ai/artifact/HxwXUwENoUhpnjKdQb1k8j#artboard-Start-Welcome-Settings). |
| W9 | Covered | [`Start-Welcome-FirstLaunch`](https://claude.ai/artifact/HxwXUwENoUhpnjKdQb1k8j#artboard-Start-Welcome-FirstLaunch): "New project" becomes the primary action; a dashed box "No projects yet. Projects you open or create appear here." |
| W10 | Covered | The banner "Install uv to create or run a project." with "How to install uv"; "New project" disabled with no reason on the button itself; "Open folder" enabled; Terraform's note. |
| W11 | Missing | The board's `view` switch takes one value, so first launch and missing tools cannot show together. Python missing or the wrong version: not drawn. |
| W12 | Partly | Both entry points are drawn as working links. The not-yet state: not drawn. |
| W13 | Partly | [`Start-Welcome-NotAProject`](https://claude.ai/artifact/HxwXUwENoUhpnjKdQb1k8j#artboard-Start-Welcome-NotAProject): a modal "No OAK project in this folder" with the three actions. One state only: Python project without OAK, empty folder and unreadable folder are not drawn. |
| W14 | Missing | Not drawn. Opening goes straight to the canvas. |
| W15 | Missing | Welcome has no desktop shell, so no Commands panel. Nothing on Welcome shows the detection commands. |

**Drawn, but no requirement asks for it:** the header's settings control, a second way to settings beside the
brief's link (harmless: one is the app's, one is the toolchain's); the folder line in every view; the AWS
"Signed in" check. The `uv` banner draws a warning triangle in the danger tone with role "status"; under the
built `InlineBanner` a danger banner has the danger icon and role "alert".

**Drawn here, built in a later phase:**

| Drawn on | Content | Built in |
|---|---|---|
| `Start-Welcome-Settings` | The settings dialog's Toolchain section (paths, "Recheck", the field for a tool not found automatically), Cloud, General | P4 (settings pages); P2 builds only the `ToolchainService` it reads |
| `Start-Welcome-Settings` | Coding agents | P6 |
| `Start-Welcome-Settings` | The "This project" group disabled with no project open | P4 (Secrets) and P6 (Agent permissions). The 55 % fade fails 4.5:1; use the disabled style with its reason line, not opacity. |
| `Settings-AgentPermissions` | Skills, file edits, "Running commands", the Terraform lock, checkpoints | P6. Its "Running commands" choice feeds section 3, question 3. |
| `Start-Welcome-NotAProject` | "Create a project here" | P4 wires it; P2 draws the modal |
| `Start-Welcome` | "New project", "Describe a project" | P4 and P6; P2 shows their not-yet state |

### Step 3: questions to settle

#### Question 1: what a first-time person with nothing installed sees first

| | A. One Welcome, first launch and missing tools together (recommended) | B. A setup screen before Welcome | C. Welcome as drawn, the check in the card only |
|---|---|---|---|
| What | The first-launch left column, with a danger banner that names only the missing required tools ("Install Python 3.12 or 3.13 and uv to create or run a project.") and one install link each. The card shows "Checking this computer" as a job while detection runs, then every tool, grouped as in question 2. "Open folder" stays enabled. | A "Get this computer ready" page: Python and `uv` first, then the optional tools; it gives way to Welcome once the required ones are found | First launch as drawn; missing tools show only as rows in the card |
| For | No new screen; the person sees the job of the app and what blocks it at once | A guided first run | Nothing new to draw |
| Costs | The board's view switch needs a combined view; the left column carries a banner and the empty box | A second first screen to design, test and keep in step with Welcome and Settings; it blocks "Open folder", which works without `uv` | A person with nothing installed is not told what blocks them until they try |

**Recommendation: A.** In P2, the primary action on first launch is **"Open folder"**: "New project" cannot be
wired before P4. From P4 on, "New project" becomes primary on first launch, as drawn. The not-yet state for P2
(W12): "New project" and "Describe a project" stay in place, not runnable, with a caption under them saying they
arrive in a later build. They never ship in a release, since P4 and P6 are in Release 1. "Toolchain settings"
is left out until P4 fills the Toolchain section; until then W8's settings link is met by the header's settings
control alone, which opens P1a's settings dialog (the theme).

#### Question 2: whether a missing optional tool looks different from a missing required one

| | A. Two tiers (recommended) | B. One look, as drawn | C. Optional tools hidden until needed |
|---|---|---|---|
| What | The card is grouped: "Needed for everything" (Python, `uv`), "Needed by some features" (Claude Code, Terraform, Docker, the cloud tools), "Optional" (git). A required tool missing or the wrong version is `StatusChip` failed ("Missing", "Wrong version") and raises the banner. An optional tool missing is `StatusChip` not set up ("Not installed"), its caption says what it affects ("Deploy. Only deploying is affected."), and it raises no banner. | Every missing tool is failed; only the caption differs | Optional tools show only in Settings and in each feature's own prerequisites (P10's Deploy checks) |
| For | Red only where the app cannot work; nothing is hidden; uses the built chip states | Nothing to change | A short card |
| Costs | Two group headings; an optional tool of the wrong version needs a label in the not-set-up state ("Wrong version") | A person who will never deploy sees red for Terraform | Against brief 02, which lists them; a person learns late that a feature needs a tool |

**Recommendation: A.** Every row has its install link, as `ToolchainRow` in brief 01 asks.

#### Question 3: where each recent project's OAK version shows

| | A. In the row, as text (recommended) | B. In a tooltip on the row | C. A version column with a chip on every row |
|---|---|---|---|
| What | Between the framework marks and "last opened": "OAK 0.10.2" in monospace figures. Off states add a word and an icon: "OAK 0.9.3 · read-only" (warning icon), "OAK 0.12.0 · newer" (info icon), "OAK >=0.10 · not installed" (the not-set-up icon). | The version shows on hover or focus | A column of `StatusChip`s ("Supported", "Read-only") |
| For | Seen before opening; matches 2.6 and the `Card` story's placement | A quieter row | Strong scanning |
| Costs | A little more row width; at 1100 px the framework marks give way first. The off states are shown outside `StatusChip`, as in the status bar (section 2), with the same catalogue line. | Hidden on a touch-free glance; tooltips are not for facts needed to decide | A state chip on every row where most say "fine"; noise |

**Recommendation: A.** The version shown is the one recorded when the project was last opened; Welcome reads
no project files; it only checks that each folder still exists. It updates the next time the project opens. A row whose folder is gone (W4) keeps its place
with "Folder not found" and "Remove from list", in the error family's banner form inside the row.

#### Question 4 (found in review): where detection commands show on Welcome

Welcome has no shell and no Commands panel, yet every command must be visible (W15).

| | A. "Show commands" opens the Commands view in a dialog (recommended) | B. Welcome gets the bottom panel | C. Each tool row expands to its command |
|---|---|---|---|
| What | The toolchain job's "Show commands" (P1b row a) opens a dialog with the Commands panel's own view, filtered to the job | The shell's bottom panel under Welcome | A `CommandRow` inside each `ToolchainRow` |
| For | The same link and view as every other job; nothing new to learn | One home for commands | The command next to its result |
| Costs | A second frame for the Commands view. With the master and detail of section 3 it does not fit the built 480 px `Modal`, so it needs a new, wider dialog size. | Brings a shell piece onto a page without a shell; a collapsed strip on an otherwise calm page | Doubles every row's height when open; the opening job's commands have no row |

**Recommendation: A.** Commands run on Welcome are kept and also appear in the Commands panel once a project
opens. Opening a project is a job too (W14): it shows inline under the actions, after one second, with "Stop"
and "Show commands".

## 2. Status bar

### Step 1: requirements

| # | Requirement | Source |
|---|---|---|
| S1 | Working directory | Brief 00, P2 gate |
| S2 | Git branch, when the folder is a repository | Brief 00, P2 2.3 |
| S3 | Python environment state | Brief 00, P2 gate |
| S4 | File sync state | Brief 00, P2 gate |
| S5 | The project's OAK version and where it came from (installed, `uv.lock`, `pyproject.toml`) | P2 2.4, 2.6 |
| S6 | Below the floor (older than 0.10): read-only with a banner | P2 2.5, decided 26 Nov 2026 |
| S7 | Newer than the Studio knows: treated as the newest known, with "Studio update available" | Decided 26 Nov 2026 |
| S8 | Holds at 1100 px; its narrow rule | UX checklist; `status-bar.tsx` leaves the rule to this gate |
| S9 | State is never colour alone | Ground rules |

### Step 2: review of the artboards

| # | Status | What [`StatusBar`](https://claude.ai/artifact/HxwXUwENoUhpnjKdQb1k8j#artboard-StatusBar) draws |
|---|---|---|
| S1, S2 | Covered | `~/code/support-triage` with a folder icon, `main` with a branch icon |
| S3 | Partly | One state only: "Python environment ready". (The built bar's `NotReady` story has "No Python environment".) |
| S4 | Covered | "Files in sync", "1 change from outside the app", "app.py cannot be read" |
| S5 | Missing | No version. (The built bar has the slot, filled in its story with "OAK 0.10.2", and the Studio's version.) |
| S6, S7 | Missing | Not drawn |
| S8 | Partly | The board wraps to a second line when short of room; the built bar never wraps and cuts the last items |
| S9 | Fails | States told apart by text colour only; the built bar uses `StatusChip`s |

The coding agent's item ("Claude Code connected", "is working", "not found") is drawn here and built in P6;
its copy becomes "Claude Agent".

### Step 3: questions to settle

#### Question 1: where the project's OAK version lives, and how its states look

| | A. The built slot, at the end, pressable (recommended) | B. At the start, after the branch | C. Inside the Python item |
|---|---|---|---|
| What | "OAK 0.10.2" before "Studio 0.1.0", as in the built story. Pressing it opens a popover: the version, where it came from ("Installed in `.venv`", "From `uv.lock`", "From `pyproject.toml`, not installed yet"), the Python version, the installed frameworks and extras, and, in an off state, the reason and the upgrade command to copy. | Grouped with the project's facts: path, branch, version | "Python 3.12 (.venv) · OAK 0.10.2" |
| For | Built and tested; the popover is the one place that says "these frameworks installed" (P2's outcome) | Facts at the start, states at the end | One item fewer |
| Costs | Two version numbers side by side; the labels "OAK" and "Studio" keep them apart. "Read-only" and "not installed" are states shown outside `StatusChip`, against the ground rule "the state of something: `StatusChip`"; the catalogue needs a line saying a version item carries its state as an icon and a word. | The start shrinks first, so the version would be cut before the states; changes the built order | Two meanings in one chip; a long label |

**Recommendation: A.** The version is a fact, not a state, so the item is quiet text, not a `StatusChip`. The
off states add an icon and a word, never colour alone:

| State | Item | Elsewhere |
|---|---|---|
| Supported | "OAK 0.10.2" | None |
| Not installed yet | "OAK >=0.10 · not installed", not-set-up icon | The Python item already says "No Python environment" |
| Below the floor | "OAK 0.9.3 · read-only", warning icon | The banner below |
| Newer than known | "OAK 0.12.0 · Studio update available", info icon | The popover: "This Studio knows OAK up to 0.10. Features show as in 0.10." No banner and no toast: nothing is blocked, and a toast is only for background work that finished. |

The icons are the warning and info icons `InlineBanner` uses. `StatusChip` has no warning or info state; using
its "waiting" clock for "read-only" would misread, and adding a sixth state is a catalogue change.

**The below-floor banner** (P1b left its placement to P2):

| | A. Full width under the top bar, on every tab, not dismissible (recommended) | B. At the top of each view | C. Status bar and a modal on open |
|---|---|---|---|
| For | One banner for a project-wide state, placed like the run failure on [`Builder-TestTrace-StartFailed`](https://claude.ai/artifact/HxwXUwENoUhpnjKdQb1k8j#artboard-Builder-TestTrace-StartFailed), a banner directly under the top bar | Follows P1b's view banner | Quiet after the first read |
| Costs | The banner's height, for as long as the project is below the floor | The same banner repeated per tab; P2 has no Builder views yet | A modal on every open; easy to forget after |

**Recommendation: A**, an `InlineBanner` in the warning tone (its header comment already names this use): "This project uses OAK 0.9.3. OAK Studio supports 0.10 and later, so it opens
read-only." Then "To change it here, upgrade OAK in this project:" and the upgrade command in a `CodeBlock`
with copy, and a link to the release notes. It cannot be dismissed, since the state lasts until the project
changes; it goes when `pyproject.toml` or `uv.lock` changes and the version re-resolves above the floor.

#### Question 2: the status bar's narrow rule

| | A. A drop order (recommended) | B. Wrap to two lines, as drawn | C. Cut at the edge, as built |
|---|---|---|---|
| What | The path shrinks first (as built). Then the Studio version hides (it is in About). Then the file sync and coding agent chips show their icon only, with the label as the accessible name and a tooltip. The OAK version item never hides. | The bar grows to two rows | The last items are cut |
| Costs | One more rule and story (`At1100`); icon-only chips rely on the tooltip for sighted readers. P1b row a already approved an icon-only `StatusChip` for tab badges, so the variant exists in the plan. | A bar twice as tall; the layout shifts | The version, the most important new item, is the one cut |

**Recommendation: A.**

## 3. Commands panel

### Step 1: requirements

| # | Requirement | Source |
|---|---|---|
| C1 | Every command the app ran, as it was run | PRD 4.2, brief 00 rule 2 |
| C2 | Each: the literal command, its folder, duration and exit status (running, succeeded, failed) | Brief 01 `CommandRow` |
| C3 | Its output | PRD 4.2, brief 01 |
| C4 | A long output | P2 gate question |
| C5 | Stop a running command | UX checklist ("a way to cancel long commands"), P2 2.1 |
| C6 | Secret values masked in the recorded command | P2 2.1, brief 00 rule 4 |
| C7 | Filter to one job's commands ("Show commands") | P1b row a |
| C8 | Commands run by the coding agent appear too, told apart (later) | Brief 00, brief 05, P2 gate question |
| C9 | Follow, "Jump to latest", copy, clear | P1b row b, catalogue |

### Step 2: review of the artboards

The [`BottomPanel`](https://claude.ai/artifact/HxwXUwENoUhpnjKdQb1k8j#artboard-BottomPanel) board has two
command lists: the `deploy` scene's, and the one the `build` and `runfail` scenes share. Every board that imports
the panel passes one of these three scenes
([`Builder-Deploy`](https://claude.ai/artifact/HxwXUwENoUhpnjKdQb1k8j#artboard-Deploy) opens it on Commands).

| # | Status | What is drawn |
|---|---|---|
| C1, C2 | Covered | One row per command: a status chip, the command, its folder, its duration (`uv sync`, `~/code/support-triage`, `6.1 s`) |
| C2 (running) | Missing | Every row is "Done" or "Exit 1"; no running row. "Exit 1" is in the warning tone; a non-zero exit is failed. |
| C3, C4 | Missing | No output; rows do not expand |
| C5 | Missing | No stop in the panel. Stops are drawn only where the work shows: the job's "Stop" on [`Builder-Deploy-Applying`](https://claude.ai/artifact/HxwXUwENoUhpnjKdQb1k8j#artboard-Builder-Deploy-Applying), the drawer's "Stop" on [`Builder-AIDrawer`](https://claude.ai/artifact/HxwXUwENoUhpnjKdQb1k8j#artboard-AIDrawer), the chat's "Stop" while streaming and the run control's "Stop". |
| C6 | Not drawn | No command on the board carries an environment value |
| C7, C9 | Missing | Not drawn |
| C8 | Missing | The `build` scene mixes the app's commands with the coding agent's (`uv add 'agentkernel[langgraph]'` and `uv run pytest -q`, which [`Builder-AIDrawer`](https://claude.ai/artifact/HxwXUwENoUhpnjKdQb1k8j#artboard-AIDrawer) shows the agent running) with no marker |

### Step 3: questions to settle

#### Question 1: how a long output is shown

| | A. Master and detail inside the panel (recommended) | B. Rows expand inline, as brief 01 says | C. Output opens in a dialog |
|---|---|---|---|
| What | The command list on the left (about 360 px), the selected command's output on the right as one `StreamingListView`, full panel height, with a header: the command, status, duration, "Copy", "Clear" and, while running, "Stop" | A row opens below itself to its output, capped at about 12 lines with its own scroll | Each row has "Show output" |
| For | Uses the panel's width; one streaming list, so the 10,000-line burst stays cheap; the list keeps its scroll and selection (the catalogue's master and detail) | Matches the brief | Room for any output |
| Costs | Changes brief 01's "expandable"; at 1100 px the output column is about 700 px | Nested scroll areas in a 200 px panel; many lists at once under a burst | A modal for reading, away from the work |

**Recommendation: A.** A new command does not take the selection; the person's choice stays. The output keeps
the last 10,000 lines per command; beyond that its first line says how many earlier lines were dropped. The
record list itself lasts for the open project (the project scope); keeping it across restarts is not asked for.
Masked values show as the variable's name and `[hidden]` (`OPENAI_API_KEY=[hidden]`), never a value or dots of
its length.

#### Question 2: how a running command is stopped

| | A. "Stop" in the output header, which stops the owning job (recommended) | B. Stop only where the job shows | C. "Stop" on every running row |
|---|---|---|---|
| What | While running, the header shows "Stop" (secondary). It asks the job that owns the command to stop (`job.cancel`), with the job's own caution beside it where stopping is unsafe (as on `Builder-Deploy-Applying`). A command with no job is its own job. | The panel is a record only | A stop control in the list |
| For | One stop path; the job never finds a step killed behind its back | The panel never acts | One click from the list |
| Costs | The header needs the job's caution text | Someone reading a hung command must find its view | Stop controls in a dense list; easy to hit by mistake |

**Recommendation: A.** A stopped command shows "Stopped" with the not-set-up icon, since a stop by the person is
not a failure. Cost: `StatusChip` has no "stopped" state, and its label overrides are meant to keep the state's
meaning; "Stopped" stretches "not set up". The alternative is a sixth state, a catalogue change.

#### Question 3: how commands run by the app will differ from those run by the coding agent

| | A. A "run by" marker and a filter (recommended) | B. Separate lists | C. No difference |
|---|---|---|---|
| What | `CommandRunner` records a `source` (app or coding agent) from P2. From P6, an agent's row carries the sparkle and "Claude Agent" in the AI style, and says how it was allowed ("Approved by you", "Allowed by your list", from `Settings-AgentPermissions`). App rows carry no marker. A filter above the list: All, App, Claude Agent; the job filter from "Show commands" sits beside it as a removable chip. | Two sections or two views | One list, as drawn |
| For | One list in run order; the AI colour marks only the coding agent; the field costs nothing now | Clear split | Nothing to build |
| Costs | A filter control; a field in the run record | Loses the order of events across both; a fourth tab is not allowed | The person cannot tell who ran what, which matters once the agent runs commands |

**Recommendation: A**, with only the `source` field built in P2.

## 4. Version states

### Step 1: requirements

| # | Requirement | Source |
|---|---|---|
| V1 | A feature the project's version lacks shows as unavailable with the version that adds it, never as a broken control | UX checklist, catalogue |
| V2 | On a tab, a form section and a palette tile | P2 gate |
| V3 | "Removed in {until}", with `replacedBy` | P2 2.5 |
| V4 | An upgrade hint that shows the command and never runs it silently | P2 gate |

### Step 2: review of the artboards

No version state is drawn on any board (design-process.md, "No version states"). The node palette on
[`Builder-Canvas`](https://claude.ai/artifact/HxwXUwENoUhpnjKdQb1k8j#artboard-BuilderCanvas) has "Search
nodes", the groups Build (Agent, Tool, Hook, Output schema) and Connect (Channel, Protocol), the collapsed groups
Remember, Guard, Scale and Observe, and "Drag a tile onto the canvas, or click it." Tab and section: settled in
P1b, applied as they are.

### Step 3: the palette tile

This is the canvas's node palette (`PaletteTile`, built in P5), not the command palette.

| | A. The tile stays, tagged, with a popover (recommended) | B. Gathered in a group at the end | C. Dimmed, with a tooltip |
|---|---|---|---|
| What | The tile keeps its place and group, with a "Needs {since}" tag in text. It does not drag. Pressing it, or Enter, opens a popover: "{Feature} needs OAK {since} or later. This project uses OAK {version}.", the upgrade command with copy, and the docs link. "Search nodes" still finds it. Removed: "Removed in {until}", and the popover links the `replacedBy` tile. | A collapsed group "Needs a newer OAK" at the bottom | The tile faded; the reason on hover |
| For | P1b's leaning for one control; nothing hidden; the same words as the tab and section | Keeps the main groups clean | Smallest |
| Costs | A tile that refuses to drag (its drag start draws no ghost); one popover | The feature leaves its group, so a person looks in the wrong place | Fading fails 4.5:1; a tooltip-only reason; no keyboard reason |

**Recommendation: A.** It is also the first "one control" case, so P6 and P7 start from it.

**The upgrade command.** P2's `KernelService` builds it from the project's own dependency line, keeping its
extras, in the form the OAK docs use (`docs/docs/installation.md`), with the new lower bound: for example
`uv add "agentkernel[openai,langgraph,adk]>=0.10"`. The Studio shows it and never runs it by itself (P1b row d).

## Not drawn, found while reading

For the list of differences sent to the team after the gate (design-process.md):

- Welcome: no combined "first launch with missing tools" view; Python missing or wrong version; the "wrong
  version" state; paths; install links on rows; the Azure and Google Cloud tools; a recent project's version; a
  missing recent folder; opening progress; the not-yet entry points; the empty-folder, Python-without-OAK and
  unreadable-folder states; any place for the detection commands.
- Docker's caption differs: "Deploy targets that ship a container image" on Welcome, "Containerized deploy
  targets" in the settings dialog. The second is wrong: Google Cloud serverless also needs Docker (P2 2.2).
- The settings dialog fades the "This project" group to 55 %; faded text fails contrast.
- The `uv` banner on Welcome and in settings mixes a warning icon with the danger tone, with role "status".
- Status bar: no version; one Python state; states by colour only; wraps where the built bar does not.
- Commands panel: no running row, output, stop, filter or "run by"; "Exit 1" in the warning tone.
- No version state anywhere.
- The boards label the coding agent "Claude Code"; the Studio's copy says "Claude Agent".

## Sign-off

Each row is approved or not as a whole. A "no" names the option picked instead, or the screen to draw first. The
picks go into the P2 sign-off table and the README decision log.

| Row | Screen | Recommendations | Approved (yes or no) |
|---|---|---|---|
| (a) | Welcome | First launch and missing tools in one view, the banner naming only the missing required tools; "Open folder" primary in P2, the two other entry points shown with a not-yet caption, "Toolchain settings" left out until P4. Tools grouped in three tiers; red only for required tools. Each recent project's version as text in its row, from its last open. Detection and opening are inline jobs; "Show commands" opens the Commands view in a dialog. | Yes, 26 Nov 2026 |
| (b) | Status bar and Commands panel | The version in the built slot, pressable, with a popover for source, Python, frameworks and extras; off states with an icon and a word; below the floor a full-width warning banner under the top bar; newer than known a notice in the item and popover only; a drop order for narrow widths. Commands as master and detail with one streaming list; "Stop" in the output header stops the owning job; a `source` field now and a "run by" marker and filter from P6. | Yes, 26 Nov 2026 |
| (c) | Version-unavailable pattern | Tab and section as P1b approved. Palette tile: stays in place with a "Needs {since}" tag, does not drag, and opens a popover with the version, the upgrade command and the docs link; the precedent for one control. The upgrade command built from the project's own dependency line, shown and never run. | Yes, 26 Nov 2026 |
| (d) | Drawn first | Any screen or state the owner wants drawn on the canvas (gate step 3) before deciding. Name it here; its row above then waits for the drawing. | None: all three rows decided from this note, 26 Nov 2026 |
