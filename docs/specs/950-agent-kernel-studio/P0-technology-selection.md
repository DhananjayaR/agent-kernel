# P0 · Technology selection

| | |
|---|---|
| Status | In progress: desk research done; bundler (Vite) and component library (shadcn/ui) decided; spikes not started |
| Business aspect | None visible to users. Decides what the Studio is built with, so every later phase builds on proven choices. |
| Issue milestone | Before milestone 1 |
| Depends on | Nothing |
| Unlocks | P1a |
| Screens | None. The spikes build throwaway screens only. |
| Evidence | [research/tech-stack-evaluation.md](research/tech-stack-evaluation.md) |
| Execution plan | [P0-plan.md](P0-plan.md): task-by-task steps for the spikes |

## Outcome

A decision record for every part of the stack, each backed by a spike that ran on Windows, macOS and Linux.
Spike code is throwaway and is not carried into P1a.

## What the choices are judged against

| # | Constraint |
|---|---|
| C1 | Themes fully to the Agent Kernel look: tokens, pill buttons and tags, glass floating layers, dark and light |
| C2 | Covers a dense desktop UI: tree, virtualised table, combobox, menus, context menu, command palette, resizable panels, tabs, toasts, drag and drop |
| C3 | Accessible by default |
| C4 | The renderer runs in a plain browser, with no Electron-only API |
| C5 | Builds and runs on Windows, macOS and Linux |
| C6 | A developer builds and runs it locally with one command |
| C7 | Streams well, with cancel |
| C8 | Low maintenance risk |

## Decisions to make

"Provisional" is the desk-research recommendation. It becomes a decision only when its spike passes.
**Decided** rows were settled by the project owner on 23 November 2026; their spikes now only confirm the
setup works and pin versions.

| # | Decision | Candidates | Provisional | Spike |
|---|---|---|---|---|
| D1 | Component library | React Spectrum (v3, Spectrum 2); React Aria Components; shadcn/ui on React Aria, Base UI or Radix | **Decided: shadcn/ui.** Its primitive base is still provisional: React Aria | S1 |
| D2 | Styling | Tailwind CSS 4; plain CSS modules | **Decided: Tailwind CSS 4** (it comes with shadcn/ui), tokens in `@theme` | S1 |
| D3 | Bundler and development loop | electron-vite (Vite 8); Rsbuild and Rspack with own glue; Electron Forge with Vite | **Decided: Vite.** Through electron-vite, provisionally; Electron Forge's Vite plugin is the fallback | S2 |
| D4 | Packaging | electron-builder; Electron Forge makers | electron-builder | S2 |
| D5 | Typed bridge | Own zod contract with a `Transport` interface; oRPC; tRPC | Own contract; adopt oRPC if it streams | S3 |
| D6 | Canvas | React Flow 13 or 12; others | React Flow with dagre | S4 |
| D7 | Code viewer | CodeMirror 6; Monaco | CodeMirror 6 | S4 |
| D8 | State, data, routing | Zustand, TanStack Query, TanStack Router; alternatives | As listed | S3 |
| D9 | Tests and design review | Vitest, Playwright, Storybook | As listed | S2 |
| D10 | Workspace and tooling | pnpm, Biome, TypeScript 7 or 6 | pnpm, Biome, TypeScript 7 | S2 |
| D11 | Electron version policy | Latest stable; how often to upgrade | Latest stable at P1a start, upgrade each Electron major | S2 |
| D12 | Forms and client-side validation | React Hook Form or TanStack Form; a JSON-schema validator (Ajv) or schemas converted to zod | React Hook Form with a JSON-schema validator, because config forms are generated from the kernel's JSON schema | S1 |
| D13 | Architecture checks | dependency-cruiser; Biome plugins or scripts for custom checks | dependency-cruiser plus small scripts | S2 |

### D1 and D2: the component library, in short

- **React Spectrum itself is ruled out by C1.** Both Spectrum v3 and Spectrum 2 carry Adobe's look, and
  Spectrum 2's own documentation sends custom design systems to React Aria Components.
- **React Aria Components**, Adobe's unstyled layer under Spectrum, meets C1, C2 and C3.
- **Decided: shadcn/ui, with Tailwind.** The code is copied into the repository and owned, so it takes the
  Agent Kernel look fully.
- **Decided: the basic style resembles React Spectrum (Spectrum 2).** The shadcn/ui components are restyled
  to Spectrum 2's control sizes, density, shapes, state styling and spacing, with Agent Kernel's colours and
  fonts. Adobe's icons, fonts and brand colours are not used.
- This strengthens the case for the React Aria base: React Aria is the behaviour layer under Spectrum, so the
  Studio's components would behave like Spectrum's as well as look like them.
- **Still open: which primitive base.** shadcn/ui offers Base UI (its default), Radix and React Aria. React
  Aria is the provisional pick because it brings the tree, the virtualised table and drag and drop under one
  accessibility model. Spike S1 checks that coverage; if it falls short, the base is Base UI with TanStack
  Table and Virtual.

### D3: the bundler, in short

- **Decided: Vite.** Rspack and Rsbuild are mature bundlers, but there is no supported Electron path for
  them and the community plugins are stale, so Rspack is dropped.
- electron-vite gives one config for main, preload and renderer, with hot reload for all three. It has one
  maintainer; Electron Forge's Vite plugin is the fallback if spike S2 finds a blocker.

## Spikes

