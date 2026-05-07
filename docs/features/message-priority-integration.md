# 定时消息匹配、补偿与队列可视化

## 功能概述

定时消息系统使用 Google Sheets 作为配置表，使用 Apps Script 与 Jira Automation 执行 Bot、AI Report 和托管的 Jira Automation 消息。当前实现不依赖 `Priority` 字段；同一时间命中的多条消息按 Messages 表格行顺序执行第一条，因此用户可以通过调整行顺序控制优先级。

> 文件名保留 `message-priority-integration.md` 是历史原因；当前功能真实边界是定时消息的执行匹配、补偿、幂等和队列可见性。

AsMe 消息由 Apps Script 的分钟触发器直接处理。Bot、AI Report，以及带 `AI_Endpoint` 的 JiraAutomation 消息由 Jira Automation 每分钟调用 Apps Script 的 `getMessageCurrentTimeWithReleaseInfo(postData)` 处理。

## 当前执行规则

Bot/AI/JiraAutomation 执行入口会按以下顺序查找消息：

1. `CURRENT_MINUTE`：执行当前分钟命中的消息。指定 `Schedule_Time` 时允许准点或最多迟到 1 分钟的触发器抖动容差，但不会提前发送；未指定时间时，当前分钟规则默认 9:00。
2. `PAST_30_MINUTES`：补偿过去 30 分钟内错过、且尚未标记成功/失败的定时消息。
3. `NO_TIME_SPECIFIED`：8:00 后执行未指定 `Schedule_Time` 的消息。

补偿窗口支持跨午夜场景：例如 23:50 的 Bot/AI 消息如果在 00:05 才恢复轮询，仍会按前一日的执行日期匹配，并继续使用 `Last_Exec` / `Exec_Log` 去重，避免已经成功的消息被重复补偿。

查找前会先判断日期是否匹配：

- OneTime：`Schedule_Date` 等于当天。
- Periodic：按 `Repeat_Every`、`Repeat_Unit`、`Repeat_Days`、`End_Date` 等字段计算。
- Timeline：通过 Timeline Sync Rule 写入 Script Properties 的里程碑缓存计算目标日期。

AsMe 消息仍走本地 `executeScheduledMessages()`：先判断日期，再在指定时间或未指定时间的 9:00 执行。

## 去重与执行记录

系统通过 `Last_Exec` 和 `Exec_Log` 做当天去重：

- 当天已成功的消息不会再次进入队列。
- 当天已失败的消息也会跳过，避免失败项阻塞后续消息。
- 缺失 `ID` 的消息会自动生成并写回 Sheet。
- AI/JiraAutomation API 消息会在返回给 Jira 后立即标记执行，避免外部执行链路超时导致重复触发。

## AI/JiraAutomation 请求体

`AI_Body` 支持以下变量：

- `{Topic}`
- `{Content}`
- `{TeamID}`
- Timeline 变量，如 `{currentRelease}`、`{currentPhase}`、`{nextPhaseStartDate}` 等。

从 App Script `2.6.4` 起，变量替换会使用 JSON 字符串转义，保证内容里包含双引号、反斜杠或换行时，替换后的 JSON body 仍可被外部 API 正常解析。

## 用户体验

定时消息列表会显示执行策略提示：

- 有指定时间的 Bot/AI/JiraAutomation：显示 30 分钟补偿窗口。
- 未指定时间的 Bot/AI/JiraAutomation：显示 8:00 后执行。
- 未指定时间的 AsMe：显示 9:00 执行。
- 多条 Bot/AI/带 `AI_Endpoint` 的 JiraAutomation 落在同一执行槽位时，列表会显示按 Sheet 行序计算的队列位置、预计延后分钟数；如果指定时间消息的队列位置加上已消耗的补偿窗口后无法在 30 分钟内执行，创建/编辑表单会阻止保存，并建议改为未来时间或清空时间进入 8:00 后队列。
- 队列位置会排除同一执行日期已经成功或失败的行，因为 Apps Script 实际执行时也会跳过这些行，避免失败或已完成项继续制造虚假的排队压力。

