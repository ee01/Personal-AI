# Rehearsal future-cue boundary

## Context

- Target feature: `场景预演边界` in `docs/features/rehearsal.md`.
- Carry-over queue: `docs/progressing/to-verify.md` says `暂无。`.
- Reminder state: local Reminders lists are readable, but there is no `Personal AI` list.
- Current gap: the doc says every Rehearsal must have a future-recognizable scene, while `POST /api/v1/rehearsals` currently accepts only `title` and `content`.

## Plan

1. Enforce structured future cue presence for Rehearsal create/update payloads.
2. Show a management-page warning for legacy or external Rehearsals with no cue.
3. Update API and E2E checks plus the canonical feature doc.
4. Validate with focused API tests, first successful `npm start` compile, Rehearsal page E2E, and `git diff --check`.
