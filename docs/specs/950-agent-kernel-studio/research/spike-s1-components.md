# Spike S1: Components and theming (shadcn/ui on React Aria, Spectrum 2 style, generated form)

**Date:** 2026-11-23  **Ran on:** Linux (WSL2) only  **Time spent:** under 1 day

## Result

Pass with changes — shadcn/ui on the React Aria base, restyled with Spectrum 2-measured tokens in Tailwind 4
`@theme`, covers every required component and passes all keyboard checks. The changes: `tree` is not in the
shadcn registry (written on React Aria `Tree`), the shadcn `table` needed edits to virtualise, Ajv must be
precompiled because the renderer CSP blocks `new Function`, and glass in light mode needs its own fill.

## Pass criteria

| Criterion | Result | Evidence |
|---|---|---|
| Components read as the same family as Spectrum 2 side by side | Pass by measurement, with listed gaps (below); a person has not compared them by eye | The screenshot captures (Spectrum 2 documentation in light, next to the spike in dark and light, for button, text field, picker, menu, dialog, table) are kept on branch `spike/950-studio-p0`, not in this folder; the JSON files in `spike-s1-screenshots/` are here. Measured, not only eyeballed: the same probe run on the spike (`scripts/measure-spike.mjs`, `spike-measurements.json`) gives the values in the "Spike vs Spectrum 2" table below; sizes, radii, borders, focus ring and the pressed push-in match. A person should still look at the pairs. |
| Every component matches the tokens without overriding library internals | Pass | All sizes, radii, colours come from `@theme` tokens (`h-control-m`, `rounded-control`, `px-edge`, `bg-fill-hover`, ...). Only the copied shadcn files (owned code) were edited; no React Aria internals, no `!important` overrides of library CSS. One duplication: `TableLayout` takes row heights as JS numbers (40/32), not CSS tokens. |
| Every component is keyboard-operable | Pass | `tests/components.keyboard.spec.ts` (the brief's test, unchanged): 1 passed. `tests/components.more-keyboard.spec.ts`: 13 passed — 11 keyboard tests (buttons, dialog focus trap and return, glass popover and menu, picker, 500-option combobox, tabs, table sort, tree context menu by Shift+F10, tree drag-onto-node by keyboard, resize handles, generated form) and 2 pointer tests (right-click context menu on a tree row; mouse drag of a node onto another, "moved n4 on n6"). No `test.fixme` needed. |
| No more than two components need a second primitive library | Pass (exactly two) | `resizable` uses `react-resizable-panels@4.24.1`; `sonner` (toast) uses `sonner@2.0.8`. Everything else is `react-aria-components@1.22.1`. shadcn's `sonner.tsx` also pulled in `next-themes`; removed (theme read from `data-theme`). |

Screen-reader pass (NVDA/VoiceOver/Orca): **not done — needs a person.** Replaced by accessibility-tree
snapshots (`spike-s1-screenshots/evidence.json`: dialog "Delete agent" with heading, textbox and buttons;
combobox listbox "Suggestions Model (500 options)" with named options; treegrid "Projects" with rows,
level, "Drag ..." and "Expand ..." buttons). React Aria's drag-and-drop announcements were observed in the
live region ("Started dragging. Press Tab to navigate to a drop target ...", "Drop on project-2").

Scroll smoothness by eye: **not done — needs a person.** Scripted check: 40 wheel steps of 2,400 px down the
5,000-row table; 90 wheel steps of 2,400 px from the top to the bottom (scrollHeight 200,032, final scrollTop
199,648); after each step, one animation frame later, at least 8 rows were in the viewport and the DOM never
held more than 15 rows.

Dark/light readability of floating layers: measured title-text contrast on the composited dialog fill
(ignoring scrim and blur, so a best case): solid dark 11.22, glass dark 12.57, solid light 14.8. **Glass light
with the brief's `.glass` fill: 2.67 (fails)** — the capture of it is kept on branch `spike/950-studio-p0`. After
adding a light glass fill (below): 14.8 (capture kept on branch `spike/950-studio-p0`).

## Step 2a: Spectrum 2 measurements (medium size, desktop scale)

Sources, per cell: **L** = live computed style on <https://react-spectrum.adobe.com/> (light scheme, measured
with `ak-studio-spikes/app/scripts/measure-spectrum.mjs`, raw output in
`spike-s1-screenshots/spectrum-measurements.json`); **S** = `@react-spectrum/s2@1.8.2` source (npm package,
inspected outside the repo); **T** = `@adobe/spectrum-tokens@15.9.1` `variables.json` (latest; s2 compiles
tokens in at build time and does not declare the version, so T values were cross-checked against L where
both exist and they agree). Not used from the raw output: `PickerPopover` (selector hit the wrong element),
`MenuItem` height 49 (that example item has a description; the 32 px Picker option is the base row) and
table/tree row hover (the fill is on an inner element; S is cited instead).

