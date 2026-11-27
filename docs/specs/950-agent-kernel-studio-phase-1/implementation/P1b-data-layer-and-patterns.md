# P1b · Data and feature layer, shared patterns and skills

| | |
|---|---|
| Status | Built 27 Nov 2026 on Linux; final review pending. Execution plan: [P1b-plan.md](P1b-plan.md) |
| Business aspect | None visible to users. Makes every later feature look and behave the same, whoever writes it. |
| PRD milestone | Before milestone 1 |
| Depends on | [P1a](P1a-app-foundation.md) |
| Unlocks | P2 onward |
| Screens | The shared patterns, in Storybook; a throwaway "About" feature |
| Claude Design | None of its own. The patterns are drawn from the artboards of P2 to P10 |
| Design docs | [architecture.md](architecture.md), [conventions-and-skills.md](conventions-and-skills.md) |

## Outcome

The skeleton every feature is built on exists and is proven by one small real feature: operations declared in
the contract, handled by a service, read through hooks, shown with the shared patterns. Generators create new
features in that shape, CI rejects code that breaks the rules, and three tested skills teach the rules to
coding agents.

## Scope

**In**

- Approval of the architecture and the ground rules.
- The contract's four shapes (query, command, job, session), events, errors and revisions.
- `JobService`, `SessionService`, project scope, the service registry.
- The renderer's shared layer: caches, stores, connected components, the app command registry.
- The shared UX patterns as components.
- Generators, enforcement checks, the fixture project.
- The first three Studio skills, tested.

**Out**

- Any real project feature (P2). The capability catalog's content (P2).

## Approval gate

Before building:

- [x] Review [architecture.md](architecture.md). Record the approval, and any change, in the README decision
      log. Approved as written, 26 Nov 2026.
- [x] Review [conventions-and-skills.md](conventions-and-skills.md). Same. Approved as written, 26 Nov 2026.
- [x] Confirm D12 (strict Ajv, precompiled) still holds. Confirmed 26 Nov 2026; it governs forms, while the bridge
      keeps zod (D5).

## Design gate

Follow [design-process.md](design-process.md). The patterns below are reused by every phase, so their look is
settled once, here. Options and recommendations, with the artboards each pattern appears on:
[research/technology/p1b-design-gate-options.md](../research/technology/p1b-design-gate-options.md).

| Pattern | Requirements | Questions to settle |
|---|---|---|
| Job progress | Title, step, elapsed time, cancel, link to commands, result or error | Inline, in the bottom panel, or both. How several running jobs show. |
| Approval | What will happen, what it affects, approve and deny; typed name for destructive ones | One layout that works as a card in a chat, a step in the Deploy tab and a modal. |
| Background job notice | A job finished or needs an answer on another tab | Tab badge and toast wording; where a list of running jobs lives. |
| Session control | State, start, stop, key facts | Its place in the top bar (the run control) and in the status bar (the coding agent). |
| Streaming list | Follow, jump to latest, copy, clear | Line wrapping; how ANSI colour maps to the tokens. |
| Changed on disk, unsaved changes guard | Non-blocking notice; keep mine, take theirs, compare | Banner placement relative to the view; the compare view. |
| Version gate | The version that adds the feature, the upgrade command | Sizes: a whole tab, a form section, one control. |
| Empty state, cannot read, error | Purpose and first action; file and line; what to do next | One layout family for all three. |
| Command palette | One shortcut; every app command from the manifests; each command's shortcut shown | Placement and size; grouping; how a disabled or version-gated command shows. |

**Sign-off**

