/**
 * Memory MCP tools (P2-9 + Block F evidence upgrade).
 * Pure tool registry + dispatcher with NO MCP-SDK dependency.
 */

export type McpScope = 'work' | 'personal' | 'both' | 'all';

export type McpRetrievalMode = 'qa' | 'investigation' | 'audit';

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
  /** OAuth-style tool scopes. `evidence.raw.read` gates memory_evidence_get. */
  oauthScopes?: string[];
  clientInfo?: string;
  fetchFn: typeof fetch;
  audit?: (entry: McpAuditEntry) => void;
}

export interface McpToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface McpEvidenceItem {
  evidenceId: string;
  summary: string;
  source: string;
  date?: string;
  weave?: unknown;
  type?: string;
  score?: number;
  timeConfidence?: 'high' | 'medium' | 'low' | 'unknown';
}

export interface McpChannelReceipt {
  channel: string;
  status: string;
  candidateCount?: number;
  reason?: string;
  failed?: boolean;
}

const RETRIEVAL_MODE_SCHEMA = {
  type: 'string',
  enum: ['qa', 'investigation', 'audit'],
  description:
    'qa=ordinary Q&A summaries; investigation=evidence bundle + source receipts; audit=exhaustive filtered scan (async-style larger result + scanned ranges)',
} as const;

