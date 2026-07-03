# Storyline Opportunity Receipt Plan

## Target

Feature: `Storyline 会前提示` under Today Pilot / Memory Storyline Builder.

## Context

- `docs/progressing/to-verify.md` has no carry-over item.
- Local Reminders are readable, but there is no `Personal AI` list, so no Reminder item is part of this run.
- External references point toward generated presentation / meeting-summary artifacts staying reviewable, source-grounded, and user-controlled before publication.

## Plan

1. Add a compact Video Home `Storyline 入口回执` before the user opens the Draft page.
2. Include output format, material group count, evidence count, source kinds, audience, and the click boundary.
3. Keep generation lazy: the button still only opens `memory-exploring.html#/storylines/draft`.
4. Update Storyline Video Home E2E and feature docs.
5. Verify with Storyline API tests, dev compile, Video Home/Draft E2E, and diff checks.
