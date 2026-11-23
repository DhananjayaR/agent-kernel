# Technology stack: desk research

**Date:** 23 November 2026. **Kind:** desk research only. Nothing here was built or run. Versions come from the
npm registry on that date unless a link is given. Items marked _unverified_ could not be confirmed from a
primary source. [P0](../P0-technology-selection.md) turns this into decisions by running spikes.

**Decided after this research (23 November 2026):** Vite as the bundler and shadcn/ui with Tailwind as the
component library. The comparisons below are kept as the record of why.

## What the stack must do

| # | Constraint | Why |
|---|---|---|
| C1 | Theme fully to the Agent Kernel look: its tokens, pill buttons and tags, glass floating layers, dark and light | The Studio must look like Agent Kernel, not like a vendor's design system |
| C2 | Dense desktop UI: tree, virtualised table, combobox, menus, context menu, command palette, resizable panels, tabs, toasts, drag and drop | The builder needs all of them |
| C3 | Accessible by default: keyboard, focus, screen reader | Part of "best UX"; costly to retrofit |
| C4 | The renderer runs in a plain browser | The issue's later hosted Studio; also makes testing and design review easier |
| C5 | Builds and runs on Windows, macOS and Linux from one codebase | Issue requirement |
| C6 | A developer can build and run it locally with one command | Stated requirement |
| C7 | Streams well: agent events, logs and traces, with cancel | Most of the app's data is streams |
| C8 | Low maintenance risk: active projects, no stale glue | A long-lived product |

## 1. Component library

| Option | State | C1 theming | C2 coverage | Verdict |
|---|---|---|---|---|
| React Spectrum v3 (`@adobe/react-spectrum` 3.47.7) | Maintained; the older Spectrum look | Poor: it is Adobe's look | Good | No |
| Spectrum 2 (`@react-spectrum/s2` 1.8.2; 1.0.0 on 16 Dec 2025) | Stable, monthly releases | Poor: the tokens are Spectrum's. Its docs point custom design systems to React Aria Components instead | Good | No |
| React Aria Components (1.22.1), also by Adobe | Stable, monthly releases, Apache-2.0 | Excellent: unstyled; Tailwind v4 plugin `tailwindcss-react-aria-components` | Tree, Table, Virtualizer, drag and drop, context menu | Strong |
| shadcn/ui (CLI `shadcn` 4.23.0) | Offers three primitive bases: Base UI (default since July 2026), Radix, and React Aria (`init --base aria`, since July 2026) | Excellent: the code is copied into the repository and owned; CSS-variable tokens; Tailwind v4 | Broad. Exact coverage of the React Aria base _unverified_ | **Recommended** |
| Base UI (`@base-ui/react` 1.9.0) | Stable, MIT | Excellent | Tree, table, drag and drop _unverified_ | Fallback base |
| Radix (`radix-ui` 1.8.1) | Still releasing | Excellent | No tree, table or drag and drop | Not for new work |

- **React Spectrum versus shadcn is no longer an either-or.** Spectrum itself (v3 or 2) cannot take another
  design system's look. Its unstyled layer, React Aria Components, can, and shadcn now supports React Aria as
  a base. So the recommendation uses both: Adobe's accessibility and behaviour, shadcn's owned, themeable
  code.
- Spectrum 2's style macro needs Parcel or `unplugin-parcel-macros`; Rspack support is undocumented.
- Both React Aria and shadcn publish material for coding agents (MCP servers, skills, `llms.txt`).
- Mantine, HeroUI and Ark UI are active; none clearly beats the recommendation for a custom design system.

**Recommendation.** shadcn/ui on Tailwind v4 with the React Aria base. Fallback: shadcn on Base UI, plus
TanStack Table, TanStack Virtual and a tree component. Fill gaps with `cmdk` (command palette),
`react-resizable-panels` and `sonner` (toasts).

**Risk.** The React Aria base is four months old in shadcn, and third-party shadcn registries mostly target
Radix or Base UI.

## 2. Tailwind CSS

- Version 4.3.5. CSS-first configuration: `@import "tailwindcss"`, tokens declared in `@theme` become CSS
  variables.
