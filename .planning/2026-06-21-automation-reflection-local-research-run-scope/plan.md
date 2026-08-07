# Reflection Local Research Run Scope Receipt

## Target

- Feature index row: `反思本地研究补查`
- Canonical doc: `docs/memory_system.md`
- Runtime surface: `src/modals/components/ReflectionThreadDetail.vue`

## Research Notes

- Slack Enterprise Search and Notion Enterprise Search both put permission and source-boundary behavior in the search contract, not only in admin docs.
- Generative Agents and Reflexion support reflection loops that read past experience before planning, but product UIs still need to show whether a conclusion was grounded, empty, or degraded.
- The existing Personal AI backend already records per-query traces, source-type trimming, evidence refs, and failed recall channels. The missing UX is the run-level receipt that frames those traces before the user reads individual rows.

## Implementation Plan

1. Keep `ReflectionResearcher` and `ReflectionThreadService` retrieval behavior unchanged.
2. Add a first-row `本轮研究范围` receipt above the research trace list.
3. Derive the receipt from the current `researchAttempts`: query count, hit/empty/failed/degraded counts, unique evidence refs, source count, rejected-source count, and local-only/read-only boundary.
4. Update the existing reflection research E2E to assert the receipt and preserve existing per-query trace coverage.
5. Update `docs/memory_system.md` with the run-level receipt behavior.

## Validation Plan

- `npm start` until the first successful webpack compile, then stop the watcher.
- `npm run verify:reflection-research:e2e`.
- Scoped `git diff --check` for touched files and this plan.
- Confirm no lingering webpack watcher remains.
