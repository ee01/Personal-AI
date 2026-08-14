# Task Plan: agent_task 只保留连接层就绪门禁

## Goal
`targetSystem=agent_task` 的通用委派只检查 `openclaw:global`（Gateway 连接/鉴权）；能力层失败交回执行器，不再按 triggerSource 分区或连坐后续任务。同时清掉线上卡住的 agent_task 合同。

## Current Phase
Phase 5

## Phases

### Phase 1: Requirements & Discovery
- [x] Confirm current scope uses triggerSource partition
- [x] Confirm capability_missing on agent_task degrades a scoped contract
- [x] Confirm global already gates connection/auth
- **Status:** complete

### Phase 2: Planning & Structure
- [x] agent_task scope → openclaw:global
- [x] action_execution capability/proof/generic errors skip contract mutation
- [x] connection-layer signals still update global
- **Status:** complete

### Phase 3: Implementation
- [x] Change getActionReadinessScope
- [x] Skip per-task capability outcomes in applyDelegationOutcome
- [x] Update tests and docs
- [x] Expire live agent_task contracts
- **Status:** complete

### Phase 4: Testing & Verification
- [x] Targeted actionReadinessService tests
- [x] Deploy memory-service and confirm live contracts no longer block
- **Status:** complete

### Phase 5: Delivery
- [x] Summarize behavior in Chinese
- **Status:** complete

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Map agent_task to openclaw:global | Task content is unknown; capability scopes cannot be inferred from triggerSource |
| Do not write capability_missing / missing artifact onto global | Would cascade to Jira/Drive and all later agent_tasks |
| Probe of agent_task stays connection-layer | Probe asks about gateway, so its outcome may update global |
| Keep jira/drive scoped contracts | Those have a known targetSystem |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
|       | 1       |            |
