---
name: ak-studio-architecture
description: >
  The architecture of Open Agent Kernel Studio (OAK Studio, `ak-studio/`, Electron and React): the layers and
  the boundary rules, who owns each kind of data and the working-copy rule, the contract's four shapes (query,
  command, job, session) and its events, jobs (states, the JobContext API, the quit rule, crash records) and
  sessions, errors and their presentations, safe writes with revisions, capability gating, feature services
  and FeatureDeps, and why the browser's mock transport serves what the app serves. Use this skill before
  changing anything under `ak-studio/packages/contract`, `packages/runtime`, `apps/desktop` or the renderer's
  `shared/`, before declaring an operation, and when a lint, boundary or contract test fails and you need to
  know which rule it enforces.
license: Apache-2.0
metadata:
  author: yaalalabs
  category: developer
---

# OAK Studio architecture

This skill is the maintained source for the Studio's architecture. The design record it grew from,
`docs/specs/950-agent-kernel-studio-phase-1/implementation/architecture.md`, is frozen: where the two differ,
this skill and the code win. A change to a rule is made here, in the same PR as the code and the generator that
follow it.

Paths below are relative to `ak-studio/` unless they start with `docs/`. Commands run from `ak-studio/`.

Related skills: `ak-studio-new-feature` (adding a feature with the generators) and `ak-studio-ui` (ground
rules, patterns and `packages/ui`).

## The workspace

