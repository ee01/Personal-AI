# Progress Log

## Session: 2026-08-05

### Current Status

- **Phase:** Complete
- **Started:** 2026-08-05

### Actions Taken

- Read repository instructions, prior capture audit memory, and the planning-with-files workflow.
- Preserved unrelated root planning files by creating an isolated plan.
- Carried forward verified aggregate counts from the supplied cURL capture.
- Traced Agent Thinking tool exposure, validation, within-run deduplication, and approval boundaries.
- Traced Glip marker refresh to full `Messages` and `Logs` sheet reads; confirmed `getRecentPushLogs(500)` slices after the full download and that `getAllMessages()` can normalize/write rows.
- Ran three synthetic `gpt-5-nano` comparisons: current initial prompt, one current thinking decision, and a proposed focused single-call prompt; no tools or external writes were executed.
- Confirmed a material quality failure on the static page and user-context contamination on both valuable pages.
- Flagged the notification feed/delivery count contradiction as an unresolved provenance issue rather than over-attributing all repeats to polling.
- Produced a durable recommendation covering the webpage architecture, prompt contract, request-by-request token boundary, notification delivery, background cache/single-flight, Logs semantics, Sheet/Glip incremental refresh, priorities, and acceptance checks.

### Test Results

| Test | Expected | Actual | Status |
|---|---|---|---|
| Planning isolation | No overwrite of unrelated root plan | New isolated plan created | pass |
| Repo OneAPI comparison route | Obtain current-model results | 401 invalid token; no result/cost incurred | fail-safe |
| Captured OpenAI route | Three synthetic comparison cases | 9 calls completed without tool execution | pass |

### Errors

| Error | Resolution |
|---|---|
| None | N/A |

## Session: 2026-08-06

### Current Status

- **Phase:** Complete
- **Started:** 2026-08-06

### Actions Taken

- Re-read `AGENT.md`, restored the isolated implementation plan, and inspected the dirty-worktree boundary.
- Recorded the user's instruction to implement the prior plan while skipping low-yield non-LLM optimizations with material side-effect risk.
- Added Annotation 1 as an explicit verification item: confirm whether Logs are inserted newest-first before redesigning reads.
- Confirmed the Logs append contract: newest events are inserted at row 2. The implementation will preserve head-based “recent 500” semantics and optimize only the Google Sheets range read.
- Replaced the passive webpage `IntelligentAgent` loop with one focused `llm.ts` extraction, strict page-evidence normalization, and an explicit `stored: false` boundary; automatic use now sits after the existing deterministic Memory Capture candidate gate.
- Reused the existing page-capture timer as the stable debounce, removed focus/DOMContentLoaded automatic LLM triggers, changed the page identity to a full semantic snapshot hash, and added background/session result cache plus cross-tab single-flight. Manual analysis uses `force=true` but still joins an identical in-flight request.
- Added background/session cache and single-flight for passive context recall, keyed by the filtered request and UI language.
- Changed Chrome Notification Center polling to explicit `incremental`, one delivery POST per poll, and a bounded local outbox that is flushed before the next feed read.
- Changed recent Logs refresh from a full worksheet download to a bounded `Logs!1:{limit+1}` range, relying on the verified row-2 insertion contract.
- Added focused E2E coverage for cross-tab webpage-analysis reuse, cross-refresh context-recall reuse, notification batching, and failed-delivery outbox replay.
- Updated canonical feature docs and added a deterministic four-case webpage-analysis contract eval.
- Deliberately left the broad Messages/Glip snapshot path unchanged because editable/reorderable rows and migration-on-read behavior do not provide a safe incremental cursor.
- Verified that the configured HTTPS memory-service hostname currently fails TLS/SNI negotiation while HTTP health succeeds; no default URL migration was made.

### Test Results

| Test | Expected | Actual | Status |
|---|---|---|---|
| Active planning context | Continue the web/network audit plan | Switched active plan from an unrelated recall audit to this task | pass |
| Focused webpage/cache/Logs unit tests | Semantic hash, evidence guard, TTL/cache behavior, row-2 log contract | 11 passed | pass |
| Passive webpage contract eval | Four representative normalize/grounding fixtures | 4/4 passed; synthetic boundary disclosed | pass |
| Usage capability coverage | Every LLM call site declares a capability | 19 call sites checked | pass |
| Dev extension compile | First webpack watch compile succeeds | Compiled successfully, then watcher stopped | pass |
| Focused webpage-analysis E2E | Same snapshot reuses one background/model result across toggles/tabs | Passed | pass |
| Focused context-cache E2E | Reload reuses response; changed URL requests new context | Passed | pass |
| Notification delivery E2E | One incremental poll writes one batched receipt | Passed | pass |
| Notification outbox E2E | Failed batch replays before next feed without redisplay | Passed | pass |
| Full webpage-memory E2E | All legacy and new scenarios pass | Existing Jira/Compose Assist bubble assertion still fails | residual failure |
| Scoped whitespace check | No malformed task-owned diffs | `git diff --check` passed | pass |

