# Task Plan: Memory Capture API No-Write Receipt

## Goal
Improve the selected `Memory Capture API` path so failed capsule-save requests return a structured no-write receipt instead of only a raw error string.

## Current Phase
Complete

## Phases

### Phase 1: Discovery
- [x] Read `AGENT.md`, automation memory, memory guidance, `docs/progressing/to-verify.md`, and `docs/index.md`.
- [x] Randomly sampled candidates and skipped very fresh Today / Memory Lens exact surfaces.
- [x] Selected `Memory Capture API` under `docs/features/memory_capture.md`.
- [x] Checked local Reminders with AppleScript and EventKit fallback.
- [x] Inspected Memory Capture docs, route, service, and API tests.
- **Status:** complete

### Phase 2: Research & UX Decision
- [x] Review current products and research around source capture, highlights, source transparency, and RAG trust.
- [x] Choose a bounded improvement that does not require user decision.
- **Status:** complete

### Phase 3: Implementation
- [x] Add `noWriteReceipt` for blocked / invalid capsule creation.
- [x] Return the receipt from source-memory validation errors without changing successful save, duplicate, dismiss, distillation, or recall-signal behavior.
- [x] Update tests and docs.
- **Status:** complete

### Phase 4: Verification
- [x] Run `npm --prefix memory-service test -- --run src/__tests__/api-source-memory.test.ts`.
- [x] Run `npm --prefix memory-service run build`.
- [x] Run `npm start -- --progress` until first successful compile, then stop it.
- [x] Run the nearest existing Memory Capture / source-memory verification.
- [x] Run scoped `git diff --check`.
- **Status:** complete

### Phase 5: Closeout
- [x] Update progress and automation memory.
- [x] Mark related Reminder item done only if an open related item exists.
- [x] Summarize touched files and validation.
- **Status:** complete

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Target `Memory Capture API` | It was the next viable random sample after skipping fresh Today and Memory Lens surfaces. |
| Add `noWriteReceipt` only to create failures | Candidate scoring already has `policyReceipt`; successful capsule reads already have `writeReceipt` / `actionReceipt`. The gap was failed writes. |
| Keep persistence behavior unchanged | The improvement is trust/UX visibility, not capture scoring, dedupe, distillation, or recall routing. |

## Reminder State
AppleScript did not list `Personal AI`, but EventKit found it with 4 completed historical Doubao / digest / sync feedback items. None are open or related to Memory Capture API, so no Reminder item is incorporated or markable.

## Validation
- `npm --prefix memory-service test -- --run src/__tests__/api-source-memory.test.ts` passed 21/21 after adjusting the low-signal fixture to hit the intended invalid branch.
- `npm --prefix memory-service run build` passed.
- `npm start -- --progress` compiled successfully once in 14850 ms and was stopped.
- `npm run verify:webpage-memory-detection` passed.
- `node tools/verify-source-memory-capsule-e2e.mjs` passed.
- Scoped `git diff --check` passed.
- Watcher check found no remaining `webpack --watch --config webpack.dev.cjs` process.

## External Scan
- NotebookLM treats sources as imported or synced material used by the model, with explicit source limits and source selection.
- Readwise documents browser-extension / web-highlight capture and sync flows.
- IBM CHI 2025 RAG trust work found source transparency and user control more useful for trust than confidence scores alone.
- RAG trustworthiness survey emphasizes transparency, accountability, and privacy as core RAG dimensions.