| Pattern | Options explored | Decision | Approved by | Date |
|---|---|---|---|---|
| Job progress, approval, background notice | 2–3 per question ([options](../research/technology/p1b-design-gate-options.md), row a) | As recommended: job progress inline in the view that started it, its commands in the Commands panel, "Stop", "Show commands", elapsed time, several jobs stacked; approval is one body in a card where the work happens or a modal (typed name) for real infrastructure and destructive actions, no "Cancel" on the card; background notice is a state icon on the tab and one toast template with "Show", no running-jobs list until P6 | Dhananjaya Rajasinghe | 26 Nov 2026 |
| Session control, streaming list, command palette | 2–3 per question ([options](../research/technology/p1b-design-gate-options.md), row b) | As recommended: run control as built in P1a, the coding agent's status item opens its drawer; streaming list without wrapping, ANSI colours mapped to existing tokens, copy, clear, "Jump to latest"; command palette a top-centre overlay on Mod+K, one flat list with feature prefixes, version-gated commands listed with their reason | Dhananjaya Rajasinghe | 26 Nov 2026 |
| Changed on disk, unsaved guard | 2–3 per question ([options](../research/technology/p1b-design-gate-options.md), row c) | As recommended: a banner at the top of the view (floating over the canvas), info tone without a working copy and warning with a conflict, "Keep mine", "Take theirs", "Compare" (compare view settled when first used); the in-app guard a modal with Save, Discard and Stay | Dhananjaya Rajasinghe | 26 Nov 2026 |
| Version gate, empty, cannot read, error | 2–3 per question ([options](../research/technology/p1b-design-gate-options.md), row d) | As recommended: a gated tab shows an empty state with the version needed and the upgrade command to copy; a gated form section is tagged and opens to a banner over read-only fields; one control settled when first used; one family for empty, cannot read and error, centred when nothing is left to show, a banner otherwise | Dhananjaya Rajasinghe | 26 Nov 2026 |

## Work packages

### 1b.1 Contract

- [x] Builders for `query`, `command`, `job` and `session`; event types; `StudioError` and the error catalog;
      the `Revision` type; `UserRequest`.
      (Task 3, commits `2cf49cf8..25098ea7`.)
- [x] `job.respond`, `jobs.list`, `session.start`, `session.stop`, `sessions.list`.
      (Tasks 3 and 5; also `job.cancel`, `jobs.interrupted` and `jobs.dismissInterrupted`, plan ruling 14.)

### 1b.2 Main process

- [x] The service registry: fails start-up on a missing handler; validates inputs; converts exceptions to
      `StudioError`; refuses operations whose capability is unavailable.
      (Task 4, commits `25098ea7..a9d629a0`.)
- [x] Project scope: created on open, disposed on close.
      (Task 4; opened and closed by `ProjectService` in P2.)
- [x] `JobService`: states, one open request at a time, serialising by kind, the quit rule, start and end
      records for crash recovery.
      (Tasks 5 and 6, commits `a9d629a0..ce28c832`.)
- [x] `SessionService`.
      (Task 5.)
- [x] Stream batching with a bounded backlog; masking of known secret values in output and error detail.
      (Task 4.)
- [x] `CommandRunner`, `ProjectFs` (atomic writes, revisions, path confinement) and `Watcher` as interfaces,
      each with a fake. Their real implementations are finished in P2.
      (Task 4.)
- [ ] Domain events: services receive changed paths from the watcher and emit `<domain>.changed`.
      Not fully built: the `domain.changed` event and the renderer's invalidation exist (Tasks 3 and 7);
      real services emit it from P2.

### 1b.3 Renderer shared layer

- [x] Bridge client, query client, the query-key convention, the event-to-key-prefix invalidation.
      (Task 7, commits `ce28c832..28d07d07`.)
- [x] Stream store with bounded buffers and backlog on subscribe.
      (Task 8, commits `50628835..b0296747`.)
- [x] Job store and `useJob`; session store and `useSession`; reattach after reload.
      (Task 8. Reattach after a reload is proved in Electron; see Verification.)
- [x] The working-copy helper: base revision, conflict flag, write on a defined moment, the unsaved-changes
      guard.
      (Tasks 7 and 17; one guard for every unsaved view.)
