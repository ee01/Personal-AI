# Jira Automation hidden secret re-entry plan

## 目标功能

- 随机命中：`docs/features/index.md` -> Jira Automation Import / `secret value 脱敏`
- 当前文档：`docs/features/jira_automation_import.md`
- Reminder：本机 Reminders 可访问，但没有 `Personal AI` 列表；本轮没有可合并或可完成的 Reminder item。

## 外部参考信号

- Atlassian Jira Automation import/export：导入规则会默认 disabled，版本不一致可能失败。
- Atlassian Jira Automation hidden values：Send web request 的 hidden values 在复制、导出/导入时会丢失，需要重新配置。
- Appfire Configuration Manager：automation secret keys 不迁移真实值，目标环境使用匹配 secret 或 dummy placeholder，并要求管理员后续复核。
- Trigger-action privacy/debugging research：自动化规则会跨服务传递敏感数据，用户常需要更明确的调试与复核提示。

## 问题判断

现有预览、review note 和 copy packet 已经避免展示 `secret=true` 的 raw `keyOrValue`。但导入构造层仍浅拷贝组件 payload，存在两个问题：

1. `secret=true` 容器里的 raw `keyOrValue` 可能进入 Jira create request。
2. content script 会 `console.log` 完整 converted rule，可能把非预览层的敏感 payload 留在浏览器控制台。

## 实施计划

1. 在 transform 层深拷贝 automation node 的 nested payload。
2. 对 `secret=true` 容器里的值承载字段写入 `PERSONAL_AI_REENTER_SECRET` 占位，不自动迁移真实隐藏值。
3. 保留安全 secret 名称/上下文标签，便于用户在目标 Jira 定位需要重录的位置。
4. 把 content script 的完整 payload console log 改为低敏摘要。
5. 更新功能文档，明确 disabled copy 不携带 raw hidden secret，需要导入后在目标 Jira 重新录入。
6. 更新 transform 单测和 Jira Automation Import E2E，证明预览、description、create payload、console 都不含 hidden raw value。
7. 跑 `npm run verify:jira-automation-import`、`npm start` 首次编译、`npm run verify:jira-automation-import:e2e`、scoped `git diff --check`。
