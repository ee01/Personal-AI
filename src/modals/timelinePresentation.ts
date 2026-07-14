import type { RecallItem, RecallScope } from '../services/MemoryServiceClient';

export type TimelineRange = 'today' | 'recent';
export type TimelineFocusType = 'message' | 'chunk';

export interface MemoryTimelineEvent {
  id: string;
  resultKey: string;
  type: RecallItem['type'];
  title: string;
  content: string;
  timestamp?: number;
  source?: string;
  sourceUrl?: string;
  sourceTitle?: string;
  scope?: RecallItem['scope'];
  exploreLink?: string;
  channels: string[];
  feedbackAction?: 'positive' | 'negative';
}

export interface TimelineDayGroup {
  key: string;
  label: string;
  summary: string;
  events: MemoryTimelineEvent[];
}

export interface TimelineSourceFilterOption {
  key: string;
  label: string;
  count: number;
}

export interface TimelineBoundaryReceiptInput {
  scope: RecallScope;
  rangeLabel: string;
  sourceFilterKey: string;
  sourceFilterLabel: string;
  totalEventCount: number;
  visibleEventCount: number;
  hasFocusedEvent?: boolean;
  isLoading?: boolean;
}

export interface TimelineBoundaryReceipt {
  title: string;
  items: string[];
}

export interface TimelineEmptyReceiptInput {
  scope: RecallScope;
  rangeLabel: string;
  sourceFilterKey: string;
  sourceFilterLabel: string;
  totalEventCount: number;
  visibleEventCount: number;
}

export interface TimelineEmptyReceipt {
  title: string;
  items: string[];
}

export type TimelineNavigationReceiptTone = 'info' | 'warning';

export interface TimelineNavigationReceiptInput {
  action:
    | 'memory_route'
    | 'source_url_ready'
    | 'source_url'
    | 'blocked'
    | 'unavailable';
  eventTitle?: string;
  exploreRoute?: string;
  sourceHost?: string;
  blockedLabels?: string[];
}

export interface TimelineNavigationReceipt {
  title: string;
  tone: TimelineNavigationReceiptTone;
  items: string[];
}

export interface TimelineLinkRecoveryDiagnosticInput {
  event: MemoryTimelineEvent;
  blockedLabels?: string[];
  scopeLabel?: string;
  rangeLabel?: string;
  sourceFilterLabel?: string;
}

export interface TimelineRefreshFailureReceiptInput {
  scope: RecallScope;
  rangeLabel: string;
  sourceFilterLabel: string;
  totalEventCount: number;
  visibleEventCount: number;
  errorMessage?: string;
}

export interface TimelineRefreshFailureReceipt {
  title: string;
  items: string[];
}

export interface TimelineRefreshingSnapshotReceiptInput {
  scope: RecallScope;
  rangeLabel: string;
  sourceFilterLabel: string;
  totalEventCount: number;
  visibleEventCount: number;
}

export interface TimelineRefreshingSnapshotReceipt {
  title: string;
  items: string[];
}

export type TimelineFeedbackReceiptStatus =
  | 'pending'
  | 'success'
  | 'cleared'
  | 'failure';

export type TimelineFeedbackReceiptAction = 'positive' | 'negative' | 'clear';

export type TimelineFeedbackReceiptTone = 'info' | 'success' | 'warning';

export interface TimelineFeedbackReceiptInput {
  status: TimelineFeedbackReceiptStatus;
  action: TimelineFeedbackReceiptAction;
  eventTitle?: string;
  targetType?: string;
  targetId?: string;
  scope: RecallScope;
  rangeLabel: string;
  sourceFilterLabel: string;
  errorMessage?: string;
}

export interface TimelineFeedbackReceipt {
  title: string;
  tone: TimelineFeedbackReceiptTone;
  items: string[];
}

export interface TimelineRangeControlBoundaryInput {
  rangeLabel: string;
  scope: RecallScope;
  isActive?: boolean;
}

export interface TimelineScopeControlBoundaryInput {
  scope: RecallScope;
  isActive?: boolean;
}

export interface TimelineSourceControlBoundaryInput {
  sourceFilterLabel: string;
  sourceCount?: number;
  totalEventCount: number;
  isAllSources?: boolean;
  isActive?: boolean;
}

export interface TimelineRefreshControlBoundaryInput {
  scope: RecallScope;
  rangeLabel: string;
  sourceFilterLabel: string;
}

