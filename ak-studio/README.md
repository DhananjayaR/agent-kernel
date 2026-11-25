# Agent Kernel Studio

Electron desktop app for Agent Kernel (issue #950). pnpm workspace; Node 24.22.1, pnpm 12.4.1.

```bash
cd ak-studio
pnpm install --frozen-lockfile   # also fetches the Electron binary (apps/desktop postinstall)
pnpm lint        # Biome (warnings fail), check-palette, depcruise and its self-test
pnpm typecheck   # tsc -b over all members
pnpm test        # every member's unit tests (Vitest), then check-palette's own test
pnpm check-palette        # no default-palette class, arbitrary value or colour literal in apps/renderer, packages/ui
pnpm storybook            # Storybook dev server for packages/ui on 127.0.0.1:6006
pnpm build-storybook      # static Storybook into packages/ui/storybook-static/
pnpm test:storybook       # every story, dark and light, in headless Chromium with axe (fails on a violation)
pnpm depcruise   # boundary rules (dependency-cruiser, swc parser)
pnpm depcruise:selftest  # proves the rules can fail and the parser finds modules
pnpm build       # check-palette, then electron-vite (production): main, preload and renderer into apps/desktop/out/
pnpm build:e2e   # the same, but main keeps its development and test-hook code (electron-vite --mode e2e)
pnpm dev         # Electron against the electron-vite dev server
pnpm --filter @ak-studio/desktop start   # run the last build (on headless Linux: xvfb-run -a ...)
pnpm test:e2e    # build:e2e, then Playwright: the renderer in Chromium (mock) and the built app in Electron
pnpm package     # build, then electron-builder for this system into apps/desktop/release/ (unsigned)
pnpm test:packaged  # start and check the packaged app in release/ (run pnpm package first; Linux: under X)
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
maximised state are kept in `window-state.json` in the app's data folder.

Development code is compiled out of the production build. `electron.vite.config.ts` sets `__STUDIO_DEV__` at
build time: true for `pnpm dev` and `pnpm build:e2e`, false for `pnpm build` and `pnpm package`. Main's
dev-server and test-hook branches test it first, so the production bundle holds neither (`pnpm test:packaged`
checks `app.asar` for `AK_STUDIO_TEST_HOOKS` and `ELECTRON_RENDERER_URL`). `app.isPackaged` is checked as well,
at run time. Development and e2e builds, run unpackaged with `AK_STUDIO_TEST_HOOKS=1`, expose
`globalThis.__akStudioTestHooks` in the main process (`cancelledRequestCount()`, `cancelledRequestUrls()`, the
newest 100) for the Electron smoke test. The count covers Chromium's network stack only, not Node networking in
the main process. They accept `ELECTRON_RENDERER_URL` only on `localhost`, `127.0.0.1` or `[::1]` (otherwise
they refuse to start). Every unpackaged build runs as "Agent Kernel Studio (dev)" with its own data folder and
single-instance lock.
Packaged builds and production builds (`pnpm build`, packaged or not) refuse to start with `--remote-debugging-port`
or `--remote-debugging-pipe` (checked first, before
the single-instance lock; one line on stderr, exit code 1): the DevTools protocol takes local connections without
authentication and would let any local process drive the app, and no Electron fuse covers these Chromium
switches. Development and e2e builds, run unpackaged, accept them, so Playwright can drive the e2e tests; they
alone have DevTools. Once the window is shown, main
prints `[studio] window shown` on stdout, and `[studio] bridge ready` once it has answered the renderer's first
request (so the renderer loaded and its preload works).

Boundary rules live in `.dependency-cruiser.cjs`: the renderer and `packages/ui` import no `electron` or Node
built-in; `packages/contract` imports only `zod`; `packages/ui` (the whole member, `.storybook/` and config files
included) imports neither `apps/*` nor `@ak-studio/contract`; nothing imports `apps/desktop` but itself.
`pnpm lint` runs the rules and the self-test. dependency-cruiser needs `@swc/core` under
TypeScript 7 (without it a run is silently green: "0 modules"), so `depcruise:selftest` checks a deliberately
violating fixture in `tools/depcruise-selftest/fixture/` (ignored by Biome and the tsconfigs) and fails if
fewer than 2 modules are cruised or any rule goes unreported.

**Design system** (values decided at the P1a design gate, 25 November 2026). `packages/ui/src/theme.css` is the
Tailwind 4 entry: the default palette is removed (`--color-*: initial`) and only the Studio's colour tokens exist,
set per `data-theme` from Agent Kernel's brand (`docs/src/css/custom.css`). Surfaces (`surface`,
`surface-raised`, `surface-overlay`); text roles (`text`, `text-muted`, `text-accent-primary`, `text-accent-ai`,
`text-status-success|warning|danger`), each at least 4.5:1 on all three surfaces; fills (`accent-primary`,
`accent-ai`, `status-success|warning|danger`) each with an `on-*` text colour at least 4.5:1; `border-control`
and `focus-ring` at least 3:1; `border-default` for decorative dividers only. The naming is documented at the top
of `theme.css`, and the values with their measured ratios in
`docs/specs/950-agent-kernel-studio/research/p1a-design-gate-options.md` (section 6). Size, radius, spacing and
type tokens are Spectrum 2 medium, one density (32 px controls, 40 px rows, 14 px base text, 48 px top bar).
`fonts.css` bundles Archivo, Inter and JetBrains Mono through `@fontsource` (served from the app, never fetched):
`font-ui` (Inter, the page default and button labels), `font-heading` (Archivo, the default for headings),
`font-mono` (JetBrains Mono) and `mono-figures` (JetBrains Mono with tabular figures, for durations, counts and
money). The default theme preference is `system`, which follows the OS and is dark when the OS reports neither
(`apps/renderer/src/theme.ts`). Chromium reports light when the OS gives no signal (for example bare Linux), so in practice such a machine
opens light; the dark fallback applies only where neither scheme is reported.
The fonts are under the SIL Open Font License 1.1: their copyright lines and the licence text are in
`apps/desktop/resources/THIRD-PARTY-NOTICES.txt`, which the packaged app ships in its `resources/` folder. The renderer imports the
tokens from `apps/renderer/src/styles.css`; Storybook from `packages/ui/.storybook/preview.css`. The token story
(`src/tokens.stories.tsx`) renders every text-on-surface and on-fill pair as real text in both themes, with its
computed ratio, so `pnpm test:storybook` (axe's contrast rule plus the story's own assertions) fails if a pair
drops below 4.5:1, or a control border or focus ring below 3:1. `packages/ui/components.json` configures the shadcn CLI (React Aria base, style `aria-nova`); run
`pnpm --filter @ak-studio/ui exec shadcn add <name>` (the pinned CLI) once the gate approves a component, and
pin whatever it adds.

**check-palette: known limits.** It reads source as text, so it cannot see class names built at run time
(template strings such as `` `bg-${tone}-500` ``, or concatenation such as `"bg-" + tone`), and it does not flag
Tailwind's CSS-variable shorthand (`bg-(--x)`, `w-(--trigger-width)`). Colour literals (hex, `rgb()`, `hsl()`,
`oklch()`, `color()` ...) are allowed only in `packages/ui/src/theme.css` and in unit tests (`*.test.*`); hex
counts only in a value position, and comment lines are not checked for literals. Tailwind's default palette,
shadow, inset/drop/text shadow, radius, text-size and font-family scales are removed in `theme.css`, so such a
class compiles to nothing even where the check cannot see it. Its scope is `apps/renderer` and `packages/ui`.

**End-to-end tests** (`playwright.config.ts`, `tests/e2e/`). `pnpm test:e2e` builds (`build:e2e`, which keeps the
test hooks), then runs two Playwright
projects through `tools/e2e.mjs`, which wraps the run in `xvfb-run -a` on Linux when there is no `DISPLAY`
(extra arguments go to `playwright test`, e.g. `pnpm test:e2e --project browser`). `browser` serves the
renderer with its Vite dev server on `127.0.0.1:5199` and checks it on the mock transport: version, platform,
theme switch. `electron` launches the built, unpackaged app (`apps/desktop/out/`) with `AK_STUDIO_TEST_HOOKS=1`
and a fresh `--user-data-dir` per test, and checks the version and platform from the real main process, that the
theme switch reaches `nativeTheme`, that the request gate cancelled nothing (Chromium's network stack only: Node
networking in main is not covered), that the gate does count a refused request, and that the page uses the
bundled Inter, loaded from `app://studio/assets/` with no `securitypolicyviolation` event.

**Packaging** (`apps/desktop/electron-builder.yml`, electron-builder 26.18.0). `pnpm package` builds, then
packages for the current system into `apps/desktop/release/`: an AppImage and `linux-unpacked/` on Linux, an NSIS
installer on Windows, a dmg on macOS (Windows and macOS are configured, not yet built). Nothing is signed. The
asar holds `out/` and `package.json` only (the contract and zod are bundled into main, so no `node_modules`).
`appId` (`ai.yaala.kernel.studio`) and the product name are working names until P12. Electron fuses are flipped at
package time: `RunAsNode`, `EnableNodeOptionsEnvironmentVariable`, `EnableNodeCliInspectArguments` and
`GrantFileProtocolExtraPrivileges` off; `EnableCookieEncryption`, `OnlyLoadAppFromAsar` and
`EnableEmbeddedAsarIntegrityValidation` (macOS and Windows only; no effect on Linux) on. So
`ELECTRON_RUN_AS_NODE`, `NODE_OPTIONS` and `--inspect` do nothing to a packaged app, and with the
remote-debugging switches refused, nothing can drive one (Playwright needs `--inspect`): the Electron e2e tests run
against the unpackaged build. The packaged app is checked by `pnpm test:packaged` (`tools/packaged-smoke.mjs`),
which uses what `pnpm package` left in `release/`: on Linux `linux-unpacked/` and the AppImage, on Windows
`win-unpacked/`, on macOS the `.app`. For each, with a fresh `--user-data-dir`, it waits for `[studio] window shown`
and `[studio] bridge ready` (60 s limit; fails on `refusing to start` or `could not load`), closes the app and
expects exit code 0 and no process left; starts it with `--remote-debugging-port=<free port>` and with
`--remote-debugging-pipe` and expects a non-zero exit, the refusal line, and a port that never accepts a
connection; and checks that `app.asar` holds no test-hook code and that the notices file ships. On Linux it needs
an X server (`xvfb-run -a pnpm test:packaged`). The AppImage needs FUSE 2 (`libfuse2`); without it, run it with
`--appimage-extract-and-run` (the smoke check sets `APPIMAGE_EXTRACT_AND_RUN=1`).

**CI** (`.github/workflows/studio.yml`). On pull requests and pushes to `develop` that touch `ak-studio/**`, on
Ubuntu, Windows and macOS: install, Playwright's Chromium, lint (with depcruise and its self-test), typecheck,
unit tests, Storybook build and accessibility run, e2e, package, the packaged smoke check (`xvfb-run -a` on
Linux), and the installer uploaded as a workflow artifact only after the smoke check passes.
The Python `Test` and `Code Quality` workflows ignore changes under `ak-studio/**`. No status check is required
on `develop` today; if `Test` or `Code Quality` ever becomes a required check, a Studio-only PR would wait forever
for a run that never starts, and needs a different approach (for example a job that always runs and skips its
steps). `ak-studio/.gitattributes` keeps LF line endings on Windows checkouts, which Biome expects.

**Linux results (P1a, 25 November 2026).** Measured on Linux (WSL2, x64), Node 24.22.1, pnpm 12.4.1. The
packaged rows are from `pnpm test:packaged`, which CI also runs before it uploads an installer.

| Check                                                                            | Linux                                                                                                                                                                                                                                                                                                                                           | Windows                 | macOS                   | CI                      |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | ----------------------- | ----------------------- |
| `pnpm install --frozen-lockfile`                                                 | Pass: lockfile up to date, supply-chain policy OK                                                                                                                                                                                                                                                                                               | Deferred (not executed) | Deferred (not executed) | Deferred (not executed) |
| `pnpm dev`                                                                       | Pass: window loads from the electron-vite dev server (`localhost:5173`), prints `[studio] window shown` and `[studio] bridge ready`; no CSP violation in the console (`ELECTRON_ENABLE_LOGGING=1`)                                                                                                                                              | Deferred (not executed) | Deferred (not executed) | Deferred (not executed) |
| `pnpm lint` (Biome with warnings as errors, check-palette, depcruise, self-test) | Pass: no Biome warning; check-palette 29 files                                                                                                                                                                                                                                                                                                  | Deferred (not executed) | Deferred (not executed) | Deferred (not executed) |
| `pnpm typecheck`                                                                 | Pass                                                                                                                                                                                                                                                                                                                                            | Deferred (not executed) | Deferred (not executed) | Deferred (not executed) |
| `pnpm depcruise`                                                                 | Pass: 82 modules, 177 dependencies, no violations                                                                                                                                                                                                                                                                                               | Deferred (not executed) | Deferred (not executed) | Deferred (not executed) |
| `pnpm depcruise:selftest`                                                        | Pass: 20 modules, 14 expected violations found, 2 allowed cases clean                                                                                                                                                                                                                                                                           | Deferred (not executed) | Deferred (not executed) | Deferred (not executed) |
| `pnpm test`                                                                      | Pass: 218 unit tests (contract 32, desktop 138, ui 11, renderer 37), check-palette 39                                                                                                                                                                                                                                                           | Deferred (not executed) | Deferred (not executed) | Deferred (not executed) |
| `pnpm build` (production)                                                        | Pass: `out/main/index.js` holds no `AK_STUDIO_TEST_HOOKS` or `ELECTRON_RENDERER_URL`                                                                                                                                                                                                                                                            | Deferred (not executed) | Deferred (not executed) | Deferred (not executed) |
| `pnpm build-storybook`                                                           | Pass                                                                                                                                                                                                                                                                                                                                            | Deferred (not executed) | Deferred (not executed) | Deferred (not executed) |
| `pnpm test:storybook`                                                            | Pass: 6 (3 stories, dark and light), no axe violation                                                                                                                                                                                                                                                                                           | Deferred (not executed) | Deferred (not executed) | Deferred (not executed) |
| `pnpm test:e2e`                                                                  | Pass: 7 (browser 2, Electron 5) in about 3 s, no display (xvfb-run -a)                                                                                                                                                                                                                                                                          | Deferred (not executed) | Deferred (not executed) | Deferred (not executed) |
| `pnpm package`                                                                   | Pass: AppImage 126,422,100 bytes (120.6 MiB; differs by tens of bytes from build to build); `linux-unpacked/` 276 MiB; about 11 s                                                                                                                                                                                                               | Deferred (not executed) | Deferred (not executed) | Deferred (not executed) |
| `pnpm test:packaged` (AppImage and `linux-unpacked/`)                            | Pass, under `xvfb-run -a` and on a display: both start (`window shown`, `bridge ready`) and close with exit code 0, no process left; `--remote-debugging-port` and `--remote-debugging-pipe` exit 1 with the refusal line, the port never accepts a connection; `app.asar` holds no test-hook code; `THIRD-PARTY-NOTICES.txt` ships; about 21 s | Deferred (not executed) | Deferred (not executed) | Deferred (not executed) |
| Fuses (`ELECTRON_RUN_AS_NODE=1 ... -e`, `NODE_OPTIONS`, `--inspect`)             | Pass: none takes effect; the app starts as itself                                                                                                                                                                                                                                                                                               | Deferred (not executed) | Deferred (not executed) | Deferred (not executed) |

Windows, macOS and the CI workflow were deferred by the owner for P1a (no push access yet): `studio.yml` was
parsed, not run. Unverified until it runs: the Linux runner's `apparmor_restrict_unprivileged_userns` step, the
macOS fuse re-signing (`resetAdHocDarwinSignature`), and that the Windows and macOS builds start with
`EnableEmbeddedAsarIntegrityValidation` and `OnlyLoadAppFromAsar` on (a missing or wrong embedded asar hash stops
the app from starting there; Linux does not check it; the smoke check is what would catch it), and the smoke
check's own Windows and macOS paths (the unpacked app's location, its stdout lines reaching the script, closing
with `taskkill` on Windows).
