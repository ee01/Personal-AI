# Findings

- `docs/progressing/to-verify.md` 当前为空，本轮可选择新随机功能。
- 自动化记忆最近已经覆盖 Notification Center、备份恢复、Jira Import、Today、Source Memory、Native Join、ASR、Reflection、Watch、Quick Ask 等，避开这些目标后选中 `Task Scheduler 状态 API`。
- AppleScript 未列出 `Personal AI`，EventKit fallback 列出了该列表，4 条全部已完成；无 Task Scheduler 相关 open item 可纳入或标记完成。
- Task Scheduler 文档和源码已经覆盖状态刷新、排程修复、pending action、折叠需处理预览、操作范围等；本轮只补按钮级可发现性。
- 外部参考支持把状态、原因、动作和动作影响放在同一操作上下文内，而不是让用户在按钮和旁边说明之间来回推断。
