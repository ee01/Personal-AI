# Doubao / ChatGPT Explorer Pending Settings Plan

Goal: improve `Doubao / ChatGPT explorer 输入链路` so the Desktop App makes unsaved source settings visibly separate from saved/background-effective explorer state.

## Plan

| Step | Status | Work |
| --- | --- | --- |
| 1 | completed | Read `AGENT.md`, `docs/progressing/to-verify.md`, automation memory, feature index, Reminders list state, Doubao Bridge doc, and explorer code paths. |
| 2 | completed | Scan current product and research references for AI memory import/export, provenance, and long-term memory extraction. |
| 3 | completed | Add a source-card pending-settings receipt that names changed fields and states that background auto-read/revoke still use saved settings until Save/Login/Run. |
| 4 | completed | Update the Doubao Bridge doc and feature index with the current behavior. |
| 5 | completed | Extend the desktop-app browser check to verify the pending receipt and action ordering for manual run after unsaved edits. |
| 6 | completed | Run targeted checks, desktop build, `git diff --check`, update automation memory, and attempt archive. |

## Decisions

- Selected feature: `Doubao / ChatGPT explorer 输入链路`.
- Source doc: `docs/features/doubao_bridge.md`.
- Primary UI/code: `desktop-app/app/renderer.js` source cards and `desktop-app/scripts/doubao-source-toggle-gating-check.mjs`.
- Reminder result: local Reminders is reachable but has no `Personal AI` list, so no Reminder item can be incorporated or completed.
- Improvement slice: show a visible pending-settings receipt immediately after source settings change, before the user clicks Save/Login/Run. This is low-decision and reduces a real state-boundary ambiguity without changing the ingestion pipeline.

## Errors

| Error | Resolution |
| --- | --- |
| Existing root `task_plan.md` is stale from an older Scheduled Messages run. | Use this isolated `.planning` directory for the current run and avoid editing the stale root planning files. |
