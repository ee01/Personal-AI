# Web Analysis And Background Request Recommendation

## Executive decision

1. Retire `IntelligentAgent.analyze({type: 'webpage'})` from passive page observation.
2. Merge passive webpage analysis into the existing source-memory candidate/capsule pipeline.
3. Use one focused LLM extraction only after deterministic eligibility and semantic-snapshot dedupe pass.
4. Keep Agent Thinking only for an explicit user action such as “deep analyze / verify with Jira or memory,” with tools disabled by default and a maximum of one tool-decision round.

The current passive Agent Thinking path costs up to four LLM calls per start, can launch read-only Jira/recall requests, and does not persist the resulting webpage analysis. Its prompt also optimizes for “project-management relevance,” which produced false-positive storage decisions and copied user-context entities into page facts.

## Proposed webpage pipeline

```text
DOM/URL/focus/mutation signal
  -> debounce to a stable semantic snapshot
  -> local eligibility and sensitive-page guard
  -> canonical page key + semantic content hash
  -> background result cache / single-flight
  -> one focused LLM extraction (only for eligible new content)
  -> deterministic policy: skip / suggest review / auto-capture candidate
  -> source-memory capsule write only through the existing explicit capture contract
```

### Trigger and dedupe contract

- Keep one `analysisTimer`; every automatic trigger clears and replaces it.
- Set the running guard before the first awaited operation and recheck it in the timer callback.
- Remove passive deep analysis from `window.focus`; focus may refresh passive recall UI, but it must not cause a new LLM run when the page snapshot is unchanged.
- Build a canonical page key from normalized URL plus page identity: Jira issue key, RingCentral conversation/root ID, or generic canonical URL.
- Build a semantic snapshot from stable main content, excluding extension-owned nodes, navigation, badges, unread counts, typing indicators, live regions, and known timestamp-only churn.
- Hash the full normalized snapshot used for change detection, not only the first 2,000 prompt characters.
- Automatic runs use a cache key such as `user + pageKey + snapshotHash + promptVersion + model + preferenceVersion`.
- Manual runs set `force=true` and bypass result cache, but still join an identical in-flight request.
- Exact duplicate: always skip. Near-duplicate with only volatile-shell changes: skip. Material field/message changes: run once after the quiet period.

### Background cache and single-flight

- `Map<analysisKey, Promise<Result>>` in background joins concurrent requests from timers/tabs into one LLM operation.
- Store completed positive/negative results in `chrome.storage.session` so content-script reloads and service-worker restarts within the browser session do not immediately repeat them.
- Suggested TTLs: negative/skip 10–30 minutes, positive result 30–60 minutes; content hash changes invalidate immediately.
- Do not use TTL as the primary correctness rule: unchanged hash is the primary skip reason; TTL controls revalidation and model/prompt version changes.
- Emit reason-coded telemetry: `manual`, `url_changed`, `content_changed`, `same_hash_skipped`, `volatile_only_skipped`, `joined_inflight`, `cache_hit`, `model_run`.

### Single-call prompt contract

- Role: Personal AI webpage memory selector, not a generic project-management assistant.
- Page text is untrusted data. User context is only a relevance filter; names/projects from it must never become extracted page facts without page evidence.
- Output `skip | remember | update_existing`, no action execution.
- Keep at most 4 durable facts and 3 action items, each with a direct evidence span.
- Require empty facts/entities/enrichment hints for `skip`.
- `shouldNotify=true` only for a newly observed, time-sensitive risk that meets an explicit notification policy.
- Use strict JSON schema, reject unknown fields, and configure an output/reasoning budget supported by the selected model.
- Any optional enrichment request is a typed hint (`jira_issue`, `memory_search`) returned to the caller. It is never executed during passive analysis.

## Agent Thinking and tool safety

Current Agent Thinking exposes `historySearch` and `jiraQuery`; both are read-only and may run without approval. It can therefore create extra memory-service and Jira requests even though it does not currently write or notify.

The controlled run found schema failures:

- Model used `jiraQuery.params.jql`, which runtime ignores; because no Jira parameter is required, it falls back to a broad “updated in 30 days” search.
- Model used `historySearch.params.query`; runtime requires `content`, so validation blocks it.

If Agent Thinking remains for manual deep analysis:

- validate unknown parameters (`additionalProperties: false`);
- require exactly one Jira selector among `issueId | issueIds | keywords`;
- align tool names with model-facing schema (`query` versus `customQuery/content`);
- return a visible approval preview for external reads when the query scope is broad;
- cache tool results in background and cap the loop to one decision round unless the user explicitly continues.

## Controlled model comparison

The test used three synthetic pages on the captured `gpt-5-nano` route. It ran current initial prompt + one thinking decision, versus one focused prompt. No tools executed.

