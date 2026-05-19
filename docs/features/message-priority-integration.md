# 定时消息匹配、补偿与队列可视化

## 功能概述

定时消息系统使用 Google Sheets 作为配置表，使用 Apps Script 与 Jira Automation 执行 Bot、AI Report 和托管的 Jira Automation 消息。当前实现不依赖 `Priority` 字段；同一时间命中的多条消息按 Messages 表格行顺序执行第一条，因此用户可以通过调整行顺序控制优先级。

> 文件名保留 `message-priority-integration.md` 是历史原因；当前功能真实边界是定时消息的执行匹配、补偿、幂等和队列可见性。

AsMe 消息由 Apps Script 的分钟触发器直接处理。Bot、AI Report，以及带 `AI_Endpoint` 的 JiraAutomation 消息由 Jira Automation 每分钟调用 Apps Script 的 `getMessageCurrentTimeWithReleaseInfo(postData)` 处理。

## 当前执行规则

Bot/AI/JiraAutomation 执行入口会按以下顺序查找消息：

1. `CURRENT_MINUTE`：执行当前分钟命中的显式时间消息。指定 `Schedule_Time` 时允许准点或最多迟到 1 分钟的触发器抖动容差，但不会提前发送；未指定时间的 Bot/AI/JiraAutomation 不走该模式，避免在 9:00 抢占显式时间消息。
2. `PAST_30_MINUTES`：补偿过去 30 分钟内错过、且尚未标记成功/失败的定时消息。
3. `NO_TIME_SPECIFIED`：8:00 后执行未指定 `Schedule_Time` 的 Bot/AI/带 `AI_Endpoint` 的 JiraAutomation 消息。

补偿窗口支持跨午夜场景：例如 23:50 的 Bot/AI 消息如果在 00:05 才恢复轮询，仍会按前一日的执行日期匹配，并继续使用 `Last_Exec` / `Exec_Log` 去重，避免已经成功的消息被重复补偿。

查找前会先判断日期是否匹配：

- OneTime：`Schedule_Date` 等于当天。
- Periodic：按 `Repeat_Every`、`Repeat_Unit`、`Repeat_Days`、`End_Date` 等字段计算。
- Timeline：通过 Timeline Sync Rule 写入 Script Properties 的里程碑缓存计算目标日期。

AsMe 消息仍走本地 `executeScheduledMessages()`：先判断日期，再在指定时间或未指定时间的 9:00 执行。启用 RingCentral sender 接管 AsMe 时，也保留未指定时间 9:00 的默认语义，不进入 Bot/AI 的 8:00 后兜底队列。

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
- 列表级队列提示会忽略已经超过 30 分钟补偿窗口的显式时间槽，避免旧的未执行行长期显示成“正在排队”。
- 当创建/编辑的显式时间已经排不进补偿窗口时，表单会给出第一个避开当前拥挤时间槽的建议时间，并提供一键采用入口，减少用户手动试错。
- 显式 08:00 时间槽与未填写时间的“08:00 后队列”按不同执行通道展示，避免低打断的留空队列误算为显式时间补偿窗口里的阻塞项。
- 未填写时间的 Bot/AI/JiraAutomation 只会在执行日期当天 8:00 后兜底排队；如果执行日期已经过去，创建/编辑表单会阻止保存，列表行级策略和队列总览也不会把历史日期的留空消息显示成仍可执行。
- 未填写时间的 8:00 后队列也会按执行日期的当天剩余分钟做容量检查；如果排队位置可能延后到次日，列表和创建/编辑表单会提示“可能排到执行日期结束后”，并阻止继续保存为当天留空时间。
- 重复消息的队列压力、列表提示和创建/编辑预检都使用同一个本地时间基准计算下一次执行，避免页面刷新、测试时钟和后台轮询看到不同的队列日期。
- “需要改期”的顶部提示会列出异常消息，并提供直接定位和编辑入口，让用户可以从风险提示进入修正路径。
- Bot/AI/JiraAutomation 队列横幅中的每个拥挤时间槽会显示受影响示例、最晚受影响消息和建议改期时间，并提供“定位最晚”和“编辑”入口，优先处理排在最后、最容易超过补偿窗口的消息，避免用户在长列表里手动查找。
- 当拥挤时间槽已经算出建议改期时间时，队列横幅可直接把最晚受影响消息改到建议时间；保存后会刷新列表并定位该消息，减少从告警进入编辑弹窗再手动采用时间的步骤。
- 队列横幅默认展示最需要处理的前 3 个拥挤时间槽；当还有更多槽位时，会显示隐藏数量并允许展开全部，避免摘要说有风险但用户找不到后续槽位。
- 队列槽位文案会明确“建议处理”的具体消息和它在该槽位中的位置，避免用户只看到示例消息和“改到建议”按钮，却不确定实际会改哪一条。
- 队列槽位在横幅中以结构化卡片展示执行槽、延后分钟数、受影响条数、建议处理对象、建议改期时间和示例消息；窄窗口下也会换行保留关键信息，而不是把长句截断成省略号。
- 顶部“需要改期”健康检查按执行器的分钟粒度判断补偿窗口，避免在最后一个仍可补偿的分钟内提前显示“已错过”。

