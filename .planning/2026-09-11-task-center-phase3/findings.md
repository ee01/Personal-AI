# Findings

## Production 500s
- Health: `degraded`, `database.connected: false`
- Every authed request: `SqliteError: cannot add a STORED column` while applying `073_fix_fts_content_column.sql`
- Remote 073 still has `ALTER TABLE memory_unit_views ADD COLUMN content TEXT GENERATED ALWAYS AS (...) STORED`
- SQLite cannot ADD a STORED generated column on an existing table
- Migration never records as applied → every request retries → hundreds of HTTP 500s
- Local 073 already rewritten to drop+recreate FTS tables (no STORED column)

## Deploy freshness
- Remote `taskCenter.ts` mtime Sep 4; local Sep 11 (mirrorRef / updateMirrorRef)
- Image rebuilt today ~13:15 CST from stale source (old 073)
- Container up, but user DBs cannot open

## Phase 4 meaning
Today ☁️ is Jira → public GAS Web App → Sheet. Phase 4 would make Sheet a read-only mirror, stop Jira calling GAS, and drop GAS access from ANYONE to DOMAIN so App Script upgrades unfreeze. Prerequisite: execution pickup has already moved off GAS. Doing this while new GAS cannot be deployed would take down ☁️ 24/7.

## Skip
- OpenClaw 记忆笔 / intent-fragments
- Phase 4 cutover
