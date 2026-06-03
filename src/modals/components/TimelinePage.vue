<template>
  <div class="timeline-view">
    <div class="timeline-header">
      <div>
        <h2>{{ selectedRangeOption.heading }}</h2>
        <p>{{ selectedRangeOption.description }}</p>
        <div class="timeline-context" aria-label="当前时间轴检索范围">
          {{ timelineContextLabel }}
        </div>
      </div>
      <div class="timeline-controls">
        <div class="control-tabs range-tabs" role="group" aria-label="时间范围">
          <button
            v-for="option in rangeOptions"
            :key="option.key"
            :class="[
              'control-tab',
              { active: selectedRangeKey === option.key },
            ]"
            :aria-pressed="selectedRangeKey === option.key"
            type="button"
            @click="selectRange(option.key)"
          >
            {{ option.label }}
          </button>
        </div>
        <div class="control-tabs" role="group" aria-label="记忆范围">
          <button
            v-for="option in scopeOptions"
            :key="option.key"
            :class="['control-tab', { active: selectedScope === option.key }]"
            :aria-pressed="selectedScope === option.key"
            type="button"
            @click="selectScope(option.key)"
          >
            {{ option.label }}
          </button>
        </div>
        <label
          v-if="timelineSourceOptions.length > 1"
          class="source-filter"
          for="timeline-source-filter"
        >
          <span>来源</span>
          <select
            id="timeline-source-filter"
            v-model="selectedSourceFilterKey"
            aria-label="按来源筛选时间轴"
          >
            <option :value="ALL_TIMELINE_SOURCE_FILTER_KEY">
              全部来源
            </option>
            <option
              v-for="option in timelineSourceOptions"
              :key="option.key"
              :value="option.key"
            >
              {{ option.label }}（{{ option.count }}）
            </option>
          </select>
        </label>
        <button class="refresh-btn" type="button" @click="loadTimeline">
          刷新
        </button>
      </div>
    </div>

    <div v-if="focusNotice" class="timeline-focus-notice">
      {{ focusNotice }}
    </div>

    <div v-if="errorMessage" class="timeline-error">
      {{ errorMessage }}
    </div>

    <div v-if="isLoading" class="loading-container">
      <div class="loading-spinner"></div>
      <span>加载时间轴数据...</span>
    </div>

    <div
      v-else-if="filteredTimelineEvents.length > 0"
      class="timeline-container"
    >
      <section
        v-for="group in timelineDayGroups"
        :key="group.key"
        class="timeline-day-group"
        :aria-label="`${group.label} 时间轴`"
      >
        <div class="timeline-day-header">
          <h3>{{ group.label }}</h3>
          <span>{{ group.summary }}</span>
        </div>
        <article
          v-for="event in group.events"
          :key="event.resultKey"
          :class="['timeline-item', { focused: isFocusedEvent(event) }]"
          @click="handleEventClick(event)"
        >
          <div class="timeline-dot">{{ getTimelineIcon(event.type) }}</div>
          <div class="timeline-content">
            <div class="timeline-meta">
              <span v-if="isFocusedEvent(event)" class="focus-pill"
                >定位目标</span
              >
              <time
                v-if="getTimelineDateTimeValue(event.timestamp)"
                :datetime="getTimelineDateTimeValue(event.timestamp)"
                :title="formatTimelineExactTime(event.timestamp)"
              >
                {{ formatTimelineTime(event.timestamp) }} ·
                {{ formatTimelineClockTime(event.timestamp) }}
              </time>
              <span v-else>时间未知</span>
              <span v-if="event.scope">{{ getScopeLabel(event.scope) }}</span>
              <span v-if="event.sourceTitle || event.source">
                {{ event.sourceTitle || event.source }}
              </span>
            </div>
            <div class="timeline-card">
              <h3>{{ event.title }}</h3>
              <p>{{ event.content }}</p>
              <div
                v-if="event.channels.length"
                class="timeline-channels"
                aria-label="命中通道"
              >
                <span v-for="channel in event.channels" :key="channel">
                  {{ getRecallChannelLabel(channel) }}
                </span>
              </div>
              <div class="event-actions">
                <span v-if="getFeedbackLabel(event)" class="feedback-status">
                  {{ getFeedbackLabel(event) }}
                </span>
                <button
                  type="button"
                  :class="[
                    'feedback-btn',
                    { active: isFeedbackActive(event, 'positive') },
                  ]"
                  :aria-pressed="isFeedbackActive(event, 'positive')"
                  :disabled="isFeedbackPending(event)"
                  @click.stop="submitEventFeedback(event, 'positive')"
                >
                  有用
                </button>
                <button
                  type="button"
                  :class="[
                    'feedback-btn',
                    { active: isFeedbackActive(event, 'negative') },
                  ]"
                  :aria-pressed="isFeedbackActive(event, 'negative')"
                  :disabled="isFeedbackPending(event)"
                  @click.stop="submitEventFeedback(event, 'negative')"
                >
                  不相关
                </button>
                <button
                  v-if="canClearFeedback(event)"
                  type="button"
                  class="feedback-btn clear-feedback-btn"
                  :disabled="isFeedbackPending(event)"
                  @click.stop="submitEventFeedback(event, 'clear')"
                >
                  撤销反馈
                </button>
                <button
                  v-if="getLinkSafetyState(event).exploreRoute"
                  type="button"
                  @click.stop="openExploreLink(event.exploreLink)"
                >
                  在记忆中查看
                </button>
                <button
                  v-if="getLinkSafetyState(event).sourceUrl"
                  type="button"
                  :title="getSourceButtonTitle(event)"
                  :aria-label="getSourceButtonTitle(event)"
                  @click.stop="openSourceUrl(event.sourceUrl)"
                >
                  打开来源
                </button>
                <span
                  v-for="label in getLinkSafetyState(event).blockedLabels"
                  :key="label"
                  class="link-safety-note"
                >
                  {{ label }}
                </span>
              </div>
            </div>
          </div>
        </article>
      </section>
    </div>

    <div v-else class="empty-state">
      <span>📭</span>
      <p>{{ timelineEmptyTitle }}</p>
      <p class="empty-hint">{{ timelineEmptyHint }}</p>
      <div class="empty-actions">
        <button
          v-if="selectedSourceFilterKey !== ALL_TIMELINE_SOURCE_FILTER_KEY"
          type="button"
          @click="selectedSourceFilterKey = ALL_TIMELINE_SOURCE_FILTER_KEY"
        >
          查看全部来源
        </button>
        <button
          v-if="selectedRangeKey === 'today'"
          type="button"
          @click="selectRange('7d')"
        >
          查看近7天
        </button>
        <button
          v-if="selectedScope !== 'all'"
          type="button"
          @click="selectScope('all')"
        >
          切到全部
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { chromeAPI, useMemoryStore } from '../memory-store';
import type {
  MemoryFeedbackAction,
  MemoryFeedbackTargetType,
  RecallScope,
} from '../../services/MemoryServiceClient';
import type {
  MemoryTimelineEvent,
  TimelineFocusType,
} from '../timelinePresentation';
import {
  formatTimelineClockTime,
  formatTimelineExactTime,
  formatTimelineTime,
  getTimelineDateTimeValue,
  getTimelineIcon,
  groupTimelineEventsByDay,
  parseTimelineFocus,
  ALL_TIMELINE_SOURCE_FILTER_KEY,
  buildTimelineSourceFilterOptions,
  filterTimelineEventsBySource,
} from '../timelinePresentation';
import {
  getRecallChannelLabel,
  getScopeLabel,
  getMemoryLinkSafetyState,
  sanitizeMemoryExploreRoute,
} from '../searchResultPresentation';

