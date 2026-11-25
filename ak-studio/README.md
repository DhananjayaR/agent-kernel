# Agent Kernel Studio

Electron desktop app for Agent Kernel (issue #950). pnpm workspace; Node 24.22.1, pnpm 12.4.1.

```bash
cd ak-studio
pnpm install --frozen-lockfile   # also fetches the Electron binary (apps/desktop postinstall)
pnpm lint        # Biome check, then check-palette
pnpm typecheck   # tsc -b over all members
pnpm test        # every member's unit tests (Vitest), then check-palette's own test
pnpm check-palette        # no default-palette class, arbitrary value or colour literal in apps/renderer, packages/ui
pnpm storybook            # Storybook dev server for packages/ui on 127.0.0.1:6006
pnpm build-storybook      # static Storybook into packages/ui/storybook-static/
pnpm test:storybook       # every story, dark and light, in headless Chromium with axe (fails on a violation)
pnpm depcruise   # boundary rules (dependency-cruiser, swc parser)
pnpm depcruise:selftest  # proves the rules can fail and the parser finds modules
pnpm build       # check-palette, then electron-vite: main, preload and renderer into apps/desktop/out/
pnpm dev         # Electron against the electron-vite dev server
pnpm --filter @ak-studio/desktop start   # run the last build (on headless Linux: xvfb-run -a ...)
pnpm test:e2e    # build, then Playwright: the renderer in Chromium (mock) and the built app in Electron
pnpm package     # build, then electron-builder for this system into apps/desktop/release/ (unsigned)
```

Members: `apps/desktop`, `apps/renderer`, `packages/contract`, `packages/ui`, `packages/kernel-catalog`.

`test:storybook` and `test:e2e` need Playwright's Chromium (`pnpm exec playwright install chromium` once; on a
fresh Linux machine `pnpm exec playwright install --with-deps chromium`).

**Desktop app.** `apps/desktop` holds the Electron main process and preload, and the electron-vite config,
which also builds `apps/renderer` (so the renderer holds no Node-run file). The window loads `app://studio/`,
a custom protocol serving `apps/desktop/out/renderer/` with the content security policy as a response header.
Context isolation and the sandbox are on, Node integration is off, navigation, new windows and permissions are
refused, and every request whose scheme is not `app:` or `devtools:` (or, unpackaged, the dev server) is
cancelled. The preload exposes one global, `window.studio` (`request`, `subscribe`). Window size, position and
maximised state are kept in `window-state.json` in the app's data folder. Unpackaged builds started with
`AK_STUDIO_TEST_HOOKS=1` expose `globalThis.__akStudioTestHooks` in the main process
(`cancelledRequestCount()`, `cancelledRequestUrls()`, the newest 100) for the Electron smoke test. The count
covers Chromium's network stack only, not Node networking in the main process. Unpackaged builds run as
"Agent Kernel Studio (dev)" with their own data folder and single-instance lock, and accept
`ELECTRON_RENDERER_URL` only on `localhost`, `127.0.0.1` or `[::1]` (otherwise they refuse to start).

Boundary rules live in `.dependency-cruiser.cjs`: the renderer and `packages/ui` import no `electron` or Node
built-in; `packages/contract` imports only `zod`; `packages/ui` imports neither `apps/*` nor
`@ak-studio/contract`; nothing imports `apps/desktop` but itself. dependency-cruiser needs `@swc/core` under
TypeScript 7 (without it a run is silently green: "0 modules"), so `depcruise:selftest` checks a deliberately
violating fixture in `tools/depcruise-selftest/fixture/` (ignored by Biome and the tsconfigs) and fails if
fewer than 2 modules are cruised or any rule goes unreported.

**Design system (mechanism only until the P1a design gate signs off).** `packages/ui/src/theme.css` is the
Tailwind 4 entry: the default palette is removed (`--color-*: initial`), the role colours (`surface`,
`surface-raised`, `surface-overlay`, `text`, `text-muted`, `border-default`, `accent-primary`, `accent-ai`,
`status-success`, `status-warning`, `status-danger`) are set per `data-theme` from stand-in values out of
`docs/src/css/custom.css`, each marked `provisional: P1a design gate`, and the size, radius, spacing and type
tokens are Spectrum 2 medium. `fonts.css` bundles Archivo, Inter and JetBrains Mono through `@fontsource`
(served from the app, never fetched); which family is used where waits for the gate. The renderer imports the
tokens from `apps/renderer/src/styles.css`; Storybook from `packages/ui/.storybook/preview.css`. The token story
(`src/tokens.stories.tsx`) shows each role colour on each surface in both themes with its computed contrast
ratio. `packages/ui/components.json` configures the shadcn CLI (React Aria base, style `aria-nova`); run
`pnpm --filter @ak-studio/ui exec shadcn add <name>` (the pinned CLI) once the gate approves a component, and
pin whatever it adds.

**check-palette: known limits.** It reads source as text, so it cannot see class names built at run time
(template strings such as `` `bg-${tone}-500` ``, or concatenation such as `"bg-" + tone`), and it does not flag
Tailwind's CSS-variable shorthand (`bg-(--x)`, `w-(--trigger-width)`). Colour literals (hex, `rgb()`, `hsl()`,
`oklch()`, `color()` ...) are allowed only in `packages/ui/src/theme.css` and in unit tests (`*.test.*`); hex
counts only in a value position, and comment lines are not checked for literals. Tailwind's default palette,
shadow, inset/drop/text shadow, radius, text-size and font-family scales are removed in `theme.css`, so such a
class compiles to nothing even where the check cannot see it. Its scope is `apps/renderer` and `packages/ui`.

