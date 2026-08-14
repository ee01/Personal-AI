# Task Plan: Web Analysis And Background Network Audit Follow-up

## Goal

Implement the approved network-efficiency and webpage-analysis improvements, prioritizing high-value fixes and avoiding low-benefit non-LLM churn that could introduce side effects.

## Current Phase

Phase 14

## Phases

### Phase 1: Trace Current Contracts
- [x] Map Web Intelligence trigger, background handoff, Agent Thinking loop, tools, and write boundaries
- [x] Map all captured request classes to code owners and whether they consume LLM tokens
- **Status:** completed

### Phase 2: Diagnose Duplication
- [x] Reconstruct timer, mutation, cache, reload, and active-user trigger paths
- [x] Separate identical payloads, same-content snapshots, intentional polling, and user actions
- **Status:** completed

### Phase 3: Controlled Real-Model Comparison
- [x] Build 3 synthetic representative webpage cases with expected outcomes
- [x] Run current prompt chain without tool execution or external writes
- [x] Run a proposed single-call prompt and compare utility, correctness, latency, calls, and token usage
- **Status:** completed

### Phase 4: Design Options
- [x] Decide Agent Thinking versus one-call LLM routing by use case
- [x] Specify debounce, content-hash dedupe, page/background single-flight, cache keys, and telemetry
- [x] Specify notification batching/mode and Sheet/Glip incremental caching impact
- **Status:** completed

### Phase 5: Delivery
- [x] Re-read findings and evidence
- [x] Deliver prioritized implementation plan, tradeoffs, and validation plan
- **Status:** completed

### Phase 6: Confirm Current Overlaps And Contracts
- [x] Inspect user-owned diffs in overlapping runtime files before editing
- [x] Confirm Scheduled Messages Logs insertion order and define the correct incremental-read contract
- [x] Select the smallest high-value implementation scope from the approved plan
- **Status:** completed

### Phase 7: Implement Webpage Analysis Routing And Dedupe
- [x] Replace passive Agent Thinking with a focused single-call webpage analysis
- [x] Add semantic snapshot hash, timer debounce, pre-await guard, and background single-flight/cache
- [x] Preserve manual force analysis and truthful storage/write boundaries
- [x] Add targeted regression tests and update canonical docs
- **Status:** completed

### Phase 8: Implement High-Value Non-LLM Optimizations
- [x] Batch notification delivery and explicitly use incremental poll mode
- [x] Move cross-refresh context-recall cache/single-flight into background/session scope
- [x] Optimize Logs/Glip refresh only where insertion-order evidence supports a safe incremental design
- [x] Skip low-benefit changes whose side-effect risk exceeds measured gain, with rationale
- **Status:** completed

### Phase 9: Validate And Deliver
- [x] Run targeted tests and dev extension compile
- [x] Run focused extension E2E for cross-context behavior where practical
- [x] Review owned diff, document remaining boundaries, and hand off without staging unrelated changes
- **Status:** completed

### Phase 10: Repair Full Webpage Memory E2E
- [x] Trace the Jira/Compose Assist suppression and context-bubble render path from the failing fixture
- [x] Add or tighten a regression check at the actual failure boundary
- [x] Implement the smallest compatible fix without disturbing newer Roadmap/background changes
- **Status:** completed

### Phase 11: Validate The Focused Prompt Against A Real Provider
- [x] Discover a currently configured provider without printing or persisting credentials
- [x] Run only synthetic, non-sensitive webpage fixtures through the production prompt/runtime normalizer
- [x] Record utility, grounding, latency, and usage; adjust prompt only if failures are reproducible
- **Status:** completed

### Phase 12: Close Transport And Credential Boundaries
- [x] Diagnose the HTTPS SNI/certificate route and locate its owned deployment configuration
- [ ] Fix and verify HTTPS if the relevant infrastructure is safely in scope and reachable (blocked: a new certificate for `memory.xmnup.com` must be issued/imported)
- [x] Evaluate browser-side direct provider credentials and defer removal until a trusted HTTPS service route exists
- [x] Record credential rotation steps that necessarily require user-issued secrets/provider authority
- **Status:** blocked_external

### Phase 13: Final Regression And Delivery
- [x] Run targeted unit/eval/capability checks and the first successful dev compile
- [x] Run focused and complete extension E2E plus notification outbox checks
- [x] Review the owned diff, update canonical docs, and deliver only task-owned changes
- **Status:** completed

### Phase 14: Measure Current Real Traffic
- [x] Establish the observable log window and distinguish deployed/live traffic from the old capture
- [x] Aggregate recent `memory.xmnup.com` requests by endpoint, time bucket, status, and caller where logs allow
- [x] Check whether current live traffic can prove direct LLM call volume or only memory-service volume
- **Status:** completed

