# Scheduled Messages Config Sync Findings

## Repo Findings

- `docs/progressing/to-verify.md` is empty, so this run picked a fresh item from `docs/index.md`.
- Random selection, after avoiding the freshest exact targets where practical, chose `定时消息配置同步` under Scheduled Messages.
- `docs/features/scheduled_messages_manager.md` already documents the core behavior: Config is cross-device source, local storage is cache, writes are Sheet-first, manual sync reads Sheet Config first, same-timestamp conflicts do not silently overwrite, and the banner explains Config vs Messages/Logs outcomes.
- `ConfigSyncService` already preserves unmanaged keys, deduplicates managed keys, uses `RAW` writes, blocks writes when Sheet Config is newer than the local base, recovers missing Config sheet/tabs, and uses Sheet or same-timestamp Sheet as the base for partial updates where appropriate.
- `ScheduledMessagesManager` already shows running/completion/failure Config sync banners, disables the sync button during in-flight work, and E2E covers Sheet-newer adoption, local-newer retention, conflict retention, Messages refresh failure, AgentTask no-open-read, and Sheet Config read failure.
- Gap: the `同步` button itself has only generic `同步数据` title text and no explicit `aria-label`, while nearby App Script buttons already have precise click-boundary copy. This leaves the click consequence unclear before interaction.

## Reminder Findings

- AppleScript list names: `We`, `Next actions`, `Moives`, `Shopping List`, `家庭`, `人名记忆`, `宝宝需要办理`, `吃吃看`, `出门前检查`, `装修待办`, `Reading`, `菜头`.
- EventKit result: granted, list names include `Personal AI`.
- `Personal AI` total: 4. Incomplete: 0.
- Items are completed historical Doubao / Notification / test feedback, not related to Scheduled Messages Config sync.

## External Reference Findings

- Google Sheets API `ValueInputOption.RAW` stores entered values as-is; `USER_ENTERED` may parse dates/numbers. Takeaway: Config sync should keep exact IDs, URLs, secret-status flags, and ISO timestamps as raw strings.
- Microsoft Power Platform environment variables keep app components stable while moving environment-specific references such as tables, connections, and keys. Takeaway: Personal AI should keep Sheet Config as the portable source and make local-cache adoption explicit.
- Airtable automation docs distinguish run history, rerun, and current automation configuration. Takeaway: a sync action should not imply that scheduled messages were sent or queue state was executed.
- Zhang et al. 2022, "Helping Users Debug Trigger-Action Programs", found users often cannot fix buggy automations without explicit support through the debugging stages. Takeaway: Config sync UI should name read/adopt/write/refresh stages at the control point and in receipts.
- Huang and Cakmak 2015, "Supporting Mental Model Accuracy in Trigger-Action Programming", shows users misinterpret trigger/action behavior when interfaces hide distinctions. Takeaway: "sync" should distinguish config adoption from queue execution before click.

