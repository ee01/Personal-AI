import type { DayPilotBrief, DayPilotCard } from './services/MemoryServiceClient';

export type TodayPilotSourceStatsKey =
  | 'messages'
  | 'calendar'
  | 'notifications'
  | 'actions'
  | 'reflections'
  | 'rehearsals'
  | 'skills'
  | 'relationships';

export interface TodayPilotSourceStatItem {
  key: TodayPilotSourceStatsKey;
  label: string;
  total: number;
  candidate: number;
  selected: number;
  noise: number;
}

const SOURCE_ORDER: TodayPilotSourceStatsKey[] = [
  'messages',
  'calendar',
  'notifications',
  'actions',
  'reflections',
  'rehearsals',
  'skills',
  'relationships',
];

const SOURCE_LABELS: Record<TodayPilotSourceStatsKey, string> = {
  messages: '消息',
  calendar: '日历',
  notifications: '通知',
  actions: '动作',
  reflections: '反思',
  rehearsals: '预演',
  skills: '技能',
  relationships: '关系',
};

function numberValue(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, value)
    : 0;
}

export function todayPilotSourceStatsKeyForEvidence(
  sourceKind: string,
): TodayPilotSourceStatsKey {
  switch (sourceKind) {
    case 'calendar':
      return 'calendar';
    case 'notification':
      return 'notifications';
    case 'action':
      return 'actions';
    case 'reflection':
      return 'reflections';
    case 'rehearsal':
      return 'rehearsals';
    case 'skill':
      return 'skills';
    case 'relationship':
      return 'relationships';
    case 'message':
    default:
      return 'messages';
  }
}

export function countSelectedTodayPilotSourceRefs(
  cards: DayPilotCard[],
): Record<TodayPilotSourceStatsKey, number> {
  const counts = SOURCE_ORDER.reduce(
    (memo, key) => {
      memo[key] = 0;
      return memo;
    },
    {} as Record<TodayPilotSourceStatsKey, number>,
  );
  const seen = new Set<string>();

  for (const card of cards) {
    for (const ref of card.evidenceRefs || []) {
      const dedupeKey = `${ref.sourceKind}:${ref.sourceId}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      counts[todayPilotSourceStatsKeyForEvidence(ref.sourceKind)] += 1;
    }
  }

  return counts;
}

export function getTodayPilotSourceStatItems(
  brief: DayPilotBrief,
  selectedCards: DayPilotCard[] = brief.cards || [],
): TodayPilotSourceStatItem[] {
  const stats = brief.sourceStats;
  const selected = countSelectedTodayPilotSourceRefs(selectedCards);

  return [
    {
      key: 'messages',
      label: SOURCE_LABELS.messages,
      total: numberValue(stats.messages?.totalRecent),
      candidate: numberValue(stats.messages?.scanned),
      selected: selected.messages,
    },
    {
      key: 'calendar',
      label: SOURCE_LABELS.calendar,
      total: numberValue(stats.calendar?.upcoming),
      candidate: numberValue(stats.calendar?.scanned),
      selected: selected.calendar,
    },
    {
      key: 'notifications',
      label: SOURCE_LABELS.notifications,
      total: numberValue(stats.notifications?.pending),
      candidate: numberValue(stats.notifications?.scanned),
      selected: selected.notifications,
    },
    {
      key: 'actions',
      label: SOURCE_LABELS.actions,
      total: numberValue(stats.actions?.queued),
      candidate: numberValue(stats.actions?.scanned),
      selected: selected.actions,
    },
    {
      key: 'reflections',
      label: SOURCE_LABELS.reflections,
      total: numberValue(stats.reflections?.active),
      candidate: numberValue(stats.reflections?.scanned),
      selected: selected.reflections,
    },
    {
      key: 'rehearsals',
      label: SOURCE_LABELS.rehearsals,
      total: numberValue(stats.rehearsals?.active),
      candidate: numberValue(stats.rehearsals?.scanned),
      selected: selected.rehearsals,
    },
    {
      key: 'skills',
      label: SOURCE_LABELS.skills,
      total: numberValue(stats.skills?.suggestions),
      candidate: numberValue(stats.skills?.scanned),
      selected: selected.skills,
    },
    {
      key: 'relationships',
      label: SOURCE_LABELS.relationships,
      total: numberValue(stats.relationships?.highFrequencyPeople),
      candidate: numberValue(stats.relationships?.scanned),
      selected: selected.relationships,
    },
  ].map((item) => ({
    ...item,
    noise: Math.max(0, item.total - item.candidate),
  }));
}

export function countTodayPilotRawSignals(
  sourceItems: TodayPilotSourceStatItem[],
): number {
  return sourceItems.reduce((sum, item) => sum + item.total, 0);
}

export function countTodayPilotCandidates(
  sourceItems: TodayPilotSourceStatItem[],
): number {
  return sourceItems.reduce((sum, item) => sum + item.candidate, 0);
}

export function countTodayPilotSelectedEvidence(
  sourceItems: TodayPilotSourceStatItem[],
): number {
  return sourceItems.reduce((sum, item) => sum + item.selected, 0);
}

export function summarizeTodayPilotNoiseBreakdown(
  sourceItems: TodayPilotSourceStatItem[],
  maxItems = 3,
): string {
  const noisySources = sourceItems
    .filter((item) => item.noise > 0)
    .sort((left, right) => right.noise - left.noise);

  if (noisySources.length === 0) return '';

  const visibleSources = noisySources.slice(0, maxItems);
  const overflow = noisySources
    .slice(maxItems)
    .reduce((sum, item) => sum + item.noise, 0);
  const parts = visibleSources.map((item) => `${item.label} ${item.noise}`);
  if (overflow > 0) parts.push(`其他 ${overflow}`);
  return parts.join('、');
}
