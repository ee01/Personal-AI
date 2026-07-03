# Storyline Draft Source Boundary Plan

## Target

- Random feature from `docs/features/index.md`: `Storyline Draft API`
- Capability: Memory Storyline Builder
- Source doc: `docs/features/memory_storyline_builder.md`
- Reminder state: Apple Reminders is accessible, but no visible list named `Personal AI` was found, so there are no relevant Reminder items to incorporate or mark done.

## External Signals

- Microsoft Teams Copilot and recap flows make source availability explicit: after-meeting answers depend on transcript/chat availability, and responses cite used sources.
- Zoom AI Companion meeting summaries are transcript-derived and editable/shareable, which reinforces a review-before-share boundary.
- NotebookLM positions generated overviews as grounded in user-provided sources with citations/quotes available for inspection.
- Meeting summarization research such as QMSum highlights long, query-focused meeting summarization as difficult, so Storyline should keep source and evidence boundaries visible.
- Provenance research such as GenProve argues that citations alone are often insufficient; generated claims need fine-grained provenance and clear source mapping.

## Findings

- The Storyline feature doc is mostly current for P0: Today Pilot is the only automatic prompt, Draft API only supports `today_meeting_prep`, and Draft page already has segment grounding, evidence links, review gating, and stale-request protection.
- Prior Storyline grounding work already added selected-segment grounding visibility and fallback coverage; do not repeat that slice.
- UX/code defect: `StorylineDraftPage.vue` reads `source` from the deep link for display/cache, but always calls the API with `sourceKind: 'today_meeting_prep'`. A bad deep link such as `source=compose_assist&prepId=...` can show an unsupported source label while silently generating a Today Pilot draft. That violates the feature boundary and weakens provenance clarity.
- API schema already restricts sourceKind to `today_meeting_prep`, but there is no focused test proving unsupported source requests are rejected.

## Implementation Plan

1. Block unsupported Storyline source kinds in the Draft page before calling the API.
2. Keep `/storylines` empty-state behavior unchanged when there is no `prepId`.
3. Extend the Draft page E2E to assert unsupported source deep links render a clear failure state and do not call `/storylines/draft`.
4. Add API test coverage for unsupported `sourceKind`.
5. Update `docs/features/memory_storyline_builder.md` with the current source-boundary behavior, without over-documenting internals.
6. Validate with focused API tests, memory-service build, extension first compile, Storyline Draft page E2E, and `git diff --check`.