export const MCP_TOOLS: McpToolDef[] = [
  {
    name: 'memory_search',
    description:
      "Search the user's personal memory. Returns stable evidence IDs, channel receipts, and redacted summaries — not raw transcripts (use memory_evidence_get with evidence.raw.read for originals).",
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'what to look for' },
        scope: { type: 'string', enum: ['work', 'personal', 'both', 'all'] },
        limit: { type: 'number', minimum: 1, maximum: 50 },
        mode: RETRIEVAL_MODE_SCHEMA,
      },
      required: ['query'],
    },
  },
  {
    name: 'memory_ask',
    description:
      "Ask a natural-language question answered from the user's personal memory, with cited evidence IDs and channel coverage receipts.",
    inputSchema: {
      type: 'object',
      properties: {
        question: { type: 'string' },
        scope: { type: 'string', enum: ['work', 'personal', 'both', 'all'] },
        mode: RETRIEVAL_MODE_SCHEMA,
      },
      required: ['question'],
    },
  },
  {
    name: 'memory_evidence_get',
    description:
      'Fetch one evidence item by stable evidenceId. Requires oauth scope evidence.raw.read. Sensitive vault sources are refused.',
    inputSchema: {
      type: 'object',
      properties: {
        evidenceId: {
          type: 'string',
          description: 'Stable id from memory_search/memory_ask, e.g. message:abc or chunk:12',
        },
      },
      required: ['evidenceId'],
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

function resolveScope(
  ctx: McpToolContext,
  requested?: string,
): { scope: McpScope } | { error: string; allowedScopes: McpScope[] } {
  if (!requested) return { scope: ctx.allowedScopes[0] ?? 'work' };
  if (!ctx.allowedScopes.includes(requested as McpScope)) {
    return { error: 'scope_not_allowed', allowedScopes: ctx.allowedScopes };
  }
  return { scope: requested as McpScope };
}

function resolveMode(raw: unknown): McpRetrievalMode {
  const mode = String(raw || 'qa').trim().toLowerCase();
  if (mode === 'investigation' || mode === 'audit') return mode;
  return 'qa';
}

function hasOauthScope(ctx: McpToolContext, scope: string): boolean {
  const scopes = ctx.oauthScopes ?? [];
  return scopes.includes(scope) || scopes.includes('*');
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

async function httpGet(ctx: McpToolContext, path: string): Promise<any> {
  const headers: Record<string, string> = {
    'X-User-Id': ctx.userId,
  };
  if (ctx.apiKey) headers.Authorization = `Bearer ${ctx.apiKey}`;
  const res = await ctx.fetchFn(`${ctx.baseUrl}${path}`, {
    method: 'GET',
    headers,
  });
  if (!res.ok) throw new Error(`memory-service ${path} -> ${res.status}`);
  return res.json();
}

function isSensitive(source: unknown): boolean {
  return typeof source === 'string' && SENSITIVE_SOURCE_PATTERN.test(source);
}

export function toEvidenceId(item: {
  id?: string;
  type?: string;
}): string {
  const type = String(item.type || 'message');
  const id = String(item.id || '').trim();
  if (!id) return `${type}:unknown`;
  if (id.includes(':') && (id.startsWith('message:') || id.startsWith('chunk:') || id.startsWith('entity:'))) {
    return id;
  }
  return `${type}:${id}`;
}

export function parseEvidenceId(
  evidenceId: string,
): { type: string; id: string } | null {
  const raw = String(evidenceId || '').trim();
  const idx = raw.indexOf(':');
  if (idx <= 0) return null;
  const type = raw.slice(0, idx);
  const id = raw.slice(idx + 1);
  if (!type || !id) return null;
  return { type, id };
}

function timeConfidenceFromTimestamp(ts?: number): McpEvidenceItem['timeConfidence'] {
  if (typeof ts !== 'number' || !Number.isFinite(ts) || ts <= 0) return 'unknown';
  const ageDays = (Date.now() / 1000 - ts) / 86400;
  if (ageDays <= 14) return 'high';
  if (ageDays <= 90) return 'medium';
  return 'low';
}

function mapEvidenceItem(it: any): McpEvidenceItem {
  return {
    evidenceId: toEvidenceId(it),
    summary: truncate(it.previewText || it.displayText || it.content || '', 500),
    source: it.source ?? 'unknown',
    date: it.timestamp
      ? new Date(it.timestamp * 1000).toISOString().slice(0, 10)
      : undefined,
    weave: it.metadata?.weave,
    type: it.type,
    score: typeof it.score === 'number' ? it.score : undefined,
    timeConfidence: timeConfidenceFromTimestamp(it.timestamp),
  };
}

function mapChannelReceipts(raw: unknown): McpChannelReceipt[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((row) => {
    const channel = String(row?.channel ?? 'unknown');
    const status = String(row?.status ?? 'unknown');
    const failed =
      status === 'failed' ||
      status === 'error' ||
      status === 'unavailable' ||
      status === 'timeout';
    return {
      channel,
      status,
      candidateCount:
        typeof row?.candidateCount === 'number' ? row.candidateCount : undefined,
      reason: typeof row?.reason === 'string' ? row.reason : undefined,
      failed,
    };
  });
}

function qualityPromise(channels: McpChannelReceipt[], found: number) {
  const failedChannels = channels.filter((c) => c.failed).map((c) => c.channel);
  return {
    foundSaidWithSource: true,
    emptyMeansSearchedRanges: true,
    channelFailureNotAbsence: true,
    conflictsNotForced: true,
    abstainWhenUncertain: true,
    note:
      found === 0
        ? failedChannels.length
          ? `No evidence found; channel failures: ${failedChannels.join(', ')} (do not treat as absence).`
          : 'No evidence found in the searched scopes/channels.'
        : failedChannels.length
          ? `Partial results; channel failures: ${failedChannels.join(', ')}.`
          : undefined,
  };
}

function limitForMode(mode: McpRetrievalMode, requested?: number): number {
  const base = Number(requested);
  if (mode === 'audit') {
    return Math.min(Math.max(Number.isFinite(base) ? base : 30, 1), 50);
  }
  if (mode === 'investigation') {
    return Math.min(Math.max(Number.isFinite(base) ? base : 10, 1), 30);
  }
  return Math.min(Math.max(Number.isFinite(base) ? base : 5, 1), 20);
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
        emit({
          tool: name,
          clientInfo: ctx.clientInfo,
          scope: String(args.scope),
          itemCount: 0,
          status: 'scope_denied',
        });
        return scoped;
      }
      const mode = resolveMode(args.mode);
      const limit = limitForMode(mode, Number(args.limit));
      const data = await httpPost(ctx, '/api/v1/recall', {
        query: String(args.query ?? ''),
        scope: scoped.scope,
        topK: limit,
        includeMetadata: true,
      });
      const rawItems: any[] = Array.isArray(data?.items) ? data.items : [];
      const channels = mapChannelReceipts(data?.channelDiagnostics);
      const items = rawItems
        .filter((it) => !isSensitive(it?.source))
        .slice(0, limit)
        .map(mapEvidenceItem);
      emit({
        tool: name,
        clientInfo: ctx.clientInfo,
        scope: scoped.scope,
        itemCount: items.length,
        status: 'ok',
      });
      return {
        mode,
        items,
        evidence: items,
        channels,
        scanned: {
          scopeApplied: scoped.scope,
          query: String(args.query ?? ''),
          limit,
          itemCountBeforeFilter: rawItems.length,
        },
        quality: qualityPromise(channels, items.length),
        receipt: {
          scopeApplied: scoped.scope,
          redaction: 'summary_only',
          mode,
        },
      };
    }

    if (name === 'memory_ask') {
      const scoped = resolveScope(ctx, args.scope as string | undefined);
      if ('error' in scoped) {
        emit({
          tool: name,
          clientInfo: ctx.clientInfo,
          scope: String(args.scope),
          itemCount: 0,
          status: 'scope_denied',
        });
        return scoped;
      }
      const mode = resolveMode(args.mode);
      const data = await httpPost(ctx, '/api/v1/ask', {
        query: String(args.question ?? ''),
        scope: scoped.scope,
      });
      const evidenceRaw: any[] = Array.isArray(data?.evidence)
        ? data.evidence
        : Array.isArray(data?.items)
          ? data.items
          : [];
      const channels = mapChannelReceipts(data?.channelDiagnostics);
      const filtered = evidenceRaw
        .filter((e) => !isSensitive(e?.source))
        .map(mapEvidenceItem);
      emit({
        tool: name,
        clientInfo: ctx.clientInfo,
        scope: scoped.scope,
        itemCount: filtered.length,
        status: 'ok',
      });
      const base = {
        answer: data?.answer ?? '',
        weave: data?.weave,
        evidenceCount: filtered.length,
        evidenceIds: filtered.map((e) => e.evidenceId),
        channels,
        quality: qualityPromise(channels, filtered.length),
        receipt: {
          scopeApplied: scoped.scope,
          redaction: 'summary_only',
          mode,
        },
      };
      if (mode === 'qa') return base;
      return {
        ...base,
        mode,
        evidence: filtered,
        scanned: {
          scopeApplied: scoped.scope,
          question: String(args.question ?? ''),
        },
        abstain:
          !String(data?.answer || '').trim() && filtered.length === 0
            ? 'Unable to confirm from available memory evidence.'
            : undefined,
      };
    }

    if (name === 'memory_evidence_get') {
      if (!hasOauthScope(ctx, 'evidence.raw.read')) {
        emit({
          tool: name,
          clientInfo: ctx.clientInfo,
          itemCount: 0,
          status: 'scope_denied',
        });
        return {
          error: 'scope_not_allowed',
          requiredScope: 'evidence.raw.read',
          oauthScopes: ctx.oauthScopes ?? [],
        };
      }
      const parsed = parseEvidenceId(String(args.evidenceId ?? ''));
      if (!parsed) {
        emit({
          tool: name,
          clientInfo: ctx.clientInfo,
          itemCount: 0,
          status: 'error',
        });
        return { error: 'invalid_evidence_id', evidenceId: args.evidenceId };
      }
      if (parsed.type === 'entity') {
        return {
          error: 'unsupported_evidence_type',
          evidenceId: args.evidenceId,
          note: 'entity evidence raw fetch is not exposed via MCP',
        };
      }
      const data = await httpGet(
        ctx,
        `/api/v1/memories/${encodeURIComponent(parsed.type)}/${encodeURIComponent(parsed.id)}`,
      );
      if (isSensitive(data?.source || data?.sourceType)) {
        emit({
          tool: name,
          clientInfo: ctx.clientInfo,
          itemCount: 0,
          status: 'scope_denied',
        });
        return { error: 'sensitive_source_blocked', evidenceId: args.evidenceId };
      }
      const content = String(
        data?.content || data?.displayText || data?.previewText || '',
      );
      emit({
        tool: name,
        clientInfo: ctx.clientInfo,
        itemCount: 1,
        status: 'ok',
      });
      return {
        evidenceId: toEvidenceId({ id: parsed.id, type: parsed.type }),
        type: parsed.type,
        source: data?.source ?? data?.sourceType ?? 'unknown',
        date: data?.timestamp
          ? new Date(data.timestamp * 1000).toISOString().slice(0, 10)
          : undefined,
        content: truncate(content, 8000),
        receipt: {
          redaction: 'raw_truncated',
          requiredScope: 'evidence.raw.read',
        },
      };
    }

    if (name === 'memory_save') {
      const scoped = resolveScope(ctx, (args.scope as string) ?? 'work');
      if ('error' in scoped) {
        emit({
          tool: name,
          clientInfo: ctx.clientInfo,
          scope: String(args.scope),
          itemCount: 0,
          status: 'scope_denied',
        });
        return scoped;
      }
      const data = await httpPost(ctx, '/api/v1/ingest', {
        content: String(args.content ?? ''),
        sourceType: 'mcp_client',
        scope: scoped.scope,
        sourceTitle: (args.sourceHint as string) || 'MCP note',
      });
      emit({
        tool: name,
        clientInfo: ctx.clientInfo,
        scope: scoped.scope,
        itemCount: 1,
        status: 'ok',
      });
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
      const budget = Math.min(
        Math.max(Number(args.tokenBudget) || 1200, 200),
        4000,
      );
      const lines: string[] = [];
      let used = 0;
      for (const it of rawItems) {
        if (isSensitive(it?.source)) continue;
        const line = `- (${it.source ?? 'unknown'}) ${truncate(it.previewText || it.content || '', 300)}`;
        used += Math.ceil(line.length / 4);
        if (used > budget) break;
        lines.push(line);
      }
      emit({
        tool: name,
        clientInfo: ctx.clientInfo,
        scope,
        itemCount: lines.length,
        status: 'ok',
      });
      return { brief: lines.join('\n'), itemCount: lines.length, scopeApplied: scope };
    }

    if (name === 'memory_profile_hint') {
      const data = await httpPost(ctx, '/api/v1/profile/insight', {
        question: (args.aspect as string) || '这个用户的工作偏好与风格是什么？',
      });
      emit({
        tool: name,
        clientInfo: ctx.clientInfo,
        scope: 'profile',
        itemCount: 1,
        status: 'ok',
      });
      return {
        insight: data?.insight ?? data?.answer ?? '',
        confidence: data?.confidence,
        evidenceCount: data?.evidenceCount,
      };
    }

    emit({ tool: name, clientInfo: ctx.clientInfo, itemCount: 0, status: 'error' });
    return { error: 'unknown_tool', tool: name };
  } catch (err) {
    emit({ tool: name, clientInfo: ctx.clientInfo, itemCount: 0, status: 'error' });
    return {
      error: 'tool_failed',
      message: err instanceof Error ? err.message : String(err),
    };
  }
}
