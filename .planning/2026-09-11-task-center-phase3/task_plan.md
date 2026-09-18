# Task Plan: Deploy memory-service, then Phase 3 (no OpenClaw pen)

## Goal
先修好生产 memory-service 全站 HTTP 500（073 STORED 列 migration），部署含任务中心镜像的最新代码；再补 Phase 3 人工节点 UI，并加 MCP `create_ledger_task`。OpenClaw 记忆笔 / intent-fragments 不做。Phase 4 GAS DOMAIN 切流因无法发新 App Script 而跳过。

## Current Phase
Phase 1

## Phases

### Phase 1: Diagnose production 500s and deploy
- [x] Confirm 073 remote SQL is the failing ALTER STORED column
- [x] Confirm local 073 is the drop+recreate fix
- [x] Deploy memory-service
- [x] Verify `/health` database.connected and `/task-center/tasks`
- **Status:** complete

### Phase 2: Cloud-lane smoke test
- [x] Create a ☁️ task via API or Task Center UI
- [ ] Confirm Sheet row / explain if Google token blocks agent
- **Status:** in_progress

### Phase 3: Plan gate, deps, artifacts, reflection attach
- [x] Dev plan gate UI + confirm_request wiring
- [x] depends_on / parent editor
- [x] Artifact review inbox
- [x] Reflection worker attaches candidates to ledger
- **Status:** complete

### Phase 4: MCP create_ledger_task
- [x] Add MCP tool; skip OpenClaw pen / intent-fragments
- **Status:** complete

### Phase 5: Delivery
- [ ] Explain Phase 4 GAS DOMAIN in Chinese
- [ ] Report what landed vs skipped
- **Status:** pending

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Deploy local 073 (drop+recreate FTS) | Remote 073 ALTER STORED column 500s every authed request |
| Skip Phase 4 Sheet-readonly / GAS DOMAIN | User cannot ship new App Script; cutting Jira→GAS would kill ☁️ 24/7 |
| Skip OpenClaw 记忆笔 / intent-fragments | User will implement in a separate doc |
| Add MCP create_ledger_task | Handoff from Claude/Codex without OpenClaw |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
|          | 1       |            |
