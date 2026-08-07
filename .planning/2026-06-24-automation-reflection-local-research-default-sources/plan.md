# Reflection Local Research Default Sources

## Target

- Feature index item: `反思本地研究补查`
- Source doc: `docs/memory_system.md`
- Runtime surface: `ReflectionResearcher` planning plus Reflection thread detail trace display

## Plan

1. Keep the existing read-only local research boundary and run-scope receipts.
2. Expand the default local research source pool so fallback or unspecified plans include Personal AI derived evidence such as source memory, user core, reflection threads, rehearsal, and local markdown summaries.
3. Leave meeting, calendar, and external AI chat sources opt-in so default reflection research does not become noisy.
4. Update unit and E2E coverage to prove both fallback planning and the detail-page source receipt show the broader default scope.
5. Update the canonical feature docs and index with concise behavior notes.

## External Direction

- Enterprise search products emphasize permission-respecting retrieval and source boundaries.
- Reflection-agent research supports carrying prior observations, failures, and self-reflections forward as retrievable memory.
- The implementation should improve local evidence coverage without creating a new user review queue or widening side effects.