Each spike is time-boxed, has pass criteria written before it starts, and ends with a short note added to
`research/`. Run on all three operating systems where marked.

### S1 · Components and theming (D1, D2). Two to three days.

Build one throwaway screen in the Agent Kernel look.

- [ ] `shadcn init` with the React Aria base, Tailwind 4, tokens from `docs/src/css/custom.css` in `@theme`.
- [ ] Measure Spectrum 2's sizes, radii, spacing and state styling from its documentation and turn them into
      tokens.
- [ ] Restyle Button, Tag, Input, Popover and Dialog to resemble Spectrum 2, in dark and light. Build
      floating layers both solid (as Spectrum has them) and with glass, for the design gate to choose.
- [ ] Side-by-side screenshots against the Spectrum 2 documentation.
- [ ] Build: a 5,000-row virtualised table, a tree with drag and drop, a combobox, a context menu, a command
      palette, resizable panels.
- [ ] Keyboard-only walk-through and a screen-reader check of each.
- [ ] List what the React Aria base lacks and how each gap is filled.
- [ ] Remove Tailwind's default colour palette in `@theme` and confirm shadcn/ui components still build on
      the design tokens alone.
- [ ] Render one form from a slice of the `AKConfig` JSON schema with the D12 candidates.

**Pass:** the components read as the same family as Spectrum 2 side by side; all components match the
tokens without overriding library internals; every component is
keyboard-operable; no more than two components need a second primitive library.
**If it fails:** repeat with shadcn/ui on Base UI plus TanStack Table and Virtual.

### S2 · Build, run and package (D3, D4, D9, D10, D11). Two days. All three operating systems.

Build a minimal app with electron-vite on Vite 8.

- [ ] Main, sandboxed preload and renderer build and start with one command.
- [ ] Renderer hot reload; main process restart on change.
- [ ] The same renderer served alone in a browser.
- [ ] Tailwind 4, Storybook, Vitest and one Playwright test run in the setup.
- [ ] electron-builder produces an unsigned installer on each operating system, in CI.
- [ ] Record: cold build time, hot reload time, and any tool that did not work on TypeScript 7.
- [ ] dependency-cruiser rejects a forbidden import between two workspace folders.

**Pass:** one command builds and runs on all three systems; CI is green on all three.
**If it fails:** repeat with Electron Forge and its Vite plugin.

### S3 · The bridge (D5, D8). Two days.

- [ ] Define one request and one stream in a shared contract.
- [ ] Main process: stream the output of a real child process.
- [ ] Renderer: subscribe, show the lines, cancel. The child process must stop.
- [ ] Run the same renderer code over a WebSocket transport from a browser.
- [ ] Try the same with oRPC.
- [ ] Apply the Electron security baseline (context isolation, sandbox, content security policy, custom
      protocol, sender validation) and confirm nothing breaks.

**Pass:** the renderer code is identical on both transports; cancel stops the process on all three systems;
a 10,000-line burst does not freeze the window.

### S4 · Canvas and code (D6, D7). Two days.

- [ ] React Flow: 300 custom nodes with the glass style, pan and zoom stay smooth; auto-layout runs off the
      main thread.
- [ ] Decide React Flow 13 or the 12 pin.
- [ ] CodeMirror: a 2,000-line Python file with highlighting, a side-by-side diff, YAML with inline errors from
      a JSON schema.

**Pass:** smooth interaction at 300 nodes; the editor matches the tokens; diff and YAML errors work.

## Decision record

Filled in as spikes finish. Each row is also copied to the README decision log.

| # | Decision | Chosen | Version pinned | Spike note | Date | Approved by |
|---|---|---|---|---|---|---|
| D1 | Component library | shadcn/ui, styled to resemble React Spectrum (Spectrum 2); base: open | | | 23 Nov 2026 | Project owner |
| D2 | Styling | Tailwind CSS 4 | | | 23 Nov 2026 | Project owner |
| D3 | Bundler | Vite (electron-vite, to confirm in S2) | | | 23 Nov 2026 | Project owner |
| D4 | Packaging | | | | | |
| D5 | Bridge | | | | | |
| D6 | Canvas | | | | | |
| D7 | Code viewer | | | | | |
| D8 | State, data, routing | | | | | |
| D9 | Tests and design review | | | | | |
| D10 | Workspace and tooling | | | | | |
| D11 | Electron version policy | | | | | |
| D12 | Forms and validation | | | | | |
| D13 | Architecture checks | | | | | |

## Checklist

- [x] Desk research
- [ ] Execution plan followed: [P0-plan.md](P0-plan.md) ([research/tech-stack-evaluation.md](research/tech-stack-evaluation.md))
- [ ] Constraints C1 to C8 confirmed
- [ ] S1 Components and theming
- [ ] S2 Build, run and package
- [ ] S3 The bridge
- [ ] S4 Canvas and code
- [ ] Decision record complete and approved
- [ ] Spike code deleted or archived outside `ak-studio/`

## Exit criteria

- Every row of the decision record is filled, with a pinned version.
- Each choice has a spike note in `research/`.
- Any constraint that could not be met is written down with its consequence.

## Risks

| Risk | Default |
|---|---|
| Many candidate versions are weeks or months old | Pin exact versions; prefer the previous major where the new one fails a spike |
| A spike overruns | Time-box; an overrun is itself a result and counts against the candidate |
| TypeScript 7 is not supported by a tool in the chain | Fall back to TypeScript 6; revisit later |