| Fixture | Current result | Focused one-call result | Current tokens (2 calls) | One-call tokens |
|---|---|---|---:|---:|
| Jira blocker | Correct core facts, but copied unrelated context people/projects; requested unsupported Jira params | Remembered blocker, decision, owners, dates; no tool | 3,716 | 3,083 |
| Chat rollout | Correct decision, but copied unrelated entities; requested two malformed tool calls | Remembered rollout decision/condition/owner/date | 4,653 | 4,345 |
| Static docs shell | Incorrectly store=true, high priority, fabricated cross-project value; requested tools | Correctly skipped with no facts | 5,478 | 1,707 |
| Total | Up to two more thinking calls were not included | One call only | 13,847 | 9,135 |

The one-call route used 34.0% fewer total tokens even against only one of up to three thinking rounds. Its valuable-page responses were still more verbose than necessary, so the final schema/output budget should be tighter.

## Other captured request classes

| Class | Count | LLM/token behavior | Duplicate/trigger assessment | Recommendation |
|---|---:|---|---|---|
| OpenAI chat completions | 336 | Yes; 335 structurally classified webpage calls, remaining call also matches webpage prompt family | Legacy webpage timers + Agent loop | Replace passive Agent with one-call gated pipeline |
| Notification delivery | 2,537 | No | One event per POST; repeated delivery signatures; count exceeds what 66 feeds × limit 20 can explain | Instrument caller provenance, batch per poll, durable retry queue |
| Sheet Messages | 365 | No | 5-minute marker refresh plus other Scheduled Messages reads/user actions | Cache; separate read from migration writes; refresh on dirty/manual + safety interval |
| Context recall | 262 | No by service contract | 188 identical-body repeats in parsed sample; passive DOM/focus/context churn and per-tab cache loss | Background single-flight + session cache |
| Source candidate score | 208 | No; deterministic | Mostly changing dwell/scroll snapshots, not exact repeats | Re-score on threshold crossings/material interactions, not every 30 seconds |
| Glip markers | 200 | No | Expected 5-minute background refresh | Version/ETag or stale-while-revalidate cache |
| Sheet Logs | 200 | No | Same marker refresh; full-sheet download | Append cursor/tail range + periodic reconciliation |
| Concerned items | 195 | No | Periodic/startup sync; state/version checks make it intentional polling | Conditional/versioned pull and longer quiet interval |
| Keystone events | 140 total across brief IDs | No for event recording | Mostly UI exposure/action telemetry; repeated `shown` can follow rerenders | Once per brief/surface/session + event batching |
| Recall | 84 | No for captured bodies; none requested `summary` | Mostly active retrieval/tool activity; low exact-repeat rate | Keep; cache identical short-window reads |
| Notification feed | 66 | No | Intentional 15-minute poll; mode omitted | Set `deliveryMode=incremental` explicitly for Chrome |
| Composer assist | 52 | Conditional: web-agent prompt compilation uses backend LLM; ordinary RingCentral path can be retrieval/rule-only under production defaults | Low duplicate rate; has debounce/signature/stale checks; mainly focus/draft/user-driven | Keep existing gates; share background cache if cross-refresh repeats matter |
| Jira issue/search/project/rules | 192 total in listed capture paths | No themselves | Mix of page enhancement, Agent read tools, automation/config UI, and user navigation; capture alone cannot assign every call | Cache safe GETs by normalized query; tag caller/feature/user-action |
| DORA release metrics | 128 | No | Jira page enhancement per dependency/version; repeats with page re-analysis/reinitialization | Background version-key cache + single-flight |
| Health | 15 | No | Expected monitoring | Keep, optionally back off when offline |
| Profile items | 10 | No | Config/profile reads | Cache by version |
| Apps Script exec/content/version/deployment | 30 | No LLM | Setup/update/verification workflow; some calls may be user-driven and some load-time checks | Never mutate on passive page open; cache metadata and require explicit update action |
| Ingest | 4 | LLM extraction is config-conditional and defaults off in production; embedding is separate from chat tokens | All four bodies unique Jira ingests | Keep dedupe-before-extraction; expose whether extraction ran in receipt |
| Source capsule/selection | 5 | No for route itself | Explicit capture/selection actions | Keep |

The attachment contains 5,060 `curl` starts, but only 5,035 have a URL that the parser can reconstruct; 25 malformed/truncated starts are not safely classifiable. The table accounts for the 5,035 parseable requests.

## Notification delivery

Notification delivery does not need an LLM. It records deterministic channel receipts.

Recommended flow:

1. Poll with explicit `deliveryMode=incremental` for Chrome.
2. Create the returned Chrome notifications.
3. Collect all delivered/failed receipts in memory.
4. POST one batch (schema already allows up to 100 events).
5. If the POST fails, store the batch in a bounded `chrome.storage.local` outbox and retry with an idempotency key.

