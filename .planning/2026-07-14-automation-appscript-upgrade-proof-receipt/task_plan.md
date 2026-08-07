# App Script 自动更新证明回执

## 目标功能

- 随机候选: `App Script 自动更新`
- 主文档: `docs/features/scheduled_messages_manager.md`
- 代码入口: `src/scheduled-messages/ScheduledMessagesManager.tsx`
- 验证入口: `npm run verify:appscript-auto-update`、`npm run verify:appscript-auto-update:e2e`

## 当前状态

- `docs/progressing/to-verify.md` 为空。
- AppleScript 未列出 `Personal AI` Reminders；EventKit fallback 找到该列表，4 个历史 item，0 个 incomplete item。本轮没有相关 Reminder 反馈可纳入或完成。
- 代码已有后端防护：静默检查不弹授权、不写 Config，手动检查走交互授权；升级前确认线上版本、deployment URL、项目归属和 Project History 容量；升级后必须由 Web App `getVersion` 返回目标版本才同步 Sheet / Storage，失败会保留恢复入口。

## 外部参考

- Google Apps Script deployments 文档：更新现有 deployment 指向新版本可以保持 URL / deployment ID 不变。
- Google Apps Script versions 文档：版本是不可变快照，Project History 可查看、比较、恢复和删除未使用版本。
- Microsoft Power Automate flow troubleshooting：排障从 run history 和失败 step 进入，用户需要看到失败点和修复建议。
- IFTTT Activity feed：自动化产品把 ran / failed / skipped、错误和连接状态作为一线排障入口。
- Trigger-action debugging 研究：终端用户排查自动化时需要可见的触发、动作、失败和恢复路径。

## 改进计划

1. 在可升级横幅里加入点击前可见的 `升级证明回执`，明确升级成功的唯一证明是 `getVersion` 返回目标版本。
2. 在 Project History 已满状态下，同一回执说明主操作只是打开 Project History，清理后要重新检查，当前不会写 Sheet / Script / Jira Rule。
3. 保持 `updateAppScript()`、deployment 更新、rollback、Config 同步行为不变，只改 UI 证明口径。
4. 更新静态 verifier 和 Playwright E2E，防止该回执退化成文档或 hover-only copy。
5. 同步更新功能文档和 `docs/index.md`。

## 验证清单

- `npm run verify:appscript-auto-update`
- `npm start -- --progress`，等 first successful compile 后停止
- `npm run verify:appscript-auto-update:e2e`
- scoped `git diff --check`