export interface ParsedTimelineFocus {
  id: string;
  type?: TimelineFocusType;
  isLegacyTypedFocus: boolean;
}

export const ALL_TIMELINE_SOURCE_FILTER_KEY = 'all';
export const UNKNOWN_TIMELINE_SOURCE_FILTER_KEY = '__unknown_source__';

const MAX_TIMELINE_TEXT_LENGTH = 220;
const UNKNOWN_TIMELINE_DAY_KEY = 'unknown';

export function normalizeTimelineScope(
  value: unknown,
  fallback: RecallScope = 'all',
): RecallScope {
  return value === 'work' ||
    value === 'personal' ||
    value === 'both' ||
    value === 'all'
    ? value
    : fallback;
}

function normalizeTimelineFocusType(
  value: unknown,
): TimelineFocusType | undefined {
  const type = Array.isArray(value) ? value[0] : value;
  return type === 'message' || type === 'chunk' ? type : undefined;
}

export function parseTimelineFocus(
  rawFocus: unknown,
  rawType?: unknown,
): ParsedTimelineFocus {
  const rawValue = Array.isArray(rawFocus) ? rawFocus[0] : rawFocus;
  const focus = typeof rawValue === 'string' ? rawValue.trim() : '';
  const explicitType = normalizeTimelineFocusType(rawType);

  if (!focus) {
    return { id: '', type: explicitType, isLegacyTypedFocus: false };
  }

  if (explicitType) {
    return { id: focus, type: explicitType, isLegacyTypedFocus: false };
  }

  const separatorIndex = focus.indexOf(':');
  if (separatorIndex > 0) {
    const prefix = focus.slice(0, separatorIndex);
    const id = focus.slice(separatorIndex + 1).trim();
    if ((prefix === 'message' || prefix === 'chunk') && id) {
      return { id, type: prefix, isLegacyTypedFocus: true };
    }
  }

  return { id: focus, isLegacyTypedFocus: false };
}

export function getTimelineRangeSeconds(
  nowMs = Date.now(),
  range: TimelineRange = 'today',
  rangeDays = 1,
): { start: number; end: number } {
  const end = Math.floor(nowMs / 1000) + 60;

  if (range === 'today') {
    const startDate = new Date(nowMs);
    startDate.setHours(0, 0, 0, 0);
    return {
      start: Math.floor(startDate.getTime() / 1000),
      end,
    };
  }

  const safeDays = Math.min(
    Math.max(Number.isFinite(rangeDays) ? Math.floor(rangeDays) : 1, 1),
    30,
  );
  return {
    start: end - safeDays * 24 * 60 * 60,
    end,
  };
}

function getTimelineTimestampMs(timestamp: unknown): number | null {
  if (typeof timestamp !== 'number' || !Number.isFinite(timestamp)) {
    return null;
  }

  const eventMs = timestamp < 10_000_000_000 ? timestamp * 1000 : timestamp;
  return Number.isFinite(eventMs) ? eventMs : null;
}

export function getTimelineDateTimeValue(timestamp: unknown): string {
  const eventMs = getTimelineTimestampMs(timestamp);
  if (eventMs == null) return '';
  return new Date(eventMs).toISOString();
}

export function formatTimelineExactTime(timestamp: unknown): string {
  const eventMs = getTimelineTimestampMs(timestamp);
  if (eventMs == null) return '时间未知';

  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(eventMs));
}

export function formatTimelineClockTime(timestamp: unknown): string {
  const eventMs = getTimelineTimestampMs(timestamp);
  if (eventMs == null) return '时间未知';

  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(eventMs));
}