- Works with Vite (`@tailwindcss/vite`) and with Rsbuild (`@rsbuild/plugin-tailwindcss` 2.0.3, official, or
  `@tailwindcss/postcss`).

**Recommendation.** Tailwind 4, with the Agent Kernel tokens in `@theme`, mapped to the component library's
variables. It does not constrain the bundler choice.

## 3. Bundler and the Electron development loop

| Path | Version | Electron support | Risk |
|---|---|---|---|
| electron-vite | 6.0.0 (Oct 2026), on Vite 6 to 8 | Purpose-built: one config for main, preload and renderer; hot reload for all three | One maintainer, active |
| Electron Forge + Vite plugin | 8.0.1 (Sep 2026) | Official; the Vite plugin is now stable | A two-month-old major |
| Rspack / Rsbuild | 2.3.3 | Rspack has `electron-main`, `electron-preload` and `electron-renderer` targets. Rsbuild does not support them directly (set through `tools.rspack`). No official Electron guide or template | High for the Electron glue |
| Community Rspack plugins for Electron | `electron-forge-plugin-rsbuild` 1.0.2 (2024), `electron-rsbuild` 0.0.12 (2025) | All predate Rsbuild 2 and Forge 8 | Do not depend on them |

- Rspack and Rsbuild are mature **as bundlers**. What is missing is the Electron development loop around
  them: starting Electron, restarting it when the main process changes, emitting a sandboxed preload.
- Vite 8 is itself Rust-based now (Rolldown). Whether that closes the build-speed gap to Rspack was not
  measured; P0's spike S2 measures it.

**Recommendation.** electron-vite on Vite 8. If Rspack is wanted, the workable shape is Rsbuild for the
renderer only (a plain web build), a small Rspack config for main and preload, and a hand-written development
script. That means owning the glue. P0 measures both before deciding.

## 4. Packaging

| | Electron Forge 8 | electron-builder 26.18 |
|---|---|---|
| Windows | Squirrel, MSI, MSIX | NSIS, portable, MSI, MSIX |
| macOS | DMG, PKG, ZIP | DMG, PKG |
| Linux | deb, rpm, Flatpak, Snap. No AppImage | AppImage, deb, rpm, pacman, Flatpak, Snap |
| Auto-update | `update-electron-app` | `electron-updater`: differential, staged |
| Works with any bundler | Yes, without its bundler plugins | Yes |

Electron stable is 45 (Chromium 156, Node 24).

**Recommendation.** electron-builder with `electron-updater`. It has NSIS and AppImage and is independent of
the bundler.

## 5. Canvas

- React Flow (`@xyflow/react`), MIT. Version 13.0.2; 13.0.0 shipped on 16 November 2026 with breaking changes.
  The conservative pin is 12.12.0.
- Layout: `@dagrejs/dagre` (MIT) or `elkjs` (EPL-2.0 or GPL-3.0, so it needs a licence check).
- Alternatives were not researched.

**Recommendation.** React Flow with dagre. Move to elkjs only if ports or nested layouts need it.

## 6. Code viewer and editor

| | Monaco 0.57 | CodeMirror 6 |
|---|---|---|
| Diff | Built in | `@codemirror/merge` |
| YAML with schema | `monaco-yaml` | `@codemirror/lang-yaml` plus an own linter |
| Size | Megabytes, plus workers | Small and modular |
| Theming | Its own theme system | CSS variables; fits the tokens |
| Bundling | Needs worker setup | Nothing special |

**Recommendation.** CodeMirror 6 for a mostly-read, light-edit Code tab, with Shiki for read-only code in
chat. Choose Monaco only if IDE-grade completion becomes a requirement.

## 7. The typed bridge

| Option | State | Transport can change (C4) |
|---|---|---|
| Own contract: zod schemas plus a `Transport` interface with `request` and `subscribe` | About 200 lines | Yes, fully |
| oRPC (`@orpc/server` 1.16.5) | Active; official Electron adapter; contract-first | Yes by design; streaming over its Electron transport _unverified_ |
| tRPC 11 + `electron-trpc` 1.0.0 | Adapter revived Oct 2026 after 22 months | Yes; single-maintainer adapter |
| `@electron-toolkit/typed-ipc` | Types over raw IPC only | No |

