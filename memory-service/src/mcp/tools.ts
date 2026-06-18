/**
 * Memory MCP tools (P2-9). Pure tool registry + dispatcher with NO MCP-SDK
 * dependency, so it is unit-testable and the SDK only wires it in server.ts.
 *
 * Tools are thin adapters over the memory-service HTTP API (the running server,
 * so they reuse its auth/limits/logging). Design discipline:
 *  - minimal egress: summary + evidence count, single items truncated to 500
 *    chars (formatRecalledContext口径); no raw full transcripts.
 *  - scope allowlist: a requested scope outside ctx.allowedScopes is refused.
 *  - sensitive exclusion: credential/vault/private-capsule sources never leave.
 *  - audit: every call emits an audit entry via ctx.audit.
 */

export type McpScope = 'work' | 'personal' | 'both' | 'all';

export interface McpAuditEntry {
  tool: string;
  clientInfo?: string;
  scope?: string;
  itemCount: number;
  status: 'ok' | 'scope_denied' | 'error';
}

export interface McpToolContext {
  baseUrl: string;
  userId: string;
  apiKey?: string;
  allowedScopes: McpScope[];
  clientInfo?: string;
  fetchFn: typeof fetch;
  audit?: (entry: McpAuditEntry) => void;
}

export interface McpToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export const MCP_TOOLS: McpToolDef[] = [
  {
    name: 'memory_search',
    description:
      "Search the user's personal memory for relevant past context (messages, meetings, Jira, web). Returns redacted summaries with source, date and evidence counts — not raw transcripts.",
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'what to look for' },
        scope: { type: 'string', enum: ['work', 'personal', 'both', 'all'] },
        limit: { type: 'number', minimum: 1, maximum: 20 },
      },
      required: ['query'],
    },
  },
  {
    name: 'memory_ask',
    description:
      "Ask a natural-language question answered from the user's personal memory, with cited evidence summaries.",
    inputSchema: {
      type: 'object',
      properties: {
        question: { type: 'string' },
        scope: { type: 'string', enum: ['work', 'personal', 'both', 'all'] },
      },
      required: ['question'],
    },
  },
  {
    name: 'memory_save',
    description:
      "Save a note into the user's personal memory. Goes through the full salience / merge / probation pipeline as a trusted internal source.",
    inputSchema: {
      type: 'object',
      properties: {
        content: { type: 'string' },
        sourceHint: { type: 'string' },
        scope: { type: 'string', enum: ['work', 'personal'] },
      },
      required: ['content'],
    },
  },
  {
    name: 'memory_context_brief',
    description:
      'Get a compact, token-budgeted context brief about a topic or person from memory, for handing to another AI tool.',
    inputSchema: {
      type: 'object',
      properties: {
        topicOrPerson: { type: 'string' },
        tokenBudget: { type: 'number', minimum: 200, maximum: 4000 },
      },
    },
  },
  {
    name: 'memory_profile_hint',
    description:
      "Ask how the user tends to think / prefer about an aspect — returns an insight (not raw profile rows).",
    inputSchema: {
      type: 'object',
      properties: { aspect: { type: 'string' } },
    },
  },
];

const SENSITIVE_SOURCE_PATTERN = /vault|credential|secret|password|token|private[-_]/i;

