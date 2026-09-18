# Findings & Decisions

## Requirements
- ☁️ `jira_sheet` / Timeline / Google Sheet 管理不能使用「插件通知」
- 任务中心 UI 在 L2 时 disable 插件通知
- 若当前已选 plugin，切到 ☁️ 时落到 Bot（优先）或 AsMe
- 定时消息页：确认无插件入口即可，不要硬加一个再 disable

## Research Findings
- Sheet `Push_Method` 只有 AsMe / Bot / AI / JiraAutomation / Outreach / AgentTask；`Agent_Notify_Via` 只有 `bot` | `asme`
- `pushMethodFromLedgerTask`：`via === 'asme'` → AsMe，否则 → Bot。`plugin` 会被静默改成 Bot，保存后可能发 Glip
- 定时消息新建 tabs：AsMe / Bot / AI / Outreach / AgentTask，没有插件通知
- 任务中心插件按钮（`TaskCenterPage.vue`）原先不看 lane，截图即 plugin + jira_sheet 同时选中
- Chrome 插件通知依赖扩展轮询 `notification_records`，Jira Automation + GAS 表达不了
- L1 Bot 与 L2 Jira 内嵌 Bot 是两套；`cloudBotConfigured && !botConfigured` 时抽屉已说明「不等于 🏠 Glip 私发」。切 ☁️ 后仍应用 Jira 规则里的 Bot

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| 纯函数纠正 notifyVia | 单测覆盖，hydrate / watch / save 共用 |
| ☁️ 上 Bot 可用条件含 `cloudBotConfigured` | 否则 L2-only 用户插件置灰后 Bot 也被 L1 挡住 |
| mapper 仍把 plugin 落到 Bot | 旧账本行还能写出可投递 Sheet；新产品路径由 UI 拦住 |
| 不改 `.planning/.active_plan` | 当前 active plan 是 timeline-repeat，本任务单独目录 |

## Visual/Browser Findings
- 用户截图：通知通道「插件通知」选中，调度器「jira_sheet」选中，黄条说明 Jira 每分钟领取
- 日期 2026/09/18 16:12，对应此前 API 建的 ☁️ 冒烟任务（故意走 plugin 以免发 Glip）——该组合本身无效，镜像时会被改成 Bot

## Resources
- `src/modals/components/TaskCenterPage.vue` 通知通道 / 调度器
- `src/modals/taskCenterSchedule.ts`
- `src/scheduled-messages/taskCenterSheetMirror.ts`
- `docs/features/task_center.md` 通知通道表
- `docs/features/scheduled_messages_manager.md` Push_Method enum
