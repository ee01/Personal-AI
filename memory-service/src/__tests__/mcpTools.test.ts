/**
 * Tests for P2-9 / Block F MCP tools: scope allowlist, sensitive exclusion,
 * evidence IDs, memory_evidence_get gating, and Streamable HTTP JSON-RPC.
 */

import {
  callMcpTool,
  parseEvidenceId,
  toEvidenceId,
  type McpAuditEntry,
  type McpToolContext,
} from '../mcp/tools.js';
import {
  handleMcpJsonRpc,
  isOriginAllowed,
  parseBearerToken,
} from '../mcp/streamableHttp.js';

function makeCtx(over: Partial<McpToolContext> = {}): {
  ctx: McpToolContext;
  audits: McpAuditEntry[];
} {
  const audits: McpAuditEntry[] = [];
  const ctx: McpToolContext = {
    baseUrl: 'http://localhost:3210',
    userId: 'esone.qiu',
    allowedScopes: ['work'],
    oauthScopes: ['memory.read'],
    clientInfo: 'test-client',
    fetchFn: (async () => ({
      ok: true,
      status: 200,
      json: async () => ({ items: [] }),
    })) as unknown as typeof fetch,
    audit: (e) => audits.push(e),
    ...over,
  };
  return { ctx, audits };
}

describe('callMcpTool', () => {
  it('refuses a scope outside the allowlist and audits scope_denied', async () => {
    const { ctx, audits } = makeCtx();
    const res = (await callMcpTool(
      'memory_search',
      { query: 'x', scope: 'personal' },
      ctx,
    )) as {
      error?: string;
      allowedScopes?: string[];
    };
    expect(res.error).toBe('scope_not_allowed');
    expect(res.allowedScopes).toEqual(['work']);
    expect(audits.at(-1)).toMatchObject({
      status: 'scope_denied',
      tool: 'memory_search',
    });
  });

  it('redacts to summaries, excludes sensitive sources, and emits evidenceIds', async () => {
    const fetchFn = (async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        items: [
          {
            id: 'msg-1',
            type: 'message',
            previewText: 'a'.repeat(800),
            source: 'ringcentral',
            timestamp: 1_700_000_000,
          },
          {
            id: 'msg-2',
            type: 'message',
            previewText: 'secret leak',
            source: 'vault:credentials',
            timestamp: 1_700_000_000,
          },
        ],
        channelDiagnostics: [
          { channel: 'vector', status: 'ok', candidateCount: 2 },
          { channel: 'fts', status: 'failed', reason: 'timeout', candidateCount: 0 },
        ],
      }),
    })) as unknown as typeof fetch;
    const { ctx, audits } = makeCtx({ fetchFn });
    const res = (await callMcpTool('memory_search', { query: 'x' }, ctx)) as {
      items: Array<{ summary: string; source: string; evidenceId: string }>;
      channels: Array<{ channel: string; failed?: boolean }>;
      receipt: { redaction: string };
    };
    expect(res.items).toHaveLength(1);
    expect(res.items[0].source).toBe('ringcentral');
    expect(res.items[0].evidenceId).toBe('message:msg-1');
    expect(res.items[0].summary.endsWith('…')).toBe(true);
    expect(res.items[0].summary.length).toBeLessThanOrEqual(501);
    expect(res.channels.find((c) => c.channel === 'fts')?.failed).toBe(true);
    expect(res.receipt.redaction).toBe('summary_only');
    expect(audits.at(-1)).toMatchObject({ status: 'ok', itemCount: 1 });
  });

  it('memory_save posts as an mcp_client trusted-internal source', async () => {
    let captured: { path?: string; body?: any } = {};
    const fetchFn = (async (url: string, init: any) => {
      captured = { path: url, body: JSON.parse(init.body) };
      return {
        ok: true,
        status: 200,
        json: async () => ({ id: 'm-1', decision: { storage: 'indexed' } }),
      };
    }) as unknown as typeof fetch;
    const { ctx } = makeCtx({ fetchFn });
    const res = (await callMcpTool(
      'memory_save',
      { content: 'remember this' },
      ctx,
    )) as { saved: boolean; id: string };
    expect(res.saved).toBe(true);
    expect(res.id).toBe('m-1');
    expect(captured.path).toContain('/api/v1/ingest');
    expect(captured.body.sourceType).toBe('mcp_client');
  });

  it('gates memory_evidence_get behind evidence.raw.read', async () => {
    const { ctx } = makeCtx({ oauthScopes: ['memory.read'] });
    const denied = (await callMcpTool(
      'memory_evidence_get',
      { evidenceId: 'message:msg-1' },
      ctx,
    )) as { error?: string; requiredScope?: string };
    expect(denied.error).toBe('scope_not_allowed');
    expect(denied.requiredScope).toBe('evidence.raw.read');

    const fetchFn = (async (url: string) => {
      expect(url).toContain('/api/v1/memories/message/msg-1');
      return {
        ok: true,
        status: 200,
        json: async () => ({
          content: 'full transcript text',
          source: 'ringcentral',
          timestamp: 1_700_000_000,
        }),
      };
    }) as unknown as typeof fetch;
    const { ctx: rawCtx } = makeCtx({
      oauthScopes: ['memory.read', 'evidence.raw.read'],
      fetchFn,
    });
    const ok = (await callMcpTool(
      'memory_evidence_get',
      { evidenceId: 'message:msg-1' },
      rawCtx,
    )) as { content?: string; evidenceId?: string };
    expect(ok.evidenceId).toBe('message:msg-1');
    expect(ok.content).toContain('full transcript');
  });
});

describe('evidence id helpers', () => {
  it('round-trips evidence ids', () => {
    expect(toEvidenceId({ type: 'chunk', id: '42' })).toBe('chunk:42');
    expect(parseEvidenceId('message:abc')).toEqual({
      type: 'message',
      id: 'abc',
    });
  });
});

describe('streamable HTTP helpers', () => {
  it('validates origin allowlist and bearer parsing', () => {
    expect(isOriginAllowed('http://localhost:3210', [])).toBe(true);
    expect(
      isOriginAllowed('http://evil', ['http://localhost:3210']),
    ).toBe(false);
    expect(
      isOriginAllowed('http://localhost:3210', ['http://localhost:3210']),
    ).toBe(true);
    expect(parseBearerToken('Bearer tok-1')).toBe('tok-1');
  });

  it('handles initialize and tools/list JSON-RPC', async () => {
    const { ctx } = makeCtx();
    const init = await handleMcpJsonRpc(
      { jsonrpc: '2.0', id: 1, method: 'initialize', params: {} },
      ctx,
    );
    expect(init.status).toBe(200);
    expect((init.body as any).result.serverInfo.name).toBe('personal-memory');

    const listed = await handleMcpJsonRpc(
      { jsonrpc: '2.0', id: 2, method: 'tools/list' },
      ctx,
    );
    const names = ((listed.body as any).result.tools as Array<{ name: string }>).map(
      (t) => t.name,
    );
    expect(names).toContain('memory_evidence_get');
    expect(names).toContain('memory_search');
  });
});
