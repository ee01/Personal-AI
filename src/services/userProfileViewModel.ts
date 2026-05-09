export type UserProfileCategory =
  | 'projects'
  | 'people'
  | 'topics'
  | 'jiraItems'
  | 'technologies'
  | 'documents';

export interface UserProfileInterestItem {
  id: string;
  name: string;
  itemType: string;
  itemKey: string;
  itemValue: unknown;
  category: UserProfileCategory;
  explicitImportance: number;
  confidence: number;
  salienceScore: number;
  mentionCount: number;
  lastSeen: number;
  sourceKind: string;
  userConfirmed: boolean;
  status: string;
  canUseForPersonalization: boolean;
  contextUseState: 'usable' | 'needs_confirmation';
  evidenceRefs: unknown[];
}

export interface UserProfileViewModel {
  userId: string;
  core: string;
  items: unknown[];
  totalItems: number;
  allItems: UserProfileInterestItem[];
  interests: Record<UserProfileCategory, UserProfileInterestItem[]>;
  statistics: {
    totalInteractions: number;
    averageDailyActivity: number;
    lastActiveTime: number;
    totalItems: number;
    confirmedItems: number;
    inferredItems: number;
  };
  activityTrend: Array<{
    date: string;
    day: string;
    activity: number;
    interactions: number;
  }>;
  heatmap: Array<{
    day: number;
    hour: number;
    dayName: string;
    intensity: number;
  }>;
  interestTimeline: Array<{
    name: string;
    currentWeight: number;
    history: Array<{ date: string; weight: number; position: number }>;
  }>;
  lastUpdated: number;
}

export interface UserProfileAnalysisViewModel {
  topInterests: {
    projects: string[];
    people: string[];
    topics: string[];
  };
  insights: {
    workingPattern: string;
    collaborationStyle: string;
    focusAreas: string[];
    suggestedContent: string[];
  };
  predictedInterests: Array<{
    id: string;
    type: string;
    name: string;
    category: UserProfileCategory;
    confidence: number;
    sourceKind: string;
    status: string;
    evidenceCount: number;
    lastSeen: number;
    canUseForPersonalization: boolean;
    reason: string;
  }>;
  opinions: unknown[];
  totalOpinions: number;
  lastUpdated: number;
}

export interface UserProfilePayloadViewModel {
  profile: UserProfileViewModel;
  analysis: UserProfileAnalysisViewModel;
}

interface BuildUserProfileInput {
  core?: string;
  items?: unknown[];
  totalItems?: number;
  opinions?: unknown[];
  totalOpinions?: number;
  userId?: string;
  now?: number;
}

const CATEGORY_KEYS: UserProfileCategory[] = [
  'projects',
  'people',
  'topics',
  'jiraItems',
  'technologies',
  'documents',
];

const DAY_MS = 24 * 60 * 60 * 1000;

function clamp01(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.min(1, parsed));
}

function positiveNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return parsed;
}

function normalizeTimestampMs(value: unknown): number {
  const parsed = positiveNumber(value, 0);
  if (!parsed) return 0;
  return parsed < 1_000_000_000_000 ? parsed * 1000 : parsed;
}

function parseItemValue(rawValue: unknown): unknown {
  if (typeof rawValue !== 'string') return rawValue ?? '';
  try {
    return JSON.parse(rawValue);
  } catch {
    return rawValue;
  }
}

