# Compose Rehearsal Readiness Receipt

## Target

- Feature: `回复助手预演提醒`
- Docs: `docs/features/rehearsal.md`, `docs/features/assist.md`
- Main code: `src/composer-guard/ComposerGuardController.ts`

## Findings

- Compose Assist already treats Rehearsal evidence as a hard review boundary before insertion.
- The review receipt currently shows matched cues, script, insertion boundary, and feedback path.
- Backend Rehearsal activation already returns `displayPriority`, `metadata.rehearsal.status`, `validUntil`, and stale/aging reason text through `whyRelevant`.
- The missing UX cue is prompt readiness: users cannot tell whether a rehearsal-backed suggestion is a strong active prompt, a weak/stale prompt, or an expiring prompt before inserting it.

## Plan

1. Add a compact `提示资格` row to the Rehearsal review receipt.
2. Derive it from existing evidence fields only; no new API or storage contract.
3. Update the Compose Assist direct-insert E2E fixture to cover a stale weak prompt and assert the new row.
4. Update feature docs and the index row to describe the review-state boundary.
5. Verify with targeted Compose Assist tests, dev compile, E2E, scoped `git diff --check`, and process cleanup.
