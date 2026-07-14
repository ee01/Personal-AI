# Evidence Watch read receipts

## Target

- Random feature: `证据守望契约` from `docs/features/index.md`.
- Source of truth: `docs/features/evidence_watch_contracts.md`.
- Reminder check: EventKit found `Personal AI` with 4 total items and 0 incomplete items; all completed items are historical Doubao / notification feedback and unrelated to Evidence Watch.

## Research scan

- ChatGPT Scheduled Tasks supports recurring tasks and change monitoring; this reinforces separating "watch configured" from "meaningful update found".
- Google Alerts is explicitly about new results for a topic, not proof that an existing source was rechecked.
- FreshLLMs / FreshQA shows fast-changing knowledge and false-premise questions remain risky for static LLM answers, so stale conclusions need explicit freshness boundaries.
- Truth Maintenance Systems record reasons for beliefs and update beliefs when assumptions change, matching contract/run receipts rather than a single flattened status.

## Improvement Plan

1. Preserve the existing Evidence Watch status receipt for compatibility.
2. Add explicit read-only receipts for contract detail and run-history API reads, naming that they do not recheck authority sources, append runs, create actions, confirm fact changes, send notifications, or mutate contract state.
3. Extend focused API tests to assert these receipts through detail and run-history flows.
4. Update docs/features and index copy only at the user-visible behavior level.
5. Validate with memory-service tests, eval validation/run, dev compile, and scoped diff checks.
