# Agent Workflow Saved Sample Capacity Plan

## Target

- Feature: `Agent Workflow 关注项测试`
- Docs: `docs/features/message_analysis.md`
- Main code: `src/agentWorkflowReplay.ts`, `src/options.tsx`
- Verification: `npm run verify:agent-workflow-replay`, `npm start`, `node tools/verify-agent-workflow-options-e2e.mjs`, scoped `git diff --check`

## Plan

1. Add a first-screen saved-sample capacity receipt for the Options `关注项测试` panel.
   - Show current local saved-scenario count and the 12-item cap.
   - Distinguish updating the same input from adding a new sample.
   - Warn before save when a new sample will evict the oldest local sample.
2. Preserve the existing behavior.
   - Keep saved scenarios local to `chrome.storage.local.agentWorkflowSavedScenarios`.
   - Do not change workflow execution, matching, Memory Service writes, notifications, automation, batch regression, or baseline comparison logic.
3. Update save-result status copy.
   - After saving, say whether the action updated an existing input or added a new one.
   - If the local cap caused an eviction, name the evicted sample label.
4. Update feature docs and index with a concise current-state note.
5. Verify with the existing Agent Workflow static and extension E2E harnesses.

