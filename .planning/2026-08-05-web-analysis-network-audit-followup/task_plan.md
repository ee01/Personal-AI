# Task Plan: Web Analysis And Background Network Audit Follow-up

## Goal

Implement the approved network-efficiency and webpage-analysis improvements, prioritizing high-value fixes and avoiding low-benefit non-LLM churn that could introduce side effects.

## Current Phase

Complete

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

## Errors Encountered

| Error | Resolution |
|---|---|
| Root planning files belong to an older unrelated task | Created an isolated `.planning/2026-08-05-web-analysis-network-audit-followup/` plan |
| Full webpage-memory E2E still fails at the existing Jira/Compose Assist bubble assertion | Focused webpage-analysis and context-cache checks pass; record the unrelated/overlapping Jira UI regression separately rather than masking it |