| Component | Height | Padding-x | Radius | Font | Border | Focus ring | Hover / pressed | Disabled / invalid |
|---|---|---|---|---|---|---|---|---|
| Button (accent/primary) | 32 (L) | 16 = height/2, "pill" (L, S) | 16 = pill (L) | 14 px / 18, 700 (L) | 0 fill; 2 for outline style (S) | 2 px solid, offset 2, keyboard only (L outline props, S `focusRing()`) | Hover/pressed: next colour stop, e.g. rgb(41,41,41) to rgb(19,19,19) (L). Pressed also pushes in: `perspective(max(h, w/3, 24)) translate3d(0,0,-2px)`, 32 px button rendered at 30.1 px (L, S `pressScale`) | Disabled: dedicated disabled background/content colours, not opacity (S `isDisabled: 'disabled'`) |
| ActionButton (quiet/ghost, menu trigger) | 32 (L) | 12 (L) | 8 (L) | 14 px, 500 (L) | 0 (L) | as above | bg gray-100 to next stop (L) | disabled colours (S) |
| TextField | 32 (L) | 12 = height x 3/8, "edge-to-text" (L, S) | 8 (L) | 14 px / 18, 400 (L) | 2 px gray-300 (L) | 2 px, offset 2, on keyboard focus (L) | Hover: border next stop rgb(218) to rgb(198) (L). Focused: border gray-900 rgb(19) (L) | Invalid: border negative; focused invalid negative-1000 (S). Disabled: border and text disabled colours (S). Default width 208 (L, S) |
| Picker | 32 (L) | 12 (L) | 8 (L) | 14 px, 400 (L) | none (filled) (L, S) | 2 px, offset 2 (L) | Hover bg gray-100 rgb(233) to rgb(225) (L); open bg gray-200 (S); pressed pushes in (L transform) | Disabled bg/text disabled (S); invalid adds an error icon and an `invalidBorder` overlay element, plus help text (S) |
| ComboBox | 32 (L) | 12 start, 4 end (button) (L) | 8 (L) | 14 px, 400 (L) | 2 px gray-300 (L, same FieldGroup as TextField) | as TextField | as TextField (L) | as TextField (S) |
| Menu / listbox item | min 32 (L option) | 0 on item, content edge-to-text (S) | 8 (L) | 14 px / 18, 400 (L) | 0 | 2 px, offset 2 (L) | Focus/hover bg gray-100 next stop rgb(225) (L) | disabled content colour (S) |
| Popover / Menu container | content | 8 inner padding (L Menu, S Popover `padding: 8`) | 10 (L) | 16 px base | 1 px outline, transparent white in light (L) | — | — | — |
| Popover shadow | — | — | — | — | — | — | `0 4px 12px rgb(0 0 0/.08), 0 2px 6px rgb(0 0 0/.04), ...` (L, first two layers) | — |
| Dialog (M) | content (528 in example) | 32 (S `paddingX: 32`; L heading 416 inside 480) | 16 (L) | title 22 px / 26, 700 (L) | none, 1 px transparent outline (L) | — | — | width S 400, M 480, L 640, XL 960 (S) |
| Tabs | item 48 (L, T `tab-item-height-medium`) | 0 (L); 24 between items (T) | 4 for the focus ring (L) | 14 px, 400 (L) | 2 px selected indicator (S, "selectedIndicator") | 2 px, offset 2 (L) | colour rgb(80) to rgb(41) hover to rgb(19) pressed/selected (L) | disabled colour (S) |
| TableView | rows 40 (L, T desktop regular); compact 32, spacious 48 (T) | 16 per cell (L) | 6 outer (L) | header 14 px 700, cell 14 px 400 (L) | 1 px gray-300 outer (L) | 2 px inset (`outlineOffset: -2`) (S) | header bg gray-75 (S) | — |
| TreeView | rows 40 (L, S `rowHeight: 40`) | indent per level (S) | 4 (L, S) | 14 px, 400 (L) | 0 | 2 px inset, offset -2 (L on tree) | hover/pressed bg = gray-25 mixed with gray-900 7%; selected 7%, selected+hover 10% (S) | disabled text gray-400 (S) |

