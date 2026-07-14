# Storyline Draft Pending Request Receipt

## Target

- Feature: `Storyline Draft 页面 / API`
- Docs: `docs/features/memory_storyline_builder.md`
- Main UI: `src/modals/components/StorylineDraftPage.vue`
- E2E: `tools/verify-storyline-draft-page-e2e.mjs`

## Context

- `docs/progressing/to-verify.md` has no carry-over work.
- EventKit found the local `Personal AI` Reminders list with 4 total items and 0 incomplete items; all are completed historical Doubao / Notification / test feedback and unrelated to Storyline Draft.
- Prior uncommitted Storyline work already added a `重新生成请求回执`; this run keeps that intact and handles the ordinary first-load / target-switch pending state.
- External scan: Microsoft Teams Intelligent Recap, Google Meet "take notes for me", and evidence-based generation research all reinforce showing generation, provenance, consent/share, and manual-review boundaries before users treat AI output as ready to send.

## Plan

1. Add a `草稿生成请求回执` while a normal Storyline Draft API request is pending.
2. Keep the existing `重新生成请求回执` exclusive to manual regenerate requests.
3. Update the Storyline Draft page E2E with a slow-response fixture that proves the pending receipt appears, carries the target/prep/no-write boundary, and disappears after success.
4. Update the canonical feature doc and feature index concisely.
5. Verify with Storyline targeted checks, `npm start` first compile, E2E, and scoped `git diff --check`.
