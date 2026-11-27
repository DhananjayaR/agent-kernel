---
name: ak-studio-new-feature
description: >
  Add a feature to Open Agent Kernel Studio (OAK Studio, `ak-studio/`) end to end with the generators: `pnpm
  new:feature`, `pnpm new:operation --shape query|command|job [--desktop] [--project]` and `pnpm new:component`;
  the manifest (tab, routes, app commands, job kinds, show, capabilities), the hooks, the screen built from the
  patterns, stories, unit tests and end-to-end tests, and what to run before committing. The About feature is the
  worked example. Also covers session kinds and app commands (written by hand) and how to recover when a generator
  refuses an edit point. Use this skill when asked to add a feature, an operation, a screen or an app command to
  the Studio, or when a `pnpm new:*` generator refuses.
license: Apache-2.0
metadata:
  author: yaalalabs
  category: developer
---

# Adding a feature to OAK Studio

A feature is one business slice (Canvas, Config, Deploy, ...): one folder in the renderer, its operations in the
contract, one service, its hooks and its screens. Build it as a vertical slice, contract first, with the
generators. Never hand-write a skeleton a generator makes.

Paths are relative to `ak-studio/`; commands run from `ak-studio/`. Load `ak-studio-architecture` for the rules
behind each step and `ak-studio-ui` for the screen.

## Before you start

