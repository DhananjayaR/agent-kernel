# Spike S5: A coding agent driven with the user's own key (Claude Agent SDK from the Electron main process)

**Date:** 2026-11-23  **Ran on:** Linux (WSL2) only  **Time spent:** under 1 day  **Decision it feeds:** D14

> **Superseded in part, 24 November 2026.** This spike tested a design in which the user pastes an API key
> into the Studio. The owner has since settled that the Studio uses the user's own Claude Code, already
> installed and signed in with a subscription, and holds no credential
> ([architecture](../architecture.md#the-coding-agent-and-the-users-claude-code)).
> - **Still holds:** the single adapter, the session and permission mapping, the authentication error shape,
>   the packaging finding about `pathToClaudeCodeExecutable`, and that a project hook runs unprompted.
> - **No longer the design:** the key store, the write-only command, the environment built from nothing
>   (which proved a local sign-in is kept *out*, now the opposite of the goal), and the bundled executable.
> - **Not run:** anything on the new design. See Task 8 in [P0-plan.md](../P0-plan.md).
> - The policy paragraph near the end reflects the 23 November reading; the architecture has the 24 November one.

## Result

Pass with changes, keyless only. The key from the password field is the credential the agent uses, and nothing
else is.
- A turn with the key `sk-ant-invalid` ends in `agent.auth: Invalid API key`, both from the built app and from the
  packaged app.
- The agent's `system/init` message reports `apiKeySource: ANTHROPIC_API_KEY`.
- A stub executable records that the subprocess got only `PATH`, an isolated `HOME` and config dir, the key, and
  three variables the SDK sets itself.

**The live part was not run.** No real key was available (`SPIKE_AGENT_KEY_FILE` unset). That part covers real
streaming, approve and deny against the model, interrupt, cost, and whether the agent's shell tool can see the key.

**Two keyless observations matter for the design:**
1. **A project hook gets the key.** A `SessionStart` hook in the opened folder's `.claude/settings.json` ran
   unprompted, and its environment contained `ANTHROPIC_API_KEY`. So any folder the user opens can read the key.
2. **A project skill loads.** A skill in the opened folder's `.claude/skills/` was listed in `init.skills`.
   Not tested: `.claude/commands`, which is where `ak skill install --assistant claude` writes.

The changes from the brief:
1. On this machine Electron's `safeStorage` has no encryption (backend `basic_text`), so the key is held in memory
   and never written.
2. The packaged app needs `pathToClaudeCodeExecutable` pointed at the `app.asar.unpacked` copy of the SDK's
   executable.

## Pass criteria

| Criterion | Result | Evidence |
|---|---|---|
| Key store: set, clear, has, use-in-callback; no getter; file encrypted with mode 0600 | Pass (unit) | `src/main/agent/keyStore.test.ts`, 9 tests with a fake `safeStorage`. Covered: the file never holds the key; mode 0600, also over an existing 0644 file; `Object.keys(store)` has no getter; the key survives a restart; clear; empty or whitespace keys are rejected. |
| Storage backend recorded | Pass: **`basic_text`, so the key is not encrypted on this machine** | The Electron spec prints `Key stored: yes (storage backend: basic_text (no encryption: key kept in memory, not saved))`. On basic_text, `isEncryptionAvailable()` is `false`, and `encryptString` would need `setUsePlainTextEncryption(true)`. The spike does not write the key in that case: it is held in memory for the run and gone on restart (unit test `keeps the key in memory only…`; the Electron spec asserts no `agent-key.bin`). The encrypted-file path ran only with the fake. |
| Contract: agent operations; no output has `key`, `apiKey` or `token` | Pass | `tests/contract.test.ts`, 4 tests. The walk covers every request `output` and stream `chunk`. A planted-field test proves the check can fail, and another proves the walk reaches inside the `agent.events` union. `handlers.request` also parses every output with its zod schema, which strips undeclared fields. `tests/handlers.test.ts` shows a fake agent that leaks `key` in `keyStatus()` and in an event, and the field does not cross. |
| Only `sdkAdapter.ts` imports the SDK | Pass | New dependency-cruiser rule `agent-sdk-only-in-adapter`. Shown to fire: a temporary `src/main/agent/zzViolation.ts` importing the SDK gave `x 1 dependency violations`; the file was then removed. |
| Adapter calls `query` with an env built from nothing | Pass | `src/main/agent/sdkAdapter.test.ts` runs the real SDK with `pathToClaudeCodeExecutable` pointed at a stub that dumps `env`. The test plants a sentinel and dummy `ANTHROPIC_AUTH_TOKEN`, `CLAUDE_CODE_OAUTH_TOKEN` and `ANTHROPIC_BASE_URL` in `process.env`, which already holds this machine's own variables, including a signed-in Claude Code session's. The stub saw exactly `ANTHROPIC_API_KEY CLAUDE_AGENT_SDK_VERSION CLAUDE_CODE_ENTRYPOINT CLAUDE_CODE_SDK_READS_SESSION_STATE CLAUDE_CONFIG_DIR HOME PATH` plus the shell's `PWD`, and none of the planted names. `HOME` and `CLAUDE_CONFIG_DIR` are the isolated dirs. Run again under `env -i PATH=… HOME=…`: the same set, so the SDK sets those three itself rather than forwarding them. |
| Service: streamed text; approve; deny; interrupt while waiting; auth error mapped to `{ code: 'agent.auth', message }`; key masked in event text | Pass (unit, scripted fake adapter) | `src/main/agent/codingAgent.test.ts`, 14 tests, using message shapes copied from a real SDK 0.3.330 run. Also covered: one pending request at a time (a second waits until the first is answered); a non-auth failure is `agent.failed`, not `agent.auth`; the next turn in the same folder passes `resume`, and a turn in another folder does not; busy, no-key and bad-cwd refusals. |
| Step 5: handlers registered with the sender check; screen | Pass | The agent operations go through the existing `bridge:request` and `bridge:subscribe` handlers, so `fromOurWindow` covers them. `AgentSpike.tsx` (tab "Agent") has a password field that clears itself, a status line, cwd and prompt fields, Start and Interrupt, the event list, and an approval card. The preload still exposes only `bridge` (asserted again in the agent spec). In browser dev mode (WebSocket transport) the key field and Save key are disabled, so the key never goes over the WebSocket. `tests/agent.spec.ts` (needs `dev:web` and `dev:ws`) asserts the controls are disabled, that no `agent.key.set` frame is sent, and that the status shows `agent.unavailable`. |
| Step 6a: keyless turn in development ends in an authentication error | **Pass** | `xvfb-run -a pnpm exec playwright test tests/agent.electron.spec.ts`, built app, `isPackaged false`: 1 passed. Events: `init … key source ANTHROPIC_API_KEY, model claude-opus-5-5`, then `[error] agent.auth: Invalid API key · Fix external API key`, then `[result] not ok, cost $0.0000`. Auth error after about 3.8 s. No text events and no ok result. The page HTML does not contain the key. The isolated config dir under userData was written to (`.claude.json, backups, plugins, projects, sessions`). The same spec then runs a second turn in the same folder (it resumes: same session id, `agent.auth` again) and a third in another folder (new session id, `agent.auth`). |
| Step 6b: the same from the packaged app (`electron-builder --dir`) | **Pass, with `pathToClaudeCodeExecutable`** | Run with `SPIKE_PACKAGED_EXE=release/linux-unpacked/app`, `isPackaged true`. **With the SDK's own resolution** (`SPIKE_AGENT_EXE=bundled`): `[error] agent.failed: spawn ENOTDIR`, because the SDK resolves the executable inside `app.asar`. **With the override** (default; `unpackedExecutablePath()` rewrites `app.asar/` to `app.asar.unpacked/`): the same three-turn spec as 6a passed. electron-builder 26.18.0 had already unpacked the executable without being told; `asarUnpack` makes that explicit. The override is the part that was required. These runs used the final code: rebuilt and repackaged after the last main-process change. |
| The key does not reach logs or the agent's files (keyless runs) | Pass (as far as checked) | `grep -rlF sk-ant-invalid` over every test userData dir, including the agent's own `config/` (session `.jsonl`, `.claude.json`): no hits. The main process logs nothing from the agent. CLI stderr reaches the renderer only as masked `log` events. |
| Step 7, live: streaming text from the model | Not run — needs a key | |
| Step 7, live: approve a tool call | Not run — needs a key | |
| Step 7, live: deny a tool call | Not run — needs a key | |
| Step 7, live: interrupt a running turn | Not run — needs a key | |
| Step 7, live: cost on the result | Not run — needs a key | The keyless result carried `total_cost_usd: 0`, so the field is wired, but a non-zero cost has not been seen. |
| Step 7, live: does `env` run by the agent's shell tool show the key? | Not run — needs a key | Unverified. The key is in the subprocess env as `ANTHROPIC_API_KEY`; expect the Bash tool's children to inherit it unless the CLI scrubs it. |
| Step 7, live: does a skill under the scratch folder's `.claude/` load? | Not run — needs a key | Keyless observation: yes, it is listed. With `.claude/skills/spike-probe/SKILL.md` in the third turn's folder, `init.skills` began with `spike-probe`. Whether the model then uses it needs a key. The other 18 names (`deep-research`, `design`, …) appear even with an empty isolated config, so they ship with the CLI. |
| Keyless observation: a project hook runs and sees the key | **Observed (a risk)** | The third turn's folder has a `SessionStart` hook that writes only env names to a file. It ran with no prompt, from both the built and the packaged app. It saw `ANTHROPIC_API_KEY` among `AI_AGENT ANTHROPIC_API_KEY CLAUDECODE CLAUDE_AGENT_SDK_VERSION CLAUDE_CODE_CHILD_NOTES_DIR CLAUDE_CODE_CHILD_SESSION CLAUDE_CODE_ENTRYPOINT CLAUDE_CODE_MESSAGING_SOCKET CLAUDE_CODE_MESSAGING_TOKEN CLAUDE_CODE_SESSION_ATTENDED CLAUDE_CODE_SESSION_ID CLAUDE_CONFIG_DIR CLAUDE_ENV_FILE CLAUDE_PID CLAUDE_PROJECT_DIR COREPACK_ENABLE_AUTO_PIN HOME NoDefaultCurrentDirectoryInExePath PATH PWD`. |
| Windows, macOS | Not run | Windows needs more env than `PATH` and `HOME`: the adapter adds `USERPROFILE` (isolated) and `SystemRoot`, but this is untested. macOS keeps a signed-in session in the Keychain, not under HOME, so isolation there is unverified. The `sdkAdapter` env test is skipped on Windows (it uses an `sh` stub). |

## How the invalid-key run proves the key is the one in use

A 401 alone would not prove isolation: `ANTHROPIC_API_KEY` outranks a sign-in, so a leaked sign-in could still
lose to the invalid key. The evidence is three separate things.
- **What the subprocess gets:** the stub-executable test above. Nothing from the parent env except `PATH`, and no
  real `HOME`.
- **What the CLI says it used:** `init.apiKeySource` is `ANTHROPIC_API_KEY` in every run, not `oauth` or `/login
  managed key`.
- **Where it wrote:** the isolated `config/` under the app's userData is populated, and the isolated `home/` stays
  empty.

The user's `~/.claude` was neither read nor checked (by rule). A turn with no key at all was deliberately not run:
if isolation had failed, it would have spent the machine's sign-in.

## SDK facts, checked against the installed `sdk.d.ts` (0.3.330, `claudeCodeVersion` 2.1.330)

- **Option names:** all present as the brief names them (`cwd`, `env`, `permissionMode`, `canUseTool`,
  `includePartialMessages`, `abortController`, `settingSources`, `resume`, `pathToClaudeCodeExecutable`), plus
  `stderr`.
- **`env`:** "REPLACES the subprocess environment entirely". The SDK still adds `CLAUDE_AGENT_SDK_VERSION`,
  `CLAUDE_CODE_ENTRYPOINT` and `CLAUDE_CODE_SDK_READS_SESSION_STATE`.
- **`permissionMode`:** **when omitted, it is `'auto'` where available**, meaning a model classifier approves
  calls. Passing `'default'` is required to keep every approval going through `canUseTool`. The spike passes it.
- **`canUseTool` options (differs from the brief):** the id is spelled `toolUseID`, and the options also carry
  `title`, `displayName`, `description`, `decisionReason`, `blockedPath` and `suggestions`. The spike shows `title`
  when present.
- **`canUseTool` result (differs from the brief):** `updatedInput` is optional, and `deny` also takes
  `interrupt?: true`. The spike returns the input unchanged on allow and `interrupt: true` when denying because of
  an interrupt.
- **The authentication failure (not in the brief):** there is no auth subtype on the result. The run produces:
  1. an `assistant` message with `error: 'authentication_failed'` and the text `Invalid API key · Fix external API
     key`;
  2. a `result` with `subtype: 'success'`, `is_error: true` and `terminal_reason: 'api_error'`;
  3. then the iterator throws `Claude Code returned an error result: …`.

  The service keys on the `error` field and keeps `agent.auth` strict (`authentication_failed`, or `invalid api
  key`, `authentication` or `401` in the text). A network failure stays `agent.failed`.
- **`system/init`:** carries `apiKeySource`, `model` (default here: `claude-opus-5-5`) and `skills`.
- **`skills`:** "omitted: … the CLI's own defaults still apply", and it is "a context filter, not a sandbox".
- **Client app identifier:** `CLAUDE_AGENT_SDK_CLIENT_APP` in `env` names the client app in the User-Agent. The
  spike does not set it; the product should.
- **String prompts:** a string prompt with `canUseTool` was accepted. Earlier SDK versions required an
  `AsyncIterable`; this one did not, at least for the keyless turn, where no permission was ever asked.

## What differed from the plan

- **Key storage on Linux without a keyring:** the brief's design (always encrypt into a file) cannot run here,
  because `isEncryptionAvailable()` is `false` on `basic_text`. The spike falls back to memory-only and says so in
  the status line, rather than calling `setUsePlainTextEncryption(true)`. That call would write a file encrypted
  with a fixed in-memory password, which amounts to obfuscation.
- **Deprecated APIs:** in Electron 45, `encryptString`, `decryptString` and `isEncryptionAvailable` are marked
  deprecated in favour of `encryptStringAsync`, `decryptStringAsync` and `isAsyncEncryptionAvailable`. The spike
  uses the sync ones the brief names; P1 should use the async ones.
- **Contract shape:** the contract gained an `output` schema per request and a `chunk` schema per stream; before
  this it had only inputs. That was needed for the "no key in outputs" test, and the handlers now parse outputs.
  `orpc-router.ts` needed `handlers.subscribe<StreamChunk>` for the now-generic `subscribe`.
- **Electron dependency:** `handlers.ts` does not import Electron. `index.ts` calls `attachAgent(...)`, so
  `ws-server.ts` and the vitest suite still load it. The WebSocket dev server, which has no origin check, answers
  every agent operation with `agent.unavailable` (tested in `tests/handlers.test.ts`). That refusal is not what
  keeps the key off the WebSocket: the screen disables the key field unless `window.bridge` exists.
- **Resume scope:** at first the service passed `resume` whenever it had a session id. The real CLI then
  continued the same session in a different folder. `resume` is now passed only in the same folder (unit test,
  and the Electron spec checks the session ids).
- **Test layout:** the vitest `include` now has `src/**/*.test.ts` too, for the brief's test file locations.
- **Test-only env vars in `index.ts`:** `SPIKE_USER_DATA` (its own userData folder per test) and
  `SPIKE_AGENT_EXE=bundled` (to show the packaged failure without the override).
- **Dependencies:** `pnpm add -E @anthropic-ai/claude-agent-sdk@0.3.330` took the version the brief named. It was
  published 20 Nov, and pnpm's minimum-release-age rule did not refuse it, so no exclude entry was added. No
  `allowBuilds` entry was needed: neither the SDK nor its platform package has install scripts, and the 381 MB
  executable arrives as the optional dependency `@anthropic-ai/claude-agent-sdk-linux-x64`. pnpm installed the
  peers `@anthropic-ai/sdk` 1.12.0 and `@modelcontextprotocol/sdk` 1.32.2 automatically. It also re-sorted
  `package.json` keys and re-keyed some lockfile entries. `pnpm install --frozen-lockfile` passes.
- **Masking limits:** each event is serialised and the exact key string is replaced with `[key hidden]`. A key
  split across two streamed text deltas would not be caught; a real build should mask on a rolling buffer or
  per message.

## Packaging (Linux, `electron-builder --dir`, electron-builder 26.18.0)

- **Size:** `release/linux-unpacked` is 767 MB. `app.asar` is 136 MB; the executable unpacked beside it is 381 MB.
  S2's AppImage was 144 MB, so installers will grow by roughly the executable's compressed size. The installer
  was not rebuilt or measured.
- **One platform per build:** electron-builder warns that the other platforms' SDK packages "are not bundled". That
  is fine as long as each OS builds its own installer (the S2 CI does). A cross-build would ship no executable.
- **Executable path:** the SDK finds its executable with `require.resolve` from its own folder, which inside a
  packaged app points into `app.asar`, so `spawn` fails with `ENOTDIR`, even though the file is unpacked.
  `pathToClaudeCodeExecutable`, set to the `app.asar.unpacked` path, is the required fix. The unpacking itself
  electron-builder 26.18.0 did on its own; `asarUnpack` keeps it from depending on that detection.

## Versions that worked

@anthropic-ai/claude-agent-sdk 0.3.330 (bundled CLI 2.1.330), with electron 45.4.1, electron-vite 6.0.0,
electron-builder 26.18.0, zod 4.6.7, vitest 5.1.1, @playwright/test 1.65.1, typescript 7.0.2, Node 24.22.1 and
pnpm 12.4.1.

## Checks run

- **vitest:** `pnpm exec vitest run`: 5 files, 33 tests passed (the 3 that existed before, plus 30 new).
- **Typecheck:** `pnpm run typecheck` (node and web): exit 0.
- **Biome:** `pnpm exec biome check src`: 197 errors, 61 warnings, 131 infos, the same counts as before this task
  (style findings on older spike code). The new files (`src/main/agent/*`, `AgentSpike.tsx`, `tests/contract.test.ts`,
  `tests/agent.electron.spec.ts`, `tests/agent.spec.ts`) check clean.
- **dependency-cruiser:** `pnpm depcruise`: no violations (96 modules, 209 dependencies). `pnpm depcruise:selftest`:
  OK.
- **Playwright, Electron specs:** `xvfb-run -a pnpm exec playwright test` on the smoke, bridge, canvas, orpc and
  agent Electron specs: 8 passed. The packaged agent spec passed separately.
- **Playwright, whole suite:** under `xvfb-run -a`, with `pnpm dev:web`, `dev:ws` and `dev:orpc-ws` running: 38
  passed. An earlier run of the whole suite without `xvfb-run` (37 tests at the time) had 1 failure, which was not
  identified.

## For the architecture (D14)

- **Where the key lives:** in the main process only. `keyStore.ts` encrypts it with `safeStorage` into
  `userData/agent-key.bin` (mode 0600). Where the OS has no encryption (Linux `basic_text`), it is held in memory
  for the run and the status line says so. The store has no getter; the key leaves only as the argument of a
  `withKey` callback in main.
- **What crosses the bridge:**
  - Renderer to main: the key, once, as `agent.key.set` input; the field then clears itself.
  - Main to renderer: `{ stored }`, `{ hasKey, backend }`, `{ started }`, `{ ok }`, `{ interrupted }`, and
    `agent.events`. The events are status, init, text, tool, permission-request, result with cost, error with a
    code, and masked CLI log lines.
  - Every output is zod-parsed against the contract, which strips undeclared fields, and a test fails if any output
    schema gains a `key`, `apiKey` or `token` field.
  - All of it goes through the existing sender-checked IPC. The WebSocket dev transport refuses agent operations.
- **Keeping the key out of logs:** verified for the keyless runs only. Every event is masked before it leaves the
  service (unit-tested on text, tool input, permission input, stderr and thrown errors). Main does not log agent
  traffic, the page never contains the key, and the agent's own config and transcript files do not contain it.
  Not covered: a key split across deltas, crash dumps, and the agent echoing the key into its transcript on a
  live run.
- **Keeping the key from the agent's own shell tool:** **not kept from it, as far as was seen.** The shell tool
  itself is unverified (Step 7). But a project `SessionStart` hook, a child of the same CLI process, **did** see
  `ANTHROPIC_API_KEY` (verified keyless). So whatever the agent or the opened folder runs should be assumed able to
  read the key. Alternatives to evaluate: `apiKeyHelper`, which `ApiKeySource` lists as a source (the key comes
  from a helper, not the env), and a CLI-level env scrub. Neither was tried.
- **Permissions as waiting-for-user requests:**
  1. `permissionMode: 'default'` makes every tool use not pre-allowed call `canUseTool`, which awaits
     `onPermission`.
  2. The service queues the request, shows only the head, and emits `status: waiting-for-user` plus
     `permission-request { requestId, toolName, input, title }`.
  3. `agent.respond { requestId, allow }` resolves the head. Allow returns the input unchanged; deny returns
     "The user denied this action."
  4. Interrupt denies everything pending with `interrupt: true` and aborts.
  5. If the SDK cancels a request (its `signal`), the request is dropped.

  This maps directly onto a "waiting for user" state in the session model.
  - **Caveat:** `settingSources: ['project']` loads the opened folder's `.claude/settings.json`. **Verified for
    hooks:** a `SessionStart` hook ran unprompted and could read the key. Unverified for permission rules: a
    repository could probably pre-allow tools so the card never appears. For folders the user has not vetted, use
    `settingSources: []`, or show and confirm the folder's hooks and rules before the first turn.
- **Session versus turn lifetime:** one `agent.start` is one `query()`, which is one CLI subprocess living for
  one turn. The service keeps the `session_id` from `init` and passes `resume` on the next turn in the same folder.
  The CLI keeps the transcript under the isolated config dir (`projects/<cwd>/<session>.jsonl`). Keyless, against
  the real CLI, the same folder resumed the same session id and another folder got a new one. Resume with a real
  conversation, which needs a key, was not run. The long-lived alternative (an `AsyncIterable` prompt, one process for the
  whole session) was not tried. The app interrupts a running turn on `before-quit`. It does not interrupt when the
  window reloads: the turn continues and its events go nowhere until a new subscription.
- **A waiting request is lost when the screen goes away (found in review, not fixed in the spike):** if the Agent
  tab unmounts while a permission request is pending (tab switch, reload), the new page starts at `idle` with no
  approval card. Nothing replays the status or the request, so Interrupt is disabled, Start answers `agent.busy`,
  and the turn hangs until the app quits. The product must do what the architecture already requires of jobs and
  sessions: replay the current state and any open request to a new subscriber, and deny open requests when the
  project scope closes.
- **Packaging (asar):** works on Linux with `asarUnpack` plus `pathToClaudeCodeExecutable`. Without the override,
  `spawn ENOTDIR`. Each OS must build its own installer. Expect about +380 MB uncompressed per platform.
- **Anthropic's rules (from the brief's documentation check of 23 Nov 2026; not re-checked here):**
  - **Authentication:** third-party products authenticate with an API key, and must not offer claude.ai login or its
    rate limits without Anthropic's approval. The spike offers only a key field and isolates the CLI from any local
    sign-in (`apiKeySource: ANTHROPIC_API_KEY`).
  - **Naming:** the product may say "Claude Agent" but must not call itself "Claude Code". The approval card says
    "Claude Agent wants to use …".
  - **Raw error text:** the SDK's own errors say "Claude Code" (for example `Claude Code returned an error result`,
    and the executable-not-found messages). The product should map errors to its own wording rather than show raw
    SDK text. The spike shows it in some `agent.failed` cases.

## Not run

- All of Step 7, because there was no key: streaming, approve, deny, interrupt, a non-zero cost, `env` through the
  shell tool, and whether the model uses a project skill (keyless, the skill is listed).
- Windows and macOS.
- A `resume` that carries a real conversation (keyless resume ran).
- The installer (AppImage or deb) with the SDK, and its size.
- The encrypted-file path with a real OS keyring: only the fake ran; this machine is `basic_text`.
