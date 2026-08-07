# Findings & Decisions

## Requirements
- Use docs/index.md to pick one random feature.
- Check code and docs for current behavior.
- Search current products/research for comparable patterns and constructive guidance.
- Check local Reminders list `Personal AI`; include related open feedback and mark done only if implemented.
- Build a short plan first, then implement, update docs, and run the repo's real verification path.

## Research Findings
- Automation memory showed the freshest exact surfaces include Scheduled Messages, Topic source links, Memory Lens, Prompt Config, Search feedback, Meeting Pilot, Relationship Radar, Task Scheduler, and related receipts.
- `docs/progressing/to-verify.md` says there is no carry-over work.
- AppleScript did not list `Personal AI`, but EventKit did. It contains four completed historical items about Doubao/Notification; none are Rehearsal feedback.
- Rehearsal docs and UI already include cue quality, missing-cue, weak-cue, pending action, cue editor, empty filter, and deep-link failure receipts.
- Candidate defect: feedback actions can confirm a new status/count, then trigger a detail refresh. The UI should keep the mutation response as the visible authority and explain that refreshed detail is only an audit refresh, not a reversal of the confirmed feedback.
- 2026-07-07 external scan:
  - Apple Reminders supports reminders triggered while messaging a chosen person, which reinforces Rehearsal's person/conversation cue model.
  - ChatGPT Scheduled Tasks now exposes a dedicated Scheduled page, creation/editing flow, flexible schedule windows, and notifications; the useful pattern is visible task state rather than silent background authority.
  - Context-aware reminder authoring research translates everyday-language reminders into structured executable conditions; this maps to Rehearsal's cue editor and argues for keeping cue/refresh state explicit.
  - TriggerBench / prospective-memory LLM work says prospective memory decays under long context, implicit constraints, and overloaded triggers; Rehearsal should avoid pretending a stale refresh overrides an explicit user feedback action.
  - Implementation-intention research supports strong cue-response links; feedback on a specific cue-action script should be bound to that script, not hidden behind a generic refresh.

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Avoid backend changes | The mutation response already contains the confirmed Rehearsal; UI can preserve that state while refreshing activations/audit. |
| Extend the existing E2E fixture | The existing Rehearsal E2E already covers management page flows and can prove stale refresh handling without a new harness. |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| Worktree has broad unrelated dirty state | Scope diffs to Rehearsal UI/E2E/docs/planning files only. |

## Resources
- AGENT.md validation policy.
- docs/features/rehearsal.md.
- src/modals/components/RehearsalsPage.vue.
- tools/verify-rehearsals-page-e2e.mjs.
- Apple Reminders: https://support.apple.com/en-us/102484
- ChatGPT Scheduled Tasks: https://help.openai.com/en/articles/10291617-scheduled-tasks-in-chatgpt
- Context-aware reminders paper: https://arxiv.org/abs/2605.23085
- TriggerBench prospective memory for LLMs: https://arxiv.org/html/2606.23459v1
- Implementation intention prospective memory overview: https://pmc.ncbi.nlm.nih.gov/articles/PMC9274250/

## Visual/Browser Findings
- Web search results were text-only. The useful product pattern is not visual layout; it is visible management state, explicit cue conditions, and feedback/notification authority.
