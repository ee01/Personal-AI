# Evidence Watch Time Basis Sweep

## Target

- Randomly selected feature: `证据守望契约`
- Canonical doc: `docs/features/evidence_watch_contracts.md`
- Main implementation: `memory-service/src/core/EvidenceWatchContractService.ts`

## Reminder Check

- EventKit found the local `Personal AI` Reminders list.
- Total items: 4.
- Incomplete items: 0.
- No Reminder item was incorporated or marked done.

## External Scan

- ChatGPT monitoring tasks remember previous runs and stop when an end condition is met, so a monitoring receipt needs to distinguish "task exists" from "this run checked a source".
- Google Alerts exposes alert frequency, reinforcing that monitoring UX should keep cadence and freshness visible rather than just saying an alert exists.
- Temporal QA / RAG papers emphasize that answers and evidence can be correct historically while invalid at query time, so Evidence Watch receipts need a clear time basis.
- Truth-maintenance literature supports keeping belief justifications and update receipts separate instead of collapsing them into a single latest answer.

## Improvement Plan

1. Add read-receipt time basis fields for Evidence Watch detail and run history snapshots.
2. Preserve read-only behavior: no run append, no authority recheck, no action creation, no notifications, and no contract mutation during reads.
3. Extend API tests to prove new contracts show `nextCheckAt` without `lastCheckedAt`, while blocked verification runs show `lastCheckedAt` and no next schedule.
4. Update canonical docs and the feature index.
5. Run targeted memory-service tests, Evidence Watch eval, dev build, Ask E2E, and scoped diff checks.

## Non-Goals

- No change to contract dedupe keys, state transitions, Action Queue behavior, confirm-request routing, or external OpenClaw/Jira verification.
- No new UI page for Evidence Watch management in this pass.
