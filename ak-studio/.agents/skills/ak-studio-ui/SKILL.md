---
name: ak-studio-ui
description: >
  The user interface rules of Open Agent Kernel Studio (OAK Studio, `ak-studio/`): the ground rules (one component
  per meaning, visual, copy and behaviour rules), the UX pattern catalogue with the Storybook file that shows each
  built pattern and the connected wrapper a feature uses, and how to add or change a component in
  `ak-studio/packages/ui` (the shadcn CLI and MCP server, role tokens, stories with their required names, axe in
  both themes, visual baselines, the check-classes rules, `mono-literal`). Use this skill before building or
  changing any screen, component or copy in `ak-studio/`, and when check-stories, check-classes, check-palette, a
  Storybook play function, axe or a visual comparison fails.
license: Apache-2.0
metadata:
  author: yaalalabs
  category: developer
---

# OAK Studio user interface

This skill is the maintained source for the Studio's ground rules and pattern catalogue. Sections 1 and 2 of
`docs/specs/950-agent-kernel-studio-phase-1/implementation/conventions-and-skills.md` are the frozen design record
they grew from; where they differ, this skill and the code win. A change to a rule is made here, in the same PR as
the code that follows it. A screen that needs a pattern not listed here adds it through the design gate
(`docs/specs/950-agent-kernel-studio-phase-1/implementation/design-process.md`) first.

