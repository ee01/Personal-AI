# Findings

## Local Context

- `docs/progressing/to-verify.md` says `暂无。`; no carry-over verification item blocks a fresh feature.
- Local Reminders lists are readable, but there is no list named `Personal AI`; no Reminder item can be incorporated or completed in this run.
- Worktree is heavily dirty before this run; keep changes narrowly scoped.

## External Research

- OpenAI Agents docs emphasize traces for debugging and then evaluation loops, and route deeper workflows through orchestration, guardrails/human review, results/state, observability, and evals.
- LangGraph persistence docs separate thread-scoped checkpoints from long-term stores, which reinforces keeping local replay baselines distinct from durable memory writes.
- The 2026 arXiv paper `Testing Agentic Workflows with Structural Coverage Criteria` argues workflow tests should prove declared agents/tools/delegations were exercised, not only final task success.
- `AgentTrace` argues structured logs support debugging, accountability, and trust calibration; this supports lightweight receipts over raw log dumping.

## Code And UX Findings

- `npm run verify:agent-workflow` passed before edits, so the existing Agent Workflow logic is runnable in the current dirty tree.
- Batch baseline acceptance already has a persistent `批量基线写回回执`.
- Single saved-scenario baseline acceptance only sets a short status string (`已接受当前结果为新基线` / `已为保存样例建立当前结果基线`), so a user can miss that it wrote only local baseline data and did not write Memory Service, send notifications, execute automation, export reports, or copy raw message text.

## Verification

- `npm run verify:agent-workflow` passed after edits.
- `npm start` reached first successful webpack compile and was stopped.
- `node tools/verify-agent-workflow-options-e2e.mjs` passed and asserted `单条基线写回回执`.
- Scoped `git diff --check` passed for touched files.
- Process check found no lingering `webpack --watch` / `npm start` watcher.
