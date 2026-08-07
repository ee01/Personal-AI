# Memory Coverage Timeline Visible Slice Plan

## Target

- Feature: `记忆覆盖地图` in `docs/features/memory_coverage_map.md`.
- Surface: `memory-exploring.html#/coverage`, specifically the `最近覆盖信号` panel.

## Context

- `docs/progressing/to-verify.md` is empty, so this run selected a fresh feature from `docs/index.md`.
- EventKit found the local `Personal AI` Reminders list, but all 4 items are already completed historical Doubao / Notification / test items; no Coverage Map item is open.
- External scan supports separating connector freshness, indexed state, ACL/permission sync, error state, and visible slice boundaries.

## Plan

1. Keep the change presentation-only and scoped to Coverage Map.
2. Add a structured timeline receipt that states the visible event count, the 8-item API cap, freshness basis, and no-side-effect boundary.
3. Update the existing Coverage Map E2E fixture assertions for the default, empty, and stale-snapshot paths.
4. Update `docs/features/memory_coverage_map.md` and `docs/index.md` concisely.
5. Verify with the feature E2E, `npm start` first successful compile, and scoped diff checks.
