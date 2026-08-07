# Rehearsal Management Findings

## Requirements
- Pick one bounded feature from `docs/index.md`.
- Confirm docs and code are current enough.
- Search comparable products and research.
- Include related local `Personal AI` Reminder feedback if any.
- Plan first, then implement and verify strongly.

## Repository Findings
- `docs/progressing/to-verify.md` contains no carry-over work.
- Selected feature: `Rehearsal 管理页`.
- Source doc: `docs/features/rehearsal.md`.
- Primary implementation: `src/modals/components/RehearsalsPage.vue`.
- Existing browser proof: `tools/verify-rehearsals-page-e2e.mjs`.
- Current page already has strong receipts for list scope, pagination, deep-link failure, empty filters, card selection, scenario readiness, action pending/success/failure, cue draft/save/reset, and paused restore.
- Remaining UX gap: source evidence rows in the detail panel parse refs into label/value, but hover text is only the raw ref and there is no `aria-label` explaining that the row is audit-only. As a user, I can see `消息 / colin`, but not whether viewing that row opens the source, marks feedback, fetches more data, writes Memory Service, or executes the script.

## Reminder Findings
- AppleScript listed local Reminders but did not include `Personal AI`.
- EventKit read-only fallback succeeded: `Personal AI total=4 incomplete=0`.
- All `Personal AI` items are already completed and relate to historical Doubao/test/notification feedback, not Rehearsal management, source evidence, future cue repair, or activation diagnostics.
- No Reminder item should be marked done for this run.

## External Reference Findings
- OpenAI ChatGPT Memory controls emphasize user-managed memories and visible control over saved memory records: https://help.openai.com/articles/8590148-memory-faq
- OpenAI's newer memory direction also emphasizes memory sources and current/relevant personalization controls: https://openai.com/index/chatgpt-memory-dreaming/
- Microsoft To Do flagged email keeps the original email/task relationship visible, supporting source evidence as an inspectable audit anchor rather than a hidden classifier detail: https://support.microsoft.com/en-us/todo/using-microsoft-to-do-with-flagged-email-from-outlook
- Digital reminder research shows many future intentions are not covered by simple time/location reminders and need richer context cues: https://cs.stanford.edu/~merrie/papers/memory_imwut2017.pdf
- Prospective-memory / implementation-intention research reinforces the cue-action pairing; Rehearsal evidence rows should help users judge whether the original cue-action source is still trustworthy.
- 2026 context-aware smart-home reminder research describes translating natural-language reminder intent into structured trigger logic, which supports making source/cue provenance explicit before users trust the automation: https://arxiv.org/abs/2605.23085

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Add `evidenceRowBoundary(evidence)` | Mirrors existing control-boundary helper style and keeps copy close to the real display row |
| Use `role="group"` plus `title` and `aria-label` on evidence rows | The row is not clickable, but it is a meaningful provenance group and should be understandable to hover and screen-reader users |
| Keep docs concise | The canonical doc already has detailed Rehearsal behavior; only the evidence-row boundary needs a small update |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| Rehearsal page is already heavily covered by prior sweeps | Chose the smallest remaining first-screen/source-trust gap instead of duplicating action-boundary work |

## Resources
- `docs/features/rehearsal.md`
- `src/modals/components/RehearsalsPage.vue`
- `tools/verify-rehearsals-page-e2e.mjs`
