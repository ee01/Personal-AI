# Scheduled Messages 列表筛选身份口径改进

## 目标

随机命中 `docs/features/index.md` 里的 `定时消息列表筛选`。本轮改进聚焦一个窄问题：`过滤掉仅发我的` 依赖本机 Google 账号推导出的 `esone.qiu`，但旧表、人工编辑或导入行可能保存为 `Esone Qiu` 或邮箱形式，用户打开筛选后会看到“仅发我的”没有隐藏对应行，误以为筛选或数据刷新失效。

## 外部参考

- Slack scheduled messages: 已排程消息是可管理对象，用户需要能看到、取消或调整，而不是把排程状态藏在发送动作里。
- Zapier Zap History / filter 状态: 自动化产品会把 filtered、held、scheduled、errored 等状态分开，帮助用户知道为什么某条记录没有继续执行。
- Helping Users Debug Trigger-Action Programs: 终端用户调试自动化时最需要 why / why-not 解释，尤其是条件过滤没有命中时。

## 改进计划

1. 在 `scheduledMessagesFilters.ts` 增加收件人身份归一：兼容 dotted username、显示名、邮箱本地名、`+` / 逗号多人旧格式。
2. 更新筛选回执，让用户看到“仅发我的”按哪个账号识别，并说明多人或群组不会被隐藏。
3. 用单元测试覆盖显示名、邮箱和多人旧格式；把 E2E fixture 改成显示名，证明真实页面仍能隐藏仅发我的行。
4. 更新 `docs/features/scheduled_messages_manager.md`，记录列表筛选当前行为。
5. 按 `AGENT.md` 跑 targeted test、`npm start` 首次编译、Scheduled Messages E2E 和 scoped `git diff --check`。

## Reminder 状态

本机 Reminders 可读，但没有 `Personal AI` 列表；本轮没有 Reminder item 可纳入或标记完成。
