# Agent Workflow Batch Regression Receipt Plan

## Target

- Feature: `Agent Workflow 多 Agent 编排`
- Source doc: `docs/features/agent_workflow.md`
- Main surfaces: Options `关注项测试` saved-scenario batch regression path

## Context

- `docs/progressing/to-verify.md` has no carry-over item.
- Local Reminders list names are readable, but there is no `Personal AI` list.
- Recent automation memory already covered many exact receipt surfaces today; this run avoids those and focuses on Agent Workflow saved-scenario regression.
- External scan supports keeping agentic workflow tests observable, replayable, and separated from durable execution / human approval side effects.

## Improvement Plan

1. Add a structured `批量回归范围` receipt for Agent Workflow saved-scenario regression.
2. Show the receipt before/while/after batch runs so users can see this is a local replay gate, not Memory Service writeback, notification delivery, automation execution, read marking, baseline overwrite, or raw-message export.
3. Preserve the existing separate baseline writeback receipt for accepting changed/no-baseline results.
4. Update focused verifier and Options E2E assertions.
5. Update the canonical Agent Workflow feature doc.
6. Validate with focused scripts, first successful `npm start` compile, E2E, i18n, and scoped whitespace checks.

## Validation Targets

- `npm run verify:agent-workflow`
- `npm start -- --progress` until first successful compile, then stop
- `npm run verify:agent-workflow-options:e2e`
- `npm run verify:i18n`
- Scoped `git diff --check`
