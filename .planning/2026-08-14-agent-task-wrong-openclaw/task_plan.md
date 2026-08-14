# Task Plan: Agent Task 用了本机 OpenClaw 而不是 Mac mini

## Goal
查清 memory-exploring 执行 agent_task（sourceRefId=msg_1786694923950）时为何打到本机 OpenClaw（10.32.57.190），而不是 Options 里设为默认的 Mac mini（claw.xmnup.com / 10.32.56.212）。区分代码 bug、默认值未落库、动作写死 executor、以及域名解析/端口连通问题。

## Current Phase
Phase 1

## Phases

### Phase 1: Requirements & Discovery
- [x] 理解用户配置：两个 Gateway，Agent Task 默认 Mac mini
- [ ] 读执行器选择链路（创建 vs 执行/重试）
- [ ] 查线上 config + 该 action 的 params.executor
- [ ] 测 claw.xmnup.com DNS / 80 / 18789 / WebSocket
- **Status:** in_progress

### Phase 2: Root cause
- [ ] 判定是代码 bug、配置落库、动作绑定，还是网关连通
- [ ] 记录证据到 findings.md
- **Status:** pending

### Phase 3: Fix if code bug
- [ ] 仅在确认是代码问题后改代码
- [ ] 补测试
- **Status:** pending

### Phase 4: Verification
- [ ] 单测或连通性复测
- **Status:** pending

### Phase 5: Delivery
- [ ] 用中文向用户说明结论与建议
- **Status:** pending

## Key Questions
1. 该 action 创建时 params 是否已经写死 `executor=openclaw`？
2. 线上 `executorDefaults.agent_task` 是否真是 `exec_t4com0`？
3. `http://claw.xmnup.com` 转成 `ws://claw.xmnup.com`（默认 80）能否打到 18789？
4. 连通失败时会不会静默回退到第一个执行器？

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| 先查线上动作与连通性，再决定是否改代码 | 用户问的是原因，不是先修 |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
|       | 1       |            |
