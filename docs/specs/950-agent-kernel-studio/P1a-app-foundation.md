# P1a · App foundation: workspace, shell, bridge and design system

| | |
|---|---|
| Status | Started 24 November 2026. Tasks 1–10 done on Linux; shell layout and component set await sign-off. The branding changes of 25 November 2026 (see the sign-off notes) are decided; the code change lands separately. [Execution plan](P1a-plan.md) |
| Business aspect | The Studio exists: it builds locally, opens a window, and looks like Open Agent Kernel (OAK) |
| PRD milestone | Before milestone 1 |
| Depends on | [P0](P0-technology-selection.md). The stack and pinned versions are in its [decision record](P0-technology-selection.md#decision-record), which is in owner review: the choices of Vite and shadcn/ui were the owner's from the start, and D1a, D5 and D12 were approved after the spikes; everything else is pending. Windows and macOS were never run; CI on three systems must pass before this phase relies on those results. |
| Unlocks | [P1b](P1b-data-layer-and-patterns.md); P12 reuses the build pipeline |
| Screens | The desktop shell (top bar, tabs, bottom panel, status bar) and the component library in Storybook |

## Outcome

A developer clones the repository, runs one command in `ak-studio/`, and the Studio opens: an empty shell with
the top bar, tabs, bottom panel and status bar, in dark and light. The component library is browsable in
Storybook. CI builds and tests it on Windows, macOS and Linux and produces an unsigned installer for each.
There is no project feature yet.

**Linux first.** Windows and macOS are deferred by the owner (23 November 2026), so the three-system items
below are written and configured but marked Deferred until they can run ([plan](P1a-plan.md), ruling 1).

## Scope

**In**

- The `ak-studio/` workspace and its build, run, test and package commands.
- Electron main, preload and renderer with the security baseline.
- The typed bridge with a swappable transport.
- The Studio design system: tokens, base components, shell components.
- Storybook, as the place designs are finalised ([design-process.md](design-process.md)).
- CI for three operating systems.

**Out**

- The data and feature layer, shared patterns and skills ([P1b](P1b-data-layer-and-patterns.md)).
- Opening a folder or any project logic (P2). Signed installers and updates (P12).

## Design gate

Follow [design-process.md](design-process.md). Existing input: briefs 00 and 01 and the System page of the
canvas. Options for palette, fonts, density and theme, with measured contrast:
[research/p1a-design-gate-options.md](research/p1a-design-gate-options.md). This gate sets the look every later screen inherits, so it is the most important one.

| Subject | Requirements | Questions to settle |
|---|---|---|
| Palette and tokens | The Studio looks like Agent Kernel. | **Brand drift:** the briefs make electric blue the primary colour; the repository's current tokens (`docs/src/css/custom.css`) make orange `#FF5E32` primary. Which is the Studio's primary, which colour marks the coding agent, and do both pass 4.5:1 contrast on the app's surfaces. |
| Style reference | **Decided:** the components' basic style resembles React Spectrum (Spectrum 2), with Agent Kernel's colours and fonts. | How closely to follow it where the briefs differ: the briefs assume glass floating layers and a 40 px row; floating layers are **solid, decided in P0**, and Spectrum 2 has its own size scale. Start from the token table measured in the P0 S1 spike. |
| Density | A tool used for hours. | The type scale, row height and spacing steps, starting from Spectrum 2's scale. Comfortable and compact, or one density. |
| Theme | Dark and light. | Which is the default. |
| Shell layout | Top bar with project switcher, tabs, run control, deploy status, Build with AI; bottom panel; status bar. No left navigation. | Whether five tabs plus controls fit the top bar at 1100 px. Native or custom window controls per operating system. Where settings open. |
| Base components | The inventory in brief 01. | Which components are needed by P2 and P3 and are built now, and which wait for the phase that first uses them. |

**Sign-off**

| Subject | Options explored | Decision | Approved by | Date |
|---|---|---|---|---|
| Style reference: how closely to follow Spectrum 2 (floating layers are solid, decided in P0) | | | | |
| Palette, tokens, density, theme | 3 palettes, 2 font pairings, 3 densities, 3 default themes ([options](research/p1a-design-gate-options.md)) | Option A palette: Agent Kernel's current brand. Orange `#FF5E32` primary (dark text on fills), ice `#B1CDFF` / dusk `#3F598A` for the coding agent, navy ground; every role gets per-surface text variants tuned to 4.5:1. Fonts: Inter for UI, Archivo for headings, JetBrains Mono for code. Density: one, Spectrum 2 medium (32 px controls, 40 px rows, 14 px text, 48 px top bar). Default theme: follow the system setting, dark when unknown | Dhananjaya Rajasinghe | 25 Nov 2026 |
| Shell layout | | | | |
| Base component set | | | | |

Notes for the "Shell layout" sign-off (Task 10 prototype; the stories, the recommendations and the full list are in
the Task 10 report): the app tabs' empty states have no first action in P1a, a waiver of the empty-state pattern
("purpose and first action"), because no project can be opened yet; P2 adds "Open folder". The copy names the
phase that fills each tab, as 1.5 asks.

Notes for the "Style reference" and "Base component set" sign-offs: a **branding change**, ruled on 25 November
2026 at the owner's request (README decision log). Where [branding/README.md](../../../branding/README.md) is
explicit, it wins over Spectrum 2:

- Buttons, inputs and tags are rectangular at the 8 px control radius (`--ak-radius-control`). This replaces the
  Spectrum 2 pill shape for those components. Spectrum 2 still sets size, density and states.
- Icons are Tabler outline icons, replacing lucide.
- Primary call-to-action labels use Archivo; UI text stays Inter; headings stay Archivo.
- The logo mark is the app icon and sits in the top bar.
- Kept, as approved: palette A (it is the brand), 32 px controls, dark when the system gives no answer, solid
  floating layers. The team's brief 00 assumes 40 px controls, Archivo for all UI text and a light fallback;
  those are [open decision 10](README.md#open-decisions).

The component stories are reviewed for sign-off after these changes land in `ak-studio/`.

## Work packages

### 1.1 Workspace

- [x] `ak-studio/` at the repository root, beside `ak-py/`, as a pnpm workspace (the five members and the README;
      the items marked P1b come in P1b):

  ```
  ak-studio/
    apps/
      desktop/        Electron main and preload
      renderer/       The React app. No Electron import. Runs in a browser.
    packages/
      contract/       Bridge types and schemas, shared by main and renderer
      ui/             Design system: tokens and components, with stories
      kernel-catalog/ Agent Kernel capability catalog (filled in P2)
    fixtures/         (P1b) The support-triage fixture project and template reference projects
    tools/            (P1b) Generators: new:feature, new:operation, new:component
    .agents/skills/   (P1b) The ak-studio-* skills; .claude/skills links here
    AGENTS.md         (P1b) Points coding agents to the skills
    README.md         Build, run, test, package
  ```

- [x] Commands: `dev`, `build`, `test`, `lint`, `storybook`, `package`. Add matching targets to the root
      `Makefile` and a section to `DEVELOPER_GUIDE.md`. (The `make` targets were checked by running their
      `pnpm --dir ak-studio` commands on Linux; `make` itself was not installed.)
- [x] Exact dependency versions pinned, starting from the P0 decision record. Biome (not ESLint) lints; TypeScript 7.
      Pins added in P1a are recorded in the record's D1, D2, D3, D9 and D10 rows.
- [x] A lint rule that fails the build if `apps/renderer` or `packages/ui` imports `electron` or a Node
      built-in: dependency-cruiser 18.9.0 with `@swc/core` 1.16.22, plus its self-test as a CI step (without
      `@swc/core` it passes silently; P0 D13). Both run in `pnpm lint`, locally and in CI (CI run: Deferred).

### 1.2 Electron main and preload

- [x] One window; size and position remembered. (Linux; restoring the maximised state is not proven under Xvfb.)
- [x] Security baseline: context isolation on, sandbox on, Node integration off, a content security policy, the
      app served from a custom protocol, navigation and new windows blocked, sender checked on every message.
- [x] The preload exposes the bridge transport and nothing else.
- [x] Single-instance lock. Application menu per platform. (Run on Linux; the macOS app menu is written, not run.)
- [x] The app makes no network calls of its own. (Checked on Chromium's network stack; Node networking in the
      main process is not covered by the check.)
- [ ] Extend the "no network calls" check to Node networking in the main process. It is a standing principle
      ([README](README.md#standing-principles)): with usage data off, the app makes no network calls of its own.

### 1.3 The bridge

- [x] `packages/contract`: every call and every stream is declared once, with a schema for its input and
      output.
- [x] The contract is the in-house zod contract with the `Transport` interface (P0 D5), not oRPC. The transport carries two primitives, `request` (one answer) and `subscribe` (a stream with cancel).
      P1a ships the transport and one plain request; the contract's operation shapes (query, command, job,
      session) are built on it in [P1b](P1b-data-layer-and-patterns.md).
- [x] A `Transport` interface with two implementations: Electron IPC (sender checked on every message), and a mock for the browser and tests. The same renderer code runs on both.
- [x] Services in the main process are classes registered against the contract. P1a ships one: `AppService`
      (app version, platform, theme preference).
- [x] Errors cross the bridge as typed `StudioError` values, not as thrown strings.
- [x] Contract test: every declared operation has a handler; inputs are validated in the main process.

### 1.4 Design system (`packages/ui`)

- [ ] Size, shape, spacing and state tokens that follow Spectrum 2, from the table measured in P0 and the
      decisions at the design gate. Adobe's icons, fonts and brand colours are not used. (Mechanism done with
      provisional Spectrum 2 medium values; the values wait for the design gate, Task 8.)
- [ ] Tokens as CSS variables, dark and light, from the decisions at the design gate, declared in Tailwind's
      `@theme` with **Tailwind's default colour palette removed**, so only design-system colours exist. (Done
      with stand-in values from the docs site, marked provisional; the values wait for the design gate, Task 8.)
- [x] Fonts bundled with the app (no network font loading). Their SIL OFL notices ship with the app.
- [ ] Base components, each with stories for default, hover, focus and disabled (waits for the design gate,
      Task 9):
  - Controls: Button (primary, secondary, outline, ghost, danger, icon), Input, Textarea, Select, Combobox,
    Checkbox, Radio, Toggle, Segmented control.
  - Display: Tag, Badge, Status chip, Path chip, Card, Code block, Tooltip, Skeleton, Spinner, Empty state,
    Inline banner.
  - Overlays: Modal, Confirm modal, Drawer, Popover, Menu, Context menu, Toast.
  - Structure: Tabs, Resizable panels, Data table, Tree.
- [ ] Components that only a later phase needs (canvas nodes, chat cards, trace views, plan summary) are built
      in that phase, in this package.
- [ ] An accessibility check runs on every story in CI. (Written; runs on every story on Linux with
      `pnpm test:storybook`; the CI run is Deferred, not executed.)

### 1.5 Desktop shell (`apps/renderer`)

- [ ] `DesktopShell` with `TopBar`, `AppTabs` (Canvas, Code, Config, Test & Trace, Deploy), `BottomPanel`
      (Problems, Run log, Commands), `StatusBar`. (Built on Linux as the design gate's step 4 prototype, Task 10:
      stories under `Shell/` and wired in the app; waits for the "Shell layout" sign-off.)
- [ ] Each tab shows an empty state naming the phase that fills it. (Task 10, with the shell: Canvas, Code and
      Config P3; Test & Trace P8 and P9; Deploy P10.)
- [ ] Routing with in-memory or hash history. Theme switch. Panel sizes remembered. (Task 10: each tab is a hash
      route; the theme switches from the settings modal; the bottom panel's open state and height are an app
      preference stored through `app.setLayout`. Waits for the "Shell layout" sign-off.)
- [x] Runs in a browser against the mock transport.

### 1.6 Continuous integration

- [ ] A workflow that runs on changes under `ak-studio/` only, on Windows, macOS and Linux: lint, type-check,
      unit tests, Storybook build, an end-to-end smoke test, and an unsigned installer as a build artifact.
      (`studio.yml` is written and parsed, and starts the packaged app before it uploads the installer; it has
      not run: Deferred, not executed.)
- [x] The existing Python workflows do not run on Studio-only changes, and the reverse. (Test, Code Quality
      and Auto Sync Skills and Docs ignore `ak-studio/**`; `studio.yml` runs only on Studio paths.)

## Version awareness

Nothing in P1a reads an Agent Kernel version. It creates the empty `kernel-catalog` package and the shell slot
in the status bar where P2 shows the version.

## Verification

- [ ] `pnpm install` then `pnpm dev` opens the app on all three operating systems, from a clean clone.
      (Linux now; Windows and macOS deferred.) Linux: done, 25 Nov 2026. Windows and macOS: Deferred (not
      executed).
- [x] The renderer opens in a browser with the mock transport.
- [x] The lint rule catches an `electron` import in the renderer.
- [x] Contract test passes; a missing handler fails it.
- [ ] End-to-end smoke test: the app starts, each tab opens, the theme switches. (Done on Linux, Task 10: the
      shell renders, each tab opens its empty state, the theme switches from the settings modal, the bottom panel
      persists across a restart; the packaged app starts. Checked off with the "Shell layout" sign-off.)
- [ ] Every story passes the accessibility check and the [UX checklist](design-process.md). (The three token
      stories pass the accessibility check on Linux; the UX checklist applies to the components of Task 9.)
- [ ] CI is green on three operating systems and uploads three installers. (Deferred: needs push access
      and the owner's go-ahead for Windows and macOS.)
- [x] A class from Tailwind's default palette (`text-blue-500`) fails the build.

## Open decisions

- The product name and the app identifier. The working name is "OAK Studio" ("Open Agent Kernel Studio" on
  first mention) since 25 November 2026; `ak-studio/` and `.akstudio/` stay. The final name is decided by P12
  at the latest ([open decision 3](README.md#open-decisions)).
- The Studio's licence, before any build leaves the team. The PRD recommends free to use locally, ideally
  open source; this repository's Apache 2.0 licence would apply on merge unless the owner decides otherwise
  ([open decision 9](README.md#open-decisions)).
- Whether the approved components are fed back into the Agent Kernel Design System used by the docs site.

## Risks

| Risk | Default |
|---|---|
| Building the whole component inventory up front delays everything | Build only what P2 and P3 need; add the rest in the phase that uses it |
| The docs site's tokens are tuned for marketing pages | The design gate defines app-specific density and surface tokens on top of the brand colours |
| The JavaScript workspace disturbs the Python repository's tooling | Path-filtered CI; `ak-studio/` is self-contained; nothing in `ak-py/` depends on it |