function getTimelineDayKey(timestamp: unknown): string {
  const eventMs = getTimelineTimestampMs(timestamp);
  if (eventMs == null) return UNKNOWN_TIMELINE_DAY_KEY;

  const date = new Date(eventMs);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function startOfLocalDayMs(value: number): number {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function formatTimelineDayLabel(key: string, nowMs: number): string {
  if (key === UNKNOWN_TIMELINE_DAY_KEY) return '时间未知';

  const [yearText, monthText, dayText] = key.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return '时间未知';

  const dayDistance = Math.round(
    (startOfLocalDayMs(nowMs) - startOfLocalDayMs(date.getTime())) / 86_400_000,
  );
  const dateLabel = new Intl.DateTimeFormat('zh-CN', {
    year:
      date.getFullYear() === new Date(nowMs).getFullYear()
        ? undefined
        : 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  }).format(date);

  if (dayDistance === 0) return `今天 · ${dateLabel}`;
  if (dayDistance === 1) return `昨天 · ${dateLabel}`;
  return dateLabel;
}

function buildTimelineGroupSummary(events: MemoryTimelineEvent[]): string {
  const sourceNames = events
    .map((event) => event.sourceTitle || event.source)
    .filter((value): value is string => Boolean(value))
    .map((value) => value.trim())
    .filter(Boolean);
  const allUniqueSources = Array.from(new Set(sourceNames));
  const uniqueSources = allUniqueSources.slice(0, 3);
  const sourceSummary =
    uniqueSources.length > 0
      ? ` · ${uniqueSources.join('、')}${
          allUniqueSources.length > uniqueSources.length ? ' 等' : ''
        }`
      : '';
  return `${events.length} 条记忆${sourceSummary}`;
}

export function getTimelineSourceFilterKey(
  event: Pick<MemoryTimelineEvent, 'source' | 'sourceTitle'>,
): string {
  const source = (event.sourceTitle || event.source || '').trim();
  return source || UNKNOWN_TIMELINE_SOURCE_FILTER_KEY;
}

function getTimelineSourceFilterLabel(key: string): string {
  return key === UNKNOWN_TIMELINE_SOURCE_FILTER_KEY ? '来源未知' : key;
}

export function buildTimelineSourceFilterOptions(
  events: MemoryTimelineEvent[],
): TimelineSourceFilterOption[] {
  const counts = new Map<string, number>();

  for (const event of events) {
    const key = getTimelineSourceFilterKey(event);
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([key, count]) => ({
      key,
      label: getTimelineSourceFilterLabel(key),
      count,
    }))
    .sort(
      (left, right) =>
        right.count - left.count || left.label.localeCompare(right.label),
    );
}

export function filterTimelineEventsBySource(
  events: MemoryTimelineEvent[],
  sourceFilterKey: string,
): MemoryTimelineEvent[] {
  if (
    !sourceFilterKey ||
    sourceFilterKey === ALL_TIMELINE_SOURCE_FILTER_KEY
  ) {
    return events;
  }

  return events.filter(
    (event) => getTimelineSourceFilterKey(event) === sourceFilterKey,
  );
}

function getTimelineReceiptScopeLabel(scope: RecallScope): string {
  if (scope === 'work') return '工作';
  if (scope === 'personal') return '个人';
  return '全部';
}

const TIMELINE_CONTROL_NO_SIDE_EFFECTS =
  '不会写入、删除、写反馈、同步来源或确认事实。';

function getTimelineReceiptScopeReadLabel(scope: RecallScope): string {
  if (scope === 'work') return '工作记忆';
  if (scope === 'personal') return '个人记忆';
  return '全部记忆';
}

function normalizeTimelineCount(value: unknown): number {
  return Math.max(0, Number.isFinite(Number(value)) ? Number(value) : 0);
}

export function buildTimelineRangeControlBoundary(
  input: TimelineRangeControlBoundaryInput,
): string {
  const scopeReadLabel = getTimelineReceiptScopeReadLabel(input.scope);
  if (input.isActive) {
    return `${input.rangeLabel}；当前时间范围已选中，再次点击不会重新请求；切换其他时间范围才会通过 time 通道重新读取${scopeReadLabel}。${TIMELINE_CONTROL_NO_SIDE_EFFECTS}`;
  }
  return `${input.rangeLabel}；切换后会通过 time 通道重新读取${scopeReadLabel}的${input.rangeLabel}窗口并替换当前列表；失败不会把旧范围当成空结果，也${TIMELINE_CONTROL_NO_SIDE_EFFECTS}`;
}

export function buildTimelineScopeControlBoundary(
  input: TimelineScopeControlBoundaryInput,
): string {
  const scopeLabel = getTimelineReceiptScopeLabel(input.scope);
  const scopeReadLabel = getTimelineReceiptScopeReadLabel(input.scope);
  if (input.isActive) {
    return `${scopeLabel}；当前记忆范围已选中，再次点击不会重新请求；切换其他范围才会更新本页时间轴 scope/query 并重新读取。${TIMELINE_CONTROL_NO_SIDE_EFFECTS}`;
  }
  return `${scopeLabel}；切换后只更新本页时间轴 scope/query，并通过 time 通道重新读取${scopeReadLabel}；不会改变全局偏好，也${TIMELINE_CONTROL_NO_SIDE_EFFECTS}`;
}

export function buildTimelineSourceControlBoundary(
  input: TimelineSourceControlBoundaryInput,
): string {
  const totalCount = normalizeTimelineCount(input.totalEventCount);
  const sourceCount = normalizeTimelineCount(input.sourceCount);
  const sourceLabel = input.sourceFilterLabel || '当前来源';

  if (input.isAllSources) {
    if (input.isActive) {
      return `全部来源；当前显示全部 ${totalCount} 条已加载时间轴记忆，再次选择只保持本批结果，不重新请求 Memory Service。${TIMELINE_CONTROL_NO_SIDE_EFFECTS}`;
    }
    return `全部来源；切回全部 ${totalCount} 条已加载时间轴记忆，只恢复本地隐藏项，不重新请求 Memory Service。${TIMELINE_CONTROL_NO_SIDE_EFFECTS}`;
  }

  if (input.isActive) {
    return `${sourceLabel} ${sourceCount}；当前只显示本批已加载结果中的这个来源，再次选择不会重新请求 Memory Service。${TIMELINE_CONTROL_NO_SIDE_EFFECTS}`;
  }

  return `${sourceLabel} ${sourceCount}；切换后只显示本批已加载 ${totalCount} 条中的 ${sourceCount} 条，并临时隐藏其他来源；不重新请求 Memory Service。${TIMELINE_CONTROL_NO_SIDE_EFFECTS}`;
}

export function buildTimelineRefreshControlBoundary(
  input: TimelineRefreshControlBoundaryInput,
): string {
  const scopeLabel = getTimelineReceiptScopeLabel(input.scope);
  return `刷新；重新读取 ${scopeLabel} · ${input.rangeLabel} 时间轴，当前来源筛选 ${input.sourceFilterLabel} 会应用到新结果；同范围刷新中保留上次快照，失败不会当作空结果。${TIMELINE_CONTROL_NO_SIDE_EFFECTS}`;
}

export function buildTimelineBoundaryReceipt(
  input: TimelineBoundaryReceiptInput,
): TimelineBoundaryReceipt {
  const scopeLabel = getTimelineReceiptScopeLabel(input.scope);
  const visibleCount = Math.max(0, input.visibleEventCount);
  const totalCount = Math.max(0, input.totalEventCount);
  const hiddenBySourceCount = Math.max(0, totalCount - visibleCount);
  const items: string[] = [];

  if (input.scope === 'work') {
    items.push('范围：只读取工作记忆；个人记忆没有进入本次时间轴。');
  } else if (input.scope === 'personal') {
    items.push('范围：只读取个人记忆；工作记忆没有进入本次时间轴。');
  } else {
    items.push('范围：读取全部记忆；卡片仍保留工作/个人标签。');
  }

  items.push(
    `时间：通过 time 通道请求${input.rangeLabel}窗口，结果按记忆时间分组。`,
  );

  if (
    input.sourceFilterKey &&
    input.sourceFilterKey !== ALL_TIMELINE_SOURCE_FILTER_KEY
  ) {
    items.push(
      `来源：当前只显示 ${input.sourceFilterLabel} 的 ${visibleCount} 条，隐藏 ${hiddenBySourceCount} 条其他来源；切回全部来源可恢复。`,
    );
  } else if (input.isLoading) {
    items.push('来源：正在加载当前窗口，来源筛选会在本批结果内收窄。');
  } else {
    items.push(
      `来源：当前展示 ${totalCount} 条已加载结果；来源筛选只收窄本批结果，不会扩大检索范围。`,
    );
  }

  if (input.hasFocusedEvent) {
    items.push(
      '定位：目标记忆已置顶；它可能来自当前时间窗或来源筛选之外，请按“定位目标”标记判断。',
    );
  }

  return {
    title: `${scopeLabel} · ${input.rangeLabel} · 时间轴回执`,
    items,
  };
}

export function buildTimelineEmptyReceipt(
  input: TimelineEmptyReceiptInput,
): TimelineEmptyReceipt {
  const scopeLabel = getTimelineReceiptScopeLabel(input.scope);
  const totalCount = Math.max(0, input.totalEventCount);
  const visibleCount = Math.max(0, input.visibleEventCount);
  const hiddenBySourceCount = Math.max(0, totalCount - visibleCount);
  const isSourceFiltered =
    input.sourceFilterKey &&
    input.sourceFilterKey !== ALL_TIMELINE_SOURCE_FILTER_KEY &&
    totalCount > 0;

  if (isSourceFiltered) {
    return {
      title: '来源筛选空结果回执',
      items: [
        `结果：本批 ${scopeLabel} · ${input.rangeLabel} 已成功读取 ${totalCount} 条，但 ${input.sourceFilterLabel} 下当前可见 ${visibleCount} 条。`,
        '边界：这是本地来源筛选后的 successful empty；没有删除记忆、标记已读、写入反馈或重新同步来源。',
        `恢复：切回全部来源可显示被隐藏的 ${hiddenBySourceCount} 条，也可以切换时间窗口重新请求。`,
      ],
    };
  }

  return {
    title: '时间轴空结果回执',
    items: [
      `结果：本次 ${scopeLabel} · ${input.rangeLabel} 时间轴读取成功，Memory Service 返回 0 条可展示记忆。`,
      '边界：这是 successful empty，不是刷新失败；没有删除记忆、清空索引、写入反馈或同步来源。',
      '恢复：可以切换时间窗口或记忆范围后重新请求；新消息、网页、会议或手动记录写入后才会出现在这里。',
    ],
  };
}

function compactNavigationTargetTitle(value: unknown): string {
  const normalized =
    typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
  return normalized ? truncateTimelineText(normalized).slice(0, 96) : '这条记忆';
}

export function buildTimelineNavigationReceipt(
  input: TimelineNavigationReceiptInput,
): TimelineNavigationReceipt {
  const targetTitle = compactNavigationTargetTitle(input.eventTitle);
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
        `记忆内跳转：已进入 ${input.exploreRoute || '#/timeline'}；这次不会打开外部网页。`,
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

  if (input.action === 'source_url_ready') {
    return {
      title: '外部来源确认回执',
      tone: 'info',
      items: [
        `目标：${targetTitle}。`,
        `来源：这条记忆有可打开的 ${input.sourceHost || '安全 http/https 来源'}；请使用卡片里的“打开来源”按钮继续。`,
        '边界：卡片点击只展示打开边界，不会打开外部标签页、重新读取来源、同步外部系统、写入反馈或确认内容。',
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
        '恢复：可先阅读当前卡片和日期/来源上下文；需要原文时等待上游写入安全 http/https 来源或安全记忆内路由。',
      ],
    };
  }

  return {
    title: '打开动作回执',
    tone: 'warning',
    items: [
      `目标：${targetTitle}。`,
      '结果：这条时间轴记忆没有可打开的安全内链或 http/https 来源。',
      '恢复：可切换时间范围、来源筛选或从搜索页重新定位相关证据。',
    ],
  };
}

function getTimelineDiagnosticSourceLabel(event: MemoryTimelineEvent): string {
  const sourceLabel = compactNavigationTargetTitle(
    event.sourceTitle || event.source || '',
  );
  return sourceLabel === '这条记忆' ? '未标明来源' : sourceLabel;
}

export function buildTimelineLinkRecoveryDiagnostic(
  input: TimelineLinkRecoveryDiagnosticInput,
): string {
  const { event } = input;
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
      : '没有安全记忆内路由或 http/https 来源';
  const timeLabel = formatTimelineExactTime(event.timestamp);
  const lines = [
    'Personal AI 时间轴链接安全诊断',
    `目标：${compactNavigationTargetTitle(event.title)}`,
    `记忆键：${event.resultKey || `${event.type}:${event.id}`}`,
    `时间：${timeLabel}`,
    `范围：${input.scopeLabel || getTimelineReceiptScopeLabel(event.scope || 'all')}`,
    `来源标签：${getTimelineDiagnosticSourceLabel(event)}`,
    `当前筛选：${input.rangeLabel || '当前时间窗口'} · ${input.sourceFilterLabel || '当前来源筛选'}`,
    `拦截/状态：${reasonText}`,
    '边界：此诊断没有复制被拦截的原始 URL 或内部 route；复制本身不会写入、同步、确认或重新读取来源。',
  ];

  return lines.join('\n');
}

export function buildTimelineLinkRecoveryCopiedReceipt(
  input: Pick<TimelineNavigationReceiptInput, 'eventTitle'>,
): TimelineNavigationReceipt {
  return {
    title: '安全诊断复制回执',
    tone: 'info',
    items: [
      `目标：${compactNavigationTargetTitle(input.eventTitle)}。`,
      '结果：已复制时间轴链接安全诊断，可粘贴到搜索、工单或手动排查路径继续找原文。',
      '边界：复制内容只包含标题、时间、来源标签、记忆 key 和拦截原因；不包含被拦截的原始 URL，也不会写入、同步或确认记忆。',
    ],
  };
}

export function buildTimelineLinkRecoveryCopyFailureReceipt(
  input: Pick<TimelineNavigationReceiptInput, 'eventTitle'>,
): TimelineNavigationReceipt {
  return {
    title: '安全诊断复制回执',
    tone: 'warning',
    items: [
      `目标：${compactNavigationTargetTitle(input.eventTitle)}。`,
      '结果：浏览器没有允许写入剪贴板。',
      '恢复：可手动复制卡片标题、时间、来源标签和拦截原因；本次没有外发、写入、同步或确认记忆。',
    ],
  };
}

export function buildTimelineRefreshFailureReceipt(
  input: TimelineRefreshFailureReceiptInput,
): TimelineRefreshFailureReceipt {
  const scopeLabel = getTimelineReceiptScopeLabel(input.scope);
  const totalCount = Math.max(0, input.totalEventCount);
  const visibleCount = Math.max(0, input.visibleEventCount);
  const errorText = compactNavigationTargetTitle(input.errorMessage || '');
  const items = [
    `当前 Memory Service 状态未确认；下面仍显示上次成功读取的 ${visibleCount} / ${totalCount} 条时间轴记忆。`,
    `失败请求：${scopeLabel} · ${input.rangeLabel} · ${input.sourceFilterLabel}；没有把失败结果当作空时间轴。`,
    '恢复：可再次刷新；切换记忆范围或时间窗口会重新请求，失败时不会复用旧范围快照。',
  ];

  if (errorText !== '这条记忆') {
    items.push(`错误：${errorText}。`);
  }

  return {
    title: '刷新失败 · 上次快照',
    items,
  };
}

export function buildTimelineRefreshingSnapshotReceipt(
  input: TimelineRefreshingSnapshotReceiptInput,
): TimelineRefreshingSnapshotReceipt {
  const scopeLabel = getTimelineReceiptScopeLabel(input.scope);
  const totalCount = Math.max(0, input.totalEventCount);
  const visibleCount = Math.max(0, input.visibleEventCount);

  return {
    title: '刷新中 · 上次快照',
    items: [
      `正在重新读取 ${scopeLabel} · ${input.rangeLabel} · ${input.sourceFilterLabel}；下面暂时仍是上次成功快照。`,
      `当前可见 ${visibleCount} / ${totalCount} 条旧快照记忆；刷新成功后会整体替换为 Memory Service 新结果。`,
      '边界：刷新中不代表 Memory Service 已确认最新状态，也不会写入、删除、同步来源或重排反馈。',
    ],
  };
}

function getTimelineFeedbackActionLabel(
  action: TimelineFeedbackReceiptAction,
): string {
  if (action === 'positive') return '有用';
  if (action === 'negative') return '不相关';
  return '撤销反馈';
}

export function buildTimelineFeedbackReceipt(
  input: TimelineFeedbackReceiptInput,
): TimelineFeedbackReceipt {
  const scopeLabel = getTimelineReceiptScopeLabel(input.scope);
  const targetTitle = compactNavigationTargetTitle(input.eventTitle);
  const actionLabel = getTimelineFeedbackActionLabel(input.action);
  const targetKey = [input.targetType, input.targetId]
    .map((part) =>
      typeof part === 'string' ? part.replace(/\s+/g, ' ').trim() : '',
    )
    .filter(Boolean)
    .join(':');
  const contextLine = `上下文：${scopeLabel} · ${input.rangeLabel} · ${input.sourceFilterLabel}。`;
  const targetLine = targetKey
    ? `目标：${targetTitle}（${targetKey}）。`
    : `目标：${targetTitle}。`;
  const boundaryLine =
    '边界：这只写 recall_quality 反馈信号，不会删除、隐藏或确认当前记忆，不会重新读取来源、外发内容、写画像或立即重排本页列表。';

  if (input.status === 'pending') {
    return {
      title: '反馈提交中回执',
      tone: 'info',
      items: [
        `操作：正在把这条时间轴记忆标记为“${actionLabel}”。`,
        targetLine,
        contextLine,
        boundaryLine,
      ],
    };
  }

  if (input.status === 'failure') {
    const errorText = compactNavigationTargetTitle(input.errorMessage || '');
    const items = [
      `结果：反馈“${actionLabel}”未确认写入，上一反馈状态已保留。`,
      targetLine,
      contextLine,
      boundaryLine,
    ];
    if (errorText !== '这条记忆') {
      items.push(`错误：${errorText}。`);
    }
    return {
      title: '反馈未确认回执',
      tone: 'warning',
      items,
    };
  }

  if (input.status === 'cleared') {
    return {
      title: '反馈撤销回执',
      tone: 'success',
      items: [
        '结果：已确认撤销这条时间轴记忆的召回质量反馈。',
        targetLine,
        contextLine,
        boundaryLine,
      ],
    };
  }

  return {
    title: '反馈已记录回执',
    tone: 'success',
    items: [
      `结果：已确认把这条时间轴记忆标记为“${actionLabel}”。`,
      targetLine,
      contextLine,
      '后续：刷新或从搜索结果定位回来时，服务端返回的 metadata 会恢复按钮状态。',
      boundaryLine,
    ],
  };
}

function truncateTimelineText(value: string): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= MAX_TIMELINE_TEXT_LENGTH) return normalized;
  return `${normalized.slice(0, MAX_TIMELINE_TEXT_LENGTH - 1)}…`;
}

