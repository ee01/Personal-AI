# App Script 升级请求回执计划

## 目标功能

- 随机抽取后过滤掉今天已覆盖的精确面，选定 `Scheduled Messages / App Script 自动更新`。
- Reminder 检查结果：本机 Reminders 可读，但没有 `Personal AI` 清单，本轮没有可关联或可标记完成的 Reminder item。

## 外部参照

- Google Apps Script deployment 更新是把现有 Web App deployment 指向新的不可变版本，适合保持 URL 不变，但需要明确当前 deployment 和版本号。
- Google Apps Script 项目版本有 200 个历史版本上限，升级前应暴露 Project History 额度和清理路径。
- 自动更新 / 长耗时运维动作的 UX 重点是让用户在等待期间看到系统状态、未确认副作用和恢复路径，而不是只在完成后给结果。

## 发现的问题

- 当前升级前 banner 和最终 `App Script 升级结果回执`已经比较完整。
- 用户点击并确认 `升级调度系统` 后，页面只靠按钮文本 `升级中...` 表示在途；等待 Google 授权、Sheet schema、App Script deployment、Jira rule 检查时，用户看不到“哪些事尚未确认”。
- 这会让用户误以为 Web App URL 已经生效、Config 已标记最新、Jira rule 已更新，或失败回退已经完成。

## 实施计划

1. 在 `ScheduledMessagesManager.tsx` 增加 `buildAppScriptUpgradePendingNotice()`。
2. 用户确认升级后立即设置 `App Script 升级请求回执`，列出三段检查和未确认边界。
3. 保持最终成功 / warning / error 回执覆盖 pending 回执；不改 `AppScriptUpdater`、Sheet schema、Jira rule 或真实升级顺序。
4. 更新 `scheduled_messages_manager.md` 的 App Script 自动更新说明。
5. 扩展 `verify-appscript-auto-update.ts` 和 `verify-appscript-auto-update-e2e.mjs`，验证 pending 回执和最终回执。

## 验证计划

- `npm run verify:appscript-auto-update`
- `npm start -- --progress` 首次成功编译后停止
- `npm run verify:appscript-auto-update:e2e`
- `npm run verify:i18n`
- scoped `git diff --check`
