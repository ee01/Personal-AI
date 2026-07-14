# 2026-07-07 Automation Plan: Rehearsal Cue Editor

## Target

- Feature: `未来场景预演记忆` / `场景预演边界`
- Canonical docs: `docs/features/rehearsal.md`
- Main UI: `src/modals/components/RehearsalsPage.vue`
- Verification: `tools/verify-rehearsals-page-e2e.mjs`

## Context

- `docs/progressing/to-verify.md` is empty.
- Automation memory shows the freshest exact targets were Google Slides, Compose Assist, Ask, Memory Timeline, Meeting Pilot, User Profile and adjacent receipt surfaces, so this run uses Rehearsal instead.
- EventKit found the local `Personal AI` Reminders list, but all 4 items are already completed historical Doubao/Notification/test feedback. No open Reminder item applies to Rehearsal.
- External scan supports cue/action clarity: Apple Reminders supports time, location and messaging-person triggers; ChatGPT Scheduled Tasks exposes paused/manageable task state; prospective-memory and implementation-intention papers emphasize binding a future cue to an intended action.

## Plan

1. Inspect Rehearsal docs, management page, API client, backend route and existing E2E.
2. Add an in-page trigger-cue editor for Rehearsal details so users can fix missing or weak future cues without leaving the management page.
3. Keep the editor bounded: save only `activationCues`, show local-draft and write-confirmation receipts, and reuse existing pending/failure action receipts.
4. Update Rehearsal docs and feature index with concise current behavior.
5. Extend the Rehearsal E2E to cover missing-cue repair and normalized `PATCH /rehearsals/:id` payload.
6. Verify with syntax checks, `npm start` first successful compile, Rehearsal E2E and scoped `git diff --check`.
