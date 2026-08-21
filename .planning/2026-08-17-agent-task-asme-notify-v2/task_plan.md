# Task Plan: AgentTask 结果通知 AsMe（v2）

## Goal
帮我做「结果通知发送身份」从 v1 固定 Bot 升级为可选 AsMe：成功结果以用户本人身份经 memory-service RingCentral runtime 发出；回执仍 Bot 私发。

## Current Phase
Phase 5

## Phases

### Phase 1: Requirements & Discovery
- [x] 定位 UI「v2 · 暂未开放」对应文档
- [x] 核对原 plan 未完成项
- **Status:** complete

### Phase 2: Planning & Structure
- [x] 决定 AsMe 走 Options/memory-service RC JWT（非 Sheet AsMe token）
- [x] 成功结果可 AsMe；成功/失败回执恒 Bot
- **Status:** complete

### Phase 3: Implementation
- [x] Schema + types：`Agent_Notify_Via`
- [x] App Script 透传 `notifyVia`
- [x] memory-service AsMe 投递
- [x] 帮我做 UI 解锁 AsMe
- [x] 文档
- **Status:** complete

### Phase 4: Testing & Verification
- [x] agentTasks 单测 20/20
- [x] Apps Script payload 单测 69/69
- [x] webpack.dev 编译成功
- **Status:** complete

### Phase 5: Delivery
- [x] 中文说明来源 plan 与改动
- **Status:** complete

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| 原 progressing plan 已删除，以 feature docs 的 v2 预留为准 | 2026-08-11 实现 v1 后按用户要求删除 progressing 文件 |
| AsMe 使用 Sheet RingCentral sender token，与顶部 AsMe 发消息 tab 相同 | 用户确认应共用 AsMe 类型消息的 token，不走 Options/Outreach JWT |
| 仅 `kind=result` 走 AsMe | 回执始终 Bot 私发本人 |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| 直接 `node --test` 跑 ts 失败 | 1 | 改用 ts-node/esm loader |
