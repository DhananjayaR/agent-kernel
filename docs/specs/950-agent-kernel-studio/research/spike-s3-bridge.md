# Spike S3: Typed request/stream bridge over Electron IPC and WebSocket, compared with oRPC

**Date:** 2026-11-23  **Ran on:** Linux (WSL2) only  **Time spent:** under 1 day

## Result

Pass with changes — one in-house contract (`contract.ts`, zod) and one screen (`BridgeSpike.tsx`) run unchanged over Electron IPC and
WebSocket; echo, a 10,000-line burst and cancel all work on both, with Electron's sandbox on. The changes: the renderer CSP needed
`connect-src`, and the renderer must also drop in-flight chunks after cancel. oRPC 1.16.5 also passed all three of its questions, so D5 is a
closer call than the brief expected (see the recommendation).

## Pass criteria

| Criterion | Result | Evidence |
|---|---|---|
| Renderer code identical on both transports | Pass | One copy each of `src/renderer/src/bridge/contract.ts` and `src/renderer/src/spikes/BridgeSpike.tsx`, used by both runs (no second file, no build flag). `getTransport()` picks at runtime: `window.bridge` (exposed by the preload) means Electron IPC, otherwise `createWsTransport('ws://localhost:5181')`. The screen prints which one it got; `tests/bridge.spec.ts` sees `transport: websocket`, `tests/bridge.electron.spec.ts` sees `transport: electron-ipc`. Both specs call the same helpers in `tests/bridge-checks.ts`. |
| Cancel stops the process on all three systems | Linux only: Pass. Windows and macOS: deferred by the owner (23 Nov 2026) | Linux: vitest `streams lines in batches and stops the process on cancel` (3 passed); Playwright on both transports (table below). `taskkill /T /F` (Windows) and `process.kill(-pid)` on macOS are untested. |
| A 10,000-line burst does not freeze the window | Pass on Linux | Both transports: count reached 10000, worst frame 17 ms (limit 100) in headless Chromium and in Electron under xvfb. A person should still watch it on a real display. |

### Step 10, scripted (Linux, WSL2). "Children" counts live `node -e` stream processes with `pgrep`.

| Check | WebSocket (browser, `pnpm dev:web` + `pnpm dev:ws`) | Electron IPC (built app, `electron.launch`) |
|---|---|---|
| Echo | `{"text":"hi"}` | `{"text":"hi"}` |
| Burst 10,000 | count 10000, worst frame 17 ms, 0 children afterwards | count 10000, worst frame 17 ms, 0 children afterwards |
| Slow stream, then Cancel | count 84 at Cancel, 84 700 ms later; 1 child while running, 0 after | count 100 at Cancel, 100 after 700 ms (a second run: 101/101, 89/89); 1 child while running, 0 after |
| Close page / window mid-stream | `page.close()`: 0 children | `app.close()` (app quit): 0 children. Only quit was tested, not closing a window while the app stays alive (on Linux the last window closing quits the app anyway). |
| Reload the page mid-stream | n/a | `page.reload()`: 0 children, and the reloaded page echoes again. Without the navigation hook in `main/index.ts` the same test fails (1 child left), so the hook is needed. |
| Preload exposes only `bridge` | n/a | `window.electron` and `window.api` are `undefined`, `window.bridge` is an object |

Windows and macOS: deferred by the owner (23 Nov 2026); Linux only for now. The CI workflow is written but has never run. Windows and macOS Task Manager/Activity Monitor checks: not done, need a person.

Process-tree kill: the spike's child has no grandchildren, so the vitest test does not prove tree kill. Separately (a throwaway script, not in the
repo) a detached `node` that spawned `sleep 61` was killed with `process.kill(-pid, 'SIGTERM')`: grandchild count 1 before, 0 after. That is
Linux process-group behaviour only.

## oRPC (`@orpc/server` / `@orpc/client` 1.16.5, `@orpc/contract` 1.16.5)