创建表单会按推送方式动态显示默认时间：Bot/AI/JiraAutomation 留空提示为 8:00 后排队，AsMe 留空提示为 9:00 左右推送；快捷时间按钮也使用对应默认时间。这样用户不用打开 Sheet 或阅读实现细节，也能判断消息大概何时会被派发，以及错过时间后是否会补偿。

## 外部对照结论

- Microsoft Teams 的定时发送强调用户选择发送时间，并可编辑、改期和删除待发送消息；当前 Personal AI 已有编辑/删除，但列表需要清晰暴露执行策略，且不能早于用户选择的时间发送。
- Slack 的 scheduled message API 会返回可管理的 `scheduled_message_id`，并通过 list/delete API 管理待发消息；Personal AI 目前用 Sheet 行序作为轻量队列，因此需要在 UI 暴露“第几个执行”和“哪些行不再阻塞”来补足可观察性，并继续补上更顺手的改期操作。
- Zulip 的 scheduled messages API 会把未发送的定时消息按时间列出，并要求客户端对发送失败的待发消息显示失败状态；这说明 Personal AI 的队列提示也需要避免把已经错过执行日期、实际不会再被执行的项呈现为“正在排队”。
- 2026-05-13 复核 Slack、Teams、Zulip 文档后，行业共同点仍是把待发送消息当作可管理对象：能查看、编辑/改期、删除，且 Slack 对同一频道短窗口内的排队量有限制。因此 Personal AI 的队列总览不应停留在告警文本，风险槽位需要直接通向最值得调整的消息，并提前给出可采用的改期时间。
- 2026-05-14 复核 Slack、Teams、Zulip 以及通知发送时机研究后，后续建设重点仍应是把“风险队列”变成可直接处理的待发对象列表：先处理最晚受影响项，给出低冲突时间，并尽量在列表内完成改期。
- 2026-05-16 复核 Microsoft Teams、Slack、Zulip 和 TIM 论文后，重点仍是可管理、可改期、可解释的待发对象；队列横幅需要把“哪条最该改、为什么、改到哪里”拆成可扫描信息块，避免用户在长告警句中寻找操作目标。
- 2026-05-17 复核 Microsoft Teams、Slack、Zulip 和 TIM 论文后，后续优化仍应围绕“可管理的待发对象”和整体发送时机控制；健康检查、队列提示和建议改期必须使用一致的时间窗口，减少误报造成的无效改期。
- 2026-05-17 复核 Slack 同频道短窗口限制、Apps Script 配额和 TIM 整体发送时机控制后，8:00 后留空队列也需要展示当天容量风险；否则晚间创建大量留空执行器消息时，UI 会误导用户以为仍能当天全部派发。
- Google Apps Script 有运行时间、触发器、URL Fetch 等配额限制，补偿窗口和去重是必要的可靠性保护。
- Google Pub/Sub 的 exactly-once 文档也强调用消息处理进度避免重复工作；本功能以 `ID`、`Last_Exec`、`Exec_Log` 做轻量幂等。
- 通知体验研究和 Apple HIG 都强调不要用高打断级别承载低价值信息；本功能的后续优化应继续把“立即推送”和“摘要/低打断”分开设计。
- 智能通知系统研究建议根据用户情境、紧急度和接收偏好决定提醒方式；定时消息后续可以把“立即发”“排队发”“汇总发”做成显式策略，而不是只靠时间字段表达。
- TIM 等通知发送时机研究强调整体 send-time control：当前表单已在用户选择拥挤时段时主动推荐低冲突时间；后续可以继续把推荐从单人队列扩展为跨渠道、跨时段的整体发送规划。

