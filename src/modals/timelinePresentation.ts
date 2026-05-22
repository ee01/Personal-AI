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

export interface ParsedTimelineFocus {
  id: string;
  type?: TimelineFocusType;
  isLegacyTypedFocus: boolean;
}

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