| Member                    | What it is                                                                                                                                                                                                                                                                                                       |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/contract`       | Every operation and stream, its shape and schemas, the domain types and the error catalog. Imports only zod.                                                                                                                                                                                                     |
| `packages/runtime`        | The browser-safe services core: `ServiceRegistry`, `ProjectScopes`, `SecretMasker`, `EventBus`, `StreamHub`, `JobService`, `SessionService`, the ports (`CommandRunner`, `ProjectFs`, `Watcher`, `JobRecordStore`, `Clock`) with in-memory fakes, and the feature services (`packages/runtime/src/features.ts`). |
| `packages/kernel-catalog` | The capability catalog types (`Capability`, `CapabilityStatus`, `CapabilityCatalog`, `EMPTY_CATALOG`). Empty until P2.                                                                                                                                                                                           |
| `packages/ui`             | The design system: presentational components only. See `ak-studio-ui`.                                                                                                                                                                                                                                           |
| `apps/desktop`            | The Electron main process and preload: the IPC server, `AppService`, `WindowService`, the Node implementations of the ports (`NodeJobRecordStore`), desktop-only feature services, the quit rule.                                                                                                                |
| `apps/renderer`           | The React app: `app/` (shell, router, feature registry), `shared/` (bridge, query, stores, patterns), `features/<name>/`.                                                                                                                                                                                        |

## Layers and boundaries

Arrows mean "may import": `app` → `features` → `shared` → `contract`; `app`, `features` and `shared` → `ui`;
runtime services → `contract`; desktop → `runtime`, `contract`.

| Layer                            | May import                                                                    | Must not import                                                           |
| -------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `packages/ui`                    | React, React Aria, Tailwind, its own `lib/`                                   | `@ak-studio/contract`, anything under `apps/`, anything that fetches data |
| `packages/contract`              | zod                                                                           | anything else (tests may also import vitest)                              |
| `packages/runtime`               | `@ak-studio/contract`, zod, itself                                            | Node built-ins, `electron`, the renderer, `apps/desktop`                  |
| `apps/renderer/src/shared`       | `contract`, `ui`; `runtime` only inside `shared/bridge/` (the mock transport) | `features/`, `app/`                                                       |
| `apps/renderer/src/features/<a>` | `shared`, `ui`, `contract`                                                    | any other feature, `app/`, `electron`, Node built-ins, `runtime`          |
| `apps/renderer/src/app`          | everything in the renderer                                                    | `electron`, Node built-ins                                                |
| `apps/desktop`                   | `contract`, `runtime`, Node, Electron                                         | nothing imports `apps/desktop` but itself                                 |

- Electron's values are imported only in `apps/desktop/src/main/index.ts` and `apps/desktop/src/preload/index.ts`
  (a type-only import is allowed anywhere in desktop). Everything else in main (services, the quit rule, the menu)
  takes Electron's values as arguments, so it is tested without Electron.
- Unit tests in the renderer may import `@ak-studio/runtime` (for `FakeClock` and constants); nothing else in the
  renderer outside `shared/bridge/` may.
- Enforced by dependency-cruiser (`.dependency-cruiser.cjs`, `pnpm depcruise`, proved by `pnpm depcruise:selftest`)
  and Biome's `noNodejsModules` and restricted imports (`biome.json`). Both run in `pnpm lint`. A rule broken
  means the design is wrong; do not add an exemption.

## Where each kind of data lives

Every piece of data has one owner. The renderer never keeps a second copy that can silently disagree.

| Kind of data                                                          | Owner                          | How the renderer holds it                                            |
| --------------------------------------------------------------------- | ------------------------------ | -------------------------------------------------------------------- |
| Project and machine state (files, config, toolchain, recent projects) | Main-process services          | The query cache (TanStack Query), through `useStudioQuery`           |
| Streams (command output, logs, agent events)                          | `StreamHub`                    | The stream store: `useStream(streamId)`                              |
| Jobs and sessions                                                     | `JobService`, `SessionService` | The job and session stores, filled by events: `useJob`, `useSession` |
| UI state (selection, open panel)                                      | The renderer                   | The feature's Zustand store in `model/store.ts`                      |
| Working copies (a form or note being edited)                          | The renderer, briefly          | `useWorkingCopy`, under the working-copy rule                        |
| Preferences (theme, layout)                                           | `AppService`                   | Query cache; written by a command (`app.setTheme`, `app.setLayout`)  |
| Secrets                                                               | The project's secret provider  | Names and resolve state only; a value never travels to the renderer  |

Rules:

1. **No optimistic writes.** A save shows a pending state until the main process confirms it.
2. **A feature store holds UI state, not server data.** The only exception is a working copy.
3. **The working-copy rule.** A view may hold an editable copy of server data only while it is edited. The copy
   records the revision it was taken from, is written back by one command with that `baseRevision`, and is dropped
   once the write is confirmed and re-read. If the source changes underneath it, the copy is kept and flagged as
   conflicting, and the user chooses. Use `useWorkingCopy` (`apps/renderer/src/shared/working-copy/useWorkingCopy.ts`);
   never write your own.
4. **Every query key comes from the feature's key factory**, `keys("<feature>")` in `api/keys.ts`
   (`apps/renderer/src/shared/query/keys.ts`): `.app(...parts)` for app-level data (`[domain, ...parts]`),
   `.detail(projectId, ...parts)` for project data (`[domain, projectId, ...parts]`). Give each query its own parts.
5. **Invalidation is by domain event.** A service that changes something emits
   `events.emit({ type: "domain.changed", domain: "<feature>" })` (with `projectId` for project data). The renderer
   (`shared/events/connectEvents.ts`, wired once by the app) invalidates the queries under `[domain]` or
   `[domain, projectId]`. The renderer never reasons about file paths, and a feature never subscribes to events
   itself.
6. **Secret values never travel from main to the renderer.** Raw output and error detail are masked by
   `SecretMasker` before they cross the bridge. No output, job result, session info or event may have a field named
   `key`, `apiKey` or `token` (a contract test).

## One project per window

- `projectId` identifies the open project in every project-scoped operation. `ProjectScopes`
  (`packages/runtime/src/scope.ts`) holds one scope per open project; closing it disposes the project's watchers,
  sessions and jobs.
- A handler for a project-scoped operation calls `this.#deps.scopes.require(projectId)`, which throws
  `project.notOpen`. JobService does it for a job whose input has `projectId`.
- `ProjectService` opens and closes scopes from P2; until then only tests open them
  (`scopes.open("support-triage", { root: "/projects/support-triage" })`).

## The contract

`packages/contract` declares every operation once. There are four shapes and only four.

| Shape   | Use for                                                                   | Builder                                                                                | Renderer side                               |
| ------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------- |
| query   | Reading state; no side effects                                            | `query({ name, input, output, errors?, capability? })`                                 | `useStudioQuery`                            |
| command | One write that normally finishes in under a second                        | `command({ ... })`                                                                     | `useStudioMutation`                         |
| job     | Finite work that is slow, cancellable or has steps; it ends with a result | `job({ name, input, result, title, cancellable, survivesQuit, errors?, capability? })` | `useStartJob`, then `useJob`                |
| session | Something long-lived that runs until stopped; it has no result            | `defineSessionKind({ kind, args, info, errors? })`                                     | `useSession`, `startSession`, `stopSession` |