Code: `src/main/orpc-router.ts` (router), `src/main/orpc.ts` (Electron MessagePort), `src/main/orpc-ws.ts` (WebSocket, port 5182),
`src/renderer/src/bridge/orpc-contract.ts`, `src/renderer/src/spikes/OrpcProbe.tsx`. Tests: `tests/orpc.electron.spec.ts`, `tests/orpc.spec.ts`.

| Question | Answer | Evidence |
|---|---|---|
| Does a streamed response arrive incrementally in the renderer? | Yes | An `async function*` handler, consumed with `for await`. Counts sampled 250 ms apart while the stream ran: Electron `[182, 401, 619]`, WebSocket `[190, 402, 612]`. Burst reached 10000 on both. |
| Does aborting it in the renderer stop the child in main? | Yes | `client.demo.run(input, { signal })` then `abort()`: the renderer promise ends with `AbortError`, count froze (Electron 661/661, WebSocket 639/639), 0 children. The handler's `finally` ran `stop()` (the same `handlers.subscribe` cancel). |
| Does the same client code work over HTTP or WebSocket? | Yes (WebSocket tried; HTTP not tried) | `OrpcProbe.tsx` builds the same `createORPCClient` and calls; only the link differs (`message-port` link vs `websocket` link). Same router served by `@orpc/server/ws`. |

Things that differed or need care:

- The Electron adapter page shows `port.start()` on the main side; it also needs `port1.start()` in the renderer when the link uses a DOM
  `MessagePort` (done in `OrpcProbe.tsx`). The page has no section on streaming or abort; the answers above come from running it.
- The Electron adapter needs a preload `message` listener that forwards the port. It is not a `contextBridge` export, but with it enabled
  any script in the page can open a channel to the oRPC router by posting `start-orpc-client`, and the main-side port handler has no
  sender check. In this spike both are off by default and enabled only with `SPIKE_ORPC=1` (main passes `--spike-orpc` to the preload,
  and registers `registerOrpc()`); the oRPC specs set it. So the default app's preload exposes `bridge` and nothing else.
- Sharing types: importing the server router type into the renderer drags `node:child_process` into the web typecheck (TS2591 errors). The
  working shape is contract-first (`@orpc/contract` `oc` + `implement()`), with the contract in the renderer-safe folder. That needs the zod
  stream-chunk schema re-declared (`eventIterator(chunk)`) next to `StreamChunk`.
- Added `@orpc/contract` as a third pinned package; the brief named two. Bundle/dependency weight not measured.
- Not tested for oRPC: closing the window mid-stream (only abort and `app.close()` after an abort), Windows and macOS.

## What differed from the plan

- TypeScript 7 / vite 8 / vitest 5: `vitest run` found no tests because `vite.config.ts` sets `root: src/renderer`. Added `vitest.config.ts`
  (root = app dir, `include: tests/**/*.test.ts`) and `playwright.config.ts` (`testMatch: **/*.spec.ts`, `workers: 1`). One worker is required:
  the process checks count children machine-wide, and parallel files broke each other.
- `tsconfig.node.json` includes `src/renderer/src/bridge/contract.ts` (and `orpc-contract.ts`), because `handlers.ts` imports them; without that
  the node typecheck cannot resolve the files. TypeScript 7 has no `baseUrl`, so the relative import is the only route.
- CSP: the renderer's `default-src 'self'` blocks the WebSocket (confirmed by removing the rule: echo never arrives). Added
  `connect-src 'self' ws://localhost:5181 ws://localhost:5182`. The meta tag also applies in plain-browser dev. This is a dev-only
  rule; a packaged build does not open WebSockets, so drop it there (or keep the WS transport off in production).
- Preload replaced by the brief's narrow `bridge` object; template `window.electron`/`window.api`, `preload/index.d.ts` contents and the
  `ping` handler removed. The Electron sandbox stayed on (`sandbox: true`); the spec launches without `--no-sandbox`.
