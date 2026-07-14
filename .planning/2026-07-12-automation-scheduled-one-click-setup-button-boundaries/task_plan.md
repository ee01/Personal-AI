# Task Plan: Scheduled Messages One-Click Setup Boundaries

## Goal

Improve the randomly selected `定时消息一键初始化` feature so the setup, authorization, and recovery buttons explain their effects before click, while keeping the initialization logic unchanged.

## Context

- `docs/progressing/to-verify.md` is empty.
- Random sampling from `docs/features/index.md` produced several recent exact/family targets; this run selected `定时消息一键初始化` after skipping fresh Doubao revoke, Topic read, Storyline, Relationship, Today, Meeting, Agent Workflow, Memory Lens, and Message Analysis candidates.
- Reminder check: AppleScript did not expose `Personal AI`; EventKit found the local `Personal AI` list with 0 incomplete items, so no Reminder feedback was incorporated or marked done.
- Current docs already describe the setup receipts, but the actual buttons lack equivalent hover / screen-reader boundaries.

## External Signals

- Zapier separates trigger test records, Zap runs, and Zap History, reinforcing that setup/test/run states should be visibly distinct.
- Power Automate troubleshooting starts by identifying whether the trigger itself failed and then checking connections, skipped trigger runs, permissions, and run history; setup UIs should keep recovery actions and real trigger execution separate.
- Google Apps Script installable triggers can run under the authorization of the user who created the trigger, so the authorization and trigger-creation phase needs precise wording.
- Trigger-action debugging research reports that non-programmers struggle to pinpoint why automations behave incorrectly; stepwise simulation and explanations help users correct rules.

## Plan

1. [x] Add reusable one-click setup button boundary copy for setup start, API settings open, API retry, authorization open, and authorization completion.
2. [x] Apply the copy to `title` and `aria-label` on the actual buttons without changing click behavior or initialization data flow.
3. [x] Update the Scheduled Messages one-click setup E2E to assert the new control-point boundaries.
4. [x] Refresh the canonical feature doc and index row with concise current behavior.
5. [x] Verify with the targeted static script, dev build first successful compile, one-click setup E2E, and scoped diff checks.

## Verification

- `node --check tools/verify-scheduled-messages-one-click-setup-e2e.mjs`
- `npm run verify:scheduled-messages-one-click-setup`
- `npm start -- --progress` compiled successfully in 16736 ms and was stopped after the first success
- `npm run verify:scheduled-messages-one-click-setup:e2e`
- `git diff --check -- .planning/.active_plan .planning/2026-07-12-automation-scheduled-one-click-setup-button-boundaries/task_plan.md .planning/2026-07-12-automation-scheduled-one-click-setup-button-boundaries/research.md src/scheduled-messages/components/OneClickSetup.tsx tools/verify-scheduled-messages-one-click-setup-e2e.mjs docs/features/scheduled_messages_manager.md docs/features/index.md`
- Process check found no remaining webpack watcher or one-click setup E2E/browser process from this run.

## Non-Goals

- No changes to Google Sheet / Drive / Apps Script API requests.
- No changes to trigger creation, sample-message writing, Config sync, deployment IDs, sharing fallback, or storage schema.
- No Reminder mutation because there are no incomplete Personal AI items.