**End-to-end tests** (`playwright.config.ts`, `tests/e2e/`). `pnpm test:e2e` builds, then runs two Playwright
projects through `tools/e2e.mjs`, which wraps the run in `xvfb-run -a` on Linux when there is no `DISPLAY`
(extra arguments go to `playwright test`, e.g. `pnpm test:e2e --project browser`). `browser` serves the
renderer with its Vite dev server on `127.0.0.1:5199` and checks it on the mock transport: version, platform,
theme switch. `electron` launches the built, unpackaged app (`apps/desktop/out/`) with `AK_STUDIO_TEST_HOOKS=1`
and a fresh `--user-data-dir` per test, and checks the version and platform from the real main process, that the
theme switch reaches `nativeTheme`, that the request gate cancelled nothing (Chromium's network stack only: Node
networking in main is not covered), and that the gate does count a refused request.

**Packaging** (`apps/desktop/electron-builder.yml`, electron-builder 26.18.0). `pnpm package` builds, then
packages for the current system into `apps/desktop/release/`: an AppImage and `linux-unpacked/` on Linux, an NSIS
installer on Windows, a dmg on macOS (Windows and macOS are configured, not yet built). Nothing is signed. The
asar holds `out/` and `package.json` only (the contract and zod are bundled into main, so no `node_modules`).
`appId` (`ai.yaala.kernel.studio`) and the product name are working names until P12. Electron fuses are flipped at
package time: `RunAsNode`, `EnableNodeOptionsEnvironmentVariable`, `EnableNodeCliInspectArguments` and
`GrantFileProtocolExtraPrivileges` off; `EnableCookieEncryption`, `OnlyLoadAppFromAsar` and
`EnableEmbeddedAsarIntegrityValidation` (macOS and Windows only; no effect on Linux) on. So
`ELECTRON_RUN_AS_NODE`, `NODE_OPTIONS` and `--inspect` do nothing to a packaged app, and Playwright cannot drive
one (it needs `--inspect`): the Electron e2e tests run against the unpackaged build. The AppImage needs FUSE 2
(`libfuse2`); without it, run it with `--appimage-extract-and-run`.

**CI** (`.github/workflows/studio.yml`). On pull requests and pushes to `develop` that touch `ak-studio/**`, on
Ubuntu, Windows and macOS: install, Playwright's Chromium, lint, typecheck, depcruise and its self-test, unit
tests, Storybook build and accessibility run, e2e, package, and the installer uploaded as a workflow artifact.
The Python `Test` and `Code Quality` workflows ignore changes under `ak-studio/**`.

**Linux results (P1a, 25 November 2026).** Measured on Linux (WSL2, x64), Node 24.22.1, pnpm 12.4.1.

| Check                                                                | Linux                                                                                 | Windows                 | macOS                   | CI                      |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ----------------------- | ----------------------- | ----------------------- |
| `pnpm lint` (Biome, check-palette)                                   | Pass                                                                                  | Deferred (not executed) | Deferred (not executed) | Deferred (not executed) |
| `pnpm typecheck`                                                     | Pass                                                                                  | Deferred (not executed) | Deferred (not executed) | Deferred (not executed) |
| `pnpm depcruise`                                                     | Pass: 80 modules, 174 dependencies, no violations                                     | Deferred (not executed) | Deferred (not executed) | Deferred (not executed) |
| `pnpm depcruise:selftest`                                            | Pass: 13 expected violations found                                                    | Deferred (not executed) | Deferred (not executed) | Deferred (not executed) |
| `pnpm test`                                                          | Pass: 214 unit tests (contract 32, desktop 134, ui 11, renderer 37), check-palette 39 | Deferred (not executed) | Deferred (not executed) | Deferred (not executed) |
| `pnpm build-storybook`                                               | Pass                                                                                  | Deferred (not executed) | Deferred (not executed) | Deferred (not executed) |
| `pnpm test:storybook`                                                | Pass: 6 (3 stories, dark and light), no axe violation                                 | Deferred (not executed) | Deferred (not executed) | Deferred (not executed) |
| `pnpm test:e2e`                                                      | Pass: 6 (browser 2, Electron 4) in about 3 s, no display (xvfb-run -a)                | Deferred (not executed) | Deferred (not executed) | Deferred (not executed) |
| `pnpm package`                                                       | Pass: AppImage 126,422,064 bytes (120.6 MiB); `linux-unpacked/` 276 MiB; about 17 s   | Deferred (not executed) | Deferred (not executed) | Deferred (not executed) |
| Packaged app starts                                                  | Pass: AppImage and `linux-unpacked/` show version, platform and the IPC bridge        | Deferred (not executed) | Deferred (not executed) | Deferred (not executed) |
| Fuses (`ELECTRON_RUN_AS_NODE=1 ... -e`, `NODE_OPTIONS`, `--inspect`) | Pass: none takes effect; the app starts as itself                                     | Deferred (not executed) | Deferred (not executed) | Deferred (not executed) |

Windows, macOS and the CI workflow were deferred by the owner for P1a (no push access yet): `studio.yml` was
parsed, not run. Unverified until it runs: the Linux runner's `apparmor_restrict_unprivileged_userns` step, the
macOS fuse re-signing (`resetAdHocDarwinSignature`), and that the Windows and macOS builds start with
`EnableEmbeddedAsarIntegrityValidation` and `OnlyLoadAppFromAsar` on (a missing or wrong embedded asar hash stops
the app from starting there; Linux does not check it).
