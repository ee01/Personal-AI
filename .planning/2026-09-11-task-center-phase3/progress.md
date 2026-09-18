# Progress

## 2026-09-11
- Production health degraded; 073 ALTER STORED column is the 500 storm.
- Deployed memory-service. 073 applied (`073_fix_fts_content_column.sql`); FTS tables recreated. `GET /task-center/tasks` 200, 1792 items.
- Unauthenticated `/health` still `degraded`/`database.connected=false` by design (no user context).
- Created ☁️ ledger task `38cb7091-1044-4ac7-ab61-d929a440bf5e` (`mirrorRequired: true`). Live Sheet `Esone - 定时消息管理` does not yet have the Topic; extension Google token is required to write the row.
- Phase 3 UI + PATCH deps + MCP `create_ledger_task` landed. OpenClaw 记忆笔 skipped. Phase 4 GAS DOMAIN skipped.
- Tests: memory-service 42, modal 14, webpack compile, `verify:task-center-ui` all passed.