参考：

- [Microsoft Teams scheduled chat messages](https://support.microsoft.com/en-us/office/schedule-chat-messages-in-microsoft-teams-2fc5ea77-7bb4-4511-8f59-e62bac1c0f6a)
- [Slack `chat.scheduleMessage`](https://docs.slack.dev/reference/methods/chat.scheduleMessage/)
- [Slack `chat.deleteScheduledMessage`](https://api.slack.com/methods/chat.deleteScheduledMessage)
- [Zulip scheduled messages API](https://zulip.com/api/get-scheduled-messages)
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
- 2026-05-08：创建/编辑表单在队列阻塞时会推荐第一个低冲突时间并支持一键采用；列表级队列提示不再把已超过补偿窗口的显式时间槽显示为正在排队。
- 2026-05-11：修正未填写时间消息的执行通道：Bot/AI/JiraAutomation 只走 8:00 后兜底队列，AsMe 保持 9:00 默认；队列压力展示拆分显式时间槽和 8:00 后队列。
- 2026-05-11：修复历史日期的未填写时间执行器消息仍显示为排队的问题；创建/编辑表单会要求改成今天或未来日期，列表行级策略会提示日期已过，队列总览会跳过这类实际不可执行的历史槽。
- 2026-05-11：重复消息队列压力统一使用调用方传入的本地时间；顶部“需要改期”提示增加定位和编辑入口。
- 2026-05-12：队列总览的拥挤时间槽增加最晚受影响消息的定位/编辑入口；队列摘要计算层输出对应消息 ID、标题和排队位置，便于 UI 直接引导用户改期。
- 2026-05-13：队列总览对超过补偿窗口的显式时间槽直接显示建议改期时间，并把摘要文案统一为“执行器消息/执行器队列”，覆盖 Bot、AI 和带 `AI_Endpoint` 的 JiraAutomation。
- 2026-05-14：队列风险横幅增加“改到建议”入口，可直接将最晚受影响消息保存到系统推荐的低冲突时间，并在刷新后定位该消息。
- 2026-05-15：队列横幅增加“显示全部/收起”入口，并在每个槽位明确建议处理的消息与排队位置；默认保持紧凑，同时让超过 3 个的拥挤时间槽也可直接定位、编辑或采用建议时间。
- 2026-05-16：队列横幅槽位改为结构化卡片，分别展示执行槽、延后、条数、建议处理对象、建议改期和示例消息，减少窄窗口下关键信息被截断的问题。
- 2026-05-17：顶部健康检查的补偿窗口判断对齐执行器分钟粒度，避免最后一分钟内提前提示消息已错过执行窗口。
- 2026-05-17：未填写时间的 8:00 后执行器队列增加当天剩余容量检查；当排队位置可能跨到次日时，队列横幅、行级提示和保存预检会显示执行窗口风险。
