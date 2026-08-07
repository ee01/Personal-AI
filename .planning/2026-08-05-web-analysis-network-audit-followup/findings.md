# Findings: Web Analysis And Background Network Audit Follow-up

## Requirements

- Compare current `agentThinking.ts` webpage analysis against a focused single `llm.ts` request.
- Explain whether Agent Thinking performs tool calls and whether that is useful or risky.
- Diagnose same-snapshot reruns without active user interaction and assess debounce/hash/single-flight fixes.
- Run controlled real model examples and judge expected product value and prompt quality.
- Classify every other captured request by LLM/token consumption, duplication cause, and likely trigger.
- Explain notification batching/mode, background cache/single-flight, recent 500 Logs, and incremental Sheet/Glip impact.
- Implement the approved high-value changes while avoiding low-benefit non-LLM churn with material side-effect risk.

## Evidence Ledger

- Previous capture audit: 336 direct OpenAI calls; 335 were webpage-analysis templates, 89 initial runs, 246 planning rounds, 73 repeated same normalized 2,000-character snapshots.
- Current source has a 5-second analysis interval check before `setTimeout`, but no analysis timer handle and no callback-time recheck.
- Content script sends `WEB_INTELLIGENCE_ANALYSIS` fire-and-forget; background starts a fresh `IntelligentAgent` with `analysisDepth: normal` and no cross-run content hash/in-flight key.
- Agent webpage analysis always makes one initial LLM call, then can make up to 3 decision calls; decision output may request tools.
- The thinking loop exposes the entire registered tool catalog to the model. It validates each proposed call, blocks unknown/missing-parameter calls, deduplicates identical calls within one agent run, and requires approval for tools marked write/notify/delete. Read-only registered tools may execute automatically.
- Therefore Agent Thinking is not merely deeper text analysis: it adds an action-selection loop and can execute approved/read-only tools. The capture's 246 thinking calls for 89 starts show the loop was commonly paying for about 2.76 extra LLM decisions per page start.
- `getRecentPushLogs(500)` reads the whole `Logs` worksheet, then slices rows 1..500 locally. The number means “take at most the first 500 data rows returned,” not a server-side recent/changed-only query; correctness also depends on the sheet's row ordering.
- The marker refresh also calls `getAllMessages()`. That method reads the whole `Messages` worksheet and may write back missing IDs or normalized `Push_Method` values during what appears to callers as a read path.
- Passive context recall is proxied by background to memory-service; the extension call path itself does not call `llm.ts`. It is a retrieval request, though backend internals should be audited separately before claiming zero server-side inference.
- Captured direct OpenAI bodies used `gpt-5-nano` with no explicit output-token cap.
- The live comparison used the captured `gpt-5-nano` route with three synthetic fixtures and did not execute tools. The repo `.env` OneAPI credential was attempted first but returned 401, so it produced no model result.
- Jira fixture: current initial call used 2,194 total tokens and the first thinking call used 1,522; the proposed single call used 3,083. Current output contaminated extracted entities with every project/person from user context. The thinking call proposed `jiraQuery` with an unsupported `jql` parameter.
- Chat fixture: current initial + first thinking used 2,615 + 2,038 total tokens; proposed single call used 4,345. Current output again copied unrelated projects/people from user context. Thinking proposed `jiraQuery.params.jql` and `historySearch.params.query`; the former is silently ignored and falls back to a broad recent-issues search, while the latter is blocked because required `content` is missing.
- Static-noise fixture: current initial + first thinking used 3,137 + 2,341 tokens and incorrectly returned `shouldStore=true`, high priority, and a fabricated cross-project retention reason; proposed single call used 1,707 and correctly returned `skip` with no durable facts.
- Across the three fixtures, current initial + just one thinking step consumed 13,847 total tokens versus 9,135 for the proposed single call (34.0% lower). Production current flow can make up to two additional thinking calls, so this understates the multi-step cost gap.
- The proposed single-call prompt was directionally more precise, but still too verbose on valuable pages (especially the chat fixture's 3,520 reasoning tokens) and added an unnecessary enrichment hint on the static page. The production prompt should cap facts/actions, require empty enrichment hints on `skip`, and set an explicit output/reasoning budget supported by the chosen model.
- `jiraQuery` accepts no required parameter and ignores unknown parameters; a model-proposed `jql` therefore passes validation and executes the default `updated >= -30d` search. Tool parameter schemas need `additionalProperties: false` behavior plus one-of validation (`issueId|issueIds|keywords`).
- `historySearch` requires `content`; the model naturally proposed `query`, so that call is blocked. Prompt-visible schema and runtime validation are misaligned with natural model output.
- Despite background/content-script logs saying the page was “processed and stored,” the webpage path only returns the `WebpageAnalysisResult`; the content script only logs it. The only currently registered tools are read-only `historySearch` and external-read `jiraQuery`; no storage tool is registered. The captured webpage LLM spend therefore did not itself create a durable, searchable memory.
- Capture quality anomaly: 66 notification feed calls with requested limit 20 can yield at most 1,320 poll-loop items, but the capture contains 2,537 one-event `delivered` POSTs. Current client has no HTTP retry. The excess cannot be attributed to the visible poll loop alone; likely candidates include another/older caller, multiple extension instances/workers, or capture composition. Add caller version, extension instance, worker run, poll run, and batch identifiers before claiming one root cause.
- The attachment has 5,060 curl starts, of which 5,035 contain a reconstructable URL; 25 malformed/truncated starts cannot be safely classified. Endpoint totals should use 5,035 as the auditable denominator and disclose the 25-record gap.
- Source-memory candidate scoring is deterministic server code, not LLM. The page capture evaluator intentionally re-scores up to every 30 seconds while dwell time approaches 90s/240s/480s thresholds, so most of its 208 requests are changing interaction snapshots rather than identical duplicates. It should score only on threshold crossings or material interaction changes.
- Composer Assist has timer replacement, request signatures, stale-snapshot checks, and per-session in-flight gating. Its low exact duplicate rate is consistent with draft/focus revisions, not the webpage-analysis timer race. Backend LLM use is conditional: web-agent prompt compile uses LLM; ordinary RingCentral compose can remain retrieval/rule-only under production defaults.
- The 84 captured `/recall` requests omitted `blockTypes`, so `ActiveRecallService` takes its evidence-only no-LLM branch. Passive `/context-recall` is explicitly designed with no LLM in the path.
- Notification delivery is a deterministic database receipt write. It does not need an LLM. Poll currently omits `deliveryMode`, so the server defaults to `retry_after_cooldown`; for a Chrome incremental poller, explicitly selecting `incremental` is the safer semantic unless repeated reminders are an intentional product behavior.
- `getRecentPushLogs(500)` is misnamed/ambiguous: it downloads the entire Logs sheet and keeps the first 500 data rows. Unless the sheet is maintained newest-first, this is not “recent.”
- Confirmed the missing ordering contract in the current Apps Script: `appendLog()` inserts every new record after the header and writes it to row 2. `Logs` is therefore intentionally newest-first. The current first-500 selection is logically correct; only the full-tab transport is wasteful. The low-risk redesign is a bounded header-plus-first-`limit` A1 range read, not a tail cursor or client-side sort.
- The worktree contains substantial user changes, including overlapping edits in `src/background.ts`, `src/contentScriptWebIntelligence.ts`, `src/scheduled-messages/ScheduledMessageService.ts`, and `src/sheet.ts`. Implementation patches must stay narrow and preserve those changes.
- Scope rule for the implementation pass: prioritize LLM/token reduction and clearly redundant network traffic. Do not introduce durable queues, new persistence semantics, or broad incremental-sync machinery unless the current contract makes the improvement low-risk and directly testable.
- The safest way to merge focused LLM analysis into Memory Capture is after `MEMORY_CAPTURE_SCORE_PAGE` reports an eligible ordinary webpage. Visual-memory candidates retain their existing deterministic/manual flow, and LLM failure falls back to the existing candidate result instead of blocking capture.
- The existing `pageCaptureTimer` already provides timer replacement/debounce. Reusing it and removing the separate automatic analysis timer avoids two competing page-analysis schedulers; significant DOM changes schedule a candidate reevaluation only after an intent threshold is present.
- Notification delivery batching alone has a repeat-on-failure hole under incremental feed semantics. A bounded local outbox can close it without changing server persistence: flush receipts before polling; if the flush still fails, skip that poll so the same items are not displayed again while their delivery receipts are pending.
- Broad Messages/Glip incremental caching is intentionally deferred in this pass. Unlike newest-first Logs, editable/reorderable Messages and remote marker snapshots lack a safe local change cursor; changing them now would add stale-marker behavior and migration-write coupling for a non-LLM optimization.
- Implementation now reads only `Logs!1:{limit+1}`. Because the writer inserts each new log at row 2, `getRecentPushLogs(500)` is both logically newest-first and transport-bounded; no cursor, client sort, or full reconciliation change is needed for this path.
- The configured HTTPS memory-service hostname currently fails during TLS/SNI negotiation while the HTTP health endpoint succeeds. Migrating the extension default to HTTPS before fixing the gateway certificate would be a breaking change, so it remains an operational follow-up.
- Focused extension E2E passes for webpage-analysis reuse and context-recall cache behavior. The combined legacy E2E still fails at a Jira/Compose Assist context-bubble assertion, which is kept as a separate overlapping regression rather than attributed to the new cache path.

## Controlled Test Safety

- Do not reuse captured Jira/chat bodies in live model tests.
- Do not instantiate a path that may execute Agent Thinking tools.
- Use synthetic fixtures and direct prompt calls only; record response usage and latency without printing credentials.

## Issues Encountered

| Issue | Resolution |
|---|---|
| Existing root planning files are unrelated and dirty | Use isolated plan directory and preserve existing files |
