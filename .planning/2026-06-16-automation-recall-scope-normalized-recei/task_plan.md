# Task Plan: Automation Recall Scope Normalized Receipt

## Goal
Improve Memory Service work/personal/all scope semantics so legacy or missing stored scopes are returned and displayed with the same effective scope used by recall filtering.

## Current Phase
Complete

## Phases

### Phase 1: Requirements & Discovery
- [x] Read `AGENT.md`
- [x] Check `docs/progressing/to-verify.md`
- [x] Read automation memory
- [x] Check local Reminders list names
- [x] Randomly select a feature from `docs/index.md`
- [x] Inspect target docs, tests, and code
- **Status:** complete

### Phase 2: Planning & Research
- [x] Capture external product/research signals
- [x] Define a small implementation target
- [x] Record plan and findings
- **Status:** complete

### Phase 3: Implementation
- [x] Normalize returned recall item scope for message candidates using the authoritative stored scope column
- [x] Keep scope receipts consistent with the effective scope used by filtering
- [x] Update targeted tests and docs
- **Status:** complete

### Phase 4: Testing & Verification
- [x] Run memory-service recall/ask/context-recall tests
- [x] Run memory search presentation verifier
- [x] Run memory search scope E2E
- [x] Run memory abilities benchmark for RecallEngine change
- [x] Run `npm start` until first successful compile, then stop
- [x] Run scoped `git diff --check`
- **Status:** complete

### Phase 5: Delivery
- [x] Update automation memory with run summary and current time
- [x] Attempt Codex session archive with a real command if session id is available
- [x] Report validation evidence and archive/Reminder status
- **Status:** complete

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Target `工作/个人/全部范围语义` | Selected by single random draw from `docs/index.md`. |
| Keep implementation scoped to normalized recall scope receipts | The feature already has strong scope boundaries; the remaining UX defect is that missing stored scopes are filtered as work but can be counted/displayed as unknown. |
| Do not implement broad scope policy changes | Changing default scopes or cross-domain retrieval would affect recall behavior and require product decisions plus broader evals. |
| No Reminder item will be completed | Reminders was readable, but no `Personal AI` list exists on this Mac. |
| Use `messages_raw.scope` as authoritative over `metadata_json.scope` in returned recall metadata | The recall filter already uses the stored column; returning stale metadata scope would make receipts and UI contradict the actual scope boundary. |

## Errors Encountered
| Error | Resolution |
|-------|------------|
| `shuf` is unavailable on macOS | Re-ran random selection with Ruby. |
| Initial Ruby helper used unsupported `filter_map` | Replaced with `map...compact`. |
| `verify-memory-search-results` had stale expectations for credential-bearing source URLs | Updated verifier and doc to match current safer behavior: hide source URLs containing account info or sensitive query params. |

## Delivery Notes
- Automation memory updated at `/Users/Esone/.codex/automations/automation/memory.md`.
- Codex session archive succeeded: `codex archive 019ece29-eb06-7e51-89a2-6eb4939dd648`.
