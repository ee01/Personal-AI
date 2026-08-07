# Agent Workflow Placeholder Diagnostics Plan

Goal: improve the randomly selected `Agent Workflow 运行诊断` feature by keeping docs current, incorporating Reminder and external research signals, implementing one low-decision UX/logic fix, and verifying through the repo harness.

## Phases

| Phase | Status | Scope |
| --- | --- | --- |
| 1 | completed | Read `AGENT.md`, root planning files, `docs/progressing/to-verify.md`, automation memory, memory notes, feature index, and current worktree state |
| 2 | completed | Randomly select `Agent Workflow 运行诊断`, inspect the feature doc, diagnostics helper, Options UI wiring, and existing verifier/E2E |
| 3 | completed | Check local Reminders with AppleScript and EventKit fallback; run current product/paper scan |
| 4 | completed | Patch placeholder-tool fallback so diagnostics and next actions stay consistent when only `storageReview.toolPlaceholderCount` survives |
| 5 | completed | Update `docs/features/message_analysis.md` and focused verifier coverage |
| 6 | completed | Run targeted verifier, `npm start` first successful compile, Options E2E, and scoped `git diff --check` |
| 7 | completed | Update automation memory and final summary |

## Decisions

- Selected feature: `Agent Workflow 运行诊断` from `docs/index.md`, after avoiding the freshest exact automation targets.
- Source doc: `docs/features/message_analysis.md`.
- Implementation slice: bridge the UX gap where `storageReview.toolPlaceholderCount` indicates placeholder tools but the live trace lacks labels, causing the diagnostic block and next-step list to understate the issue.
- Keep change in `src/agentWorkflowDiagnostics.ts`, `tools/verify-agent-workflow-diagnostics.ts`, and the feature doc; run the existing Options E2E as UI proof.

## Reminder Findings

- AppleScript listed reminder lists but did not show `Personal AI`.
- EventKit fallback found `Personal AI` with 4 items; all are already completed historical Doubao / digest / sync feedback and are unrelated to Agent Workflow diagnostics.
- No Reminder item should be marked done in this run.

## External Findings

- OpenAI Agents SDK tracing treats agent runs as traceable workflow events spanning LLM calls, tool calls, handoffs, guardrails, and custom events.
- LangGraph persistence/checkpointers support thread-scoped checkpoints for human-in-the-loop, time travel, and fault tolerance.
- OpenTelemetry GenAI conventions include agent, conversation, tool, data source, evaluation, and workflow attributes; the current OTel docs page notes the GenAI conventions moved to a dedicated repository.
- The May 26, 2026 arXiv paper `Testing Agentic Workflows with Structural Coverage Criteria` argues that end-to-end success alone does not prove declared agents/tools/delegation paths were exercised, supporting explicit structural diagnostics.

## Errors Encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
| Perl random sampler printed mojibake for Chinese rows | Initial random candidate sampling | Use the first viable row by English feature/doc fields: `Agent Workflow 运行诊断` |
| AppleScript missed `Personal AI` reminders list | First Reminder probe | EventKit fallback found the list and confirmed items were completed/unrelated |
| Missing npm E2E alias | `npm run verify:agent-workflow-options:e2e` | Ran existing verifier directly with `node tools/verify-agent-workflow-options-e2e.mjs` |
