# P0 · Technology selection

| | |
|---|---|
| Status | In review: four spikes ran on Linux only; the decision record is drafted and waits for owner review; Windows and macOS were never run |
| Business aspect | None visible to users. Decides what the Studio is built with, so every later phase builds on proven choices. |
| Issue milestone | Before milestone 1 |
| Depends on | Nothing |
| Unlocks | P1a |
| Screens | None. The spikes build throwaway screens only. |
| Evidence | [research/tech-stack-evaluation.md](research/tech-stack-evaluation.md); spike notes [S1](research/spike-s1-components.md), [S2](research/spike-s2-build.md), [S3](research/spike-s3-bridge.md), [S4](research/spike-s4-canvas-code.md) |
| Execution plan | [P0-plan.md](P0-plan.md): task-by-task steps for the spikes |

## Outcome

A decision record for every part of the stack, each backed by a spike that ran on Windows, macOS and Linux.
Spike code is throwaway and is not carried into P1a.

**Where it stands.** The spikes ran on Linux (WSL2) only. The spike branch was never pushed and the CI
workflow never ran, so every Windows and macOS item is "Not run — pending CI on three systems". The record
below is a draft for owner review. See [Exit criteria](#exit-criteria) for what is open.

## What the choices are judged against

| # | Constraint |
|---|---|
| C1 | Themes fully to the Agent Kernel look: tokens, pill buttons and tags, dark and light. Floating layers are solid, as in Spectrum 2 (decided 23 Nov 2026; this replaces "glass floating layers") |
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
- **Primitive base: React Aria, confirmed by spike S1 on Linux, pending owner review.** shadcn/ui offers
  Base UI (its default), Radix and React Aria. React Aria brings the tree, the virtualised table and drag and
  drop under one accessibility model. S1 needed only two other libraries (the splitter and toasts), within the
  limit of two, so the Base UI fallback was not needed.

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

Each row is also copied to the README decision log. All spike evidence is from Linux (WSL2) only. Every
Windows and macOS item is **Not run — pending CI on three systems**. Dates are the spike date. Approval is
"Pending owner review" on every row except the three the owner decided on 23 November 2026 (D1a, D5 and
D12).

| # | Decision | Chosen | Version pinned | Spike note | Date | Approved by |
|---|---|---|---|---|---|---|
| D1 | Component library | shadcn/ui on the React Aria base, restyled to resemble React Spectrum (Spectrum 2). shadcn/ui and the Spectrum 2 style were chosen by the owner earlier; the React Aria base is confirmed on Linux. We own `tree.tsx` (not in the shadcn registry) and a virtualised `table.tsx`. Two other libraries: splitter and toasts | shadcn 4.23.0 (style `aria-nova`), react-aria-components 1.22.1, cn 0.5.2, class-variance-authority 0.7.1, lucide-react 1.77.0, react-resizable-panels 4.24.1, sonner 2.0.8 | [S1](research/spike-s1-components.md) | 23 Nov 2026 | Pending owner review |
| D1a | Floating layers (menus, popovers, drawers, modals, toasts) | **Solid, as in Spectrum 2, not glass.** Decided in P0. Matches the Spectrum 2 style reference. S1 also found the brief's light-mode glass fill gave 2.67:1 title contrast and needed its own fill | n/a | [S1](research/spike-s1-components.md) | 23 Nov 2026 | Dhananjaya Rajasinghe |
| D2 | Styling | Tailwind CSS 4, tokens in `@theme`, default colour palette removed, shadcn's semantic names mapped onto the Agent Kernel tokens. Needs a `cn` config kept in step with the tokens | tailwindcss 4.3.5, @tailwindcss/vite 4.3.5, tw-animate-css 1.4.0, @fontsource-variable/archivo 5.3.0, @fontsource/jetbrains-mono 5.3.0 | [S1](research/spike-s1-components.md) | 23 Nov 2026 | Pending owner review |
| D3 | Bundler and development loop | Vite through electron-vite. No blocker on Linux; Electron Forge fallback not needed. Cold `electron-vite build` about 1.0 s, renderer hot reload about 58 ms, main restart about 131 ms. Windows and macOS: Not run — pending CI on three systems | electron-vite 6.0.0, vite 8.3.8 | [S2](research/spike-s2-build.md) | 23 Nov 2026 | Pending owner review |
| D4 | Packaging | electron-builder. AppImage and deb built and the packaged app starts on Linux. NSIS and dmg installers: Not run — pending CI on three systems. Installing from an installer: not done, needs a person. Signing is P12 | electron-builder 26.18.0 | [S2](research/spike-s2-build.md) | 23 Nov 2026 | Pending owner review |
| D5 | Typed bridge | **The in-house zod contract with the `Transport` interface, not oRPC.** Reason from S3: the same renderer code runs over Electron IPC and WebSocket, and the in-house IPC checks the sender on every message; oRPC's Electron path has no sender check. oRPC 1.16.5 also streamed, aborted and ran over WebSocket, so the choice is on those grounds, not on a failed test. Keep `handlers.ts` transport-free | zod 4.6.7; ws 8.23.0 (development WebSocket server only). oRPC 1.16.5 tried, not adopted | [S3](research/spike-s3-bridge.md) | 23 Nov 2026 | Dhananjaya Rajasinghe |
| D6 | Canvas | React Flow 13 with dagre, layout in a worker. 13 passed; 12 not needed. Costs seen: 183 to 200 ms main-thread stall when 300 nodes mount; worst single frame 50 ms in the 300-node overview. Keyboard model open (see below) | @xyflow/react 13.0.2, @dagrejs/dagre 3.1.3 | [S4](research/spike-s4-canvas-code.md) | 23 Nov 2026 | Pending owner review |
| D7 | Code viewer | CodeMirror 6, with a read-only merge view for diffs and an Ajv + `yaml` lint source. Four defaults to set: `MergeView` `diffConfig.scanLimit`, a scrolling parent, `linter` `delay`, filtering `anyOf` noise. Cold open of the Code tab missed the 200 ms target (360 to 382 ms); preload on idle is untested | codemirror 6.0.2, @codemirror/view 6.43.15, @codemirror/state 6.7.6, @codemirror/language 6.13.1, @codemirror/lang-python 6.2.1, @codemirror/lang-yaml 6.1.3, @codemirror/merge 6.12.3, @codemirror/lint 6.9.8, @lezer/highlight 1.2.5, yaml 2.9.1 | [S4](research/spike-s4-canvas-code.md) | 23 Nov 2026 | Pending owner review |
| D8 | State, data, routing | Zustand, TanStack Query and TanStack Router, as listed. **No spike exercised them**; S3 found nothing against them | Not pinned. Pin at P1a start | [S3](research/spike-s3-bridge.md) | 23 Nov 2026 | Pending owner review |
| D9 | Tests and design review | Vitest, Playwright and Storybook. Storybook builds with the Tailwind 4 tokens by importing `app.css`. Only vitest and one Electron smoke test are in the CI workflow; the 35-test Playwright suite is not (Linux-only `pgrep`, timing budgets) | vitest 5.1.1, @playwright/test 1.65.1, storybook 10.6.8, @storybook/react-vite 10.6.8 | [S2](research/spike-s2-build.md) | 23 Nov 2026 | Pending owner review |
| D10 | Workspace and tooling | pnpm, Biome, TypeScript 7. ESLint is dropped: typescript-eslint 8.73.0 refuses TypeScript 7.0 (issue typescript-eslint#10940). Biome checked all TS and TSX files; its config is not tuned yet | pnpm 12.4.1, @biomejs/biome 2.6.8, typescript 7.0.2, Node 24.22.1 | [S2](research/spike-s2-build.md) | 23 Nov 2026 | Pending owner review |
| D11 | Electron version policy | Provisional policy stands (latest stable at P1a start, upgrade each major). No spike tested a policy; the spikes only ran on one version | electron 45.4.1 (version the spikes ran on) | [S2](research/spike-s2-build.md) | 23 Nov 2026 | Pending owner review |
| D12 | Forms and validation | **Strict validation.** React Hook Form with Ajv, `coerceTypes` off, so a string `"30"` for an integer `ttl` is rejected, in forms and in the YAML editor. Validators stay precompiled with Ajv standalone, because the renderer CSP blocks runtime compile. Generic rendering from the JSON schema plus a per-field override map (Optional sections, enum-like strings). Consequences: the spike validator was generated with `coerceTypes: true`, so it is regenerated; integer form fields convert to numbers on change themselves. Not checked: whether the kernel's own loader coerces | react-hook-form 7.92.0, ajv 8.20.0 (`ajv/dist/2020` and standalone), yaml 2.9.1 | [S1](research/spike-s1-components.md), [S4](research/spike-s4-canvas-code.md) | 23 Nov 2026 | Dhananjaya Rajasinghe |
| D13 | Architecture checks | dependency-cruiser with the swc parser, plus a self-test as a CI step. **Hazard:** under TypeScript 7, if `@swc/core` is absent, dependency-cruiser passes silently ("1 modules, 0 dependencies") and CI stays green. `pnpm depcruise:selftest` runs the rules on a fixture and fails if the violation is not caught. Revisit at TypeScript 7.1 | dependency-cruiser 18.9.0, @swc/core 1.16.22 | [S2](research/spike-s2-build.md) | 23 Nov 2026 | Pending owner review |

**Where a spike changed a provisional choice.** D5 was "own contract; adopt oRPC if it streams". oRPC
streamed, so the rule did not trigger; the owner chose the in-house contract on the sender-check and
shared-code grounds. D12 was "React Hook Form with a JSON-schema validator"; the spike added precompiling
(CSP) and the owner chose strict. D13 was "dependency-cruiser plus small scripts"; it needs the swc parser
and a self-test. D10 stays Biome, with ESLint ruled out. D1's primitive base was open and is now React Aria.
D1a (solid layers) replaces the P1a design gate's open choice between solid and glass. The remaining rows
match the provisional choice.

**Notes on the claims in the record.**

- "Components read as the same family as Spectrum 2" is a pass **by measurement only** (sizes, radii,
  borders, focus ring, pressed push-in match). The side-by-side visual check needs a person.
- Token claims cover the variants actually used. Unused variants of generated components (combobox chips,
  sub-menus, kbd) still carry shadcn defaults (`text-sm`, `shadow-lg`, `rounded-sm`). Tailwind's default
  colours were removed; its default font sizes and shadows were not.
- Canvas keyboard model is **open**. Tab reaches the first node only after all the edges (the 300th press
  with 299 edges). `edgesFocusable={false}` fixes that but loses edge keyboard access. Left to the P3 design
  gate.

## Checklist

- [x] Desk research
- [ ] Execution plan followed: [P0-plan.md](P0-plan.md) ([research/tech-stack-evaluation.md](research/tech-stack-evaluation.md)). Linux only; Windows and macOS not run
- [ ] Constraints C1 to C8 confirmed. Met on Linux or in part; see the table below
- [ ] S1 Components and theming. Ran on Linux; visual side-by-side and screen-reader pass not done
- [ ] S2 Build, run and package. Ran on Linux; Windows and macOS and CI not run
- [ ] S3 The bridge. Ran on Linux; cancel on Windows and macOS not run
- [ ] S4 Canvas and code. Ran on Linux, software-rendered; cold-open target missed; real-GPU check not done
- [ ] Decision record complete and approved. Drafted; D1a, D5 and D12 approved 23 Nov 2026; the rest pending owner review
- [ ] Spike code deleted or archived outside `ak-studio/`. Left on branch `spike/950-studio-p0` until P1a starts

## Exit criteria

- Every row of the decision record is filled, with a pinned version. **Met in draft**, except D8, which no
  spike exercised and has no pinned version, and D11, which pins only the version the spikes ran on.
- Each choice has a spike note in `research/`. **Met.**
- Any constraint that could not be met is written down with its consequence. **Below.**
- Owner approval of the record. **Open** for every row except D1a, D5 and D12.

### Constraints, as shown by the spikes

| # | Result | Consequence |
|---|---|---|
| C1 | Met by measurement for the components built; the look-alike check by eye is not done. Glass is dropped (D1a). Unused generated variants keep shadcn defaults | A person compares the pairs at the P1a design gate; unused variants are restyled when first used |
| C2 | Met on Linux: tree, virtualised sortable table (5,000 rows), drag and drop, combobox, menus, context menu, command palette, panels, tabs, toasts | Own `tree.tsx` and `table.tsx`; two extra libraries (splitter, toasts) |
| C3 | Keyboard: met for every component built. Screen-reader pass: **not done, needs a person** (accessibility-tree snapshots only). Canvas keyboard model open | Screen-reader pass at the P1a design gate; canvas keyboard at the P3 design gate |
| C4 | Met: the same renderer code ran in a browser over WebSocket and in Electron over IPC | None |
| C5 | Linux only. **Windows and macOS: Not run — pending CI on three systems** | Run the CI workflow on three systems before P1a relies on it |
| C6 | Linux: met. **Windows and macOS: Not run — pending CI on three systems** | As C5 |
| C7 | Linux: met on both transports (10,000-line burst, worst frame 17 ms; cancel leaves 0 child processes). **Windows and macOS cancel: Not run — pending CI on three systems.** `taskkill /T /F` and `process.kill(-pid)` on macOS are untested | The vitest cancel test runs in CI on all three; the Playwright bridge specs are Linux-only until the `pgrep` counter is made portable |
| C8 | Risks noted: React Flow 13.0.2 is seven days old; one dependency-cruiser release is on the pnpm minimum-release-age exception list; TypeScript 7 blocks ESLint; `cn` config must track the tokens | Pin exactly; review the exception; revisit at TypeScript 7.1 |

### Not run, pending CI on three systems

- Windows and macOS: the one-command build and run, the cancel test, the NSIS and dmg installers, and the
  three-system CI workflow (`.github/workflows/studio-spike.yml`, written, parsed, never executed).
- Not verified on a runner: the Linux `sysctl kernel.apparmor_restrict_unprivileged_userns=0` step.

### Not done, needs a person

- A side-by-side visual check that the components read as the same family as Spectrum 2 (the pass is by
  measurement only).
- A screen-reader pass (NVDA, VoiceOver or Orca).
- Canvas smoothness, and glass against solid on canvas nodes, on a real GPU display. The software-rendered
  runs cannot show `backdrop-filter` cost.
- CodeMirror preload on idle (or on hover) to meet the 200 ms cold-open target. Measured cold open was 360 to
  382 ms; the remedy was not tried.
- Installing from an installer; watching the 10,000-line burst on a real display; closing a window
  mid-stream while the app stays alive (Windows and macOS).

## Risks

| Risk | Default |
|---|---|
| Many candidate versions are weeks or months old | Pin exact versions; prefer the previous major where the new one fails a spike |
| A spike overruns | Time-box; an overrun is itself a result and counts against the candidate |
| TypeScript 7 is not supported by a tool in the chain | Fall back to TypeScript 6; revisit later |
