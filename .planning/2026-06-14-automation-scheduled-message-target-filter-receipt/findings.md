# Scheduled Messages Target Filter Receipt Findings

## Initial Context

- `docs/progressing/to-verify.md` says `暂无。`.
- Automation memory showed the most recent runs covered Google Slides skipped reasons, Agent Thinking approval retry receipts, and Memory Service `/events` multi-user identity receipts.
- Local Reminders list names: `We`, `Next actions`, `Moives`, `Shopping List`, `家庭`, `人名记忆`, `宝宝需要办理`, `吃吃看`, `出门前检查`, `装修待办`, `Reading`, `菜头`, `Tasks`.
- No visible `Personal AI` Reminders list exists, so no Reminder feedback can be used or completed this run.
- The worktree is already heavily dirty. Keep edits scoped to Scheduled Messages filter code/docs/tests plus this planning directory and automation memory.

## Code And UX Findings

- Selected feature from `docs/features/index.md`: `定时消息列表筛选`.
- Source doc: `docs/features/scheduled_messages_manager.md`.
- Main implementation files:
  - `src/scheduled-messages/ScheduledMessagesManager.tsx`
  - `src/scheduled-messages/scheduledMessagesFilters.ts`
  - `src/scheduled-messages/__tests__/scheduledMessagesFilters.test.ts`
  - `tools/verify-scheduled-messages-crud-focus-e2e.mjs`
- Current ordinary filtering is already documented and implemented through `buildScheduledMessagesFilterReceipt(...)`.
- Current target deep link behavior: when `messageId` is present, `filteredMessages` returns the target row directly and suppresses the ordinary list-filter receipt.
- UX gap: the target banner only says `已定位消息` and status. It does not explain that target focus is overriding pending-review/category/self-only filters for inspection only, nor that it has not approved, rejected, paused, sent, deleted, or written Sheet data.

## External Reference Findings

- Zapier Zap history exposes run filters and removable filter chips, and distinguishes deleting a finished run record from undoing an action. This supports making filter/focus UI explicit about view-only versus execution side effects.
- Airtable automation history documents filtering run history by status and expanding failed runs for details. This supports keeping target details reachable even when a status filter would otherwise hide the row.
- Microsoft Power Automate run history in Dataverse treats run history as structured records with status, trigger type, owner, errors, and retention/completeness caveats. This supports visible scope/completeness receipts instead of implying the list view is the whole truth.
- Zhang et al., `Helping Users Debug Trigger-Action Programs`, reports end users face obstacles moving from observed automation behavior to pinpointing and fixing the issue. This supports an in-context receipt that tells users why one scheduled row is being shown and what actions have not happened.
