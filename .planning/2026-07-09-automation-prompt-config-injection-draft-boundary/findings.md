# Prompt Config 用户上下文注入发现

## 本地状态

- `docs/progressing/to-verify.md`：暂无待校验事项。
- Reminders：EventKit 可读取本机 `Personal AI` 列表，共 4 条，未完成 0 条；无相关待办可纳入或完成。
- 最近自动化已经覆盖 Agent Workflow、User Profile、Meeting History、Evidence Watch、Google Slides、Message Reaction、Scheduled Messages、Agent Thinking、Doubao、Ask、Memory Lens 等，故本轮选择 Prompt Config 的 `用户上下文注入`。

## 业内参考

- ChatGPT Custom Instructions / Memory：长期偏好可关闭、可修改或删除，memory 带来额外隐私与安全考量。
- Claude Code Memory：区分用户写入的持久指令和自动记忆，并提示这些是上下文而非强制配置。
- Gemini personalization：个性化来源包括过去聊天、连接应用内容和用户偏好，强调可配置来源。
- Governable personalization 研究：用户画像应从隐藏平台画像走向可检查、可修订、可携带、有责任边界的表示。
- Memory poisoning / prompt persistence 研究：长期记忆与持久上下文会成为攻击面，必须把保留、启用和真实使用状态讲清楚。

## 代码发现

- `prompt-config.tsx` 已有已生效基线、草稿预览、保存影响和用户上下文来源待保存回执。
- 缺口：如果用户只切换 `参与分析注入` 总开关，用户上下文页签会按草稿进入暂停态，但顶部没有同类待保存回执。
- 缺口：暂停态页签文案容易说成“当前分析不会读取”，而未保存时真实分析仍读取已生效基线。

## 选择的实现

- 保留现有注入/保存语义，只增强 presentation receipt。
- 在总开关或用户上下文来源开关相对基线变化时显示统一待保存回执。
- 给用户上下文 section receipt 增加草稿注入状态选项，使未保存草稿明确只影响当前页面预览。