const store = useMemoryStore();
const router = useRouter();
const route = useRoute();

type TimelineRangeKey = 'today' | '7d' | '30d';
type TimelineFeedbackChoice = Extract<
  MemoryFeedbackAction,
  'positive' | 'negative'
>;
type TimelineFeedbackState = TimelineFeedbackChoice | 'pending' | 'cleared';

interface TimelineRangeOption {
  key: TimelineRangeKey;
  label: string;
  heading: string;
  description: string;
  emptyTitle: string;
  emptyHint: string;
  requestRange: 'today' | 'recent';
  rangeDays?: number;
}

const timelineEvents = ref<MemoryTimelineEvent[]>([]);
const feedbackByResultKey = ref<Record<string, TimelineFeedbackState>>({});
const selectedScope = ref<RecallScope>(getInitialTimelineScope());
const selectedRangeKey = ref<TimelineRangeKey>(getInitialRangeKey());
const selectedSourceFilterKey = ref(ALL_TIMELINE_SOURCE_FILTER_KEY);
const errorMessage = ref('');
const focusNotice = ref('');
const isLoading = computed(() => store.isLoading);

const rangeOptions: TimelineRangeOption[] = [
  {
    key: 'today',
    label: '今天',
    heading: '今日记忆时间轴',
    description: '今天进入 Memory Service 的记忆。',
    emptyTitle: '今天还没有可展示的记忆',
    emptyHint: '当前范围暂无记录；切到近 7 天或近 30 天查看更早的线索。',
    requestRange: 'today',
  },
  {
    key: '7d',
    label: '近7天',
    heading: '近 7 天记忆时间轴',
    description: '按时间查看最近一周写入的记忆。',
    emptyTitle: '近 7 天没有可展示的记忆',
    emptyHint: '当前范围暂无记录；可以切换范围或刷新后再看。',
    requestRange: 'recent',
    rangeDays: 7,
  },
  {
    key: '30d',
    label: '近30天',
    heading: '近 30 天记忆时间轴',
    description: '回看最近一个月的记忆线索和来源。',
    emptyTitle: '近 30 天没有可展示的记忆',
    emptyHint: '当前范围暂无记录；新消息、网页或会议写入后会出现在这里。',
    requestRange: 'recent',
    rangeDays: 30,
  },
];

