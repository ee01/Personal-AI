# Memory Ingestion Decision Contract Plan

## Target

- Random feature: `记忆摄入、去重、显著性评估`
- Source doc: `docs/memory_system.md`
- Scope: keep the actual ingest/write semantics unchanged, but make the decision receipt contract complete and serializable for clients.

## Research Notes

- Current AI memory products emphasize user control and auditability: ChatGPT exposes saved-memory controls and prioritization, Claude memory import is explicitly experimental and reviewable, and Gemini Enterprise documents saved-memory/source controls.
- Recent memory-agent literature and product guidance point to policy transparency at write time: what becomes memory, what merges, what decays, and what is skipped should be explainable before retrieval quality is judged.

## Implementation Steps

1. Preserve trust/sanitization receipts for duplicate ingest attempts.
   - Classify source trust and screen the incoming payload before returning a duplicate decision.
   - Do not write a new record for duplicates.
   - Include `trustClass`, `sanitization`, and `injectionFlags` in the duplicate decision so batch summary does not collapse them into `unknown`.

2. Serialize merge decisions through API schemas.
   - Add `mergeOp` to `/ingest` and `/ingest/batch` response schemas.
   - Keep it optional and present only when the merge op is not `ADD`.

3. Sync extension-side client types.
   - Add trust/sanitization/injection fields and `mergeOp` to `MemoryServiceClient.IngestDecision`.
   - Add trust/sanitization counters to `BatchIngestDecisionSummary`.

4. Update docs.
   - Summarize duplicate safety receipts and serialized `mergeOp` in `docs/memory_system.md`.

5. Verify.
   - `npm --prefix memory-service test -- --run src/__tests__/api-ingest.test.ts src/__tests__/api-ingest-injection.test.ts src/__tests__/mergeDecision.test.ts`
   - `npm --prefix memory-service run build`
   - `npm start` until first successful compile, then stop it.
   - Memory abilities gate if reachable.
   - Scoped `git diff --check`.
