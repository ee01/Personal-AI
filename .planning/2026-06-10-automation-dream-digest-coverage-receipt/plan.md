# Dream Digest Coverage Receipt Plan

## Goal

Improve the Dream Replay / Dream Digest user path so a pushed digest explains what time window it covers, which dream files are included, and why older or undated dreams are not part of the current digest.

## Context

- Selected random feature: `梦境重放` from `docs/features/index.md`.
- Source of truth: `docs/features/memory_system.md`.
- Main code paths:
  - `memory-service/src/core/GenerativeReplay.ts`
  - `memory-service/src/core/HeartbeatLoop.ts`
  - `memory-service/src/core/NotificationCenterService.ts`
  - `src/backendNotifications.ts`
  - `src/modals/components/DreamInsights.vue`
- Reminder status: local Reminders are readable, but there is no `Personal AI` list, so no Reminder items are attached to this run.

## Plan

1. Inspect current Dream Replay markdown, page, digest and notification behavior.
2. Use external product/paper references to shape the UX improvement.
3. Add a compact coverage receipt to Dream Digest payload and rendered notification digest/previews. - Done
4. Add focused tests for included/excluded dream scope. - Done
5. Update `docs/features/memory_system.md`. - Done
6. Run targeted memory-service tests, dev extension compile, Dream Replay E2E, and `git diff --check`. - Done

## External Direction

- Memory/dreaming products increasingly expose freshness and user controls.
- Grounded AI outputs should keep source/coverage context visible.
- Agent memory papers support reflection/consolidation, but generated synthesis should stay bounded and evidence-checkable.

## Status

- 2026-06-10: implementation, doc update, and validation complete.
