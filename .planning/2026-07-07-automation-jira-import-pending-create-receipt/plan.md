# Jira Automation Import 创建请求待确认回执计划

## 背景

- `docs/progressing/to-verify.md` 当前无待校验事项。
- EventKit 确认本机 `Personal AI` Reminders 清单存在且无未完成项。
- 本轮过滤最近两天已有计划的功能后，从剩余候选里选择 `Jira Automation Import`。
- 真实用户视角：我在导入高风险 Jira Automation JSON 时，点击 `Import disabled copy` 后会立即失去预览弹窗，只剩一个短暂 pending toast；如果 Jira API 响应慢，我很难判断请求是否仍在等待、能否取消、以及当前是否已经启用/运行了规则。

## 改进计划

1. 让 `Create request pending` 回执保持到 Jira API 返回成功或失败，而不是 5 秒后消失。
2. 在 pending 回执里明确：请求已经发出，Jira 尚未确认成功；关闭或刷新页面不会撤销一个已经发送的 create request；没有自动启用、运行、激活 schedule 或恢复 secret。
3. 成功或失败回执出现前先清理 pending 回执，避免旧等待状态和最终结果并列。
4. 更新 `tools/verify-jira-automation-import-e2e.mjs`，用延迟 POST 证明 pending 回执在等待期间仍存在，并校验新增边界文案。
5. 更新 `docs/features/jira_automation_import.md`，把持久 pending create receipt 纳入当前行为。
6. 验证：`npm run verify:jira-automation-import`、`npm start` 首次成功编译后停止、`npm run verify:jira-automation-import:e2e`、scoped `git diff --check`。
