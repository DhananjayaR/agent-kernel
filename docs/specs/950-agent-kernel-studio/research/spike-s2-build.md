# Spike S2: Build, tooling and packaging (electron-vite, Storybook, Biome, dependency-cruiser, electron-builder, three-OS CI)

**Date:** 2026-11-23  **Ran on:** Linux (WSL2) only  **Time spent:** under 1 day (S2 part 1 and part 2)

> **The spike code was deleted on 25 November 2026** at the owner's request; it was never pushed. This note and the
> measurement files beside it are the record. File paths below name the spike code as it was.

## Result

Pass with changes on Linux; Windows and macOS not run, so the "one command on all three systems, CI green on
all three" criteria are open — electron-vite builds, runs and packages cleanly on Linux, but dependency-cruiser needed a
separate parser because of TypeScript 7, and the template's ESLint cannot run on TypeScript 7 at all.

## Pass criteria

| Criterion | Result | Evidence |
|---|---|---|
| One command builds and runs on Linux | Pass | `pnpm build` (typecheck + `electron-vite build`) then `pnpm exec playwright test tests/smoke.electron.spec.ts` under `xvfb-run -a`: 1 passed (about 0.7 s). Cold `electron-vite build` about 1.0 s, renderer HMR about 58 ms, main restart about 131 ms (only with `electron-vite dev --watch`): Task 1, scripted. |
| One command builds and runs on Windows | Deferred by the owner (23 Nov 2026); Linux only for now | No Windows machine; CI would be the only route. |
| One command builds and runs on macOS | Deferred by the owner (23 Nov 2026); Linux only for now | Same. |
| CI green on all three | Not run — workflow written, not executed | `.github/workflows/studio-spike.yml` parses as YAML (`yaml.safe_load`, 11 steps); `actionlint` is not installed. Never run on a runner. |
| Installer produced | Pass on Linux only | AppImage 144 MB and deb 112 MB under `release/`; NSIS and dmg not built. |
| Packaged app starts | Pass on Linux (scripted); install via the installer: not done — needs a person | Playwright `_electron` with `executablePath` on `release/linux-unpacked/app` and on the AppImage (`APPIMAGE_EXTRACT_AND_RUN=1`), under `xvfb-run -a`: `app.isPackaged` true, Bridge then Echo gives `{"text":"hi"}`. The deb was inspected (`dpkg-deb -I`) but not installed. |
| Storybook builds and shows the tokens | Pass | `pnpm build-storybook` 2.4 s, 7.1 MB. Dev server probed with Playwright: Default Button computed `background-color` rgb(255, 94, 50) (`--color-primary` #FF5E32), text rgb(1, 20, 40) (#011428), radius 9999px, font Archivo Variable. The dev server was stopped. |
| Biome runs on TypeScript 7 sources and `.tsx` | Pass | `biome check src`: checked 46 files in 39 ms; 196 errors, 61 warnings, 131 infos (style findings on spike code, none fixed; no parse errors). |
| Boundary check catches a violation (D13) | Pass | Clean: `no dependency violations found (83 modules, 174 dependencies cruised)`, exit 0. With `import 'node:fs'` added to `App.tsx`: `error renderer-no-electron: src/renderer/src/App.tsx → fs`, `1 dependency violations`, exit 1. Import removed. |
| `pnpm lint` (template ESLint) works on TypeScript 7 | **Fail** | `typescript-eslint does not support TS 7.0.` thrown at load from `@electron-toolkit/eslint-config-ts` (typescript-eslint 8.73.0), exit 2. Tracking issue typescript-eslint#10940 (support for TS 7.1 and later). |

## What differed from the plan

- **Storybook init under pnpm 12.** `pnpm dlx storybook@10.6.8 init` failed with `ERR_PNPM_IGNORED_BUILDS` (esbuild
  postinstall). Worked with `pnpm dlx --allow-build=esbuild storybook@10.6.8 init --yes --no-dev --no-features --type react --builder vite --package-manager pnpm --disable-telemetry`. Without `--no-dev` init starts a server.
  It chose `@storybook/react-vite` (plus `storybook` and `eslint-plugin-storybook`) with no addons; it wrote
  `^10.6.8` ranges, pinned to `10.6.8` by hand. It also edited `eslint.config.mjs` and `.gitignore`, and generated
  sample stories (`src/stories`, deleted). Tailwind 4 and the tokens needed no Storybook config: it picks up the root
  `vite.config.ts` (with `@tailwindcss/vite`), so the only addition is `import '../src/renderer/src/styles/app.css'`
  in `.storybook/preview.tsx` (plus a `bg-canvas` decorator). The story is `components/ui/button.stories.tsx`
  (variants, disabled, sizes). The 1.1 MB chunk warning is the unminified-docs bundle, not tuned.
- **Biome** `init` defaults (tabs, double quotes) differ from the code's style, hence the many findings; it also
  notes `tailwindDirectives` for CSS parsing. Not configured further. No problems with TypeScript 7 syntax.
- **dependency-cruiser 18.9.0 does not work with TypeScript 7.0.** Run as in the brief it printed
  `missing-typescript-transpiler` ("typescript@7.0 is not supported as its API lacks what dependency-cruiser needs"),
  and **reported no violations even with `import 'node:fs'` added** (exit 0, silently missed TypeScript). Fix: add
  `@swc/core@1.16.22` (pinned) and `parser: 'swc'` in `.dependency-cruiser.cjs`; `pnpm-workspace.yaml` gets
  `'@swc/core': false` under `allowBuilds` (pnpm 12 blocks its postinstall; the binary comes from optional dependencies and worked). The brief's `tsConfig` file name `tsconfig.web.json` is right. Node core `node:fs` resolves as `fs`; the rule matched.
- **Smoke test:** `getByRole('button', { name: 'Echo' })` matches two buttons ("Echo" and "oRPC echo") and fails strict
  mode; changed to `{ name: 'Echo', exact: true }`. Everything else as written. Note it launches `args: ['.']`, i.e. the built
  `out/` with the Electron from `node_modules`, not the packaged app (the title was renamed to "the built main process ..." for that reason). No Playwright
  Electron workaround was needed; it ran without `--no-sandbox`.
- **electron-builder:** the template already shipped `electron-builder.yml`, `build/` icons, `resources/`, `build:*` scripts and
  electron-builder 26.15.3; the file was replaced with the brief's values and the version pinned to 26.18.0. The deb
  target failed ("Please specify author 'email' in the application package.json"); added
  `maintainer: 'AK Studio spike <spike@example.invalid>'` to `linux`. The deb is named `app_1.0.0_amd64.deb` (from `package.json` `name`).
  `pnpm exec electron-builder --publish never` takes about 80 s on first run (downloads appimage, fpm, 7zip tools). Builds
  print hints (no `desktopName`, no `category`) — not acted on. Unsigned; signing is P12.
- **CI workflow:** the brief's file with these changes: top-level `permissions: { contents: read }`; the brief's
  `pnpm exec playwright install chromium` step removed (the Electron smoke test drives the Electron binary and needs no Chromium
  download); a `pnpm depcruise:selftest` step right after the real depcruise step; and one Linux-only step (`sysctl kernel.apparmor_restrict_unprivileged_userns=0`),
  because Ubuntu 24.04 runners restrict user namespaces and Electron's sandbox needs them when `chrome-sandbox` is not setuid.
  This is a known issue, **not verified on a runner**. The trigger is exactly the brief's. The jobs run dependency-cruiser,
  `vitest run`, `pnpm build`, the single Electron smoke test and electron-builder on all three systems. The Playwright suite (35 tests)
  is **not** in CI: browser specs need `pnpm dev:web`, the bridge specs need `pnpm dev:ws` / `dev:orpc-ws` and use `pgrep -fc`
  (Linux only), and some canvas timing assertions depend on machine speed. The `tests/handlers.test.ts` cancel test,
  the key Windows result, runs through `vitest run`.
- **`pnpm-workspace.yaml` `minimumReleaseAgeExclude`:** pnpm 12 refuses packages published within its minimum release age;
  `pnpm add -D -E dependency-cruiser@18.9.0` was too new and the entry `dependency-cruiser@18.9.0` was added so it can be installed
  (alongside the existing `@orpc/*` entries from the S3 bridge spike). It must stay while that version is that recent, and is a supply-chain policy exception to review.
- **depcruise self-test:** see D13 below; `tests/depcruise-fixture/` and `scripts/depcruise-selftest.mjs`. Note dependency-cruiser auto-detects
  swc when `@swc/core` is installed even if `parser: 'swc'` is removed; the silent pass happens when `@swc/core` is absent.
- **Nothing was pushed**, so the three jobs have not run; no Windows or macOS results exist (deferred by the owner, 23 Nov 2026).

## Versions that worked

Scaffold (Task 1) `@quick-start/electron@1.0.31` (react-ts), electron 45.4.1, electron-vite 6.0.0, vite 8.3.8, TypeScript 7.0.2,
Node 24, pnpm 12.4.1, vitest 5.1.1, @playwright/test 1.65.1, storybook and @storybook/react-vite 10.6.8,
@biomejs/biome 2.6.8, dependency-cruiser 18.9.0 with @swc/core 1.16.22, electron-builder 26.18.0 (app-builder-lib 26.18.0).
Needed beyond the scaffold (Task 1): `preload.build.externalizeDeps.exclude` so the sandboxed CommonJS preload bundles its
dependency (it failed silently otherwise); no `baseUrl` (TS 7 rejects it, TS5102/TS5090); `allowBuilds` in
`pnpm-workspace.yaml`; a root `vite.config.ts` shared by `dev:web`, electron-vite and the shadcn CLI. electron-vite leaves the
renderer unminified by default (Task 4: Code chunk 1,185 kB vs 599 kB minified). The template CSP stayed intact (S1 spike: precompiled validators and fonts emitted as files instead of loosening it).

## Recommendation for the decision record

- **D3 (bundler):** electron-vite confirmed on Linux, no blocker (sandboxed preload, TypeScript 7, packaging all worked); Electron Forge fallback not needed. Windows and macOS were deferred by the owner (23 Nov 2026); the CI workflow is written but has never run.
- **D4 (packaging):** electron-builder 26.18.0 confirmed on Linux (AppImage and deb, packaged app starts and the bridge answers); NSIS and dmg unverified; signing deferred to P12; set `maintainer`/`author` email and `desktopName`.
- **D9 (tests and design review):** Storybook 10.6.8 with `@storybook/react-vite` works with Tailwind 4 tokens at no extra cost beyond importing `app.css`; adopt.
- **D10 (lint and format):** choose Biome 2.6.8 over ESLint now: typescript-eslint cannot load under TypeScript 7.0 (the template `pnpm lint` fails), Biome checked all TS and TSX files; tune its config (tabs and quotes, Tailwind CSS directives, a11y rules) in P1a and keep Prettier or Biome format as one formatter.
- **D9 (test runners):** vitest for unit tests (runs on every OS in CI), Playwright for browser and Electron specs; one Electron smoke test belongs in the three-OS job; the Linux-only and timing-sensitive specs need guards (`pgrep`, timing budgets) before moving to CI.
- **D11 (Electron version policy):** the spike only ran on Electron 45.4.1.
- **D13 (boundaries):** **Under TypeScript 7, without the swc parser (`@swc/core` plus `parser: 'swc'`) the check passes silently — it finds no violations at all (0 modules cruised), and CI stays green.** The boundary check must always ship with a self-test: `pnpm depcruise:selftest` runs the same rules on `tests/depcruise-fixture/` (a renderer file importing `node:fs`) and passes only if depcruise exits non-zero with `renderer-no-electron`; it is a CI step after the real check. With the fixture and `@swc/core` present it passes; with `@swc/core` removed it fails (verified). dependency-cruiser 18.9.0 then enforces renderer-no-electron and renderer-no-main; revisit when TypeScript is 7.1 or later.