A feature's operations live in `packages/contract/src/<feature>.ts`. The worked example is
`packages/contract/src/about.ts`:

```ts
import "./zodConfig";
import { z } from "zod";
import { platformSchema, Revision } from "./domain";
import { ERROR_CODES } from "./errors";
import { command, defineSessionKind, job, query } from "./shapes";

export const aboutNote = query({
	name: "about.note",
	input: z.strictObject({}),
	output: z.object({ note: z.string(), revision: Revision }),
});

export const aboutSetNote = command({
	name: "about.setNote",
	input: z.strictObject({
		note: z.string().max(10_000),
		baseRevision: Revision,
	}),
	output: z.object({ revision: Revision }),
	errors: [ERROR_CODES.fileChangedOnDisk],
});
```

Rules the tests hold you to:

- **A feature's contract file imports `./shapes`, `./domain` and `./errors`, never `./operations`** (that is an
  import cycle). `operations.ts` imports the feature's declarations and lists them.
- **Inputs are `z.strictObject` at every level** (an unknown key is `bridge.invalidInput`). **Outputs are plain
  `z.object`**, so undeclared fields are stripped before they cross the bridge. Bound what you can
  (`z.string().max(...)`, `z.int().min(...)`).
- The operation's `name` is `<feature>.<camelCaseVerb>`; its declaration is `<featureCamel><Name>`. Every request
  operation is in the `operations` map in `packages/contract/src/operations.ts`, sorted by name, keyed by its own
  name. `jobKinds` is derived from it. Session kinds go in `sessionKinds` by hand.
- `errors` lists only domain codes from `ERROR_CODES` (`packages/contract/src/errors.ts`). The bridge's own
  codes (`bridge.*`) and `internal.unexpected` are implicit and must not be listed. A job whose input has
  `projectId` lists `ERROR_CODES.projectNotOpen`.
- `capability` names a catalog id. The catalog is empty until P2, so no operation declares one yet (a contract test
  checks every declared id exists).
- Types for handlers and hooks come from the contract: `HandlerInputOf<Operations["x.y"]>`,
  `HandlerResultOf<Operations["x.y"]>`, `JobResultOf<"x.y">`, `SessionArgsOf<"x.y">`, `SessionInfoOf<"x.y">`,
  `InputOf<"x.y">`, `OutputOf<"x.y">`.
- Use `pnpm new:operation` to add a query, command or job (see `ak-studio-new-feature`). It writes the declaration,
  the map entry, the service method, the hook and their tests. Session kinds are written by hand.

**Events.** The `events` stream carries one union, `StudioEvent` (`packages/contract/src/domain.ts`):
`job.updated`, `session.updated`, `command.recorded` and `domain.changed { domain, projectId? }`. There is one
domain event type with a `domain` field, not one type per domain. `stream.read` carries one stream's chunks,
backlog first. The app subscribes once; features read the stores.

## Feature services

A feature's operations are served by one class: `packages/runtime/src/<feature>/<Feature>Service.ts`, built from
`FeatureDeps` (`packages/runtime/src/features.ts`) passed to its constructor:

| `FeatureDeps` field                                         | What it is                                                                                    |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `app`                                                       | `{ version, platform }`: the app's identity (`"browser"` under the mock)                      |
| `clock`                                                     | `Clock` (`now()`, `sleep(ms, signal?)`). Every wait goes through it, so tests use `FakeClock` |
| `commandRunner`, `projectFs`, `watcher`                     | The ports. Optional until P2: the mock passes fakes, the desktop passes none yet              |
| `jobs`, `sessions`, `streams`, `events`, `scopes`, `masker` | The core services                                                                             |

```ts
export class AboutService implements FeatureService {
	readonly #deps: FeatureDeps;

	constructor(deps: FeatureDeps) {
		this.#deps = deps;
	}

	note(): HandlerResultOf<Operations["about.note"]> {
		return { note: this.#note, revision: this.#revision };
	}

	register(registry: RequestRegistrar<Operations>): void {
		registry.handle("about.note", () => this.note());
		this.#deps.jobs.define("about.demoJob", (_input, ctx) => this.demoJob(ctx));
		registry.handle("about.demoJob", this.#deps.jobs.handler("about.demoJob"));
	}
}
```

- Each operation's handler is a method. `register` is the class's **last member** (the generator inserts there
  and refuses otherwise).
