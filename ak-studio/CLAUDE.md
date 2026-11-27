# CLAUDE.md (OAK Studio)

See [AGENTS.md](AGENTS.md): how to work in `ak-studio/`, its commands, and where design decisions live. The
repository's [../CLAUDE.md](../CLAUDE.md) and [../AGENTS.md](../AGENTS.md) still apply.

Claude Code specifically: the Studio skills under [.agents/skills/](.agents/skills/) (`ak-studio-architecture`,
`ak-studio-new-feature`, `ak-studio-ui`) are linked from `.claude/skills`. Invoke them with the Skill tool instead
of re-deriving the Studio's rules from the code.
