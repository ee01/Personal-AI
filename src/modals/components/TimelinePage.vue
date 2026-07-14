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
            :title="getTimelineRangeControlBoundary(option)"
            :aria-label="getTimelineRangeControlBoundary(option)"
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
            :title="getTimelineScopeControlBoundary(option)"
            :aria-label="getTimelineScopeControlBoundary(option)"
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
          :title="timelineSourceSelectBoundary"
        >
          <span>来源</span>
          <select
            id="timeline-source-filter"
            v-model="selectedSourceFilterKey"
            :title="timelineSourceSelectBoundary"
            :aria-label="timelineSourceSelectBoundary"
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
        <button
          class="refresh-btn"
          type="button"
          :title="timelineRefreshControlBoundary"
          :aria-label="timelineRefreshControlBoundary"
          @click="loadTimeline"
        >
          刷新
        </button>
      </div>
    </div>

    <div v-if="focusNotice" class="timeline-focus-notice">
      {{ focusNotice }}
    </div>

    <section
      v-if="timelineRefreshFailureReceipt"
      class="timeline-refresh-failure-receipt"
      aria-live="polite"
      aria-label="时间轴刷新失败回执"
    >
      <div class="receipt-title">
        {{ timelineRefreshFailureReceipt.title }}
      </div>
      <ul>
        <li v-for="item in timelineRefreshFailureReceipt.items" :key="item">
          {{ item }}
        </li>
      </ul>
    </section>

    <section
      v-if="timelineRefreshingSnapshotReceipt"
      class="timeline-refreshing-snapshot-receipt"
      aria-live="polite"
      aria-label="时间轴刷新中快照回执"
    >
      <div class="receipt-title">
        {{ timelineRefreshingSnapshotReceipt.title }}
      </div>
      <ul>
        <li
          v-for="item in timelineRefreshingSnapshotReceipt.items"
          :key="item"
        >
          {{ item }}
        </li>
      </ul>
    </section>

    <section
      v-if="navigationReceipt"
      :class="[
        'timeline-navigation-receipt',
        `timeline-navigation-receipt-${navigationReceipt.tone}`,
      ]"
      aria-live="polite"
      aria-label="时间轴打开回执"
    >
      <div class="receipt-title">{{ navigationReceipt.title }}</div>
      <ul>
        <li v-for="item in navigationReceipt.items" :key="item">
          {{ item }}
        </li>
      </ul>
    </section>

    <section
      v-if="feedbackReceipt"
      :class="[
        'timeline-feedback-receipt',
        `timeline-feedback-receipt-${feedbackReceipt.tone}`,
      ]"
      aria-live="polite"
      aria-label="时间轴反馈回执"
    >
      <div class="receipt-title">{{ feedbackReceipt.title }}</div>
      <ul>
        <li v-for="item in feedbackReceipt.items" :key="item">
          {{ item }}
        </li>
      </ul>
    </section>

    <section class="timeline-boundary-receipt" aria-label="时间轴回执">
      <div class="receipt-title">{{ timelineBoundaryReceipt.title }}</div>
      <ul>
        <li
          v-for="item in timelineBoundaryReceipt.items"
          :key="item"
        >
          {{ item }}
        </li>
      </ul>
    </section>

    <section
      v-if="timelineSourceCoverageItems.length > 1"
      class="timeline-source-overview"
      aria-label="时间轴来源覆盖"
    >
      <div class="source-overview-header">
        <div>
          <div class="receipt-title">来源覆盖</div>
          <p>{{ timelineSourceCoverageSummary }}</p>
        </div>
        <span>{{ timelineEvents.length }} 条已加载</span>
      </div>
      <div class="source-overview-chips">
        <button
          v-for="source in timelineSourceCoverageItems"
          :key="source.key"
          type="button"
          :class="[
            'source-overview-chip',
            {
              active: source.isActive,
              hidden: source.isHiddenByCurrentFilter,
            },
          ]"
          :aria-pressed="source.isActive"
          :title="getTimelineSourceChipBoundary(source)"
          :aria-label="getTimelineSourceChipBoundary(source)"
          @click="selectSourceFilter(source.key)"
        >
          <span>{{ source.label }}</span>
          <strong>{{ source.count }}</strong>
          <em v-if="source.isHiddenByCurrentFilter">已隐藏</em>
        </button>
      </div>
    </section>

    <div v-if="errorMessage" class="timeline-error">
      {{ errorMessage }}
    </div>

    <div v-if="shouldShowBlockingLoading" class="loading-container">
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
          :class="[
            'timeline-item',
            {
              focused: isFocusedEvent(event),
              'timeline-item-openable': hasSafeNavigationTarget(event),
              'timeline-item-blocked': isBlockedNavigationTarget(event),
              'timeline-item-readonly': isReadonlyNavigationTarget(event),
            },
          ]"
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
              <div
                :class="[
                  'memory-link-safety-status',
                  `memory-link-safety-status-${getLinkSafetyStatus(event).tone}`,
                ]"
                aria-label="链接安全状态"
              >
                <strong>{{ getLinkSafetyStatus(event).label }}</strong>
                <span>{{ getLinkSafetyStatus(event).detail }}</span>
                <div
                  v-if="getLinkSafetyStatus(event).metrics.length"
                  class="memory-link-safety-metrics"
                >
                  <em
                    v-for="metric in getLinkSafetyStatus(event).metrics"
                    :key="metric"
                  >
                    {{ metric }}
                  </em>
                </div>
              </div>
              <div
                :class="[
                  'timeline-click-affordance',
                  `timeline-click-affordance-${getTimelineClickAffordance(event).tone}`,
                ]"
                aria-label="时间轴卡片点击行为"
              >
                <strong>{{ getTimelineClickAffordance(event).label }}</strong>
                <span>{{ getTimelineClickAffordance(event).detail }}</span>
              </div>
              <div class="event-actions">
                <span
                  v-if="getFeedbackLabel(event)"
                  :class="[
                    'feedback-status',
                    `feedback-status-${getFeedbackStatusTone(event)}`,
                  ]"
                >
                  {{ getFeedbackLabel(event) }}
                </span>
                <button
                  type="button"
                  :class="[
                    'feedback-btn',
                    'feedback-btn-positive',
                    { active: isFeedbackActive(event, 'positive') },
                  ]"
                  :aria-pressed="isFeedbackActive(event, 'positive')"
                  :disabled="isFeedbackPending(event)"
                  :title="getTimelineFeedbackButtonBoundary(event, 'positive')"
                  :aria-label="getTimelineFeedbackButtonBoundary(event, 'positive')"
                  @click.stop="submitEventFeedback(event, 'positive')"
                >
                  有用
                </button>
                <button
                  type="button"
                  :class="[
                    'feedback-btn',
                    'feedback-btn-negative',
                    { active: isFeedbackActive(event, 'negative') },
                  ]"
                  :aria-pressed="isFeedbackActive(event, 'negative')"
                  :disabled="isFeedbackPending(event)"
                  :title="getTimelineFeedbackButtonBoundary(event, 'negative')"
                  :aria-label="getTimelineFeedbackButtonBoundary(event, 'negative')"
                  @click.stop="submitEventFeedback(event, 'negative')"
                >
                  不相关
                </button>
                <button
                  v-if="canClearFeedback(event)"
                  type="button"
                  class="feedback-btn clear-feedback-btn"
                  :disabled="isFeedbackPending(event)"
                  :title="getTimelineFeedbackButtonBoundary(event, 'clear')"
                  :aria-label="getTimelineFeedbackButtonBoundary(event, 'clear')"
                  @click.stop="submitEventFeedback(event, 'clear')"
                >
                  撤销反馈
                </button>
                <button
                  v-if="getLinkSafetyState(event).exploreRoute"
                  type="button"
                  :title="getTimelineMemoryRouteButtonBoundary(event)"
                  :aria-label="getTimelineMemoryRouteButtonBoundary(event)"
                  @click.stop="openExploreLink(event)"
                >
                  在记忆中查看
                </button>
                <button
                  v-if="getLinkSafetyState(event).sourceUrl"
                  type="button"
                  :title="getSourceButtonTitle(event)"
                  :aria-label="getSourceButtonTitle(event)"
                  @click.stop="openSourceUrl(event)"
                >
                  打开来源
                </button>
                <button
                  v-if="shouldShowLinkRecoveryDiagnostic(event)"
                  type="button"
                  :title="getTimelineRecoveryDiagnosticButtonBoundary(event)"
                  :aria-label="getTimelineRecoveryDiagnosticButtonBoundary(event)"
                  @click.stop="copyLinkRecoveryDiagnostic(event)"
                >
                  复制安全诊断
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
      <section class="timeline-empty-receipt" aria-label="时间轴空结果回执">
        <div class="receipt-title">{{ timelineEmptyReceipt.title }}</div>
        <ul>
          <li v-for="item in timelineEmptyReceipt.items" :key="item">
            {{ item }}
          </li>
        </ul>
      </section>
      <div class="empty-actions">
        <button
          v-if="selectedSourceFilterKey !== ALL_TIMELINE_SOURCE_FILTER_KEY"
          type="button"
          :title="timelineResetSourceBoundary"
          :aria-label="timelineResetSourceBoundary"
          @click="selectedSourceFilterKey = ALL_TIMELINE_SOURCE_FILTER_KEY"
        >
          查看全部来源
        </button>
        <button
          v-if="selectedRangeKey === 'today'"
          type="button"
          :title="timelineSevenDayRecoveryBoundary"
          :aria-label="timelineSevenDayRecoveryBoundary"
          @click="selectRange('7d')"
        >
          查看近7天
        </button>
        <button
          v-if="selectedScope !== 'all'"
          type="button"
          :title="timelineAllScopeRecoveryBoundary"
          :aria-label="timelineAllScopeRecoveryBoundary"
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
  buildTimelineRangeControlBoundary,
  buildTimelineLinkRecoveryCopiedReceipt,
  buildTimelineLinkRecoveryCopyFailureReceipt,
  buildTimelineLinkRecoveryDiagnostic,
  buildTimelineBoundaryReceipt,
  buildTimelineEmptyReceipt,
  buildTimelineFeedbackReceipt,
  buildTimelineNavigationReceipt,
  buildTimelineRefreshFailureReceipt,
  buildTimelineRefreshingSnapshotReceipt,
  buildTimelineRefreshControlBoundary,
  buildTimelineScopeControlBoundary,
  buildTimelineSourceControlBoundary,
  buildTimelineSourceFilterOptions,
  filterTimelineEventsBySource,
  getTimelineSourceFilterKey,
} from '../timelinePresentation';
import {
  formatMemoryLinkSafetyStatus,
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
type TimelineClickAffordanceTone = 'ready' | 'warning' | 'muted';

interface TimelineClickAffordance {
  tone: TimelineClickAffordanceTone;
  label: string;
  detail: string;
}

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
const refreshFailureMessage = ref('');
const navigationReceipt = ref<ReturnType<
  typeof buildTimelineNavigationReceipt
> | null>(null);
const feedbackReceipt = ref<ReturnType<typeof buildTimelineFeedbackReceipt> | null>(
  null,
);
const loadedTimelineRequestKey = ref('');
const isLoading = computed(() => store.isLoading);
const isRefreshingSameSnapshot = computed(
  () =>
    isLoading.value &&
    timelineEvents.value.length > 0 &&
    loadedTimelineRequestKey.value === getTimelineRequestKey(),
);
const shouldShowBlockingLoading = computed(
  () => isLoading.value && !isRefreshingSameSnapshot.value,
);

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
const timelineSourceCoverageItems = computed(() =>
  timelineSourceOptions.value.map((option) => ({
    ...option,
    isActive: selectedSourceFilterKey.value === option.key,
    isHiddenByCurrentFilter:
      selectedSourceFilterKey.value !== ALL_TIMELINE_SOURCE_FILTER_KEY &&
      selectedSourceFilterKey.value !== option.key,
  })),
);
const timelineSourceCoverageSummary = computed(() => {
  if (selectedSourceFilterKey.value === ALL_TIMELINE_SOURCE_FILTER_KEY) {
    return '当前展示全部来源；点击来源只会收窄这批已加载结果，不会扩大检索范围。';
  }
  return `当前只显示 ${selectedSourceFilterLabel.value}；其余来源被临时隐藏，点击 chip 可在本批结果内切换。`;
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
const focusedTimelineEvent = computed(() =>
  timelineEvents.value.find(isFocusedEvent),
);
const timelineBoundaryReceipt = computed(() =>
  buildTimelineBoundaryReceipt({
    scope: selectedScope.value,
    rangeLabel: selectedRangeOption.value.label,
    sourceFilterKey: selectedSourceFilterKey.value,
    sourceFilterLabel: selectedSourceFilterLabel.value,
    totalEventCount: timelineEvents.value.length,
    visibleEventCount: filteredTimelineEvents.value.length,
    hasFocusedEvent: Boolean(focusedTimelineEvent.value),
    isLoading: isLoading.value,
  }),
);
const timelineEmptyReceipt = computed(() =>
  buildTimelineEmptyReceipt({
    scope: selectedScope.value,
    rangeLabel: selectedRangeOption.value.label,
    sourceFilterKey: selectedSourceFilterKey.value,
    sourceFilterLabel: selectedSourceFilterLabel.value,
    totalEventCount: timelineEvents.value.length,
    visibleEventCount: filteredTimelineEvents.value.length,
  }),
);
const timelineRefreshFailureReceipt = computed(() => {
  if (!refreshFailureMessage.value) return null;
  return buildTimelineRefreshFailureReceipt({
    scope: selectedScope.value,
    rangeLabel: selectedRangeOption.value.label,
    sourceFilterLabel: selectedSourceFilterLabel.value,
    totalEventCount: timelineEvents.value.length,
    visibleEventCount: filteredTimelineEvents.value.length,
    errorMessage: refreshFailureMessage.value,
  });
});
const timelineRefreshingSnapshotReceipt = computed(() => {
  if (!isRefreshingSameSnapshot.value) return null;
  return buildTimelineRefreshingSnapshotReceipt({
    scope: selectedScope.value,
    rangeLabel: selectedRangeOption.value.label,
    sourceFilterLabel: selectedSourceFilterLabel.value,
    totalEventCount: timelineEvents.value.length,
    visibleEventCount: filteredTimelineEvents.value.length,
  });
});
const timelineSourceSelectBoundary = computed(
  () =>
    `按来源筛选时间轴；${buildTimelineSourceControlBoundary({
      sourceFilterLabel: selectedSourceFilterLabel.value,
      sourceCount: filteredTimelineEvents.value.length,
      totalEventCount: timelineEvents.value.length,
      isAllSources:
        selectedSourceFilterKey.value === ALL_TIMELINE_SOURCE_FILTER_KEY,
      isActive: true,
    })}`,
);
const timelineRefreshControlBoundary = computed(() =>
  buildTimelineRefreshControlBoundary({
    scope: selectedScope.value,
    rangeLabel: selectedRangeOption.value.label,
    sourceFilterLabel: selectedSourceFilterLabel.value,
  }),
);
const timelineResetSourceBoundary = computed(
  () =>
    `查看全部来源；${buildTimelineSourceControlBoundary({
      sourceFilterLabel: '全部来源',
      sourceCount: timelineEvents.value.length,
      totalEventCount: timelineEvents.value.length,
      isAllSources: true,
      isActive:
        selectedSourceFilterKey.value === ALL_TIMELINE_SOURCE_FILTER_KEY,
    })}`,
);
const timelineSevenDayRecoveryBoundary = computed(
  () =>
    `查看近7天；${buildTimelineRangeControlBoundary({
      rangeLabel: '近7天',
      scope: selectedScope.value,
      isActive: selectedRangeKey.value === '7d',
    })}`,
);
const timelineAllScopeRecoveryBoundary = computed(
  () =>
    `切到全部；${buildTimelineScopeControlBoundary({
      scope: 'all',
      isActive: selectedScope.value === 'all',
    })}`,
);

function getTimelineRangeControlBoundary(option: TimelineRangeOption): string {
  return buildTimelineRangeControlBoundary({
    rangeLabel: option.label,
    scope: selectedScope.value,
    isActive: selectedRangeKey.value === option.key,
  });
}

function getTimelineScopeControlBoundary(option: {
  key: RecallScope;
  label: string;
}): string {
  return buildTimelineScopeControlBoundary({
    scope: option.key,
    isActive: selectedScope.value === option.key,
  });
}

function getTimelineSourceChipBoundary(source: {
  key: string;
  label: string;
  count: number;
  isActive: boolean;
  isHiddenByCurrentFilter?: boolean;
}): string {
  const boundary = buildTimelineSourceControlBoundary({
    sourceFilterLabel: source.label,
    sourceCount: source.count,
    totalEventCount: timelineEvents.value.length,
    isAllSources: source.key === ALL_TIMELINE_SOURCE_FILTER_KEY,
    isActive: source.isActive,
  });
  if (!source.isHiddenByCurrentFilter) return boundary;
  return boundary.replace(
    `${source.label} ${source.count}`,
    `${source.label} ${source.count} 已隐藏`,
  );
}

function getTimelineFeedbackButtonBoundary(
  event: MemoryTimelineEvent,
  action: MemoryFeedbackAction,
): string {
  const title = event.title || '当前时间轴记忆';
  const actionLabel =
    action === 'positive'
      ? '有用'
      : action === 'negative'
      ? '不相关'
      : '撤销反馈';
  const target = `${event.type}:${event.id}`;
  if (isFeedbackPending(event)) {
    return `${actionLabel}：${title}；这条时间轴反馈正在提交，暂不重复发送 /feedback；不会删除、隐藏、外发、写画像或立即重排本页列表。`;
  }
  if (action !== 'clear' && isFeedbackActive(event, action)) {
    return `${actionLabel}：${title}；当前已记录为“${actionLabel}”，再次点击不会重复写入 /feedback；不会删除、隐藏、外发、写画像或立即重排本页列表。`;
  }
  if (action === 'clear') {
    return `撤销反馈：${title}；只撤销 ${target} 的 recall_quality 反馈，不删除记忆、不重新读取来源、不外发内容、不写画像，也不会立即重排本页列表。`;
  }
  return `${actionLabel}：${title}；向 /feedback 写入 ${target} 的 recall_quality=${action}，当前范围是 ${getScopeLabel(
    selectedScope.value,
  )} · ${selectedRangeOption.value.label} · ${
    selectedSourceFilterLabel.value
  }；不会删除、隐藏、外发、写画像或立即重排本页列表。`;
}

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

function getTimelineRequestKey(
  scope = selectedScope.value,
  rangeKey = selectedRangeKey.value,
): string {
  return `${scope}:${rangeKey}`;
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

function revealFocusedEventIfSourceFiltered(event: MemoryTimelineEvent): boolean {
  if (selectedSourceFilterKey.value === ALL_TIMELINE_SOURCE_FILTER_KEY) {
    return false;
  }
  if (getTimelineSourceFilterKey(event) === selectedSourceFilterKey.value) {
    return false;
  }
  selectedSourceFilterKey.value = ALL_TIMELINE_SOURCE_FILTER_KEY;
  return true;
}

async function applyFocusedTimelineEvent() {
  focusNotice.value = '';
  const focusId = getRouteFocusId();
  if (!focusId) return;

  const existingFocusedEvent = timelineEvents.value.find(isFocusedEvent);
  if (existingFocusedEvent) {
    if (revealFocusedEventIfSourceFiltered(existingFocusedEvent)) {
      focusNotice.value =
        '已显示定位记忆，并清除来源筛选；原筛选不包含这条记忆。';
    }
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
  const clearedSourceFilter = revealFocusedEventIfSourceFiltered(focusedEvent);
  reconcileSourceFilter();
  focusNotice.value = clearedSourceFilter
    ? '已置顶定位记忆，并清除来源筛选；它可能不属于当前时间范围或当前来源。'
    : '已置顶定位记忆；它可能不属于当前时间范围。';
  await scrollFocusedEventIntoView();
}

const loadTimeline = async () => {
  store.isLoading = true;
  errorMessage.value = '';
  focusNotice.value = '';
  refreshFailureMessage.value = '';
  feedbackReceipt.value = null;
  const rangeOption = selectedRangeOption.value;
  const requestKey = getTimelineRequestKey();
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
    loadedTimelineRequestKey.value = requestKey;
    hydrateFeedbackStateFromEvents(timelineEvents.value);
    await applyFocusedTimelineEvent();
    reconcileSourceFilter();
  } catch (error: any) {
    const message =
      error?.message || '时间轴暂时无法连接 Memory Service，请稍后刷新。';
    const canKeepSameSnapshot =
      loadedTimelineRequestKey.value === requestKey &&
      timelineEvents.value.length > 0;

    if (canKeepSameSnapshot) {
      refreshFailureMessage.value = message;
    } else {
      timelineEvents.value = [];
      loadedTimelineRequestKey.value = '';
      selectedSourceFilterKey.value = ALL_TIMELINE_SOURCE_FILTER_KEY;
      errorMessage.value = message;
    }
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
  navigationReceipt.value = null;
  feedbackReceipt.value = null;
  syncRouteSelection();
  void loadTimeline();
};

const selectScope = (scope: RecallScope) => {
  if (selectedScope.value === scope) return;
  selectedScope.value = scope;
  navigationReceipt.value = null;
  feedbackReceipt.value = null;
  syncRouteSelection();
  void loadTimeline();
};

const selectSourceFilter = (sourceKey: string) => {
  selectedSourceFilterKey.value = sourceKey || ALL_TIMELINE_SOURCE_FILTER_KEY;
  navigationReceipt.value = null;
  feedbackReceipt.value = null;
};

const getLinkSafetyState = (event: MemoryTimelineEvent) =>
  getMemoryLinkSafetyState({
    exploreLink: event.exploreLink,
    sourceUrl: event.sourceUrl,
  });

const getLinkSafetyStatus = (event: MemoryTimelineEvent) =>
  formatMemoryLinkSafetyStatus(getLinkSafetyState(event));

const getSourceButtonTitle = (event: MemoryTimelineEvent) => {
  const host = getLinkSafetyState(event).sourceHost || '安全 http/https 来源';
  return `打开来源：${host}；在新标签页打开已净化来源，使用 noopener/noreferrer；不会重新读取、同步或确认来源内容。`;
};

const getTimelineMemoryRouteButtonBoundary = (event: MemoryTimelineEvent) => {
  const title = event.title || '当前时间轴记忆';
  const route = getLinkSafetyState(event).exploreRoute || '记忆内路由';
  return `在记忆中查看：${title}；只切换 Memory Exploring 内部视图 ${route}，不会打开外部网页、改写记忆、写反馈或同步来源。`;
};

const getTimelineRecoveryDiagnosticButtonBoundary = (
  event: MemoryTimelineEvent,
) => {
  const title = event.title || '当前时间轴记忆';
  const blockedCount = getLinkSafetyState(event).blockedLabels.length;
  const status = blockedCount > 0
    ? `${blockedCount} 项拦截原因`
    : '没有安全内链或 http/https 来源';
  return `复制安全诊断：${title}；只复制标题、时间、来源标签、记忆 key 和${status}，不复制被拦截原始 URL，也不会写入、同步、确认或重新读取来源。`;
};

const hasSafeNavigationTarget = (event: MemoryTimelineEvent): boolean => {
  const safetyState = getLinkSafetyState(event);
  return Boolean(safetyState.exploreRoute || safetyState.sourceUrl);
};

const isBlockedNavigationTarget = (event: MemoryTimelineEvent): boolean => {
  const safetyState = getLinkSafetyState(event);
  return (
    !safetyState.exploreRoute &&
    !safetyState.sourceUrl &&
    safetyState.blockedLabels.length > 0
  );
};

const isReadonlyNavigationTarget = (event: MemoryTimelineEvent): boolean => {
  const safetyState = getLinkSafetyState(event);
  return (
    !safetyState.exploreRoute &&
    !safetyState.sourceUrl &&
    safetyState.blockedLabels.length === 0
  );
};

const getTimelineClickAffordance = (
  event: MemoryTimelineEvent,
): TimelineClickAffordance => {
  const safetyState = getLinkSafetyState(event);
  if (safetyState.exploreRoute) {
    return {
      tone: 'ready',
      label: '卡片点击：在记忆中查看',
      detail:
        '只切换 Memory Exploring 内部视图；打开外部来源需点“打开来源”，不会改写记忆或反馈。',
    };
  }
  if (safetyState.sourceUrl) {
    return {
      tone: 'ready',
      label: '卡片点击：显示打开边界',
      detail: `这条记忆可通过“打开来源”按钮打开 ${
        safetyState.sourceHost || 'http/https 来源'
      }；卡片点击不会直接打开外部标签页。`,
    };
  }
  if (safetyState.blockedLabels.length > 0) {
    return {
      tone: 'warning',
      label: '卡片点击：查看拦截原因',
      detail: `${safetyState.blockedLabels.length} 项目标被隐藏，不会打开外部网页；可复制安全诊断继续找原文。`,
    };
  }
  return {
    tone: 'muted',
    label: '只读卡片',
    detail:
      '没有安全内链或 http/https 来源；可先阅读内容，或切换时间范围、来源筛选重新定位。',
  };
};

const setBlockedNavigationReceipt = (event: MemoryTimelineEvent) => {
  const safetyState = getLinkSafetyState(event);
  navigationReceipt.value = buildTimelineNavigationReceipt({
    action: safetyState.blockedLabels.length ? 'blocked' : 'unavailable',
    eventTitle: event.title,
    blockedLabels: safetyState.blockedLabels,
  });
};

const shouldShowLinkRecoveryDiagnostic = (event: MemoryTimelineEvent) => {
  const safetyState = getLinkSafetyState(event);
  return !safetyState.exploreRoute && !safetyState.sourceUrl;
};

async function writeTimelineClipboardText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  textarea.style.top = '0';
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  document.body.removeChild(textarea);
  if (!copied) {
    throw new Error('clipboard_unavailable');
  }
}

async function copyLinkRecoveryDiagnostic(event: MemoryTimelineEvent) {
  const safetyState = getLinkSafetyState(event);
  const diagnostic = buildTimelineLinkRecoveryDiagnostic({
    event,
    blockedLabels: safetyState.blockedLabels,
    scopeLabel: getScopeLabel(selectedScope.value),
    rangeLabel: selectedRangeOption.value.label,
    sourceFilterLabel: selectedSourceFilterLabel.value,
  });

  try {
    await writeTimelineClipboardText(diagnostic);
    navigationReceipt.value = buildTimelineLinkRecoveryCopiedReceipt({
      eventTitle: event.title,
    });
  } catch (_error) {
    navigationReceipt.value = buildTimelineLinkRecoveryCopyFailureReceipt({
      eventTitle: event.title,
    });
  }
}

const openExploreLink = (event: MemoryTimelineEvent) => {
  const safeExploreRoute = sanitizeMemoryExploreRoute(event.exploreLink);
  if (!safeExploreRoute) return false;
  navigationReceipt.value = buildTimelineNavigationReceipt({
    action: 'memory_route',
    eventTitle: event.title,
    exploreRoute: safeExploreRoute,
  });
  router.push(safeExploreRoute.slice(1));
  return true;
};

const openSourceUrl = (event: MemoryTimelineEvent) => {
  const safetyState = getLinkSafetyState(event);
  const safeSourceUrl = safetyState.sourceUrl;
  if (!safeSourceUrl) return false;
  navigationReceipt.value = buildTimelineNavigationReceipt({
    action: 'source_url',
    eventTitle: event.title,
    sourceHost: safetyState.sourceHost,
  });
  window.open(safeSourceUrl, '_blank', 'noopener,noreferrer');
  return true;
};

const previewSourceUrlBoundary = (event: MemoryTimelineEvent) => {
  const safetyState = getLinkSafetyState(event);
  if (!safetyState.sourceUrl) return false;
  navigationReceipt.value = buildTimelineNavigationReceipt({
    action: 'source_url_ready',
    eventTitle: event.title,
    sourceHost: safetyState.sourceHost,
  });
  return true;
};

const handleEventClick = (event: MemoryTimelineEvent) => {
  const safetyState = getLinkSafetyState(event);
  if (safetyState.exploreRoute && openExploreLink(event)) return;
  if (safetyState.sourceUrl && previewSourceUrlBoundary(event)) return;
  setBlockedNavigationReceipt(event);
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

function getFeedbackStatusTone(event: MemoryTimelineEvent): string {
  const state = feedbackByResultKey.value[event.resultKey];
  if (
    state === 'pending' ||
    state === 'positive' ||
    state === 'negative' ||
    state === 'cleared'
  ) {
    return state;
  }
  return 'cleared';
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
  feedbackReceipt.value = buildTimelineFeedbackReceipt({
    status: 'pending',
    action: action as 'positive' | 'negative' | 'clear',
    eventTitle: event.title,
    targetType: event.type,
    targetId: event.id,
    scope: selectedScope.value,
    rangeLabel: selectedRangeOption.value.label,
    sourceFilterLabel: selectedSourceFilterLabel.value,
  });
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
    feedbackReceipt.value = buildTimelineFeedbackReceipt({
      status: action === 'clear' ? 'cleared' : 'success',
      action: action as 'positive' | 'negative' | 'clear',
      eventTitle: event.title,
      targetType: event.type,
      targetId: event.id,
      scope: selectedScope.value,
      rangeLabel: selectedRangeOption.value.label,
      sourceFilterLabel: selectedSourceFilterLabel.value,
    });
  } catch (error: any) {
    setFeedbackState(
      event.resultKey,
      previousState === 'positive' ||
        previousState === 'negative' ||
        previousState === 'cleared'
        ? previousState
        : undefined,
    );
    feedbackReceipt.value = buildTimelineFeedbackReceipt({
      status: 'failure',
      action: action as 'positive' | 'negative' | 'clear',
      eventTitle: event.title,
      targetType: event.type,
      targetId: event.id,
      scope: selectedScope.value,
      rangeLabel: selectedRangeOption.value.label,
      sourceFilterLabel: selectedSourceFilterLabel.value,
      errorMessage: error?.message || '反馈暂时无法提交，请稍后再试。',
    });
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

.timeline-navigation-receipt,
.timeline-refresh-failure-receipt,
.timeline-refreshing-snapshot-receipt,
.timeline-feedback-receipt {
  display: grid;
  gap: 0.55rem;
  margin-bottom: 1rem;
  padding: 0.8rem 0.95rem;
  border: 1px solid rgba(56, 189, 248, 0.22);
  border-radius: 0.5rem;
  background: rgba(8, 47, 73, 0.22);
}

.timeline-refresh-failure-receipt {
  border-color: rgba(251, 191, 36, 0.32);
  background: rgba(120, 53, 15, 0.18);
}

.timeline-refreshing-snapshot-receipt {
  border-color: rgba(56, 189, 248, 0.32);
  background: rgba(8, 47, 73, 0.3);
}

.timeline-feedback-receipt-success {
  border-color: rgba(34, 197, 94, 0.32);
  background: rgba(22, 101, 52, 0.2);
}

.timeline-feedback-receipt-warning {
  border-color: rgba(251, 191, 36, 0.32);
  background: rgba(120, 53, 15, 0.18);
}

.timeline-navigation-receipt-warning {
  border-color: rgba(251, 191, 36, 0.32);
  background: rgba(120, 53, 15, 0.18);
}

.timeline-navigation-receipt ul,
.timeline-refresh-failure-receipt ul,
.timeline-refreshing-snapshot-receipt ul,
.timeline-feedback-receipt ul {
  display: grid;
  gap: 0.35rem;
  margin: 0;
  padding-left: 1.1rem;
  color: #b8c7da;
  font-size: 0.8rem;
  line-height: 1.55;
}

.timeline-navigation-receipt li,
.timeline-refresh-failure-receipt li,
.timeline-refreshing-snapshot-receipt li,
.timeline-feedback-receipt li {
  overflow-wrap: anywhere;
}

.timeline-boundary-receipt {
  display: grid;
  gap: 0.55rem;
  margin-bottom: 1rem;
  padding: 0.8rem 0.95rem;
  border: 1px solid rgba(148, 163, 184, 0.16);
  border-radius: 0.5rem;
  background: rgba(15, 23, 42, 0.4);
}

.receipt-title {
  color: #dbeafe;
  font-size: 0.86rem;
  font-weight: 700;
}

.timeline-boundary-receipt ul {
  display: grid;
  gap: 0.35rem;
  margin: 0;
  padding-left: 1.1rem;
  color: #a7b5c9;
  font-size: 0.8rem;
  line-height: 1.55;
}

.timeline-boundary-receipt li {
  overflow-wrap: anywhere;
}

.timeline-empty-receipt {
  display: grid;
  gap: 0.55rem;
  width: min(100%, 560px);
  margin-top: 1rem;
  padding: 0.8rem 0.95rem;
  border: 1px solid rgba(45, 212, 191, 0.18);
  border-radius: 0.5rem;
  background: rgba(20, 83, 45, 0.14);
  text-align: left;
}

.timeline-empty-receipt ul {
  display: grid;
  gap: 0.35rem;
  margin: 0;
  padding-left: 1.1rem;
  color: #a7f3d0;
  font-size: 0.8rem;
  line-height: 1.55;
}

.timeline-empty-receipt li {
  overflow-wrap: anywhere;
}

.timeline-source-overview {
  display: grid;
  gap: 0.7rem;
  margin-bottom: 1rem;
  padding: 0.8rem 0.95rem;
  border: 1px solid rgba(45, 212, 191, 0.18);
  border-radius: 0.5rem;
  background: rgba(20, 83, 45, 0.16);
}

.source-overview-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.85rem;
}

.source-overview-header p {
  margin: 0.22rem 0 0;
  color: #a7f3d0;
  font-size: 0.8rem;
  line-height: 1.45;
}

.source-overview-header span {
  flex: 0 0 auto;
  color: #99f6e4;
  font-size: 0.78rem;
  font-weight: 700;
}

.source-overview-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.source-overview-chip {
  display: inline-flex;
  align-items: center;
  min-width: 0;
  max-width: 100%;
  gap: 0.4rem;
  padding: 0.38rem 0.58rem;
  border: 1px solid rgba(45, 212, 191, 0.24);
  border-radius: 0.45rem;
  background: rgba(15, 118, 110, 0.16);
  color: #ccfbf1;
  cursor: pointer;
  font-size: 0.78rem;
  font-weight: 600;
}

.source-overview-chip span {
  min-width: 0;
  overflow-wrap: anywhere;
}

.source-overview-chip strong {
  color: #f8fafc;
  font-size: 0.78rem;
}

.source-overview-chip em {
  color: #fde68a;
  font-size: 0.72rem;
  font-style: normal;
}

.source-overview-chip.active {
  border-color: rgba(56, 189, 248, 0.5);
  background: rgba(8, 47, 73, 0.42);
  color: #e0f2fe;
}

.source-overview-chip.hidden {
  border-color: rgba(251, 191, 36, 0.24);
  background: rgba(120, 53, 15, 0.14);
  color: #fef3c7;
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
  cursor: default;
}

.timeline-item-openable {
  cursor: pointer;
}

.timeline-item.focused .timeline-card {
  border-color: rgba(56, 189, 248, 0.58);
  background: rgba(8, 47, 73, 0.52);
  box-shadow: 0 0 0 1px rgba(56, 189, 248, 0.16);
}

.timeline-item-blocked .timeline-card {
  border-color: rgba(251, 191, 36, 0.24);
}

.timeline-item-readonly .timeline-card {
  border-color: rgba(148, 163, 184, 0.16);
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

.feedback-btn-positive.active {
  border-color: rgba(34, 197, 94, 0.46);
  background: rgba(22, 163, 74, 0.18);
  color: #bbf7d0;
}

.feedback-btn-negative.active {
  border-color: rgba(248, 113, 113, 0.5);
  background: rgba(127, 29, 29, 0.2);
  color: #fecaca;
}

.clear-feedback-btn {
  border-color: rgba(148, 163, 184, 0.22);
  background: rgba(15, 23, 42, 0.34);
  color: #cbd5e1;
}

.feedback-status {
  align-self: center;
  color: #cbd5e1;
  font-size: 0.78rem;
  font-weight: 600;
}

.feedback-status-pending {
  color: #fde68a;
}

.feedback-status-positive {
  color: #bbf7d0;
}

.feedback-status-negative {
  color: #fecaca;
}

.feedback-status-cleared {
  color: #cbd5e1;
}

.memory-link-safety-status {
  display: grid;
  gap: 0.3rem;
  margin: 0.65rem 0 0;
  padding: 0.6rem 0.7rem;
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 0.5rem;
  background: rgba(15, 23, 42, 0.44);
  color: #cbd5e1;
  font-size: 0.78rem;
  line-height: 1.35;
}

.memory-link-safety-status strong {
  color: #e2e8f0;
  font-size: 0.8rem;
}

.memory-link-safety-status span {
  overflow-wrap: anywhere;
}

.memory-link-safety-status-ready {
  border-color: rgba(45, 212, 191, 0.3);
  background: rgba(20, 83, 45, 0.16);
  color: #ccfbf1;
}

.memory-link-safety-status-warning {
  border-color: rgba(251, 191, 36, 0.34);
  background: rgba(120, 53, 15, 0.18);
  color: #fde68a;
}

.memory-link-safety-status-muted {
  color: #94a3b8;
}

.memory-link-safety-metrics {
  display: flex;
  gap: 0.35rem;
  flex-wrap: wrap;
}

.memory-link-safety-metrics em {
  padding: 0.16rem 0.42rem;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.32);
  color: inherit;
  font-size: 0.72rem;
  font-style: normal;
  font-weight: 600;
}

.timeline-click-affordance {
  display: grid;
  gap: 0.28rem;
  margin-top: 0.65rem;
  padding: 0.55rem 0.65rem;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 0.45rem;
  background: rgba(15, 23, 42, 0.32);
  color: #cbd5e1;
  font-size: 0.76rem;
  line-height: 1.38;
}

.timeline-click-affordance strong {
  color: #e2e8f0;
  font-size: 0.78rem;
}

.timeline-click-affordance span {
  overflow-wrap: anywhere;
}

.timeline-click-affordance-ready {
  border-color: rgba(45, 212, 191, 0.24);
  background: rgba(20, 83, 45, 0.12);
  color: #ccfbf1;
}

.timeline-click-affordance-warning {
  border-color: rgba(251, 191, 36, 0.28);
  background: rgba(120, 53, 15, 0.14);
  color: #fde68a;
}

.timeline-click-affordance-muted {
  color: #94a3b8;
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

  .source-overview-header {
    flex-direction: column;
    gap: 0.35rem;
  }

  .source-overview-header span {
    flex: 0 1 auto;
  }

  .source-overview-chip {
    width: 100%;
    justify-content: space-between;
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
