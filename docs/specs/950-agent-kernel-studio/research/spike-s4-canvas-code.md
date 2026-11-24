# Spike S4: Node canvas (React Flow) and code viewer (CodeMirror 6)

**Date:** 2026-11-23  **Ran on:** Linux (WSL2) only, headless Chromium and Electron 45 under xvfb, software-rendered  **Time spent:** under 1 day

## Result

Pass with changes, and weaker than a first reading of the numbers suggests. React Flow 13.0.2 with a dagre layout in a worker stayed usable at 300
nodes in scripted input, and CodeMirror 6 gave a themed viewer, a side-by-side diff and YAML schema errors on the right line. Three things are
not a clean pass: mounting the 300 nodes stalls the main thread for 183 to 200 ms; the Code tab missed the brief's 200 ms budget on a cold open in
the built app (360 to 382 ms; 22 to 27 ms warm); and headless frame timing cannot show rendering cost, so "smooth" and the `backdrop-filter` question
need a person on real hardware.

How to read the timings. Browser numbers come from headless Chromium against the Vite dev server (dev React, unminified modules), on a
software-rendered WSL2 display. Electron numbers come from the built app under `xvfb-run`, also software-rendered. Chromium paces
`requestAnimationFrame` at 60 Hz, so frame deltas read about 16.7 ms whether the canvas is busy or idle. A frame time is therefore only reported
here next to proof that the canvas was moving (the React Flow viewport transform changed, on 63 to 67 sampled frames), and next to long tasks and
CDP `Performance.getMetrics` main-thread time, which do reflect work done.

## Pass criteria