**Recommendation.** A small in-house contract package. Streams with cancel across two transports are the
hardest requirement and the least proven in the libraries. Evaluate oRPC in the spike and adopt it if
streaming and cancel work.

**Security baseline (Electron documentation).** Context isolation on, sandbox on, Node integration off, a
restrictive content security policy, sender validation on every message, no raw `ipcRenderer` exposed, the app
served from a custom protocol instead of `file://`, and Electron fuses set.

## 8. Everything else

| Area | Recommendation | Note |
|---|---|---|
| UI framework | React 19.3 | |
| State | Zustand 5 for UI and canvas state; TanStack Query 5 over the bridge | From general practice |
| Routing | TanStack Router with hash or memory history | Works under a custom protocol and in a browser |
| Logs | A virtualised list; xterm.js 6 where ANSI fidelity matters. No `node-pty` | `node-pty` is a native module; only needed for an interactive shell |
| Unit and component tests | Vitest 5 | Rstest is not mature (0.12; 1.0 beta) |
| End-to-end tests | Playwright against the browser-mode renderer, plus a thin Electron smoke suite | Playwright's Electron support is still labelled experimental |
| Design review | Storybook 10 | A builder exists for both Vite and Rsbuild |
| Workspace | pnpm workspaces | |
| Lint and format | Biome 2 | |
| Language | TypeScript 7.0 | The new native compiler; confirm every tool in the chain runs on it, otherwise TypeScript 6 |

## Biggest risks

1. **Rspack for Electron is do-it-yourself.** No official path; community plugins are stale.
2. **Very new major versions:** React Flow 13 (one week), Forge 8 (two months), electron-vite 6 (six weeks),
   TypeScript 7 (four months), shadcn's React Aria base (four months). Pin exact versions.
3. **Streaming over the bridge** with cancel, on two transports.
4. **Component coverage of the chosen shadcn base.** Mixing primitive libraries would erode consistency.
5. **Signing and auto-update on three operating systems.** Long lead time (P12).

## Could not verify

- Spectrum 2's macro on Rspack.
- The component list of shadcn's React Aria base.
- oRPC streaming over its Electron transport.
- Monaco's tooling on Rspack.
- Alternatives to React Flow.
- `react-spectrum.adobe.com` could not be fetched directly; Spectrum 2 facts come from a docs mirror and npm.

## Sources

- shadcn: <https://ui.shadcn.com/docs/changelog>, <https://ui.shadcn.com/docs/changelog/2026-07-react-aria>,
  <https://ui.shadcn.com/docs/changelog/2026-07-base-ui-default>
- React Aria: <https://react-aria.adobe.com/styling>, <https://react-aria.adobe.com/getting-started>
- Spectrum 2: <https://react-spectrum.adobe.com/releases/v1-3-0>,
  <https://unpkg.com/unplugin-parcel-macros@0.2.0/README.md>
- Rspack and Rsbuild: <https://rspack.rs/blog/announcing-2-0>, <https://rsbuild.rs/blog/v2-0>,
  <https://rsbuild.rs/config/output/target>, <https://rspack.rs/plugins/webpack/electron-target-plugin>
- Vite, electron-vite, Forge: <https://vite.dev/blog/announcing-vite8>,
  <https://github.com/alex8088/electron-vite/releases/tag/v6.0.0>,
  <https://github.com/electron/forge/releases/tag/v8.0.1>
- Electron: <https://releases.electronjs.org/release>, <https://www.electronjs.org/docs/latest/tutorial/security>
- electron-builder: <https://www.electron.build/>
- React Flow: <https://reactflow.dev/whats-new>
- oRPC: <https://orpc.dev/docs/adapters/electron>
- TypeScript 7: <https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/>
- Playwright: <https://playwright.dev/docs/api/class-electron>
- Storybook on Rsbuild: <https://storybook.rsbuild.rs/guide/>
