# Storyline Source Open Receipt Plan

## Goal

Improve `Storyline Draft 页面` so users can inspect evidence sources without mistaking a source click for a reread, sync, writeback, share confirmation, or copy approval.

## Context

- Feature selected from `docs/index.md`: `Storyline Draft 页面`.
- Reminder check: local Reminders is reachable, but there is no `Personal AI` list.
- Existing docs and code already cover draft generation scope, grounding review, unsafe-link hiding, copy-before-review gating, stale-request protection, and unsupported-source blocking.
- External scan points toward traceable evidence and explicit sharing/governance boundaries in meeting recaps and evidence-grounded generation UX.

## Plan

1. Complete repo/source audit and write down the target UX gap.
2. Add a Storyline Draft source-open receipt that appears after a safe external source link is clicked.
3. Keep the receipt narrow: it must say the click only opens the linked source and does not reread the prep, refresh evidence, sync Memory Service, approve external sharing, write back to Slides/Docs/RingCentral, or satisfy copy review.
4. Update the Storyline Draft E2E fixture/assertions for the new receipt.
5. Update `docs/features/memory_storyline_builder.md` with the durable behavior.
6. Run targeted validation: syntax check, memory-service Storyline API tests, `npm start` first successful compile, Storyline Draft E2E, scoped `git diff --check`, and process cleanup.

## Status

- [x] Step 1: Source audit and UX gap selected.
- [x] Step 2: Implement source-open receipt.
- [x] Step 3: Update E2E.
- [x] Step 4: Update feature docs.
- [x] Step 5: Validate.

## Errors

None yet.

## Validation

- `node --check tools/verify-storyline-draft-page-e2e.mjs`
- `npm --prefix memory-service test -- --run src/__tests__/api-storylines.test.ts`
- `npm --prefix memory-service run build`
- `npm start` first successful webpack dev compile, then stopped watcher.
- `node tools/verify-storyline-draft-page-e2e.mjs`
- `npm --prefix memory-service test -- --run src/__tests__/api-today-pilot-meeting-prep.test.ts src/__tests__/api-storylines.test.ts`
- `node --check tools/verify-storyline-video-home-e2e.mjs`
- `node tools/verify-storyline-video-home-e2e.mjs`
- Scoped `git diff --check`
- Cleanup check found no lingering webpack / Storyline E2E / Storyline vitest process.