- `main/index.ts`: subscriptions are tracked per window and cancelled on `bridge:unsubscribe`, on the window's `destroyed`, on
  `render-process-gone`, and on a main-frame, non-same-document `did-start-navigation` (reload or navigation; `destroyed` does not fire for
  those). The brief's code only cancelled on `bridge:unsubscribe`. The reload case is covered by a Playwright test that fails without the hook.
- `bridge:unsubscribe` also checks the sender (`fromOurWindow`); the brief's code did not.
- `pnpm add -E` pins: zod 4.6.7 installed. `pnpm-workspace.yaml`: pnpm 12 listed `esbuild` (pulled in by tsx) as an unapproved build script;
  set to `false`, tsx works without its postinstall.
- Step 10 scripted rather than done by hand: `tests/bridge.spec.ts`, `tests/bridge.electron.spec.ts`, helpers `tests/bridge-checks.ts`.
- The cancel check allows no chunks after cancel because the transports drop the listener (IPC `removeListener`, WS `streams.delete`) before
  the process stops; main also stops emitting (`cancelled` flag).

## Versions that worked

vitest 5.1.1, zod 4.6.7, ws 8.23.0, @types/ws 8.18.2, tsx 4.23.15, @orpc/server / @orpc/client / @orpc/contract 1.16.5, with electron 45.4.1,
electron-vite 6.0.0, vite 8.3.8, typescript 7.0.2, @playwright/test 1.65.1, Node 24.22.1, pnpm 12.4.1. All pinned exactly.

## Recommendation for the decision record

Decided 23 Nov 2026 by the owner: in-house contract, not oRPC (P0 D5). The text below is the spike's recommendation at the time.

D5: the in-house contract (op id, zod schema, `request`/`subscribe`) is the leading option, with oRPC as the named alternative. This is a
judgment call, not a settled result: the brief's rule ("if any answer is no, in-house") did not trigger, because all three oRPC answers
were yes, and the decision record should present D5 as open. What leans it in-house, from what was observed: the bridge is 150 lines
(`wc -l` on `src/main/handlers.ts`, `src/main/ws-server.ts`, `src/renderer/src/bridge/contract.ts`, `src/renderer/src/bridge/transport.ts`,
`src/preload/index.ts`; the bridge glue in `src/main/index.ts` is extra), one renderer-safe `contract.ts` is shared, and cancel and batching are
our own code, so they behave the same on both transports.

Sender checks, exactly: the in-house Electron IPC checks `senderFrame` (`fromOurWindow`) on `bridge:request`, `bridge:subscribe` and
`bridge:unsubscribe`. Gaps: the WebSocket dev server (`ws-server.ts`, and `orpc-ws.ts`) has no origin check and binds all interfaces; it is a dev
stand-in for a future hosted transport, not a hardened server. The oRPC Electron path has no sender check at all.

oRPC cost list: a preload port-forwarding listener that lets any page script open a channel to the router (so it is gated behind a
spike flag here); no sender check on the port handler; a third package (`@orpc/contract`) for renderer-safe types; contract-first
declaration of the stream chunk schema twice (`StreamChunk` and the zod schema). oRPC gave typed calls and abort for less client code. If
the team values end-to-end types for many operations it is a reasonable swap, because `handlers.ts` would not change. Decide when the
operation count is known; either way keep `handlers.ts` transport-free.

Test portability: `tests/bridge-checks.ts` counts children with `pgrep -fc`, which does not exist on macOS (no `-c`) or Windows, so the bridge
Playwright specs (`bridge*.spec.ts`, `orpc*.spec.ts`) are Linux-only as written. Task 5's CI needs a portable process counter or must skip
them on other systems; the vitest cancel test (`tests/handlers.test.ts`, via `runningProcessCount`) is the cross-platform check. Windows and
macOS cancel remain unverified; the owner deferred both systems on 23 Nov 2026.

D8: nothing observed argues against Zustand, TanStack Query or TanStack Router; none of them was exercised here. Recommend them as listed. One
note for the stream UI: the screen holds only a count; a real log view should append batches to a store outside React state and render
by frame.
