# Agent Workflow Evidence Copy Lock Plan

## Selected Feature

- Feature: Agent Workflow 运行诊断
- Canonical doc: `docs/features/agent_workflow.md`
- Index row: `Agent Workflow 运行诊断`

## Context

- `docs/progressing/to-verify.md` is empty.
- The `Personal AI` Reminders list exists, has 4 total items, and has 0 incomplete items, so no Reminder feedback is incorporated in this pass.
- Recent automation memory already covered Today Pilot, Outreach, Prompt Config, Project Dashboard, Storyline, Scheduled Messages, Topic Messages, Action Queue, Memory Lens, Skill Foundry, Notification, and User Profile surfaces. This pass avoids those exact latest surfaces.

## External Scan

- OpenAI Agents SDK tracing, LangGraph persistence, OpenTelemetry GenAI agent spans, and structural-coverage research all point to the same product requirement: local agent traces should be portable and inspectable, but must preserve clear boundaries between copied/debug evidence and real execution, writeback, notification, or release-gate proof.

## Improvement Plan

1. Treat Agent Workflow evidence-package copying as a short local handoff lock.
2. While clipboard write is pending, lock the test input fields, source selectors, replay/sample controls, saved-scenario controls, and baseline/report actions so a copied packet cannot be visually mixed with a newly edited current input.
3. Update the pending receipt to state that this temporary lock exists only to keep the evidence snapshot aligned and does not write Memory Service, send notifications, execute automation, overwrite baselines, or export reports.
4. Extend `tools/verify-agent-workflow-options-e2e.mjs` to assert the pending copy lock and keep the existing success/failure/stale-copy checks.
5. Update `docs/features/agent_workflow.md` and the `docs/features/index.md` row concisely.

## Validation Target

- `npm run verify:agent-workflow`
- `node --check tools/verify-agent-workflow-options-e2e.mjs`
- `npm start -- --progress` until first successful compile, then stop it
- `npm run verify:agent-workflow-options:e2e`
- `npm run verify:i18n`
- scoped `git diff --check`
