# Ground rules, UX patterns and Studio skills

**Status:** proposed, revised after review on 23 November 2026. Approved and written in
[P1b](P1b-data-layer-and-patterns.md); extended by each later phase. After approval the `ak-studio-ui` skill
is the maintained source for sections 1 and 2, and this file is the frozen design record.

The Studio will be built largely with coding agents. Agents copy whatever they see, so polish has to be
written down and enforced, not left to taste. This document sets:

1. **Ground rules:** the UI semantics every screen follows.
2. **UX patterns:** a fixed catalogue of interaction patterns, each with when to use it.
3. **Development techniques** that keep it honest.
4. **Skills** that teach all of it, and the [architecture](architecture.md), to any coding agent working on
   `ak-studio/`.

## 1. Ground rules

### Meaning first: one component per meaning

Component names are working names until the P1a design gate.

| Meaning | Always use | Never |
|---|---|---|
| The state of something (passed, running, failed, waiting, not set up) | `StatusChip` | A coloured word, a bare dot, a `Badge` |
| A file or folder path | `PathChip` | Plain text, a link |
| A secret | `SecretChip` (name and where it is stored) | Anything that could show a value |
| A command the app ran | `CommandRow` | A code block |
| Something made or offered by the coding agent | `AIBadge`, the AI button style | The AI colour on anything else |
| A feature the project's version lacks | `CapabilityGate` | A disabled control with no reason |
| Anything that needs an explicit yes | The approval pattern | A plain confirm dialog |
| A long operation | The job pattern (`JobProgress`) | A spinner with no label |

### Visual rules

- **The basic style resembles React Spectrum (Spectrum 2):** its control sizes and density, state styling and
  spacing rhythm, expressed as the Studio's own tokens. When a new component has no precedent in the Studio,
  look at how Spectrum 2 sizes and states its equivalent before inventing one.
- **The brand wins where it is explicit** ([branding/README.md](../../../../branding/README.md); branding change
  of 25 November 2026). Colours are those of Open Agent Kernel (OAK). Buttons, inputs and tags are rectangular at the 8 px control
  radius, not Spectrum 2's pill; cards and panels use the 16 px card radius. The logo mark
  (`branding/logo-mark/`) is the app icon and sits in the top bar, used as supplied: never redrawn,
  recoloured or stretched.
- **Type.** Inter for UI text. Archivo for headings and for primary call-to-action labels (the Archivo-for-CTA rule is from the Drive "Agent Kernel - Style Guidelines Quick Reference", May 2026, not `branding/README.md`). JetBrains Mono for
  code. All three are bundled.

- **Design-system colours only.** Tailwind's default palette is removed, so only role tokens exist
  (`bg-surface`, `text-muted`, `border-default`, `accent-primary`, `status-success`). No arbitrary values
  (`p-[13px]`) and no inline colour styles.
- **The spacing and type scale is closed.** Only steps from the design system's scale.
- **Colour roles are fixed:** primary for the primary action, focus and selection; the AI colour for the
  coding agent only; success, warning and danger for states. State is never colour alone.
- **Floating layers** (menus, popovers, drawers, modals, toasts) are solid, as in Spectrum 2, not glass.
  Decided in P0 on 23 November 2026 ([P0](P0-technology-selection.md) D1a). Docked surfaces are also solid.
- **One primary action per view.** Everything else is secondary, outline or ghost.
- **Icons** are Tabler outline icons, the set the website uses, at two sizes. No emoji. (Decided 25 November
  2026; it replaces lucide.)
- **Monospace** for paths, commands, code, identifiers, durations, token counts and money, with tabular
  figures.

### Copy rules

