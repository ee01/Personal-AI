# Scheduled Messages 队列健康诊断线索

## 随机目标

- 小功能点：`队列健康提示`
- 所属能力：Scheduled Messages
- 主文档：`docs/features/scheduled_messages_manager.md`
- Reminder：本机 Reminders 可访问，但没有 `Personal AI` 列表；本轮没有可合并或可标记完成的 Reminder 条目。

## 外部参考

- Slack scheduled / sent 管理入口强调排程对象可编辑、删除和回到会话。
- Twilio Message Scheduling / Message resource 把 scheduled、canceled、failed、delivered 等状态分开暴露，失败不是“已发送”。
- Zapier Replay / troubleshooting 把失败历史、可 replay 动作和不可自动恢复的 on-hold 条件分开说明。
- Trigger-action program debugging 研究指出，非程序员调试自动化时需要先看到出错触发/动作位置、失败原因和下一步，而不是只看到一个总数。

## 发现

当前队列健康告警已有一键改期、失败回执和边界说明，但首屏 triage 主要展示优先处理对象、可恢复数量和写回边界。作为用户，看到多条健康告警时仍要逐条读完整句，才能判断问题是 Jira Automation 补偿窗口超时、无时间默认队列日期过期、时间格式异常，还是 AsMe / Apps Script 默认时间已过。

## 实施计划

1. 在 `scheduleHealth` 增加健康问题诊断标签和分布摘要。
2. 在 Scheduled Messages 管理页顶部 triage 和每条健康告警卡片展示诊断线索。
3. 不改变执行器领取、补偿窗口、Sheet schema、Google Sheets 写入字段、Logs、Jira Automation 或实际发送路径。
4. 更新单测、E2E 和 `docs/features/scheduled_messages_manager.md`。
5. 验证：`scheduleHealth` targeted test、E2E script syntax、`npm start` 首次 compile、health recovery E2E、scoped `git diff --check`。
