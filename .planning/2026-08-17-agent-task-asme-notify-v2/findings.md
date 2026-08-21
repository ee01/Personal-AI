# Findings

## Requirements
- 帮我做弹窗「通知发送身份」AsMe 显示 `v2 · 暂未开放`
- 用户要求：查 plan，把未完成 items 一起实现

## Research Findings
- 权威来源是已删除的 `docs/progressing/scheduled-create-dialog-unified-tabs-plan.md`（2026-08-11 实现 v1 后删除）
- 残留契约：
  - `docs/features/scheduled_messages_manager.md`：v1 固定 Bot；AsMe 为 v2 预留
  - `docs/features/agent_executor_runtime.md`：`notifyVia` 预留，v1 恒为 `bot`
  - `agentTasks.ts` 已接受 `notifyVia: 'asme'` 但投递仍走 BotSender
  - App Script 硬编码 `notifyVia: 'bot'`
- `docs/progressing/scheduled-messages-channel-activation-plan.md` 是另一份 AsMe v2（发消息通道直发），不是这个入口
- 该 unified-tabs plan 的 v1 项已完成；未完成只剩结果通知 AsMe 身份

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| 新列 `Agent_Notify_Via`（bot/asme） | 与 Success_Receipt 一样落 Sheet，App Script 才能透传 |
| AsMe 投递用 `RingCentralClient` | 与 Outreach 同一套用户 JWT；不碰 Sheet AsMe token |
| AsMe 失败不回退 Bot | 避免身份静默错位；通知失败不改 run status |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| 原 plan 文件已删 | 从 feature docs + 代码注释 + 实现会话 transcript 还原 v2 范围 |

## Resources
- `src/scheduled-messages/ScheduledMessagesManager.tsx` 通知发送身份
- `memory-service/src/routes/agentTasks.ts`
- `memory-service/src/integrations/RingCentralClient.ts`