- Sentence case everywhere in the app.
- **The product's name.** "Open Agent Kernel" where the full name is read (window and installer titles: the app's
  title is "Open Agent Kernel Studio"), "OAK" everywhere else; the compact interface says "OAK Studio". The company is not named in the app.
  Identifiers keep their form: the `agentkernel` package, the `ak` CLI, `AKConfig`, `AK_*` variables,
  `.akstudio/`, the `ak-*` skills. (The team's brief 00 and the brand's
  [name rule](../../../../branding/README.md#name).)
- The Studio's coding-agent feature is "Claude Agent"; the Studio never calls itself or its feature
  "Claude Code". Anthropic's Agent SDK branding rule permits "Claude Agent" or "Powered by Claude" and does
  not permit "Claude Code" as a label. "Claude Code" names only the user's installed program ("Sign in to
  Claude Code", "Claude Code is not installed"). Raw agent error text is never shown as a message.
- OAK's own words: handoff, pre-hook, post-hook, session store, guardrail, execution mode, message type,
  sandbox profile.
- Buttons say what happens: "Apply plan", not "OK". Destructive buttons name the thing: "Destroy deployment".
- Errors say what happened and what to do next, in that order. No "Something went wrong".
- Empty states say what this place is for and offer the first action.
- No placeholder copy ships.
- **English only in Release 1, by decision.** Copy is kept in one strings module per feature (not scattered
  through components), so it can be reviewed in one place and translated later without a rewrite.

### Behaviour rules

- **Feedback timing:** no indicator under 300 ms; then a pending state on the control or a skeleton for
  content; a labelled job for anything expected to pass one second; a cancel control for anything that can
  run over ten seconds. The timing is applied by the shared hooks, not chosen per screen.
- **Keyboard:** every action is reachable. Shortcuts are declared in feature manifests and shown in menus and
  the command palette; a clash fails a test.
- **Composite widgets have a written keyboard model.** The canvas, the tree, the data table and the trace
  view each document how arrow keys, Tab, Enter and Escape behave, and have a scripted keyboard test. For the
  canvas (target; the tab-order design is open decision 1c, settled at the P3 design gate): Tab moves between nodes in reading order, arrows move to connected nodes, Enter opens the inspector,
  and every drag action has a keyboard or menu equivalent.
- **Focus:** moves into a modal or drawer when it opens and back to its trigger when it closes. Never lost to
  the page body.
- **Nothing is lost silently.** Leaving a view, closing the project or quitting with an unsaved working copy
  asks first.
- **Motion:** 150 ms for hover and focus, 250 ms for panels; nothing ambient except progress and the coding
  agent's "just added" pulse. Honour reduced motion.
- **Layout:** holds at 1100 px wide; panels resize and remember their size; nothing scrolls the page sideways.
- **Business-rule states, in order of severity:** out of sync, untested, drafted, enforced. A rule shows its
  most severe state. Untested ranks above drafted because it looks finished but has no evidence.

## 2. UX patterns catalogue

Every screen is assembled from these patterns. A screen that needs something not listed adds it here first,
through the design gate, so the next screen can reuse it.

| Pattern | Use when | Key rules |
|---|---|---|
| **Shell and tabs** | Always, inside a project | Tabs are the business areas; no left navigation |
| **Inspector** | Something is selected on a canvas or list | Right side; shows the selection's type; links to where it is defined |
| **Master and detail** | Lists of items with detail (rules, test cases, deploy history) | List keeps its scroll and selection when detail changes |
| **Schema form** | Editing any `config.yaml` section | Generated from the installed version's schema; set versus default is visible; inline validation; one save per section |
| **Command palette** | Finding any action or file | One shortcut; built from the app commands in manifests; shows each command's shortcut |
| **Job progress** | Any job | Title, current step, elapsed time, cancel, "Show commands"; ends in a result or an error with a next action |
| **Session control** | Anything long-lived (the local server, the coding agent) | State, start and stop, key facts (port, model), a link to its log |
| **Approval** | A job is `waiting-for-user` | Says what will happen and what it affects (account, files); approve and deny; destructive ones need the thing's name typed |
| **Background job notice** | A job finishes or needs an answer while the user is on another tab | A badge on the owning tab and a toast with "Show"; a job waiting for the user is never only a toast |
| **Streaming list** | Logs, command output, agent events | Follows the end until the user scrolls up; "Jump to latest"; bounded buffer; copy and clear |
| **Changed on disk** | A file the view shows changed outside the app | A non-blocking banner; the view re-reads; a working copy is kept and flagged as conflicting, with "Keep mine", "Take theirs" and "Compare" |
| **Unsaved changes guard** | Leaving, closing or quitting with a working copy | Names what is unsaved; save, discard or stay |
| **Undo and redo** | Edits on the canvas and in forms | Undo reverses the last Studio write as a new write (files stay the source of truth); the history is per project and cleared when a file changes outside the app |
| **Version gate** | A feature the project's version lacks | Shows the version that adds it and the upgrade command; never hides the feature silently |
| **Empty state** | A view with nothing in it yet | What this is for, plus the first action; an AI alternative where one exists |
| **Cannot read** | A file or project cannot be parsed | Names the file and line; shows partial results; offers "Open file" and "Fix with AI" |
| **Pending change review** | Changes made by the coding agent or a template | A diff per file; accept or revert per turn |
| **Feedback placement** | Reporting a result | Inline for a field, a banner for a view, a toast only for something that finished in the background |

## 3. Development techniques

| Technique | What it means here |
|---|---|
| **Contract first** | A feature starts with its operations in `packages/contract`; services and hooks are written against them |
| **Story first** | A component or screen is built in Storybook with fixture data, in every state from the design gate, before it is wired to real data |
| **One fixture project** | The support-triage fixture from the briefs exists as a real folder in `ak-studio/fixtures/`, used by stories, the mock transport and end-to-end tests |
| **Mock transport** | The renderer runs in a browser against fixture data, so UI work needs no Electron and no Python |
| **Vertical slices** | A phase is delivered feature by feature: contract, service, hooks, screens, tests. Not layer by layer. |
| **Generators** | `pnpm new:feature`, `pnpm new:operation`, `pnpm new:component` create skeletons that follow the rules |
| **Fakes over mocks** | Services are tested with fake `CommandRunner` and `ProjectFs`; real processes only in a small integration suite |
| **Visual regression** | Screenshots of every story, dark and light, compared in CI **on Linux only**, because fonts render differently on each operating system |
| **Accessibility in CI** | axe on every story, plus scripted keyboard tests for composite widgets. Automated checks find only part of the problems, so the design gate keeps its manual keyboard and screen-reader pass. |
| **Reference projects** | Every scaffold template has a reviewed reference output; a test regenerates it and fails on any difference |
| **Small PRs, one slice each** | A PR adds one operation, one component or one screen state, with its stories and tests |

## 4. Studio skills

### Where they live

In `ak-studio/.agents/skills/`, with `ak-studio/.claude/skills` linked to it, mirroring the repository root.
Claude Code scopes skills in a subdirectory to work in that directory, so the Studio skills do not load for
Python work on `ak-py`, and the root `ak-dev-*` skills stay as they are. `ak-studio/AGENTS.md` points to them,
and the root [AGENTS.md](../../../../AGENTS.md) gains one line naming the third skill set. They use the same
frontmatter as the `ak-dev-*` skills.

The link is a symbolic link, as at the repository root. On Windows a clone needs symbolic links enabled in
git; `ak-studio/README.md` says so.

### One source of truth

A skill is the maintained source for what it teaches. The matching sections of this file and of
[architecture.md](architecture.md) are the design record: frozen once approved, with a note pointing to the
skill. A change to a rule is made in the skill, in the same PR as the code and generator that follow it.

### Start small, extract from real code

Skills written before any real feature exists are guesses. P1b writes three, against the foundation. The rest
are extracted from the first real features at the end of the phase that produces them.

| Skill | Teaches | Written in |
|---|---|---|
| `ak-studio-architecture` | Layers, data ownership, the contract's four shapes, jobs and sessions, errors, safe writes, capability gating, service rules | P1b |
| `ak-studio-ui` | The ground rules and the pattern catalogue, with a story reference for each; adding a component to `packages/ui` | P1b, extended each phase |
| `ak-studio-new-feature` | Adding a feature with the generators, end to end: manifest and app commands, operations, service handlers, hooks, screens, stories, tests | P1b; revised at the end of P2 against the first real features |
| `ak-studio-testing` | Vitest, fakes, the fixture project, Playwright against the browser renderer and Electron, visual regression, keyboard tests | End of P2 |
| `ak-studio-design-gate` | Running the [design gate](design-process.md) for a screen: requirements, options, stories, checklist, sign-off | End of P2 |
| `ak-studio-kernel-capability` | Adding a catalog entry when `ak-py` gains or removes a feature, and gating the UI on it | P2 |
| `ak-studio-coding-agent-adapter` | The coding-agent interface and how an adapter implements it | P6 |
| `ak-studio-scaffold-template` | Adding or changing a project template and its reference project | P4 |

Existing skills that change:

- `ak-dev-review-pr`: a Studio section that reviews against the architecture, the ground rules and the design
  gate sign-off.
- `ak-dev-sync-skills-from-branch` and `ak-dev-sync-docs-from-branch`: when an `ak-py` change adds a feature,
  check the Studio's capability catalog (pairs with the P2 drift test).

### Skills are tested

- Each skill has a small sample task (add a sample feature; add a sample component; add a catalog entry).
- A coding agent runs the task in a scratch branch using only the skill. Because agents vary, it is run three
  times; all three results must pass lint, boundaries, stories and review with no hand edits.
- A skill whose sample needs fixing is rewritten until it does not.
- The sample tasks are kept beside the skills and rerun whenever a skill or a generator changes.

## 5. The component library in practice

- `packages/ui` is the Studio's own shadcn/ui registry: components are added with the shadcn CLI, then
  restyled to the tokens and given stories before any feature uses them.
- The shadcn MCP server and registry are configured for the repository, so coding agents add components the
  same way a person does, instead of writing look-alikes.
- A component is changed in `packages/ui` and nowhere else. Features compose components; they do not
  restyle them with one-off classes.
