# Reflection Research fallback and trace summary

## Target feature

- Random feature: `反思本地研究补查`
- Source of truth: `docs/memory_system.md`
- Primary code: `memory-service/src/core/ReflectionResearcher.ts`, `memory-service/src/core/ReflectionThreadService.ts`, `src/modals/components/ReflectionThreadDetail.vue`

## Context

- Reminder check: local Reminders is accessible, but there is no `Personal AI` list, so there are no related reminder items to incorporate or complete.
- Carry-over check: `docs/progressing/to-verify.md` still has an Ask remote revalidation item, but it requires a safely deployable worktree; the current worktree has many unrelated dirty files, so this run should not deploy memory-service.
- External references point to the same principle: enterprise search should respect user-visible scope and permissions, while reflection-agent research depends on retrieving prior experience before acting on reflections.

## Improvement Plan

1. Make `ReflectionResearcher` robust when the LLM planner fails: create a conservative deterministic local query from the thread title, open question, hypothesis, and topic key instead of returning no research.
2. Sanitize LLM-proposed `sourceTypes` against supported local recall sources so unsupported strings do not silently narrow recall to nothing.
3. Add focused tests for fallback planning and source-type sanitization.
4. Add a Reflection detail-page research summary row so users can scan how many queries hit, failed, degraded, or returned empty before reading each trace card.
5. Update `docs/memory_system.md` with the fallback/sanitization behavior and UX summary.
6. Validate with targeted memory-service tests, `npm start` first compile, Reflection Research E2E, and `git diff --check`.
