# 主动询问筛选范围回执巡检发现

- `docs/progressing/to-verify.md` 当前为空，无需接续未完成体验验证。
- 自动化记忆显示今天已覆盖 Agent Workflow、Today Pilot、Project Dashboard、Skill Foundry、Auto Reply 等，随机样本中选取了未在最近精确覆盖的 `主动询问会话管理`。
- AppleScript 未列出 `Personal AI` Reminders 列表；EventKit 读到该列表共 4 条，均为已完成历史反馈，未发现与 Outreach / 主动询问 / 会话筛选相关的开放项。
- 外部资料方向：Copilot Studio RFI、OpenAI Agents SDK HITL、LangGraph interrupts 和 proactive conversational agents 研究都强调暂停、复核、恢复与预期管理。对应到本功能，筛选/刷新应先说明只是读取队列状态，不能让用户误以为已经批准或发送。
- 代码现状：页面已有本页优先级、本轮处理对象、会话推进、列表操作、详情操作、发送前复核等回执，但筛选控件本身没有独立说明当前过滤口径、旧快照和隐藏依据。