Spacing steps (S, spacing scale with token names): 2 (50), 4 (75), 8 (100), 12 (200), 16 (300), 24 (400),
32 (500), 40 (600), 48 (700), 64 (800), 80 (900), 96 (1000). All except 2 are multiples of Tailwind's 4 px
step, so Tailwind's `--spacing` (0.25 rem) is kept and Spectrum's steps are 0.5, 1, 2, 3, 4, 6, 8, 10, 12,
16, 20, 24 of it. Relative steps: text-to-visual 6 px at 14 px (S `fontRelative(6)`), edge-to-text =
height x 3/8 (S), pill = height / 2 (S).

Type scale (T): UI 11, 12, **14** (default), 16, 18, 20, 22 px; heading XS 18, S 20, M 22, L 28; body S 14,
M 16; detail M 14; code M 16. Line height: UI text 14/18 (L); body 1.5 (T). Weights (L/S): buttons and
headings bold 700, action buttons 500, fields and items 400.

Control heights (T, S `controlSize`): XS 20, S 24, **M 32**, L 40, XL 48. Radii (T): small 4, medium 8,
large 10, extra-large 16, plus pill = height / 2.

### Spike vs Spectrum 2, measured the same way (light theme)

Spike values from `scripts/measure-spike.mjs` (`spike-measurements.json`); Spectrum values (L) from the table above.

| Element | Spectrum 2 (L) | Spike |
|---|---|---|
| Button | 32 h, 0/16 padding, 16 radius (pill), 14/18 700 | 32 h, 0/16, 9999 radius (same pill), 14/18 700 |
| Button pressed | 30.1 x 58.4 (from 32 x 62), `matrix3d(... -0.03125 ... -2, 1.0625)` | 30.1 x 82.8 (from 32 x 88), identical matrix |
| Focus ring (button, field, picker, tab) | 2 px solid, offset 2, keyboard only | 2 px solid orange, offset 2, keyboard only (mouse focus on a text field shows none) |
| Ghost / ActionButton | 32 h, 1/12, 8 radius, 500 | 32 h, 0/12, 8 radius, 500 |
| TextField | 32 h, 0/12, 8 radius, 2 px border, hover border one step darker, focused border = text colour | 32 h, 0/12, 8 radius, 2 px border 24% to 34% on hover, focused border = text colour; invalid border danger; disabled 6% border, 38% text |
| Picker | 32 h, 12 padding, 8 radius, filled, hover one step darker, pressed push-in | 32 h, 12, 8, filled 10% to 14% on hover, same push-in |
| Picker option / menu item | 32 h, 8 radius, hover fill one step | 32 h, 8 radius, 12 padding-x, hover fill 14% |
| Menu popover | 10 radius, 8 padding, 225 w in example | 10 radius, 8 padding, 1 px hairline, 144 w (min) |
| Dialog M | 480 w, 16 radius, 32 padding-x, title 22/26 700 | 480 w, 16 radius, 32 padding, title 22/26 700 |
| Tabs | 48 h item, 0 padding, 4 radius for focus | 48 h, 0 padding, 4 radius |
| Table | 6 radius, 1 px border, header 32 h 700, rows 40 h, cell padding 16 | 6 radius, 1 px border, header 32 h 700 on surface fill, cells 40 h, padding 16 |
| Tree row | 40 h, 4 radius | 40 h, 4 radius, hover fill 7% |

### Tokens added to `@theme` (first draft of the Studio's size and shape tokens)