- [x] Automatic pending state after 300 ms in the query and mutation hooks.
      (Task 7.)
- [x] `useCapability` and `CapabilityGate`, backed by an empty catalog until P2.
      (Tasks 8 and 17.) The `CatalogProvider` is mounted in P2, and the catalog's content is P2's.
- [x] The app command registry and `runCommand`; palette, menu and shortcuts built from manifests; a clash
      test.
      (Tasks 9 and 16.) The native application menu stays static (plan ruling 12); "menu" here is the in-app
      menus and the palette.
- [x] Take over the shell's Mod+J (declared in `packages/ui/src/components/bottom-panel.tsx` in P1a): register it,
      decide whether it acts behind an open modal (it does in P1a) and Ctrl versus Cmd per platform.
      (Task 9: `shell.toggleBottomPanel`, plan ruling 13.)
- [x] A DOM test setup for the renderer (happy-dom and Testing Library), and tests for the shell's untested error
      paths: the layout-save toast and the bridge-error banner (`apps/renderer/src/shell/Shell.tsx`).
      (Task 2, commits `97c4f48b..f44513ed`.)
- [x] `SchemaForm` skeleton with React Hook Form and JSON-schema field checks (filled out in P3).
      (Task 10, commits `4e764b60..254de293`.)

### 1b.4 Shared patterns (`packages/ui` and `shared/`)

- [x] Build the patterns approved at the design gate: presentational parts in `packages/ui`, connected
      wrappers in `shared/`, with stories for every state.
      (Tasks 15 to 17, commits `4b756be7..3751101e`.)

### 1b.5 Generators, fixture and enforcement

- [x] `pnpm new:feature`, `pnpm new:operation`, `pnpm new:component`.
      (Task 13, commits `2c69877d..9db350e2`.)
- [x] `ak-studio/fixtures/support-triage/`, built from the fixture data in the briefs, and the mock
      transport's data derived from it.
      (Task 11, commits `254de293..66ee4154`.)
- [x] Enforcement from the architecture's table: dependency-cruiser boundaries (including no
      feature-to-feature imports), restricted imports, the arbitrary-value check, the contract, error-catalog
      and manifest tests, the story-coverage script.
      (Task 12, commits `66ee4154..2c69877d`.)
- [ ] Visual regression on Linux in CI; axe on every story.
      Both run locally (`pnpm test:visual`, 622 passed; `pnpm test:storybook`, 620 passed, axe in both
      themes), and the CI job is written (Task 12, `0de8f229`). Running it in CI is **Deferred** (plan
      ruling 1).

### 1b.6 The proving slice

- [x] A throwaway "About" feature made with the generator, exercising every shape:
  - a query (app info);
  - a command with a revision (a preference; a stale write returns `file.changedOnDisk`);
  - a job with three fake steps, a `waiting-for-user` request and cancel;
  - a session (a fake ticker) with a stream;
  - an app command run from another place (the palette).
  (Tasks 14 and 18, commits `9db350e2..4ea5346d` and `3751101e..d7d0ab2b`.)
- [x] Reload the window mid-job: the job and its stream reattach.
      (Task 18; proved in Electron. The browser's mock lives in the page, so it proves leaving mid-job and
      coming back.)

### 1b.7 Skills

- [x] `ak-studio/.agents/skills/` with `ak-studio/.claude/skills` linked to it; `ak-studio/AGENTS.md`; one
      line in the root `AGENTS.md`.
      (Task 19, commits `d7d0ab2b..a3692748`.)
- [x] Write `ak-studio-architecture`, `ak-studio-ui` and `ak-studio-new-feature`.
      (Task 19.)
- [x] Freeze the matching sections of the two design docs with a note pointing to the skills.
      (Task 19.)
- [x] Add the Studio section to `ak-dev-review-pr`.
      (Task 19.)
