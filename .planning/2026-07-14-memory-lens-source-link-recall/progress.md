# Memory Lens Source-Link Recall Progress

## 2026-07-14

- Read `AGENT.md` and restored existing planning context.
- Confirmed root planning files and `.planning/.active_plan` belong to other work; created an isolated task directory without changing the shared pointer.
- Queried memory registry for prior Memory Lens/source-link decisions to preserve existing safety and read-only contracts.
- Inspected the supplied JSON response and screenshot; confirmed chunk `68515` points to Source Memory capsule `8121557d-149a-4a80-8f4b-22a2f812350f` but the serialized recall match has an empty `links` array.
- Read the prior Source Memory action-boundary rollout and the `huashu-design` interaction criteria; established that the existing two-destination model should be preserved and the missing data state needs its own fixture.
- Read the current Memory Lens canonical doc and repository link consumers; confirmed the documented `sourceUrl` fallback exists but cannot help this payload because the backend did not serialize any source URL.
- Recorded the relevant dirty-worktree overlap before edits; no implementation changes have been made yet.
- Traced Source Memory capture and chunk recall. Identified a backend fallback gap for legacy/orphaned Source Memory chunks whose capsule still exists but linked `messages_raw` provenance is missing.
- Queried the live capsule read-only and confirmed it stores a safe Google Docs document URL; the bug is definitively propagation, not missing source data.
- Completed the live impact audit and other-consumer inventory; the orphan class affects 477 saved capsules and 2,397 chunks.
- Implemented shared capsule provenance fallback, Source Memory canonical routing/clustering, a passive-fast regression covering both `/context-recall` and `/recall`, and Lens missing/same-host source receipts.
- Updated the canonical Memory Lens doc with the legacy/orphan fallback behavior.
- Passed `api-context-recall` plus `api-recall` (48 tests), the memory-service TypeScript build, the focused webpage-memory verifier, the first successful extension compile, and the webpage-memory Playwright E2E.
- Passed the final scoped `git diff --check`; no live deployment, writeback, backfill, commit, or push was performed.

## 2026-07-14 deployment and backfill continuation

- User explicitly authorized deploying memory-service and backfilling the 477 online capsules with missing recall-signal associations.
- Re-read the repository deployment policy and extended this plan with preflight, backfill implementation, backup/deploy, transactional apply, and real-data validation phases.
- Started parallel read-only audits of deployment topology, dirty-tree sync scope, and the exact idempotent backfill contract; no new remote mutation has occurred yet.
- Reconfirmed the live target counts and disk capacity, and verified all 477 targets still have snapshot files suitable for reconstructing message content.
- Rejected broad `npm run deploy:memory` for this run because it would sync unrelated local changes; verified a narrow two-file patch applies cleanly to the current remote baseline.
- Added a default-dry-run Source Memory recall-signal backfill service and CLI with expected-target gating, snapshot/chunk preflight, an immediate SQLite transaction, provenance markers, and before/after integrity metrics.
- Added tests for dry-run planning, metadata preservation, missing-chunk repair, transactional apply, idempotent rerun, and missing-snapshot blocking.
- Passed the new backfill tests plus context-recall regression (30 tests), memory-service TypeScript build, and scoped `git diff --check`.
- Incorporated independent safety review: preserved snapshot bytes and historical timestamps, stripped capsule-only distillation metadata, blocked out-of-target integrity gaps, and added FTS/timestamp/provenance regression assertions.
- Final local gate passed: backfill + context-recall + recall suites (50 tests), TypeScript build, and scoped whitespace check.
