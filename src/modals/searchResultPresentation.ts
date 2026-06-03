const SAFE_SOURCE_PROTOCOLS = new Set(['http:', 'https:']);
const UNSAFE_EXPLORE_ROUTE_VISIBLE_CHARS_PATTERN = /[\s<>"'`]/;
const SEARCH_HIGHLIGHT_SPLIT_PATTERN = /[\s,.;:!?，。；：！？、()[\]{}<>"'`]+/;
const MIN_SEARCH_HIGHLIGHT_TOKEN_LENGTH = 2;
const MAX_SEARCH_HIGHLIGHT_TOKENS = 8;
const ALLOWED_MEMORY_EXPLORE_PATHS = [
  /^\/timeline$/,
  /^\/topic\/[^/]+$/,
  /^\/person\/[^/]+$/,
  /^\/project\/[^/]+$/,
  /^\/entity\/[^/]+$/,
  /^\/source-memory\/[^/]+$/,
];

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

const HTML_ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
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

export interface MemoryLinkSafetyState {
  exploreRoute: string | null;
  sourceUrl: string | null;
  sourceHost: string;
  blockedLabels: string[];
}

export function getScopeLabel(scope: unknown): string {
  if (scope === 'personal') return '个人记忆';
  if (scope === 'both' || scope === 'all') return '全部记忆';
  return '工作记忆';
}

function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(
    /[&<>"']/g,
    (character) => HTML_ESCAPE_MAP[character],
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function getSearchHighlightTokens(query: unknown): string[] {
  if (typeof query !== 'string') return [];
  const trimmedQuery = query.trim();
  if (!trimmedQuery) return [];

  const rawTokens = trimmedQuery
    .split(SEARCH_HIGHLIGHT_SPLIT_PATTERN)
    .map((token) => token.trim())
    .filter((token) => token.length >= MIN_SEARCH_HIGHLIGHT_TOKEN_LENGTH);
  const tokens =
    rawTokens.length > 0 && rawTokens.length <= MAX_SEARCH_HIGHLIGHT_TOKENS
      ? rawTokens
      : [trimmedQuery];
  const seen = new Set<string>();

  return tokens
    .filter((token) => {
      const key = token.toLocaleLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((left, right) => right.length - left.length)
    .slice(0, MAX_SEARCH_HIGHLIGHT_TOKENS);
}

export function renderHighlightedSearchText(
  text: unknown,
  query: unknown,
): string {
  const value = String(text ?? '');
  if (!value) return '';

  const tokens = getSearchHighlightTokens(query);
  if (tokens.length === 0) return escapeHtml(value);

  const pattern = new RegExp(tokens.map(escapeRegExp).join('|'), 'gi');
  let highlighted = '';
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(value)) !== null) {
    const index = match.index ?? 0;
    highlighted += escapeHtml(value.slice(lastIndex, index));
    highlighted += `<mark class="search-highlight">${escapeHtml(
      match[0],
    )}</mark>`;
    lastIndex = index + match[0].length;
  }

  highlighted += escapeHtml(value.slice(lastIndex));
  return highlighted;
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

export function formatScopeExposureNotice(
  results: MemorySearchResultLike[],
  requestedScope: unknown,
): string {
  const scope = requestedScope === 'both' ? 'all' : requestedScope;
  if (scope !== 'all') return '';

  const breakdown = getScopeBreakdown(results);
  if (breakdown.personal <= 0) return '';

  if (breakdown.work > 0) {
    return `已包含 ${breakdown.personal} 条个人记忆；复制或引用前先确认是否适合当前工作场景。`;
  }

  return '当前结果来自个人记忆；复制或引用前先确认是否适合当前场景。';
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
    ? entity.channels.filter(
        (channel): channel is string =>
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
  const routePath = value.slice(1);
  if (!routePath.startsWith('/') || routePath.startsWith('//')) return null;

  let parsed: URL;
  try {
    parsed = new URL(routePath, 'https://memory.local');
  } catch (_error) {
    return null;
  }

  if (
    parsed.origin !== 'https://memory.local' ||
    !ALLOWED_MEMORY_EXPLORE_PATHS.some((pattern) =>
      pattern.test(parsed.pathname),
    )
  ) {
    return null;
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

export function getMemorySourceHost(rawUrl?: unknown): string {
  const safeUrl = normalizeMemorySourceUrl(rawUrl);
  if (!safeUrl) return '';

  try {
    return new URL(safeUrl).host;
  } catch (_error) {
    return '';
  }
}

export function getMemoryLinkSafetyState(input: {
  exploreLink?: unknown;
  sourceUrl?: unknown;
}): MemoryLinkSafetyState {
  const rawExploreLink =
    typeof input.exploreLink === 'string' ? input.exploreLink.trim() : '';
  const rawSourceUrl =
    typeof input.sourceUrl === 'string' ? input.sourceUrl.trim() : '';
  const exploreRoute = sanitizeMemoryExploreRoute(rawExploreLink);
  const sourceUrl = normalizeMemorySourceUrl(rawSourceUrl);
  const blockedLabels: string[] = [];

  if (rawExploreLink && !exploreRoute) {
    blockedLabels.push('记忆内跳转已隐藏：不支持的目标');
  }
  if (rawSourceUrl && !sourceUrl) {
    blockedLabels.push('来源链接已隐藏：仅支持 http/https');
  }

  return {
    exploreRoute,
    sourceUrl,
    sourceHost: getMemorySourceHost(sourceUrl),
    blockedLabels,
  };
}

export function shouldResetTypeFilter(
  selectedTypeFilter: string,
  availableTypes: SearchResultTypeOption[],
): boolean {
  if (!availableTypes.length || selectedTypeFilter === 'all') return false;
  return !availableTypes.some((type) => type.key === selectedTypeFilter);
}
