# Rehearsal Cue-less Prompt Boundary Plan

## Goal

Tighten the Rehearsal management page so legacy or imported Rehearsals without structured future-scene cues are not described as prompt-eligible merely because their status is `active`.

## Scope

- Target feature: `Rehearsal 管理页` from `docs/features/index.md`.
- Primary UI: `src/modals/components/RehearsalsPage.vue`.
- Verification: `tools/verify-rehearsals-page-e2e.mjs`, `npm start` first compile, path-scoped `git diff --check`.
- Reminder status: Reminders is reachable, but there is no `Personal AI` list on this machine.

## Plan

1. Complete context review.
   - Status: complete.
   - Notes: `AGENT.md`, carry-over file, automation memory, feature doc, page code, and E2E were read.
2. Apply product/research constraints.
   - Status: complete.
   - Notes: Apple Reminders, Microsoft To Do flagged email, context-aware reminder authoring, and implementation-intention research all support cue/action clarity.
3. Implement cue-aware eligibility copy.
   - Status: complete.
   - Notes: Make no-cue Rehearsals show "not reliable / repair cues first" in the next-step banner, lifecycle facts, and action receipts.
4. Update canonical docs.
   - Status: complete.
   - Notes: Keep docs concise and focused on the status-plus-cue contract.
5. Verify.
   - Status: complete.
   - Notes: Run the Rehearsal page E2E, `npm start` to first successful compile, and scoped whitespace checks.

## Constraints

- Do not touch unrelated dirty files.
- Do not claim Reminder completion because the `Personal AI` list is absent.
- Stop `npm start` after the first successful compile.
- If browser tooling is unavailable, use the existing Playwright unpacked-extension verifier.

## Errors Encountered

| Error | Attempt | Resolution |
|---|---|---|
| None yet | - | - |