- The service's factory, `(deps) => new XService(deps)`, is listed in `FEATURE_SERVICES` in
  `packages/runtime/src/features.ts`. The desktop's `registerServices` (`apps/desktop/src/main/services/registerServices.ts`)
  and the mock transport both call `registerFeatureServices`, so the browser serves exactly what the app serves.
- To fail with a code, throw `new StudioFailure({ code: ERROR_CODES.x, message })`. Anything else thrown becomes
  `internal.unexpected`. Exceptions never cross the bridge: the registry converts them.
- Runtime code is browser-safe: no `node:*` import. For a hash use Web Crypto (`crypto.subtle.digest`), as
  `AboutService` does. Processes, files and watching go through the ports.
- A query or command whose handler needs Node or Electron goes in a desktop-only service,
  `apps/desktop/src/main/services/<Feature>Service.ts` (`pnpm new:operation ... --desktop`), registered in
  `registerServices.ts` with `registry.register(new XService(featureDeps))`. The mock answers it from a fixture in
  `apps/renderer/src/shared/bridge/desktopFixtures.ts`. A job is never desktop-only.
- Copy a service needs (messages, step labels) lives in a strings module beside it, as
  `packages/runtime/src/about/strings.ts` does. Do not import anything from `about/`: the About feature is a
  throwaway slice, deleted when P2 lands its first real feature.
- `ServiceRegistry.start()` fails when a declared operation has no handler, so a missing registration fails at
  start-up and in `apps/desktop/src/main/services/registerServices.test.ts`.

## Jobs

`Job` (`packages/contract/src/domain.ts`) has `state`: `queued`, `running`, `waiting-for-user`, then `succeeded`,
`failed` or `cancelled`. JobService (`packages/runtime/src/jobs.ts`) owns it and announces every change as
`job.updated` with a rising `seq`.

A runner is `(input, ctx: JobContext) => Promise<result>`. `JobContext`:

| Member                                                                                          | Use                                                                                                                                                           |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `jobId`, `projectId`                                                                            | The job's id; the project from the input's `projectId`                                                                                                        |
| `signal`                                                                                        | Aborted on cancel (by the user, quit or project close). Pass it to every wait: `this.#deps.clock.sleep(ms, ctx.signal)`                                       |
| `step(step, steps, label)`                                                                      | Progress: step `step` of `steps`, labelled                                                                                                                    |
| `stream.write(channel, text)`                                                                   | A line of output (`"stdout"`, `"stderr"` or `"info"`), masked by StreamHub                                                                                    |
| `confirm({ title, summary, affects?, destructive?, expectedName?, approveLabel?, denyLabel? })` | Asks approve or deny; resolves `true` or `false`. With `expectedName` it is `confirm-by-name`; `destructive` needs it. Labels say what happens ("Apply plan") |
| `ask(request)`                                                                                  | Any `UserRequest` (`permission`, `choice`); one open at a time                                                                                                |
| `cancel()`                                                                                      | Ends the job `cancelled` from inside the runner (a denied confirm). It throws, so nothing after it runs                                                       |
| `addCommand(commandId)`                                                                         | Notes a `CommandRunner` record; it is written to the crash record                                                                                             |

```ts
async demoJob(ctx: JobContext): Promise<JobResultOf<"about.demoJob">> {
	const { steps, stepLine, confirm } = aboutStrings;
	for (const [index, label] of steps.entries()) {
		const step = index + 1;
		if (step === steps.length && !(await ctx.confirm(confirm))) ctx.cancel();
		ctx.step(step, steps.length, label);
		ctx.stream.write("stdout", stepLine(step, steps.length, label));
		await this.#deps.clock.sleep(ABOUT_STEP_MS, ctx.signal);
	}
	return { steps: steps.length };
}
```

- Register a kind with `this.#deps.jobs.define(name, (input, ctx) => this.x(input, ctx))`, then
  `registry.handle(name, this.#deps.jobs.handler(name))`. The handler answers `{ jobId }` at once.
- **Answering** is only `job.respond` (the approval pattern sends it). A denied `confirm` should end the job with
  `ctx.cancel()`: the user stopped it, nothing failed.
- **Serialising.** Jobs of one kind on one project run one at a time, in order.
- **Reload.** A reloaded window calls `jobs.list` and reattaches to running jobs and their streams.
- **Quit rule** (`apps/desktop/src/main/quit.ts`, native dialogs from `index.ts`). Unsaved work is asked about
  first. Jobs with `survivesQuit: false` are cancelled after asking. A started job with `survivesQuit: true` blocks
  quit (Wait, or a warned "quit anyway"). Set `survivesQuit: true` only where killing the process risks damage
  (`terraform apply`). Cancelling and stopping get 5 seconds (`QUIT_WAIT_MS`).