This is stronger than batching alone. Without an outbox/idempotency contract, a failed batch can cause the same feed items to be shown again. If recurring reminders are wanted, schedule a new occurrence/source reference or use an explicit digest mode instead of relying on the default six-hour todo cooldown.

Before attributing all 2,537 POSTs to this poller, add `extensionVersion`, `instanceId`, `workerRunId`, `pollRunId`, and `caller` to delivery metadata/logging: 66 feeds at 20 items cannot produce more than 1,320 poll-loop delivery events in the current code.

## “Recent 500 Logs”

This is not application debug logging. It is the Scheduled Messages `Logs` worksheet: dispatch history used to mark Glip posts as AI push/AI report/AI send-as-me and to derive delivered scheduled-message IDs.

The writer contract has now been confirmed: every new execution inserts a row immediately after the header and writes the event to row 2. The first 500 data rows are therefore the newest 500.

Implemented correction:

- preserve the verified newest-first ordering instead of adding a cursor or client-side sort;
- read only the bounded header-plus-data range `Logs!1:{limit+1}` from Google Sheets;
- keep the existing 500-row marker window and parsing contract unchanged.

This is lower risk than a tail cursor because inserting at row 2 shifts all row numbers, so a row cursor would not be stable. A timestamp/execution cursor is unnecessary until the product needs history beyond the current latest-500 marker window.

## Sheet/Glip caching and incremental refresh

The original full-read design is understandable: Sheets is not a change-feed database, Messages rows are editable/reorderable, and rebuilding all markers is the simplest way not to miss external edits or deletions.

The current cost is disproportionate: every 5-minute marker refresh reads all Messages, all Logs, and the complete memory-service marker snapshot. `getAllMessages()` can also generate IDs or normalize `Push_Method` and write rows during a read path.

Recommended split:

- Messages: cached snapshot with stale-while-revalidate; refresh on extension writes, manual refresh, startup, and a 15–30 minute safety interval. For true external edits, use ETag/version or an Apps Script `updatedSince` endpoint.
- Logs: bounded newest-first head read, because the writer inserts at row 2; avoid an unstable row cursor.
- Memory-service Glip markers: add version/ETag or `since` cursor.
- Move ID/backfill/normalization out of `getAllMessages()` into an explicit migration command with a receipt.
- UI should show marker cache freshness and provide manual refresh.

Expected impact: substantially fewer Google auth/API calls and faster background wakeups, at the cost of bounded marker staleness. With a 15-minute safety refresh plus dirty-event refresh, user-created/edited scheduled messages remain immediate while external direct Sheet edits may appear within the safety window. Incremental logic must retain a reconciliation path for deletions, reorder, and historical edits.

## Prioritized implementation plan

### P0 — stop waste and false positives

1. Disable passive `agentThinking` webpage loop behind a feature flag.
2. Fix timer replacement, pre-await running guard, semantic snapshot hash, and content-script/background single-flight.
3. Remove focus-triggered deep analysis for unchanged content.
4. Correct logs/UI copy so “processed” is not described as “stored” unless a capsule write succeeded.
5. Add request provenance telemetry and rotate/redact the OpenAI and Google credentials exposed in the capture; move memory-service traffic to HTTPS.

### P1 — make webpage memory useful

1. Add the focused one-call prompt/schema and explicit token budget.
2. Route eligible results into the existing source-memory candidate/review/capsule contract.
3. Add synthetic regression fixtures for blocker, decision chat, static shell, volatile badge-only change, and same-snapshot rerun.
4. Preserve Agent Thinking only for manual deep enrichment and repair tool schemas.

### P1 — reduce non-LLM request noise

1. Batch notification delivery and set Chrome feed to `incremental`; add durable outbox/idempotency.
2. Move context-recall cache and single-flight to background/session scope.
3. Re-score page capture only at material interaction thresholds.
4. Deduplicate Keystone `shown` events per session and batch telemetry.

### P2 — Sheet/Glip efficiency

1. Separate pure reads from data migration writes.
2. Add cached Messages snapshots and versioned Glip markers only after a trustworthy change-version contract exists; keep Logs on the bounded newest-first head read.
3. Add freshness receipts/manual refresh and scheduled full reconciliation.

### Acceptance checks

- Opening/focusing an unchanged page for 30 minutes produces at most one passive webpage LLM call.
- A burst of 20 DOM mutations produces one stable-snapshot analysis.
- Two tabs with the same snapshot join one background request.
- A badge/unread/timestamp-only mutation produces zero new LLM calls.
- A material Jira status/comment or chat-message change produces exactly one new call.
- Static generic pages return `skip`; user-context entities never appear without page evidence.
- Passive webpage analysis executes no tools; manual deep analysis shows exactly which external read is proposed.
- One notification poll produces at most one delivery POST, and a successful Chrome item is not returned by the next incremental poll.
- Marker cache exposes freshness; direct Sheet edits converge within the declared safety interval.