- [x] Configure the shadcn CLI and MCP server against `packages/ui`.
      (Task 19; `.mcp.json` at the repository root, left for the owner to confirm.)
- [x] **Test each skill:** its sample task, run three times by a coding agent in a scratch branch, passes
      lint, boundaries, stories and review with no hand edits. Keep the sample tasks beside the skills.
      Done 27 Nov 2026: see Verification.

## Version awareness

P1b builds the gate (`useCapability`, `CapabilityGate`, the capability field on operations) against an empty
catalog. P2 fills the catalog.

## Verification

- [x] The About slice works through all four shapes in Electron and in the browser, including cancel, the
      user request, the stale write and the reload. Proved by the end-to-end suite (34 passed: browser 15,
      Electron 19; four stable runs): `checkInfo` (query), `checkNoteStaleWrite` (changed-on-disk banner,
      Keep mine, Take theirs), `checkJobApproved`, `checkJobDenied`, `checkJobCancelled`, `checkTicker`,
      `checkPaletteRunsDemoJob`. Two qualifications. The reload reattaches in Electron only ("a reload
      mid-job reattaches to the job and its stream"), because the mock lives in the page; the browser proves
      leaving mid-job and coming back. The server's `file.changedOnDisk` refusal of a stale base is
      unit-tested (`useAboutSetNote.test.tsx` and the About service tests); in the end-to-end run the
      domain event re-reads the note first, so the banner comes from the re-read.
- [x] Quitting with the fake job running asks first; a job marked `survivesQuit` blocks the quit. Electron
      tests "quitting with the demo job running asks first" and "a started job that survives quit blocks
      it", and "quitting with an unsaved note and a running job" for the order (unsaved work first); unit
      tests in `testJobs.test.ts`.
- [x] Killing the app mid-job shows the job as interrupted on the next launch. Electron "killing the app
      mid-job": SIGKILL, relaunch on the same data folder, the interrupted banner; Dismiss removes the
      record.
- [x] A 10,000-line burst on the fake stream does not freeze the window. Electron "a 10,000-line burst":
      about 115 frames, median 16.7 ms, longest 16.8 ms (limits: longest under 200 ms, median under 50 ms);
      a planted 300 ms stall fails it. The renderer holds the newest 5,000 lines and the last line shows.
- [x] Each of these fails when introduced on purpose, proved locally by a self-test that plants it: a
      feature importing another feature (`pnpm depcruise:selftest`, rule `renderer-feature-isolation`); an
      `electron` import in the renderer (`renderer-ui-no-electron`); an arbitrary value class
      (`tools/check-classes.test.mjs`); an operation without a handler (`registry.test.ts`,
      `registerServices.test.ts`); an error code without a presentation (`presentation.test.ts`); a
      component without its required stories (`tools/check-stories.test.mjs`).
      **Deferred (CI not run, plan ruling 1):** that CI itself rejects each one.
- [x] The three skill tests pass: 9/9 runs passed "Done means" (3 per skill), 27 Nov 2026. The skills were
      revised three times between rounds (after batch 1, after batch 2, and a close-out pass after batch 3).
      Recorded in [P1b-plan.md](P1b-plan.md#task-20-skill-tests-and-close-out).

Last full local run, at `ae98df31`: `pnpm lint` passed (depcruise 409 modules, 0 violations);
`pnpm typecheck` clean; `pnpm test` green (runtime 190, desktop 182, ui 387, renderer 381, contract 81);
`pnpm test:storybook` 620 passed; `pnpm test:e2e` 34 passed; `pnpm test:visual` 622 passed. Later fixes
re-ran only the suites they touched.

## Open decisions

Both resolved on their proposed defaults (plan ruling 5, 26 Nov 2026).

- Skill sample tasks run by hand before a skill change merges, recorded here and in the PR, not in CI. Done
  that way on 27 Nov 2026.
- Undo history is built in P5, where it is first needed.

## Results

**What P1b delivered.** The skeleton every feature is built on, proved by the throwaway About feature. The
contract has its four shapes (query, command, job, session), events and an error catalog. The new
`@ak-studio/runtime` package holds the service registry, project scopes, secret masking, the event bus,
stream batching, `JobService` and `SessionService`. The desktop app wires them in with the quit rule and
crash records. The renderer has its data layer (query keys, pending after 300 ms, working copy, one unsaved
guard), stream, job and session stores with reattach, the app command registry with the palette on Mod+K,
the `SchemaForm` skeleton, and the shared patterns with stories in both themes. The support-triage fixture
feeds the mock. Generators (`new:feature`, `new:operation`, `new:component`), the enforcement checks, three
Studio skills with sample tasks and the shadcn MCP configuration are in place.

**Rulings that changed the design records.** All are in the ledger and the plan's pre-flight rulings.

- A `runtime` package (ruling 9). Services live there, and the mock transport runs the same registry.
- Feature services are built by factories that take `FeatureDeps`, so ports arrive by constructor.
- Events use the existing `subscribe`: two streams, `events` and `stream.read` (ruling 6).
- `file.changedOnDisk` carries no content across the bridge. The renderer re-reads, and the working copy
  keeps the draft as conflicting.
- One unsaved-changes guard for the whole app, with one dialog naming every unsaved item (Save all, Discard
  all, Stay). The renderer reports labels to main with `app.setUnsaved`, and the quit asks about unsaved
  work before jobs.
- Feature manifests declare their `jobs` and `show`, and every job kind has exactly one owner.
- Job runners get `ctx.confirm` (a yes or no with descriptive labels) and `ctx.cancel`. `job.respond`
  accepts a deny without the typed name.
- Mono text that people may retype (commands, code) turns ligatures off: the mono-literal rule.
- Every scroll container is `position: relative`. The skills state it.
- The interrupted-job notice is a banner on the owning screen, and About's temporary tab shows a waiting job.

**The owner's bugs, fixed.** About made the window itself scroll, because hidden helpers were positioned
against the page (`d540782b`, with an end-to-end check that failed by 384 px without the fix). A closed
bottom panel showed a stub scroll bar (`278fc9fe`, with a check).

**Deferred.** CI was not run (plan ruling 1): the workflow, the visual baselines (made on WSL2) and the
"fails CI" items are proved locally only. Windows and macOS stay deferred. The native menu is static
(ruling 12).

**Carried to later phases.**

- P2: mount `CatalogProvider` (and give it `upgradeCommand` and `openDocs`); the docs opener; real ports on
  desktop (`CommandRunner`, `ProjectFs`, `Watcher`; decide required ports or a `requirePort` helper); a
  project close timeout for a runner that never ends; use the generators' `--project` flag; real services
  emit `domain.changed`; the capability catalog's content.
- P6 and P10: modal focus restore after a confirm-by-name modal; an app-level interrupted-job notice (and a
  running-jobs list from P6).
- P3: the `SchemaForm` items from Task 10 (a validator under the real CSP, empty-string handling, reset to
  default for enum and boolean, the Optional toggle restoring values, `aria-describedby` on boolean errors,
  integers above 2^53, THIRD-PARTY-NOTICES).
- For the owner: `.mcp.json` sits at the repository root (Task 19 minor 1).

## Risks

| Risk | Default |
|---|---|
| The architecture is too heavy for the first features | The About slice is the test: if a query, a command or a job takes more than about a page of feature code, simplify before P2 |
| Building infrastructure ahead of need | Only what P2 and P3 use is built fully; sessions and the working-copy helper are proven by the About slice and finished by the phase that first uses them |
| Skills drift from the code | A rule changes in the skill, the generator and the code in the same PR; sample tasks rerun when a skill or generator changes |
| Custom checks (arbitrary values, story coverage) take longer than expected | They are scripts, not lint plugins; time-box each to a day and fall back to a review checklist item |
