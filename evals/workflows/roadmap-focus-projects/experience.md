# Roadmap Focus Projects Experience Workflow

## Goal

验证 Personal Roadmap 与记忆系统联动时：重点项目上下文压缩、按团队权威覆盖同步、以及日期漂移抽取是否符合契约。

## Real User Scenarios

1. 用户把 Nova 与 RCV 两个团队的 Epic 都排进 Gantt；消息分析 prompt 必须两边都有代表项，且优先显示备注名而不是超长 Jira 标题。
2. 用户清理 Nova 过期任务后重新同步；RCV 的重点项目不得被归档。
3. 群里说“NOVA-1 推到 8/15”；系统只入库并在 Roadmap 出漂移角标，不发 Glip 提醒。

## Steps

1. Load cases from `evals/cases/roadmap-focus-projects/cases.jsonl`.
2. For context_builder cases, call `FocusProjectContextBuilder` directly and assert aliases / team floors.
3. For focus_sync cases, use an in-memory SQLite with migration 057 and run `syncFocusProjectsForTeam` twice.
4. For timeline_extract cases, feed a synthetic message through `ProjectTimelineExtractor` (or a deterministic fixture judge when LLM is unavailable).
5. Confirm project watch rules never carry notifyMethod.
6. Produce the standard HTML eval report.

## Pass Criteria

- Row context prefers `displayName`/alias over long Jira titles.
- Tight budget keeps at least one project per team when possible.
- Sync overwrite archives only the same `team_ref`.
- Date-change receipts expose actionable `toValue` and stay notification-free.

## Report Requirements

- Show selected project labels and excluded long titles.
- Show per-team focus/archived keys after overwrite.
- Show extracted event type, toValue, status, and notifyMethod emptiness.
- Include a user-facing conclusion and next steps for failures.

## Local Run

```bash
npm run eval:validate
npm --prefix memory-service test -- --run src/__tests__/focusProjectContextBuilder.test.ts
```