- A screen is built only after its design gate is signed off
  (`docs/specs/950-agent-kernel-studio-phase-1/implementation/design-process.md`; each phase document records its
  sign-off). Contract, services and hooks do not wait for the gate. A sample task (throwaway practice, never
  merged, like the skills' `sample-task.md` files) is exempt and builds the screen it describes; a real feature's
  screen is not.
- Names are kebab-case, at most 40 characters, never a path: `release-notes`, `read-summary`. The generators refuse
  the reserved feature names `app`, `events`, `features`, `job`, `jobs`, `session`, `sessions`, `shared`, `shell`,
  `stream`, `streams`, `window`, any name a contract or runtime module already has, and Windows device names
  (`con`, `nul`, `lpt1`, ...).
- Every generator plans all its files before writing, refuses rather than overwrites, and writes all or nothing,
  then formats what it wrote with Biome. A refused run changes nothing. `--help` prints the usage.
- What you write by hand is not formatted for you: run `pnpm format` after your edits, before `pnpm lint` (Biome's
  format check fails otherwise).

## 1. The feature folder

```bash
pnpm new:feature word-count
```

Creates `apps/renderer/src/features/word-count/` and lists `wordCountFeature` in `apps/renderer/src/app/features.ts`:

| File                                          | What it is                                                                                               |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `manifest.ts`, `manifest.test.tsx`            | How the feature joins the app: id, title, a route at `/word-count`, no commands, no capabilities, no tab |
| `strings.ts`                                  | The feature's copy (`wordCountStrings`, with its title)                                                  |
| `api/keys.ts`                                 | `wordCountKeys = keys("word-count")`, the query-key factory                                              |
| `model/store.ts`, `model/store.test.ts`       | The feature store (Zustand): UI state only, here a selection                                             |
| `components/`                                 | Empty: components used only by this feature                                                              |
| `screens/WordCountScreen.tsx`, `.stories.tsx` | The screen the route mounts (only the title so far) and its stories                                      |

## 2. Operations

```bash
pnpm new:operation word-count read-summary --shape query
pnpm new:operation word-count save-summary --shape command
pnpm new:operation word-count count-words --shape job
```

The operation is `<feature>.<camelCaseName>` (`word-count.countWords`), declared as `wordCountCountWords`. Each run
writes, end to end:

- the declaration in `packages/contract/src/<feature>.ts` (created and exported from `packages/contract/src/index.ts`
  on the first operation), with input `{}` and output (a job: result) `{}`; a job is `cancellable: true`,
  `survivesQuit: false`, titled from the name;
- its entry in the `operations` map in `packages/contract/src/operations.ts`;
- the handler, a method of `<Feature>Service` in `packages/runtime/src/<feature>/<Feature>Service.ts`, wired in
  `register`, with a case in `<Feature>Service.test.ts` (a real `ServiceRegistry`). On the first operation the
  service is created and its factory listed in `FEATURE_SERVICES` (`packages/runtime/src/features.ts`). A job's
  method is its runner, `(input, ctx: JobContext)`, given to JobService with `jobs.define`;
- the hook `use<Feature><Name>` in the feature's `api/` with its test: a query's uses `useStudioQuery` keyed
  `<feature>Keys.app("<operationCamel>")` (for example `wordCountKeys.app("readSummary")`); a command's `useStudioMutation`; a job's `useStartJob`;
- a job only: its kind in the manifest's `jobs`, so the feature owns its background notices.

Flags:

- `--project`: the input is `{ projectId }`, `errors` lists `ERROR_CODES.projectNotOpen`, the handler calls
  `this.#deps.scopes.require(projectId)` (JobService does it for a job) and a query's hook takes the project's id
  and keys by `<feature>Keys.detail(projectId, "<operationCamel>")`.
- `--desktop` (a query or command whose handler needs Node or Electron): the handler goes in
  `apps/desktop/src/main/services/<Feature>Service.ts`, registered in
  `apps/desktop/src/main/services/registerServices.ts`, and the browser's mock answers it from a fixture added to
  `desktopFixtureHandlers` in `apps/renderer/src/shared/bridge/desktopFixtures.ts`. Keep the fixture's answer in
  step with the real one. A job is never `--desktop`: its runner reaches Node through the ports in `FeatureDeps`.

Then fill in what the generator left as `{}`:

1. The schemas: inputs `z.strictObject` with bounds, outputs plain `z.object`, the `errors` the handler can return
   (domain codes only). For a job, the `result` schema and a `title` that reads well.
2. The handler or runner (see `ak-studio-architecture`: `StudioFailure` for errors, `domain.changed` after a write,
   `ctx.step`, `ctx.stream.write`, `ctx.confirm` and `ctx.cancel()`, every wait through
   `this.#deps.clock.sleep(ms, ctx.signal)`), and its copy in a strings module beside the service. Replace the
   generated method whole, its doc comment too: the job's ("Runs one `x.y` job; its answer is the job's result.
   `ctx` reports steps, ...") describes the stub, so write one that says what the runner does.
3. **Update the generated tests**: they assert `{}` in and out, and fail once the schemas change.
   - **Service test.** Extend the generated `serve()` (see "Testing a service" in `ak-studio-architecture`). It
     returns `clock`, the `FakeClock` the service sleeps on, and two ways to move it: `await runUntil("succeeded")`
     runs the job to that state and returns it (the generated job test uses it, so it still passes once the runner
     sleeps per step), and `await stepOnce(ms)` waits until the runner sleeps, then runs one step. A bare
     `clock.advance(ms)` straight after the start can come before the runner's sleep and move nothing. It serves
     `job.cancel`: `await registry.request("job.cancel", { jobId })` stops a job (or `await jobs.cancelAll(jobs.list())`
     for every job). It returns `lines`: `await lines(jobs.list()[0]?.streamId)` reads a job's output.
   - **A cancel during a step** (service test): `await stepOnce(ms)` ends step 1; wait for step 2,
     `await vi.waitFor(() => expect(jobs.list()[0]?.progress?.step).toBe(2))`; cancel with no clock move,
     `await registry.request("job.cancel", { jobId: jobs.list()[0]?.id })`; then
     `await vi.waitFor(() => expect(jobs.list()[0]?.state).toBe("cancelled"))` and `expect(clock.sleeping).toBe(0)`:
     the signal ended the wait, and nothing is left asleep.
   - **Hook test.** Pass `createMockBackend({ clock })` a `FakeClock` the same way, or read the job through the
     stores with `connectMock` (`apps/renderer/src/test/connectedMock.tsx`), which proves the events path a view
     relies on. In renderer tests and stories, import `FakeClock` from `shared/bridge/mockTransport`. A job's hook
     test, as `apps/renderer/src/features/about/api/useAboutDemoJob.test.tsx` writes it (`useJob` from
     `shared/jobs/jobStore`, `mock` disposed in `afterEach`):

     ```tsx
     const clock = new FakeClock();
     mock = connectMock({ clock });
     const { result, rerender } = renderHook(
     	({ jobId }: { jobId: string | undefined }) => ({
     		start: useAboutDemoJob(),
     		job: useJob(jobId),
     	}),
     	{ wrapper: mock.wrapper, initialProps: { jobId: undefined as string | undefined } },
     );
     const jobId = await act(() => result.current.start.start({}));
     rerender({ jobId });
     await waitFor(() => expect(result.current.job?.progress?.step).toBe(1));
     await act(() => clock.advance(1000));
     await waitFor(() => expect(result.current.job?.progress?.step).toBe(2));
     ```

   - **The clock in renderer tests.** Before each `clock.advance(ms)`, wait until the runner sleeps: the step it
     sleeps in is visible (`job.progress.step`, or the step text on screen) or
     `await waitFor(() => expect(clock.sleeping).toBeGreaterThan(0))`. An advance before that moves nothing.
   - **A `Job` has no `input` field.** To prove a job ran on the input you gave (a command's fixed sample text, say),
     move the clock to the end and check the job's `result`.

**Which strings module.** A feature has two, one per side, both exporting `<featureCamel>Strings`. The renderer's
`apps/renderer/src/features/<feature>/strings.ts` holds what the screen and the manifest show (headings, labels,
buttons, command titles, a result line) and any text the screen or a command sends as input (a fixed sample
text). The runtime's `packages/runtime/src/<feature>/strings.ts` holds what the service emits (step labels, output
lines, a job's question, error messages); the screen shows those from the job and the stream, never from a copy of
its own.

### Written by hand: session kinds and app commands

No generator makes these; copy the shapes from About.

- **A session kind**: `defineSessionKind({ kind, args, info, errors? })` in the feature's contract file, added to
  `sessionKinds` in `operations.ts`; its starter in the service's `register`,
  `this.#deps.sessions.define(kind, (args, ctx) => this.start(args, ctx))`, answering `{ info, stop }`; and a hook
  like `apps/renderer/src/features/about/api/useAboutTicker.ts` over `useSession`, `startSession` and `stopSession`.
  Show it with `SessionControl`.
- **An app command**: `defineCommand({ id, title, run, args?, shortcut?, whileTyping?, when?, capability? })` in the
  manifest's `commands` (`apps/renderer/src/shared/commands/command.ts`). The id is `<feature>.<camelCaseVerb>`;
  the title comes from the feature's strings. A command that starts a job calls `startJob(kind, input)`
  (`shared/jobs/jobStore.ts`); one that opens the feature's screen uses `when: canNavigate` and
  `run: () => navigateTo(path)` (`shared/commands/navigation.ts`). Other features run it with `runCommand(id, args)`,
  never by importing this feature.

## 3. The manifest

`apps/renderer/src/features/<name>/manifest.ts` is the only file `app/` imports. `defineFeature`
(`apps/renderer/src/shared/commands/feature.ts`) takes:

| Field          | Rule                                                                                                                                                                                                                            |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`           | The folder name                                                                                                                                                                                                                 |
| `title`        | From the strings module; the command palette shows it before each command ("About: Run the demo job")                                                                                                                           |
| `tab`          | `{ label, path, order }`, optional. Tabs are business areas decided at the design gate: do not add one without it. A new tab also changes the tab list in `apps/renderer/src/app/registry.test.ts` and the shell's width checks |
| `routes`       | `[{ path, component }]`, `/kebab-case` paths, unique across the app                                                                                                                                                             |
| `commands`     | Its app commands, each id in the feature's namespace                                                                                                                                                                            |
| `jobs`         | Every job kind the feature owns (the generator adds them). Every contract job kind has exactly one owner (a registry test)                                                                                                      |
| `show`         | The id of one of its commands that brings the feature on screen: the background job notice's "Show"                                                                                                                             |
| `capabilities` | Every catalog id the feature uses (none until P2)                                                                                                                                                                               |

A job that can wait for the user needs a tab to carry its badge: a waiting job is never only a toast.

## 4. The screen

Build it from the patterns (`ak-studio-ui`), in this order of preference: a connected wrapper from
`apps/renderer/src/shared/patterns/`, then a component from `@ak-studio/ui`, then a component in the feature's
`components/` (made with `pnpm new:component` only if it belongs in the design system).

| Need                         | Use                                                                                                                                                                                                                             |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Read data                    | The generated query hook; `isPending` and `showPending` for the 300 ms pending look; a `Skeleton` while it reads                                                                                                                |
| A failure                    | `<ErrorView error={query.error.error} />`, or the failure of a press with `failureOf(reason)` (`shared/patterns/presentError.ts`)                                                                                               |
| Edit and save                | `useWorkingCopy` over the query and the command, with `ChangedOnDisk` and `UnsavedChangesGuard`                                                                                                                                 |
| Start a job and show it      | The generated job hook's `start`, then `<JobProgressList jobIds={useJobIdsToShow(kinds)} />` (below), and `StreamingList` for the newest job's output                                                                           |
| A job left by an earlier run | `<InterruptedJobs kinds={[...the manifest's jobs]} />` at the top of the screen                                                                                                                                                 |
| Something long-lived         | `SessionControl` and `StreamingList`                                                                                                                                                                                            |
| Nothing yet                  | `StateMessage` or `EmptyState`: what the place is for and the first action                                                                                                                                                      |

- **Head a screen** with a `div` holding an `h2` and one sentence, as `AboutScreen` does; never a `<header>`. A
  screen's stories render it without the shell (and its `<main>`), where a `<header>` is a banner landmark.
  `StreamingList` renders a `<header>` of its own, so a screen `<header>` beside one is a second banner and fails
  axe (`landmark-no-duplicate-banner`, `landmark-unique`).
- **The jobs to show** come from `useJobIdsToShow(kinds)` (`apps/renderer/src/shared/jobs/jobStore.ts`), `kinds`
  being the manifest's `jobs` (the same array `InterruptedJobs` takes): every live job of those kinds and the
  newest whatever its state, oldest first, read from the job store, so a job started from the palette or
  reattached after a reload shows too. Never keep the id `start` answered. `DemoJobSection` in `AboutScreen.tsx`
  uses it.
- **Input bounds stay in the contract.** In P1b a screen does not mirror the input schema's bounds (no `maxLength`
  on a `Textarea`, though it accepts React Aria's): the contract and the kernel are the authority, and an input
  over a bound is refused with `bridge.invalidInput`, shown with `ErrorView`. A later phase may add field limits
  through its design gate.
- All copy comes from `strings.ts`. One primary button per view. A scrolling area is `relative h-full overflow-auto`.
  Copy that changes with a count is a function in the strings module (`result: (n: number) => ...`); test its
  singular and plural on the function itself (`expect(wordCountStrings.result(1)).toBe("1 word")`, then 0 and 2),
  not by running a job per count.
- A press that starts work shows its pending state after 300 ms (`usePendingAfter(flag, callId)`), as
  `DemoJobSection` in `apps/renderer/src/features/about/screens/AboutScreen.tsx` does.

## 5. Stories and tests

- **Screen stories** beside the screen (`check-stories` requires the file). Type-free CSF (the renderer does not
  depend on Storybook): each story renders the screen inside `MockApp` (`apps/renderer/src/test/MockApp.tsx`) with a
  `FakeClock` from a loader (`FakeClock` is imported from `shared/bridge/mockTransport` in a story), one story per
  state, and a `play` that reaches the state. Copy the structure of
  `apps/renderer/src/features/about/screens/AboutScreen.stories.tsx`, with its `Loaded` and `Play` types: the
  renderer has no Storybook types, so `Play` types by hand the parts of the play context a story uses
  (`loaded.clock`, `canvas.findByRole`, `canvas.findByText`, `userEvent.click`, `userEvent.type`); add a member
  there when a story needs another, and write `play: async ({ canvas }: Play) => ...`.
- **The generated stubs are replaced, not extended**: the screen's `Default` story (`export const Default = {}`)
  gives way to the stories of the screen's real states, and the generated manifest test (it renders the screen bare)
  is rewritten once the screen reads data: render it inside `MockApp`, as
  `apps/renderer/src/features/about/manifest.test.tsx` does, and test the route, `show` and each command.
- **Screen test** (`screens/<Name>Screen.test.tsx`): each section through its pattern on the mock, with a
  `FakeClock` the test moves (`act(() => clock.advance(ms))`), as `AboutScreen.test.tsx` does. Two patterns need a
  particular query:
  - `JobProgress` writes its step line ("Step 1 of 3 · Reading the text") twice: visibly and in an `sr-only`
    status for screen readers, so `getByText` finds two. Read the job's card, the region named after the job's
    title: `screen.getByRole("region", { name: "<job title>" }).textContent`.
  - `StreamingList` is virtualised, and happy-dom has no layout, so its rows never render in a unit test. Assert
    output through the stream store, `useStreamStore.getState().streams`, as the `streamed()` helper in
    `AboutScreen.test.tsx` does. Stories run in a real browser and can find the rows.
- **Service tests**: every operation through a real registry, including each error code it lists.
- **End-to-end** (when the screen ships): steps shared by `tests/e2e/browser.spec.ts` (the mock in Chromium) and
  `tests/e2e/electron.spec.ts` (the built app), in a steps file like `tests/e2e/aboutSteps.ts`. The steps use the
  app's words, not imports from the renderer.

## 6. Before committing

From `ak-studio/`:

```bash
pnpm format       # Biome writes its formatting and safe fixes into what you edited by hand
pnpm lint         # Biome, check-classes, check-palette, check-stories, compile-schemas, depcruise and self-tests
pnpm typecheck
pnpm test         # unit tests of every member, the tools' tests and the generator test
pnpm test:storybook                       # when a story, component or screen changed
pnpm test:visual --update-snapshots=missing   # new stories: then open and commit each new image
pnpm test:visual                          # when a story, component or screen changed
pnpm test:e2e                             # when a screen or app code changed
```

`pnpm lint` stops at the first check that fails. Run the long suites in the background with output to
`.logs/<worktree>-<suite>.log` (the folder is there already; git ignores the logs; a name unique to your run),
ending with an exit line to wait on: `( pnpm test; echo "exit code $?" ) > .logs/<worktree>-test.log 2>&1 &`.
`pnpm test` takes 45 seconds to 2 minutes on a quiet machine and 3 to 5 minutes while other runs share it. The
wait loop, every suite's times (quiet and loaded) and the fewer-workers commands
(`pnpm test:storybook --maxWorkers=2`) are in "Running the long suites" in `ak-studio-ui`. A single renderer test
(the Shell tests most often) that times out under load: rerun it alone
(`pnpm --filter @ak-studio/renderer exec vitest run <file>`) before concluding anything.

A PR is one slice: one operation, one component or one screen state, with its stories and tests.

## The worked example: About

About (`apps/renderer/src/features/about/`, `packages/runtime/src/about/`, `packages/contract/src/about.ts`) was made
with these generators and has one of each shape. It is throwaway: read it, do not import from it.

| Shape                   | Contract                                               | Service                                                          | Hook                           | On screen                                                               |
| ----------------------- | ------------------------------------------------------ | ---------------------------------------------------------------- | ------------------------------ | ----------------------------------------------------------------------- |
| query                   | `about.info`, `about.note`                             | `info()`, `note()`                                               | `useAboutInfo`, `useAboutNote` | `InfoSection`: data, `Skeleton`, `ErrorView`                            |
| command with a revision | `about.setNote` (`baseRevision`, `file.changedOnDisk`) | `setNote()`: Web Crypto digest, compare, write, `domain.changed` | `useAboutSetNote`              | `NoteSection`: `useWorkingCopy`, `ChangedOnDisk`, `UnsavedChangesGuard` |
| job                     | `about.demoJob`                                        | `demoJob(ctx)`: steps, output, `ctx.confirm`, `ctx.cancel()`     | `useAboutDemoJob`              | `DemoJobSection`: `JobProgressList`, `StreamingList`                    |
| session                 | `about.ticker` (`sessionKinds`)                        | `startTicker(args, ctx)`                                         | `useAboutTicker` (by hand)     | `TickerSection`: `SessionControl`, `StreamingList`                      |
| app commands            |                                                        |                                                                  |                                | `about.show`, `about.runDemoJob` in `manifest.ts`                       |

## When a generator refuses

A refusal starts `refused:` and the run wrote nothing (check with `git status`). Read the message: it names the file
and what it could not find. Edit points are found by structure, and anything ambiguous is refused rather than
guessed. Restore the shape it expects, then run the generator again. Only if the shape cannot be restored, make
the change by hand exactly as the generator would have.

| File                                                 | The shape the generator needs                                                                                                                                                                                             |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/renderer/src/app/features.ts`                  | The `export const features: readonly FeatureManifest[] = [ ... ];` array                                                                                                                                                  |
| `packages/contract/src/index.ts`                     | At least one `export * from "./x";` line                                                                                                                                                                                  |
| `packages/contract/src/operations.ts`                | `export const operations = {` holding only `"name": declaration,` lines (no comments, no spreads), ending `} as const satisfies ShapedOperationMap;`                                                                      |
| `packages/contract/src/<feature>.ts`                 | A file that declares the feature's own operations (`name: "<feature>.`); another module of that name is refused                                                                                                           |
| `<Feature>Service.ts` (runtime or desktop)           | Exactly one `register(registry: ...): void {` method, its body indented two tabs, and **`register` the class's last member**. Move any method you added after it above it. A comment directly on `register` stays with it |
| `<Feature>Service.test.ts`                           | Exactly one `describe("<Feature>Service", () => {` block closed by its own `});` at the start of a line. Code after the block (an `afterEach`) is fine                                                                    |
| `packages/runtime/src/features.ts`                   | `FEATURE_SERVICES` holding only `(deps) => new XService(deps),` factories                                                                                                                                                 |
| `apps/desktop/src/main/services/registerServices.ts` | The `registerFeatureServices(registry, featureDeps);` line                                                                                                                                                                |
| `apps/renderer/src/shared/bridge/desktopFixtures.ts` | Exactly one `export const desktopFixtureHandlers: FixtureHandlers = {` and its own `};`                                                                                                                                   |
| `features/<name>/manifest.ts` (a job)                | `jobs` as an array of string literals (one line or wrapped by Biome), or an `id: "..."` line to add it after. A constant or a spread is refused                                                                           |
| `packages/ui/src/index.ts`                           | The `export { ... } from "./components/...";` lines                                                                                                                                                                       |

Other refusals:

- "already exists" or "already in the operations map": the thing exists. Use it or choose another name.
- "is a symbolic link": the generator never writes through a link; edit that file by hand.
- "is in the way of the temporary file": a file `.<name>.<pid>.generator-tmp` was left beside the file named. Remove
  it and run again.
- "Biome reports problems ... could not fix": a hand edit in a file the generator touches has a lint error. Fix it
  (`pnpm lint` shows it) and run again; the generator put every file back.
- "putting the files back failed too": the only case that needs hands. The message lists each file; restore them
  with `git checkout -- <path>` (or delete the new ones) before running again.

## Common mistakes

- Hand-writing a feature folder, a contract file or a service instead of running the generator.
- Leaving the generated `{}` schemas and tests as they are.
- A job test that waits on a `FakeClock` nobody moves (it times out), or moves it before the runner sleeps (use
  `runUntil` or `stepOnce`).
- Selecting a screen's jobs from `useJobStore` by hand instead of calling `useJobIdsToShow`.
- A `<header>` in a screen.
- `getByText` on a job's step line (it is there twice), or looking for `StreamingList` rows in a unit test.
- Reading `job.input` (there is none): check the result.
- Extending the generated `Default` story or bare manifest test instead of replacing them.
- Importing another feature, or anything from `about/`.
- Adding a tab without the design gate.
- Forgetting `show` for a feature that owns jobs, or `InterruptedJobs` on its screen.
- Rendering a screen that reads data in a test or story without `MockApp`.
