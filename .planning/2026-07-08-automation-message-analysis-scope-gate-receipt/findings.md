# Findings

## Repo State

- `docs/progressing/to-verify.md` says `暂无。`
- Worktree has broad unrelated dirty state from prior automation runs. This run should only own the new planning directory, `.planning/.active_plan`, `src/modals/topic-modal.tsx`, `tools/verify-message-analysis-rule-diagnostics-e2e.mjs`, and concise docs/index updates if touched.
- Existing code already prevents out-of-scope LLM matches from writing memory or sending notifications. The UX gap is the aggregate `本轮分发统计` card only says `范围拦截 N`.

## Reminders

- AppleScript listed many Reminder lists but not `Personal AI`.
- EventKit fallback found `Personal AI` with 4 total items and 0 incomplete items.
- No open Reminder item is related to Message Analysis rule scope, sender/group filters, diagnostics, or blocked actions.

## External References

- Zapier filter docs: filter steps allow a Zap to continue only when app data meets conditions, include multiple criteria, and test data explicitly shows whether the filter would continue.
- Power Automate trigger conditions: conditions reduce unnecessary runs by preventing the flow from triggering when conditions are not met.
- Slack Workflow Builder conditional branching: visual branches/rules let non-programmers route work and include fallback/error messaging.
- SOUPS 2023 TAP security analysis: trigger-action rules can create undesirable behavior; users vary in ability to identify and correct rule anti-patterns, so user-facing diagnostics matter.
- CHI 2014 trigger-action programming: end users can work with if/then automation, but trigger/condition composition and debugging remain important design concerns.

## Implementation Direction

- Keep the existing per-rule `最近拦截` diagnostic card.
- Add an aggregate receipt below delivery counters when `scopeRejected > 0`.
- Receipt should state:
  - the blocked count is LLM-returned rule matches rejected by final sender/group gate;
  - blocked items did not write memory, notify, enter digest/auto reply/follow-up/action planning, or execute external actions;
  - the latest local diagnostic count backs the receipt;
  - the next step is to inspect rules with `最近拦截` or refine sender/group scope.