const scopeOptions: Array<{ key: RecallScope; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'work', label: '工作' },
  { key: 'personal', label: '个人' },
];

const selectedRangeOption = computed(
  () =>
    rangeOptions.find((option) => option.key === selectedRangeKey.value) ||
    rangeOptions[0],
);
const timelineSourceOptions = computed(() =>
  buildTimelineSourceFilterOptions(timelineEvents.value),
);
const filteredTimelineEvents = computed(() =>
  filterTimelineEventsBySource(
    timelineEvents.value,
    selectedSourceFilterKey.value,
  ),
);
const timelineDayGroups = computed(() =>
  groupTimelineEventsByDay(filteredTimelineEvents.value),
);
const selectedSourceFilterLabel = computed(() => {
  if (selectedSourceFilterKey.value === ALL_TIMELINE_SOURCE_FILTER_KEY) {
    return '全部来源';
  }
  return (
    timelineSourceOptions.value.find(
      (option) => option.key === selectedSourceFilterKey.value,
    )?.label || '当前来源'
  );
});
const timelineContextLabel = computed(
  () =>
    `${getScopeLabel(selectedScope.value)} · ${
      selectedRangeOption.value.label
    } · ${selectedSourceFilterLabel.value} · 时间通道`,
);
const timelineEmptyTitle = computed(() =>
  selectedSourceFilterKey.value !== ALL_TIMELINE_SOURCE_FILTER_KEY &&
  timelineEvents.value.length > 0
    ? '这个来源下没有可展示的记忆'
    : selectedRangeOption.value.emptyTitle,
);
const timelineEmptyHint = computed(() =>
  selectedSourceFilterKey.value !== ALL_TIMELINE_SOURCE_FILTER_KEY &&
  timelineEvents.value.length > 0
    ? '可以查看全部来源，或切换时间范围继续查找。'
    : selectedRangeOption.value.emptyHint,
);

