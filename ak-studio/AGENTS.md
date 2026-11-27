# AGENTS.md (OAK Studio)

Guidance for AI coding agents working on Open Agent Kernel Studio (OAK Studio), the Electron desktop app in
`ak-studio/` (issue #950). The repository's own guide, [../AGENTS.md](../AGENTS.md), still applies (git, commits,
naming and brand); this file adds what is specific to the Studio. Nothing here applies to `ak-py/`.

## The Studio skills

Three skills teach how the Studio is built. They live in [.agents/skills/](.agents/skills/), and
`.claude/skills` is a symbolic link to that folder, as at the repository root, so Claude Code finds them when it
works in `ak-studio/`. Other agents read the `SKILL.md` files directly. Load the skill before the work, not after
a check fails.

| Skill                                                                    | Load it when                                                                                                                                        |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| [ak-studio-architecture](.agents/skills/ak-studio-architecture/SKILL.md) | Changing the contract, the runtime, the desktop main process or the renderer's `shared/`; declaring an operation; a boundary or contract test fails |
| [ak-studio-new-feature](.agents/skills/ak-studio-new-feature/SKILL.md)   | Adding a feature, an operation, a screen or an app command; a `pnpm new:*` generator refuses                                                        |
| [ak-studio-ui](.agents/skills/ak-studio-ui/SKILL.md)                     | Building or changing a screen, a component or copy; a story, axe, check-classes or visual check fails                                               |

The skills are the maintained source for what they teach. A rule changes in the skill, in the same PR as the code
and generator that follow it. Each skill has a `sample-task.md` beside it: rerun it with a fresh agent, using only
the skills, whenever a skill or a generator changes; it must pass with no hand edits.

## Commands

From `ak-studio/` (Node 24.22.1, pnpm 12.4.1; `pnpm install --frozen-lockfile` once):

```bash
pnpm format          # Biome's formatting and safe fixes, written; run after any hand edit
pnpm lint            # Biome, check-classes, check-palette, check-stories, compile-schemas, depcruise, self-tests
pnpm typecheck       # tsc -b over every member
pnpm test            # unit tests of every member, the tools' tests and the generator test
pnpm test:storybook  # every story, dark and light, with axe (needs Playwright's Chromium)
pnpm test:visual     # screenshots of every story against the Linux baselines
pnpm test:e2e        # the renderer on the mock in Chromium, and the built app in Electron
pnpm new:feature <name>
pnpm new:operation <feature> <name> --shape query|command|job [--desktop] [--project]
pnpm new:component <name> [--group <group>]
```

Run `pnpm format`, then `pnpm lint`, `pnpm typecheck` and `pnpm test`, before every commit; add `test:storybook` and `test:visual` when a
story, component or screen changed, and `test:e2e` when a screen or app code changed. [README.md](README.md) has
every script, the tooling's details and the known limits of each check.

## Map

```
apps/desktop/        Electron main process and preload; desktop-only services; the quit rule
apps/renderer/       React app: app/ (shell, router, registry), shared/ (bridge, stores, patterns), features/<name>/
packages/contract/   Operations, streams, domain types, error catalog (zod only)
packages/runtime/    Browser-safe services core and feature services, served by the app and the mock alike
packages/ui/         The design system (shadcn/ui on React Aria, Tailwind 4 tokens), presentational only
packages/kernel-catalog/  Capability catalog types (empty until P2)
fixtures/            The support-triage fixture project
tools/               Generators, checks and their self-tests
tests/               End-to-end (tests/e2e) and visual regression (tests/visual)
```

## Where design decisions live

- [docs/specs/950-agent-kernel-studio-phase-1/implementation/](../docs/specs/950-agent-kernel-studio-phase-1/implementation/):
  the phase documents (`P0` to `P4-P12`), each with its rulings and design gate sign-offs;
  [design-process.md](../docs/specs/950-agent-kernel-studio-phase-1/implementation/design-process.md), the design
  gate every screen passes before it is built.
- [architecture.md](../docs/specs/950-agent-kernel-studio-phase-1/implementation/architecture.md) and sections 1
  and 2 of [conventions-and-skills.md](../docs/specs/950-agent-kernel-studio-phase-1/implementation/conventions-and-skills.md)
  are frozen design records: the skills above replace them as the maintained source.
- `branding/README.md` at the repository root: names, logos and colours.

## Rules worth repeating

- Every dependency version is pinned (no `^` or `~`). A new package is recorded, with its version and date, in the
  decision record of [P0-technology-selection.md](../docs/specs/950-agent-kernel-studio-phase-1/implementation/P0-technology-selection.md).
- No secrets, local absolute paths or personal data in any file.
- A Windows clone needs symbolic links enabled in git (`git config core.symlinks true`, with Developer Mode or
  administrator rights), or `.claude/skills` is checked out as a plain file.
