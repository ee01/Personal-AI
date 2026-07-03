# Findings & Decisions

## Requirements
- Random feature: `今天排序与噪声控制` under Today Pilot, documented in `docs/features/today_pilot.md`.
- User asked to verify docs against code, scan comparable products/papers, implement low-decision unfinished improvements, improve UX, test as fully as practical, update docs, and close out automation memory/archive.
- `docs/progressing/to-verify.md` currently says there are no carry-over verification items.
- Local Reminders is reachable but does not contain a `Personal AI` list, so no feedback item can be incorporated or marked done.

## Research Findings
- Microsoft 365 Copilot Plan My Day describes a morning briefing that ranks top priorities across Outlook, Teams, files, and Calendar by business impact, people blocked, time sensitivity, and strategic alignment, with direct links and actionable context: https://learn.microsoft.com/en-us/microsoft-365/copilot/extensibility/agent-template-plan-my-day
- Gemini Daily Brief frames the daily assistant as a prioritized morning overview from Gmail, Calendar, and Gemini chats, with source inspection and feedback adaptation: https://gemini.google/overview/daily-brief/
- Iqbal and Bailey, "Effects of Intelligent Notification Management on Users and Their Tasks", argues that notification timing and relevance affect frustration/reaction time, supporting Today Pilot's explicit reminder budget and suppression boundaries: https://interruptions.net/literature/Iqbal-CHI08.pdf
- "Intelligent Notification Systems: A Survey of the State of the Art and Research Challenges" summarizes breakpoint/interruption research and reinforces that intelligent notification systems need explainable timing and suppression, not just raw ranking: https://arxiv.org/pdf/1711.10171
- Product direction: keep Today Pilot opinionated and sparse, but make the suppression/selected-count receipt reflect the current visible state after user feedback or source-state changes. Stale selected counts undermine trust because they make a cleared board look like it still has selected evidence.

## Technical Findings
- `docs/features/today_pilot.md` already describes mission ranking/noise rules, first-row filtering scope, per-card ranking receipts, mission feedback receipts, and context-pack boundaries.
- Relevant code/test surfaces found so far: `memory-service/src/core/DayPilotService.ts`, `memory-service/src/__tests__/api-day-pilot.test.ts`, `src/modals/components/OverviewPage.vue`, `src/popup.tsx`, and `tools/verify-today-pilot-home-e2e.mjs`.
- Existing verifier script: `npm run verify:today-pilot-home:e2e`.
- Gap found: selected evidence counts were stored at generation time, while `DayPilotRepository.buildBrief()` can later hide cards because of done/later/mute feedback or completed source actions. The UI/popup also preferred `sourceStats.*.selected`, so aggregate receipts could show old selected evidence after the user had already cleared cards.

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Prefer a small user-visible trust/triage improvement | Today Pilot already has broad ranking receipts; the useful gap should reduce a concrete misread in the user journey. |
| Use existing Today Pilot tests/E2E | The repo already has a focused backend test suite and browser verifier for this feature. |
| Recompute selected evidence from returned/visible cards | The receipt label says evidence entered current homepage missions; it should not report generation-time cards that are hidden by feedback, source completion, or local display gates. |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| Large dirty worktree | Do not revert unrelated files; inspect exact local structure before patching. |

## Resources
- `AGENT.md`
- `docs/features/index.md`
- `docs/features/today_pilot.md`
- `${CODEX_HOME:-$HOME/.codex}/automations/automation/memory.md`
