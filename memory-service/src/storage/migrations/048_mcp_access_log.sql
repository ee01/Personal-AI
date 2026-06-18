-- 048_mcp_access_log.sql (P2-9: Memory MCP server)
-- Audit log for every MCP tool call, so opening memory to external AI clients
-- (Claude Code, Cursor, ...) stays inspectable (Claude Managed Agents practice).
CREATE TABLE IF NOT EXISTS mcp_access_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tool TEXT NOT NULL,
  client_info TEXT,
  scope TEXT,
  item_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'ok',   -- ok | scope_denied | error
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_mcp_access_tool ON mcp_access_log(tool, created_at);
