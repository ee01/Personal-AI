# Findings & Decisions

## Requirements
- Randomly selected feature: `今天排序与噪声控制` under Today Pilot.
- Source doc: `docs/features/today_pilot.md`.
- Core implementation: `memory-service/src/core/DayPilotService.ts`.
- Preserve existing dirty worktree changes, especially already-modified Today Pilot context-pack handoff work.

## Research Findings
- Local Reminders list scan returned: `We`, `Next actions`, `Moives`, `Shopping List`, `家庭`, `人名记忆`, `宝宝需要办理`, `吃吃看`, `出门前检查`, `装修待办`, `Reading`, `菜头`, `Tasks`.
- No visible Reminders list named `Personal AI`; no Reminder feedback can be incorporated or marked done for this run.
- Current docs are broadly up to date for Today Pilot sorting/noise: concrete missions, source evidence, stale-signal penalties, relationship actionability, question-only filtering, source stats, and attention budget.
- Current backend already filters obvious low-action notifications, recurring calendar noise, casual question marks, old fact follow-up items, stale queued actions, and relationship records without follow-up semantics.
- UX bug candidate: UI labels `sourceStats.*.scanned` as "通过行动性筛选", but backend `scanned` means "entered source candidate pool" before final `nextBestAction` and mission-card filtering. A high-importance FYI message can produce `messages.scanned=1` and zero cards, making the visible filtering summary overstate actionability.
- External product reference: Microsoft Plan My Day emphasizes top 3-5 priorities ranked by impact, people blocked, time sensitivity, strategic alignment, direct links, and actionable context.
- External product reference: Gemini Daily Brief uses Gmail, Calendar, and Gemini chats, requires Personal Intelligence / Memory setup, and lets users inspect item sources.
- Research reference: Microsoft Viva Daily Briefing work found value in surfacing commitments and follow-ups that can otherwise fall through the cracks in asynchronous collaboration.
- Research reference: real-world adaptive notification scheduling supports delaying or budgeting interruptions rather than pushing every proactive signal immediately.

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Implement selected-source stats instead of only changing copy | The UI should distinguish raw totals, source candidates, and final mission evidence so users can trust the filtering summary. |
| Keep the change additive and optional | Existing stored briefs may not have the new field, so the frontend should fall back gracefully. |

## Issues Encountered
| Issue | Resolution |
|-------|------------|

## Resources
-
