# Findings

## Requirements
- Task Center currently: fixed datetime + optional Day/Week/Month/Year repeat
- User wants Timeline as the repeat trigger (project + milestone + offset)
- Match Scheduled Messages Timeline semantics

## Research
- GAS `determineMessageType`: Timeline if `!Schedule_Date && Timeline_Milestone`
- `shouldMarkAsDone` for Timeline always false → each new release fires again
- Task Center ☁️ mapper currently always writes Schedule_Date from scheduledAt; that would mis-classify Timeline as OneTime
- `listDueAutoActions` already skips `jira_sheet`
- `isRecurringSchedule` requires repeatEvery, so Timeline spec will not be cloned by memory_cron roller (correct)

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| recurrenceSpec.trigger = 'timeline' | Distinct from calendar repeatEvery; hydrate/list/mapper share one detector |
| Empty Schedule_Date on Sheet | Required for GAS Timeline classification |
| Disable Timeline without Timeline Sync Rule | Otherwise Jira skips the row until cache exists |
| Expose Timeline on AgentTask / 帮我做 | Previously hidden to match a conservative ledger concern; execute creates a new action per executionKey and Timeline rows stay Active |

## Agent / 帮我做
- Scheduled Messages previously wrapped 触发方式 in `{!isAgentTaskMode && (` twice; save already wrote Timeline_* if `isTimelineTrigger`. Gate removed.
- Task Center Agent 任务 now uses the same Timeline UI as 定时推送; switching push↔agent keeps the spec.
- GAS `findMatchingMessage` already includes `Push_Method === 'AgentTask'`; `shouldMarkAsDone` is false for Timeline.
