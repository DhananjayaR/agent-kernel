# P1b · Data and feature layer, shared patterns and skills

| | |
|---|---|
| Status | Started 26 Nov 2026: approval gate passed. Execution plan: [P1b-plan.md](P1b-plan.md) |
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

- [ ] Builders for `query`, `command`, `job` and `session`; event types; `StudioError` and the error catalog;
      the `Revision` type; `UserRequest`.
- [ ] `job.respond`, `jobs.list`, `session.start`, `session.stop`, `sessions.list`.

### 1b.2 Main process

- [ ] The service registry: fails start-up on a missing handler; validates inputs; converts exceptions to
      `StudioError`; refuses operations whose capability is unavailable.
- [ ] Project scope: created on open, disposed on close.
- [ ] `JobService`: states, one open request at a time, serialising by kind, the quit rule, start and end
      records for crash recovery.
- [ ] `SessionService`.
- [ ] Stream batching with a bounded backlog; masking of known secret values in output and error detail.
- [ ] `CommandRunner`, `ProjectFs` (atomic writes, revisions, path confinement) and `Watcher` as interfaces,
      each with a fake. Their real implementations are finished in P2.
- [ ] Domain events: services receive changed paths from the watcher and emit `<domain>.changed`.

### 1b.3 Renderer shared layer

- [ ] Bridge client, query client, the query-key convention, the event-to-key-prefix invalidation.
- [ ] Stream store with bounded buffers and backlog on subscribe.
- [ ] Job store and `useJob`; session store and `useSession`; reattach after reload.
- [ ] The working-copy helper: base revision, conflict flag, write on a defined moment, the unsaved-changes
      guard.
- [ ] Automatic pending state after 300 ms in the query and mutation hooks.
- [ ] `useCapability` and `CapabilityGate`, backed by an empty catalog until P2.
- [ ] The app command registry and `runCommand`; palette, menu and shortcuts built from manifests; a clash
      test.
- [ ] Take over the shell's Mod+J (declared in `packages/ui/src/components/bottom-panel.tsx` in P1a): register it,
      decide whether it acts behind an open modal (it does in P1a) and Ctrl versus Cmd per platform.
- [ ] A DOM test setup for the renderer (happy-dom and Testing Library), and tests for the shell's untested error
      paths: the layout-save toast and the bridge-error banner (`apps/renderer/src/shell/Shell.tsx`).
- [ ] `SchemaForm` skeleton with React Hook Form and JSON-schema field checks (filled out in P3).

### 1b.4 Shared patterns (`packages/ui` and `shared/`)

- [ ] Build the patterns approved at the design gate: presentational parts in `packages/ui`, connected
      wrappers in `shared/`, with stories for every state.

### 1b.5 Generators, fixture and enforcement

- [ ] `pnpm new:feature`, `pnpm new:operation`, `pnpm new:component`.
- [ ] `ak-studio/fixtures/support-triage/`, built from the fixture data in the briefs, and the mock
      transport's data derived from it.
- [ ] Enforcement from the architecture's table: dependency-cruiser boundaries (including no
      feature-to-feature imports), restricted imports, the arbitrary-value check, the contract, error-catalog
      and manifest tests, the story-coverage script.
- [ ] Visual regression on Linux in CI; axe on every story.

### 1b.6 The proving slice

- [ ] A throwaway "About" feature made with the generator, exercising every shape:
  - a query (app info);
  - a command with a revision (a preference; a stale write returns `file.changedOnDisk`);
  - a job with three fake steps, a `waiting-for-user` request and cancel;
  - a session (a fake ticker) with a stream;
  - an app command run from another place (the palette).
- [ ] Reload the window mid-job: the job and its stream reattach.

### 1b.7 Skills

- [ ] `ak-studio/.agents/skills/` with `ak-studio/.claude/skills` linked to it; `ak-studio/AGENTS.md`; one
      line in the root `AGENTS.md`.
- [ ] Write `ak-studio-architecture`, `ak-studio-ui` and `ak-studio-new-feature`.
- [ ] Freeze the matching sections of the two design docs with a note pointing to the skills.
- [ ] Add the Studio section to `ak-dev-review-pr`.
- [ ] Configure the shadcn CLI and MCP server against `packages/ui`.
- [ ] **Test each skill:** its sample task, run three times by a coding agent in a scratch branch, passes
      lint, boundaries, stories and review with no hand edits. Keep the sample tasks beside the skills.

## Version awareness

P1b builds the gate (`useCapability`, `CapabilityGate`, the capability field on operations) against an empty
catalog. P2 fills the catalog.

## Verification

- [ ] The About slice works through all four shapes in Electron and in the browser, including cancel, the
      user request, the stale write and the reload.
- [ ] Quitting with the fake job running asks first; a job marked `survivesQuit` blocks the quit.
- [ ] Killing the app mid-job shows the job as interrupted on the next launch.
- [ ] A 10,000-line burst on the fake stream does not freeze the window.
- [ ] Each of these fails CI when introduced on purpose: a feature importing another feature, an `electron`
      import in the renderer, an arbitrary value class, an operation without a handler, an error code without
      a presentation, a component without its required stories.
- [ ] The three skill tests pass.

## Open decisions

- Whether skill sample tasks run in CI or by hand before a skill change merges. Proposed: by hand, recorded in
  the PR.
- Whether undo history (see the pattern catalogue) is built here or in P5, where it is first needed.
  Proposed: P5.

## Risks

| Risk | Default |
|---|---|
| The architecture is too heavy for the first features | The About slice is the test: if a query, a command or a job takes more than about a page of feature code, simplify before P2 |
| Building infrastructure ahead of need | Only what P2 and P3 use is built fully; sessions and the working-copy helper are proven by the About slice and finished by the phase that first uses them |
| Skills drift from the code | A rule changes in the skill, the generator and the code in the same PR; sample tasks rerun when a skill or generator changes |
| Custom checks (arbitrary values, story coverage) take longer than expected | They are scripts, not lint plugins; time-box each to a day and fall back to a review checklist item |
