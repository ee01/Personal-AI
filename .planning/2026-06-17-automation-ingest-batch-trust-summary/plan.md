# Automation Plan: Ingest Batch Trust Summary

## Target

- Feature index row: `记忆摄入、去重、显著性评估`
- Source doc: `docs/features/memory_system.md`
- Code surface: Memory Service ingestion API, especially `/ingest/batch`

## Findings

- Recent automation already handled Ask, Task Scheduler, Today Pilot, Decision Center, Jira Import, Agent Thinking, Compose Assist, Topic Messages, Doubao Bridge, and other nearby surfaces, so this run rerolled to Memory Ingestion.
- Local Reminders is readable, but there is no visible `Personal AI` list, so no Reminder item is included or completed.
- Existing uncommitted code already adds ingest-side trust classification and injection flags for single `/ingest`.
- `/ingest/batch` still needs the same per-result response schema and a batch-level trust/sanitization summary, otherwise import/sync UIs cannot show whether a batch contained untrusted or flagged memories without inspecting every row.

## External References

- OpenAI and Claude memory controls emphasize visible memory management, source/scope boundaries, and user oversight.
- Microsoft 365 Copilot semantic indexing treats permission and storage boundaries as part of retrieval trust.
- Recent memory-poisoning papers show persistent agent memory is a separate attack surface from ordinary prompt injection; batch receipts should expose flagged/untrusted ingests as a first-class operational signal.

## Implementation Steps

1. Add trust and sanitization count fields to `BatchIngestDecisionSummary`.
2. Add `trustClass`, `sanitization`, and `injectionFlags` to the `/ingest/batch` per-result response schema.
3. Count trusted/internal/untrusted and clean/flagged/unknown decisions in `buildBatchDecisionSummary`.
4. Add focused API coverage for a mixed malicious webpage + trusted manual batch.
5. Update `memory_system.md` with the new batch receipt behavior.
6. Validate with focused tests, build/watch compile, memory ability regression gate, and scoped diff checks.
