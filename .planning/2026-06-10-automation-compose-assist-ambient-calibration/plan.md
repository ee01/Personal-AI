# Compose Assist Ambient Calibration Privacy Receipt

## Feature

- Random index target: `回复助手无感校准`
- Source docs: `docs/features/memory_system.md`, `docs/features/compose_assist.md`
- Carry-over: `docs/progressing/to-verify.md` says `暂无。`
- Reminder state: local Reminders is accessible, but there is no `Personal AI` list to incorporate or complete.

## Research Notes

- Gmail Smart Compose keeps suggestions lightweight, personalized, optional, and feedback-aware.
- Outlook suggested replies keeps generated text editable before sending and states model/data handling boundaries.
- Smart Compose, GhostWriter, and interaction-required writing research support implicit learning from accepted/edited/rejected suggestions while preserving user agency.
- Data-minimization guidance supports a hard server-side guard: calibration should store hashes, lengths, tags, and references, not raw final text.

## Improvement Plan

1. Harden `/ambient-calibration/traces` so `redactedDiff` rejects likely raw prose, URLs, and emails even under generic field names.
2. Return a `calibrationReceipt` that makes stored/duplicate state, privacy class, evidence/cue/style counts, and the no-raw-text boundary inspectable.
3. Add the same no-raw-text boundary to the visible thumb-down receipt.
4. Update API tests, E2E assertions, and feature docs.

## Validation Targets

- `npm --prefix memory-service test -- --run src/__tests__/api-ambient-calibration.test.ts`
- `npm start` first successful development compile, then stop watcher
- `npm run verify:compose-assist-ambient-calibration:e2e`
- scoped and full `git diff --check`
