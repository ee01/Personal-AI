const SAFE_SOURCE_PROTOCOLS = new Set(['http:', 'https:']);
const UNSAFE_EXPLORE_ROUTE_VISIBLE_CHARS_PATTERN = /[\s<>"'`]/;

export const MEMORY_RESULT_TYPE_CONFIG: Record<
  string,
  { name: string; icon: string }
> = {
  message: { name: '消息', icon: '💬' },
  chunk: { name: '片段', icon: '📄' },
  entity: { name: '实体', icon: '📌' },
};

const RECALL_CHANNEL_LABELS: Record<string, string> = {
  vector: '语义',
  fts: '关键词',
  graph: '图谱',
  time: '时间',
  direct: '定位',
};

const RECALL_CHANNEL_STATUS_LABELS: Record<string, string> = {
  hit: '命中',
  empty: '无命中',
  skipped: '未运行',
  failed: '失败',
};

const RECALL_CHANNEL_REASON_LABELS: Record<string, string> = {
  embedding_unavailable: '语义索引不可用',
};

export interface SearchResultTypeOption {
  key: string;
}

export interface MemorySearchResultLike {
  id?: unknown;
  resultKey?: unknown;
  recallType?: unknown;
  type?: unknown;
  sourceTitle?: unknown;
  source?: unknown;
  timestamp?: unknown;
  channels?: unknown;
  scope?: unknown;
  metadata?: unknown;
}

export interface RecallChannelDiagnosticLike {
  channel?: unknown;
  status?: unknown;
  candidateCount?: unknown;
  reason?: unknown;
}

export interface RecallChannelDiagnosticView {
  channel: string;
  status: 'hit' | 'empty' | 'skipped' | 'failed';
  candidateCount: number;
  label: string;
  title: string;
  tone: 'ok' | 'muted' | 'warning' | 'danger';
}

export interface MemoryScopeBreakdown {
  work: number;
  personal: number;
  unknown: number;
  total: number;
}

export function getScopeLabel(scope: unknown): string {
  if (scope === 'personal') return '个人记忆';
  if (scope === 'both' || scope === 'all') return '全部记忆';
  return '工作记忆';
}

function getResultScope(
  entity: MemorySearchResultLike,
): 'work' | 'personal' | 'unknown' {
  if (entity.scope === 'work' || entity.scope === 'personal') {
    return entity.scope;
  }

  const metadata = entity.metadata;
  if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
    const metadataScope = (metadata as Record<string, unknown>).scope;
    if (metadataScope === 'work' || metadataScope === 'personal') {
      return metadataScope;
    }
  }

  return 'unknown';
}

export function getScopeBreakdown(
  results: MemorySearchResultLike[],
): MemoryScopeBreakdown {
  return results.reduce<MemoryScopeBreakdown>(
    (breakdown, result) => {
      breakdown[getResultScope(result)] += 1;
      breakdown.total += 1;
      return breakdown;
    },
    { work: 0, personal: 0, unknown: 0, total: 0 },
  );
}

export function formatScopeBreakdownLabel(
  results: MemorySearchResultLike[],
): string {
  const breakdown = getScopeBreakdown(results);
  if (breakdown.total === 0) return '';

  return [
    breakdown.work > 0 ? `工作 ${breakdown.work}` : '',
    breakdown.personal > 0 ? `个人 ${breakdown.personal}` : '',
    breakdown.unknown > 0 ? `未标明 ${breakdown.unknown}` : '',
  ]
    .filter(Boolean)
    .join(' · ');
}

