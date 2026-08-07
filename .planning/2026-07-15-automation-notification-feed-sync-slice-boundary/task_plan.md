# Notification Center Feed Sync Slice Boundary

Run time: 2026-07-15T09:04:01+0800

## Goal

Improve `Notification Center feed` so downstream Provider/Doubao sync attempts preserve the feed slice boundary that service digests already render in markdown.

## Target

- Feature: `Notification Center feed`
- Docs: `docs/features/notification_center.md`, `docs/index.md`
- Primary code: `memory-service/src/core/NotificationCenterService.ts`, `memory-service/src/core/ProviderContextService.ts`, `desktop-app/src/syncManager.ts`, related shared types/tests

## Plan

1. [complete] Record target, Reminder state, and external research.
2. [complete] Add feed slice metadata to todo/notice digest provider packages.
3. [complete] Preserve that metadata in desktop sync attempt results and recent attempts.
4. [complete] Update feature docs and index row concisely.
5. [complete] Verify with targeted memory-service/desktop tests, dev compile, E2E/static checks, and scoped diff check.

## Scope

- Preserve existing feed query semantics, sorting, delivery writeback, channel delivery status, and digest markdown.
- Add metadata and visible status provenance only.
- Do not deploy memory-service or mutate real notification data in this run.

## Errors Encountered

| Error | Attempt | Resolution |
|---|---|---|
| Desktop syncManager test first run added meaningless `feedHasMore: undefined` fields to non-feed skipped attempts | 1 | `packageMetadata()` now returns cleaned metadata and only keeps feed metadata for visible feed packages; rerun passed |