function titleFromRecallItem(item: RecallItem): string {
  const title =
    item.displayTitle ||
    item.sourceTitle ||
    item.entity?.name ||
    item.source ||
    item.previewText ||
    item.content ||
    item.id;
  return truncateTimelineText(String(title)).slice(0, 96);
}

function contentFromRecallItem(item: RecallItem): string {
  return truncateTimelineText(
    item.displayText || item.previewText || item.content || '',
  );
}

export function mapRecallItemsToTimelineEvents(
  items: RecallItem[],
): MemoryTimelineEvent[] {
  return [...items]
    .sort((left, right) => (right.timestamp || 0) - (left.timestamp || 0))
    .map((item) => {
      const channels = Array.isArray(item.metadata?.channels)
        ? item.metadata.channels.filter(
            (channel): channel is string =>
              typeof channel === 'string' && channel.length > 0,
          )
        : [];
      const feedbackAction =
        item.metadata?.recallFeedback === 'positive' ||
        item.metadata?.recallFeedback === 'negative'
          ? item.metadata.recallFeedback
          : undefined;
      return {
        id: item.id,
        resultKey: `${item.type}:${item.id}`,
        type: item.type,
        title: titleFromRecallItem(item),
        content: contentFromRecallItem(item),
        timestamp: item.timestamp,
        source: item.source,
        sourceUrl: item.sourceUrl,
        sourceTitle: item.sourceTitle,
        scope: item.scope,
        exploreLink: item.exploreLink,
        channels,
        feedbackAction,
      };
    });
}

export function groupTimelineEventsByDay(
  events: MemoryTimelineEvent[],
  nowMs = Date.now(),
): TimelineDayGroup[] {
  const groups = new Map<string, MemoryTimelineEvent[]>();

  for (const event of events) {
    const key = getTimelineDayKey(event.timestamp);
    const existing = groups.get(key) || [];
    existing.push(event);
    groups.set(key, existing);
  }

  return Array.from(groups.entries()).map(([key, groupedEvents]) => ({
    key,
    label: formatTimelineDayLabel(key, nowMs),
    summary: buildTimelineGroupSummary(groupedEvents),
    events: groupedEvents,
  }));
}

export function getTimelineIcon(type: string): string {
  if (type === 'message') return '💬';
  if (type === 'chunk') return '📄';
  if (type === 'entity') return '📌';
  return '📅';
}

export function formatTimelineTime(
  timestamp: unknown,
  nowMs = Date.now(),
): string {
  const eventMs = getTimelineTimestampMs(timestamp);
  if (eventMs == null) {
    return '时间未知';
  }

  const diff = Math.max(0, nowMs - eventMs);
  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);

  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes}分钟前`;
  if (hours < 24) return `${hours}小时前`;
  if (days < 30) return `${days}天前`;

  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(eventMs));
}
