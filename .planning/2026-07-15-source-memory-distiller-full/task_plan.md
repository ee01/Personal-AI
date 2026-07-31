# Source Memory Distiller Full Implementation Plan

Goal: extend the shipped P0 deterministic save-time Source Memory distillation into the remaining production-ready capability, while preserving clear boundaries from Self Reflection and Dream Replay and updating canonical feature docs after verification.

## Phases

| Phase | Status | Scope |
| --- | --- | --- |
| 1 | complete | Inspect current P0 runtime, schema, workers, LLM/reflection/dreaming patterns, tests, docs, and dirty-worktree overlap |
| 2 | complete | Finalize the smallest compatible architecture and contracts for async deep distillation, retries/idempotency, open questions, skill candidates, and cross-capsule aggregation |
| 3 | complete | Implement the async deep-distillation producer and lifecycle without profile/action writeback |
| 4 | complete | Implement aggregation and downstream consumption while preserving P0 fallback behavior |
| 5 | complete | Add targeted tests and a Source Memory distillation experience eval for generated-output quality |
| 6 | complete | Update canonical `docs/features/` behavior, boundaries, source-of-truth files, and validation guidance |
| 7 | complete | Run focused tests, build/type checks, evals, and path-scoped whitespace validation; fix until green or document an unrelated shared-gate residual |

## Decisions

- P0 deterministic distillation remains the synchronous save-time fallback and must not depend on an LLM.
- Async deep distillation enriches the same capsule contract and must be idempotent by source snapshot/input hash.
- Source Memory Distiller may produce evidence-grounded open questions and skill candidates, but it must not confirm profile facts, execute actions, or silently publish skills.
- Self Reflection owns user-level interpretation and durable self-model updates; Dream Replay owns cross-memory associative recombination; Source Memory Distiller owns source-local extraction plus source-family aggregation.
- Existing unrelated worktree changes are user/other-task owned and must not be reverted or staged.
- Add migration 055 with one internal job table, evidence spans, normalized candidate artifacts, and origin/hash columns for deep takeaways/triggers. Keep the complete readable pack under `metadata.distillation.deep` for capsule/detail consumers. Migrations 052-054 now belong to concurrent capabilities and remain untouched.
- Enqueue by P0 `inputHash`; one current job per capsule. Claim with a lease, retry with bounded backoff, and preserve terminal diagnostics without changing P0 `status`.
- Block deep LLM processing for `private`, `needs_review`, dismissed, missing-evidence, or injection-flagged sources. These sources retain the deterministic pack and an explicit deep policy receipt.
- Generate evidence spans deterministically first, then allow model outputs to reference only those IDs. Drop any takeaway/candidate/seed without valid evidence.
- Build cross-capsule clusters only from strong shared anchors (canonical URL, Jira key, explicit entity/seed key); update derived metadata/links without merging or deleting capsules.
- Materialize a Skill Foundry suggestion only for repeated high-confidence seeds, with `notify=false`; all single-source seeds remain candidates on the capsule.
- Extend Storyline drafting with a `source_memory_seed` evidence adapter and the existing manual-copy/no-write generation receipt.

## Errors Encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
| A refreshed capsule inherited the previous deep pack while the new hash was queued | Audit after initial green run | Reset readable deep state when `inputHash` changes; require current succeeded job hash for Skill seed aggregation; add regression tests |
| Eval runner could not create the `tsx` IPC socket inside the managed sandbox | 1 | Reran the same suite outside the sandbox; 5/5 cases passed and all five readerProof claims are proved |
| Playwright Chromium was terminated with `EPERM` inside the managed sandbox | 1 | Reran the existing Source Memory E2E outside the sandbox; it passed |
| First memory-abilities rerun used a repository snapshot with 0 messages / 1 chunk | 1 | Marked the run invalid and reran current-branch service against a fresh copy of the populated 21-message / 937-chunk isolation source |
| Memory abilities temporal score remained 0.67 vs 1.00 baseline | 2 valid attempts | Both attempts used only `daily_log` / `reflection_thread` evidence and LLM timeout fallback, with no Source Memory/deep projection; retained as an unrelated shared Ask/retrieval residual |
| Webpack watch reported `EMFILE` after the first successful compile | 1 | Required first compile completed successfully; stopped watch immediately as prescribed |
