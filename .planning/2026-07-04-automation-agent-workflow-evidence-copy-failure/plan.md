# Agent Workflow evidence-copy failure receipt plan

## Target
- Feature: Agent Workflow 关注项测试 (docs/features/agent_workflow.md).
- Scope: Options test panel single-run evidence packet copy path.

## Context
- docs/progressing/to-verify.md has no carry-over.
- Automation memory freshest target was Skill Foundry platform sync; recent exact/family targets skipped.
- Reminder check: AppleScript did not list Personal AI, Swift/EventKit did. Four Personal AI items are completed and unrelated to Agent Workflow.
- Current docs/code already expose run-scope, saved-scenario, regression-coverage, and stale evidence receipts.

## External scan
- OpenAI Agents SDK tracing and HITL emphasize visible trace/debug state and explicit approval/resume boundaries.
- LangGraph persistence/durable execution emphasizes resumable state and failure recovery rather than opaque reruns.
- LangSmith evaluation and agentic workflow structural coverage research support portable evidence packets, but only when evidence qualification is explicit.
- Constructive improvement: copy/export failure should be a first-class local receipt, not a generic error string, because otherwise users can mistake a failed clipboard handoff for transferred evidence.

## Plan
1. Add typed Agent Workflow evidence-copy receipt state covering success and failure.
2. Render the receipt inline in the evidence packet card for both success and failure; failure must state no clipboard write/export/baseline/memory/notification/automation happened.
3. Keep existing successful-copy semantics and evidence packet text unchanged.
4. Extend focused diagnostics/unit verifier and Options E2E to assert the failure receipt and no-success ambiguity.
5. Update docs/features/agent_workflow.md concisely.
6. Validate with targeted scripts, first successful npm start compile, fresh extension E2E, and scoped diff check.

## Files expected
- src/options.tsx
- tools/verify-agent-workflow-options-e2e.mjs
- docs/features/agent_workflow.md
- .planning/2026-07-04-automation-agent-workflow-evidence-copy-failure/plan.md

## Outcome
- Completed: added visible Agent Workflow evidence-copy failure receipt in the Options evidence packet card.
- Completed: extended Options E2E with a mocked clipboard-denied path.
- Completed: documented the clipboard failure boundary in `docs/features/agent_workflow.md`.
- Verified: `npm run verify:agent-workflow`, `node --check tools/verify-agent-workflow-options-e2e.mjs`, first successful `npm start -- --progress` compile, `node tools/verify-agent-workflow-options-e2e.mjs`, scoped diff checks, and no leftover watcher/E2E process.