Paths are relative to `ak-studio/`; commands run from `ak-studio/`. Related skills: `ak-studio-architecture`
(where data comes from) and `ak-studio-new-feature` (building a feature's screen).

## 1. Ground rules

### One component per meaning

| Meaning                                                               | Always use                                                                | Never                                  | Built                                 |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------- | -------------------------------------- | ------------------------------------- |
| The state of something (passed, running, failed, waiting, not set up) | `StatusChip` (`packages/ui/src/components/status-chip.tsx`)               | A coloured word, a bare dot, a `Badge` | Yes                                   |
| A file or folder path                                                 | `PathChip`                                                                | Plain text, a link                     | Yes                                   |
| A secret                                                              | `SecretChip` (name and where it is stored)                                | Anything that could show a value       | No (P4)                               |
| A command the app ran                                                 | `CommandRow`                                                              | A code block                           | Yes                                   |
| Something made or offered by the coding agent                         | The AI style: Button's `ai` variant, `BuildWithAIButton`; `AIBadge`       | The AI colour on anything else         | Button variant yes; `AIBadge` no (P6) |
| A feature the project's version lacks                                 | `CapabilityGate` (`apps/renderer/src/shared/patterns/CapabilityGate.tsx`) | A disabled control with no reason      | Yes                                   |
| Anything that needs an explicit yes                                   | The approval pattern (`ctx.confirm` in the job, shown by `JobProgress`)   | A plain confirm dialog                 | Yes                                   |
| A long operation                                                      | The job pattern (`JobProgress`)                                           | A spinner with no label                | Yes                                   |

An unbuilt component is added through the design gate in the phase that first needs it, never improvised.

### Visual rules

- **Style.** Sizes, density, states and spacing resemble React Spectrum 2 (medium: 32 px controls, 40 px rows,
  14 px base text, 48 px top bar), expressed as the Studio's tokens. When a new component has no precedent, look
  at how Spectrum 2 sizes and states its equivalent.
- **The brand wins where it is explicit** (`branding/README.md` at the repository root). OAK's colours. Controls
  (buttons, inputs, tags, chips, badges) use `rounded-control` (8 px), never a pill; cards and panels
  `rounded-card` (16 px). The window controls are the one exception: square, 40 px wide, the bar's full height.
  The logo mark is used as supplied.
- **Role tokens only.** Tailwind's default palette is removed in `packages/ui/src/theme.css`, so `text-blue-500`
  does not exist. Use the roles: surfaces `bg-surface`, `bg-surface-raised`, `bg-surface-overlay`; text
  `text-text`, `text-text-muted`, `text-text-accent-primary`, `text-text-accent-ai`,
  `text-text-status-success|warning|danger`; fills `bg-accent-primary`, `bg-accent-ai`, `bg-status-*` with their
  `text-on-*`; borders `border-border-control` and `border-border-default` (decorative dividers only); the
  `focus-ring` utility. The naming is documented at the
  top of `theme.css`.
- **No arbitrary values** (`p-[13px]`, `gap-(--x)`) and no inline colour styles. Spacing uses Tailwind's 4 px numeric
  scale (`gap-4`, `p-8`, `w-80`) plus the named keys in `theme.css` (`control-m`, `row`, `edge`); type uses only the
  steps in `theme.css` (`text-ui-xs` to `text-ui-3xl`, `text-heading`). `check-classes` refuses anything else.
- **Layout without arbitrary values.** Label and value rows: a flex row per item, the label `w-32 shrink-0` and the
  value `min-w-0 flex-1 wrap-anywhere`; or a grid with a numeric template (`grid grid-cols-2`, `grid-cols-3`), never
  `grid-cols-[...]`. A long value wraps only when its box may shrink: `min-w-0` on a flex or grid child (its default
  minimum is its content's width) and a wrap utility on the text. **The wrapping rule:** a value (a path, command,
  identifier, token, URL, anything pasted) gets `wrap-anywhere`, as `CommandRow` and `SessionControl` do: it breaks
  a string with no spaces, and those breaks count toward the box's minimum width, so it wraps even in a box sized
  to its content. Prose (a sentence, a message) gets `break-words`: it breaks a word only when the word alone
  overflows, and the box stays at least one word wide. A fixed width comes from the scale
  (`w-80` is 320 px). A `<dl>` holds its `dt` and `dd` directly (as `InfoSection`'s grid in `AboutScreen.tsx`
  does) or wraps each item's `dt` and `dd` in one `div` (for a flex row per item); both are valid HTML, any other
  child is not.
- **Colour roles are fixed:** primary for the primary action, focus and selection; the AI colour for the coding
  agent only; success, warning and danger for states. State is never colour alone: an icon or label goes with it.
- **Floating layers** (menus, popovers, modals, toasts) and docked surfaces are solid, not glass.
- **One primary action per view.** Everything else is secondary, outline or ghost.
- **Icons** are Tabler outline icons from `@tabler/icons-react` (Biome refuses `lucide-react`), at 16 px (the
  default) or 20 px (`size-5`), always `aria-hidden`: the control around the icon carries the name. No emoji.
  Storybook fails any story that shows another size.
- **Type.** Inter for UI text (`font-ui`, the default), Archivo for headings and the primary button's label
  (`font-heading`), JetBrains Mono for code. All bundled.
- **Monospace** for paths, commands, code, identifiers, durations, token counts and money: `mono-literal` for text
  people copy or retype (commands, code, paths, identifiers; ligatures off, so `>=` never draws as one glyph),
  `mono-figures` for numbers (tabular digits).
- **Scroll containers are positioned.** Every element with `overflow-auto` or `overflow-scroll` is also
  `relative`, so absolutely positioned helpers inside it (React Aria's visually hidden inputs, `sr-only` live
  regions) are anchored to it and never push the window into scrolling. Only the content area scrolls, never the
  window: the browser end-to-end test "no tab makes the window itself scroll" (`tests/e2e/browser.spec.ts`) guards it.

### Copy rules

- Sentence case everywhere in the app.
- The product: "Open Agent Kernel" where the full name is read (window and installer titles: "Open Agent Kernel
  Studio"), "OAK" everywhere else, "OAK Studio" in the compact interface. The company is not named in the app.
  Identifiers keep their form: `agentkernel`, `ak`, `AKConfig`, `AK_*`, `.akstudio/`, the `ak-*` skills.
- The coding-agent feature is "Claude Agent". The Studio never calls itself or its feature "Claude Code"; "Claude
  Code" names only the user's installed program ("Sign in to Claude Code"). Raw agent error text is never the
  message.
- OAK's own words: handoff, pre-hook, post-hook, session store, guardrail, execution mode, message type, sandbox
  profile.
- Buttons say what happens: "Apply plan", not "OK". Destructive buttons name the thing: "Destroy deployment".
- Errors say what happened, then what to do next. Never "Something went wrong".
- Empty states say what the place is for and offer the first action.
- No placeholder copy ships (no "TODO", "lorem", "placeholder").
- English only in Release 1. Copy lives in one strings module per feature (`features/<name>/strings.ts`), per
  runtime feature service (beside it), and per package (`packages/ui/src/strings.ts`). Components in `packages/ui`
  take their words as props; they never hard-code feature copy. A component's own defaults follow the convention in
  "Copy defaults" (section 3).

### Behaviour rules

- **Feedback timing:** nothing under 300 ms; then a pending state on the control (`showPending` from the shared
  hooks, `usePendingAfter`) or a skeleton for content; a labelled job for anything expected to pass one second; a
  cancel control for anything that can run over ten seconds. The shared hooks apply the timing; screens do not
  choose it.
- **Keyboard:** every action is reachable. Shortcuts are declared in manifests (`shortcut` on `defineCommand`,
  `Mod+J` form) and shown in the command palette; a clash fails `apps/renderer/src/app/registry.test.ts`.
- **Composite widgets have a written keyboard model** at the top of their file (`data-table.tsx`, `tree.tsx`) and a
  scripted keyboard story.
- **Focus** moves into a modal or popover when it opens and back to its trigger when it closes; never lost to the
  page body. Every modal goes through `Modal` (app shortcuts pause while one is open).
- **Nothing is lost silently.** A view with a working copy mounts `UnsavedChangesGuard`; a file changed outside the
  app shows `ChangedOnDisk`.
- **Motion:** 150 ms for hover and focus, 250 ms for panels, nothing ambient except progress; honour reduced motion
  (`motion-reduce:`).
- **Layout** holds at 1100 px wide; nothing scrolls the page sideways.

## 2. The pattern catalogue

Every screen is assembled from these. A feature uses the **connected wrapper** in
`apps/renderer/src/shared/patterns/` (it reads the stores and runs commands); the presentational view in
`packages/ui` is what its stories show. Story files are under `packages/ui/src/components/` unless a path is given.

| Pattern               | Use when                                                                                                | Wrapper a feature uses                                                                                             | Stories                                                                                  | Built                     |
| --------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- | ------------------------- |
| Shell and tabs        | Always, inside a project. Tabs are business areas; no left navigation                                   | The app shell (`apps/renderer/src/app/shell/Shell.tsx`); a feature adds a `tab` to its manifest                    | `desktop-shell.stories.tsx`, `top-bar-controls.stories.tsx`, `status-bar.stories.tsx`    | Yes                       |
| Inspector             | Something is selected on a canvas or list                                                               |                                                                                                                    |                                                                                          | No (P3)                   |
| Master and detail     | Lists with detail                                                                                       |                                                                                                                    | Parts only: `data-table.stories.tsx`, `tree.stories.tsx`, `resizable-panels.stories.tsx` | No                        |
| Schema form           | Editing a `config.yaml` section                                                                         | `SchemaForm` (`apps/renderer/src/shared/forms/SchemaForm.tsx`)                                                     | `apps/renderer/src/shared/forms/SchemaForm.stories.tsx` (provisional until the P3 gate)  | Provisional               |
| Command palette       | Finding any action                                                                                      | Mounted by the shell (Mod+K); a feature only declares commands in its manifest                                     | `command-palette.stories.tsx`                                                            | Yes                       |
| Job progress          | Any job: title, step, elapsed time, Stop, "Show commands", then a result or an error                    | `JobProgress`, `JobProgressList`                                                                                   | `job-progress.stories.tsx`                                                               | Yes                       |
| Session control       | Anything long-lived: state, start and stop, key facts, a log link                                       | `SessionControl`                                                                                                   | `session-control.stories.tsx`                                                            | Yes                       |
| Approval              | A job is `waiting-for-user`: what will happen and what it affects; destructive ones need the name typed | Rendered by `JobProgress` from the job's request (`Approval`); the runner asks with `ctx.confirm`                  | `approval.stories.tsx`, `confirm-modal.stories.tsx`                                      | Yes                       |
| Background job notice | A job finishes or needs an answer while the user is elsewhere: a tab badge and a toast with "Show"      | Bound by the shell (`useBackgroundJobNotice`); a feature lists its kinds in the manifest's `jobs` and names `show` | `background-job-notice.stories.tsx`                                                      | Yes                       |
| Streaming list        | Logs, command output, agent events: follows the end, "Jump to latest", bounded, copy and clear          | `StreamingList`                                                                                                    | `streaming-list.stories.tsx`                                                             | Yes                       |
| Command row           | A command the app ran                                                                                   | `CommandRow` (from `@ak-studio/ui`)                                                                                | `command-row.stories.tsx`                                                                | Yes                       |
| Changed on disk       | A file the view shows changed outside the app: a non-blocking banner; Keep mine, Take theirs, Compare   | `ChangedOnDisk`                                                                                                    | `changed-on-disk-banner.stories.tsx`                                                     | Yes                       |
| Unsaved changes guard | Leaving, closing or quitting with a working copy: names what is unsaved; save, discard or stay          | `UnsavedChangesGuard` (one dialog for every unsaved view)                                                          | `unsaved-changes-dialog.stories.tsx`                                                     | Yes                       |
| Undo and redo         | Edits on the canvas and in forms                                                                        |                                                                                                                    |                                                                                          | No (P5)                   |
| Version gate          | A feature the project's version lacks: the version that adds it and the upgrade command                 | `CapabilityGate`                                                                                                   | `version-notice.stories.tsx`                                                             | Yes                       |
| Empty state           | A view with nothing in it yet: what it is for, plus the first action                                    | `StateMessage`, `EmptyState` (from `@ak-studio/ui`)                                                                | `state-message.stories.tsx` (`Empty`), `empty-state.stories.tsx`                         | Yes                       |
| Cannot read           | A file cannot be parsed: names the file and line, shows partial results                                 | `ErrorView` with an error that has `file` and `line`                                                               | `state-message.stories.tsx` (`CannotRead`, `CannotReadPartial`)                          | Yes                       |
| Error                 | Any `StudioError`, placed by its code                                                                   | `ErrorView` (`apps/renderer/src/shared/patterns/ErrorView.tsx`)                                                    | `state-message.stories.tsx` (`ErrorState`, `ErrorPartial`), `toast.stories.tsx`          | Yes                       |
| Interrupted job       | A job an earlier run left unfinished                                                                    | `InterruptedJobs` with the feature's job kinds                                                                     |                                                                                          | Yes (no story of its own) |
| Pending change review | Changes made by the coding agent: a diff per file, accept or revert per turn                            |                                                                                                                    |                                                                                          | No (P6)                   |
| Feedback placement    | Reporting a result: inline for a field, a banner for a view, a toast only for background work           | `ErrorView`'s `placement`; `InlineBanner`                                                                          | `inline-banner.stories.tsx`, `toast.stories.tsx`                                         | Yes                       |

The About screen (`apps/renderer/src/features/about/screens/AboutScreen.tsx`, stories in
`AboutScreen.stories.tsx`) uses most of these together: read it to see the wrappers wired to real hooks. It is
throwaway: read it, do not import from it.

## 3. Adding or changing a component in `packages/ui`

`packages/ui` is presentational: no `@ak-studio/contract` import, no data access, no imports from `apps/`. A
component is changed here and nowhere else; features compose components and do not restyle them with one-off
classes.

### Where it starts

- **From shadcn** (a component shadcn has for React Aria): add it with the pinned CLI, never `npx` or
  `pnpm dlx shadcn@latest`:

  ```bash
  pnpm --filter @ak-studio/ui exec shadcn add <name>
  ```

  `packages/ui/components.json` configures it: style `aria-nova` (React Aria base), Tailwind 4 with
  `src/theme.css` as the CSS entry and no Tailwind config file, Tabler icons, and the aliases
  `@ak-studio/ui/components`, `@ak-studio/ui/lib/utils`, `@ak-studio/ui/lib` and `@ak-studio/ui/hooks`, which
  resolve to `src/` through the `paths` in `packages/ui/tsconfig.json`. `pnpm --filter @ak-studio/ui exec shadcn info`
  prints the resolved paths and the components already added. After `add`:
  - shadcn writes `import { cn } from "cn"` and imports through the `@ak-studio/ui/...` aliases. Point them at
    relative paths (`../lib/utils`): `lib/utils.ts` configures `cn` with the Studio's theme keys, and
    `lib/utils.test.ts` fails while a component imports `cn` directly.
  - Pin any dependency it added (exact version, no `^` or `~`).
  - Restyle it to the tokens and Spectrum 2 medium; take state colours from `src/lib/state.ts` and shared class
    recipes from `src/lib/styles.ts`.
- **From nothing:** `pnpm new:component <name> [--group Controls|Display|Overlays|Structure|Patterns]` writes
  `src/components/<name>.tsx` (`<Name>` and `<Name>Props`), its stories under `<Group>/<Name in sentence case>`, and
  the exports in `src/index.ts`. The group defaults to Display. It does not touch `src/strings.ts`: add the copy
  defaults by hand ("Copy defaults").
- Either way, export the component and its props type from `packages/ui/src/index.ts`, and put its English
  defaults in `src/strings.ts` as below.
- The generated component is a stub too: `<Name>Props = HTMLAttributes<HTMLDivElement>` and a `<div>` root with
  `data-slot="<name>"`. Keep `data-slot` (stories find the root by it) and `cn(..., className)`, and change the
  props type with the root: a `<dl>` root takes `HTMLAttributes<HTMLDListElement>`, and a component whose content
  comes from its own props (an `items` list) drops `children`:
  `Omit<HTMLAttributes<HTMLDListElement>, "children"> & { items: ... }`.
- The generated stories are stubs to replace, not extend: the meta's `args: { children: ... }` and the `Default`
  story fit the generated `<div>`, not your props. Rewrite the meta's `args` for the real props (the typecheck fails
  otherwise) and the `Default` story for the real default state.

### Copy defaults

Every component that shows words of its own (a button label, an empty text, "Not set") does it the same way, as
`CommandRow` (`src/components/command-row.tsx`) does:

1. In `src/strings.ts`: the English defaults in `uiStrings` under the component's camelCase key
   (`commandRow: { ... }`), and its type beside the others,
   `export type CommandRowStrings = { -readonly [K in keyof typeof uiStrings.commandRow]: string };`. The keys are
   not alphabetical: they run in about the order the header comment names the components (in prose, not a
   list), with the shell's parts last (`shell` to `statusBar`, `buildWithAI` and `settings` among them). Put a new
   key beside related ones (a shell part among the shell's), otherwise after `versionNotice`, before `shell`, and
   name the component at the same place in the header's sentence.
2. In the component: a `strings?: Partial<CommandRowStrings>` prop ("Overrides of the default copy"), merged over
   the defaults with `const text = { ...uiStrings.commandRow, ...strings };`, and only `text.*` rendered.
3. In `src/index.ts`: export the `<Name>Strings` type beside the other `...Strings` types from `./strings`.

A few older single-label components take one named prop instead (StatusChip's `label`, Combobox's `emptyText`); a
new component uses `strings`. A component that shows a not-set text for a missing value shows it for `""` too
(`value === undefined || value === ""`), so an empty value never renders as a blank; a story covers both.

### The shadcn MCP server

The repository's `.mcp.json` (at the repository root, so a session started there sees it) declares a `shadcn`
server that runs the pinned CLI against `packages/ui`: `pnpm --silent --dir ak-studio/packages/ui exec shadcn mcp`
(`--silent` keeps pnpm's own lines off the protocol's stdout). Your
client asks before it starts a project server the first time. Use it to search the registry, view a component's
files and examples, and run the audit checklist. Its "add" tool answers a `pnpm dlx shadcn@latest add ...` command:
do not run that; run the pinned command above instead. It holds no credentials.

### Stories

- Every file in `src/components/` has a `<name>.stories.tsx` beside it with at least one story (`pnpm check-stories`).
  A component shown only inside another's stories is listed under `coveredBy` in `tools/story-requirements.json`;
  an internal part with no stories under `exempt`, with the reason.
- **Required story names.** A pattern's design-gate states are listed under `required` in
  `tools/story-requirements.json` (for example `job-progress.tsx` must export `Running`, `Waiting`, `Failed`, ...,
  `Keyboard`). When you add a pattern, add its entry with the states the gate signed off.
- One story per state: default, hover, focus, disabled, invalid, read-only where they apply, and a `Keyboard`
  story for anything with a keyboard model. Each `play` function proves its state was reached, using the helpers
  in `src/lib/story-checks.ts` (`hover`, `tabTo`, `expectFocusRing`, `expectHeight`, `expectSolidLayer`,
  `expectTokenColour`, `expectNoOverflow`, ...), and checks the Spectrum 2 measurement that matters (32 px
  controls, the 2 px focus ring 2 px away). A font utility (`mono-literal`, `mono-figures`, `font-heading`) is
  checked by its class, `await expect(value).toHaveClass("mono-literal")`: that is enough, since `theme.css` defines
  what each one does, once.
- Storybook (`packages/ui/.storybook/`) indexes `packages/ui/src` and the renderer's stories. `pnpm test:storybook`
  runs every story in headless Chromium in both themes with axe (`a11y: { test: "error" }`), and the icon-size
  check after each. A violation fails the story; fix the component, do not disable the rule.
- A story that needs a fixed-width frame (a long value at 320 px) wraps the story in a decorator with a width from
  the scale: `decorators: [(Story) => <div className="w-80"><Story /></div>]`; no inline style. Its `play` proves
  the value wraps with `await expectNoOverflow(el)` (`el` the component's root): nothing past its right edge and
  nothing to scroll sideways, in it or in the page, as the `List` story in `command-row.stories.tsx` does. Do not
  write `scrollWidth` checks by hand.
- Shell-sized stories set `parameters.fullBleed` and a viewport (`parameters.viewport` and `globals.viewport`).
  Screen stories in the renderer use `MockApp` (`apps/renderer/src/test/MockApp.tsx`) with a `FakeClock` from a
  loader, as `AboutScreen.stories.tsx` does, so time only moves when a play function moves it.

### Visual baselines

- `pnpm test:visual` builds Storybook and photographs every story, dark and light, against the baselines in
  `tests/visual/__screenshots__/linux/` (`<story id>-<theme>.png`). Linux only.
- A new story has no baseline: run `pnpm test:visual --update-snapshots=missing`, look at each new image, and
  commit them. After an intended change to an existing story: `pnpm test:visual --update-snapshots`, then review
  every changed image before committing. Never commit a baseline you have not looked at.
- **Running the long suites.** Run them in the background with output to `.logs/` (committed empty: git ignores
  everything in it but its `.gitkeep`), named for your run so parallel runs never share a file. End the command
  with an exit line and wait for that line: `pnpm test` runs several vitest runs, each with its own `Test Files`
  summary, so the first summary is not the end, and a run that crashes prints none.

  ```bash
  ( pnpm test:storybook; echo "exit code $?" ) > .logs/<worktree>-storybook.log 2>&1 &
  until grep -q '^exit code ' .logs/<worktree>-storybook.log; do sleep 15; done
  tail -n 25 .logs/<worktree>-storybook.log
  ```

  Then read the summary: vitest's `Test Files  1 failed | 105 passed (106)` and `Tests  ...` (the last pair is the
  last run's), Playwright's `120 passed (5.2m)` with any `failed` count above it, and `exit code 0`.

  | Command                          | Quiet (12 cores, nothing else running) | Loaded (other runs share the machine) |
  | -------------------------------- | -------------------------------------- | ------------------------------------- |
  | `pnpm lint`, `pnpm typecheck`    | 5 to 30 seconds each                   | up to 1.5 minutes each                |
  | `pnpm test`                      | 45 seconds to 2 minutes                | 3 to 5 minutes                        |
  | `pnpm test:storybook`            | 1 to 2 minutes (`--maxWorkers=2` too)  | 3 to 5 minutes                        |
  | `pnpm build-storybook`           | under 10 seconds                       | under 30 seconds                      |
  | `pnpm test:visual:run`           | 5 to 6 minutes                         | 10 to 15 minutes                      |

  `pnpm test:visual` rebuilds Storybook and then runs `pnpm test:visual:run`, which reuses the last build: after
  changing only a story's code, rebuild (`pnpm build-storybook`) before `test:visual:run`. A subset runs with
  `-g`: `pnpm test:visual:run -g "screens-about|patterns-command-row"`.
- **When many tests time out at once**, the machine is usually overloaded: check `uptime` (a load average
  well above the core count, `nproc`) and rerun with fewer workers. From `ak-studio/`, arguments after a script
  name reach vitest or Playwright (no `--`): `pnpm test:storybook --maxWorkers=2`, `pnpm test:visual --workers=2`
  or `pnpm test:visual:run --workers=2`. A single story file: `pnpm test:storybook src/components/<name>.stories.tsx`
  (the path from `packages/ui`). A single story, screenshot or renderer test (the Shell tests most often) that
  times out or fails once: rerun it alone (`pnpm test:visual:run -g <story id>`, for example
  `-g patterns-streaming-list--following`) before concluding anything.
- **"No other baseline changed"** is checked with `git status`: after a run with `--update-snapshots`, the only
  modified or new files under `tests/visual/__screenshots__/` are the stories you meant to change.

### What check-classes and check-palette refuse

`pnpm check-classes` reads the `.ts` and `.tsx` under `apps/renderer/src` and `packages/ui/src`. It fails on:

- an arbitrary value of any utility (`p-[13px]`, `grid-cols-[max-content_minmax(0,1fr)]`) or an arbitrary property
  (`[mask:none]`);
- the CSS-variable shorthand (`bg-(--x)`) for any variable but React Aria's `--trigger-width`;
- an inline colour style: a colour property in `style={{ ... }}` or a `CSSProperties` object, on `.style` or
  through `setProperty`, or a literal `fill`, `stroke` or `color` attribute other than `currentColor` or `none`.

Only `src/tokens.stories.tsx` may paint colours inline. `pnpm check-palette` refuses a default-palette class and
colour literals (hex, `rgb()`, `hsl()`, `oklch()`) outside `theme.css` and unit tests, and reports arbitrary values
too. Neither can see class names built at run time (`` `bg-${tone}` ``): write each class in full, or pick from a
map of full class strings. `pnpm lint` runs check-classes before check-palette and stops at the first that fails.

### Checklist for a new component

1. Started with `shadcn add` (pinned) or `pnpm new:component`.
2. Tokens only; `rounded-control` for controls; 16 or 20 px Tabler icons, `aria-hidden`; `mono-literal` for literal
   text; `relative` on any scroll container.
3. Named for assistive technology (fields by `label`, `aria-label` or `aria-labelledby`); state never colour alone.
4. English defaults in `src/strings.ts` with a `strings` prop over them ("Copy defaults"); exported with its props
   type and its `<Name>Strings` type from `src/index.ts`.
5. Stories for every state, with play functions, replacing the generated `Default` and meta `args`; an entry in
   `tools/story-requirements.json` if it is a pattern.
6. `pnpm format` (Biome writes its formatting into what you edited by hand), then `pnpm lint`, `pnpm typecheck`,
   `pnpm test`, `pnpm test:storybook`, then the visual baselines as above.

## Common mistakes

- `text-blue-500`, `p-[13px]`, `grid-cols-[...]`, `style={{ color: ... }}`: none exist here. Use the role tokens
  and the scale.
- A long value that overflows its column: the flex or grid child lacks `min-w-0`, or the value lacks `wrap-anywhere`.
- A `Badge` or a coloured word for a state: use `StatusChip`.
- A plain `<code>` for a command the app ran: use `CommandRow`.
- A spinner with no label for slow work: make it a job and show `JobProgress`.
- A feature using `JobProgressView` or `StreamingListView` directly: use the wrapper in `shared/patterns/`.
- Copy written inside a `packages/ui` component, or in a feature's JSX instead of its strings module.
- Two primary buttons in one view.
- `overflow-auto` without `relative`.
- Running `npx shadcn@latest` or the MCP server's suggested `pnpm dlx` command instead of the pinned CLI.
- Committing visual baselines without opening them.
