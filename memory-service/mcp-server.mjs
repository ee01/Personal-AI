#!/usr/bin/env node
/**
 * Memory MCP server (P2-9). Exposes the user's Personal AI memory to any MCP
 * client (Claude Code, Claude Desktop, Cursor, Codex...) over stdio.
 *
 * This is a thin wiring entry: the real tool logic + redaction/scope/audit lives
 * in dist/mcp/tools.js (built from src/mcp/tools.ts, fully unit-tested). The MCP
 * SDK is imported dynamically so the memory-service TypeScript build never
 * depends on it; Node resolves @modelcontextprotocol/sdk from the repo-root
 * node_modules at runtime.
 *
 * Usage:
 *   claude mcp add personal-memory -- node memory-service/mcp-server.mjs \
 *     --user-id esone.qiu --base-url http://localhost:3210 --scopes work
 *
 * Flags: --user-id <id>  --base-url <url>  --scopes work,personal
 *        --api-key <key>  --oauth-scopes memory.read,evidence.raw.read
 *        --db <path-to-user.sqlite>  (optional audit sink)
 */

import process from 'node:process';

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const val = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true';
      out[key] = val;
    }
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const userId = args['user-id'] || process.env.MCP_USER_ID;
  if (!userId) {
    console.error('memory mcp: --user-id is required');
    process.exit(2);
  }
  const baseUrl = (args['base-url'] || process.env.MEMORY_SERVICE_URL || 'http://localhost:3210').replace(/\/$/, '');
  const allowedScopes = (args.scopes || process.env.MCP_ALLOWED_SCOPES || 'work')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const apiKey = args['api-key'] || process.env.MEMORY_SERVICE_API_KEY;
  const oauthScopes = (args['oauth-scopes'] || process.env.MCP_OAUTH_SCOPES || 'memory.read')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  // Optional direct-to-sqlite audit sink.
  let auditFn;
  if (args.db) {
    try {
      const { default: Database } = await import('better-sqlite3');
      const db = new Database(args.db);
      const stmt = db.prepare(
        `INSERT INTO mcp_access_log (tool, client_info, scope, item_count, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      );
      auditFn = (e) =>
        stmt.run(e.tool, e.clientInfo ?? null, e.scope ?? null, e.itemCount ?? 0, e.status ?? 'ok', Math.floor(Date.now() / 1000));
    } catch (err) {
      console.error('memory mcp: audit sink disabled:', err?.message ?? err);
    }
  }

  // tools.js is built next to this file under dist/mcp/.
  const { MCP_TOOLS, callMcpTool } = await import('./dist/mcp/tools.js');

  // Dynamic SDK import (resolved from repo-root node_modules at runtime).
  const { Server } = await import('@modelcontextprotocol/sdk/server/index.js');
  const { StdioServerTransport } = await import('@modelcontextprotocol/sdk/server/stdio.js');
  const { CallToolRequestSchema, ListToolsRequestSchema } = await import(
    '@modelcontextprotocol/sdk/types.js'
  );

  const server = new Server(
    { name: 'personal-memory', version: '1.0.0' },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: MCP_TOOLS }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const ctx = {
      baseUrl,
      userId,
      apiKey,
      allowedScopes,
      oauthScopes,
      clientInfo: 'mcp',
      fetchFn: fetch,
      audit: auditFn,
    };
    const result = await callMcpTool(req.params.name, req.params.arguments ?? {}, ctx);
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`memory mcp: serving user=${userId} scopes=${allowedScopes.join(',')} -> ${baseUrl}`);
}

main().catch((err) => {
  console.error('memory mcp fatal:', err);
  process.exit(1);
});