创建表单会按推送方式动态显示默认时间：Bot/AI/JiraAutomation 留空提示为 8:00 后排队，AsMe 留空提示为 9:00 左右推送；快捷时间按钮也使用对应默认时间。这样用户不用打开 Sheet 或阅读实现细节，也能判断消息大概何时会被派发，以及错过时间后是否会补偿。

## 外部对照结论

- Microsoft Teams 的定时发送强调用户选择发送时间，并可编辑、改期和删除待发送消息；当前 Personal AI 已有编辑/删除，但列表需要清晰暴露执行策略，且不能早于用户选择的时间发送。
- Slack 的 scheduled message API 会返回可管理的 `scheduled_message_id`，并通过 list/delete API 管理待发消息；Personal AI 目前用 Sheet 行序作为轻量队列，因此需要在 UI 暴露“第几个执行”和“哪些行不再阻塞”来补足可观察性，并继续补上更顺手的改期操作。
- Google Apps Script 有运行时间、触发器、URL Fetch 等配额限制，补偿窗口和去重是必要的可靠性保护。
- Google Pub/Sub 的 exactly-once 文档也强调用消息处理进度避免重复工作；本功能以 `ID`、`Last_Exec`、`Exec_Log` 做轻量幂等。
- 通知体验研究和 Apple HIG 都强调不要用高打断级别承载低价值信息；本功能的后续优化应继续把“立即推送”和“摘要/低打断”分开设计。
- 智能通知系统研究建议根据用户情境、紧急度和接收偏好决定提醒方式；定时消息后续可以把“立即发”“排队发”“汇总发”做成显式策略，而不是只靠时间字段表达。
- TIM 等通知发送时机研究强调整体 send-time control：后续可以在用户选择已拥挤时段时主动推荐低冲突时间，而不是只展示队列风险。

参考：

- [Microsoft Teams scheduled chat messages](https://support.microsoft.com/en-us/office/schedule-chat-messages-in-microsoft-teams-2fc5ea77-7bb4-4511-8f59-e62bac1c0f6a)
- [Slack `chat.scheduleMessage`](https://docs.slack.dev/reference/methods/chat.scheduleMessage/)
- [Slack `chat.deleteScheduledMessage`](https://api.slack.com/methods/chat.deleteScheduledMessage)
- [Google Apps Script quotas](https://developers.google.com/apps-script/guides/services/quotas)
- [Google Pub/Sub exactly-once delivery](https://docs.cloud.google.com/pubsub/docs/exactly-once-delivery)
- [Interruptive notifications in support of task management](https://www.sciencedirect.com/science/article/pii/S1071581915000245)
- [Intelligent Notification Systems: A Survey](https://arxiv.org/abs/1711.10171)
- [TIM: Temporal Interaction Model in Notification System](https://arxiv.org/abs/2406.07067)
- [Apple HIG: Managing notifications](https://developer.apple.com/design/human-interface-guidelines/managing-notifications)

## 最近更新

- 2026-05-01：修复 `AI_Body` 变量替换的 JSON 转义问题；列表补充执行策略提示；更新文档为当前实现。
- 2026-05-03：补偿窗口支持跨午夜；创建表单的留空时间提示改为按推送方式显示 8:00/9:00 默认策略。
- 2026-05-04：列表和创建表单增加同槽队列位置提示，提前暴露多条 Bot/AI/JiraAutomation 同时触发时的排队延后和补偿窗口风险。
- 2026-05-04：队列压力计算对齐 Apps Script 去重规则，排除同一执行日期已经成功或失败的行；文档标题改为当前真实功能边界。
- 2026-05-05：创建/编辑表单会阻止保存已经排到 30 分钟补偿窗外的显式时间消息；JiraAutomation 只有配置 `AI_Endpoint` 时才按 8:00 后执行器队列展示。
- 2026-05-05：队列风险提示会纳入当前已消耗的补偿窗口，避免用户在窗口剩余时间不足时仍保存一个实际赶不上的显式时间消息。
- 2026-05-06：显式时间消息不再因 1 分钟容差提前发送；容差仅覆盖准点或最多迟到 1 分钟的触发器抖动，并在列表/表单提示中明确“不提前发送”。