function firstQueryValue(value: unknown): string {
  if (Array.isArray(value)) return String(value[0] || '');
  return typeof value === 'string' ? value : '';
}

function getInitialTimelineScope(): RecallScope {
  const scope = firstQueryValue(route.query.scope);
  if (scope === 'work' || scope === 'personal') return scope;
  return 'all';
}

function getInitialRangeKey(): TimelineRangeKey {
  const range = firstQueryValue(route.query.range);
  if (range === '7d' || range === '30d') return range;
  return 'today';
}

function getRouteFocus() {
  return parseTimelineFocus(route.query.focus, route.query.type);
}

function getRouteFocusId(): string {
  return getRouteFocus().id;
}

function getRouteFocusType(): TimelineFocusType | undefined {
  return getRouteFocus().type;
}

function isFocusedEvent(event: MemoryTimelineEvent): boolean {
  const focusId = getRouteFocusId();
  if (!focusId) return false;
  const focusType = getRouteFocusType();
  return event.id === focusId && (!focusType || event.type === focusType);
}

function reconcileSourceFilter() {
  if (selectedSourceFilterKey.value === ALL_TIMELINE_SOURCE_FILTER_KEY) return;
  if (
    timelineSourceOptions.value.some(
      (option) => option.key === selectedSourceFilterKey.value,
    )
  ) {
    return;
  }
  selectedSourceFilterKey.value = ALL_TIMELINE_SOURCE_FILTER_KEY;
}