### Errors

| Error | Resolution |
|---|---|
| Active plan initially pointed to another concurrent task | Switched `.planning/.active_plan` to this isolated plan before edits |
| New Logs contract assertion used the wrong Apps Script local variable | Updated the assertion to match the actual `logRow` write; runtime implementation was unaffected |
| Full E2E does not render the expected Jira context bubble when the Compose Assist prerender icon is present | Kept the failure visible; focused tests prove this task's cache/routing behavior, but the overlapping Jira UI regression remains outside this narrow change set |

## Session: 2026-08-12

### Current Status

- **Phase:** Complete with external certificate/credential actions
- **Started:** 2026-08-12

### Actions Taken

- Reopened the completed plan after the user requested full closure of all remaining work.
- Re-ran the current worktree rather than relying on 2026-08-06 evidence.
- Confirmed the focused webpage-analysis, context-cache, notification batching, and notification outbox E2E checks still pass.
- Reproduced the complete E2E Jira failure: one context-recall request is sent, but `.pai-context-bubble` does not become visible within 12 seconds.
- Rechecked transport: HTTP health returns 200 while HTTPS fails TLS SNI negotiation with `unrecognized name`.
- Preserved the active plan pointer for another concurrent task and continued this task through its isolated plan directory.
- Fixed both Compose Assist invalidation entry points to use the current Jira context before suppressing a pending Lens response.
- Added a focused `jira-context` E2E mode; it now passes.
- Continued the complete E2E and found the next boundary: repeated selected-text recall was incorrectly served from the passive background cache. Updated the cache policy so explicit `selected_text` actions bypass completed-result reuse.
- Rebuilt the extension and reran the complete webpage-memory E2E. It now passes every browser scenario, including Jira reading-state coexistence and repeated selected-text freshness.
- Inspected configured providers without printing credentials. The `.env` internal OneAPI key now returns 401, `.env.development` does not contain a direct OpenAI key, and local Ollama is unavailable.
- Ran the exact production webpage-analysis prompt against the deployed Claude provider with four synthetic fixtures; all passed after the production evidence normalizer.
- Traced HTTPS to Nginx Proxy Manager host 4 and confirmed no valid `memory.xmnup.com` certificate is available. Kept HTTP unchanged rather than installing a mismatched or self-signed certificate.
- Recorded the safe migration order for browser-side provider secrets and the provider-authority steps for the captured OpenAI/Jira credentials.
- Added `.env` backup patterns to `.gitignore` without reading or deleting the existing local backup.
- Completed the final unit, eval, compile, focused E2E, full E2E, notification batching, outbox replay, and scoped whitespace checks.

### Test Results

| Test | Actual | Status |
|---|---|---|
| Focused unit tests | 11/11 passed | pass |
| Passive webpage contract eval | 4/4 passed | pass |
| LLM capability coverage | 19/19 annotated | pass |
| Dev extension compile | webpack compiled successfully | pass |
| Focused webpage-analysis E2E | passed | pass |
| Focused context-cache E2E | passed | pass |
| Notification batch E2E | passed | pass |
| Notification outbox replay E2E | passed | pass |
| Complete webpage-memory E2E | Jira context request sent once; bubble absent | fail, diagnosis in progress |
| Focused Jira Context Bubble E2E after repair | reading-state icon and Lens coexist; one recall request | pass |
| Complete webpage-memory E2E after both repairs | all browser checks passed | pass |
| Local configured real-provider probe | internal OneAPI `/models` returned 401; Ollama unavailable | blocked locally; remote provider discovery next |
| HTTPS health | TLS SNI failure; HTTP remains 200 | fail, diagnosis pending |
| Remote provider health | `/ask` returned HTTP 200 with the deployed provider | pass |
| Live focused webpage-analysis eval | 4/4 synthetic production-prompt cases passed | pass |
| Live webpage-analysis usage | 760-788 input, 99-518 output tokens; 2.3-7.4s | recorded |
| HTTPS certificate inventory | No `memory.xmnup.com` certificate; only a `milo.xmnup.com`-only SAN certificate exists | externally blocked |
| Browser-side provider-secret migration | Unsafe to migrate only this feature before a trusted HTTPS service route exists | deferred with migration order recorded |
| Captured credential rotation | OpenAI and Jira revocation require provider authority/new secrets; old Google access tokens are short-lived | user/provider action required |
| Final dev extension compile | webpack compiled successfully in 15.6s; watcher stopped | pass |
| Final focused Jira E2E | Jira reading state and Compose Assist icon coexist | pass |
| Final focused page-analysis E2E | focused page analysis and capture checks passed | pass |
| Final focused context-cache E2E | background context recall cache checks passed | pass |
| Final complete webpage-memory E2E | all browser checks passed | pass |
| Final notification batch E2E | one incremental poll wrote one batched receipt POST | pass |
| Final notification outbox E2E | failed batch replayed before next poll; no duplicate display | pass |
| Final scoped whitespace check | no malformed task-owned diff | pass |

