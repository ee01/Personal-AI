/**
 * Tests for P2-9 MCP tools dispatcher: scope allowlist, sensitive exclusion,
 * redaction, and audit — all without the MCP SDK (pure dispatcher).
 */

import { callMcpTool, type McpAuditEntry, type McpToolContext } from '../mcp/tools.js';

function makeCtx(over: Partial<McpToolContext> = {}): { ctx: McpToolContext; audits: McpAuditEntry[] } {
  const audits: McpAuditEntry[] = [];
  const ctx: McpToolContext = {
    baseUrl: 'http://localhost:3210',
    userId: 'esone.qiu',
    allowedScopes: ['work'],
    clientInfo: 'test-client',
    fetchFn: (async () => ({ ok: true, status: 200, json: async () => ({ items: [] }) })) as unknown as typeof fetch,
    audit: (e) => audits.push(e),
    ...over,
  };
  return { ctx, audits };
}

describe('callMcpTool', () => {
  it('refuses a scope outside the allowlist and audits scope_denied', async () => {
    const { ctx, audits } = makeCtx();
    const res = (await callMcpTool('memory_search', { query: 'x', scope: 'personal' }, ctx)) as {
      error?: string;
      allowedScopes?: string[];
    };
    expect(res.error).toBe('scope_not_allowed');
    expect(res.allowedScopes).toEqual(['work']);
    expect(audits.at(-1)).toMatchObject({ status: 'scope_denied', tool: 'memory_search' });
  });

  it('redacts to summaries and excludes sensitive sources', async () => {
    const fetchFn = (async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        items: [
          { previewText: 'a'.repeat(800), source: 'ringcentral', timestamp: 1_700_000_000 },
          { previewText: 'secret leak', source: 'vault:credentials', timestamp: 1_700_000_000 },
        ],
      }),
    })) as unknown as typeof fetch;
    const { ctx, audits } = makeCtx({ fetchFn });
    const res = (await callMcpTool('memory_search', { query: 'x' }, ctx)) as {
      items: Array<{ summary: string; source: string }>;
      receipt: { redaction: string };
    };
    expect(res.items).toHaveLength(1); // vault item excluded
    expect(res.items[0].source).toBe('ringcentral');
    expect(res.items[0].summary.endsWith('…')).toBe(true); // truncated
    expect(res.items[0].summary.length).toBeLessThanOrEqual(501);
    expect(res.receipt.redaction).toBe('summary_only');
    expect(audits.at(-1)).toMatchObject({ status: 'ok', itemCount: 1 });
  });

  it('memory_save posts as an mcp_client trusted-internal source', async () => {
    let captured: { path?: string; body?: any } = {};
    const fetchFn = (async (url: string, init: any) => {
      captured = { path: url, body: JSON.parse(init.body) };
      return { ok: true, status: 200, json: async () => ({ id: 'm-1', decision: { storage: 'indexed' } }) };
    }) as unknown as typeof fetch;
    const { ctx } = makeCtx({ fetchFn });
    const res = (await callMcpTool('memory_save', { content: 'remember this' }, ctx)) as { saved: boolean; id: string };
    expect(res.saved).toBe(true);
    expect(res.id).toBe('m-1');
    expect(captured.path).toContain('/api/v1/ingest');
    expect(captured.body.sourceType).toBe('mcp_client');
  });
});
