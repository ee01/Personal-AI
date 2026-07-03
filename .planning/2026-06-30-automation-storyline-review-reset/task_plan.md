# Storyline Review Reset Plan

## Goal

Improve Memory Storyline Builder so copy review acknowledgement cannot silently carry across a different generated draft.

## Status

1. Context and selection: complete.
2. Reminder check: complete, `Personal AI` list absent.
3. External scan: complete.
4. Implementation: complete.
5. Documentation update: complete.
6. Verification: complete.

## Plan

- Inspect current Storyline Draft page, API, tests, and docs.
- Confirm industry/product guidance for generated meeting/story artifacts.
- Bind the review acknowledgement to the current draft snapshot.
- Reset or invalidate the acknowledgement when target/source/prep/audience/regeneration changes.
- Extend the Storyline Draft E2E to prove copy is blocked again after switching to a new target.
- Update the feature doc with the current review-confirmation boundary.
- Run focused Storyline tests, first successful `npm start` compile, E2E, and scoped whitespace checks.

## Findings

- Existing Storyline work already covers generation receipts, source-open receipts, copy snapshot receipts, stale-copy detection, and LLM fallback.
- The remaining UX risk is hidden old draft copyability during loading/error states and review acknowledgement persistence across draft changes.
- Local Reminders lists are readable, but there is no `Personal AI` list on this machine.
- External scan supports this direction: Teams/Meet expose recap/note access and controls near meeting artifacts, PowerPoint Copilot requires reviewing generated speaker notes before keeping them, and evidence-based generation research emphasizes traceability/verifiability.

## Verification

- `npm --prefix memory-service test -- --run src/__tests__/api-today-pilot-meeting-prep.test.ts src/__tests__/api-storylines.test.ts`: passed 17/17.
- `node --check tools/verify-storyline-draft-page-e2e.mjs`: passed.
- `npm start -- --progress`: first successful webpack compile in 14556 ms, then stopped.
- `node tools/verify-storyline-draft-page-e2e.mjs`: passed.
- Scoped `git diff --check`: passed.
- `pgrep -fl "webpack.*webpack\\.dev\\.cjs"`: no watcher left.
