# Today Mission Action Button Boundaries

## Target

- Random feature: `今天 Mission` in `docs/features/today_pilot.md`.
- Scope: Today Pilot homepage mission card action controls in `src/modals/components/OverviewPage.vue`.
- Reminder check: EventKit found the `Personal AI` list, with no incomplete items.

## Research Notes

- Microsoft Plan My Day ranks top priorities and pending decisions, but its own guidance frames output as a starting point that still needs user verification.
- Reclaim and Motion both push AI planning toward automatic scheduling and dynamic reprioritization, which makes clear task/action consequences more important at control points.
- Microsoft Research on AI-powered reminders highlights collaboration commitments and follow-ups as useful reminder targets.
- Proactive-agent research warns that proactive help can reduce perceived competence/satisfaction, so Today Mission should preserve user agency at each action button.

## Plan

1. Keep the existing mission-level `操作前回执`, but add button-level `title` and `aria-label` copy for `完成/从首页移除`, `稍后 6h`, `有用`, `不准确`, `复制上下文包`, `打开详情`, and `不再提醒同类`.
2. Make OpenClaw execution-card button copy explicit that `从首页移除` is not approve/retry/execute.
3. Update static verifier and E2E assertions so this does not regress into generic button labels.
4. Update `docs/features/today_pilot.md` and `docs/features/index.md` to describe the button-level hover/reader boundary without adding unnecessary implementation detail.
5. Run `verify:day-pilot-home`, `npm start` to first successful compile, `verify:today-pilot-home:e2e`, scoped `git diff --check`, and `verify:i18n`.
