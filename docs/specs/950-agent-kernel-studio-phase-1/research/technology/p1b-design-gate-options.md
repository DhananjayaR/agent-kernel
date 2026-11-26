# P1b design gate: options for the shared patterns and the command palette

**Date:** 26 November 2026. **Gate steps covered:** 1 (requirements), 2 (review of the sketch) and 3 (options),
for the eight patterns in [P1b](../../implementation/P1b-data-layer-and-patterns.md#design-gate) and the command
palette (ruling 15 of the [P1b plan](../../implementation/P1b-plan.md#pre-flight-rulings-26-november-2026)). The
options are written here, not drawn: the last sign-off row lets the owner ask for any pattern to be drawn on the
canvas first. Steps 4 and 5 (stories, review) are Tasks 15 to 17 of the plan. **Nothing here is approved.** The
owner picks; the pick is recorded in the P1b sign-off table and the README decision log.

## Sources

- The briefs: [00](../../00-project-brief.md), [01](../../01-app-components.md), [02](../../02-welcome.md),
  [04](../../04-agent-canvas.md), [05](../../05-build-with-ai.md), [07](../../07-builder-test-and-trace.md),
  [08](../../08-builder-deploy.md).
- The Claude Design "OAK Studio Phases" (<https://claude.ai/artifact/HxwXUwENoUhpnjKdQb1k8j>), read on 26
  November 2026 while someone was editing it: the base artboards at version `1795623844-6df8`, the variant
  artboards at `1795692566-7fd1`, and a last check at `1795693123-abc2`. Between the first and the last read only
  Welcome and Settings changed (settings now open as a dialog over Welcome; two new boards,
  `Start-Welcome-Settings` and `Settings-AgentPermissions`). Every artboard cited here is unchanged, and the
  changed and new ones draw none of these patterns. Most variant artboards are a view of a base artboard
  (`Builder-Canvas-Unreadable` is `Builder-Canvas` with its `unreadable` view), so a claim about a variant was
  checked in the base artboard's markup for that view. Every artboard link below names a board in `canvas.json`
  at the last version.
- The components already built in `ak-studio/packages/ui/src/components/`.
- [conventions-and-skills.md](../../implementation/conventions-and-skills.md) sections 1 and 2 (ground rules and
  the pattern catalogue), [design-process.md](../../implementation/design-process.md), the P1b plan's rulings 6,
  11, 13 and 15 and Tasks 9 and 15 to 17, and the gates of
  [P2](../../implementation/P2-project-and-kernel-version.md#design-gate) and
  [P3](../../implementation/P3-read-only-builder.md#design-gate).

## What P2 and P3 need

P1b builds every pattern for the About slice, but only what P2 and P3 use is settled in full here. The rest is
settled at the gate of the phase that first uses it, on top of the shape agreed now. "First used" follows the
build order, not the phase numbers: P2, P3, P6, P7, then P4, P5, then P8 onward
([P4 to P12, Order](../../implementation/P4-P12.md#order)).

| Pattern | First real use | Settled now | Settle when first used |
|---|---|---|---|
| Job progress | P2 (toolchain detection, opening a project), P3 (the introspection helper) | Inline or panel; several jobs | Step lists for many-step jobs (P6's plan card, then P4's new project and P10's deploy) |
| Approval | P6 (the coding agent's permission requests) | One layout in three frames | The chat card's extras (P6, P8); the Deploy step and its checkbox (P10) |
| Background job notice | P6 (the coding agent works while the person is on another tab) | Tab badge and toast wording | Where a list of running jobs lives (P6) |
| Session control | P6 (coding agent), P8 (local run) | The generic control the About ticker uses | Top bar details (P8); status bar details (P6) |
| Streaming list | P2 (command output in the Commands panel) | Wrapping, ANSI colour, the controls | A wrap toggle (P8, the run log) |
| Changed on disk | P2 (the watcher's notice), P3 (canvas, Code, Config) | Banner placement | The compare view (P6 draws the first diff; conflicts need it from the first working copy) |
| Unsaved changes guard | The first editable working copy (P7 if rules are edited in a form, else P4) | The dialog's shape, for the About slice | Its copy per view (same phase) |
| Version gate | P2 (below the supported floor), P3 (a Config section) | Tab and section sizes | One control (likely P6 or P7, a skill or `ak rules check` the installed version lacks; else P5, palette tiles) |
| Empty, cannot read, error | P2 (Welcome), P3 (canvas, Code, Config) | One layout family | Partial results per view (P3's own gate) |
| Command palette | P1b (the About command), then every phase | Placement, grouping, disabled commands | File search (P3, with the Code tab) |

## 1. Job progress

**Requirements:** title, step, elapsed time, cancel, link to commands, result or error.

**Where it appears**

- [`Start-NewProject-Creating`](https://claude.ai/artifact/HxwXUwENoUhpnjKdQb1k8j#artboard-Start-NewProject-Creating):
  a column of five step cards, each a status chip ("Done", "Running", "Waiting"), the step's name and its
  command as a chip. The running step has a spinner and its output in a code block. The footer says "Step 3 of
  5 is running. The project opens when the last step finishes." Elapsed time: not drawn. Cancel: not drawn (the
  header's "Cancel" link goes to Welcome; what it does to the running job is not said).
- [`Builder-Deploy-Applying`](https://claude.ai/artifact/HxwXUwENoUhpnjKdQb1k8j#artboard-Builder-Deploy-Applying):
  five numbered step cards with status chips. The running step shows a spinner, the literal command
  `terraform apply tfplan`, "Stop", a progress bar, the output in a code block and the caution "Stopping can
  leave some resources created. A new plan shows the current state." The bottom panel is open on Commands and
  the top bar's deploy status reads "Applying". Elapsed time: not drawn (only Terraform's own "[10s elapsed]"
  inside the output). Brief 08 also asks for a count of resources created so far: not drawn.
- [`Builder-Deploy-Failed`](https://claude.ai/artifact/HxwXUwENoUhpnjKdQb1k8j#artboard-Builder-Deploy-Failed):
  the step ends in "Exit 1", the error excerpt, a warning note, "Show log", "Run plan again" and an AI button.
- [`Builder-AIDrawer`](https://claude.ai/artifact/HxwXUwENoUhpnjKdQb1k8j#artboard-AIDrawer): a plan card whose
  lines tick off, and "Claude Code is working" with "Stop" at the foot of the drawer.
- [`BottomPanel`](https://claude.ai/artifact/HxwXUwENoUhpnjKdQb1k8j#artboard-BottomPanel), Commands: one row per
  command: status chip, the command, its folder and its duration.
- Brief 01 names `ProgressBar` and `CommandRow`; brief 08 says every command in the steps also appears in the
  Commands panel.

**Already built:** `StatusChip` (running, passed, failed, waiting), `Spinner` (labelled, for short waits only),
`CodeBlock`, and the bottom panel's Commands tab.

### Inline, in the bottom panel, or both

| | A. Inline, commands in the panel (recommended) | B. Bottom panel only | C. Inline only |
|---|---|---|---|
| What | The job shows in the view that started it. Each command it runs is a row in the Commands panel. "Show commands" opens the panel on those rows. | A fourth bottom-panel tab, "Jobs", holds every job; views show one status chip. | The job shows its commands and output inline; no link to the panel. |
| For | Matches both artboards and the catalogue; progress sits where the person acted | One place for everything | Simplest to build |
| Costs | Two places show parts of one job; the panel needs a filter by job | Progress is away from the action; `BOTTOM_PANEL_TABS` is a fixed three-tab list in an unsigned shell (ruling 4), so a fourth tab reopens it | Breaks "every command is visible" in one place (brief 00, rule 2) |

**Recommendation: A.** It is what both artboards draw, and the Commands panel already exists for commands.
The inline job, as built in Task 15:

- a title naming the job ("Detecting the toolchain"), a `StatusChip`, the current step ("Step 2 of 5 · Install
  dependencies") and the elapsed time in monospace figures ("1 min 12 s"), shown from one second on;
- "Stop" (secondary) while it runs, with the job's own caution line where stopping is unsafe, as in
  `Builder-Deploy-Applying`. The label is "Stop", as drawn: it stops a process, and "Cancel" stays for dialogs;
- "Show commands", a link that opens the Commands panel filtered to the job;
- a progress bar only when the service reports a fraction (Terraform's resource count); otherwise the step
  count is the progress;
- at the end, a one-line result with `StatusChip` "Done", or the error in the error family (section 8).

A step list (one card per step, as in both artboards) is an optional part, used by jobs that declare their
steps. Its layout is settled when first used: P6 (the coding agent's plan card), then P4 (new project) and P10
(deploy).

### How several running jobs show

| | A. Stacked (recommended) | B. Latest only, "2 more" link |
|---|---|---|
| What | Each running job in a view is its own block, newest first | The view shows the newest job; a link lists the others |
| For | Nothing hidden; no new component | Less height |
| Costs | Height, if many run at once | A hidden job can be the one that fails or waits |

**Recommendation: A.** `JobService` serialises jobs by kind, so one view seldom has more than two. Across views,
see section 3.

## 2. Approval

**Requirements:** what will happen, what it affects, approve and deny; typed name for destructive ones.

**Where it appears**

- [`Builder-TestTrace`](https://claude.ai/artifact/HxwXUwENoUhpnjKdQb1k8j#artboard-TestTrace): a card in the chat,
  in the warning tone: "Approval required", the call `refund_payment(order_id="A-8841", amount=240.0)`, "Rule
  BR-004: amount > 200. During a local test you are the approver.", then "Approve" (primary), "Deny" and
  "Cancel". "Deny" and "Cancel" are wired to the same outcome. Approved, it becomes "Approved by you" with the
  call; denied, "Denied. The run ended. No refund was issued."
- [`Builder-AIDrawer`](https://claude.ai/artifact/HxwXUwENoUhpnjKdQb1k8j#artboard-AIDrawer): the same card in the
  drawer: "Approval required", "Claude Code wants to run:" and `uv run pytest -q` as a chip, "Approve", "Deny"
  and a link "Always allow this command in this project".
  [`Builder-AIDrawer-Resolved`](https://claude.ai/artifact/HxwXUwENoUhpnjKdQb1k8j#artboard-Builder-AIDrawer-Resolved)
  shows it approved, with the command's result and "View in Test & Trace".
- [`Builder-Deploy`](https://claude.ai/artifact/HxwXUwENoUhpnjKdQb1k8j#artboard-Deploy): the Plan step reads
  "Ready, waiting for you" with "View full plan", "Apply" and "Nothing is created until you confirm."
- [`Builder-Deploy-Confirm`](https://claude.ai/artifact/HxwXUwENoUhpnjKdQb1k8j#artboard-Builder-Deploy-Confirm):
  a modal, "Apply this plan?", naming the resource count, account, region and profile, a cost line, a checkbox "I
  have reviewed the plan" that enables "Apply", and "Cancel".
- [`Builder-Deploy-Destroy`](https://claude.ai/artifact/HxwXUwENoUhpnjKdQb1k8j#artboard-Builder-Deploy-Destroy):
  a modal, "Destroy the deployment?", naming the account and the command, a field "Type the project name to
  confirm", "Cancel" and a danger "Destroy".
- Brief 01: "`ApprovalCard` is one component. It serves agent approvals in a test run and coding-agent
  permission requests"; `ConfirmModal` has a destructive variant that names what will be affected.

**Already built:** `ConfirmModal` (default and destructive; the destructive one enables its action only when the
typed name matches exactly) and `Modal`.

### One layout that works as a card in a chat, a step in the Deploy tab and a modal

| | A. One body, three frames (recommended) | B. Two components, as the briefs | C. Modal everywhere |
|---|---|---|---|
| What | One approval body: the question, what will happen, "This affects" as labelled rows (account, files, command), an optional rule chip, then the actions. Framed as a card (chat, drawer, a step) or inside `ConfirmModal`. | `ApprovalCard` for chat and steps; `ConfirmModal` for deploy; shared copy rules only | Every approval opens a modal |
| For | One meaning, one component (ground rules); the card and the modal read the same | Matches the briefs' names | One look; the person cannot miss it |
| Costs | `ConfirmModal` is reworked to take the shared body | Two looks for one meaning; they drift | A modal per agent command interrupts the chat; the artboards keep it inline |

**Recommendation: A.** The frame follows one rule: **a card where the work happens; a modal when the approval
affects real infrastructure or is destructive** (brief 00, rule 3). Destructive always means a modal with the
typed name, which `ConfirmModal` already does. The Deploy step is a card whose primary action opens the modal,
as drawn. Two smaller picks:

- Drop "Cancel" from the chat card. It does the same as "Deny" on the artboard; stopping the whole run is the
  job's own "Stop".
- Approve and deny answer only through `job.respond` (P1b plan, Task 15). The card then shows the outcome in place,
  as drawn ("Approved by you", "Denied").

Settle when first used: "Always allow this command" (P6), the call's arguments and the rule chip for
human-in-the-loop requests (P8), the "I have reviewed the plan" checkbox (P10).

## 3. Background job notice

**Requirements:** a job finished or needs an answer on another tab.

**Where it appears**

- [`TopBar`](https://claude.ai/artifact/HxwXUwENoUhpnjKdQb1k8j#artboard-TopBar): the deploy status chip
  ("Applying", "Deploy failed") is visible from every tab and links to Deploy. It is a standing notice for one
  job kind.
- [`StatusBar`](https://claude.ai/artifact/HxwXUwENoUhpnjKdQb1k8j#artboard-StatusBar): "Claude Code is working".
- [`BottomPanel`](https://claude.ai/artifact/HxwXUwENoUhpnjKdQb1k8j#artboard-BottomPanel): a count on the
  Problems tab ("2").
- Badges on the app's tabs: not drawn. Toasts: not drawn. A list of running jobs: not drawn.
- Brief 01 lists `Toast` (success, warning, error).

**Already built:** `Toast` with a "Show" action (a toast with an action never times out; tones info, success,
danger); the shell's `tabBadges` slot (story `At1220WithBadges`, which uses a numeric `Badge`); `Badge`, whose
rule is "a count, never a state".

### Tab badge and toast wording

The real question for the badge is how "finished" differs from "needs an answer".

| | A. A state icon on the tab (recommended) | B. A count | C. A dot |
|---|---|---|---|
| What | The tab gets the `StatusChip` icon for the job's state (waiting, passed, failed), with an accessible name: "Deploy: needs your answer" | A `Badge` with the number of jobs needing attention | A coloured dot |
| For | Says which kind of attention; reuses the `StatusChip` icons | Already in the story | Smallest |
| Costs | A small icon-only variant of `StatusChip` for the slot; the story changes | A number does not say whether a job waits or finished; `Badge` is never a state | Colour alone: not allowed |

**Recommendation: A.** The badge goes when the person opens the tab. A waiting job's badge stays until it is
answered.

Toast wording, one template in one strings module, filled from the job's title:

| Event | Title | Description | Action | Tone |
|---|---|---|---|---|
| Finished | "{Job} finished" ("Apply finished") | The result in one line ("Deployed to AWS ECS Fargate.") | "Show" | success |
| Failed | "{Job} failed" | What happened ("`terraform apply` exited with code 1.") | "Show" | danger |
| Needs an answer | "{Job} is waiting for you" | The question ("Apply this plan?") | "Show" | info, stays until dismissed |

A toast appears only when the owning tab is not on screen; a job that waits is never only a toast (the badge and
the approval stay). Option B for wording, free text per feature, costs a review per feature and drifts.

### Where a list of running jobs lives

| | A. A status bar item | B. A "Jobs" tab in the bottom panel | C. No list yet (recommended) |
|---|---|---|---|
| What | "2 jobs running", shown only while one runs, opens a popover listing each job with its tab and "Show" | A fourth panel tab | Tab badges, the top bar's run and deploy chips and the native quit prompt (ruling 11) are the cross-app view |
| For | Always visible, small | Room for detail | Nothing to build now |
| Costs | One more status bar item; P2 settles the status bar's narrow rule | Reopens the fixed three-tab panel (ruling 4); duplicates Commands | No single list once many kinds run |

**Recommendation: C for now; settle when first used: P6.** P2 and P3 jobs are short and run in the view the
person is looking at. The coding agent (P6) is the first job that runs for minutes while the person works
elsewhere; A is the likely answer then.

## 4. Session control

**Requirements:** state, start, stop, key facts.

**Where it appears**

- [`TopBar`](https://claude.ai/artifact/HxwXUwENoUhpnjKdQb1k8j#artboard-TopBar): a status chip ("Local run
  stopped", "Starting", "Running · localhost:8000", "Local run failed") and one button, "Start" or "Stop", which
  links to Test & Trace. A link to the run log: not drawn.
- [`Builder-TestTrace-Stopped`](https://claude.ai/artifact/HxwXUwENoUhpnjKdQb1k8j#artboard-Builder-TestTrace-Stopped):
  "Start the project to test it", the command `uv run python app.py` as a chip and a primary "Start".
- [`Builder-TestTrace-StartFailed`](https://claude.ai/artifact/HxwXUwENoUhpnjKdQb1k8j#artboard-Builder-TestTrace-StartFailed):
  the failed chip, a danger banner and the bottom panel open on Run log.
- [`StatusBar`](https://claude.ai/artifact/HxwXUwENoUhpnjKdQb1k8j#artboard-StatusBar): "Claude Code connected",
  "Claude Code is working", "Claude Code not found", told apart by text colour only.
- [`Builder-AIDrawer`](https://claude.ai/artifact/HxwXUwENoUhpnjKdQb1k8j#artboard-AIDrawer) and
  [`Builder-AIDrawer-Disconnected`](https://claude.ai/artifact/HxwXUwENoUhpnjKdQb1k8j#artboard-Builder-AIDrawer-Disconnected):
  the drawer's header chip "Connected · this computer" or "Not found", and the not-found steps with "Recheck".

**Already built:** `RunControl` in `top-bar-controls.tsx` (StatusChip, start and stop, the port, a "Show the run
log" button when the run failed, a compact form below 1220 px, a "No project to run" state); the status bar's
`codingAgent` slot (a `StatusChip`, so never colour alone, unlike the artboard). The status bar's items have no
actions yet.

### Its place in the top bar (the run control)

| | A. Keep as built (recommended) | B. A split button with a menu | C. Chip only |
|---|---|---|---|
| What | Chip, one Start or Stop button, the port; "Show the run log" when the run failed | Chip plus a menu: start, stop, restart, show run log | Start and stop only in Test & Trace |
| For | Built and tested in P1a; matches the artboard | Room for restart and other actions | Quietest top bar |
| Costs | None now | A stop takes two clicks; a menu to build | The run is controlled away from other tabs; against brief 00 |

**Recommendation: A.** The generic `SessionControlView` for the About ticker is the same shape: state chip,
start or stop, key facts in monospace, "Show log". Restart and the port choice: settle when first used, P8.

### Its place in the status bar (the coding agent)

| | A. A state item that opens the drawer (recommended) | B. A state item with a Stop control |
|---|---|---|
| What | The `StatusChip` item as built, made pressable: it opens the drawer, or Settings › Coding agents when not found. Stop lives in the drawer. | The item plus a "Stop" while the agent works |
| For | One action, no stop control in the bar; one place to stop | Stop from anywhere |
| Costs | The status bar gains its first pressable item; one more click to stop from another tab | Two actions in a 32 px bar; two places to stop a turn |

**Recommendation: A.** Settle the rest when first used: P6. Copy follows the copy rules: the feature is "Claude
Agent" ("Claude Agent is working"); "Claude Code" names only the installed program ("Claude Code is not
installed").

## 5. Streaming list

**Requirements:** follow, jump to latest, copy, clear.

**Where it appears**

- [`BottomPanel`](https://claude.ai/artifact/HxwXUwENoUhpnjKdQb1k8j#artboard-BottomPanel), Run log: monospace
  lines, the error lines in the danger text colour. Commands: one row per command; expanding a row to its output
  is in brief 01 but not drawn.
- [`Builder-Deploy-Applying`](https://claude.ai/artifact/HxwXUwENoUhpnjKdQb1k8j#artboard-Builder-Deploy-Applying)
  and [`Start-NewProject-Creating`](https://claude.ai/artifact/HxwXUwENoUhpnjKdQb1k8j#artboard-Start-NewProject-Creating):
  live output in a code block inside the step.
- Follow, "Jump to latest", copy, clear, line wrapping, ANSI colour: not drawn anywhere. Brief 01 names
  `LogStream`, "streaming process output with follow and clear".

**Already built:** `CodeBlock` (static), the bottom panel's views. Task 16 adds `StreamingListView`, virtualised
with TanStack Virtual, and Task 18 checks a 10,000-line burst.

### Line wrapping

| | A. No wrap, scroll sideways inside the list (recommended) | B. Wrap | C. No wrap, with a "Wrap lines" toggle |
|---|---|---|---|
| For | Every row one height, so virtualising 10,000 lines stays cheap; reads like a terminal | Long errors read without scrolling | Both |
| Costs | Long lines need a sideways scroll inside the list (the page itself never scrolls sideways) | Rows of measured height: slower under the burst, and a scroll jump when a long line arrives | Both code paths, and the wrapped one carries B's costs |

**Recommendation: A.** Copy gives the full text of any line. Settle a toggle when first used: P8 (the run log's
long JSON lines).

### How ANSI colour maps to the tokens

This assumes `CommandRunner` (built in P2) runs commands without a terminal, so most tools print no colour at
all, and the mapping matters for the tools that force it. P2 confirms the assumption.

| | A. Collapse to existing tokens (recommended) | B. Strip all colour | C. A terminal palette |
|---|---|---|---|
| What | Red to `text-status-danger`, yellow to `text-status-warning`, green to `text-status-success`, dim to `text-muted`, bold kept; every other colour, background colours and 256-colour codes to `text` | Plain text | Sixteen new colour tokens per theme, each tuned to 4.5:1 |
| For | Errors and warnings stand out; passes contrast with no new tokens; never uses primary or the AI colour | Simplest; nothing to test | Faithful to the tool |
| Costs | A small parser; blue, cyan and magenta lose their meaning | Loses red errors, which the run log artboard shows | 32 tokens outside the brand, each with a contrast check; the colour roles are fixed |

**Recommendation: A.** The text itself still says "ERROR", so the state is never colour alone.

### Controls (no options needed)

A header row on the list with "Copy" (all buffered lines, or the selection) and "Clear" (empties the view; the
record in the Commands panel stays). "Jump to latest" appears at the bottom right only after the person scrolls
up; following resumes when they reach the end. P2's own gate settles how a long output and cancel look in the
Commands panel; it builds on this list.

## 6. Changed on disk and the unsaved changes guard

**Requirements:** a non-blocking notice; keep mine, take theirs, compare.

**Where it appears**

- [`Builder-Canvas-ChangedOnDisk`](https://claude.ai/artifact/HxwXUwENoUhpnjKdQb1k8j#artboard-Builder-Canvas-ChangedOnDisk):
  a warning banner floating at the top of the canvas, beside its own toolbar (undo, redo, zoom): "`app.py` changed on
  disk. The canvas was updated." with "Show changes" (a link to Code). The status bar reads "1 change from
  outside the app". Brief 04's "the affected node pulses once": not drawn.
- [`Builder-Code`](https://claude.ai/artifact/HxwXUwENoUhpnjKdQb1k8j#artboard-Builder-Code): "This is the file on
  disk. Edits here are saved to it, and changes made in another program appear here."
- "Keep mine", "Take theirs", "Compare", a diff view and the unsaved changes guard: not drawn. Brief 01 lists
  `DiffView`; `AgenticDev-Diff` and `Builder-TestTrace-Compare` are not drawn.

**Already built:** `InlineBanner` (warning and info tones; its header already names "changed on disk"), `Modal`,
`ConfirmModal`, the status bar's `fileSync` slot. P3 is read-only, so until the first editable phase the only
working copy is the About slice's preference.

### Banner placement relative to the view

| | A. In the flow at the top of the view; floating over a canvas (recommended) | B. Floating over every view | C. Status bar only |
|---|---|---|---|
| What | The banner sits under the view's toolbar and pushes the content down. On the canvas, a viewport the person pans anyway, it floats at the top, as drawn. | As on the canvas artboard, everywhere | The status bar item; the view re-reads quietly |
| For | Covers nothing in forms and code; matches the artboard on the canvas | One rule | Quietest |
| Costs | Two placements to document; content shifts once when the banner appears | Covers the first lines of code or a form's first fields | Easy to miss; the catalogue asks for a banner |

**Recommendation: A.** One more pick: the tone. With no working copy (all of P2 and P3) nothing needs deciding,
so the banner is **info** ("The canvas was updated") and can be dismissed. With a conflicting working copy it is
**warning** and carries "Keep mine", "Take theirs" and "Compare". The artboard and brief 00's colour table use
warning for every change on disk; this would narrow it to the case where a person must act.

### The compare view

Settle when first used: P6 draws the first diff (the pending-change review), and a conflict needs the compare
view from the first editable working copy (P7 or P4). The options to start from:

| | A. A wide modal, side by side | B. A diff inside the view | C. The Code tab, opened on the file's diff |
|---|---|---|---|
| Costs | A modal size wider than the 480 px `Modal` | Works for code; a canvas or a form is not text | Leaves the view that raised it |

Leaning to C: every view is a view of files, and one `DiffView` then serves the canvas, the forms and the code.

### The unsaved changes guard

Under ruling 11, quitting and closing the window are native dialogs. Only in-app navigation (leaving a tab,
closing the project) uses this dialog.

| | A. A modal: Save, Discard, Stay (recommended) | B. Save on leave, no question |
|---|---|---|
| What | Names what is unsaved ("Unsaved changes in `config.yaml`"); "Save" primary; "Discard" names the thing; Escape stays | The working copy is written when the person leaves |
| Costs | A third action beside `ConfirmModal`'s two | Writes at an undefined moment, against the working-copy rule ("write on a defined moment") |

**Recommendation: A**, built on `Modal`. Its copy per view: settle when first used (P7 if rules are edited in a
form, else P4).

## 7. Version gate

**Requirements:** the version that adds the feature, the upgrade command.

**Where it appears**

- Not drawn anywhere (design-process.md, "No version states").
- The nearest drawn things: [`Builder-Config`](https://claude.ai/artifact/HxwXUwENoUhpnjKdQb1k8j#artboard-Builder-Config)
  lists unset sections dimmed, which is a different meaning; the Deploy target cards say whether they need
  Docker; [`Start-Welcome-ToolchainMissing`](https://claude.ai/artifact/HxwXUwENoUhpnjKdQb1k8j#artboard-Start-Welcome-ToolchainMissing)
  marks a missing tool and says what it affects ("Deploy. Only deploying is affected.").

**Already built:** `EmptyState`, `InlineBanner` (its header names "opened read-only below the supported
version"), `CodeBlock`, `Tooltip`. `useCapability` and `CapabilityGate` come in Task 8.

### Sizes: a whole tab, a form section, one control

The catalog gives three answers: available, needs an upgrade (with `since`) and removed (with `until` and
`replacedBy`). Each size shows the last two.

| Size | A. Recommended | B. Alternative | Costs of B |
|---|---|---|---|
| Whole tab | The tab stays in the tab list. Its content is the `EmptyState` frame: "{Feature} needs OAK {since} or later", "This project uses OAK {version}.", the upgrade command in a `CodeBlock` with copy, and a link to the docs page. | The tab is hidden or disabled with a tooltip | Hiding breaks "never hides the feature silently"; a disabled tab gives its reason only on hover |
| Form section | The section stays in the section list with a "Needs {since}" tag in text (not dimming, which Config already uses for "not set"). Opened, the form shows an `InlineBanner` with the version and the command, and its fields read-only. | The section is left out of the list, with a footnote | Left out is hidden |
| One control | Settle when first used: likely P6 or P7 (a skill or `ak rules check` the installed version lacks), else P5 (palette tiles). Leaning: the control keeps its place, shows a version tag, and its popover gives the version and the command; never a bare disabled control. | | |

"Removed" uses the same frames: "Removed in OAK {until}", and a link to `replacedBy` when there is one. The
Studio shows the upgrade command and never runs it by itself; a "Run upgrade" button, if ever wanted, would be a
job with an approval.

**Recommendation: A** for the tab and the section. P2's gate has its own "version states" row; with this
settled, that row only applies it (the status bar's below-the-floor banner is P2's to draw).

## 8. Empty state, cannot read, error

**Requirements:** purpose and first action; file and line; what to do next.

**Where it appears**

- Empty:
  [`Builder-Canvas-Empty`](https://claude.ai/artifact/HxwXUwENoUhpnjKdQb1k8j#artboard-Builder-Canvas-Empty), a
  centred block: "Drop a node to start, or describe your system", where things are written, "Add agent" and the
  AI button "Describe it with AI".
  [`Start-Welcome-FirstLaunch`](https://claude.ai/artifact/HxwXUwENoUhpnjKdQb1k8j#artboard-Start-Welcome-FirstLaunch),
  a dashed box: "No projects yet. Projects you open or create appear here."
  [`Builder-TestTrace-Stopped`](https://claude.ai/artifact/HxwXUwENoUhpnjKdQb1k8j#artboard-Builder-TestTrace-Stopped)
  and [`Builder-AIDrawer-FirstExchange`](https://claude.ai/artifact/HxwXUwENoUhpnjKdQb1k8j#artboard-Builder-AIDrawer-FirstExchange)
  ("Nothing on the canvas yet") follow the same centred shape.
- Cannot read:
  [`Builder-Canvas-Unreadable`](https://claude.ai/artifact/HxwXUwENoUhpnjKdQb1k8j#artboard-Builder-Canvas-Unreadable),
  a danger banner floating over the last good canvas, drawn at 35 % opacity: "Cannot read `app.py`: syntax error
  at line 42. Showing the last view that could be read." with "Open in Code" and "Ask Claude Code to fix". The
  inspector reads "The inspector is paused. Fix app.py to edit nodes again." The status bar reads "`app.py`
  cannot be read". The [`BottomPanel`](https://claude.ai/artifact/HxwXUwENoUhpnjKdQb1k8j#artboard-BottomPanel)'s
  Problems tab lists problems as warning banners with a file chip.
- Error:
  [`Builder-TestTrace-StartFailed`](https://claude.ai/artifact/HxwXUwENoUhpnjKdQb1k8j#artboard-Builder-TestTrace-StartFailed),
  a full-width danger banner under the top bar: "The project did not start: `OPENAI_API_KEY` is not set.", with
  "Add the key in Settings" and "Ask Claude Code to fix" (brief 07 also lists "Show run log": not drawn).
  [`Builder-Deploy-Failed`](https://claude.ai/artifact/HxwXUwENoUhpnjKdQb1k8j#artboard-Builder-Deploy-Failed),
  the error inside the failed step.
  [`Start-Welcome-ToolchainMissing`](https://claude.ai/artifact/HxwXUwENoUhpnjKdQb1k8j#artboard-Start-Welcome-ToolchainMissing),
  a danger banner "Install uv to create or run a project." with an install link.
  [`Start-Welcome-NotAProject`](https://claude.ai/artifact/HxwXUwENoUhpnjKdQb1k8j#artboard-Start-Welcome-NotAProject),
  a modal with "Create a project here", "Choose another folder" and "Cancel".

**Already built:** `EmptyState` (icon, title, description, actions), `InlineBanner` (danger and warning, role
"alert" for danger), `PathChip`, the Problems tab. `ErrorView` and `errorPresentation` come in Task 17.

### One layout family for all three

| | A. Two frames, one set of slots (recommended) | B. Banners only | C. Centred only |
|---|---|---|---|
| What | The same slots everywhere: a title (what happened, or what this place is for), a description (what to do), the file and line as a `PathChip` with the line, one primary action and an AI alternative. When nothing is left to show, the centred `EmptyState` frame; when something is (partial results, a working view with an error), an `InlineBanner` at the top of the view, placed as in section 6. | Every state is a banner; an empty view gets a banner over blank space | Every state replaces the view with the centred frame |
| For | Matches all the artboards; the rule is one question: "is anything left to show?" | One frame | One frame |
| Costs | Two frames to keep in step (they share the slots and strings) | An empty canvas with a banner reads as an error; brief 04 draws a centred call to action | Loses partial results, which the catalogue and `Builder-Canvas-Unreadable` both keep |

**Recommendation: A.** Errors are placed by `errorPresentation`, as the catalogue's feedback placement says:
inline for a field, a banner for a view, a toast only for background work. "Fix with AI" shows only once the
coding agent exists (P6). P3's own gate settles partial results per view; one note for it: the artboard dims the
last good canvas to 35 %, and dimmed text fails the 4.5:1 rule, so the "last view that could be read" should be
marked by the banner and the paused inspector, not by fading.

## 9. Command palette

**Requirements** (the catalogue): one shortcut; every app command from the manifests; each command's shortcut
shown.

**Where it appears**

- Not drawn on any artboard, and named in no brief. The "Palette" on
  [`Builder-Canvas`](https://claude.ai/artifact/HxwXUwENoUhpnjKdQb1k8j#artboard-BuilderCanvas) is the canvas's
  node palette (a search field and node tiles), a different thing. To keep them apart, code and copy always say
  "command palette" for this one.
- The project switcher's menu (brief 00: open folder, new project, recent projects, reveal) is the nearest drawn
  list of app commands.

**Already built:** `Combobox`, `Menu`, `Modal` (React Aria). Task 9 exposes the command list
(`defineCommand({ id, title, args?, shortcut?, when?, run })`) and the clash test; app shortcuts do not act while
a modal is open (ruling 13).

### Placement and size

| | A. An overlay at the top centre (recommended) | B. A search field in the top bar | C. A standard modal |
|---|---|---|---|
| What | A search field and a result list in a floating layer about 640 px wide, near the top of the window, opened by the shortcut | An always-visible field whose results drop down | The 480 px `Modal` with a list in it |
| For | What people know from editors; room for a title and a shortcut per row | Visible without knowing the shortcut | No new size |
| Costs | One new overlay size | The top bar is already tight at 1100 px (P1a's compact rules) | Titles and shortcuts crowd at 480 px |

**Recommendation: A**, opened with **Mod+K** (Cmd+K on macOS, Ctrl+K elsewhere). It is free in the static
native menu (ruling 12) and in the shell; Mod+Shift+P is the alternative if the owner prefers the editor
convention. The palette is itself a modal, so Mod+J and other app shortcuts do not act while it is open. Rows use
the standard 40 px row height; shortcuts are right-aligned in monospace, in the platform's form ("⌘J" on macOS,
"Ctrl+J" elsewhere). File search ("go to file") joins when first used: P3, with the Code tab.

### Grouping

| | A. One flat list, feature as a prefix (recommended) | B. Grouped by feature, with headings | C. Recent first, then grouped |
|---|---|---|---|
| What | "Shell: Show or hide the bottom panel", in manifest order; search ranks across all | A heading per manifest | A "Recent" group first |
| For | One simple list box; search is not split by headings | Easy to scan with no query | Fast for repeated commands |
| Costs | Long and unstructured once there are many commands | Headings take rows; results split across groups | Stores recent commands in preferences |

**Recommendation: A.** P1b has a handful of commands. Recent commands: settle when the list grows.

### How a disabled or version-gated command shows

| | A. Listed with its reason (recommended for version gates) | B. Hidden (recommended for `when`) | C. Listed and runnable, opening the gate |
|---|---|---|---|
| What | The row stays, not runnable, with the reason where the shortcut would be: "Needs OAK 0.x" | Left out of the list | Running it shows the feature's version gate |
| For | Never hides a feature silently (ground rules) | No noise from commands that make no sense here ("Stop the local run" while stopped) | Teaches the gate |
| Costs | Each such command needs a reason | Hiding a version-gated command breaks the ground rules | A command that only explains |

**Recommendation: A for version-gated commands, B for context (`when`).** A command whose `when` is false does
not apply to what is on screen; a version-gated one exists but needs an upgrade. Cost to Task 9, which runs before
this gate: `defineCommand` gains an optional `capability` (the catalog id), and the palette reads the reason from
`useCapability`. If the owner wants every `when` to show a reason too, `when` must return a reason string, not a
boolean.

## Not drawn, found while reading

For the list of differences sent to the team after the gate (design-process.md):

- None of these is drawn: the command palette, toasts, badges on the app's tabs, "Keep mine", "Take theirs",
  "Compare", the unsaved changes guard, any version state, follow, "Jump to latest", copy, clear, wrapping,
  elapsed time, a running-jobs list.
- The [`StatusBar`](https://claude.ai/artifact/HxwXUwENoUhpnjKdQb1k8j#artboard-StatusBar) artboard tells states
  apart by text colour only; the built status bar uses `StatusChip`s.
- [`Builder-Canvas-Unreadable`](https://claude.ai/artifact/HxwXUwENoUhpnjKdQb1k8j#artboard-Builder-Canvas-Unreadable)
  fades the last good view to 35 %; faded text fails contrast.
- [`Builder-TestTrace-StartFailed`](https://claude.ai/artifact/HxwXUwENoUhpnjKdQb1k8j#artboard-Builder-TestTrace-StartFailed)
  lacks brief 07's "Show run log"; the test-run approval card has both "Deny" and "Cancel", wired the same.
- The artboards label the coding agent "Claude Code"; the Studio's copy says "Claude Agent".

## Sign-off

Each row is approved or not as a whole. A "no" names the option picked instead, or the pattern to draw first.
The picks go into the P1b sign-off table and the README decision log; Tasks 15 to 17 wait for their row.

| Row | Patterns | Recommendations | Approved (yes or no) |
|---|---|---|---|
| (a) | Job progress, approval, background notice | Job progress inline, with its commands in the Commands panel, "Stop", "Show commands" and elapsed time; several jobs stacked. Approval: one body, in a card where the work happens or a modal for real infrastructure and destructive actions; no "Cancel" on the card. Notice: a state icon on the tab, the toast template, no running-jobs list until P6. | Yes, 26 Nov 2026 |
| (b) | Session control, streaming list, command palette | Run control as built; the coding agent's status item opens the drawer. Streaming list: no wrap, ANSI collapsed to existing tokens, copy, clear and "Jump to latest". Command palette: a top-centre overlay on Mod+K; one flat list with feature prefixes; version-gated commands listed with their reason, commands whose `when` is false hidden. | Yes, 26 Nov 2026 |
| (c) | Changed on disk, unsaved guard | Banner in the flow at the top of a view, floating over the canvas; info tone without a working copy, warning with one; the compare view settled when first used. The in-app guard a modal with Save, Discard and Stay. | Yes, 26 Nov 2026 |
| (d) | Version gate, empty, cannot read, error | Version gate: an empty state for a tab, a tagged section with a banner for a form section, one control settled when first used. One family: the centred frame when nothing is left to show, a banner otherwise, with the same slots. | Yes, 26 Nov 2026 |
| (e) | Drawn first | Any pattern the owner wants drawn on the canvas (gate step 3) before deciding. Name it here; its row above then waits for the drawing. | None: all four rows decided from this note, 26 Nov 2026 |
