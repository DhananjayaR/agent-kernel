# Agent Kernel Studio

Electron desktop app for Agent Kernel (issue #950). pnpm workspace; Node 24.22.1, pnpm 12.4.1.

```bash
cd ak-studio
pnpm install --frozen-lockfile   # also fetches the Electron binary (apps/desktop postinstall)
pnpm lint        # Biome check, then check-palette
pnpm typecheck   # tsc -b over all members
pnpm test        # every member's unit tests (Vitest), then check-palette's own test
pnpm check-palette        # no Tailwind default-palette class or arbitrary value in apps/renderer or packages/ui
pnpm storybook            # Storybook dev server for packages/ui on 127.0.0.1:6006
pnpm build-storybook      # static Storybook into packages/ui/storybook-static/
pnpm test:storybook       # every story, dark and light, in headless Chromium with axe (fails on a violation)
pnpm depcruise   # boundary rules (dependency-cruiser, swc parser)
pnpm depcruise:selftest  # proves the rules can fail and the parser finds modules
pnpm build       # check-palette, then electron-vite: main, preload and renderer into apps/desktop/out/
pnpm dev         # Electron against the electron-vite dev server
pnpm --filter @ak-studio/desktop start   # run the last build (on headless Linux: xvfb-run -a ...)
```

Members: `apps/desktop`, `apps/renderer`, `packages/contract`, `packages/ui`, `packages/kernel-catalog`.

Scripts that are placeholders for now (print "added in Task N" and exit 0): `package` (Task 7).
`test:storybook` needs Playwright's Chromium (`pnpm exec playwright install chromium` once).

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