async function scrollFocusedEventIntoView() {
  await nextTick();
  const focused = document.querySelector(
    '.timeline-item.focused',
  ) as HTMLElement | null;
  focused?.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

async function applyFocusedTimelineEvent() {
  focusNotice.value = '';
  const focusId = getRouteFocusId();
  if (!focusId) return;

  if (timelineEvents.value.some(isFocusedEvent)) {
    await scrollFocusedEventIntoView();
    return;
  }

  let response: any;
  try {
    response = await chromeAPI.sendMessage({
      type: 'GET_MEMORY_ITEM',
      id: focusId,
      memoryType: getRouteFocusType(),
    });
  } catch (_error) {
    focusNotice.value = '当前无法定位这条记忆；时间轴列表已正常展示。';
    return;
  }

  if (!response?.success || !response.data) {
    focusNotice.value = '没有找到这条定位记忆；它可能已被清理或迁移。';
    return;
  }

  const focusedEvent = response.data as MemoryTimelineEvent;
  const nextEvents = [
    focusedEvent,
    ...timelineEvents.value.filter(
      (event) => event.resultKey !== focusedEvent.resultKey,
    ),
  ];
  timelineEvents.value = nextEvents;
  hydrateFeedbackStateFromEvents(nextEvents);
  reconcileSourceFilter();
  focusNotice.value = '已置顶定位记忆；它可能不属于当前时间范围。';
  await scrollFocusedEventIntoView();
}

const loadTimeline = async () => {
  store.isLoading = true;
  errorMessage.value = '';
  focusNotice.value = '';
  const rangeOption = selectedRangeOption.value;
  try {
    const response = (await chromeAPI.sendMessage({
      type: 'GET_RECENT_TIMELINE',
      limit: 50,
      scope: selectedScope.value,
      range: rangeOption.requestRange,
      rangeDays: rangeOption.rangeDays,
    })) as any;

    if (!response?.success) {
      throw new Error(response?.error || 'timeline_request_failed');
    }

    timelineEvents.value = Array.isArray(response.data) ? response.data : [];
    hydrateFeedbackStateFromEvents(timelineEvents.value);
    await applyFocusedTimelineEvent();
    reconcileSourceFilter();
  } catch (error: any) {
    timelineEvents.value = [];
    selectedSourceFilterKey.value = ALL_TIMELINE_SOURCE_FILTER_KEY;
    errorMessage.value =
      error?.message || '时间轴暂时无法连接 Memory Service，请稍后刷新。';
  } finally {
    store.isLoading = false;
  }
};

const syncRouteSelection = () => {
  void router.replace({
    path: '/timeline',
    query: {
      ...router.currentRoute.value.query,
      scope: selectedScope.value,
      range: selectedRangeKey.value,
    },
  });
};

const selectRange = (rangeKey: TimelineRangeKey) => {
  if (selectedRangeKey.value === rangeKey) return;
  selectedRangeKey.value = rangeKey;
  syncRouteSelection();
  void loadTimeline();
};

const selectScope = (scope: RecallScope) => {
  if (selectedScope.value === scope) return;
  selectedScope.value = scope;
  syncRouteSelection();
  void loadTimeline();
};

const getLinkSafetyState = (event: MemoryTimelineEvent) =>
  getMemoryLinkSafetyState({
    exploreLink: event.exploreLink,
    sourceUrl: event.sourceUrl,
  });

const getSourceButtonTitle = (event: MemoryTimelineEvent) => {
  const host = getLinkSafetyState(event).sourceHost;
  return host ? `打开来源：${host}` : '打开来源';
};

const openExploreLink = (exploreLink?: string) => {
  const safeExploreRoute = sanitizeMemoryExploreRoute(exploreLink);
  if (!safeExploreRoute) return false;
  router.push(safeExploreRoute.slice(1));
  return true;
};

const openSourceUrl = (sourceUrl?: string) => {
  const safeSourceUrl = getMemoryLinkSafetyState({ sourceUrl }).sourceUrl;
  if (!safeSourceUrl) return false;
  window.open(safeSourceUrl, '_blank', 'noopener,noreferrer');
  return true;
};

const handleEventClick = (event: MemoryTimelineEvent) => {
  if (openExploreLink(event.exploreLink)) return;
  openSourceUrl(event.sourceUrl);
};

function setFeedbackState(
  resultKey: string,
  state: TimelineFeedbackState | undefined,
) {
  const next = { ...feedbackByResultKey.value };
  if (state) {
    next[resultKey] = state;
  } else {
    delete next[resultKey];
  }
  feedbackByResultKey.value = next;
}

function hydrateFeedbackStateFromEvents(events: MemoryTimelineEvent[]) {
  const next = { ...feedbackByResultKey.value };
  const visibleKeys = new Set(events.map((event) => event.resultKey));

  for (const key of Object.keys(next)) {
    if (!visibleKeys.has(key) || next[key] === 'cleared') {
      delete next[key];
    }
  }

  for (const event of events) {
    if (
      event.feedbackAction === 'positive' ||
      event.feedbackAction === 'negative'
    ) {
      next[event.resultKey] = event.feedbackAction;
    } else if (next[event.resultKey] !== 'pending') {
      delete next[event.resultKey];
    }
  }

  feedbackByResultKey.value = next;
}

function getFeedbackLabel(event: MemoryTimelineEvent): string {
  const state = feedbackByResultKey.value[event.resultKey];
  if (state === 'pending') return '提交中...';
  if (state === 'positive') return '已记录为有用';
  if (state === 'negative') return '已记录为不相关';
  if (state === 'cleared') return '已撤销反馈';
  return '';
}

function isFeedbackPending(event: MemoryTimelineEvent): boolean {
  return feedbackByResultKey.value[event.resultKey] === 'pending';
}

function isFeedbackActive(
  event: MemoryTimelineEvent,
  action: TimelineFeedbackChoice,
): boolean {
  return feedbackByResultKey.value[event.resultKey] === action;
}

function canClearFeedback(event: MemoryTimelineEvent): boolean {
  const state = feedbackByResultKey.value[event.resultKey];
  return state === 'positive' || state === 'negative';
}

function compactTimelineFeedbackDetailValue(
  value: unknown,
  maxLength = 160,
): string | undefined {
  const normalized =
    typeof value === 'string'
      ? value.replace(/\s+/g, ' ').trim()
      : value == null
      ? ''
      : String(value).replace(/\s+/g, ' ').trim();
  if (!normalized) return undefined;
  return normalized.length > maxLength
    ? `${normalized.slice(0, maxLength).trimEnd()}...`
    : normalized;
}

function buildTimelineFeedbackDetail(
  event: MemoryTimelineEvent,
  action: MemoryFeedbackAction,
): string {
  const signature = [
    'memory-timeline',
    selectedRangeKey.value,
    selectedScope.value,
    selectedSourceFilterKey.value,
  ]
    .filter(Boolean)
    .join(':');
  const detail = {
    version: '1',
    interaction:
      action === 'negative'
        ? 'memory_relevance_trainer'
        : 'context_recall_feedback',
    surface: 'memory_timeline',
    action,
    auto_applied: action === 'negative' ? 'true' : undefined,
    feedback_reason:
      action === 'negative' ? 'timeline_context_mismatch' : undefined,
    scene_anchor_signature: compactTimelineFeedbackDetailValue(signature, 220),
    range: selectedRangeKey.value,
    scope: selectedScope.value,
    source_filter: compactTimelineFeedbackDetailValue(
      selectedSourceFilterKey.value,
      120,
    ),
    target_type: event.type,
    result_key: compactTimelineFeedbackDetailValue(event.resultKey, 180),
    source_label: compactTimelineFeedbackDetailValue(event.source, 100),
    source_title: compactTimelineFeedbackDetailValue(event.sourceTitle, 140),
    source_url: compactTimelineFeedbackDetailValue(event.sourceUrl, 220),
    current_title: compactTimelineFeedbackDetailValue(document.title, 120),
  };

  return JSON.stringify(
    Object.fromEntries(
      Object.entries(detail).filter(([, value]) => Boolean(value)),
    ),
  );
}

async function submitEventFeedback(
  event: MemoryTimelineEvent,
  action: MemoryFeedbackAction,
) {
  const previousState = feedbackByResultKey.value[event.resultKey];
  if (
    action === 'clear' &&
    previousState !== 'positive' &&
    previousState !== 'negative'
  ) {
    return;
  }
  if (previousState === 'pending' || previousState === action) return;

  setFeedbackState(event.resultKey, 'pending');
  try {
    const response = (await chromeAPI.sendMessage({
      type: 'SUBMIT_MEMORY_FEEDBACK',
      feedbackType: 'recall_quality',
      targetId: event.id,
      targetType: event.type as MemoryFeedbackTargetType,
      action,
      detail: buildTimelineFeedbackDetail(event, action),
    })) as any;

    if (!response?.success) {
      throw new Error(response?.error || 'feedback_request_failed');
    }

    errorMessage.value = '';
    setFeedbackState(event.resultKey, action === 'clear' ? 'cleared' : action);
  } catch (error: any) {
    setFeedbackState(
      event.resultKey,
      previousState === 'positive' ||
        previousState === 'negative' ||
        previousState === 'cleared'
        ? previousState
        : undefined,
    );
    errorMessage.value = error?.message || '反馈暂时无法提交，请稍后再试。';
  }
}

watch(
  () => [route.query.focus, route.query.type],
  () => {
    void loadTimeline();
  },
);

watch(
  () => [route.query.scope, route.query.range],
  () => {
    const routeScope = getInitialTimelineScope();
    const routeRange = getInitialRangeKey();
    if (
      routeScope === selectedScope.value &&
      routeRange === selectedRangeKey.value
    ) {
      return;
    }

    selectedScope.value = routeScope;
    selectedRangeKey.value = routeRange;
    void loadTimeline();
  },
);

onMounted(() => {
  void loadTimeline();
});
</script>

<style scoped>
.timeline-view {
  max-width: 980px;
  margin: 0 auto;
}

.timeline-header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: flex-start;
  margin-bottom: 1.5rem;
}

