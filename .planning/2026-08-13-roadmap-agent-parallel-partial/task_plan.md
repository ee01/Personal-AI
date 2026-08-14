# Task Plan: Roadmap Agent 按 Epic 并行 + 组内部分成功回写

## Goal
Agent 创建 Jira 按 Epic 最多 2 路并行；任一组部分成功时仍把已有 jiraKey 回写 Roadmap。关页后 background 不续跑轮询；下次打开同一浏览器的 Roadmap 页自动 resume 并补回写。

## Current Phase
Phase 5: Delivery

## Phases

### Phase 1: Requirements & Discovery
- [x] Confirm merge-into-one-request is rejected in favor of per-Epic parallel
- [x] Confirm partial-success mappings protocol is required even on failed AgentTask
- **Status:** complete

### Phase 2: Planning & Structure
- [x] Extract mappings parser for unit tests
- [x] Concurrency helper (limit 2) for Vue modal
- [x] Per-group prompt slice so parallel agents do not all see 14 drafts
- **Status:** complete

### Phase 3: Implementation
- [x] `src/roadmapAgentMappings.ts` + tests
- [x] `handleAgentCreateJira` writes back mappings even when queueStatus is failed
- [x] `AiCreateModal` Agent path `runWithConcurrency(..., 2)`
- [x] Bridge timeout 30min; docs + demo
- [x] `chrome.storage.local` pending ledger + resume on next inject
- **Status:** complete

### Phase 4: Testing & Verification
- [x] Unit tests for mappings + concurrency + pending ledger
- [x] webpack.dev compiled successfully
- **Status:** complete

### Phase 5: Delivery
- [x] Summarize behavior in Chinese
- **Status:** complete
