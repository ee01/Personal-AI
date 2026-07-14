# Task Plan: Reflection Local Research Trace Boundaries

## Goal
Improve `反思本地研究补查` so each research trace row clearly explains its local-only scope, evidence status, and no-write/no-execution boundary before the user hovers or focuses it.

## Current Phase
Complete

## Phases

### Phase 1: Requirements & Discovery
- [x] Read `AGENT.md`, `docs/progressing/to-verify.md`, automation memory, and `docs/features/index.md`.
- [x] Select `反思本地研究补查` from the feature index after avoiding the freshest exact automation targets.
- [x] Check EventKit Reminders list `Personal AI`.
- [x] Inspect current docs, UI, service, and verifier shape.
- **Status:** complete

### Phase 2: Planning & Research
- [x] Compare current implementation with product and research references.
- [x] Decide a narrow UX fix that does not alter Reflection service behavior.
- **Status:** complete

### Phase 3: Implementation
- [x] Add per-trace hover/focus/ARIA boundary copy to `ReflectionThreadDetail.vue`.
- [x] Update `verify-reflection-research-e2e.mjs` to assert trace card title/ARIA semantics.
- [x] Update `docs/features/memory_system.md` and `docs/features/index.md` concisely.
- **Status:** complete

### Phase 4: Testing & Verification
- [x] Run syntax/static checks for edited files.
- [x] Run first successful `npm start -- --progress` compile and stop the watcher.
- [x] Run the Reflection research E2E verifier against rebuilt `dist/`.
- [x] Run scoped `git diff --check`.
- **Status:** complete

### Phase 5: Delivery
- [x] Update automation memory with summary and run time.
- [x] Report changed files, verification evidence, Reminder result, and source links.
- **Status:** complete

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Target `反思本地研究补查` | Random sample included it, and it is less fresh than today's exact Relationship Radar / Scheduled Messages / Message Reaction targets. |
| Keep behavior presentation-only | Existing service already records research attempts, source clipping, evidence refs, failures, and skipped states. The visible gap is at the trace row control point. |
| Put boundary on each `.research-trace-card` | The page-level receipts are strong, but individual rows still need hover/focus semantics for status, source scope, and no side effects. |

## Errors Encountered
| Error | Resolution |
|-------|------------|
| Planning skill first read used the wrong root path | Re-read the installed skill from `/Users/Esone/.agents/skills/planning-with-files/SKILL.md`. |