### Errors

| Error | Resolution |
|---|---|
| Full E2E originally stopped at the Jira reading-state bubble | Passed Jira context into both Compose Assist suppression callers; focused Jira E2E now passes |
| Full E2E then expected a fresh repeated selected-text request but background returned a cache hit | Excluded explicit `selected_text` actions from the passive completed-result cache |
| First remote Docker probe could not find `docker` in the non-login SSH PATH | Used the explicit `/usr/local/bin/docker` path; no remote state was changed |
| Remote Ask probe initially returned 403 without user identity | Repeated with `X-User-Id: esone.qiu`; the real provider request completed with HTTP 200 |

## Session: 2026-08-12 Current Request-Frequency Recheck

### Current Status

- **Phase:** 14 - Measure Current Real Traffic
- **Started:** 2026-08-12

### Actions Taken

- Reopened the isolated network-audit plan after the user asked for a current real request-volume check and, if necessary, a simulation-based estimate.
- Defined separate evidence layers for real gateway traffic, current-build mock traffic, and source-derived cadence estimates so they are not presented as interchangeable proof.

### Test Results

| Test | Actual | Status |
|---|---|---|
| Prior capture baseline | 5,035 parseable requests; 336 direct OpenAI calls | historical baseline only |
| Current gateway log window | 15,964 requests over 50.1 hours | measured |
| Current last 24 hours | 6,896 requests, 287.5/hour | high non-LLM volume confirmed |
| Current last 6 hours | 1,998 requests, 334.4/hour | high non-LLM volume confirmed |
| Current notification delivery | 2 batched POSTs in 24 hours | expected post-fix reduction |
| Notification feed cadence | 99/24h, median interval 900s | matches 15-minute alarm |
| Profile startup reads | 713/24h, median interval 74s | suspicious MV3 restart amplification |
| Glip/concerned/follow reads | about 994-999 each/24h, median interval 60-64s | far above declared five-minute cadence |

### Errors

| Error | Resolution |
|---|---|
| First gateway aggregation script mixed CommonJS `require` with top-level `await` under Node 24 | Wrap the streaming parser in an async IIFE before rerunning; no source or remote state changed |
| Follow-up SSH tail failed with `Network is unreachable` | Keep the already-collected 24h/6h gateway aggregates, verify immediate state from the connected Chrome tab, and disclose that no later five-minute tail delta was available |
| `webpage-mcp` native bridge socket was not running | Used the installed Chrome browser connector for read-only tab/runtime inspection; no bridge repair was attempted |

### Additional Real And Simulated Results

| Check | Actual | Status |
|---|---|---|
| Frontend LLM telemetry, latest 24h | 452 attempts: 292 new passive failures, 32 legacy Agent Thinking webpage calls, 128 message-analysis calls | high failed-attempt volume confirmed |
| Successful frontend token telemetry | 653,958 tokens across legacy webpage + message analysis | measured; failed passive attempts reported zero tokens |
| Current Chrome tab | Fresh `Failed to fetch` from one-call passive webpage analysis at 12:19 local | current provider failure confirmed |
| Focused current-build page-analysis E2E | One LLM request across repeated evaluation and same-snapshot second tab | passed |
| Focused current-build context-cache E2E | Reload reused one recall; different URL added one | passed |
| Stable eligible page cadence from source | About 16 deterministic score POSTs over first eight minutes; successful LLM at most one per semantic snapshot, but failures may retry with each eligible score | remaining retry-storm risk |
| Nominal long-lived-worker idle model | About 43 gateway requests/hour plus startup | source-derived estimate |
| Measured overnight floor | 154-178 gateway requests/hour | MV3 restart amplification remains |

