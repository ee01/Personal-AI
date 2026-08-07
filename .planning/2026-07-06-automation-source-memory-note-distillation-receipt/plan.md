# Source Memory note distillation receipt plan

## Target

- Feature: `Source Memory 蒸馏器`
- Canonical doc: `docs/features/memory_capture.md`
- Main surface: `memory-exploring.html#/source-memory/:id`

## Research scan

- NotebookLM treats uploaded/imported sources as the grounding material for later answers; source state and control need to stay visible.
- Readwise Reader keeps notes/highlights tied to the parent document; edits to the note are part of the saved evidence lifecycle.
- RAG trust/transparency research keeps pointing at provenance, user control, and verification cues rather than confidence alone.
- PIM/KFTF research reinforces that saved web material needs the "why I kept this" context available when the user comes back later.

## UX gap

The backend already supports `POST /source-memory/capsules/:id/note`, and that call refreshes the linked web signal, action receipt, and deterministic distillation. The detail page only reads and dismisses capsules, so a user who wants to clarify why this source matters has no first-class path from the page that explains what will refresh and what will not happen.

## Implementation plan

1. Add a saved-capsule note refresh panel to `SourceMemoryDetailPage.vue`.
2. Show a pending receipt immediately after submit, before Memory Service confirms the note, web signal, or distillation refresh.
3. Replace pending with returned action/distillation receipts on success; show a no-confirmation failure receipt on error.
4. Extend the existing webpage-memory E2E harness to open the source-memory detail page, update a note, assert pending/success/failure receipts, and keep API semantics unchanged.
5. Update `docs/features/memory_capture.md` and `docs/index.md`.

## Verification plan

- `node --check desktop-app/scripts/webpage-memory-detection-check.mjs`
- `npm --prefix memory-service test -- --run src/__tests__/api-source-memory.test.ts`
- `npm start -- --progress` until first successful compile, then stop
- `npm run verify:webpage-memory-detection:e2e`
- scoped `git diff --check`
