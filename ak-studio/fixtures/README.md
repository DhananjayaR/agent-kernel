# Fixtures

`support-triage/` is the one example project of OAK Studio. It follows the "Fixture data" section of
`docs/specs/950-agent-kernel-studio-phase-1/00-project-brief.md`: the files, agents, tools, hooks and settings
listed there, and nothing else. Anything the brief does not give is a placeholder in square brackets.

Stories, the mock transport (through `apps/renderer/src/shared/bridge/fixtures.ts`) and the later end-to-end tests
all read from this folder, so every screen shows the same project. The folder is a user's project, not Studio
code: lint, formatting and type-checking skip it. `tools/fixture-tree.test.mjs` checks its file list against the
brief's tree.

The `.env` file holds names with `[YOUR KEY]`-style placeholders only; never put a real secret in it.
`.claude/commands/` and `.akstudio/` hold a `.gitkeep` so git keeps the (otherwise empty) folders.