function stringifyValue(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function containsLatinToken(haystack: string, tokens: string[]): boolean {
  return tokens.some((token) => {
    const pattern = new RegExp(`(^|[^a-z0-9])${escapeRegExp(token)}($|[^a-z0-9])`, 'i');
    return pattern.test(haystack);
  });
}

function pickDisplayName(item: any, parsedValue: unknown): string {
  if (parsedValue && typeof parsedValue === 'object') {
    const valueRecord = parsedValue as Record<string, unknown>;
    const candidate =
      valueRecord.name ??
      valueRecord.title ??
      valueRecord.label ??
      valueRecord.value ??
      valueRecord.text ??
      valueRecord.project ??
      valueRecord.person;
    if (candidate != null && String(candidate).trim()) {
      return String(candidate).trim();
    }
  }

  const rawValue = stringifyValue(parsedValue).trim();
  if (rawValue) return rawValue;

  const key = String(item?.itemKey ?? item?.item_key ?? '').trim();
  if (key) return key;

  return '未命名画像条目';
}

function detectCategory(item: any, displayName: string): UserProfileCategory {
  const itemType = String(item?.itemType ?? item?.item_type ?? '').toLowerCase();
  const itemKey = String(item?.itemKey ?? item?.item_key ?? '').toLowerCase();
  const haystack = `${itemType} ${itemKey} ${displayName.toLowerCase()}`;

  if (containsLatinToken(haystack, ['jira', 'ticket', 'issue', 'bug']) || /需求|缺陷|工单/.test(haystack)) {
    return 'jiraItems';
  }
  if (
    containsLatinToken(haystack, ['project', 'initiative', 'repository', 'repo']) ||
    /项目|工程/.test(haystack)
  ) {
    return 'projects';
  }
  if (
    containsLatinToken(haystack, [
      'person',
      'people',
      'manager',
      'stakeholder',
      'member',
      'collaborator',
      'owner',
    ]) ||
    /同事|人员|经理|干系人|负责人/.test(haystack)
  ) {
    return 'people';
  }
  if (
    containsLatinToken(haystack, [
      'tech',
      'technology',
      'framework',
      'language',
      'stack',
      'react',
      'vue',
      'typescript',
      'javascript',
      'node',
      'python',
      'java',
    ]) ||
    /前端|后端|技术/.test(haystack)
  ) {
    return 'technologies';
  }
  if (
    containsLatinToken(haystack, ['doc', 'document', 'slide', 'sheet', 'spec', 'file', 'design']) ||
    /文档|幻灯片|表格|设计稿/.test(haystack)
  ) {
    return 'documents';
  }

  return 'topics';
}

function itemSortScore(item: UserProfileInterestItem): number {
  const mentionBoost = Math.min(1, item.mentionCount / 10);
  return item.salienceScore * 0.45 + item.confidence * 0.45 + mentionBoost * 0.1;
}

function normalizeItem(rawItem: unknown): UserProfileInterestItem {
  const item = (rawItem ?? {}) as any;
  const parsedValue = parseItemValue(item.itemValue ?? item.item_value);
  const name = pickDisplayName(item, parsedValue);
  const confidence = clamp01(item.confidence, 0.5);
  const salienceScore = clamp01(item.salienceScore ?? item.salience_score, confidence);
  const category = detectCategory(item, name);
  const lastSeen =
    normalizeTimestampMs(item.lastSeen ?? item.last_seen) ||
    normalizeTimestampMs(item.updatedAt ?? item.updated_at) ||
    normalizeTimestampMs(item.createdAt ?? item.created_at);
  const status = String(item.status ?? 'active');
  const userConfirmed = Boolean(item.userConfirmed ?? item.user_confirmed);
  const canUseForPersonalization = userConfirmed && status === 'active';

  return {
    id: String(item.id ?? `${category}:${name}`),
    name,
    itemType: String(item.itemType ?? item.item_type ?? 'profile'),
    itemKey: String(item.itemKey ?? item.item_key ?? ''),
    itemValue: parsedValue,
    category,
    explicitImportance: confidence,
    confidence,
    salienceScore,
    mentionCount: positiveNumber(item.mentionCount ?? item.mention_count, 1),
    lastSeen,
    sourceKind: String(item.sourceKind ?? item.source_kind ?? 'unknown'),
    userConfirmed,
    status,
    canUseForPersonalization,
    contextUseState: canUseForPersonalization ? 'usable' : 'needs_confirmation',
    evidenceRefs: Array.isArray(item.evidenceRefs ?? item.evidence_refs)
      ? (item.evidenceRefs ?? item.evidence_refs)
      : [],
  };
}

function formatDateKey(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function buildActivityTrend(
  items: UserProfileInterestItem[],
  now: number,
): UserProfileViewModel['activityTrend'] {
  const buckets = new Map<string, number>();
  for (let offset = 6; offset >= 0; offset -= 1) {
    const timestamp = now - offset * DAY_MS;
    buckets.set(formatDateKey(timestamp), 0);
  }

  for (const item of items) {
    if (!item.lastSeen) continue;
    const key = formatDateKey(item.lastSeen);
    if (buckets.has(key)) {
      buckets.set(key, (buckets.get(key) ?? 0) + Math.max(1, item.mentionCount));
    }
  }

  const maxInteractions = Math.max(1, ...Array.from(buckets.values()));
  return Array.from(buckets.entries()).map(([date, interactions]) => {
    const dayName = new Date(`${date}T00:00:00`).toLocaleDateString('zh-CN', {
      weekday: 'short',
    });
    return {
      date,
      day: dayName,
      interactions,
      activity: interactions / maxInteractions,
    };
  });
}

function buildHeatmap(
  items: UserProfileInterestItem[],
): UserProfileViewModel['heatmap'] {
  const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const counts = new Map<string, number>();
  let maxCount = 1;

  for (const item of items) {
    if (!item.lastSeen) continue;
    const date = new Date(item.lastSeen);
    const key = `${date.getDay()}:${date.getHours()}`;
    const nextCount = (counts.get(key) ?? 0) + Math.max(1, item.mentionCount);
    counts.set(key, nextCount);
    maxCount = Math.max(maxCount, nextCount);
  }

  const heatmap: UserProfileViewModel['heatmap'] = [];
  for (let day = 0; day < 7; day += 1) {
    for (let hour = 0; hour < 24; hour += 1) {
      const count = counts.get(`${day}:${hour}`) ?? 0;
      heatmap.push({
        day,
        hour,
        dayName: dayNames[day],
        intensity: count / maxCount,
      });
    }
  }
  return heatmap;
}

function buildInterestTimeline(
  items: UserProfileInterestItem[],
  now: number,
): UserProfileViewModel['interestTimeline'] {
  return items.slice(0, 4).map((item) => {
    const ageDays = item.lastSeen
      ? Math.max(0, Math.round((now - item.lastSeen) / DAY_MS))
      : 30;
    const startWeight = Math.max(0.05, item.salienceScore * 0.7);
    const currentWeight = Math.max(item.explicitImportance, item.salienceScore);

    return {
      name: item.name,
      currentWeight,
      history: [
        {
          date: formatDateKey(now - Math.min(30, ageDays + 14) * DAY_MS),
          weight: startWeight,
          position: 0,
        },
        {
          date: formatDateKey(now - Math.min(30, ageDays) * DAY_MS),
          weight: Math.max(startWeight, currentWeight * 0.85),
          position: 70,
        },
        {
          date: formatDateKey(now),
          weight: currentWeight,
          position: 100,
        },
      ],
    };
  });
}

function buildSuggestions(profile: UserProfileViewModel): string[] {
  const suggestions: string[] = [];
  const topProject = profile.interests.projects[0];
  const topTopic = profile.interests.topics[0] ?? profile.interests.technologies[0];
  const unconfirmed = profile.allItems.find((item) => item.status === 'pending_confirm' || !item.userConfirmed);

  if (topProject) {
    suggestions.push(`优先复查 ${topProject.name} 相关记忆，确认是否仍是当前重点。`);
  }
  if (topTopic) {
    suggestions.push(`用“更多/更少关注”的方式校准 ${topTopic.name}，避免推荐漂移。`);
  }
  if (unconfirmed) {
    suggestions.push(`确认或排除 “${unconfirmed.name}”，让画像更可控。`);
  }

  return suggestions.length > 0
    ? suggestions
    : ['添加或确认几个关键画像条目后，系统会生成更具体的建议。'];
}

function pendingReviewScore(item: UserProfileInterestItem): number {
  const statusBoost = item.status === 'pending_confirm' ? 1 : 0;
  const evidenceBoost = item.evidenceRefs.length > 0 ? 0.25 : 0;
  return statusBoost + evidenceBoost + itemSortScore(item);
}

function buildAnalysis(
  profile: UserProfileViewModel,
  opinions: unknown[],
  totalOpinions: number,
  now: number,
): UserProfileAnalysisViewModel {
  const topTopics = [
    ...profile.interests.topics,
    ...profile.interests.technologies,
    ...profile.interests.documents,
  ];
  const focusAreas = topTopics.slice(0, 5).map((item) => item.name);
  const inferredItems = profile.allItems
    .filter((item) => !item.userConfirmed)
    .sort((a, b) => pendingReviewScore(b) - pendingReviewScore(a));

  return {
    topInterests: {
      projects: profile.interests.projects.slice(0, 5).map((item) => item.name),
      people: profile.interests.people.slice(0, 5).map((item) => item.name),
      topics: topTopics.slice(0, 5).map((item) => item.name),
    },
    insights: {
      workingPattern: profile.statistics.lastActiveTime
        ? `最近一次画像信号更新于 ${new Date(profile.statistics.lastActiveTime).toLocaleString('zh-CN')}。`
        : '还没有足够的画像信号判断工作节奏。',
      collaborationStyle:
        profile.interests.people.length > 0
          ? `当前画像中记录了 ${profile.interests.people.length} 个协作相关条目。`
          : '还没有稳定的协作对象画像。',
      focusAreas: focusAreas.length > 0 ? focusAreas : ['待补充'],
      suggestedContent: buildSuggestions(profile),
    },
    predictedInterests: inferredItems.slice(0, 4).map((item) => ({
      id: item.id,
      type: item.itemType,
      name: item.name,
      category: item.category,
      confidence: item.confidence,
      sourceKind: item.sourceKind,
      status: item.status,
      evidenceCount: item.evidenceRefs.length,
      lastSeen: item.lastSeen,
      canUseForPersonalization: item.canUseForPersonalization,
      reason:
        item.status === 'pending_confirm'
          ? '待确认后再进入核心画像。'
          : !item.canUseForPersonalization
            ? '尚未确认，暂不会用于个性化上下文。'
          : item.sourceKind === 'explicit'
            ? '来自显式配置'
            : '来自历史记忆推断，建议人工确认。',
    })),
    opinions,
    totalOpinions,
    lastUpdated: now,
  };
}

export function buildUserProfileViewModel(
  input: BuildUserProfileInput = {},
): UserProfilePayloadViewModel {
  const now = input.now ?? Date.now();
  const normalizedItems = (input.items ?? [])
    .map(normalizeItem)
    .filter((item) => item.status !== 'retracted')
    .sort((a, b) => itemSortScore(b) - itemSortScore(a));

  const interests = CATEGORY_KEYS.reduce((result, category) => {
    result[category] = normalizedItems.filter((item) => item.category === category);
    return result;
  }, {} as Record<UserProfileCategory, UserProfileInterestItem[]>);

  const firstSeen = normalizedItems.reduce((min, item) => {
    if (!item.lastSeen) return min;
    return Math.min(min, item.lastSeen);
  }, now);
  const totalInteractions = normalizedItems.reduce(
    (sum, item) => sum + Math.max(1, item.mentionCount),
    0,
  );
  const activeDays = Math.max(1, Math.ceil((now - firstSeen) / DAY_MS));
  const lastActiveTime = normalizedItems.reduce(
    (max, item) => Math.max(max, item.lastSeen),
    0,
  );

  const profile: UserProfileViewModel = {
    userId: input.userId ?? 'default',
    core: input.core ?? '',
    items: input.items ?? [],
    totalItems: input.totalItems ?? normalizedItems.length,
    allItems: normalizedItems,
    interests,
    statistics: {
      totalInteractions,
      averageDailyActivity: totalInteractions / activeDays,
      lastActiveTime,
      totalItems: input.totalItems ?? normalizedItems.length,
      confirmedItems: normalizedItems.filter((item) => item.userConfirmed).length,
      inferredItems: normalizedItems.filter((item) => !item.userConfirmed).length,
    },
    activityTrend: buildActivityTrend(normalizedItems, now),
    heatmap: buildHeatmap(normalizedItems),
    interestTimeline: buildInterestTimeline(normalizedItems, now),
    lastUpdated: now,
  };

  return {
    profile,
    analysis: buildAnalysis(
      profile,
      input.opinions ?? [],
      input.totalOpinions ?? input.opinions?.length ?? 0,
      now,
    ),
  };
}

export function normalizeUserProfilePayload(data: any): UserProfilePayloadViewModel {
  if (data?.viewModel?.profile?.allItems && data?.viewModel?.analysis?.insights) {
    return data.viewModel as UserProfilePayloadViewModel;
  }

  if (data?.profile?.allItems && data?.analysis?.insights) {
    return {
      profile: data.profile as UserProfileViewModel,
      analysis: data.analysis as UserProfileAnalysisViewModel,
    };
  }

  return buildUserProfileViewModel({
    core: data?.profile?.core ?? '',
    items: data?.profile?.items ?? [],
    totalItems: data?.profile?.totalItems ?? data?.profile?.total ?? undefined,
    opinions: data?.analysis?.opinions ?? [],
    totalOpinions: data?.analysis?.totalOpinions ?? undefined,
    userId: data?.profile?.userId ?? 'default',
  });
}
