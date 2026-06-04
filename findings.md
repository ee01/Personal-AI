# Scheduled Messages One-Click Init Findings

## 2026-06-04 Initial Findings

- Randomly selected feature from `docs/features/index.md`: `定时消息一键初始化`.
- Feature owner/capability: Scheduled Messages.
- Source document: `docs/features/scheduled_messages_manager.md`.
- Local Reminders list scan returned: `We`, `Next actions`, `Moives`, `Shopping List`, `家庭`, `人名记忆`, `宝宝需要办理`, `吃吃看`, `出门前检查`, `装修待办`, `Reading`, `菜头`, `Tasks`.
- No visible Reminders list named `Personal AI`; there are no local Reminder items to incorporate or complete for this feature in this run.
- The worktree has many unrelated dirty files from prior work. Treat all pre-existing changes as user/automation-owned and avoid reverting them.

## Code And UX Findings

- `docs/features/scheduled_messages_manager.md` is current for the one-click setup behavior: it describes Sheet/App Script/Web App creation, authorization handoff, owner-only fallback when domain sharing fails, setup receipt metadata, and Config sync.
- Current code path: `OneClickSetup` calls `SheetInitializer.createScheduledMessagesSheet()`, pauses for Apps Script authorization when needed, then calls `completeInitialization()` with `deploymentId`, `messagesSheetId`, and `logsSheetId` metadata.
- Existing verifier coverage: `tools/verify-scheduled-messages-one-click-setup.ts` asserts no `anyone` sharing fallback, setup warnings, and Config persistence; `tools/verify-scheduled-messages-one-click-setup-e2e.mjs` checks the initial uninitialized setup screen.
- UX gap: after successful phase-two initialization, `ScheduledMessagesManager.handleInitializationComplete()` only reloads after 2 seconds. The initialized page does not surface a durable post-reload setup receipt, even though the setup flow already has useful Sheet/script/deployment/trigger/warning metadata.
- Low-decision implementation slice: store a compact one-time setup receipt in `chrome.storage.local` before reload, then show it through the existing `configSyncNotice` banner after the initialized manager loads.

## External Reference Findings

- Google Apps Script installable triggers run under the creator account and can be time-driven as frequently as every minute, but trigger timing can be randomized within a window. This supports keeping setup receipts clear about trigger ownership and avoiding exact-time guarantees.
- Google Apps Script `ClockTriggerBuilder.nearMinute()` is approximate and uses a random minute if omitted; queue/compensation UI should keep explaining timing tolerance.
- Google Drive permission docs model sharing as explicit `type` and `role`; the current code's domain-writer-only attempt and owner-only fallback are aligned with privacy-sensitive Sheets.
- Twilio scheduled messaging exposes scheduled/canceled status and send-time failures, supporting visible post-setup and run-state receipts rather than treating creation success as delivery success.
- Zapier and Airtable automation docs emphasize run history/status and per-step troubleshooting; this supports showing the user what setup steps were completed and what remains actionable.
- Trigger-action programming papers report that end users misinterpret rule behavior and benefit from simulation/foreseeability/debug cues; a concise setup receipt is a small but direct improvement to the mental model.
