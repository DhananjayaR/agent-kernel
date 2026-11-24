# Agent Kernel Studio

Electron desktop app for Agent Kernel (issue #950). pnpm workspace; Node 24.22.1, pnpm 12.4.1.

```bash
cd ak-studio
pnpm install --frozen-lockfile
pnpm lint        # Biome check (real)
pnpm typecheck   # tsc -b over all members (real)
pnpm depcruise   # boundary rules (dependency-cruiser, swc parser)
pnpm depcruise:selftest  # proves the rules can fail and the parser finds modules
```

Members: `apps/desktop`, `apps/renderer`, `packages/contract`, `packages/ui`, `packages/kernel-catalog`
(scaffolds so far; app code arrives in later P1a tasks).

Scripts that are placeholders for now (print "added in Task N" and exit 0): `dev`, `build` (Task 3),
`test` (Task 2), `storybook` (Task 6), `package` (Task 7). `lint` and `typecheck` are real.

Boundary rules live in `.dependency-cruiser.cjs`: the renderer and `packages/ui` import no `electron` or Node
built-in; `packages/contract` imports only `zod`; `packages/ui` imports neither `apps/*` nor
`@ak-studio/contract`; nothing imports `apps/desktop` but itself. dependency-cruiser needs `@swc/core` under
TypeScript 7 (without it a run is silently green: "0 modules"), so `depcruise:selftest` checks a deliberately
violating fixture in `tools/depcruise-selftest/fixture/` (ignored by Biome and the tsconfigs) and fails if
fewer than 2 modules are cruised or any rule goes unreported.
