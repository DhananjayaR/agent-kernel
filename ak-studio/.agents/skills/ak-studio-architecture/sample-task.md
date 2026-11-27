# Sample task: a query and a command with a revision

Start from branch `feature/950-agent-kernel-studio-phase-1` (fast-forward your worktree to it if it was made from
another branch).

This task tests the `ak-studio-architecture` skill (with `ak-studio-new-feature` for the generator commands). Run it
in a scratch branch or worktree, from `ak-studio/`, using only the skills. The skills point to the About feature as
the worked example: read it, but import nothing from it (About is throwaway).

## The task

Add a feature named `scratch-pad`: one short text kept in the runtime service's memory, read with a revision and
written only on the revision it was read at.

1. Create the feature and its two operations with the generators:
   - `pnpm new:feature scratch-pad`
   - `pnpm new:operation scratch-pad read-pad --shape query`
   - `pnpm new:operation scratch-pad write-pad --shape command`
2. `scratch-pad.readPad`: input `{}`; output `{ text: string, revision: Revision }`. The text starts empty.
3. `scratch-pad.writePad`: input `{ text, baseRevision }` (the text at most 10,000 characters); output
   `{ revision }`; errors `[ERROR_CODES.fileChangedOnDisk]`.
   - The revision is the SHA-256 of the text as 64 lowercase hex characters, computed with Web Crypto by a helper
     in the service file (the skill says how).
   - A `baseRevision` that is not the current revision fails with `file.changedOnDisk` and a message that says what
     to do next. The error carries no content.
   - A successful write emits `domain.changed` for the `scratch-pad` domain (the test spies on `events.emit`, with
     the `EventBus` the generated `serve()` returns).
   - The service's copy (the stale-write message) lives in a strings module beside the service.
4. Tests:
   - In `ScratchPadService.test.ts`: the empty pad and its revision; a write on the current revision answers the
     new revision and the next read shows the text; a write on an old revision is refused with
     `file.changedOnDisk`, has no field holding the text, and leaves the pad unchanged; the write emits
     `domain.changed` for `scratch-pad`. Expected revisions are computed with the service's revision helper, not
     written out as digests.
   - The two generated hook tests, updated for the real input and output (the write's test takes its base revision
     from a read through the mock's transport, as the skill says).
5. The screen stays as the generator wrote it. No new error code, no session, no capability.

## Done means

All of these, from `ak-studio/`, with no edits beyond what the skills tell you to do (running `pnpm format` is one
of them):

- `pnpm lint` passes (Biome, check-palette, check-classes, check-stories, the boundary rules and their self-tests).
- `pnpm typecheck` passes.
- `pnpm test` passes, including the new service and hook tests.
- `pnpm test:storybook` passes (the generated screen story gets its axe run in both themes).
- `packages/runtime` imports no `node:*` module; nothing imports from `about/`.
- The operations are declared in `packages/contract/src/scratch-pad.ts`, listed in `operations.ts`, and served by
  `ScratchPadService`, whose factory is in `packages/runtime/src/features.ts`.
- `git status` shows only the files the generators made or changed, and the strings module.

Out of scope: visual baselines for the generated screen story (real work commits them; see `ak-studio-ui`) and
end-to-end tests.
