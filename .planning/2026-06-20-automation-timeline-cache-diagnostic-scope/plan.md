# Timeline 缓存诊断范围回执计划

## 目标

本轮随机目标是 `Timeline 缓存与 Jira Milestone`。用户在新增 / 编辑 Timeline 消息或项目变量消息时，需要先看懂当前面板到底是在读 App Script 缓存、跑样例 dry-run，还是已经证明 Jira Sync Rule 真实同步成功。

## 外部参考

- Atlassian Automation audit / debug：复杂 automation 需要可追踪的 audit log 和手动测试路径。
- Google Apps Script triggers / quotas：time-driven trigger 和 Properties 都有运行身份、触发抖动和大小限制，UI 不能承诺绝对准点或无限缓存。
- Power Automate run history / resubmit：成熟自动化产品会把运行历史、测试范围和恢复动作分开展示。

## 改进计划

1. 保持现有 GET / Groovy Map / dry-run / status response 数据契约不变。
2. 新增共享 helper，生成 Timeline 缓存状态面板的首行诊断范围文案。
3. 在状态面板顶部展示该回执，明确读取缓存、样例 dry-run、真实 Jira Sync Rule、保存 / 发送边界和执行后果。
4. 更新 helper 测试、静态 verifier、功能文档和功能索引。
5. 运行 targeted tests、`npm start` 首次成功编译、Timeline cache verifier、相关 E2E 和 scoped diff checks。

## Reminder 状态

本机 Reminders 可访问，但没有 `Personal AI` 列表；本轮没有 Reminder item 可标记完成。
