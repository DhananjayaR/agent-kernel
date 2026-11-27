# Sample task: a query and a command with a revision

This task tests the `ak-studio-architecture` skill (with `ak-studio-new-feature` for the generator commands). Run it
in a scratch branch or worktree, from `ak-studio/`, using only the skills. Do not copy from the About feature's
files, and import nothing from them: About is throwaway.

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
   - The revision is the SHA-256 of the text as 64 lowercase hex characters, computed with Web Crypto in the
     runtime service.
   - A `baseRevision` that is not the current revision fails with `file.changedOnDisk` and a message that says what
     to do next. The error carries no content.
   - A successful write emits `domain.changed` for the `scratch-pad` domain.
   - The service's copy (the stale-write message) lives in a strings module beside the service.
4. Tests:
   - In `ScratchPadService.test.ts`: the empty pad and its revision; a write on the current revision answers the
     new revision and the next read shows the text; a write on an old revision is refused with
     `file.changedOnDisk`, has no field holding the text, and leaves the pad unchanged; the write emits
     `domain.changed` for `scratch-pad`.
   - The two generated hook tests, updated for the real input and output.
5. The screen stays as the generator wrote it. No new error code, no session, no capability.

## Done means

All of these, from `ak-studio/`, with no hand edits after the skill's steps:

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
