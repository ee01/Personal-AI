# Today Pilot Source Breakdown Receipt

## Target

- Feature: `今天排序与噪声控制`
- Canonical doc: `docs/features/today_pilot.md`
- Main surface: `src/modals/components/OverviewPage.vue`

## Plan

1. Inspect Today Pilot docs, homepage implementation, focused verifier, E2E, Reminders, and recent automation memory.
2. Use a small external scan of daily-brief / reminder / notification-batching products and research to constrain the UX.
3. Add a compact source-level breakdown under the homepage `筛选口径` strip so users can see raw, candidate, selected, prefiltered-noise, and candidate-not-selected counts by source bucket.
4. Keep the new receipt read-only: it explains the current visible brief only and does not rerun ranking, reveal hidden content, write feedback, mark reminders, send messages, or execute actions.
5. Update the Today Pilot doc and existing verifier/E2E assertions.
6. Run focused Today Pilot checks, first successful `npm start` compile, E2E, and scoped `git diff --check`.
