# OAK Studio

Open Agent Kernel Studio (OAK Studio): the Electron desktop app for Open Agent Kernel (OAK) (issue #950). pnpm
workspace; Node 24.22.1, pnpm 12.4.1.

**Brand.** The source of truth is [`branding/README.md`](../branding/README.md) at the repository root (name
rules, logos, colours, the website design system) and its SVGs, used as they are (never redrawn or recoloured).
The full name "Open Agent Kernel Studio" is the `productName`, the window title, the renderer `<title>`, the About
panel and the installer name (the brand's rule: the full name in titles); the compact interface says "OAK Studio"
(the top bar's logo name, messages); identifiers keep their form
(`ak-studio/`, `@ak-studio/*`, the `ak-studio` executable, the app id). The palette is already the token palette
(`packages/ui/src/theme.css`). Interface icons are Tabler outline icons (`@tabler/icons-react`, pinned; Biome's
`noRestrictedImports` refuses `lucide-react`), stroke 2, in two sizes: 16 px (inline, controls, chips; the default
`theme.css` gives `.tabler-icon`) and 20 px (`size-5`: the top bar, empty states, larger affordances). Storybook's
`afterEach` (`.storybook/preview.tsx`) fails any story that shows an icon of another size. Icons are always `aria-hidden`
(Tabler, unlike the lucide it replaced, does not hide them itself): the control around an icon carries the name.
The top bar starts with the mark, `packages/ui/src/assets/oak-mark-orange.svg`, a byte-for-byte copy of
`branding/logo-mark/oak-mark-orange.svg` (a unit test compares them, line endings normalised; the Studio
workflow also runs on changes under `branding/logo-mark/`; Biome skips the file, so it is never reformatted), imported as an asset and emitted as a file, so the app serves it from `app://studio/assets/` under
the production CSP. The app icon, `apps/desktop/build/icon.png` (1024 x 1024: the orange mark on Prussian Blue
`#02284F`, the background `branding/README.md` gives for that colourway), is rendered from the same SVG by
`pnpm make-app-icon` (`tools/make-app-icon.mjs`, Playwright's Chromium); run it again when the mark changes and
commit the PNG and `icon.source.sha256` (the mark's hash; a unit test fails when the PNG is out of date). electron-builder makes the Linux icon sizes, the macOS `.icns` and the Windows `.ico` from it (its
converter works on Linux too), and main sets it as the window icon on Linux (from `resources/icon.png` when
packaged). The icon is a full-bleed square; the macOS rounded-square template is made with signing, in P12.

```bash
cd ak-studio
pnpm install --frozen-lockfile   # also fetches the Electron binary (apps/desktop postinstall)
pnpm lint        # Biome (warnings fail) and its self-test, check-palette, check-classes, check-stories (each with its
                 # self-test), compile-schemas --check, depcruise and its self-test
pnpm typecheck   # tsc -b over all members
pnpm test        # every member's unit tests (Vitest), then check-palette's own test
pnpm check-palette        # no default-palette class, arbitrary value or colour literal in apps/renderer, packages/ui
pnpm check-classes        # no arbitrary value (p-[13px], gap-(--x)) or inline colour style in their .ts/.tsx
pnpm check-stories        # every component and screen has a stories file with its required stories
pnpm check-fixture        # the support-triage fixture against agentkernel (ak-py/.venv when present)
pnpm make-app-icon        # render apps/desktop/build/icon.png from branding/logo-mark/oak-mark-orange.svg
pnpm third-party-notices  # rewrite the bundled-code licences in apps/desktop/resources/THIRD-PARTY-NOTICES.txt
pnpm storybook            # Storybook dev server for packages/ui on 127.0.0.1:6006
pnpm build-storybook      # static Storybook into packages/ui/storybook-static/
pnpm test:storybook       # every story (packages/ui and the renderer), dark and light, in headless Chromium with axe
pnpm test:visual          # build Storybook, then screenshot every story, dark and light, against the Linux baselines
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

Members: `apps/desktop`, `apps/renderer`, `packages/contract`, `packages/runtime`, `packages/ui`, `packages/kernel-catalog`.

`test:storybook`, `test:visual` and `test:e2e` need Playwright's Chromium (`pnpm exec playwright install chromium` once; on a
fresh Linux machine `pnpm exec playwright install --with-deps chromium`).

**Desktop app.** `apps/desktop` holds the Electron main process and preload, and the electron-vite config,
which also builds `apps/renderer` (so the renderer holds no Node-run file). The window loads `app://studio/`,
a custom protocol serving `apps/desktop/out/renderer/` with the content security policy as a response header.
Context isolation and the sandbox are on, Node integration is off, navigation, new windows and permissions are
refused, and every request whose scheme is not `app:` or `devtools:` (or, unpackaged, the dev server) is
cancelled. The preload exposes one global, `window.studio` (`request`, `subscribe`). Window size, position and
maximised state are kept in `window-state.json` in the app's data folder; the app preferences (the theme and the
shell layout: the bottom panel's open state and height) in `preferences.json`, written by `AppService` through
`app.setTheme` and `app.setLayout` (strict schemas in `packages/contract`). The window opens with the stored theme's
surface colour as its background (`nativeTheme` already follows the preference; `system` follows the OS), so a dark
theme has no white flash, and keeps it in step when the theme changes.

Development code is compiled out of the production build. `electron.vite.config.ts` sets `__STUDIO_DEV__` at
build time: true for `pnpm dev` and `pnpm build:e2e`, false for `pnpm build` and `pnpm package`. Main's
dev-server and test-hook branches test it first, so the production bundle holds neither (`pnpm test:packaged`
checks `app.asar` for `AK_STUDIO_TEST_HOOKS` and `ELECTRON_RENDERER_URL`). `app.isPackaged` is checked as well,
at run time. Development and e2e builds, run unpackaged with `AK_STUDIO_TEST_HOOKS=1`, expose
`globalThis.__akStudioTestHooks` in the main process (`cancelledRequestCount()`, `cancelledRequestUrls()`, the
newest 100) for the Electron smoke test. The count covers Chromium's network stack only, not Node networking in
the main process. They accept `ELECTRON_RENDERER_URL` only on `localhost`, `127.0.0.1` or `[::1]` (otherwise
they refuse to start). Every unpackaged build runs as "Open Agent Kernel Studio (dev)" with its own data folder and
single-instance lock. The data folder is named after the product name (`<appData>/Open Agent Kernel Studio`, and
`<appData>/Open Agent Kernel Studio (dev)` unpackaged), so it moved with the renames ("Agent Kernel Studio", then
"OAK Studio"): window state and preferences kept under an old name are not read (nothing was released under them).
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
included) imports neither `apps/*` nor `@ak-studio/contract`; `packages/runtime` imports only `@ak-studio/contract`, `zod` and itself
(no Node built-in, no `electron`); nothing imports `apps/desktop` but itself. In `apps/renderer/src`: `features/<a>` never imports
`features/<b>`, `shared/` imports neither `features/` nor `app/`, and `features/` never imports `app/`.
`pnpm lint` runs the rules and the self-test. dependency-cruiser needs `@swc/core` under
TypeScript 7 (without it a run is silently green: "0 modules"), so `depcruise:selftest` checks a deliberately
violating fixture in `tools/depcruise-selftest/fixture/` (ignored by Biome and the tsconfigs) and fails if
fewer than 2 modules are cruised or any rule goes unreported.

**Design system** (values decided at the P1a design gate, 25 November 2026). `packages/ui/src/theme.css` is the
Tailwind 4 entry: the default palette is removed (`--color-*: initial`) and only the Studio's colour tokens exist,
set per `data-theme` from OAK's brand (`docs/src/css/custom.css`). Surfaces (`surface`,
`surface-raised`, `surface-overlay`); text roles (`text`, `text-muted`, `text-accent-primary`, `text-accent-ai`,
`text-status-success|warning|danger`), each at least 4.5:1 on all three surfaces; fills (`accent-primary`,
`accent-ai`, `status-success|warning|danger`) each with an `on-*` text colour at least 4.5:1; `border-control`
and `focus-ring` at least 3:1; `border-default` for decorative dividers only. The naming is documented at the top
of `theme.css`, and the values with their measured ratios in
`docs/specs/950-agent-kernel-studio-phase-1/research/technology/p1a-design-gate-options.md` (section 6). Size, radius, spacing and
type tokens are Spectrum 2 medium, one density (32 px controls, 40 px rows, 14 px base text, 48 px top bar), in
OAK's shape (`branding/README.md`, "Shape"): two radii, `rounded-control` (8 px) for every control, rectangular
(buttons, icon buttons, fields, pickers, the segmented control, tags, badges, status and path chips; no pill
buttons; the DataTable frame too, since a table is not a card), and `rounded-card` (16 px) for cards and panels.
Popovers and menus (10 px), the dialog (16 px) and rows nested in a control (4 px) keep their measured Spectrum 2
radii; `rounded-pill` is left for round marks only (the switch, a track rather than a box; selection edges; the
empty state's icon disc).
`fonts.css` bundles Archivo, Inter and JetBrains Mono through `@fontsource` (served from the app, never fetched):
`font-ui` (Inter, the page default and every button label but one), `font-heading` (Archivo, the default for
headings, and the primary button's label in SemiBold, `font-heading font-cta`: "Archivo for headlines and CTA
buttons"),
`font-mono` (JetBrains Mono) and `mono-figures` (JetBrains Mono with tabular figures, for durations, counts and
money). The default theme preference is `system`, which follows the OS and is dark when the OS reports neither
(`apps/renderer/src/app/theme.ts`). Chromium reports light when the OS gives no signal (for example bare Linux), so in practice such a machine
opens light; the dark fallback applies only where neither scheme is reported.
The fonts are under the SIL Open Font License 1.1: their copyright lines and the licence text are in
`apps/desktop/resources/THIRD-PARTY-NOTICES.txt`, which the packaged app ships in its `resources/` folder. The same file
lists every package bundled into main and the renderer with its licence text, written by `pnpm third-party-notices`
(`tools/third-party-notices.mjs`: a production build with source maps names the packages; the two the stylesheet
compiles in, Tailwind's preflight and tw-animate-css, are listed in the script). Run it after a dependency change. The renderer imports the
tokens from `apps/renderer/src/styles.css`; Storybook from `packages/ui/.storybook/preview.css`. The token story
(`src/tokens.stories.tsx`) renders every text-on-surface and on-fill pair as real text in both themes, with its
computed ratio, so `pnpm test:storybook` (axe's contrast rule plus the story's own assertions) fails if a pair
drops below 4.5:1, or a control border or focus ring below 3:1. `packages/ui/components.json` configures the shadcn CLI (React Aria base, style `aria-nova`); run
`pnpm --filter @ak-studio/ui exec shadcn add <name>` (the pinned CLI) once the gate approves a component, and
pin whatever it adds. shadcn writes `import { cn } from "cn"` and imports through the `@ak-studio/ui/...` aliases:
point both at relative paths (`../lib/utils`), because `lib/utils.ts` configures `cn` with the Studio's theme keys
(without them it merges `text-ui` with `text-text` and drops the size). `lib/utils.test.ts` fails while a
component imports `cn` directly, or while `lib/utils.ts` misses a size, radius, type or font key of `theme.css`.

**Base components** (Task 9, `packages/ui/src/components/`, exported from `@ak-studio/ui`), restyled to Spectrum 2
medium on React Aria: Button and IconButton, Input, Textarea, Select, Combobox, Checkbox, Switch, SegmentedControl
(controls); Tag, Badge, StatusChip, PathChip, Card, CodeBlock, Tooltip, Skeleton, Spinner, EmptyState,
InlineBanner (display); Modal, ConfirmModal, Popover, Menu, ContextMenu, Toast (overlays); Tabs, ResizablePanels,
DataTable, Tree (structure). Drawer is left to P6 (its first user, the Build with AI drawer). Fields take `label`,
`description` and `errorMessage` and render them, and must be named
by type (`label`, `aria-label` or `aria-labelledby`). Each control's state colours come from one function in
`src/lib/state.ts` with a written precedence (disabled wins over everything; invalid wins the border over focus,
hover and selection; read-only shows no hover or press), and `state.test.ts` enumerates every combination.
Read-only (P3's config forms): Input, Textarea, Combobox, Checkbox and Switch take `isReadOnly`; Select, which
React Aria cannot make read-only, renders as a read-only Input showing the selected option. The English defaults
of the components (status labels, "Copy path", ...) are in `src/strings.ts`, each overridable by a prop. Shared
class recipes are in `src/lib/styles.ts`; `theme.css` adds the state colours they use (`accent-primary-hover`,
`status-danger-hover`, the neutral `fill` steps derived from `text`, the `disabled-*` colours and the modal
`scrim`) and the `focus-ring` / `focus-ring-inset` / `focus-outline`, `press`, `tree-indent` and `menu-target`
utilities. Muted
text never sits on a neutral fill (it drops below 4.5:1), so table and tree rows show `text`-coloured content
only. Every component has stories (default, hover, focus, disabled, invalid where they apply; keyboard tests
for Select, Combobox, Checkbox, Switch, SegmentedControl, PathChip, Modal, ConfirmModal, Popover, Menu,
ContextMenu, Toast, Tabs, ResizablePanels, DataTable and Tree) whose play functions check the state was
reached and the Spectrum 2 measurement (32 px controls, radii, padding, the 2 px focus ring 2 px away). Storybook
sets `data-theme` on `<html>` as the app does, so popovers and tooltips (portalled to `<body>`) follow the theme.

**Overlays and structure.** Floating layers (Modal, Popover, Menu, ContextMenu, Toast) are solid: the overlay
surface, a decorative hairline and the measured `shadow-elevated`, asserted by `expectSolidLayer` in both themes.
Focus moves into a Modal or Popover when it opens, Tab and Shift+Tab wrap inside a Modal, and focus goes back to
the trigger (or into the modal underneath) when it closes; Escape closes the top one; the page does not scroll
behind a Modal. A Modal's body scrolls between its header and footer and is a focusable named region while it
overflows. The modal scrim is z-40 and toasts z-50, so a toast stays visible above an open modal. In light theme
the scrim separates the modal's fill from the page by at least 1.5:1; in dark theme no existing colour can (the
scrim is already the darkest surface), so the dark modal edge is `border-control`, at least 3:1 against the
scrimmed page (both asserted). A ConfirmModal is an alert dialog whose action says what happens; "what will
happen" and "This affects" are its accessible description, and its buttons sit in the Modal footer. The
destructive variant names what it affects and enables its danger action only when the thing's name is typed
exactly (an empty name never matches, and `confirmName=""` does not compile); focus never starts on that action
(Escape and Cancel close it without acting; a scrim click does nothing). Toast is React Aria's toast
(`UNSTABLE_ToastRegion`, pinned with react-aria-components 1.22.1), not sonner as P0 D1 records (the record needs
the owner's change): sonner injects a global stylesheet whose base toast rule, active even when unstyled, sets
400 ms transitions, absolute positioning and a fixed width. A toast reports background work
(`notifyBackgroundResult`): a job that finished, or one that needs an answer (`info` with a "Show" action, which
never times out; the owning tab's badge carries it too). F6 reaches the toast region, and F6 or Shift+F6 there goes
back to where focus was (when that element can still take focus; otherwise React Aria's own wrap runs). That return
hook depends on react-aria 3.53.1 internals under the 1.22.1 pin (the cancelable `react-aria-landmark-navigation`
wrap event; see `useLandmarkReturn` in `toast.tsx`): check it on any upgrade. ContextMenu wraps a region (a Tree or DataTable) and opens for the row under the pointer
(which takes focus) or the focused row (Shift+F10, the ContextMenu key); the row is marked while the menu is open
(`menu-target`), and focus returns to it. ResizablePanels (react-resizable-panels 4.24.1, P0 D1) never stores
anything: `defaultLayout` restores a layout and `onLayoutChange` reports the one to remember; a disabled handle
is a dashed rule with no tab stop. DataTable and Tree use highlight selection (selection follows focus, Space
toggles, Enter runs the row action, Mod+A selects all with multiple selection) and draw a selected row's 2 px
start edge in `text-accent-primary` so selection is not colour alone. Escape clears their selection, except
inside a Modal or Popover, where it closes the overlay. Their keyboard models are written at the top of
`data-table.tsx` and `tree.tsx` and asserted by their stories. DataTable is not virtualised; a sortable column
shows an up-down icon at rest. The Menu `Shortcuts` story disables axe's `label-content-name-mismatch` rule: it
counts a visible shortcut ("Ctrl+E") as label text, while React Aria exposes it as the item's description
(asserted).

**Desktop shell** (Task 10, the "Shell layout" row of the design gate, built as its step 4 prototype; the owner
signs it off from the `Shell/*` stories). Presentational components in `packages/ui`: `DesktopShell` (top bar, the
selected tab's content as the `main` landmark, the bottom panel, the status bar), `TopBar` (starting with the
20 px OAK mark, named "OAK Studio", before the project switcher) and `AppTabList`
(Canvas, Code, Config, Test & trace, Deploy, as React Aria tabs filling the 48 px bar), `ProjectSwitcher`,
`RunControl` (stopped, starting, running, failed), `DeployStatus` (not deployed, deployed, applying, failed),
`BuildWithAIButton` (Button's `ai` variant: an outline in the AI colour with a sparkle, filled with the AI colour on
hover; existing roles only), `SettingsButton`, `BottomPanel` (Problems, Run log, Commands), `StatusBar` and
`SettingsModal`. Fixtures and the width checks are in `src/lib/shell-fixtures.tsx`; shell stories render full bleed
(`parameters.fullBleed`) at a set viewport (`parameters.viewport` and `globals.viewport`, which the Vitest run
applies), so a story at 1100 px measures 1100 px. The top bar is one row: at 1220 px and wider every label shows in
full and only the project name gives way (ellipsis, at least 96 px); below 1220 px (the window allows 1000), or when the full form does not fit (badges on the tabs; it tries the full form again when the tabs change or the bar widens), it is compact: tabs 16 px apart and the bar's parts 8 px (12 px in the full form), Build with AI shows its sparkle (name in a tooltip), the run control drops the port and
the deploy status its time. Nothing scrolls sideways (stories `At1220`, `At1440`, `At1100`, `At1000Compact`; e2e at 1100 px). The top bar is also the window's drag region and, on Linux and Windows, holds `WindowControls` (120 px) at its right edge; `leadingInset` keeps room for the macOS traffic lights;
below about 1100 px the status bar may cut its last items (its narrow rule is P2's). The bottom panel collapses to
its tab strip, so its toggle stays put; selecting a panel tab opens it; Mod+J (Ctrl+J, Cmd+J on macOS; declared in
`bottom-panel.tsx`, no clash test exists yet) toggles it from anywhere; hiding it moves focus out of the views
first. Its height is in pixels, restored when the shell mounts and reported after a drag, the handle's keys or a
toggle. React Aria's Tabs render their children once in a detached document to build the collection, where
react-resizable-panels refuses to mount, so `DesktopShell` mounts the panel group only once it is in a window; the
bottom panel clears the outer tab state for its own Tabs (as React Aria's TabPanel does). Both depend on react-aria
3.53.1 internals under the 1.22.1 pin: check them on any upgrade (the shell stories and axe's aria checks catch a
regression). In the app
(`apps/renderer/src/app/shell/`), the tabs are hash routes (`#/canvas` ... `#/deploy`) whose empty states name the phase
that fills them; no project can be opened before P2, so everything project-scoped shows its not-yet state (the switcher "No project open", the run control "No project to run" with no start control, the deploy status "Not deployed", the coding agent "not set up"); Build with AI opens a popover saying it arrives in P6; settings open a modal with
the theme; the status bar shows the Studio's version (the project's OAK version is a separate slot P2
fills). A failed layout save is a background toast.

**check-palette: known limits.** It reads source as text, so it cannot see class names built at run time
(template strings such as `` `bg-${tone}-500` ``, or concatenation such as `"bg-" + tone`), and it leaves
Tailwind's CSS-variable shorthand (`bg-(--x)`) to check-classes, which allows only `--trigger-width`. Generated
validators (`*.validate.js`) are not read. Colour literals (hex, `rgb()`, `hsl()`,
`oklch()`, `color()` ...) are allowed only in `packages/ui/src/theme.css` and in unit tests (`*.test.*`); hex
counts only in a value position, and comment lines are not checked for literals. Tailwind's default palette,
shadow, inset/drop/text shadow, radius, text-size and font-family scales are removed in `theme.css`, so such a
class compiles to nothing even where the check cannot see it. Its scope is `apps/renderer` and `packages/ui`.

**check-classes and check-stories.** `check-classes` reads the `.ts` and `.tsx` under `apps/renderer/src` and
`packages/ui/src` (not generated validators or the fixture project): an arbitrary value or property, the variable
shorthand for any variable but React Aria's `--trigger-width`, or an inline colour style (a colour property in
`style={{ ... }}` or a `CSSProperties` object, on `.style` or through `setProperty`, or a literal `fill`, `stroke`
or `color` attribute other than `currentColor` or `none`) fails; only the token reference page
(`tokens.stories.tsx`) may paint colours inline. `check-stories` needs a `<name>.stories.tsx` beside each file in
`packages/ui/src/components/` and in a feature's `components/` or `screens/`; `tools/story-requirements.json`
lists the stories a pattern of components must have, components shown in another stories file (`coveredBy`) and
exemptions with their reason. Both are scripts with planted-file self-tests (`tools/check-*-fixture/`, ignored by
Biome). `pnpm biome:selftest` copies `tools/biome-selftest/fixture/` to a temporary folder whose `biome.json`
extends the real one, and expects each planted electron, Node built-in and `window`/`document` use to be reported.

**Visual regression** (`playwright.visual.config.ts`, `tests/visual/`). `pnpm test:visual` builds Storybook, serves
`packages/ui/storybook-static` and photographs every story in its index, dark and light, once Storybook reports
the story finished (play function and checks done) and the fonts have loaded, at the story's own viewport if it
names one, else 1280 x 800; animations are stopped and the caret hidden. Baselines are in
`tests/visual/__screenshots__/linux/` and the run refuses other systems (fonts render differently). After an
intended change: `pnpm test:visual --update-snapshots`, on Linux, and review the changed images.

**End-to-end tests** (`playwright.config.ts`, `tests/e2e/`). `pnpm test:e2e` builds (`build:e2e`, which keeps the
test hooks), then runs two Playwright
projects through `tools/e2e.mjs`, which wraps the run in `xvfb-run -a` on Linux when there is no `DISPLAY`
(extra arguments go to `playwright test`, e.g. `pnpm test:e2e --project browser`). `browser` serves the
renderer with its Vite dev server on `127.0.0.1:5199` and checks it on the mock transport: the shell renders with
the mock's version, each tab opens its empty state (and its address), the theme switches from the settings modal,
Ctrl+J and the toggle hide and show the bottom panel, and at 1100 px the top bar is one row with no horizontal
scroll. `electron` launches the built, unpackaged app (`apps/desktop/out/`) with `AK_STUDIO_TEST_HOOKS=1` and a
fresh `--user-data-dir` per test (or one shared by a restart), and checks the version from the real main process,
each tab's empty state, that the theme switch from the settings modal reaches `nativeTheme` and the window's
background, that the window opens with the stored theme's background (dark, light, system), that the bottom
panel's open state and height persist across a restart, the 1100 px layout, that the request gate cancelled
nothing (Chromium's network stack only: Node networking in main is not covered), that the gate does count a
refused request, and that the page uses the bundled Inter, Archivo and JetBrains Mono, declared on
`app://studio/assets/` with no `securitypolicyviolation` event.

**Packaging** (`apps/desktop/electron-builder.yml`, electron-builder 26.18.0). `pnpm package` builds, then
packages for the current system into `apps/desktop/release/`: an AppImage and `linux-unpacked/` on Linux, an NSIS
installer on Windows, a dmg on macOS (Windows and macOS are configured, not yet built). Nothing is signed. The
asar holds `out/` and `package.json` only (the contract and zod are bundled into main, so no `node_modules`).
The product name is "Open Agent Kernel Studio" and `appId` (`ai.yaala.kernel.studio`) is unchanged; P12 confirms both. The
icon comes from `build/` (`buildResources`), and `build/icon.png` also ships as `resources/icon.png` for the Linux
window icon (`pnpm test:packaged` checks it is there). On Linux, `desktopName` (`oak-studio.desktop`, in
`apps/desktop/package.json`) with `linux.syncDesktopName` names the launcher entry and its `StartupWMClass`
(`oak-studio`), and Electron takes the window's app id from the same field, so the desktop links the window to the
launcher. Electron fuses are flipped at
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
`test.yaml` (`Test`) and `code-quality.yml` (`Code Quality`) skip changes only under `ak-studio/**`. No status check is required
on `develop` today; if `Test` or `Code Quality` ever becomes a required check, a Studio-only PR would wait forever
for a run that never starts, and needs a different approach (for example a job that always runs and skips its
steps). `ak-studio/.gitattributes` keeps LF line endings on Windows checkouts, which Biome expects.

**Linux results (P1a, 25 November 2026).** Measured on Linux (WSL2, x64), Node 24.22.1, pnpm 12.4.1. The
packaged rows are from `pnpm test:packaged`, which CI also runs before it uploads an installer.

| Check                                                                            | Linux                                                                                                                                                                                                                                                                                                                                           | Windows                 | macOS                   | CI                      |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | ----------------------- | ----------------------- |
| `pnpm install --frozen-lockfile`                                                 | Pass: lockfile up to date, supply-chain policy OK                                                                                                                                                                                                                                                                                               | Deferred (not executed) | Deferred (not executed) | Deferred (not executed) |
| `pnpm dev`                                                                       | Pass: window loads from the electron-vite dev server (`localhost:5173`), prints `[studio] window shown` and `[studio] bridge ready`; no CSP violation in the console (`ELECTRON_ENABLE_LOGGING=1`)                                                                                                                                              | Deferred (not executed) | Deferred (not executed) | Deferred (not executed) |
| `pnpm lint` (Biome with warnings as errors, check-palette, depcruise, self-test) | Pass: no Biome warning; check-palette 117 files (after Task 10)                                                                                                                                                                                                                                                                                 | Deferred (not executed) | Deferred (not executed) | Deferred (not executed) |
| `pnpm typecheck`                                                                 | Pass                                                                                                                                                                                                                                                                                                                                            | Deferred (not executed) | Deferred (not executed) | Deferred (not executed) |
| `pnpm depcruise`                                                                 | Pass: 175 modules, 650 dependencies, no violations (after Task 10)                                                                                                                                                                                                                                                                              | Deferred (not executed) | Deferred (not executed) | Deferred (not executed) |
| `pnpm depcruise:selftest`                                                        | Pass: 20 modules, 14 expected violations found, 2 allowed cases clean                                                                                                                                                                                                                                                                           | Deferred (not executed) | Deferred (not executed) | Deferred (not executed) |
| `pnpm test`                                                                      | Pass: 580 unit tests (contract 35, desktop 144, ui 351, renderer 50), check-palette 39 (after Task 10)                                                                                                                                                                                                                                          | Deferred (not executed) | Deferred (not executed) | Deferred (not executed) |
| `pnpm build` (production)                                                        | Pass: `out/main/index.js` holds no `AK_STUDIO_TEST_HOOKS` or `ELECTRON_RENDERER_URL`                                                                                                                                                                                                                                                            | Deferred (not executed) | Deferred (not executed) | Deferred (not executed) |
| `pnpm build-storybook`                                                           | Pass                                                                                                                                                                                                                                                                                                                                            | Deferred (not executed) | Deferred (not executed) | Deferred (not executed) |
| `pnpm test:storybook`                                                            | Pass: 370 (185 stories, dark and light), no axe violation, three runs in a row (after Task 10)                                                                                                                                                                                                                                                  | Deferred (not executed) | Deferred (not executed) | Deferred (not executed) |
| `pnpm test:e2e`                                                                  | Pass: 14 (browser 5, Electron 9) in about 9 s, no display (xvfb-run -a); five runs in a row (after Task 10)                                                                                                                                                                                                                                     | Deferred (not executed) | Deferred (not executed) | Deferred (not executed) |
| `pnpm package`                                                                   | Pass: AppImage 126,602,518 bytes (120.7 MiB, after Task 10; differs by tens of bytes from build to build); `linux-unpacked/` 276 MiB; about 11 s                                                                                                                                                                                                | Deferred (not executed) | Deferred (not executed) | Deferred (not executed) |
| `pnpm test:packaged` (AppImage and `linux-unpacked/`)                            | Pass, under `xvfb-run -a` and on a display: both start (`window shown`, `bridge ready`) and close with exit code 0, no process left; `--remote-debugging-port` and `--remote-debugging-pipe` exit 1 with the refusal line, the port never accepts a connection; `app.asar` holds no test-hook code; `THIRD-PARTY-NOTICES.txt` ships; about 21 s | Deferred (not executed) | Deferred (not executed) | Deferred (not executed) |
| Fuses (`ELECTRON_RUN_AS_NODE=1 ... -e`, `NODE_OPTIONS`, `--inspect`)             | Pass: none takes effect; the app starts as itself                                                                                                                                                                                                                                                                                               | Deferred (not executed) | Deferred (not executed) | Deferred (not executed) |

Windows, macOS and the CI workflow were deferred by the owner for P1a (no push access yet): `studio.yml` was
parsed, not run. Unverified until it runs: the Linux runner's `apparmor_restrict_unprivileged_userns` step, the
macOS fuse re-signing (`resetAdHocDarwinSignature`), and that the Windows and macOS builds start with
`EnableEmbeddedAsarIntegrityValidation` and `OnlyLoadAppFromAsar` on (a missing or wrong embedded asar hash stops
the app from starting there; Linux does not check it; the smoke check is what would catch it), and the smoke
check's own Windows and macOS paths (the unpacked app's location, its stdout lines reaching the script, closing
with `taskkill` on Windows).
