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
}

export function getScopeLabel(scope: unknown): string {
  if (scope === 'personal') return '个人记忆';
  if (scope === 'both' || scope === 'all') return '全部记忆';
  return '工作记忆';
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
