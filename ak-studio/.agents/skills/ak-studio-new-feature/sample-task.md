# Sample task: a sample feature with a job

This task tests the `ak-studio-new-feature` skill (with `ak-studio-architecture` and `ak-studio-ui` where it points
to them). Run it in a scratch branch or worktree, from `ak-studio/`, using only the skills. Read the About feature
where the skills point to it, but import nothing from it.

## The task

Add a feature named `word-count` that counts the words in a text as a job.

1. Generate it: `pnpm new:feature word-count`, then `pnpm new:operation word-count count-words --shape job`.
2. The job `word-count.countWords`:
   - input `{ text }`, at most 100,000 characters; result `{ words }`, a whole number; title "Count words";
     cancellable; does not survive quit.
   - Three steps, each reported with `ctx.step` and one line of output: reading the text, counting the words,
     checking the count. Each step waits 500 ms through the service's clock with the job's signal, so Stop ends it
     at once as `cancelled`.
   - The words are the text's runs of non-space characters; an empty text has 0 words.
   - The step labels and output lines live in a strings module beside the service.
3. The manifest: the generator lists the job kind in `jobs`. Add an app command `word-count.show` ("Open word
   count") that opens `/word-count`, name it as the manifest's `show`, and add `word-count.countSample` ("Count the
   words in a sample text"), which starts the job with a fixed sample text from the strings module. No tab.
4. The screen, from the patterns, all copy in `strings.ts`:
   - a heading and one sentence saying what the screen is for;
   - `InterruptedJobs` for the feature's job kind;
   - a `Textarea` for the text and one primary button, "Count words", which starts the job (pending look after
     300 ms; a refused start shown with `ErrorView`);
   - `JobProgressList` over the feature's jobs from the job store (the live ones and the newest that ended), with
     the result in one line ("12 words");
   - a `StreamingList` of the newest job's output.
5. Tests:
   - `WordCountService.test.ts`: the job runs to `{ words }` for a sample text and to `{ words: 0 }` for an empty
     one, moving a `FakeClock` (pass one in the service's deps from `serve()` and keep a reference to it); a job cancelled during a step ends `cancelled`; an input over 100,000 characters is
     refused with `bridge.invalidInput`.
   - The generated hook test, updated for the real input and result.
   - The manifest test: the route, `show` and both commands (`word-count.countSample` starts a job).
   - A screen test on the mock: typing a text and pressing "Count words" shows the job's steps and then its result.
6. Screen stories (`Screens/Word count`): `Empty` (nothing typed, no job), `Running` (a job part way, the clock
   moved by one step) and `Counted` (a job that finished), each on `MockApp` with a `FakeClock` from a loader.

## Done means

All of these, from `ak-studio/`, with no hand edits after the skill's steps:

- `pnpm lint` passes (including check-stories, check-classes and the boundary rules: the feature imports no other
  feature and nothing from `about/`).
- `pnpm typecheck` and `pnpm test` pass, with the new tests among them.
- `pnpm test:storybook` passes: the three screen stories, dark and light, with axe.
- The contract declares `wordCountCountWords` in `packages/contract/src/word-count.ts`; `WordCountService` serves it
  and its factory is in `packages/runtime/src/features.ts`; the app registry test still passes (every job kind has
  one owner).
- `git status` shows only the generated files, the strings modules, the screen test and stories, and the edits
  the steps name.

Out of scope: visual baselines and end-to-end tests (real work adds both; the skill says how).
