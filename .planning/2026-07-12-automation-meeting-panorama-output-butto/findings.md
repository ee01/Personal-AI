# Findings & Decisions

## Requirements
- Pick a random feature from `docs/features/index.md`, avoid immediately repeating the newest exact automation targets, inspect docs/code, research similar products and papers, check local Reminders, plan first, implement, update docs, and verify thoroughly.
- Selected feature: `会后 Panorama` under Meeting Pilot (`docs/features/meeting_pilot.md` and `src/meeting-shell/meetingPanorama.tsx`).

## Research Findings
- Existing docs are mostly current: Panorama has output receipts, archive-source receipts, follow-up readiness, safe PDF/recording checks, and feedback receipts.
- Code gap: the first-screen `输出范围回执` exists, but header/footer/follow-up buttons do not carry the same boundary in `title` / `aria-label`. Users and screen-reader users can still see a plain action button before understanding it only copies/opens/exports existing material.
- Reminder state: AppleScript listed many reminder lists but not `Personal AI`; EventKit found `Personal AI`, 4 total items, 0 incomplete items. No Meeting Pilot feedback was open, so nothing should be marked done.
- Zoom AI Companion surfaces explicit start/stop and transcript/summary controls for meeting AI: https://support.zoom.com/hc/en/article?id=zm_kb&sysparm_article=KB0058013
- Microsoft Teams Recap groups recording, transcript, shared files, notes, agenda, and follow-up tasks in one recap surface: https://support.microsoft.com/en-us/teams/meetings/recap-in-microsoft-teams
- Otter positions summaries, decisions, action items, insights, and action-item automation as meeting outputs: https://otter.ai/
- LLM meeting recap research argues for complementary highlights and hierarchical minutes, not a single flat summary: https://arxiv.org/html/2307.15793v2

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Add local boundary helper functions in `meetingPanorama.tsx` | Keeps copy close to the derived output state and avoids changing Meeting Pilot backend behavior. |
| Assert stable phrases in E2E | The requirement is the boundary meaning, not exact full sentence layout. |
| Keep behavior presentation/accessibility-only | No change to asset safety, archive loading, downloads, clipboard fallback, feedback persistence, or external task writes. |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| Broad dirty worktree pre-existed | Keep scoped edits to the selected feature and report only this run's owned changes. |

## Resources
- `docs/features/meeting_pilot.md`
- `src/meeting-shell/meetingPanorama.tsx`
- `desktop-app/scripts/meeting-pilot-panorama-check.mjs`
- `package.json` / `desktop-app/package.json` Meeting Pilot scripts