export function formatMemoryTimestamp(timestamp: unknown): string {
  if (typeof timestamp !== 'number' || !Number.isFinite(timestamp)) return '';
  const ms = timestamp < 10_000_000_000 ? timestamp * 1000 : timestamp;
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function getResultMeta(entity: MemorySearchResultLike): string[] {
  return [
    typeof entity.sourceTitle === 'string' && entity.sourceTitle.trim()
      ? entity.sourceTitle
      : typeof entity.source === 'string'
        ? entity.source
        : '',
    formatMemoryTimestamp(entity.timestamp),
  ].filter(Boolean);
}

export function getResultChannels(entity: MemorySearchResultLike): string[] {
  return Array.isArray(entity.channels)
    ? entity.channels.filter((channel): channel is string =>
        typeof channel === 'string' && channel.length > 0,
      )
    : [];
}

export function getRecallChannelLabel(channel: string): string {
  return RECALL_CHANNEL_LABELS[channel] || channel;
}

function getRecallChannelStatusLabel(status: string): string {
  return RECALL_CHANNEL_STATUS_LABELS[status] || status;
}

function getRecallChannelReasonLabel(reason: unknown): string {
  if (typeof reason !== 'string' || !reason.trim()) return '';
  return RECALL_CHANNEL_REASON_LABELS[reason] || reason;
}

export function formatRecallChannelDiagnostic(
  diagnostic: RecallChannelDiagnosticLike,
): RecallChannelDiagnosticView | null {
  if (typeof diagnostic.channel !== 'string' || !diagnostic.channel.trim()) {
    return null;
  }

  const rawStatus =
    diagnostic.status === 'hit' ||
    diagnostic.status === 'empty' ||
    diagnostic.status === 'skipped' ||
    diagnostic.status === 'failed'
      ? diagnostic.status
      : 'empty';
  const candidateCount =
    typeof diagnostic.candidateCount === 'number' &&
    Number.isFinite(diagnostic.candidateCount)
      ? Math.max(0, Math.floor(diagnostic.candidateCount))
      : 0;
  const channelLabel = getRecallChannelLabel(diagnostic.channel);
  const statusLabel = getRecallChannelStatusLabel(rawStatus);
  const reasonLabel = getRecallChannelReasonLabel(diagnostic.reason);
  const countLabel = rawStatus === 'hit' ? ` ${candidateCount}` : '';
  const detailLabel = reasonLabel ? `: ${reasonLabel}` : '';

  return {
    channel: diagnostic.channel,
    status: rawStatus,
    candidateCount,
    label: `${channelLabel} ${statusLabel}${countLabel}`,
    title: `${channelLabel}${detailLabel}`,
    tone:
      rawStatus === 'hit'
        ? 'ok'
        : rawStatus === 'failed'
          ? 'danger'
          : rawStatus === 'skipped'
            ? 'warning'
            : 'muted',
  };
}

export function formatRecallChannelDiagnostics(
  diagnostics: unknown,
): RecallChannelDiagnosticView[] {
  if (!Array.isArray(diagnostics)) return [];
  return diagnostics
    .map((diagnostic) =>
      diagnostic && typeof diagnostic === 'object'
        ? formatRecallChannelDiagnostic(
            diagnostic as RecallChannelDiagnosticLike,
          )
        : null,
    )
    .filter(
      (diagnostic): diagnostic is RecallChannelDiagnosticView =>
        diagnostic !== null,
    );
}

export function getSearchResultKey(entity: MemorySearchResultLike): string {
  if (typeof entity.resultKey === 'string' && entity.resultKey.trim()) {
    return entity.resultKey;
  }

  const type =
    typeof entity.recallType === 'string' && entity.recallType.trim()
      ? entity.recallType
      : typeof entity.type === 'string' && entity.type.trim()
        ? entity.type
        : 'result';
  return `${type}:${String(entity.id ?? '')}`;
}

export function sanitizeMemoryExploreRoute(
  rawRoute?: string | null,
): string | null {
  const value = rawRoute?.trim();
  if (!value || !value.startsWith('#/')) return null;
  if (UNSAFE_EXPLORE_ROUTE_VISIBLE_CHARS_PATTERN.test(value)) return null;
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (code < 32 || code === 127) return null;
  }
  return value;
}

export function normalizeMemorySourceUrl(rawUrl?: unknown): string | null {
  if (typeof rawUrl !== 'string') return null;
  const value = rawUrl.trim();
  if (!/^https?:\/\//i.test(value)) return null;

  try {
    const parsed = new URL(value);
    if (!SAFE_SOURCE_PROTOCOLS.has(parsed.protocol)) return null;
    parsed.username = '';
    parsed.password = '';
    return parsed.href;
  } catch (_error) {
    return null;
  }
}

export function shouldResetTypeFilter(
  selectedTypeFilter: string,
  availableTypes: SearchResultTypeOption[],
): boolean {
  if (!availableTypes.length || selectedTypeFilter === 'all') return false;
  return !availableTypes.some((type) => type.key === selectedTypeFilter);
}
