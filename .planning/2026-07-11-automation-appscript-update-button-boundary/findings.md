# App Script Auto Update Button Boundary Findings

## Repo And Reminder Findings

- `docs/progressing/to-verify.md` is empty, so this run can pick a fresh feature from `docs/index.md`.
- Random selection was rerolled away from exact features covered in today's automation memory. The selected bounded target is `App Script 自动更新` under Scheduled Messages.
- AppleScript listed local Reminder lists but missed `Personal AI`.
- EventKit read `Personal AI`: 4 total items, 0 incomplete. All completed items are historical Doubao / notification feedback and unrelated to App Script upgrade, Project History, deployment update, version endpoint, or Scheduled Messages update controls.
- The worktree is broadly dirty from prior automation/user work. Keep edits scoped to App Script auto-update UI, tests, docs, planning, and automation memory.

## Code Findings

- `docs/features/scheduled_messages_manager.md` already describes the core App Script update contract: `deployments.update`, same Web App URL, SemVer, anonymous `getVersion`, deployment URL match, Personal AI project-content check, Project History limit, post-update version confirmation, rollback attempt, and persistent result receipt.
- `src/scheduled-messages/AppScriptUpdater.ts` has the update safety logic and does not need behavior changes for this UX pass.
- `src/scheduled-messages/ScheduledMessagesManager.tsx` already shows update banners and persistent request/result receipts, but several actual controls only have terse or missing button-level labels:
  - header `检查脚本`
  - header update button / cleanup button
  - update banner `打开 Project History`
  - update banner `重新检查`
  - update banner `升级调度系统` / `打开 Project History`
  - error banner `打开版本端点`, `打开 Apps Script`, and `重试检查`
- Existing `tools/verify-appscript-auto-update.ts` and `tools/verify-appscript-auto-update-e2e.mjs` are the right targeted verifier/E2E surfaces.

## External Reference Findings

- Google Apps Script deployment docs say updating an existing deployment means creating a new version and editing that deployment to point to the new version, preserving URL/deployment identity.
- Google Apps Script versions docs say script versions are immutable and projects can have up to 200 versions, matching the Project History capacity UI.
- Microsoft Power Automate solution-aware flows expose drafts/version history and publish as a distinct step, supporting clear pre-click "check vs publish/update" boundaries.
- The Update Framework spec and related papers emphasize explicit version/rollback/trust boundaries for update systems; this supports keeping target version, verification, rollback, and stale-config protection visible at mutation controls.
- Trigger-action programming debugging research shows users struggle to debug automations without state and consequence cues, supporting button-level labels for check/retry/open/update controls rather than relying only on nearby banner text.
