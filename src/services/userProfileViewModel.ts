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
  evidencePreview: UserProfileEvidencePreview[];
  calibrationPriority: UserProfileCalibrationPriority;
  calibrationPriorityScore: number;
  calibrationReason: string;
}

export interface UserProfileEvidencePreview {
  label: string;
  detail: string;
  sourceUrl?: string;
  sourceUrlHiddenReason?: string;
}

export type UserProfileCalibrationPriority = 'critical' | 'high' | 'medium' | 'low';

export interface UserProfileViewModel {
  userId: string;
  core: string;
  items: unknown[];
  totalItems: number;
  loadedItems: number;
  isTruncated: boolean;
  viewLimit?: number;
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

export interface UserProfileReviewQueueItem {
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
  evidencePreview: UserProfileEvidencePreview[];
  calibrationPriority: UserProfileCalibrationPriority;
  calibrationPriorityScore: number;
  calibrationReason: string;
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
  predictedInterests: UserProfileReviewQueueItem[];
  reviewQueue: UserProfileReviewQueueItem[];
  opinions: unknown[];
  totalOpinions: number;
  lastUpdated: number;
}

export interface UserProfilePayloadViewModel {
  profile: UserProfileViewModel;
  analysis: UserProfileAnalysisViewModel;
}

export type UserProfileItemStatusFilter =
  | 'all'
  | 'needsReview'
  | 'highImpact'
  | 'usable'
  | 'withoutEvidence';

export type UserProfileItemSortMode =
  | 'priority'
  | 'newest'
  | 'confidence'
  | 'evidence';

export interface UserProfileItemFilterOptions {
  query?: string;
  statusFilter?: UserProfileItemStatusFilter;
  sortMode?: UserProfileItemSortMode;
}

interface BuildUserProfileInput {
  core?: string;
  items?: unknown[];
  totalItems?: number;
  truncated?: boolean;
  viewLimit?: number;
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

function parseEvidenceRefs(rawEvidenceRefs: unknown): unknown[] {
  if (Array.isArray(rawEvidenceRefs)) return rawEvidenceRefs;
  if (typeof rawEvidenceRefs !== 'string') return [];
  try {
    const parsed = JSON.parse(rawEvidenceRefs);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
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

function pickEvidenceString(
  record: Record<string, unknown>,
  keys: string[],
): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (value == null) continue;
    const text = stringifyValue(value).trim();
    if (text) return text;
  }
  return undefined;
}

function truncateText(value: string, maxLength = 140): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1)}...`;
}

function sanitizeEvidenceSourceUrl(rawUrl: string | undefined): {
  sourceUrl?: string;
  hiddenReason?: string;
} {
  const trimmed = rawUrl?.trim();
  if (!trimmed) return {};

  try {
    const url = new URL(trimmed);
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      return { sourceUrl: url.href };
    }
    return {
      hiddenReason: `来源链接已隐藏：不支持 ${url.protocol.replace(':', '')} 协议`,
    };
  } catch {
    return {
      hiddenReason: '来源链接已隐藏：链接格式无效',
    };
  }
}

function buildEvidencePreview(ref: unknown, index: number): UserProfileEvidencePreview {
  if (ref && typeof ref === 'object') {
    const record = ref as Record<string, unknown>;
    const sourceType = pickEvidenceString(record, ['sourceType', 'source_kind', 'source', 'type', 'kind']);
    const title = pickEvidenceString(record, ['sourceTitle', 'title', 'name', 'label']);
    const sourceId = pickEvidenceString(record, ['sourceId', 'messageId', 'memoryId', 'id']);
    const rawSourceUrl = pickEvidenceString(record, ['sourceUrl', 'url', 'href']);
    const sourceUrlSafety = sanitizeEvidenceSourceUrl(rawSourceUrl);
    const snippet = pickEvidenceString(record, ['snippet', 'text', 'content', 'summary', 'rationale']);
    const timestamp = pickEvidenceString(record, ['timestamp', 'ts', 'capturedAt']);
    const label = [sourceType, title, sourceId]
      .filter(Boolean)
      .slice(0, 3)
      .join(' · ') || `证据 ${index + 1}`;
    const detail = truncateText(
      snippet ||
        sourceUrlSafety.sourceUrl ||
        timestamp ||
        sourceUrlSafety.hiddenReason ||
        stringifyValue(ref),
    );

    return {
      label: truncateText(label, 80),
      detail,
      sourceUrl: sourceUrlSafety.sourceUrl,
      sourceUrlHiddenReason: sourceUrlSafety.hiddenReason,
    };
  }

  return {
    label: `证据 ${index + 1}`,
    detail: truncateText(stringifyValue(ref)),
  };
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

function calibrationPriorityFromScore(score: number): UserProfileCalibrationPriority {
  if (score >= 1.5) return 'critical';
  if (score >= 1.1) return 'high';
  if (score >= 0.65) return 'medium';
  return 'low';
}

function calculateCalibrationPriorityScore(args: {
  confidence: number;
  salienceScore: number;
  mentionCount: number;
  status: string;
  userConfirmed: boolean;
  evidenceCount: number;
}): number {
  const impact = Math.max(args.confidence, args.salienceScore);
  const mentionBoost = Math.min(1, args.mentionCount / 5);
  const confirmationGap = args.userConfirmed
    ? 0
    : args.status === 'pending_confirm'
      ? 0.8
      : 0.55;
  const evidenceGap = args.evidenceCount === 0 ? 0.35 : 0;

  if (args.userConfirmed && args.status === 'active') {
    return evidenceGap > 0 && impact >= 0.7
      ? 0.7 + impact * 0.25
      : impact * 0.25;
  }

  return confirmationGap + impact * 0.45 + mentionBoost * 0.25 + evidenceGap;
}

function buildCalibrationReason(args: {
  priority: UserProfileCalibrationPriority;
  confidence: number;
  salienceScore: number;
  mentionCount: number;
  status: string;
  userConfirmed: boolean;
  evidenceCount: number;
  canUseForPersonalization: boolean;
}): string {
  const impact = Math.max(args.confidence, args.salienceScore);
  if (!args.canUseForPersonalization && args.evidenceCount === 0 && impact >= 0.65) {
    return '高影响但缺少可审计证据，建议优先确认或排除。';
  }
  if (args.status === 'pending_confirm') {
    return args.evidenceCount > 0
      ? '待确认推断，有证据可先复核。'
      : '待确认推断，确认前不会进入个性化上下文。';
  }
  if (!args.userConfirmed) {
    return args.mentionCount > 1
      ? '多次命中但尚未确认，建议校准。'
      : '尚未确认，暂不会用于个性化上下文。';
  }
  if (args.evidenceCount === 0 && args.priority !== 'low') {
    return '已确认但缺少证据，后续推荐漂移时可复查。';
  }
  return '已确认，可用于个性化。';
}

function normalizeItem(rawItem: unknown): UserProfileInterestItem {
  const item = (rawItem ?? {}) as any;
  const parsedValue = parseItemValue(item.itemValue ?? item.item_value);
  const name = pickDisplayName(item, parsedValue);
  const evidenceRefs = parseEvidenceRefs(item.evidenceRefs ?? item.evidence_refs);
  const evidencePreview = evidenceRefs.map(buildEvidencePreview);
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
  const mentionCount = positiveNumber(item.mentionCount ?? item.mention_count, 1);
  const calibrationPriorityScore = calculateCalibrationPriorityScore({
    confidence,
    salienceScore,
    mentionCount,
    status,
    userConfirmed,
    evidenceCount: evidenceRefs.length,
  });
  const calibrationPriority = calibrationPriorityFromScore(calibrationPriorityScore);
  const calibrationReason = buildCalibrationReason({
    priority: calibrationPriority,
    confidence,
    salienceScore,
    mentionCount,
    status,
    userConfirmed,
    evidenceCount: evidenceRefs.length,
    canUseForPersonalization,
  });

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
    mentionCount,
    lastSeen,
    sourceKind: String(item.sourceKind ?? item.source_kind ?? 'unknown'),
    userConfirmed,
    status,
    canUseForPersonalization,
    contextUseState: canUseForPersonalization ? 'usable' : 'needs_confirmation',
    evidenceRefs,
    evidencePreview,
    calibrationPriority,
    calibrationPriorityScore,
    calibrationReason,
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
  return item.calibrationPriorityScore + statusBoost * 0.2 + evidenceBoost;
}

function buildProfileItemSearchText(item: UserProfileInterestItem): string {
  return [
    item.name,
    item.itemType,
    item.itemKey,
    stringifyValue(item.itemValue),
    item.category,
    item.sourceKind,
    item.status,
    stringifyValue(item.evidenceRefs),
    ...item.evidencePreview.flatMap((evidence) => [
      evidence.label,
      evidence.detail,
      evidence.sourceUrl ?? '',
      evidence.sourceUrlHiddenReason ?? '',
    ]),
  ]
    .join(' ')
    .toLowerCase();
}

function matchesProfileItemStatusFilter(
  item: UserProfileInterestItem,
  statusFilter: UserProfileItemStatusFilter,
): boolean {
  switch (statusFilter) {
    case 'needsReview':
      return !item.userConfirmed || item.status === 'pending_confirm' || !item.canUseForPersonalization;
    case 'highImpact':
      return (
        !item.canUseForPersonalization &&
        (item.calibrationPriority === 'critical' || item.calibrationPriority === 'high')
      );
    case 'usable':
      return item.canUseForPersonalization;
    case 'withoutEvidence':
      return item.evidenceRefs.length === 0;
    default:
      return true;
  }
}

function compareProfileItems(
  a: UserProfileInterestItem,
  b: UserProfileInterestItem,
  sortMode: UserProfileItemSortMode,
): number {
  switch (sortMode) {
    case 'newest':
      return b.lastSeen - a.lastSeen || itemSortScore(b) - itemSortScore(a);
    case 'confidence':
      return b.confidence - a.confidence || b.salienceScore - a.salienceScore;
    case 'evidence':
      return b.evidenceRefs.length - a.evidenceRefs.length || b.lastSeen - a.lastSeen;
    default:
      return pendingReviewScore(b) - pendingReviewScore(a) || itemSortScore(b) - itemSortScore(a);
  }
}

export function filterAndSortProfileItems(
  items: UserProfileInterestItem[],
  options: UserProfileItemFilterOptions = {},
): UserProfileInterestItem[] {
  const query = String(options.query ?? '').trim().toLowerCase();
  const statusFilter = options.statusFilter ?? 'all';
  const sortMode = options.sortMode ?? 'priority';

  return items
    .filter((item) => {
      if (!matchesProfileItemStatusFilter(item, statusFilter)) return false;
      if (!query) return true;
      return buildProfileItemSearchText(item).includes(query);
    })
    .slice()
    .sort((a, b) => compareProfileItems(a, b, sortMode) || a.name.localeCompare(b.name));
}

function buildReviewQueueItem(item: UserProfileInterestItem): UserProfileReviewQueueItem {
  return {
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
    evidencePreview: item.evidencePreview,
    calibrationPriority: item.calibrationPriority,
    calibrationPriorityScore: item.calibrationPriorityScore,
    calibrationReason: item.calibrationReason,
    reason:
      item.status === 'pending_confirm'
        ? item.calibrationReason
        : !item.canUseForPersonalization
          ? item.calibrationReason
          : item.sourceKind === 'explicit'
            ? '来自显式配置'
            : item.calibrationReason,
  };
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
  const reviewQueue = inferredItems.map(buildReviewQueueItem);

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
    predictedInterests: reviewQueue.slice(0, 4),
    reviewQueue,
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
  const totalItems = input.totalItems ?? normalizedItems.length;
  const isTruncated = Boolean(input.truncated) || (input.items ?? []).length < totalItems;

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
    totalItems,
    loadedItems: normalizedItems.length,
    isTruncated,
    viewLimit: input.viewLimit,
    allItems: normalizedItems,
    interests,
    statistics: {
      totalInteractions,
      averageDailyActivity: totalInteractions / activeDays,
      lastActiveTime,
      totalItems,
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
    const viewModel = data.viewModel as UserProfilePayloadViewModel;
    const profile = viewModel.profile;
    profile.loadedItems = profile.loadedItems ?? profile.allItems.length;
    profile.totalItems = profile.totalItems ?? profile.loadedItems;
    profile.isTruncated = profile.isTruncated ?? profile.loadedItems < profile.totalItems;
    return viewModel;
  }

  if (data?.profile?.allItems && data?.analysis?.insights) {
    const profile = data.profile as UserProfileViewModel;
    profile.loadedItems = profile.loadedItems ?? profile.allItems.length;
    profile.totalItems = profile.totalItems ?? profile.loadedItems;
    profile.isTruncated = profile.isTruncated ?? profile.loadedItems < profile.totalItems;
    return {
      profile,
      analysis: data.analysis as UserProfileAnalysisViewModel,
    };
  }

  return buildUserProfileViewModel({
    core: data?.profile?.core ?? '',
    items: data?.profile?.items ?? [],
    totalItems: data?.profile?.totalItems ?? data?.profile?.total ?? undefined,
    truncated: data?.profile?.truncated ?? data?.profile?.isTruncated ?? undefined,
    viewLimit: data?.profile?.viewLimit ?? undefined,
    opinions: data?.analysis?.opinions ?? [],
    totalOpinions: data?.analysis?.totalOpinions ?? undefined,
    userId: data?.profile?.userId ?? 'default',
  });
}
