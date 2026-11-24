# Agent Kernel Studio

Electron desktop app for Agent Kernel (issue #950). pnpm workspace; Node 24.22.1, pnpm 12.4.1.

```bash
cd ak-studio
pnpm install --frozen-lockfile
pnpm lint        # Biome check (real)
pnpm typecheck   # tsc -b over all members (real)
```

Members: `apps/desktop`, `apps/renderer`, `packages/contract`, `packages/ui`, `packages/kernel-catalog`
(scaffolds so far; app code arrives in later P1a tasks).

Scripts that are placeholders for now (print "added in Task N" and exit 0): `dev`, `build` (Task 3),
`test` (Task 2), `storybook` (Task 6), `package` (Task 7). `lint` and `typecheck` are real.
