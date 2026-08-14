# Task Plan: Roadmap 草稿描述 + Jira 同步

## Goal
按 `docs/progressing/roadmap-draft-description-and-jira-sync-plan.md` 与 `docs/demo/roadmap-demo.html` 落地草稿 description、hover 展示、Agent Prompt、打开静默刷新与非 draft 回写；同时修复人员视图任务条因日期比较失败而不显示的问题。完成后写入 `docs/features/personal_roadmap.md`，删除 progressing 文档。

## Current Phase
Complete

## Phases

### Phase 1: Requirements & Discovery
- [x] Read plan + demo + current roadmap-service / extension / memory contracts
- [x] Identify people-view bug: `ResourceView.inWindow` compares ISO string with Date → always false
- **Status:** complete

### Phase 2: Backend (roadmap-service)
- [x] schema + migrations: `items.description`, `subs.description`, `teams.jira_refreshed_at`
- [x] DTO / intents: description on add/update (draft-only writes); `refresh_from_jira`
- [x] Target sync for subs; ticker filter; activity text
- [x] Tests: description draft guard, refresh diff/TTL/idempotent, ticker
- **Status:** complete

### Phase 3: Web UI
- [x] Three description entry points + tooltip + AiCreateModal chip
- [x] Agent prompt upgrade
- [x] Silent refresh trigger + conflict skip
- [x] Sub target / assignee writeback toasts
- [x] People-view date overlap fix + gridlines
- **Status:** complete

### Phase 4: Extension + memory
- [x] Batch Jira read, sub target PUT, assignee PUT, description passthrough, prompt copy
- [x] Focus sync description → paragraph, not watch-rule keywords
- **Status:** complete

### Phase 5: Docs, tests, cleanup
- [x] Update `docs/features/personal_roadmap.md` + `docs/index.md`
- [x] Delete progressing plan
- [x] Run vitest / contract / jira-create-fields checks
- **Status:** complete

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Assignee 置空回写前 confirm | 计划开放问题 2：正式版加确认 |
| Refresh 第二批 Backlog 不做 | 计划开放问题 1 |
| 人员视图用 `dateMs`/`rangesOverlap` 比较窗口 | 根因是 `string <= Date` → NaN |
| System Prompt 双份同步 + 契约测试抽关键句 | 与现有 drift 风险处理一致 |
| 写方向 assignee 必须有映射 | 计划口径：owner→Jira 不猜测 firstname.lastname |
| description 只进 external_ref / paragraph | 不进 aliases、entities matching、watch rules |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| `useExtensionBridge` 追加函数匹配到多处 Promise.race | 1 | 用完整 `bridgeUpdateTargetDates` 函数尾部做锚点 |