function truncate(s: string, n = 500): string {
  if (!s) return '';
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

function resolveScope(ctx: McpToolContext, requested?: string): { scope: McpScope } | { error: string; allowedScopes: McpScope[] } {
  if (!requested) return { scope: ctx.allowedScopes[0] ?? 'work' };
  if (!ctx.allowedScopes.includes(requested as McpScope)) {
    return { error: 'scope_not_allowed', allowedScopes: ctx.allowedScopes };
  }
  return { scope: requested as McpScope };
}

async function httpPost(
  ctx: McpToolContext,
  path: string,
  body: unknown,
): Promise<any> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-User-Id': ctx.userId,
  };
  if (ctx.apiKey) headers.Authorization = `Bearer ${ctx.apiKey}`;
  const res = await ctx.fetchFn(`${ctx.baseUrl}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`memory-service ${path} -> ${res.status}`);
  return res.json();
}

function isSensitive(source: unknown): boolean {
  return typeof source === 'string' && SENSITIVE_SOURCE_PATTERN.test(source);
}

/** Dispatch a tool call. Returns a plain JSON-serializable object. */
export async function callMcpTool(
  name: string,
  args: Record<string, unknown>,
  ctx: McpToolContext,
): Promise<unknown> {
  const emit = (entry: McpAuditEntry) => ctx.audit?.(entry);
  try {
    if (name === 'memory_search') {
      const scoped = resolveScope(ctx, args.scope as string | undefined);
      if ('error' in scoped) {
        emit({ tool: name, clientInfo: ctx.clientInfo, scope: String(args.scope), itemCount: 0, status: 'scope_denied' });
        return scoped;
      }
      const limit = Math.min(Math.max(Number(args.limit) || 5, 1), 20);
      const data = await httpPost(ctx, '/api/v1/recall', {
        query: String(args.query ?? ''),
        scope: scoped.scope,
        topK: limit,
        includeMetadata: true,
      });
      const rawItems: any[] = Array.isArray(data?.items) ? data.items : [];
      const items = rawItems
        .filter((it) => !isSensitive(it?.source))
        .slice(0, limit)
        .map((it) => ({
          summary: truncate(it.previewText || it.displayText || it.content || '', 500),
          source: it.source ?? 'unknown',
          date: it.timestamp ? new Date(it.timestamp * 1000).toISOString().slice(0, 10) : undefined,
          weave: it.metadata?.weave,
        }));
      emit({ tool: name, clientInfo: ctx.clientInfo, scope: scoped.scope, itemCount: items.length, status: 'ok' });
      return { items, receipt: { scopeApplied: scoped.scope, redaction: 'summary_only' } };
    }

    if (name === 'memory_ask') {
      const scoped = resolveScope(ctx, args.scope as string | undefined);
      if ('error' in scoped) {
        emit({ tool: name, clientInfo: ctx.clientInfo, scope: String(args.scope), itemCount: 0, status: 'scope_denied' });
        return scoped;
      }
      const data = await httpPost(ctx, '/api/v1/ask', {
        query: String(args.question ?? ''),
        scope: scoped.scope,
      });
      const evidence: any[] = Array.isArray(data?.evidence) ? data.evidence : [];
      const filtered = evidence.filter((e) => !isSensitive(e?.source));
      emit({ tool: name, clientInfo: ctx.clientInfo, scope: scoped.scope, itemCount: filtered.length, status: 'ok' });
      return {
        answer: data?.answer ?? '',
        weave: data?.weave,
        evidenceCount: filtered.length,
        receipt: { scopeApplied: scoped.scope, redaction: 'summary_only' },
      };
    }

    if (name === 'memory_save') {
      const scoped = resolveScope(ctx, (args.scope as string) ?? 'work');
      if ('error' in scoped) {
        emit({ tool: name, clientInfo: ctx.clientInfo, scope: String(args.scope), itemCount: 0, status: 'scope_denied' });
        return scoped;
      }
      const data = await httpPost(ctx, '/api/v1/ingest', {
        content: String(args.content ?? ''),
        sourceType: 'mcp_client',
        scope: scoped.scope,
        sourceTitle: (args.sourceHint as string) || 'MCP note',
      });
      emit({ tool: name, clientInfo: ctx.clientInfo, scope: scoped.scope, itemCount: 1, status: 'ok' });
      return { saved: true, id: data?.id, decision: data?.decision };
    }

    if (name === 'memory_context_brief') {
      const scope = ctx.allowedScopes[0] ?? 'work';
      const data = await httpPost(ctx, '/api/v1/recall', {
        query: String(args.topicOrPerson ?? ''),
        scope,
        topK: 8,
        includeMetadata: true,
      });
      const rawItems: any[] = Array.isArray(data?.items) ? data.items : [];
      const budget = Math.min(Math.max(Number(args.tokenBudget) || 1200, 200), 4000);
      const lines: string[] = [];
      let used = 0;
      for (const it of rawItems) {
        if (isSensitive(it?.source)) continue;
        const line = `- (${it.source ?? 'unknown'}) ${truncate(it.previewText || it.content || '', 300)}`;
        used += Math.ceil(line.length / 4);
        if (used > budget) break;
        lines.push(line);
      }
      emit({ tool: name, clientInfo: ctx.clientInfo, scope, itemCount: lines.length, status: 'ok' });
      return { brief: lines.join('\n'), itemCount: lines.length, scopeApplied: scope };
    }

    if (name === 'memory_profile_hint') {
      const data = await httpPost(ctx, '/api/v1/profile/insight', {
        question: (args.aspect as string) || '这个用户的工作偏好与风格是什么？',
      });
      emit({ tool: name, clientInfo: ctx.clientInfo, scope: 'profile', itemCount: 1, status: 'ok' });
      return { insight: data?.insight ?? data?.answer ?? '', confidence: data?.confidence, evidenceCount: data?.evidenceCount };
    }

    emit({ tool: name, clientInfo: ctx.clientInfo, itemCount: 0, status: 'error' });
    return { error: 'unknown_tool', tool: name };
  } catch (err) {
    emit({ tool: name, clientInfo: ctx.clientInfo, itemCount: 0, status: 'error' });
    return { error: 'tool_failed', message: err instanceof Error ? err.message : String(err) };
  }
}