## Session: 2026-08-12 Runtime Frequency Repair And Webpage Analysis Recovery

### Current Status

- **Phase:** Complete; installed Chrome extension needs one manual reload
- **Started:** 2026-08-12

### Actions Taken

- Resumed the isolated network-audit implementation plan after the user authorized the proposed fixes and required working webpage analysis.
- Re-read `AGENT.md`, the planning skill, current audit findings, and the historical memory registry before making runtime edits.
- Scoped the implementation to failure backoff, persistent MV3 bootstrap throttling, threshold-only candidate scoring, usage-analytics visibility, and end-to-end provider validation.
- Completed the repair design: the extension will use a dedicated one-shot memory-service route, failures receive a persisted 5/10/15-minute cooldown, automatic startup reads use storage-backed leases, and candidate scoring runs only when dwell/copy/scroll thresholds change.
- Confirmed that manual analysis keeps `force=true`, which bypasses completed-result and failure cooldown caches while still joining an identical in-flight request.
- Added the memory-service route/service and extension client/background bridge; removed the now-unused browser-direct passive LLM runner.
- Added storage-session failure backoff, storage-local persistent bootstrap throttling, and threshold/candidate reuse in the content script.
- Added backend final-failure usage telemetry and documented how the Usage Analytics dashboard differs from the raw SQL audit table.
- Passed 13 focused extension helper tests, 11 memory-service LLM/service tests, memory-service TypeScript build, helper verifier, capability coverage, and two successful webpack development compiles.
- Passed focused Playwright extension E2E for success cache/single-flight, deterministic candidate reuse, failure cooldown across tabs, manual force retry, and recovery to a grounded `remember` result.
- Ran the production service against the configured real provider with synthetic content: 9.0 seconds, `remember`, 1 fact, 1 action, all evidence grounded in the supplied page text.
- Confirmed the deployed `/source-memory/webpage-analysis` route also returns HTTP 200: 9.9 seconds, `remember`, 4 facts, 1 action, with every evidence span grounded in the synthetic page.
- Read back the resulting analytics row: backend Memory Capture, route `/source-memory/webpage-analysis`, Claude Sonnet 4.6, success, 873 input and 637 output tokens.
- Ran the full webpage-memory Playwright extension suite after the focused checks; every browser scenario passed.
- Inspected the installed Chrome development extension against a synthetic local page. It still runs the pre-rebuild bundle and logged the old direct-provider `Failed to fetch`; Chrome browser-control policy blocked operating `chrome://extensions`, so one manual extension reload remains before the installed instance can exercise the passing bundle.
- Reviewed the dirty-worktree delivery boundary and did not create a separate commit or push. During this run, concurrent local commit `4aea6af` (Roadmap) incorporated the current `src/background.ts`; remaining target files still overlap Recall/Jira/device-key work or are untracked, so rewriting/staging them as a clean task commit would be unsafe.

### Test Results

| Check | Actual | Status |
|---|---|---|
| Focused extension helpers | 13/13 passed | pass |
| Memory-service LLM + webpage service tests | 11/11 passed | pass |
| Memory-service build | TypeScript compiled successfully | pass |
| Extension dev compile | webpack compiled successfully twice; watchers stopped | pass |
| Focused webpage-analysis E2E | success reuse, threshold reuse, failure cooldown, manual retry, recovery passed | pass |
| Full webpage-memory E2E | all browser checks passed | pass |
| Passive webpage contract eval | 4/4 passed | pass |
| Eval registry validation | 25 suites valid; 4 planned-suite warnings only | pass |
| Local configured provider | 9.0s, grounded `remember` | pass |
| Deployed webpage-analysis route | HTTP 200 in 9.9s, grounded `remember` | pass |
| Installed Chrome extension | old bundle still logs direct-provider `Failed to fetch` | manual reload required |

### Errors

| Error | Resolution |
|---|---|
| First backoff hydration test failed because the root TS 4.7 test target downleveled direct `Map` iteration without `downlevelIteration` | Iterated an explicit entries array; rerun passed 13/13 |
| First focused E2E could not restore the candidate chip after a site-control toggle because evaluation dedupe survived request invalidation | Clear the evaluation signal on invalidation; focused and full reruns passed |
| Browser connector cannot control `chrome://extensions` | Preserved the synthetic test tab and documented one manual reload/refresh step; no browser-policy workaround attempted |