- **Crash records.** JobService writes a record when a job starts and removes it when it ends
  (`NodeJobRecordStore`, one file per job in `<userData>/jobs/`). A record left at the next launch is listed by
  `jobs.interrupted` and shown by the owning feature's screen with `<InterruptedJobs kinds={[...]} />`.
- **Ownership.** The feature that owns a job kind lists it in its manifest's `jobs` and names a `show` command; the
  background job notice uses both. A registry test fails unless every contract job kind has exactly one owner.
- Renderer: `useStartJob("x.y").start(input)` (or `startJob` outside React) answers the id; read the job with
  `useJob(jobId)` or `useJobStore`; show it with `JobProgress` / `JobProgressList`, which also renders its question.

## Sessions

`Session.state`: `starting`, `running`, `stopping`, then `stopped` or `failed`. One per kind per project.

- Declare the kind with `defineSessionKind` in the feature's contract file and add it to `sessionKinds` in
  `operations.ts` by hand (`args` is an input, so strict; `info` is an output, so plain).
- Give its starter in the service's `register`: `this.#deps.sessions.define(kind, (args, ctx) => this.start(args, ctx))`.
  The starter answers a `SessionHandle`: `{ info, stop() }`. `SessionContext` has `sessionId`, `projectId`,
  `signal` (a stop while starting), `stream.write`, `addCommand` and `fail(error)` (it stopped by itself).
- Renderer: `useSession(kind)`, `startSession({ kind, args })`, `stopSession(id)`
  (`shared/sessions/sessionStore.ts`), shown with `SessionControl`. `features/about/api/useAboutTicker.ts` is the
  hand-written hook to copy.
- All sessions stop when their project scope is disposed; sessions alone are stopped at quit without asking.

## Streams

- A stream belongs to a job, a session or a recorded command and is addressed by `streamId`.
- StreamHub batches chunks (one message per stream per frame at most), keeps a bounded backlog
  (`DEFAULT_BACKLOG_LINES`, 5,000) and masks secrets. A late subscriber gets the backlog first.
- The renderer's stream store keeps 5,000 lines per stream (`STREAM_BUFFER_LINES`); `useStream(streamId)` reads it
  and `StreamingList` shows it.

## Errors

`StudioError` (`packages/contract/src/errors.ts`): `code` (from `ERROR_CODES`), `message` (what to do next,
sentence case), optional `detail` (raw, masked, collapsed), `file` and `line`, and `action` (an app command to run
next).

- A failure crosses the bridge as a value. In the renderer it arrives as a `StudioFailure` whose `.error` is the
  `StudioError`.
- **Adding a code** means three edits: the code in `ERROR_CODES`, its title in `errorStrings.titles`
  (`apps/renderer/src/shared/errors/strings.ts`) and its entry in `ERROR_PRESENTATIONS`
  (`apps/renderer/src/shared/errors/presentation.ts`), with a placement. The map's type fails the typecheck when one
  is missing. Prefer an existing code when it says what happened.
- Placement: `inline` for a field or a control, `banner` for a view, `toast` only for something that finished in
  the background.
- Show any error with `<ErrorView error={...} />` (`shared/patterns/ErrorView.tsx`). Never render raw error text
  yourself, and never "Something went wrong".

## Safe writes and revisions

- Every read of a file-backed resource answers a `revision`: the SHA-256 of the content as 64 lowercase hex
  characters (`Revision` in `packages/contract/src/domain.ts`).
- Every command that writes carries the `baseRevision` it was edited from. If the current revision differs, it
  fails with `file.changedOnDisk`. **The error carries no content**: the renderer re-reads the query for the new
  content and revision, and the working copy keeps the user's edits, flagged as conflicting.
- Files go through `ProjectFs` (`packages/runtime/src/ports/projectFs.ts`): `read(path)` answers
  `{ content, revision }`, `write(path, content, baseRevision)` answers `{ revision }` or throws
  `FileChangedOnDiskFailure`. Its `current` content stays in the main process; let it propagate and the registry
  sends only the `StudioError`. Writes are atomic (temporary file, then rename).
- A revision over something held in memory (as `about.setNote` does) is computed with Web Crypto, in the runtime:

```ts
export async function noteRevision(text: string): Promise<Revision> {
	const bytes = new TextEncoder().encode(text);
	const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
	return Array.from(digest, (b) => b.toString(16).padStart(2, "0")).join("");
}
```

Await the digest first, then compare `baseRevision` and write with no `await` in between, so two writes on one
base cannot both win. The empty string's revision is
`e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`. Emit `domain.changed` after the write.

- In the view: `useWorkingCopy({ value, revision, write, reread })`, with `ChangedOnDisk` and
  `UnsavedChangesGuard` over it (see `NoteSection` in `features/about/screens/AboutScreen.tsx`).

## Capability gating

- An operation that needs a kernel feature names its catalog id in `capability`. The registry refuses it with
  `kernel.capabilityUnavailable` when the project's version lacks it, and fails closed when no checker is set.
- In the renderer: `useCapability(id)` answers `available`, `needs-upgrade` or `removed`
  (`shared/capability/capability.tsx`); wrap the tab, section or control in
  `<CapabilityGate id="..." size="tab | section | control">` (`shared/patterns/CapabilityGate.tsx`). No feature
  writes its own version check, and nothing is hidden.
- A manifest lists the capabilities it uses in `capabilities`; an app command may name one in `capability` (the
  palette lists it with the gate's reason and `runCommand` refuses it). A test checks each id is in the catalog.
- The catalog is empty until P2: declare no capability in P1b work.

## The mock transport

`apps/renderer/src/shared/bridge/mockTransport.ts` runs a real `ServiceRegistry` from `@ak-studio/runtime` over the
same services the desktop registers: the runtime feature services (with the ports' fakes), JobService and
SessionService over `InMemoryJobRecordStore`, fixtures for `app.*` and `window.*`, and `desktopFixtureHandlers` for
desktop-only operations. Inputs and outputs are parsed as in the app. So:

- The renderer runs in a browser (`pnpm --filter @ak-studio/renderer dev`, the browser e2e project, Storybook)
  with no Electron and no Python.
- A feature behaves the same in the browser and the app. If it does not, the bug is in the feature, not the mock.
- Tests and stories pass `clock: new FakeClock(...)` to run steps and ticks at once (`connectMock` in
  `apps/renderer/src/test/connectedMock.tsx`, `MockApp` in `apps/renderer/src/test/MockApp.tsx`; stories import
  `FakeClock` from `shared/bridge/mockTransport`).

## What enforces what

| Rule                                                                                                       | Enforced by                                           |
| ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Layer boundaries; no feature imports another                                                               | `pnpm depcruise`, Biome (`pnpm lint`)                 |
| Every operation has a handler                                                                              | `ServiceRegistry.start()`; `registerServices.test.ts` |
| Inputs strict, outputs plain, no `key`/`apiKey`/`token` field, codes and capabilities exist                | `packages/contract/src/contract.test.ts`              |
| Every error code has a presentation                                                                        | the `ERROR_PRESENTATIONS` type and its test           |
| Every job kind has one owning feature; command ids sit in their feature's namespace; shortcuts never clash | `apps/renderer/src/app/registry.test.ts`              |
| Every component and screen has its stories                                                                 | `pnpm check-stories`                                  |
| No arbitrary values or inline colours                                                                      | `pnpm check-classes`, `pnpm check-palette`            |

Before committing a change here: `pnpm lint`, `pnpm typecheck` and `pnpm test`, from `ak-studio/`.

## Common mistakes

- Importing `node:crypto` (or any `node:*`) in `packages/runtime`. Use Web Crypto.
- Declaring an operation in `operations.ts` itself, or importing `./operations` from a feature's contract file.
- A plain `z.object` input, or a `z.strictObject` output.
- Listing `bridge.invalidInput` in `errors`.
- Holding server data in the feature store, or updating the query cache optimistically.
- Building a query key by hand instead of with the feature's `keys(...)`.
- Subscribing to `events` in a feature, or invalidating queries by hand after a command, instead of emitting
  `domain.changed` from the service.
- Putting content in a `file.changedOnDisk` error.
- Waiting with `setTimeout` in a service instead of `this.#deps.clock.sleep(ms, ctx.signal)`.
- A job runner that ignores `ctx.signal`: cancel and quit then wait for it.
- Importing from `packages/runtime/src/about/` or `apps/renderer/src/features/about/`: About is throwaway.
