# Findings

## Repo And Carry-Over

- `AGENT.md` requires the random feature loop to check `docs/progressing/to-verify.md`, automation memory, Reminders, docs/code, then verify with targeted scripts, `npm start` first compile, E2E, and `git diff --check`.
- `docs/progressing/to-verify.md` currently says `暂无。`
- The worktree has broad unrelated dirty state from previous sweeps, so this run must stay tightly scoped.

## Target Feature

- Random sample included `队列健康提示`; selected it because it is not the freshest exact target and has `verify:scheduled-messages-health-recovery:e2e`.
- Current docs already describe health triage, diagnostic distribution, visible issue cap, success/failure receipts, and operation boundaries.
- Current UI disables all health action buttons during submit, but a clicked health issue does not show an inline pending receipt that names the specific row, clicked target, and unconfirmed boundaries.

## Reminders

- AppleScript list enumeration did not show `Personal AI`.
- EventKit fallback did show `Personal AI` with 4 total items and 0 incomplete items.
- All existing items are completed historical Doubao / digest / test feedback, unrelated to Scheduled Messages health recovery. Nothing to mark done.

## External Scan

- Zapier troubleshooting docs emphasize task history, failed task replay, and Autoreplay for temporary failures.
- Airflow Grid View emphasizes visible task states, tooltips, logs, and task-level actions for debugging/retry.
- Temporal Web UI emphasizes workflow execution state and metadata for debugging, with local saved visibility views.
- Notification interruption research supports batching and explicit recovery state rather than extra disruptive prompts.

## Chosen Improvement

- Add a row-level `改期写入中` receipt under the clicked health issue while `service.updateMessage` / reload is in flight.
- The receipt should say source is health alert, target `Messages` row, clicked suggestion, write scope is only `Schedule_Date` / `Schedule_Time`, other health rows are not changed, and sending / Logs / Jira confirmation are not yet confirmed.