`--spacing-control-{s,m,l,xl}` 24/32/40/48, `--spacing-edge` 12, `--spacing-pill-edge` 16,
`--spacing-text-to-visual` 6, `--spacing-row` 40, `--spacing-row-compact` 32, `--spacing-tab` 48,
`--spacing-tab-gap` 24, `--spacing-cell` 16, `--spacing-popover` 8, `--spacing-dialog` 32,
`--spacing-field-width` 208, `--spacing-dialog-m` 480, `--spacing-popover-s` 336, `--spacing-focus-ring` 2,
`--spacing-focus-gap` 2, `--spacing-border-field` 2; `--radius-sm` 4, `--radius-control` 8, `--radius-table` 6,
`--radius-popover` 10, `--radius-dialog` 16, `--radius-pill`; `--text-ui-xs..ui-3xl` 11..22 and
`--text-heading` 22/26; `--font-weight-control` 700, `--font-weight-action` 500; `--shadow-elevated`;
`--press-depth` -2px. State colours are derived from the Agent Kernel tokens with `color-mix` (Spectrum
uses dedicated disabled colours and "next colour stop" instead of opacity): `--color-fill` (10% text, the
gray-100 role), `--color-fill-hover` (14%), `--color-fill-strong` (18%), `--color-field-border` (24%,
gray-300 role) and its hover (34%), `--color-disabled-fill`/`-text`, `--color-row-hover` (7%) and
`--color-row-selected` (10%) as in S2 TreeView, `--color-focus` = primary orange. `--color-primary-hover`
(#FF4613) and `--color-on-danger` (#FFFFFF) come from `docs/src/css/custom.css` (`--ak-primary-dark`,
`--ak-fg`). Two utilities in `app.css`: `focus-ring` (2 px solid, 2 px offset on `[data-focus-visible]`) and
`press` (Spectrum's push-in on `[data-pressed]`).

## React Aria base: what shadcn lacked and how each gap was filled

| Asked for (`shadcn add`) | Result on `aria-nova` | How it was filled |
|---|---|---|
| `menu` | Not found (404) on every base (aria, base, radix) | Naming only: the component is `dropdown-menu` (React Aria `Menu`). Not a gap. |
| `tree` | Not found on every base | Written in `components/ui/tree.tsx` on `react-aria-components` `Tree`/`TreeItem`, with `useTreeData` + `useDragAndDrop` (drop on a node, before/after). |
| `table` | Present (React Aria `Table`) but not virtualised, and styled for `<table>` elements | Wrapped in React Aria `Virtualizer` + `TableLayout`; `table.tsx` edits: header/cell classes changed from `align-middle`/`[&_tr]` selectors to `flex items-center` because virtualised rows are `div`s. Sorting is React Aria's `sortDescriptor`. |
| `context-menu` | Present (React Aria `MenuTrigger trigger="contextMenu"`) | Works on a pressable trigger, but a tree row is not a child it can wrap. `context-menu.tsx` now also accepts `isOpen`/`onOpenChange`/`triggerRef`; the tree opens it from a delegated `contextmenu` event and from Shift+F10 / the ContextMenu key on the focused row. |
| `resizable` | Present, but on `react-resizable-panels` (React Aria has no splitter) | Second library 1 of 2. Keyboard-resizable (arrow keys on the separator). |
| `sonner` | Present, but on `sonner` + `next-themes` (React Aria's Toast is `UNSTABLE_`) | Second library 2 of 2. `next-themes` removed. |
| `command` | Present, built on React Aria `Autocomplete` + `Menu` in the shadcn `Dialog` | Used as is (restyled). |
| `combobox`, `select`, `dialog`, `popover`, `tabs`, `tooltip`, `input`, `button` | Present, React Aria | Restyled. `select` is the Picker. |
| Tag | No `tag-group` in the aria registry | `badge` restyled as a static tag (24 px, 8 px radius). React Aria `TagGroup` would be the interactive version. |

## What differed from the plan

- `shadcn init --template vite --base aria --cwd . --yes` stopped at an interactive preset prompt; `--yes` does
  not skip it. Added `--preset nova` (style becomes `aria-nova`). Then it failed "could not detect a supported
  framework": electron-vite has no `vite.config.*`. Fixed by adding a root `vite.config.ts` (renderer root,
  React + Tailwind plugins, `@`/`@renderer` aliases) that `electron.vite.config.ts` also imports for its
  renderer, plus `paths` for `@/*` in the root `tsconfig.json` and `tsconfig.web.json`, and a pre-created
  `styles/app.css` with `@import "tailwindcss"`. After that `init` detected Vite and Tailwind v4 and wrote
  `components.json` pointing at `src/renderer/src/styles/app.css`.
- `pnpm dev:web` changed from `vite src/renderer --port 5180` to `vite --config vite.config.ts` (the shared
  config sets root and port), so the browser renderer now has the React plugin and Tailwind too. Vite 8 warns
  that the config uses ESM in a CJS-typed package (harmless for now).
- `init` and `add` wrote caret ranges for 7 runtime packages (and `next-themes`); all were pinned by hand.
  `init` also installed `@fontsource-variable/geist`; replaced by Archivo (`@fontsource-variable/archivo`) and
  JetBrains Mono, the Agent Kernel fonts.
- shadcn 4.23 generates `import { cn } from "cn"` (shadcn's own `cn` package replacing clsx + tailwind-merge)
  directly in every aria component, and `lib/utils.ts` only re-exports it. **Finding:** `cn` knows only
  Tailwind's default scales, so with the Spectrum tokens it merged classes wrongly: it treated `text-ui`
  (size) and `text-text` (colour) as one group and dropped the size, and kept both `rounded-pill` and
  `rounded-control` (the ghost button measured 9999 px radius and 16 px padding instead of 8 and 12).
  Fixed by `lib/utils.ts` = `createCn` from `cn/config` with the custom theme keys (text, radius, spacing,
  font-weight, shadow), and by pointing every component's import at `@/lib/utils`. The Studio needs this
  config next to the tokens and has to keep it in sync with them.
- The first `focus-ring` utility also matched `:focus-visible`; browsers match that on a text input after a
  mouse click, so a ring showed on pointer focus. It now uses React Aria's `[data-focus-visible]` only.
- Brief's `add` list: `menu` and `tree` do not exist (see table); ran `add` with `dropdown-menu` and without
  `tree`, plus `badge` for the tag.
- Name clash: the brief's tokens `--color-primary`, `--color-muted`, `--color-border` have the same names
  as shadcn's. The generated `@theme inline` block was kept but remapped onto the Agent Kernel tokens
  (`--color-background: var(--color-canvas)`, `--color-popover: var(--color-overlay)`, ...) and the three
  clashing names were left to the brief's values. shadcn's `muted` is a fill and Agent Kernel's is a text
  colour, so every generated `bg-muted` would paint #9FB3CC; these were rewritten (button, badge, combobox
  chip, command item, dialog footer, table row/footer, tabs list; `grep bg-muted components/ui` now finds
  none). `input-group.tsx` used `var(--radius)`, which the remapped theme no longer defines, so those radii
  computed to nothing; replaced with `rounded-sm`. `@custom-variant dark` was moved from
  `.dark` to `[data-theme="dark"]`.
- Step 3 palette check: `grep -c "text-blue-500" out/renderer/assets/*.css` = `0`. Default-palette classes
  in the generated components that now produce no rule: `bg-black/10` (dialog scrim; replaced with a
  `--color-scrim` token). No other palette classes were generated; the rest use semantic names.
- Ajv (D12): runtime `ajv.compile` fails in both the browser and Electron with "Evaluating a string as
  JavaScript violates the following Content Security Policy directive ... script-src 'self'". The CSP was
  not loosened; the validator is precompiled with Ajv standalone code (`scripts/build-session-validator.mjs`
  writes `spikes/session.validate.gen.js`, 125 kB for the session slice with all `$defs`).
- CSP also blocked fonts in the built app: Vite inlined small font files as `data:` URIs. Fixed with
  `build.assetsInlineLimit` returning false for font files instead of adding `data:` to the CSP.
- `.glass` in light mode: the brief's single navy glass fill gives 2.67:1 for the light theme's text. Added
  `[data-theme="light"] .glass { background: rgb(255 255 255 / 0.72) }` (14.8:1).
- Removed the unused template CSS and SVGs in `src/renderer/src/assets/`.
- Checked both run paths with the shared config: `pnpm exec electron-vite dev` (renderer on :5173 in
  Electron: table, tree and Archivo font render, 0 console errors) and the built app via Playwright
  `_electron` (table, tree, Ajv error on blur, command palette; 0 console errors after the font fix).
- Step 8 manual checks were replaced by scripts (`scripts/s1-evidence.mjs`), per the controller's ruling.

## Restyle: where it could not match Spectrum 2, and why

- Typeface: Archivo instead of Adobe Clean (on purpose); Archivo runs slightly wider, so labels are wider.
- Colour: Agent Kernel navy/orange; focus ring is orange (Spectrum blue). Hover/pressed "next stop" is
  approximated with `color-mix` percentages of the text colour because Agent Kernel has no grey ramp.
- Primary button: Spectrum's default "primary" is a neutral dark fill and its "accent" is blue; the spike's
  primary is the orange accent fill.
- Menus: no section headings, descriptions or checkmark column in the spike's examples; Spectrum's popover
  is wider (225 px in the example, ours `min-w-36` 144 px).
- Dialog: the shadcn dialog keeps its close "X" icon button and a flatter header; Spectrum's example has a
  hero image and `ButtonGroup` alignment.
- Table: header fill uses `--color-surface`, which in light mode (#F5F8FC) is barely distinct from white.
- Combobox input text sits a few px further right than Spectrum's (inner input padding inside the group).
- Unused variants of the generated components (combobox chips, sub-menus, kbd) still carry shadcn defaults
  (`text-sm`, `shadow-lg`, `rounded-sm`); Tailwind's default font sizes and shadows were not removed, only
  colours.
- Pressed push-in uses a fixed `perspective(32px)` (control height) instead of Spectrum's per-element
  `max(h, w/3, 24)`, which needs the element's measured size.

## D12: generated form

`spikes/SchemaForm.tsx` renders `session` from `session.schema.json` (dumped with the brief's `uv run`
command; 96 `$defs`). `$ref`s are resolved, one field per property, `description` as help text, `default`
shown and used as the initial value, React Hook Form with a custom Ajv resolver in `mode: 'onBlur'`.

- Unions: every `anyOf` in this slice is pydantic's `Optional[Model]` = `anyOf [$ref, {type: null}]`
  (`cache`, `redis`, `valkey`, `dynamodb`, `cosmosdb`, `firestore`). Rendered as an opt-in section (checkbox
  "configure"; off = `null`). A generic renderer cannot know better; a real union (two object types) would
  need a per-field override. Ajv reports a nested error three times (the leaf, "must be null", "must match a
  schema in anyOf" on the section), so the resolver keeps the deepest error per path.
- Nested objects (`connection_store`, the optional sections) came out as fieldsets with their own fields.
- Everything here is a string or integer; integers needed `coerceTypes` and a number conversion on change.
  `type` is a free string with the allowed values only in its description (no `enum`), so it renders as a
  text field; a Picker needs a per-field override or an `enum`/`Literal` in the Python model.
- Verdict: generic rendering works for this slice with two override points (union/Optional presentation,
  enum-like strings), so the real `SchemaForm` needs a small per-field override map, not a hand-written form.

## Versions that worked

tailwindcss 4.3.5, @tailwindcss/vite 4.3.5, shadcn 4.23.0 (CLI and `shadcn/tailwind.css`, style
`aria-nova`), react-aria-components 1.22.1 (react-aria 3.53.1, react-stately 3.51.0), cn 0.5.2,
class-variance-authority 0.7.1, lucide-react 1.77.0, tw-animate-css 1.4.0, react-resizable-panels 4.24.1,
sonner 2.0.8, react-hook-form 7.92.0, ajv 8.20.0 (`ajv/dist/2020` + standalone), @playwright/test 1.65.1
(chromium 1255), @fontsource-variable/archivo 5.3.0, @fontsource/jetbrains-mono 5.3.0. With Task 1's
electron 45.4.1, electron-vite 6.0.0, vite 8.3.8, typescript 7.0.2, React 19.3.0. Reference read:
@react-spectrum/s2 1.8.2, @adobe/spectrum-tokens 15.9.1 (not dependencies).

## Recommendation for the decision record

- **D1: shadcn/ui on the React Aria base.** It covered tree, virtualised sortable table, drag and drop,
  context menu, combobox and command palette under one keyboard and accessibility model; only splitter and
  toast use other libraries (two, within the limit). Expect to own two files shadcn does not provide or does
  not finish: `tree.tsx` and a virtualised `table.tsx`. Base UI fallback not needed.
- **D2: Tailwind CSS 4 with tokens in `@theme`**, default palette removed (`--color-*: initial`), shadcn's
  semantic names mapped onto the Agent Kernel tokens, and the Spectrum 2 size/shape table above as the
  starting token set for the P1a design gate. Keep a CSP-safe build: no runtime code generation, fonts as
  files.
- **D12: React Hook Form + Ajv (2020-12), with validators precompiled by Ajv standalone at build time**
  (runtime compile is blocked by the CSP; validating in main is the other option). Generic JSON-schema
  rendering plus a per-field override map for unions/Optional sections and enum-like strings.
- Design gate inputs: solid and glass floating layers are both built; glass needs a separate light-mode
  fill to stay readable.
