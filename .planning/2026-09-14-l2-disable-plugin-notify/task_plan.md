# Task Plan: L2 / Google Sheet 禁用插件通知

## Goal
任务中心选 ☁️ `jira_sheet`（含 Timeline）时不能使用 Chrome 插件通知；UI 置灰并在保存时纠正为 Bot/AsMe。定时消息页本来就没有插件通道，只确认不新增入口。

## Current Phase
Phase 3

## Phases

### Phase 1: Requirements & Discovery
- [x] Confirm L2 cannot deliver Chrome plugin notifications
- [x] Confirm Scheduled Messages manager has no plugin tab
- **Status:** complete

### Phase 2: Task Center UI + save guard
- [x] Pure helper: `cloudLaneAllowsPluginNotify` / `resolveNotifyViaForLane`
- [x] Disable plugin button on ☁️; coerce plugin → bot/asme
- [x] Enable Bot on ☁️ when Jira executor rule exists (L2 Bot ≠ L1 Bot)
- [x] Save path never writes `notifyVia: plugin` for `jira_sheet`
- **Status:** complete

### Phase 3: Tests, docs, webpack
- [x] Unit tests for coerce helper + hydrate
- [x] UI check: L2 新建弹窗插件通道置灰；Timeline 保存走 Bot 且需接收人
- [x] Docs: plugin 仅 🏠
- [x] webpack.dev compile + `verify:task-center-ui`
- **Status:** complete

## Key Questions
- Q: Does L2 have any Chrome notification path? A: No. Jira/GAS cannot write `notification_records`.
- Q: Should mapper keep plugin→Bot fallback? A: Yes, last-resort for old ledger rows. UI must stop creating the combo.

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| UI check edit save disabled | 1 | Stub ☁️ 任务补上 Bot 接收人；无目标时 Bot 不能保存是正确行为 |