.timeline-header h2 {
  margin: 0 0 0.45rem;
  color: #f8fafc;
  font-size: 1.5rem;
  font-weight: 600;
}

.timeline-header p {
  margin: 0;
  color: #94a3b8;
  line-height: 1.6;
}

.timeline-context {
  display: inline-flex;
  margin-top: 0.65rem;
  padding: 0.28rem 0.55rem;
  border: 1px solid rgba(56, 189, 248, 0.24);
  border-radius: 0.45rem;
  background: rgba(8, 47, 73, 0.24);
  color: #bae6fd;
  font-size: 0.78rem;
  font-weight: 600;
}

.timeline-controls {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.control-tabs {
  display: inline-flex;
  gap: 0.25rem;
  padding: 0.25rem;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 0.5rem;
  background: rgba(15, 23, 42, 0.45);
}

.range-tabs {
  min-width: 14rem;
}

.control-tab,
.refresh-btn,
.event-actions button {
  border: 1px solid rgba(96, 165, 250, 0.28);
  border-radius: 0.45rem;
  background: rgba(59, 130, 246, 0.08);
  color: #bfdbfe;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 500;
}

.control-tab {
  flex: 1;
  padding: 0.4rem 0.7rem;
  white-space: nowrap;
}

.control-tab.active {
  background: rgba(59, 130, 246, 0.28);
  color: #eff6ff;
}

.source-filter {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  max-width: min(100%, 17rem);
  color: #93c5fd;
  font-size: 0.82rem;
  font-weight: 600;
}

.source-filter select {
  min-width: 0;
  width: 12rem;
  max-width: 100%;
  border: 1px solid rgba(96, 165, 250, 0.28);
  border-radius: 0.45rem;
  background: rgba(15, 23, 42, 0.78);
  color: #dbeafe;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 500;
  padding: 0.45rem 0.65rem;
}

.refresh-btn {
  padding: 0.48rem 0.8rem;
}

.timeline-error {
  margin-bottom: 1rem;
  padding: 0.8rem 1rem;
  border: 1px solid rgba(251, 191, 36, 0.3);
  border-radius: 0.5rem;
  background: rgba(120, 53, 15, 0.2);
  color: #facc15;
}

.timeline-focus-notice {
  margin-bottom: 1rem;
  padding: 0.7rem 0.9rem;
  border: 1px solid rgba(56, 189, 248, 0.26);
  border-radius: 0.5rem;
  background: rgba(14, 116, 144, 0.18);
  color: #bae6fd;
  font-size: 0.86rem;
}

.timeline-container {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.timeline-day-group {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.timeline-day-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
  padding: 0 0 0.2rem 2.9rem;
  border-bottom: 1px solid rgba(148, 163, 184, 0.12);
}

.timeline-day-header h3 {
  margin: 0;
  color: #e0f2fe;
  font-size: 0.95rem;
  font-weight: 700;
}

.timeline-day-header span {
  min-width: 0;
  color: #94a3b8;
  font-size: 0.78rem;
  overflow-wrap: anywhere;
}

.timeline-item {
  display: grid;
  grid-template-columns: 2rem 1fr;
  gap: 0.9rem;
  cursor: pointer;
}

.timeline-item.focused .timeline-card {
  border-color: rgba(56, 189, 248, 0.58);
  background: rgba(8, 47, 73, 0.52);
  box-shadow: 0 0 0 1px rgba(56, 189, 248, 0.16);
}

.timeline-dot {
  width: 2rem;
  height: 2rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(96, 165, 250, 0.35);
  border-radius: 999px;
  background: rgba(30, 41, 59, 0.82);
}

.timeline-content {
  min-width: 0;
}

.timeline-meta {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-bottom: 0.45rem;
  color: #94a3b8;
  font-size: 0.78rem;
}

.timeline-meta span,
.timeline-meta time {
  max-width: 100%;
  overflow-wrap: anywhere;
}

.focus-pill {
  color: #e0f2fe;
  font-weight: 700;
}

.timeline-card {
  padding: 1rem;
  border: 1px solid rgba(148, 163, 184, 0.12);
  border-radius: 0.65rem;
  background: rgba(15, 23, 42, 0.58);
}

.timeline-card h3 {
  margin: 0 0 0.45rem;
  color: #e2e8f0;
  font-size: 1rem;
  font-weight: 600;
  line-height: 1.4;
  overflow-wrap: anywhere;
}

.timeline-card p {
  margin: 0;
  color: #cbd5e1;
  font-size: 0.88rem;
  line-height: 1.65;
  overflow-wrap: anywhere;
}

.timeline-channels {
  display: flex;
  gap: 0.35rem;
  flex-wrap: wrap;
  margin-top: 0.75rem;
}

.timeline-channels span {
  padding: 0.18rem 0.42rem;
  border: 1px solid rgba(96, 165, 250, 0.2);
  border-radius: 0.35rem;
  color: #bfdbfe;
  background: rgba(37, 99, 235, 0.12);
  font-size: 0.72rem;
}

.event-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-top: 0.85rem;
}

.event-actions button {
  padding: 0.42rem 0.7rem;
}

.event-actions button:disabled {
  cursor: wait;
  opacity: 0.7;
}

.feedback-btn.active {
  border-color: rgba(56, 189, 248, 0.5);
  background: rgba(14, 165, 233, 0.22);
  color: #e0f2fe;
}

.clear-feedback-btn {
  border-color: rgba(148, 163, 184, 0.22);
  background: rgba(15, 23, 42, 0.34);
  color: #cbd5e1;
}

.feedback-status {
  align-self: center;
  color: #bae6fd;
  font-size: 0.78rem;
  font-weight: 600;
}

.link-safety-note {
  padding: 0.32rem 0.55rem;
  border: 1px solid rgba(251, 191, 36, 0.24);
  border-radius: 0.45rem;
  background: rgba(120, 53, 15, 0.16);
  color: #fde68a;
  font-size: 0.76rem;
  font-weight: 600;
  line-height: 1.25;
  overflow-wrap: anywhere;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 1rem;
  color: #94a3b8;
  text-align: center;
}

.empty-state span {
  margin-bottom: 0.75rem;
  font-size: 2.4rem;
}

.empty-state p {
  margin: 0.2rem 0;
}

.empty-hint {
  max-width: 420px;
  line-height: 1.6;
  color: #64748b;
}

.empty-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  justify-content: center;
  margin-top: 1rem;
}

.empty-actions button {
  border: 1px solid rgba(96, 165, 250, 0.28);
  border-radius: 0.45rem;
  background: rgba(59, 130, 246, 0.08);
  color: #bfdbfe;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 500;
  padding: 0.42rem 0.7rem;
}

@media (max-width: 720px) {
  .timeline-header {
    flex-direction: column;
  }

  .timeline-controls {
    width: 100%;
    justify-content: flex-start;
  }

  .control-tabs,
  .source-filter,
  .source-filter select,
  .refresh-btn {
    width: 100%;
  }

  .range-tabs {
    min-width: 0;
  }

  .timeline-item {
    grid-template-columns: 1.75rem 1fr;
    gap: 0.65rem;
  }

  .timeline-day-header {
    flex-direction: column;
    gap: 0.25rem;
    padding-left: 2.4rem;
  }
}
</style>
