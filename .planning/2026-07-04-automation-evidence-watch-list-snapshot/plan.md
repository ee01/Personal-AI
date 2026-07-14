# Evidence Watch List Snapshot Plan

## Target

- Feature: `证据守望契约`
- Source doc: `docs/features/evidence_watch_contracts.md`
- Primary code: `memory-service/src/routes/evidenceWatchContracts.ts`, `memory-service/src/core/EvidenceWatchContractService.ts`

## Context

- `docs/progressing/to-verify.md` has no carry-over work.
- AppleScript did not list `Personal AI`, but EventKit found it with 4 completed historical Doubao / Notification items and no Evidence Watch-related open feedback.
- External scan:
  - ChatGPT Scheduled Tasks separates task setup, recurring checks, and meaningful-change notifications.
  - Google Alerts exposes alert frequency/source filters, reinforcing explicit monitor scope.
  - FreshQA / FreshLLMs highlights fast-changing and false-premise facts as a recurring LLM failure mode.
  - Truth Maintenance System work supports keeping belief reasons and revision receipts rather than only a latest answer.

## Problem

`GET /api/v1/evidence-watch-contracts?state=<invalid>` currently normalizes the invalid state to `undefined`, and the route falls back to `all`. For a feature whose job is to keep changing facts honest, a typo in `state` should not silently return the full set.

The list response also returns contracts without a list-level read receipt. A user or UI caller can see items, totals, and pagination, but the API does not explicitly say this was a read-only snapshot that did not recheck sources, create actions, confirm facts, or mutate contracts.

## Implementation Steps

1. Add a service-level list snapshot receipt that includes `state`, optional `subjectKey`, `limit`, `offset`, returned count, total, read time, and a clear read-only boundary.
2. Change the list route to reject invalid `state` query values with `400` and a short receipt instead of falling back to `all`.
3. Keep the successful list payload backward-compatible by adding `receipt` without removing `items`, `total`, `limit`, or `offset`.
4. Extend the API test to cover both the read-only snapshot receipt and invalid-state fail-closed behavior.
5. Update `docs/features/evidence_watch_contracts.md` with the new list receipt and invalid-filter boundary.
6. Verify with targeted memory-service tests, `eval:validate`, Evidence Watch eval, dev webpack compile, and scoped whitespace checks.
