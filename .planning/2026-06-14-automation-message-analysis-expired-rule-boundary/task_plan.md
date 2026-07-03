# Message Analysis Expired Rule Boundary Plan

Goal: improve the selected `手动关注项规则` feature by making expired manual rules inactive in the shared runtime builder and clear in the rule-page UX.

## Context

- Selected feature: `手动关注项规则` under Message Analysis.
- Source doc: `docs/features/message_analysis.md`.
- Carry-over: `docs/progressing/to-verify.md` says `暂无。`.
- Reminder state: local Reminders are readable, but there is no visible `Personal AI` list.
- Existing worktree is broadly dirty from prior automation work; this run owns only the Message Analysis expired-rule boundary files and this planning folder.

## External Signals

- Slack keyword workflows require explicit channel and keyword conditions before actions run.
- Zapier filters/paths make condition gates visible and stop later actions when data does not match.
- Trigger-action debugging research shows users need visible explanations for why automations did or did not run.
- Attention-sensitive alerting research supports making interruption and non-interruption states explicit.

## Plan

1. Add an active/manual-rule filter in `buildManualWatchRules(...)` so expired manual rules cannot enter Message Analysis, Agent Thinking, Agent Workflow, or auto-reply runtime matching.
2. Add a compact expired-rule receipt on rule cards so the page explains that an expired rule stays visible for review/export but will not capture new messages or trigger delivery/actions.
3. Extend the targeted message-flow verifier with an expired-rule case that must not ingest or notify.
4. Extend the Message Analysis E2E fixture to show the expired-rule receipt.
5. Update `docs/features/message_analysis.md` with the behavior and validation note.
6. Validate with the targeted verifier, `npm start` first compile, browser E2E, and scoped `git diff --check`.