### Phase 15: Run A Controlled Current-Build Frequency Simulation
- [x] Exercise the current built extension against synthetic pages and mock services without spending live LLM tokens
- [x] Count requests for stable dwell, DOM churn, reload, material content change, selected text, and notification polling
- [x] Estimate idle/hourly and active-session request distributions from source cadences plus measured dedupe behavior
- **Status:** completed

### Phase 16: Compare And Deliver
- [x] Compare old capture rates with current real and simulated distributions using explicit evidence boundaries
- [x] Identify any remaining high-volume or anomalous endpoint and whether it consumes LLM tokens
- [x] Provide a checkable frequency/distribution table and practical monitoring recipe
- **Status:** completed

### Phase 17: Design Failure-Safe Scheduling And Usage Visibility
- [x] Confirm the Usage Analytics document/dashboard exposes feature, status, error, model, call, and token breakdowns used in the audit
- [x] Define persistent MV3 startup throttles and webpage-analysis negative-cache/backoff contracts
- [x] Define threshold-only page-candidate scoring without weakening copy/scroll/material-change triggers
- **Status:** completed

### Phase 18: Implement Targeted Runtime Repairs
- [x] Add successful-result cache plus bounded failure backoff for passive webpage analysis, with manual bypass
- [x] Persist and share bootstrap sync cooldowns across MV3 service-worker lifetimes
- [x] Reduce page-candidate score requests to decision-changing thresholds and material interaction/content changes
- [x] Add focused telemetry/test observability without exposing page contents or credentials
- **Status:** completed

### Phase 19: Validate Webpage Analysis End To End
- [x] Run targeted unit and extension E2E tests for successful analysis reuse, failure cooldown, manual retry, and semantic changes
- [x] Run `npm start` through the first successful development compile and stop the watcher cleanly
- [x] Relaunch a fresh unpacked extension instance against synthetic pages and prove the current prompt result is usable
- [x] Verify real-provider reachability with synthetic content where credentials and transport allow; otherwise report the exact external blocker
- **Status:** completed

### Phase 20: Close Documentation And Delivery
- [x] Update canonical feature documentation and usage-analytics guidance for the new scheduling/telemetry behavior
- [x] Review only task-owned diffs, run whitespace checks, and summarize measured before/after request bounds
- [x] Commit and push only if the task-owned staging set can be isolated safely under the repository delivery gate (no separate task commit/push; a concurrent Roadmap commit incorporated `src/background.ts`, while the remaining target files still overlap unrelated work)
- **Status:** completed

## Decisions Made

| Decision | Rationale |
|---|---|
| Analysis only; no runtime edits | User explicitly asked to analyze and propose first |
| Use synthetic representative pages for live LLM tests | Avoid sending captured private Jira/chat content and avoid tool/write side effects |
| Exercise the configured model endpoint directly | Compare prompts and token/call cost while keeping Agent Thinking tools disabled |
| Runtime implementation is now authorized | User explicitly asked to execute the approved plan on 2026-08-06 |
| Preserve overlapping dirty files | The worktree contains extensive user changes, including target files; inspect and patch narrowly |
| Optimize non-LLM calls selectively | User explicitly prefers skipping low-benefit changes with performance/side-effect risk |
| Keep Messages/Glip full reconciliation unchanged | Editable/reorderable rows have no safe cursor; caching them now could create stale or missing markers |
| Keep HTTP service URL for now | The current HTTPS endpoint fails TLS/SNI validation, so changing the client before the gateway certificate is fixed would break requests |
| Resume this completed plan for final closure | The user explicitly asked on 2026-08-12 to finish every remaining item |
| Keep the focused prompt unchanged after the live eval | Four synthetic production-prompt cases passed against the configured Claude provider after runtime evidence normalization |
| Do not reuse the `milo.xmnup.com` certificate | Its SAN covers only `milo.xmnup.com`; using it for `memory.xmnup.com` would still fail hostname validation |
| Do not move only webpage analysis onto the current HTTP memory route | It would remove one bundled provider-key use but expose page contents in transit and leave every other extension LLM call unchanged |
| Move passive webpage analysis behind a dedicated memory-service route now | The feature is currently unusable through the configured browser Dify app, the same page body already goes to memory-service candidate scoring, and the user explicitly prioritized restoring a working analysis path; the existing HTTP transport limitation remains separately visible |

## Errors Encountered

| Error | Resolution |
|---|---|
| Root planning files belong to an older unrelated task | Created an isolated `.planning/2026-08-05-web-analysis-network-audit-followup/` plan |
| Full webpage-memory E2E initially failed at the Jira/Compose Assist bubble assertion | Passed the current Jira payload into both suppression callers and added a focused regression mode |
| The repaired full E2E then failed on repeated selected-text freshness | Excluded explicit `selected_text` actions from completed-result cache reuse; the final full E2E passes |
