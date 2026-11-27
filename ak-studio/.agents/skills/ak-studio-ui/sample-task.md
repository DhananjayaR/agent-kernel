# Sample task: a small presentational component with its stories

Start from branch `feature/950-agent-kernel-studio-phase-1` (fast-forward your worktree to it if it was made from
another branch).

This task tests the `ak-studio-ui` skill. Run it in a scratch branch or worktree, from `ak-studio/`, using only the
skill. No network is needed: the component is made with the generator, not from shadcn.

## The task

Add `DetailList` to `packages/ui`: a definition list of labelled values, such as an app's version and platform, or
a session's port and model.

1. Create it with `pnpm new:component detail-list --group Display`.
2. Props:
   - `items`: `{ label: string; value?: string; mono?: "literal" | "figures" }[]`;
   - `strings` (optional): overrides of the component's copy, `Partial<DetailListStrings>`, whose one key, `notSet`,
     is what an item with no value shows ("Not set" by default), following the skill's copy-defaults convention;
   - `className`.
3. It renders a `<dl>`: each label as a `<dt>` in muted text, each value as a `<dd>` in normal text. `mono: "literal"`
   sets the value in `mono-literal`, `mono: "figures"` in `mono-figures`. An item with no value shows the not-set
   text in muted text, so it is not mistaken for a value. A long value wraps inside its column and never makes the
   page scroll sideways. Labels and values come from props; the component holds no copy but the not-set default.
4. Stories, under `Display/Detail list`, each with a `play` function that checks what it shows:
   - `Default`: two items, plain values. It replaces the `Default` story the generator wrote.
   - `MonoValues`: one literal value (a path such as `deploy/backend.tf`) and one figures value (a duration such as
     `1:02:03`), checking each has the right font utility.
   - `NotSet`: an item with no value, showing the default not-set text.
   - `LongValue`: a value of 200 characters with no spaces, at a 320 px wide frame, checking nothing overflows.
5. Export `DetailList` and `DetailListProps` from `packages/ui/src/index.ts` (the generator does this), and
   `DetailListStrings` beside the other strings types.
6. Create its visual baselines and look at each one.

## Done means

All of these, from `ak-studio/`, with no edits beyond what the skill tells you to do (running `pnpm format` is one
of them):

- `pnpm lint` passes (including check-classes, check-palette and check-stories).
- `pnpm typecheck` and `pnpm test` pass.
- `pnpm test:storybook` passes: every new story, dark and light, with axe and the icon check.
- `pnpm test:visual --update-snapshots=missing` added exactly eight images, `display-detail-list--*-{dark,light}.png`,
  in `tests/visual/__screenshots__/linux/`, and then `pnpm test:visual` passes with no other baseline changed.
- No arbitrary value, no inline style, no colour outside the role tokens, no `@ak-studio/contract` import.
- `git status` shows only the component, its stories, `src/index.ts`, `src/strings.ts` and the eight baselines.
