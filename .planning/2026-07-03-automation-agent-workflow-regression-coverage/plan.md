# Agent Workflow Regression Sample Coverage Plan

## Target

- Feature: `Agent Workflow 关注项测试`
- Canonical doc: `docs/features/message_analysis.md`
- Main UI/source: `src/options.tsx`, `src/agentWorkflowReplay.ts`

## Context

- `docs/progressing/to-verify.md` has no carry-over item.
- Automation memory shows many recent receipt-oriented feature sweeps; avoid repeating the freshest exact targets.
- Local Reminders: AppleScript did not list `Personal AI`, EventKit did. The list had 4 completed historical Doubao / notification feedback items and no open Agent Workflow item.

## External Scan

- OpenAI Agents SDK treats tracing as a way to visualize/debug agent flows and connect them to evaluation loops.
- LangSmith evaluation emphasizes curated datasets, offline regression comparison, and adding failing production traces back into datasets.
- `Testing Agentic Workflows with Structural Coverage Criteria` argues that end-to-end success alone does not prove declared agents/tools/routes were exercised; structural coverage is a useful adequacy layer.

## Improvement Plan

1. Add a local-only `回归样本构成` receipt for saved Agent Workflow scenarios.
2. Count whether the saved scenario set covers baselines, notification, low-confidence review, storage-only, rule attribution, Trace review, and Agent config versions.
3. Render it near saved-scenario and batch-regression controls so the user sees sample coverage before treating batch regression as release evidence.
4. Keep the change presentation-only: no Memory Service write, notification send, automation execution, baseline writeback, or real message-entry behavior changes.
5. Update focused helper/E2E assertions and canonical feature docs.

## Verification Plan

- `npm run verify:agent-workflow`
- `npm start -- --progress`, stop after first successful compile
- `node tools/verify-agent-workflow-options-e2e.mjs`
- scoped `git diff --check`
