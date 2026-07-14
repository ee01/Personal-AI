const SAFE_SOURCE_PROTOCOLS = new Set(['http:', 'https:']);
const UNSAFE_EXPLORE_ROUTE_VISIBLE_CHARS_PATTERN = /[\s<>"'`]/;
const UNSAFE_EXPLORE_ROUTE_DECODED_VISIBLE_CHARS_PATTERN = /[<>"'`]/;
const SEARCH_HIGHLIGHT_SPLIT_PATTERN = /[\s,.;:!?，。；：！？、()[\]{}<>"'`]+/;
const MIN_SEARCH_HIGHLIGHT_TOKEN_LENGTH = 2;
const MAX_SEARCH_HIGHLIGHT_TOKENS = 8;
const MAX_SOURCE_COVERAGE_LABEL_LENGTH = 36;
const SENSITIVE_SOURCE_QUERY_PARAM_NAMES = new Set([
  'access_token',
  'apikey',
  'api_key',
  'assertion',
  'auth',
  'awsaccesskeyid',
  'authorization',
  'auth_token',
  'bearer',
  'client_secret',
  'code',
  'credential',
  'credentials',
  'googleaccessid',
  'id_token',
  'jwt',
  'jwt_token',
  'key',
  'login_token',
  'mfa',
  'oauth_token',
  'otp',
  'passcode',
  'password',
  'relaystate',
  'refresh_token',
  'samlrequest',
  'samlresponse',
  'secret',
  'session',
  'session_id',
  'sessionid',
  'sid',
  'sig',
  'signature',
  'sso',
  'sso_token',
  'ticket',
  'token',
  'totp',
  'x_amz_credential',
  'x_amz_security_token',
  'x_amz_signature',
  'x_goog_credential',
  'x_goog_signature',
]);
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
  sourceUrl?: unknown;
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
  reasonLabel: string;
  label: string;
  title: string;
  tone: 'ok' | 'muted' | 'warning' | 'danger';
}

export interface RecallChannelReceiptView {
  title: string;
  summary: string;
  detail: string;
  diagnostics: string[];
  tone: 'ok' | 'warning' | 'danger';
}

export interface EvidenceChannelOverlapReceiptInput {
  visibleResults?: unknown;
}

export interface EvidenceChannelOverlapReceiptView {
  title: string;
  summary: string;
  detail: string;
  tone: 'info' | 'warning';
  metrics: string[];
}

export interface SearchResultBatchReceiptInput {
  query?: unknown;
  scope?: unknown;
  mode?: unknown;
  entityTypeLabel?: unknown;
  selectedTypeFilter?: unknown;
  selectedTypeLabel?: unknown;
  visibleCount?: unknown;
  totalCount?: unknown;
  channelDiagnostics?: unknown;
}

export interface SearchResultBatchReceiptView {
  title: string;
  detail: string;
  tone: 'info' | 'warning';
  metrics: string[];
}

export interface TypeFilterReceiptInput {
  selectedTypeFilter?: unknown;
  selectedTypeLabel?: unknown;
  visibleCount?: unknown;
  totalCount?: unknown;
}

export interface TypeFilterReceiptView {
  title: string;
  detail: string;
  tone: 'info' | 'warning';
  metrics: string[];
}

export interface TypeFilterChipHintInput {
  key?: unknown;
  name?: unknown;
  count?: unknown;
  totalCount?: unknown;
  selectedTypeFilter?: unknown;
}

export interface SourceCoverageReceiptInput {
  visibleResults?: unknown;
  totalResults?: unknown;
  selectedTypeFilter?: unknown;
  selectedTypeLabel?: unknown;
}

export interface SourceCoverageReceiptView {
  title: string;
  detail: string;
  tone: 'info' | 'warning';
  metrics: string[];
}

export interface EmptySearchReceiptInput {
  mode?: unknown;
  query?: unknown;
  scope?: unknown;
  source?: unknown;
  entityTypeLabel?: unknown;
  resultCount?: unknown;
  channelDiagnostics?: unknown;
}

export interface EmptySearchReceiptView {
  title: string;
  detail: string;
  tone: 'info' | 'warning';
  metrics: string[];
  recoveryActions: string[];
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

export interface MemoryLinkSafetyStatusView {
  label: string;
  detail: string;
  tone: 'ready' | 'warning' | 'muted';
  metrics: string[];
}

export type MemoryOpenReceiptTone = 'info' | 'warning';

export interface MemoryOpenReceiptInput {
  action: 'memory_route' | 'source_url' | 'blocked' | 'unavailable';
  resultTitle?: unknown;
  exploreRoute?: string;
  sourceHost?: string;
  blockedLabels?: string[];
}

export interface MemoryOpenReceipt {
  title: string;
  tone: MemoryOpenReceiptTone;
  items: string[];
}

export interface MemoryLinkRecoveryDiagnosticInput {
  result: MemorySearchResultLike;
  blockedLabels?: string[];
  queryLabel?: string;
  scopeLabel?: string;
  modeLabel?: string;
  typeFilterLabel?: string;
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

export function formatScopeBoundaryNotice(
  results: MemorySearchResultLike[],
  requestedScope: unknown,
): string {
  const scope = requestedScope === 'both' ? 'all' : requestedScope;
  if (scope !== 'work' && scope !== 'personal') return '';

  const breakdown = getScopeBreakdown(results);
  if (breakdown.total === 0) return '';

  if (scope === 'work') {
    return '本次仅检索工作记忆，未纳入个人记忆。';
  }

  return '本次仅检索个人记忆，未纳入工作记忆。';
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
  const normalized = reason.trim();
  if (RECALL_CHANNEL_REASON_LABELS[normalized]) {
    return RECALL_CHANNEL_REASON_LABELS[normalized];
  }
  if (/timed out/i.test(normalized)) return '通道超时';
  if (/SQLITE|database|no such table/i.test(normalized)) {
    return '索引查询失败';
  }
  return normalized.slice(0, 80);
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
    reasonLabel,
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

function compactRecallChannelStatus(
  diagnostic: RecallChannelDiagnosticView,
): string {
  const channelLabel = getRecallChannelLabel(diagnostic.channel);
  if (diagnostic.status === 'hit') {
    return `${channelLabel}${diagnostic.candidateCount}`;
  }
  if (diagnostic.status === 'skipped') {
    return `${channelLabel}未运行`;
  }
  if (diagnostic.status === 'failed') {
    return `${channelLabel}失败`;
  }
  return `${channelLabel}无命中`;
}

export function formatRecallChannelReceipt(
  diagnostics: unknown,
): RecallChannelReceiptView | null {
  const views = formatRecallChannelDiagnostics(diagnostics);
  if (views.length === 0) return null;

  const hitViews = views.filter((diagnostic) => diagnostic.status === 'hit');
  const incompleteViews = views.filter(
    (diagnostic) => diagnostic.status !== 'hit',
  );
  const hitSummary =
    hitViews.length > 0
      ? hitViews.map(compactRecallChannelStatus).join('、')
      : '暂无命中';
  const incompleteSummary = incompleteViews
    .map(compactRecallChannelStatus)
    .join('、');
  const allHit = incompleteViews.length === 0;
  const hasFailure = views.some((diagnostic) => diagnostic.status === 'failed');
  const hasSkipped = views.some((diagnostic) => diagnostic.status === 'skipped');
  const hitRatio = `${hitViews.length}/${views.length}`;
  const visibleDiagnostics = incompleteViews
    .filter((diagnostic) => diagnostic.reasonLabel)
    .map((diagnostic) => {
      const channelLabel = getRecallChannelLabel(diagnostic.channel);
      const statusLabel = getRecallChannelStatusLabel(diagnostic.status);
      return `${channelLabel}${statusLabel}：${diagnostic.reasonLabel}`;
    });

  let summary = `本轮结果来自 ${hitRatio} 个召回通道：${hitSummary}。`;
  if (allHit) {
    summary = `本轮 ${views.length} 个召回通道都返回候选：${hitSummary}。`;
  } else if (incompleteSummary) {
    summary += `未完整覆盖：${incompleteSummary}。`;
  }

  return {
    title: '召回通道回执',
    summary,
    detail:
      '未运行、失败或无命中不代表记忆不存在；当前结果只代表已命中的通道，查看或刷新不会写入、删除、同步外部来源或确认答案。',
    diagnostics: visibleDiagnostics,
    tone: hasFailure ? 'danger' : hasSkipped || !allHit ? 'warning' : 'ok',
  };
}

function getUniqueResultChannels(result: MemorySearchResultLike): string[] {
  const seen = new Set<string>();
  return getResultChannels(result).filter((channel) => {
    const normalized = channel.trim();
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

export function formatEvidenceChannelOverlapReceipt(
  input: EvidenceChannelOverlapReceiptInput,
): EvidenceChannelOverlapReceiptView | null {
  if (!Array.isArray(input.visibleResults)) return null;
  const visibleResults = input.visibleResults.filter(
    (result): result is MemorySearchResultLike =>
      Boolean(result && typeof result === 'object'),
  );
  if (visibleResults.length === 0) return null;

  let singleChannelCount = 0;
  let multiChannelCount = 0;
  let missingChannelCount = 0;
  const comboCounts = new Map<string, number>();

  for (const result of visibleResults) {
    const channels = getUniqueResultChannels(result);
    if (channels.length === 0) {
      missingChannelCount += 1;
      continue;
    }
    if (channels.length === 1) {
      singleChannelCount += 1;
      continue;
    }
    multiChannelCount += 1;
    const comboLabel = channels.map(getRecallChannelLabel).join('+');
    comboCounts.set(comboLabel, (comboCounts.get(comboLabel) ?? 0) + 1);
  }

  const channelLabeledCount = singleChannelCount + multiChannelCount;
  if (channelLabeledCount === 0) return null;

  const topCombos = Array.from(comboCounts.entries())
    .sort(
      ([leftLabel, leftCount], [rightLabel, rightCount]) =>
        rightCount - leftCount || leftLabel.localeCompare(rightLabel),
    )
    .slice(0, 2);
  const comboSummary =
    topCombos.length > 0
      ? `常见交叉：${topCombos
          .map(([label, count]) => `${label} ${count}`)
          .join('、')}。`
      : '当前没有证据被多个通道共同命中。';

  const missingSummary =
    missingChannelCount > 0 ? `，${missingChannelCount} 条未标明通道` : '';
  let summary =
    multiChannelCount > 0
      ? `当前 ${visibleResults.length} 条可见结果中，${multiChannelCount} 条由多个召回通道共同命中，${singleChannelCount} 条为单通道${missingSummary}。${comboSummary}`
      : `当前 ${visibleResults.length} 条可见结果中，${singleChannelCount} 条为单通道${missingSummary}。${comboSummary}`;
  if (visibleResults.length === 1) {
    summary =
      multiChannelCount > 0
        ? `当前 1 条可见结果由多个召回通道共同命中。${comboSummary}`
        : '当前 1 条可见结果为单通道证据，尚无通道交叉支持。';
  }
  const metrics = [
    `多通道 ${multiChannelCount}`,
    `单通道 ${singleChannelCount}`,
    missingChannelCount > 0 ? `未标明 ${missingChannelCount}` : '',
    ...topCombos.map(([label, count]) => `交叉 ${label} ${count}`),
    '本地摘要',
  ].filter(Boolean);

  return {
    title: '证据通道交叉回执',
    summary,
    detail:
      '这是已返回证据的本地交叉支持摘要；多通道命中只说明同一证据被多条检索路径找回，不等于事实已确认，也不会重新召回、重排、写反馈或写入记忆。',
    tone: multiChannelCount > 0 ? 'info' : 'warning',
    metrics,
  };
}

function normalizeResultCount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.floor(value))
    : 0;
}

function normalizeTypeFilterKey(value: unknown): string {
  return typeof value === 'string' && value.trim() ? value.trim() : 'all';
}

function normalizeTypeFilterName(value: unknown, key: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : key;
}

function getSearchModeLabel(input: {
  mode?: unknown;
  entityTypeLabel?: unknown;
}): string {
  if (input.mode === 'overview') return 'Ask 智能搜索';
  const entityTypeLabel =
    typeof input.entityTypeLabel === 'string' && input.entityTypeLabel.trim()
      ? input.entityTypeLabel.trim()
      : '';
  return entityTypeLabel ? `实体搜索 ${entityTypeLabel}` : '记忆搜索';
}

export function formatSearchResultBatchReceipt(
  input: SearchResultBatchReceiptInput,
): SearchResultBatchReceiptView | null {
  const totalCount = normalizeResultCount(input.totalCount);
  const visibleCount = Math.min(normalizeResultCount(input.visibleCount), totalCount);
  if (totalCount <= 0 || visibleCount <= 0) return null;

  const query = compactEmptySearchText(input.query, 64);
  if (!query) return null;

  const selectedFilter = normalizeTypeFilterKey(input.selectedTypeFilter);
  const selectedLabel =
    selectedFilter === 'all'
      ? '全部类型'
      : normalizeTypeFilterName(input.selectedTypeLabel, selectedFilter);
  const isFiltered = selectedFilter !== 'all' && visibleCount < totalCount;
  const diagnostics = formatRecallChannelDiagnostics(input.channelDiagnostics);
  const hitCount = diagnostics.filter(
    (diagnostic) => diagnostic.status === 'hit',
  ).length;
  const failedOrSkippedCount = diagnostics.filter(
    (diagnostic) =>
      diagnostic.status === 'failed' || diagnostic.status === 'skipped',
  ).length;
  const modeLabel = getSearchModeLabel(input);
  const scopeLabel = getScopeLabel(input.scope);
  const basis = isFiltered
    ? `当前${selectedLabel}可见 ${visibleCount}/${totalCount} 条`
    : `当前 ${totalCount} 条`;

  return {
    title: '结果批次回执',
    detail: `${basis}卡片绑定查询“${query}”、${scopeLabel}和${modeLabel}；这是 Memory Service 已返回结果的页面批次基准，类型筛选只收窄这批结果，不会重新召回、重排、同步外部来源或确认事实。反馈按钮仍按卡片上的反馈范围单独写入。`,
    tone: failedOrSkippedCount > 0 || isFiltered ? 'warning' : 'info',
    metrics: [
      `查询 ${query}`,
      `范围 ${scopeLabel}`,
      modeLabel,
      isFiltered ? `可见 ${visibleCount}/${totalCount}` : `结果 ${totalCount}`,
      diagnostics.length > 0
        ? `通道 ${hitCount}/${diagnostics.length} 命中`
        : '通道未返回',
      '批次只读',
    ],
  };
}

export function formatTypeFilterChipHint(
  input: TypeFilterChipHintInput,
): string {
  const key = normalizeTypeFilterKey(input.key);
  const selectedTypeFilter = normalizeTypeFilterKey(input.selectedTypeFilter);
  const totalCount = normalizeResultCount(input.totalCount);
  const visibleCount = Math.min(normalizeResultCount(input.count), totalCount);

  if (totalCount <= 0) return '暂无结果';

  if (key === 'all') {
    return selectedTypeFilter === 'all'
      ? `当前显示 ${totalCount} 条`
      : `显示全部 ${totalCount} 条`;
  }

  if (selectedTypeFilter === key) {
    return `当前显示 ${visibleCount}/${totalCount} 条`;
  }

  const hiddenCount = Math.max(0, totalCount - visibleCount);
  return hiddenCount > 0
    ? `点击显示 ${visibleCount}/${totalCount} · 隐藏 ${hiddenCount}`
    : `点击显示 ${visibleCount} 条`;
}

export function formatTypeFilterChipAriaLabel(
  input: TypeFilterChipHintInput,
): string {
  const key = normalizeTypeFilterKey(input.key);
  const name = normalizeTypeFilterName(input.name, key);
  const hint = formatTypeFilterChipHint(input);
  return `${name}类型筛选：${hint}；本地筛选，不会重新召回、重排或写反馈。`;
}

export function formatTypeFilterReceipt(
  input: TypeFilterReceiptInput,
): TypeFilterReceiptView | null {
  const selectedFilter =
    typeof input.selectedTypeFilter === 'string'
      ? input.selectedTypeFilter.trim()
      : '';
  if (!selectedFilter || selectedFilter === 'all') return null;

  const totalCount = normalizeResultCount(input.totalCount);
  const visibleCount = Math.min(normalizeResultCount(input.visibleCount), totalCount);
  if (totalCount <= 0 || visibleCount === totalCount) return null;

  const label =
    typeof input.selectedTypeLabel === 'string' && input.selectedTypeLabel.trim()
      ? input.selectedTypeLabel.trim()
      : selectedFilter;
  const hiddenCount = Math.max(0, totalCount - visibleCount);
  const hasVisibleResults = visibleCount > 0;

  return {
    title: hasVisibleResults ? '类型筛选回执' : '类型筛选无可见结果',
    detail: hasVisibleResults
      ? `当前仅显示${label}类型 ${visibleCount}/${totalCount} 条；这是本页本地类型筛选，不会重新召回、重排、写反馈或隐藏服务端结果。`
      : `当前${label}类型没有可见结果；原始搜索仍返回 ${totalCount} 条，清除类型筛选即可恢复。`,
    tone: hasVisibleResults ? 'info' : 'warning',
    metrics: [
      `筛选 ${label}`,
      `已隐藏 ${hiddenCount}`,
      '本地筛选',
    ],
  };
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
  if (hasUnsafeDecodedExploreRouteCharacters(value)) return null;
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

function hasUnsafeDecodedExploreRouteCharacters(value: string): boolean {
  try {
    const decodedValue = decodeURIComponent(value);
    if (UNSAFE_EXPLORE_ROUTE_DECODED_VISIBLE_CHARS_PATTERN.test(decodedValue)) {
      return true;
    }
    for (const char of decodedValue) {
      const code = char.charCodeAt(0);
      if (code < 32 || code === 127) return true;
    }
    return false;
  } catch (_error) {
    return true;
  }
}

export function normalizeMemorySourceUrl(rawUrl?: unknown): string | null {
  if (typeof rawUrl !== 'string') return null;
  const value = rawUrl.trim();
  if (!/^https?:\/\//i.test(value)) return null;

  try {
    const parsed = new URL(value);
    if (!SAFE_SOURCE_PROTOCOLS.has(parsed.protocol)) return null;
    if (parsed.username || parsed.password) return null;
    if (hasSensitiveSourceQueryParam(parsed)) return null;
    return parsed.href;
  } catch (_error) {
    return null;
  }
}

function getMemorySourceUrlBlockLabel(rawUrl: string): string {
  const value = rawUrl.trim();
  if (!value) return '来源链接已隐藏：仅支持 http/https';

  try {
    const parsed = new URL(value);
    if (!SAFE_SOURCE_PROTOCOLS.has(parsed.protocol)) {
      return '来源链接已隐藏：仅支持 http/https';
    }
    if (parsed.username || parsed.password) {
      return '来源链接已隐藏：包含账号信息';
    }
    if (hasSignedSourceQueryParam(parsed)) {
      return '来源链接已隐藏：包含签名或访问凭据参数';
    }
    if (hasSensitiveSourceQueryParam(parsed)) {
      return '来源链接已隐藏：包含敏感参数';
    }
  } catch (_error) {
    return '来源链接已隐藏：仅支持 http/https';
  }

  return '来源链接已隐藏：仅支持 http/https';
}

function hasSensitiveSourceQueryParam(url: URL): boolean {
  for (const key of Array.from(url.searchParams.keys())) {
    if (
      SENSITIVE_SOURCE_QUERY_PARAM_NAMES.has(normalizeSourceQueryParamName(key))
    ) {
      return true;
    }
  }
  return false;
}

function normalizeSourceQueryParamName(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
}

function hasSignedSourceQueryParam(url: URL): boolean {
  for (const key of Array.from(url.searchParams.keys())) {
    const normalized = normalizeSourceQueryParamName(key);
    if (
      normalized === 'sig' ||
      normalized === 'signature' ||
      normalized === 'awsaccesskeyid' ||
      normalized === 'googleaccessid' ||
      normalized === 'sharedaccesssignature' ||
      normalized.startsWith('x_amz_') ||
      normalized.startsWith('x_goog_')
    ) {
      return true;
    }
  }
  return false;
}

function compactSourceCoverageLabel(value: string): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= MAX_SOURCE_COVERAGE_LABEL_LENGTH) {
    return normalized;
  }
  return `${normalized.slice(0, MAX_SOURCE_COVERAGE_LABEL_LENGTH - 1)}…`;
}

function getSearchResultSourceLabel(result: MemorySearchResultLike): string {
  if (typeof result.sourceTitle === 'string' && result.sourceTitle.trim()) {
    return compactSourceCoverageLabel(result.sourceTitle);
  }
  if (typeof result.source === 'string' && result.source.trim()) {
    return compactSourceCoverageLabel(result.source);
  }

  const sourceUrl = normalizeMemorySourceUrl(result.sourceUrl);
  if (sourceUrl) {
    try {
      return compactSourceCoverageLabel(new URL(sourceUrl).host);
    } catch (_error) {
      // Fall through to the explicit unknown bucket.
    }
  }

  return '未标明来源';
}

function normalizeSearchResults(value: unknown): MemorySearchResultLike[] {
  return Array.isArray(value)
    ? value.filter(
        (result): result is MemorySearchResultLike =>
          Boolean(result && typeof result === 'object'),
      )
    : [];
}

function countSearchResultSources(results: MemorySearchResultLike[]): {
  label: string;
  count: number;
}[] {
  const sourceCounts = new Map<string, number>();
  for (const result of results) {
    const label = getSearchResultSourceLabel(result);
    sourceCounts.set(label, (sourceCounts.get(label) || 0) + 1);
  }

  return Array.from(sourceCounts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => {
      if (right.count !== left.count) return right.count - left.count;
      return left.label.localeCompare(right.label, 'zh-Hans-CN');
    });
}

export function formatSourceCoverageReceipt(
  input: SourceCoverageReceiptInput,
): SourceCoverageReceiptView | null {
  const visibleResults = normalizeSearchResults(input.visibleResults);
  const totalResults = normalizeSearchResults(input.totalResults);
  const visibleCount = visibleResults.length;
  const totalCount = totalResults.length || visibleCount;
  if (totalCount <= 1 || visibleCount <= 0) return null;

  const sourceCounts = countSearchResultSources(visibleResults);
  const sourceCount = sourceCounts.length;
  const topSource = sourceCounts[0];
  const selectedFilter =
    typeof input.selectedTypeFilter === 'string'
      ? input.selectedTypeFilter.trim()
      : '';
  const selectedLabel =
    typeof input.selectedTypeLabel === 'string' && input.selectedTypeLabel.trim()
      ? input.selectedTypeLabel.trim()
      : selectedFilter;
  const isFiltered =
    Boolean(selectedFilter && selectedFilter !== 'all') &&
    visibleCount < totalCount;
  const basis = isFiltered
    ? `当前${selectedLabel}可见 ${visibleCount}/${totalCount} 条`
    : `当前 ${visibleCount} 条`;

  if (sourceCount <= 1 && topSource) {
    return {
      title: '来源覆盖回执',
      detail: `${basis}结果都来自 ${topSource.label}；这只说明本轮召回和本地筛选的来源分布，不代表其他来源没有相关记忆。查看或打开来源不会重新同步、写反馈或确认事实。`,
      tone: visibleCount > 1 ? 'warning' : 'info',
      metrics: [
        '来源 1',
        `Top ${topSource.label} ${topSource.count}`,
        isFiltered ? `可见 ${visibleCount}/${totalCount}` : `结果 ${visibleCount}`,
        '本地摘要',
      ],
    };
  }

  return {
    title: '来源覆盖回执',
    detail: `${basis}结果覆盖 ${sourceCount} 个来源/标题；这是本页对已返回结果的本地来源摘要，不会重新读取来源、刷新连接器、写反馈或确认事实。`,
    tone: 'info',
    metrics: [
      `来源 ${sourceCount}`,
      topSource ? `Top ${topSource.label} ${topSource.count}` : '',
      isFiltered ? `可见 ${visibleCount}/${totalCount}` : `结果 ${visibleCount}`,
      '本地摘要',
    ].filter(Boolean),
  };
}

function compactEmptySearchText(value: unknown, maxLength = 72): string {
  const text = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
  if (!text) return '';
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

export function formatEmptySearchReceipt(
  input: EmptySearchReceiptInput,
): EmptySearchReceiptView | null {
  if (normalizeResultCount(input.resultCount) > 0) return null;

  const query = compactEmptySearchText(input.query, 80);
  if (!query) return null;

  const diagnostics = formatRecallChannelDiagnostics(input.channelDiagnostics);
  const hitCount = diagnostics.filter(
    (diagnostic) => diagnostic.status === 'hit',
  ).length;
  const failedCount = diagnostics.filter(
    (diagnostic) => diagnostic.status === 'failed',
  ).length;
  const skippedCount = diagnostics.filter(
    (diagnostic) => diagnostic.status === 'skipped',
  ).length;
  const emptyCount = diagnostics.filter(
    (diagnostic) => diagnostic.status === 'empty',
  ).length;
  const scopeLabel = getScopeLabel(input.scope);
  const mode =
    input.mode === 'overview'
      ? 'Ask 智能搜索'
      : compactEmptySearchText(input.entityTypeLabel, 32)
      ? `实体搜索 ${compactEmptySearchText(input.entityTypeLabel, 32)}`
      : '记忆搜索';
  const source =
    input.source === 'ask' ? 'Ask 证据搜索' : '记忆召回';
  const sourcePhrase = input.source === 'ask' ? ` ${source}` : source;
  const hasDiagnostics = diagnostics.length > 0;
  const isAllScope = input.scope === 'all' || input.scope === 'both';
  const metrics = [
    `范围 ${scopeLabel}`,
    mode,
    hasDiagnostics
      ? `通道 ${hitCount}/${diagnostics.length} 命中`
      : '通道未返回',
    failedCount > 0 ? `失败 ${failedCount}` : '',
    skippedCount > 0 ? `未运行 ${skippedCount}` : '',
    emptyCount > 0 ? `无命中 ${emptyCount}` : '',
    '无写入',
  ].filter(Boolean);

  return {
    title: '真实空结果回执',
    detail: hasDiagnostics
      ? `Memory Service 已完成${sourcePhrase}，但当前${scopeLabel}没有返回可展示结果；空结果只代表本轮查询和已返回通道没有命中，不会写入、删除、同步外部来源、刷新连接器、写反馈或确认事实。`
      : `Memory Service 已完成${sourcePhrase}，但没有返回可展示结果或通道诊断；这不是模拟结果，也不会写入、删除、同步外部来源、刷新连接器、写反馈或确认事实。`,
    tone: failedCount > 0 || skippedCount > 0 ? 'warning' : 'info',
    metrics,
    recoveryActions: [
      isAllScope ? '' : '可用同一关键词扩展到全部记忆。',
      '可换更具体的人名、项目名、时间或来源词重新搜索。',
      '如果相关内容刚导入或刚保存，等索引完成后再搜；本页不会主动刷新连接器。',
    ].filter(Boolean),
  };
}

function compactSearchResultTargetTitle(value: unknown): string {
  const normalized =
    typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
  if (!normalized) return '当前结果';
  return normalized.length > 96 ? `${normalized.slice(0, 95)}…` : normalized;
}

export function buildMemoryOpenReceipt(
  input: MemoryOpenReceiptInput,
): MemoryOpenReceipt {
  const targetTitle = compactSearchResultTargetTitle(input.resultTitle);
  const blockedLabels = Array.from(
    new Set(
      (input.blockedLabels || [])
        .map((label) => label.replace(/\s+/g, ' ').trim())
        .filter(Boolean),
    ),
  );

  if (input.action === 'memory_route') {
    return {
      title: '打开动作回执',
      tone: 'info',
      items: [
        `目标：${targetTitle}。`,
        `记忆内跳转：已进入 ${input.exploreRoute || '#/search'}；这次不会打开外部网页。`,
        '边界：只切换 Memory Exploring 内部视图，不会改写记忆、反馈或来源资料。',
      ],
    };
  }

  if (input.action === 'source_url') {
    return {
      title: '打开动作回执',
      tone: 'info',
      items: [
        `目标：${targetTitle}。`,
        `来源：已请求浏览器打开 ${input.sourceHost || '安全 http/https 来源'}。`,
        '边界：来源页在新标签打开，不代表 Memory Service 重新读取、同步或确认了来源内容。',
      ],
    };
  }

  if (input.action === 'blocked' && blockedLabels.length > 0) {
    return {
      title: '打开动作回执',
      tone: 'warning',
      items: [
        `目标：${targetTitle}。`,
        `拦截：${blockedLabels.join('；')}。`,
        '恢复：可先阅读当前卡片、搜索词和命中通道；需要原文时等待上游写入安全 http/https 来源或安全记忆内路由。',
      ],
    };
  }

  return {
    title: '打开动作回执',
    tone: 'warning',
    items: [
      `目标：${targetTitle}。`,
      '结果：当前结果没有可打开的安全内链、详情页或 http/https 来源。',
      '恢复：可切换范围或关键词，或从时间轴/来源系统重新定位相关证据。',
    ],
  };
}

function getSearchResultDiagnosticTitle(result: MemorySearchResultLike): string {
  const record = result as Record<string, unknown>;
  return compactSearchResultTargetTitle(
    record.name ||
      record.displayTitle ||
      record.sourceTitle ||
      record.description ||
      record.id,
  );
}

export function buildMemoryLinkRecoveryDiagnostic(
  input: MemoryLinkRecoveryDiagnosticInput,
): string {
  const blockedLabels = Array.from(
    new Set(
      (input.blockedLabels || [])
        .map((label) => label.replace(/\s+/g, ' ').trim())
        .filter(Boolean),
    ),
  );
  const reasonText =
    blockedLabels.length > 0
      ? blockedLabels.join('；')
      : '没有安全记忆内路由、详情页或 http/https 来源';
  const lines = [
    'Personal AI 搜索结果链接安全诊断',
    `目标：${getSearchResultDiagnosticTitle(input.result)}`,
    `结果键：${getSearchResultKey(input.result)}`,
    `查询：${input.queryLabel || '当前搜索'}`,
    `范围：${input.scopeLabel || '当前范围'}`,
    `模式：${input.modeLabel || '当前搜索模式'}`,
    `类型筛选：${input.typeFilterLabel || '当前类型筛选'}`,
    `来源标签：${getSearchResultSourceLabel(input.result)}`,
    `拦截/状态：${reasonText}`,
    '边界：此诊断没有复制被拦截的原始 URL 或内部 route；复制本身不会写入、同步、确认或重新读取来源。',
  ];

  return lines.join('\n');
}

export function buildMemoryLinkRecoveryCopiedReceipt(
  input: Pick<MemoryOpenReceiptInput, 'resultTitle'>,
): MemoryOpenReceipt {
  return {
    title: '安全诊断复制回执',
    tone: 'info',
    items: [
      `目标：${compactSearchResultTargetTitle(input.resultTitle)}。`,
      '结果：已复制搜索结果链接安全诊断，可粘贴到搜索、工单或手动排查路径继续找原文。',
      '边界：复制内容只包含标题、搜索条件、范围、结果 key、来源标签和拦截原因；不包含被拦截的原始 URL，也不会写入、同步或确认记忆。',
    ],
  };
}

export function buildMemoryLinkRecoveryCopyFailureReceipt(
  input: Pick<MemoryOpenReceiptInput, 'resultTitle'>,
): MemoryOpenReceipt {
  return {
    title: '安全诊断复制回执',
    tone: 'warning',
    items: [
      `目标：${compactSearchResultTargetTitle(input.resultTitle)}。`,
      '结果：浏览器没有允许写入剪贴板。',
      '恢复：可手动复制卡片标题、搜索词、范围、来源标签和拦截原因；本次没有外发、写入、同步或确认记忆。',
    ],
  };
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
    blockedLabels.push(getMemorySourceUrlBlockLabel(rawSourceUrl));
  }

  return {
    exploreRoute,
    sourceUrl,
    sourceHost: getMemorySourceHost(sourceUrl),
    blockedLabels,
  };
}

export function formatMemoryLinkSafetyStatus(
  state: MemoryLinkSafetyState,
): MemoryLinkSafetyStatusView {
  const blockedLabels = Array.from(
    new Set(state.blockedLabels.map((label) => label.trim()).filter(Boolean)),
  );

  if (state.exploreRoute) {
    const metrics = ['记忆内跳转'];
    if (state.sourceHost) {
      metrics.push(`来源 ${state.sourceHost}`);
    }
    return {
      label: '可在记忆中查看',
      detail:
        '点击卡片会优先进入支持的 Memory Exploring 内部视图，不会打开外部网页或改写记忆。',
      tone: 'ready',
      metrics,
    };
  }

  if (state.sourceUrl) {
    return {
      label: '可打开安全来源',
      detail: `来源 host：${state.sourceHost || 'http/https'}；新标签打开，不代表重新同步或确认来源内容。`,
      tone: 'ready',
      metrics: ['http/https', '无凭据参数'],
    };
  }

  if (blockedLabels.length > 0) {
    return {
      label: '来源或跳转已隐藏',
      detail: `${blockedLabels.join('；')}。当前卡片仍可阅读，需要原文时等待上游写入安全来源或记忆内路由。`,
      tone: 'warning',
      metrics: ['安全拦截', `${blockedLabels.length} 项原因`],
    };
  }

  return {
    label: '暂无可打开目标',
    detail:
      '这条结果没有安全记忆内路由或 http/https 来源；可先阅读卡片内容，或调整搜索/时间范围重新定位。',
    tone: 'muted',
    metrics: ['只读卡片'],
  };
}

export function shouldResetTypeFilter(
  selectedTypeFilter: string,
  availableTypes: SearchResultTypeOption[],
): boolean {
  if (!availableTypes.length || selectedTypeFilter === 'all') return false;
  return !availableTypes.some((type) => type.key === selectedTypeFilter);
}
