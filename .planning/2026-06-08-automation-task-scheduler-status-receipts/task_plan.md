# Task Scheduler Status Receipts Plan

## Goal

Improve `Task Scheduler 状态 API` so status output and popup UI explain schedule/run lifecycle with a compact, structured receipt: current state, why it matters, and the next safe user action.

## Scope

- Feature: `Task Scheduler 状态 API`
- Canonical doc: `docs/features/task_scheduler_api.md`
- Runtime/API: `src/services/TaskScheduler.ts`
- Popup UI: `src/popup.tsx`
- Tests/verifiers: `tools/verify-task-scheduler-api.ts`, `tools/verify-task-scheduler-status-filters.ts`, `tools/verify-task-scheduler-popup-filters-e2e.mjs`

## Plan

1. [complete] Confirm current behavior, Reminder state, and external product/paper references.
2. [complete] Design the smallest structured receipt contract that reuses existing scheduler truth.
3. [complete] Implement API and popup rendering without changing scheduling side effects.
4. [complete] Update targeted tests/E2E and feature doc.
5. [complete] Run validation ladder and record evidence.

## Decisions

- Do not create new task execution behavior in this pass.
- Keep user-facing copy concise; the popup already has many status surfaces.
- Preserve existing dirty worktree; only layer changes on Task Scheduler files.

## Errors Encountered

- Initial broad patch to `tools/verify-task-scheduler-api.ts` did not apply because the local file context had drifted; resolved by patching the current file in smaller sections.
- First popup E2E rerun still expected the old attention-detail copy. Updated the E2E to assert the new receipt detail/action split, then reran successfully.
