# Findings & Decisions

## Requirements
- Pick one random feature from `docs/index.md`.
- Verify docs are current enough and update concise canonical docs if behavior changes.
- Search comparable products/papers for constructive ideas.
- Inspect and improve code/UX/bugs, then implement a bounded improvement that does not require user decisions.
- Check local `Personal AI` Reminders and incorporate relevant incomplete feedback.
- Plan first, then implement and verify thoroughly per `AGENT.md`.

## Research Findings
- Selected feature: `会议历史归档` under Meeting Pilot (`docs/features/meeting_pilot.md`, index row).
- `docs/progressing/to-verify.md` is empty.
- Current code already has list read receipts, completion receipts, open-scope text near buttons, safe-PDF filtering, click receipts, and Panorama fallback/full-detail proof.
- Gap: the actual `打开 Panorama` and `打开 PDF` controls have no dynamic `title` / `aria-label`. Users hovering or using a screen reader can miss whether a click is read-only, external-link-only, blocked, or unable to generate/repair PDF.
- Reminder: AppleScript did not list `Personal AI`; EventKit did. EventKit reported 4 total, 0 incomplete, 4 completed; none relate to Meeting Pilot history/Panorama/PDF/action-item review, so nothing to mark done.
- External product scan:
  - Zoom AI Companion Meeting Summary distinguishes host/co-host start/stop, transcript option, participant-visible active state, and summary sharing/edit/delete paths.
  - Microsoft Teams Recap collects recording, transcript, files, notes, agenda, AI summary, and follow-up tasks, with access/sensitivity-policy caveats.
  - Otter Meeting Summary exposes automated summary, action items, highlights, and slide capture in the post-meeting email and links back to the full conversation.
  - LLM meeting recap research argues one fixed summary is not enough; highlights and structured hierarchical minutes serve different review needs.
- Design implication: Meeting History should keep “open existing material” separate from “share/send/regenerate/sync/create task”, and that separation should live on the button, not only in surrounding copy.

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Add helper functions inside `MeetingHistoryPage.vue` | The boundary is derived from existing local meeting state and matches the component's presentation helpers. |
| Assert stable phrases, not full exact text | Existing E2E style validates behavior-level copy while allowing minor wording changes. |
| No backend/API changes | Safe URL handling, meeting pagination, and Panorama detail hydration already exist. |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| The repo has broad pre-existing dirty files, including selected files | Keep edits scoped and report ownership boundaries. |
| Planning skill root differed from first attempted path | Used the actual listed `/Users/Esone/.agents/skills/planning-with-files/` path. |

## Resources
- `AGENT.md`
- `docs/index.md`
- `docs/features/meeting_pilot.md`
- `src/modals/components/MeetingHistoryPage.vue`
- `desktop-app/scripts/meeting-pilot-history-check.mjs`
- `package.json`
- Zoom Meeting Summary: https://support.zoom.com/hc/en/article?id=zm_kb&sysparm_article=KB0058013
- Microsoft Teams Recap: https://support.microsoft.com/en-us/teams/meetings/recap-in-microsoft-teams
- Otter Meeting Summary Overview: https://help.otter.ai/hc/en-us/articles/9156381229079-Meeting-Summary-Overview
- Meeting recap paper: https://arxiv.org/html/2307.15793v2

## Visual/Browser Findings
- Browser search confirmed comparable tools present post-meeting assets as a collection with explicit access, sharing, transcript, and action-item states rather than a single generic “open recap” action.