| Criterion | Result | Evidence |
|---|---|---|
| Smooth interaction at 300 nodes | Pass with a mount stall, in a scripted software-rendered run. By eye on real hardware: not done, needs a person | `tests/canvas.spec.ts` (dev server). **Mount:** mounting the 300 nodes after the layout arrives stalls the main thread: worst frame 183 to 200 ms, 4 long tasks of 91 to 101 ms, in each of 3 runs (earlier single runs: 150 to 183 ms). The test bounds it at 500 ms. **Overview** (all 300 nodes rendered at start, each 5.5 x 2.4 px at fit-view zoom; 259 still rendered at the end after panning): 4 wheel steps in and out plus a 60-step drag-pan, viewport transform changed on 67 frames. Glass: median 16.7, p95 16.8, 4 of 183 frames over 25 ms, worst 50 ms, 1 long task (57 ms). Solid: the same shape (4 of 181 over 25 ms, worst 49.9 ms, 1 long task of 52 ms). Main-thread task time over the 3.1 s run: 1,155 ms (glass), 942 ms (solid), with script 544 and 530 ms. An earlier run had glass 1,090 and solid 1,147, so the difference is noise. **Natural zoom** (nodes 215 x 94 px, 8 rendered at start and 2 at the end; this layout is tall and narrow, so about 8 full-size nodes fit): viewport transform changed on 63 frames, 0 dropped, worst 16.8 ms, task time about 360 ms in 2.5 s, glass and solid alike. **Drag** at natural zoom: the node moved 87 px for 87 px of pointer travel, worst frame 16.8 ms. So the worst case seen was a single 50 ms frame during the 300-node overview, not a sustained 60 fps in every case. |
| Layout runs in a worker and the window stays responsive | Pass | The page requests `layout.worker.ts?worker_file&type=module` in dev and `layout.worker-*.js` in the built app (real files, not blob:). Layout of 300 nodes is 52 to 72 ms inside the worker. For responsiveness a real mouse click was sent while the worker was laying out; to make the layout overlap the click it ran under a 6x CPU throttle (CDP). The click landed when the screen showed `nodes: 0` (before the layout result arrived), toggled the "glass nodes" checkbox as intended, and Event Timing recorded an input delay of 120 ms (click) and 296 ms processing duration for it. Under the same throttle that duration is dominated by mounting the screen, not by the layout, and it is the same stall as the mount row above. Without throttling the input delay was not separately measured. |
| `backdrop-filter` (`.glass`) on 300 nodes | Not answered; the real-GPU question is open | Each run asserts that glass nodes compute `backdrop-filter: blur(16px)` and solid nodes compute `none`. Under software rendering glass and solid are indistinguishable (tables above), which proves nothing about a GPU. Also, 300 full-size nodes cannot be on screen at once: at natural zoom about 8 fit, and at the fit-view zoom where all 300 are rendered each is 5 px wide, which is a weak blur workload. The checkbox "glass nodes" exists so a person can compare on real hardware. |
| Keyboard on the canvas | Works out of the box, with a usability problem; one remedy tried | See "Keyboard" below. |
| Editor matches the tokens | Pass | `tests/code.spec.ts` "editor colours come from the tokens": editor background = `--color-surface`, text = `--color-text`, gutter = `--color-canvas`, keywords = `--color-primary`, equal to the resolved token values in both `data-theme="dark"` and `"light"` (the theme is `EditorView.theme` with `var(--color-*)`, no hex). Not checked: contrast of every syntax colour (keywords use `--color-primary` on the light surface; measure before adopting). |
| Open the 1,600-line file under 200 ms | **Cold open missed; warm open passed** | Built Electron app, click on the Code tab to first `.cm-line` visible, same in-page clock (3 fresh launches): **cold 382, 372, 360 ms; warm 25, 27, 23 ms**. The cold open includes fetching, parsing and evaluating the lazy `CodeSpike` chunk. The mount-only figures are 73 to 95 ms (cold) and 27 to 29 ms (warm), and in the dev server 38 to 40 ms; those exclude chunk loading and are not the budget measure. A minified Electron build (a one-off trial: `minify: true` on the renderer, chunk 599 kB instead of 1,185 kB) gave the same cold time (377, 365, 371 ms), so chunk size is not the main cost. The remedy (preload the chunk on idle or on hover over the tab) was not tried. |
| Scroll end to end | Pass in script, by eye: not done | Dev server: 40 scroll steps over 16 ms reached the end, 65 to 70 frames, median 16.7, worst 16.8 ms. This only shows the main thread kept up, since the frame pacing is vsync-capped. |
| Diff marks changed lines on both sides, scroll in sync | Pass after a fix | 20 chunks (`MergeView.chunks.length`). The left side shows `"n": 0` and the right `"changed": 0`, and at the 380th function the left `"n": 380` and the right `"changed": 380`; the test asserts the left side never contains the changed text. Both sides share one scroller (the merge view's own), so sync is by construction. With the default `diffConfig` it did not work (below). The viewer is read-only: typing into it leaves the text unchanged and `contenteditable="false"`. |
| YAML error on the right line within 500 ms of typing | Pass | The `ttl: "not-a-number"` line, and only that line, is flagged on load. After editing the value to `"oops"`, the error is visible 207 ms after the last keystroke (dev server), on the `ttl` line only. This used `delay: 100`; the library default (750 ms) cannot meet 500 ms. |
| YAML: does the validator coerce types? | Yes: `ttl: "30"` produces no error | `tests/code.spec.ts` types `ttl: "30"` (a quoted string, where the schema says integer): linter errors = 0. `"abc"` is still rejected. The generator (`scripts/build-session-validator.mjs`) uses `coerceTypes: true`, so the editor accepts values the schema strictly forbids. |

### Keyboard (React Flow 13.0.2)

- Defaults: Tab stops come in DOM order and edges come before nodes. Edges are focusable (`role="group"`, `aria-label="Edge from n0 to n1"`), so with
  299 edges the first node is reached on the 300th Tab press (asserted).
- A focused node has `tabindex=0`, `role="group"` and `aria-describedby` pointing at a built-in instructions node. Enter selects it (asserted).
  With a node selected, arrow keys move it (`translate(110px, 8988px)` to `translate(120px, 8988px)` after two presses) and a built-in `aria-live`
  region announces it: "Moved selected node right. New position, x: 120, y: 8988".
- Remedy tried: `edgesFocusable={false}`. The first node is then reached on the first Tab press, no edge has `tabindex=0`, and Enter still selects the
  node. What is lost: edges can no longer be reached or selected from the keyboard at all. If edges need keyboard access, a different tab-order design
  is needed (for example, edges reachable from their node); this was not tried.
- No keyboard-only way to pan or zoom the viewport was found other than the Controls buttons (not tested). Connecting, deleting and Escape were not tested.

## What differed from the plan

1. **React Flow 13.0.2 API differences from the brief's v12 code** (types checked against the installed package, plus reactflow.dev/whats-new):
   - `colorMode` prop is gone; the prop is `forceColorMode`. Color mode now follows the system by default, which would fight the app's own
     `data-theme`. The spike passes `forceColorMode` from `document.documentElement.dataset.theme` (read once; a live theme switch needs state).
   - `applyNodeChanges` is no longer exported (importing it is a type error), although the doc comment on `onNodesChange` in `index.d.ts` still
     shows it. `useNodesState` is the supported helper, and `onNodesChange` receives a `NodeChangeset` class, not an array.
   - `NodeProps` takes the node type: `NodeProps<Node<Data, 'agent'>>`, not the brief's hand-typed `{ data, selected }`.
   - Other 13 changes (store hooks `useNodesStore` etc. replacing `useStore`, `useNodeConnections`, `paneDragThreshold`) were not used by this spike.
   - The stylesheet import `@xyflow/react/dist/style.css` still works; no `xy-theme.css` was needed.
2. **The brief's canvas code was incomplete, independent of version.** Controlled `nodes` without `onNodesChange` means drag and selection do nothing
   (the first run failed the drag test with a 0 px move). Fixed with `useNodesState`.
3. **`fitView` on an initially empty node list never refits.** On the first run the viewport stayed at zoom 1 and only 19 of 300 nodes rendered, so
   "all 300 visible" had not been exercised. Fixed by mounting `<ReactFlow>` only after the layout arrives, and `minZoom={0.02}` (the default
   floor of 0.5 cannot fit a 300-node graph this wide).
4. **The 2,000-line Python file is 1,600 lines.** The brief's generator makes 400 functions of four lines each. The note and tests use 1,600.
5. **`MergeView` default `diffConfig` is `{ scanLimit: 500 }`.** On the 1,600-line file with 20 small edits it falls back to one coarse chunk that
   marks nearly everything after the first change. Reproducible with `node scripts/s4-evidence.mjs`: `Chunk.build` with no config gives 20 chunks,
   `{ scanLimit: 500 }` gives 1, `{ scanLimit: 5000 }` gives 20, and `{ timeout: 0 }` (which replaces the default config) gives 20. The spike uses
   `diffConfig: { scanLimit: 5000 }`.
6. **The merge view needs a scrolling container.** With `overflow: hidden` on the parent the merge view grew to 29,000 px and could not scroll.
   Giving the parent `overflow: auto` fixed it (one-off observation).
7. **YAML linting needed more than the brief's two lines:**
   - `yaml` 2.9.1 added (not in the brief's install list) to parse the text and give node ranges. Each Ajv error's `instancePath` is walked with
     `doc.getIn(path, true)` and the node's start offset gives the line. YAML syntax errors use `doc.errors` positions.
   - The precompiled validator checks the `session` value (the schema root is `_SessionStoreConfig`), so the linter validates
     `doc.toJS().session`, not the whole document. Task 2's validator is reused; no runtime `new Ajv().compile` (blocked by the CSP).
   - The schema's Optional fields are `anyOf [X, null]`, so one bad `ttl` produced three errors: the real one plus "must be null" and
     "must match a schema in anyOf" on the parent `redis` line. The first run flagged two lines. The linter now drops `anyOf` errors and the
     null-branch error when a deeper error exists.
   - The `linter()` default delay of 750 ms is too slow for the 500 ms criterion; `delay: 100` is used.
8. **CSP:** no change needed. In dev the worker is a real file URL from Vite; in the built app it is `out/renderer/assets/layout.worker-*.js` loaded under
   `file://`, and `tests/canvas.electron.spec.ts` shows no console or page errors while the worker, React Flow, CodeMirror and the linter run.
9. **Code splitting:** the Canvas and Code screens are loaded with `React.lazy` so their chunks can be measured. This is a change to the shell
   (`App.tsx`) the brief did not ask for. It is also what makes the cold-open cost above visible.
10. **`App.tsx` `<main>` got `minHeight: 0`** (besides `overflow: auto` and `flex: 1`) so the flex child can shrink and React Flow gets a definite height.
11. **`pnpm lint` is broken** in this repo with TypeScript 7.0.2 ("typescript-eslint does not support TS 7.0"). That predates this task and was not touched.
12. **Steps 4 and 6 ask for a person with the performance panel.** They are scripted instead (frame sampling, long tasks, CDP metrics, Event Timing); the
    human parts are listed under Result.
13. **A "edges focusable" checkbox** was added to the canvas screen to try the keyboard remedy, next to the "glass nodes" checkbox.
14. **The built Electron renderer is not minified** (electron-vite leaves it that way here), so the `pnpm build` chunk sizes below are unminified;
    the minified column comes from the same renderer built with the web config.

## Versions that worked

`@xyflow/react` 13.0.2 (12.12.0 was not needed), `@dagrejs/dagre` 3.1.3, `codemirror` 6.0.2, `@codemirror/view` 6.43.15, `@codemirror/state` 6.7.6,
`@codemirror/language` 6.13.1, `@codemirror/lang-python` 6.2.1, `@codemirror/lang-yaml` 6.1.3, `@codemirror/merge` 6.12.3,
`@codemirror/lint` 6.9.8, `@lezer/highlight` 1.2.5, `yaml` 2.9.1. All pinned exactly with `pnpm add -E`. `@codemirror/view`, `state`, `language` and
`@lezer/highlight` were added as direct dependencies because the theme code imports them; the brief listed only `codemirror` and the extension packages.

Bundle sizes (from `node scripts/s4-evidence.mjs`, after `pnpm build`; gzip -9 in brackets):

| Chunk | `pnpm build` (unminified) | Same renderer, minified |
|---|---|---|
| `CanvasSpike` (React Flow, its CSS is a separate 18 kB file, and screen code) | 427 kB (112 kB) | 249 kB (85 kB) |
| `CodeSpike` (CodeMirror, python and yaml languages, merge, lint, the `yaml` parser, screen code) | 1,185 kB (315 kB) | 599 kB (196 kB) |
| `layout.worker` (dagre) | 67 kB (19 kB) | 47 kB (16 kB) |
| `index` (rest of the app, including the Task 2 precompiled validator, which is shared and so is not in the Code chunk) | 2,408 kB (475 kB) | 1,162 kB (318 kB) |

Parts bundled separately and minified, as upper bounds (a library entry that references every export, so tree-shaking removes nothing): all CodeMirror
packages used 627 kB (182 kB gzip), the `yaml` parser 128 kB (34 kB), the validator 26 kB (2 kB). Those three sum to more than the 599 kB chunk, which shows
the in-app chunk tree-shakes, so the real Code-tab budget is the minified 599 kB (196 kB gzip), of which `yaml` is a visible part and CodeMirror the rest.
Before the lazy split the renderer was one 4,016 kB (unminified) chunk.

## Recommendation for the decision record

**D6 (canvas): React Flow 13.0.2 with dagre, layout in a worker.** At 300 nodes it stayed usable in every scripted case, layout took about 55 ms, and the
keyboard model exists out of the box. The costs seen: a 183 to 200 ms main-thread stall when 300 nodes mount, and a worst single frame of 50 ms during pan and
zoom of the 300-node overview. Dagre is sufficient at this size; it was not tried above 300 nodes or with nested groups. On `backdrop-filter`, this spike
has no result: software rendering cannot show GPU blur cost and 300 full-size nodes never share a viewport. Defaulting canvas nodes to solid
(`--color-surface`) is a judgment, not a measured finding; a GPU comparison of the "glass nodes" toggle is owed only if glass nodes are reconsidered. Plan for:
controlled-state boilerplate (`useNodesState`), `forceColorMode` tied to the app theme, tab order (299 edge stops before the first node; `edgesFocusable={false}`
fixes that but removes keyboard access to edges), and the mount stall. Pin 13.0.x exactly; it is seven days old.

**D7 (editor): CodeMirror 6 confirmed, with one budget miss.** Themed purely with the app's CSS variables, `@codemirror/merge` gives a working side-by-side
diff, and linting accepts a custom Ajv + YAML source. Nothing was missing, but four defaults need setting: `MergeView` `diffConfig.scanLimit`, a scrolling parent
for the merge view, `linter` `delay`, and filtering `anyOf` noise from pydantic-style schemas. The `yaml` package is needed alongside it. Budget about 0.6 MB
(196 kB gzipped) of minified renderer JS for the Code screen. Opening the Code tab cold in the built app took 360 to 382 ms against the brief's 200 ms (warm 22 to
27 ms), so lazy-loading alone is not enough: add a preload when idle or when the pointer is over the Code tab (not tried in this spike, so it is an untested remedy).
Decided 23 Nov 2026: strict (`coerceTypes` off), P0 D12; the validator is regenerated. What the spike found: the precompiled validator is generated with `coerceTypes: true`, which made `ttl: "30"` pass without an
error. Studio has to choose between strict validation in the editor (what the user sees matches what is on disk) and coercing the way the kernel's own loader does (not checked in this spike),
and regenerate the validator accordingly.
