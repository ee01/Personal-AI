# Findings

## 代码现状

- `src/modals/components/RelationshipRadarPage.vue` 在 `generateMeetingBrief()` 前展示生成请求回执，并在成功后把 `meetingBriefRequestReceipt` 清空。
- 成功后 `meetingBrief` 保留在页面上，`复制简报` 按钮只受 `meetingBrief` 是否存在影响。
- `meetingTitle` 和 `meetingAttendeesText` 之后再被编辑时，没有和已生成简报的输入依据做对比。
- Assistant Draft 已有类似的 `assistantDraftGoalChangeReceipt` 和复制锁定逻辑，可作为本轮 UI pattern。

## 文档现状

- `docs/features/relationship_radar.md` 已描述 Meeting Brief 的身份待核对、来源回执、手动覆盖、大会议上限、生成请求回执、readiness 和 focus。
- 文档还没有明确说明“生成后输入变化时，旧简报不能继续复制为当前输入结果”。

## Reminder

- EventKit: `Personal AI` list exists, 4 total, 0 open.
- 无相关未完成 Reminder。

## 外部扫描摘录

- Microsoft Copilot for Sales meeting prep card 依赖历史会议/邮件、其他卖家 insights、CRM context、sales stage 和 meeting intent，并将 risks / open questions 作为会前重点。
- Salesforce Einstein Relationship Insights 把人物/公司关系证据展示在销售工作流里，并把 CRM update 保持为单独动作。
- Source attribution / factuality 研究强调解释和来源展示用于校准用户对 LLM 文本的信任。
- Meeting recap 研究强调 highlights 与结构化 minutes 服务不同目标；Meeting Brief 同理需要把生成输入和使用目标固定住。
- AI-mediated communication 研究提醒 AI 生成的关系文本会改变信任和责任归因，因此不能让旧生成结果在输入变化后继续看起来可直接外发。
