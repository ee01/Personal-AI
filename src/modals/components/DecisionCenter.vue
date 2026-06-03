<template>
  <div class="decision-center">
    <div class="header-row">
      <div>
        <h2 class="section-title">⚖ 决策中心 ({{ decisionTotal }})</h2>
        <p class="section-subtitle">
          仅统计真正待拍板的 decision 项，观察项收纳在下方待观察池。
        </p>
      </div>
      <button class="refresh-btn" :disabled="loading" @click="loadQueues()">
        刷新
      </button>
    </div>

    <div v-if="loading" class="loading-container">
      <div class="loading-spinner"></div>
      <p>加载中...</p>
    </div>

    <template v-else>
      <div v-if="loadError" class="load-error">
        <div>
          <div class="load-error-title">决策中心暂时不可用</div>
          <p>{{ loadError }}</p>
        </div>
        <button class="load-error-retry" @click="loadQueues()">重试</button>
      </div>

      <div v-if="queueWarningText && !loadError" class="partial-load-warning">
        <div>
          <div class="partial-load-warning-title">部分队列刷新失败</div>
          <p>{{ queueWarningText }}</p>
        </div>
        <button class="partial-load-retry" @click="loadQueues()">重试全部</button>
      </div>

      <div v-if="targetNotice" class="target-notice" :class="targetNotice.kind">
        <div>
          <div class="target-notice-title">{{ targetNotice.title }}</div>
          <p>{{ targetNotice.body }}</p>
        </div>
      </div>

      <section class="lane-section">
        <div class="lane-header">
          <div>
            <h3 class="lane-title">需你拍板</h3>
            <p class="lane-note">
              只展示 queue=decision 且 state=pending 的确认项。
            </p>
          </div>
          <span class="lane-count">{{ decisionTotal }}</span>
        </div>

        <div v-if="queueErrors.decisionPending" class="lane-error">
          {{ queueErrors.decisionPending }}
        </div>

        <div
          v-if="decisionRequests.length === 0 && !queueErrors.decisionPending"
          class="empty-state compact"
        >
          <span>✅</span>
          <p>暂无待处理决策</p>
        </div>

        <TransitionGroup v-else name="card" tag="div" class="decision-list">
          <div
            v-for="req in decisionRequests"
            :key="req.id"
            class="decision-card"
            :class="{ 'deep-link-target': req.id === targetConfirmRequestId }"
            :data-request-id="req.id"
          >
            <div class="card-top">
              <span
                class="priority-badge"
                :class="priorityClass(req.priority)"
                >{{ priorityLabel(req.priority) }}</span
              >
              <span class="reason-badge">{{ reasonLabel(req) }}</span>
              <span v-if="req.category" class="category-tag">{{
                req.category
              }}</span>
              <span class="created-time">{{
                relativeTime(req.createdAt)
              }}</span>
            </div>

            <h3 class="question-text">{{ req.question }}</h3>
            <div
              v-if="isMessageRuleImprovement(req)"
              class="improvement-context"
            >
              <div class="improvement-title">
                {{ messageRuleImprovementSummary(req) }}
              </div>
              <div class="improvement-reason">
                {{ messageRuleImprovementReason(req) }}
              </div>
            </div>
            <p v-else-if="req.context" class="context-text">
              {{ req.context }}
            </p>

            <div class="review-context">
              <div class="review-context-header">
                <span>审核上下文</span>
                <button
                  class="copy-review-btn"
                  :disabled="submitting[req.id]"
                  @click="copyDecisionReview(req)"
                >
                  复制审核包
                </button>
              </div>
              <div v-if="req.evidenceRefs?.length" class="evidence-list">
                <span
                  v-for="ref in visibleEvidenceRefs(req)"
                  :key="ref"
                  class="evidence-chip"
                  :title="ref"
                >
                  {{ evidenceRefLabel(ref) }}
                </span>
                <span
                  v-if="hiddenEvidenceCount(req) > 0"
                  class="evidence-chip muted"
                >
                  另有 {{ hiddenEvidenceCount(req) }} 条
                </span>
              </div>
              <div v-else class="evidence-empty">
                未附带证据引用；请根据问题和上下文判断。
              </div>
              <div class="option-preview">可选项：{{ optionPreview(req) }}</div>
              <div v-if="copyStatus[req.id]" class="copy-status">
                {{ copyStatus[req.id] }}
              </div>
            </div>

            <div class="meta-row">
              <span>来源 {{ routeLabel(req) }}</span>
              <span v-if="req.updatedAt"
                >最近更新 {{ relativeTime(req.updatedAt) }}</span
              >
            </div>

            <div v-if="cardErrors[req.id]" class="card-error">
              {{ cardErrors[req.id] }}
            </div>

            <div class="detail-toggle" @click="toggleDetail(req.id)">
              {{ showDetail[req.id] ? '收起备注 ▲' : '添加备注 ▼' }}
            </div>
            <textarea
              v-if="showDetail[req.id]"
              v-model="detailTexts[req.id]"
              class="detail-input"
              placeholder="可选：补充说明..."
              rows="2"
            />

            <div class="action-buttons">
              <template v-if="isMessageRuleImprovement(req)">
                <button
                  class="option-btn yes"
                  :disabled="submitting[req.id]"
                  @click="openMessageRuleImprovement(req)"
                >
                  {{ submitting[req.id] ? '打开中...' : '打开规则并应用建议' }}
                </button>
                <button
                  class="option-btn quiet"
                  :disabled="submitting[req.id]"
                  @click="submitAnswer(req.id, 'dismissed')"
                >
                  {{ submitting[req.id] ? '提交中...' : '忽略' }}
                </button>
              </template>
              <template v-else-if="req.options && req.options.length > 0">
                <button
                  v-for="opt in req.options"
                  :key="opt.value"
                  class="option-btn"
                  :disabled="submitting[req.id]"
                  @click="submitAnswer(req.id, opt.value)"
                >
                  {{ submitting[req.id] ? '提交中...' : opt.label }}
                </button>
              </template>
              <template v-else>
                <button
                  class="option-btn yes"
                  :disabled="submitting[req.id]"
                  @click="submitAnswer(req.id, 'yes')"
                >
                  {{ submitting[req.id] ? '提交中...' : '是' }}
                </button>
                <button
                  class="option-btn no"
                  :disabled="submitting[req.id]"
                  @click="submitAnswer(req.id, 'no')"
                >
                  {{ submitting[req.id] ? '提交中...' : '否' }}
                </button>
              </template>
              <button
                class="option-btn quiet"
                :disabled="submitting[req.id]"
                @click="transitionDecisionRequest(req.id, 'snoozed')"
              >
                {{ submitting[req.id] ? '处理中...' : '稍后再决定' }}
              </button>
            </div>
          </div>
        </TransitionGroup>
      </section>

      <section class="lane-section deferred-section">
        <button
          class="watch-toggle"
          @click="deferredCollapsed = !deferredCollapsed"
        >
          <div>
            <h3 class="lane-title">稍后决策</h3>
            <p class="lane-note">
              已从主队列暂时收起的 decision 项，到期后会回到待拍板。
            </p>
          </div>
          <div class="watch-toggle-side">
            <span class="lane-count muted">{{ decisionSnoozedTotal }}</span>
            <span class="watch-chevron">{{
              deferredCollapsed ? '▼' : '▲'
            }}</span>
          </div>
        </button>

        <div v-if="!deferredCollapsed" class="watch-content">
          <div v-if="queueErrors.decisionSnoozed" class="lane-error">
            {{ queueErrors.decisionSnoozed }}
          </div>

          <div
            v-if="
              deferredDecisionRequests.length === 0 &&
              !queueErrors.decisionSnoozed
            "
            class="empty-state compact muted-empty"
          >
            <span>暂无</span>
            <p>当前没有稍后决策项</p>
          </div>

          <TransitionGroup v-else name="card" tag="div" class="decision-list">
            <div
              v-for="req in deferredDecisionRequests"
              :key="req.id"
              class="decision-card deferred-card"
              :class="{ 'deep-link-target': req.id === targetConfirmRequestId }"
              :data-request-id="req.id"
            >
              <div class="card-top">
                <span
                  class="priority-badge"
                  :class="priorityClass(req.priority)"
                  >{{ priorityLabel(req.priority) }}</span
                >
                <span class="reason-badge">{{ reasonLabel(req) }}</span>
                <span v-if="req.category" class="category-tag">{{
                  req.category
                }}</span>
                <span class="created-time">{{
                  relativeTime(req.createdAt)
                }}</span>
              </div>

              <h3 class="question-text">{{ req.question }}</h3>
              <p v-if="req.context" class="context-text">
                {{ req.context }}
              </p>

              <div class="review-context">
                <div class="review-context-header">
                  <span>稍后处理上下文</span>
                  <button
                    class="copy-review-btn"
                    :disabled="submitting[req.id]"
                    @click="copyDecisionReview(req)"
                  >
                    复制审核包
                  </button>
                </div>
                <div v-if="req.evidenceRefs?.length" class="evidence-list">
                  <span
                    v-for="ref in visibleEvidenceRefs(req)"
                    :key="ref"
                    class="evidence-chip"
                    :title="ref"
                  >
                    {{ evidenceRefLabel(ref) }}
                  </span>
                  <span
                    v-if="hiddenEvidenceCount(req) > 0"
                    class="evidence-chip muted"
                  >
                    另有 {{ hiddenEvidenceCount(req) }} 条
                  </span>
                </div>
                <div v-else class="evidence-empty">
                  未附带证据引用；恢复到主队列后再处理也可以。
                </div>
                <div class="option-preview">
                  可选项：{{ optionPreview(req) }}
                </div>
                <div v-if="copyStatus[req.id]" class="copy-status">
                  {{ copyStatus[req.id] }}
                </div>
              </div>

              <div class="meta-row">
                <span>来源 {{ routeLabel(req) }}</span>
                <span v-if="req.snoozeUntil"
                  >回到主队列 {{ futureTime(req.snoozeUntil) }}</span
                >
                <span v-if="req.snoozeCount > 0"
                  >已稍后 {{ req.snoozeCount }} 次</span
                >
              </div>

              <div v-if="cardErrors[req.id]" class="card-error">
                {{ cardErrors[req.id] }}
              </div>

              <div class="action-buttons">
                <button
                  class="option-btn yes"
                  :disabled="submitting[req.id]"
                  @click="transitionDecisionRequest(req.id, 'pending')"
                >
                  {{ submitting[req.id] ? '处理中...' : '现在处理' }}
                </button>
                <button
                  class="option-btn no"
                  :disabled="submitting[req.id]"
                  @click="transitionDecisionRequest(req.id, 'expired')"
                >
                  {{ submitting[req.id] ? '处理中...' : '不再追踪' }}
                </button>
              </div>
            </div>
          </TransitionGroup>
        </div>
      </section>

      <section class="lane-section watch-section">
        <button class="watch-toggle" @click="watchCollapsed = !watchCollapsed">
          <div>
            <h3 class="lane-title">待观察</h3>
            <p class="lane-note">queue=watch 的观察项，不计入主标题数字。</p>
          </div>
          <div class="watch-toggle-side">
            <span class="lane-count muted">{{ watchTotal }}</span>
            <span class="watch-chevron">{{ watchCollapsed ? '▼' : '▲' }}</span>
          </div>
        </button>

        <div v-if="!watchCollapsed" class="watch-content">
          <div v-if="hasWatchQueueError" class="lane-error">
            {{ watchQueueErrorText }}
          </div>

          <div
            v-if="watchRequests.length === 0 && !hasWatchQueueError"
            class="empty-state compact muted-empty"
          >
            <span>👁</span>
            <p>当前没有待观察项</p>
          </div>

          <div v-else class="decision-list watch-groups">
            <div
              v-for="group in watchGroups"
              :key="group.key"
              class="watch-group"
            >
              <div class="watch-group-header">
                <div>
                  <div class="watch-group-title">{{ group.title }}</div>
                  <div class="watch-group-subtitle">
                    {{ group.items.length }} 个相关观察项
                  </div>
                </div>
                <button
                  v-if="group.items.length > 1"
                  class="group-toggle"
                  @click="toggleWatchGroup(group.key)"
                >
                  {{ expandedWatchGroups[group.key] ? '收起' : '展开' }}
                </button>
              </div>

              <TransitionGroup name="card" tag="div" class="decision-list">
                <div
                  v-for="req in visibleWatchItems(group)"
                  :key="req.id"
                  class="decision-card watch-card"
                  :class="{
                    'deep-link-target': req.id === targetConfirmRequestId,
                  }"
                  :data-request-id="req.id"
                >
                  <div class="card-top">
                    <span
                      class="priority-badge"
                      :class="priorityClass(req.priority)"
                      >{{ priorityLabel(req.priority) }}</span
                    >
                    <span class="reason-badge watch">{{
                      reasonLabel(req)
                    }}</span>
                    <span v-if="req.category" class="category-tag">{{
                      req.category
                    }}</span>
                    <span class="created-time">{{
                      relativeTime(req.createdAt)
                    }}</span>
                  </div>

                  <h3 class="question-text">{{ req.question }}</h3>
                  <p v-if="req.context" class="context-text">
                    {{ req.context }}
                  </p>

                  <div class="meta-row">
                    <span>来源 {{ routeLabel(req) }}</span>
                    <span v-if="req.snoozeCount > 0"
                      >已观察 {{ req.snoozeCount }} 次</span
                    >
                    <span v-if="req.updatedAt"
                      >最近更新 {{ relativeTime(req.updatedAt) }}</span
                    >
                  </div>

                  <div v-if="cardErrors[req.id]" class="card-error">
                    {{ cardErrors[req.id] }}
                  </div>

                  <div class="action-buttons">
                    <button
                      class="option-btn"
                      :disabled="submitting[req.id]"
                      @click="transitionWatchRequest(req.id, 'pending')"
                    >
                      立即查证
                    </button>
                    <button
                      class="option-btn quiet"
                      :disabled="submitting[req.id]"
                      @click="transitionWatchRequest(req.id, 'snoozed')"
                    >
                      继续观察
                    </button>
                    <button
                      class="option-btn no"
                      :disabled="submitting[req.id]"
                      @click="transitionWatchRequest(req.id, 'expired')"
                    >
                      结束追踪
                    </button>
                  </div>
                </div>
              </TransitionGroup>
            </div>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, reactive, computed, nextTick, watch } from 'vue';
import { useRoute } from 'vue-router';
import {
  getMemoryServiceClient,
  type ConfirmRequest,
} from '../../services/MemoryServiceClient';

const client = getMemoryServiceClient();
const route = useRoute();

const loading = ref(true);
const decisionTotal = ref(0);
const decisionSnoozedTotal = ref(0);
const watchPendingTotal = ref(0);
const watchSnoozedTotal = ref(0);
const decisionRequests = ref<ConfirmRequest[]>([]);
const deferredDecisionRequests = ref<ConfirmRequest[]>([]);
const watchPendingRequests = ref<ConfirmRequest[]>([]);
const watchSnoozedRequests = ref<ConfirmRequest[]>([]);
const deferredCollapsed = ref(true);
const watchCollapsed = ref(true);
const expandedWatchGroups = reactive<Record<string, boolean>>({});
const showDetail = reactive<Record<string, boolean>>({});
const detailTexts = reactive<Record<string, string>>({});
const submitting = reactive<Record<string, boolean>>({});
const cardErrors = reactive<Record<string, string>>({});
const copyStatus = reactive<Record<string, string>>({});
const loadError = ref<string | null>(null);
type QueueErrorKey =
  | 'decisionPending'
  | 'decisionSnoozed'
  | 'watchPending'
  | 'watchSnoozed';
type QueueLoadResponse = {
  items: ConfirmRequest[];
  total: number;
};
type QueueLoadResult =
  | { status: 'fulfilled'; value: QueueLoadResponse }
  | { status: 'rejected'; reason: unknown };

const queueLabels: Record<QueueErrorKey, string> = {
  decisionPending: '需你拍板',
  decisionSnoozed: '稍后决策',
  watchPending: '待观察',
  watchSnoozed: '待观察（稍后）',
};

const queueErrors = reactive<Partial<Record<QueueErrorKey, string>>>({});
const targetStatus = ref<
  'idle' | 'found-decision' | 'found-deferred' | 'found-watch' | 'missing'
>('idle');

const targetConfirmRequestId = computed(() =>
  normalizeRouteQueryId(route.query.confirmRequestId ?? route.query.requestId),
);

const watchTotal = computed(
  () => watchPendingTotal.value + watchSnoozedTotal.value,
);
const watchRequests = computed(() =>
  sortTargetFirst([
    ...watchPendingRequests.value,
    ...watchSnoozedRequests.value,
  ]),
);
const queueWarningText = computed(() => {
  const failedQueues = (Object.keys(queueLabels) as QueueErrorKey[]).filter(
    (key) => queueErrors[key],
  );
  if (failedQueues.length === 0) return '';
  return `已保留成功读取或上次成功的数据；失败队列：${failedQueues
    .map((key) => queueLabels[key])
    .join('、')}。`;
});
const hasWatchQueueError = computed(
  () => Boolean(queueErrors.watchPending) || Boolean(queueErrors.watchSnoozed),
);
const watchQueueErrorText = computed(() =>
  [queueErrors.watchPending, queueErrors.watchSnoozed]
    .filter(Boolean)
    .join('；'),
);

const targetNotice = computed(() => {
  if (!targetConfirmRequestId.value || targetStatus.value === 'idle') {
    return null;
  }
  if (targetStatus.value === 'found-decision') {
    return {
      kind: 'found',
      title: '已定位通知对应确认项',
      body: '这条通知打开的确认项已置顶并高亮，可以直接复核证据后选择处理方式。',
    };
  }
  if (targetStatus.value === 'found-deferred') {
    return {
      kind: 'found',
      title: '通知对应项在稍后决策',
      body: '已展开稍后决策并高亮这条确认项，你可以恢复到主队列或结束追踪。',
    };
  }
  if (targetStatus.value === 'found-watch') {
    return {
      kind: 'found',
      title: '通知对应项在待观察池',
      body: '已展开待观察池并高亮这条确认项，你可以立即查证、继续观察或结束追踪。',
    };
  }
  return {
    kind: 'missing',
    title: '通知对应确认项不在当前队列',
    body: '它可能已经被处理、过期，或暂时不属于当前筛选队列；刷新后仍缺失时可回到通知来源查证。',
  };
});

interface MessageRuleImprovementContext {
  schema: 'message_rule_improvement.v1';
  ruleRef: string;
  ruleText?: string;
  currentPrompt: string;
  proposedPrompt: string;
  reason: string;
  summary: string;
  sourceActionId?: string;
  sourceActionTitle?: string;
  sourceMessage?: string;
  outcomeStatus?: string;
  outcomeSummary?: string;
  targetSystem?: string;
  createdAt?: number;
}

onMounted(async () => {
  await loadQueues();
});

watch(targetConfirmRequestId, async () => {
  if (loading.value) return;
  decisionRequests.value = sortTargetFirst(decisionRequests.value);
  deferredDecisionRequests.value = sortTargetFirst(
    deferredDecisionRequests.value,
  );
  await syncTargetDeepLink();
});

async function loadQueues(showLoading = true) {
  if (showLoading) loading.value = true;
  try {
    loadError.value = null;
    clearQueueErrors();

    const [decisionRes, decisionSnoozedRes, watchSnoozedRes, watchPendingRes] =
      await Promise.allSettled([
        client.getConfirmRequests('pending', 50, 'decision'),
        client.getConfirmRequests('snoozed', 50, 'decision'),
        client.getConfirmRequests('snoozed', 50, 'watch'),
        client.getConfirmRequests('pending', 50, 'watch'),
      ]);

    let successCount = 0;
    successCount += applyQueueResult(
      'decisionPending',
      decisionRes,
      (res) => {
        decisionTotal.value = res.total;
        decisionRequests.value = sortTargetFirst(res.items);
      },
    );
    successCount += applyQueueResult(
      'decisionSnoozed',
      decisionSnoozedRes,
      (res) => {
        decisionSnoozedTotal.value = res.total;
        deferredDecisionRequests.value = sortTargetFirst(res.items);
      },
    );
    successCount += applyQueueResult('watchSnoozed', watchSnoozedRes, (res) => {
      watchSnoozedTotal.value = res.total;
      watchSnoozedRequests.value = sortTargetFirst(res.items);
    });
    successCount += applyQueueResult('watchPending', watchPendingRes, (res) => {
      watchPendingTotal.value = res.total;
      watchPendingRequests.value = sortTargetFirst(res.items);
    });

    if (successCount === 0 && !hasAnyQueueData()) {
      loadError.value = '无法连接 Memory Service，请稍后重试。';
    }
    await syncTargetDeepLink();
  } catch (e: any) {
    console.error('Failed to load confirm requests', e);
    loadError.value = e?.message || '无法连接 Memory Service，请稍后重试。';
    if (
      decisionRequests.value.length === 0 &&
      deferredDecisionRequests.value.length === 0 &&
      watchRequests.value.length === 0
    ) {
      decisionTotal.value = 0;
      decisionSnoozedTotal.value = 0;
      watchPendingTotal.value = 0;
      watchSnoozedTotal.value = 0;
    }
  } finally {
    if (showLoading) loading.value = false;
  }
}

function clearQueueErrors() {
  for (const key of Object.keys(queueLabels) as QueueErrorKey[]) {
    delete queueErrors[key];
  }
}

function queueErrorMessage(key: QueueErrorKey, error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
      ? error
      : '刷新失败';
  return `${queueLabels[key]}刷新失败：${message}`;
}

function applyQueueResult(
  key: QueueErrorKey,
  result: QueueLoadResult,
  onSuccess: (response: QueueLoadResponse) => void,
) {
  if (result.status === 'fulfilled') {
    onSuccess(result.value);
    return 1;
  }
  queueErrors[key] = queueErrorMessage(key, result.reason);
  return 0;
}

function hasAnyQueueData() {
  return (
    decisionRequests.value.length > 0 ||
    deferredDecisionRequests.value.length > 0 ||
    watchPendingRequests.value.length > 0 ||
    watchSnoozedRequests.value.length > 0
  );
}

function normalizeRouteQueryId(value: unknown): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === 'string' ? raw.trim() : '';
}

function sortTargetFirst<T extends { id: string }>(items: T[]): T[] {
  const targetId = targetConfirmRequestId.value;
  if (!targetId) return items;
  return [...items].sort((left, right) => {
    if (left.id === targetId && right.id !== targetId) return -1;
    if (right.id === targetId && left.id !== targetId) return 1;
    return 0;
  });
}

function watchGroupKey(req: ConfirmRequest) {
  return (
    req.sourceAnchor ||
    `${req.gapType || req.reasonCode || 'watch'}:${req.category || 'unknown'}`
  );
}

function scrollTargetCardIntoView(id: string) {
  const target = Array.from(
    document.querySelectorAll<HTMLElement>('[data-request-id]'),
  ).find((element) => element.dataset.requestId === id);
  target?.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

async function syncTargetDeepLink() {
  const targetId = targetConfirmRequestId.value;
  if (!targetId) {
    targetStatus.value = 'idle';
    return;
  }

  if (decisionRequests.value.some((req) => req.id === targetId)) {
    targetStatus.value = 'found-decision';
    await nextTick();
    scrollTargetCardIntoView(targetId);
    return;
  }

  if (deferredDecisionRequests.value.some((req) => req.id === targetId)) {
    targetStatus.value = 'found-deferred';
    deferredCollapsed.value = false;
    await nextTick();
    scrollTargetCardIntoView(targetId);
    return;
  }

  const watchTarget = watchRequests.value.find((req) => req.id === targetId);
  if (watchTarget) {
    targetStatus.value = 'found-watch';
    watchCollapsed.value = false;
    expandedWatchGroups[watchGroupKey(watchTarget)] = true;
    await nextTick();
    scrollTargetCardIntoView(targetId);
    return;
  }

  targetStatus.value = 'missing';
}

const watchGroups = computed(() => {
  const groups = new Map<string, ConfirmRequest[]>();
  for (const req of watchRequests.value) {
    const key = watchGroupKey(req);
    const list = groups.get(key) ?? [];
    list.push(req);
    groups.set(key, list);
  }
  return Array.from(groups.entries()).map(([key, items]) => ({
    key,
    title: items[0]?.sourceAnchor || routeLabel(items[0]),
    items: [...items].sort((a, b) => b.createdAt - a.createdAt),
  }));
});

function toggleWatchGroup(key: string) {
  expandedWatchGroups[key] = !expandedWatchGroups[key];
}

function visibleWatchItems(group: { key: string; items: ConfirmRequest[] }) {
  return expandedWatchGroups[group.key] ? group.items : group.items.slice(0, 1);
}

function toggleDetail(id: string) {
  showDetail[id] = !showDetail[id];
}

async function submitAnswer(id: string, answer: string) {
  submitting[id] = true;
  delete cardErrors[id];
  try {
    const detail = detailTexts[id]?.trim() || undefined;
    await client.answerConfirmRequest(id, answer, detail);
    decisionRequests.value = decisionRequests.value.filter((r) => r.id !== id);
    decisionTotal.value = Math.max(0, decisionTotal.value - 1);
    delete detailTexts[id];
    delete showDetail[id];
    delete copyStatus[id];
    if (id === targetConfirmRequestId.value) {
      targetStatus.value = 'missing';
    }
  } catch (e: any) {
    cardErrors[id] = e.message || '提交失败，请重试';
  } finally {
    submitting[id] = false;
  }
}

async function transitionDecisionRequest(
  id: string,
  state: 'pending' | 'snoozed' | 'expired',
) {
  submitting[id] = true;
  delete cardErrors[id];
  try {
    await client.transitionConfirmRequestState(id, state);
    await loadQueues(false);
  } catch (e: any) {
    cardErrors[id] = e.message || '操作失败，请重试';
  } finally {
    submitting[id] = false;
  }
}

function parseMessageRuleImprovement(
  req: ConfirmRequest,
): MessageRuleImprovementContext | null {
  if (req.category !== 'message_rule_improvement' || !req.context) {
    return null;
  }
  try {
    const parsed = JSON.parse(
      req.context,
    ) as Partial<MessageRuleImprovementContext>;
    if (
      parsed.schema === 'message_rule_improvement.v1' &&
      typeof parsed.ruleRef === 'string' &&
      typeof parsed.currentPrompt === 'string' &&
      typeof parsed.proposedPrompt === 'string'
    ) {
      return parsed as MessageRuleImprovementContext;
    }
  } catch {
    return null;
  }
  return null;
}

function isMessageRuleImprovement(req: ConfirmRequest) {
  return Boolean(parseMessageRuleImprovement(req));
}

function messageRuleImprovementSummary(req: ConfirmRequest) {
  const improvement = parseMessageRuleImprovement(req);
  return improvement?.summary || req.context || '';
}

function messageRuleImprovementReason(req: ConfirmRequest) {
  const improvement = parseMessageRuleImprovement(req);
  return improvement?.reason || '根据联动操作运行结果建议改进规则文案';
}

function visibleEvidenceRefs(req: ConfirmRequest) {
  return (req.evidenceRefs ?? []).slice(0, 4);
}

function hiddenEvidenceCount(req: ConfirmRequest) {
  return Math.max(0, (req.evidenceRefs?.length ?? 0) - 4);
}

function evidenceRefLabel(ref: string) {
  const [kind, ...rest] = ref.split(':');
  const id = rest.join(':');
  const labels: Record<string, string> = {
    action: '动作',
    thread: '反思线程',
    message: '消息',
    memory: '记忆',
    meeting: '会议',
    outreach: '主动询问',
    notification: '通知',
    confirm_request: '确认项',
  };
  const label = labels[kind] || kind || '证据';
  const tail = id || ref;
  return tail.length > 12
    ? `${label} · ...${tail.slice(-12)}`
    : `${label} · ${tail}`;
}

function optionPreview(req: ConfirmRequest) {
  const options =
    req.options && req.options.length > 0
      ? req.options.map((opt) => opt.label)
      : ['是', '否'];
  return options.join(' / ');
}

function buildDecisionReviewText(req: ConfirmRequest) {
  const lines = [
    `# 决策审核包: ${req.question}`,
    '',
    `优先级: ${priorityLabel(req.priority)}`,
    `原因: ${reasonLabel(req)}`,
    `来源: ${routeLabel(req)}`,
    `创建: ${relativeTime(req.createdAt)}`,
  ];
  if (req.updatedAt) lines.push(`最近更新: ${relativeTime(req.updatedAt)}`);
  if (req.context) lines.push('', '上下文:', req.context);
  const improvement = parseMessageRuleImprovement(req);
  if (improvement) {
    lines.push(
      '',
      '规则改进:',
      `当前规则: ${improvement.currentPrompt}`,
      `建议规则: ${improvement.proposedPrompt}`,
      `理由: ${improvement.reason}`,
    );
  }
  lines.push('', `可选项: ${optionPreview(req)}`);
  if (req.evidenceRefs?.length) {
    lines.push('', '证据引用:', ...req.evidenceRefs.map((ref) => `- ${ref}`));
  }
  return lines.join('\n');
}

async function writeClipboardText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  textarea.remove();
}

async function copyDecisionReview(req: ConfirmRequest) {
  delete copyStatus[req.id];
  try {
    await writeClipboardText(buildDecisionReviewText(req));
    copyStatus[req.id] = '已复制审核包';
  } catch {
    copyStatus[req.id] = '复制失败，请手动选择问题、上下文和证据';
  }
}

async function openMessageRuleImprovement(req: ConfirmRequest) {
  const improvement = parseMessageRuleImprovement(req);
  if (!improvement) {
    cardErrors[req.id] = '无法解析规则改进建议';
    return;
  }

  submitting[req.id] = true;
  delete cardErrors[req.id];
  try {
    await chrome.storage.local.set({
      pendingMessageRuleImprovement: {
        ...improvement,
        requestId: req.id,
        timestamp: Date.now(),
      },
    });
    const url = chrome.runtime.getURL('topic-modal.html');
    if (chrome.windows?.create) {
      await chrome.windows.create({
        url,
        type: 'popup',
        width: 1100,
        height: 820,
      });
    } else {
      window.open(url, '_blank');
    }
  } catch (e: any) {
    cardErrors[req.id] = e.message || '打开规则编辑失败';
  } finally {
    submitting[req.id] = false;
  }
}

async function transitionWatchRequest(
  id: string,
  state: 'pending' | 'snoozed' | 'expired',
) {
  submitting[id] = true;
  delete cardErrors[id];
  try {
    await client.transitionConfirmRequestState(id, state);
    await loadQueues(false);
  } catch (e: any) {
    if (state === 'snoozed') {
      await loadQueues(false);
      return;
    }
    cardErrors[id] = e.message || '操作失败，请重试';
  } finally {
    submitting[id] = false;
  }
}

function priorityClass(p: string) {
  if (p === 'high') return 'high';
  if (p === 'low') return 'low';
  return 'normal';
}

function priorityLabel(p: string) {
  if (p === 'high') return '高';
  if (p === 'low') return '低';
  return '普通';
}

function reasonLabel(req: ConfirmRequest) {
  const labels: Record<string, string> = {
    authority_required: '需要你定夺',
    approval_required: '需要审批',
    future_monitoring: '持续观察',
    owner_eta_gap: '负责人 / ETA 缺口',
    artifact_gap: '等待更多证据',
    time_sensitive_blocker: '时效阻塞',
    action_result_improvement: '规则改进',
  };
  if (req.reasonCode && labels[req.reasonCode]) return labels[req.reasonCode];
  if (req.category) return req.category;
  return req.routing === 'watch' ? '观察项' : '待确认';
}

function routeLabel(req: ConfirmRequest) {
  if (req.reasonCode) return reasonLabel(req);
  if (req.category) return `分类 ${req.category}`;
  return req.routing === 'watch' ? '等待更多证据' : '需要你选方向';
}

function relativeTime(ts: number) {
  const diff = Date.now() - ts * 1000;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins}分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  return `${days}天前`;
}

function futureTime(ts: number) {
  const diff = ts * 1000 - Date.now();
  if (diff <= 0) return '已到期';
  const mins = Math.ceil(diff / 60000);
  if (mins < 60) return `${mins}分钟后`;
  const hours = Math.ceil(mins / 60);
  if (hours < 24) return `${hours}小时后`;
  const days = Math.ceil(hours / 24);
  return `${days}天后`;
}
</script>

<style scoped>
.decision-center {
  animation: fadeInUp 0.6s ease-out;
}

.header-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.25rem;
}

.section-title {
  font-size: 1.5rem;
  font-weight: 600;
  margin-bottom: 0.35rem;
}

.section-subtitle {
  color: #94a3b8;
  font-size: 0.9rem;
}

.refresh-btn {
  border: none;
  border-radius: 0.8rem;
  padding: 0.72rem 1rem;
  background: linear-gradient(135deg, #2563eb, #0891b2);
  color: white;
  cursor: pointer;
  transition: opacity 0.2s ease;
}

.refresh-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.load-error {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 1rem;
  padding: 0.9rem 1rem;
  border: 1px solid rgba(248, 113, 113, 0.24);
  border-radius: 0.8rem;
  background: rgba(127, 29, 29, 0.18);
  color: #fecaca;
}

.load-error-title {
  color: #fee2e2;
  font-weight: 600;
  margin-bottom: 0.25rem;
}

.load-error p {
  margin: 0;
  font-size: 0.84rem;
  line-height: 1.45;
}

.load-error-retry {
  flex: 0 0 auto;
  border: 1px solid rgba(248, 113, 113, 0.28);
  border-radius: 0.5rem;
  padding: 0.45rem 0.75rem;
  background: rgba(248, 113, 113, 0.12);
  color: #fecaca;
  cursor: pointer;
}

.partial-load-warning {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 1rem;
  padding: 0.85rem 1rem;
  border: 1px solid rgba(251, 191, 36, 0.22);
  border-radius: 0.75rem;
  background: rgba(120, 53, 15, 0.14);
  color: #fde68a;
}

.partial-load-warning-title {
  margin-bottom: 0.25rem;
  color: #fef3c7;
  font-weight: 700;
}

.partial-load-warning p {
  margin: 0;
  font-size: 0.84rem;
  line-height: 1.45;
}

.partial-load-retry {
  flex: 0 0 auto;
  border: 1px solid rgba(251, 191, 36, 0.28);
  border-radius: 0.5rem;
  padding: 0.45rem 0.75rem;
  background: rgba(251, 191, 36, 0.12);
  color: #fef3c7;
  cursor: pointer;
}

.target-notice {
  margin-bottom: 1rem;
  padding: 0.85rem 1rem;
  border: 1px solid rgba(59, 130, 246, 0.24);
  border-left: 4px solid #38bdf8;
  border-radius: 0.75rem;
  background: rgba(14, 116, 144, 0.14);
  color: #c7f9ff;
}

.target-notice.missing {
  border-color: rgba(251, 191, 36, 0.24);
  border-left-color: #f59e0b;
  background: rgba(120, 53, 15, 0.16);
  color: #fde68a;
}

.target-notice-title {
  margin-bottom: 0.25rem;
  color: #e0f2fe;
  font-weight: 700;
}

.target-notice.missing .target-notice-title {
  color: #fef3c7;
}

.target-notice p {
  margin: 0;
  font-size: 0.86rem;
  line-height: 1.45;
}

.lane-section {
  margin-bottom: 1.5rem;
}

.lane-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
}

.lane-title {
  font-size: 1.05rem;
  font-weight: 600;
  margin-bottom: 0.2rem;
}

.lane-note {
  color: #94a3b8;
  font-size: 0.85rem;
}

.lane-count {
  min-width: 2rem;
  height: 2rem;
  padding: 0 0.7rem;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(59, 130, 246, 0.14);
  border: 1px solid rgba(59, 130, 246, 0.25);
  color: #93c5fd;
  font-size: 0.85rem;
  font-weight: 600;
}

.lane-count.muted {
  background: rgba(148, 163, 184, 0.12);
  border-color: rgba(148, 163, 184, 0.18);
  color: #cbd5e1;
}

.decision-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.lane-error {
  margin-bottom: 0.9rem;
  padding: 0.75rem 0.9rem;
  border: 1px solid rgba(251, 191, 36, 0.2);
  border-radius: 0.7rem;
  background: rgba(120, 53, 15, 0.12);
  color: #fde68a;
  font-size: 0.84rem;
  line-height: 1.45;
}

.decision-card {
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid rgba(148, 163, 184, 0.1);
  border-radius: 1rem;
  padding: 1.5rem;
  backdrop-filter: blur(10px);
  transition: all 0.3s ease;
}

.decision-card:hover {
  border-color: rgba(59, 130, 246, 0.3);
  box-shadow: 0 8px 32px rgba(59, 130, 246, 0.1);
}

.decision-card.deep-link-target {
  scroll-margin-top: 1.5rem;
  border-color: rgba(56, 189, 248, 0.55);
  box-shadow: 0 0 0 1px rgba(56, 189, 248, 0.22),
    0 14px 36px rgba(14, 165, 233, 0.14);
}

.watch-card {
  background: rgba(15, 23, 42, 0.45);
  border-color: rgba(148, 163, 184, 0.08);
}

.deferred-card {
  background: rgba(15, 23, 42, 0.5);
  border-color: rgba(148, 163, 184, 0.1);
}

.watch-groups {
  gap: 1.25rem;
}

.watch-group {
  border: 1px solid rgba(148, 163, 184, 0.08);
  border-radius: 1rem;
  padding: 1rem;
  background: rgba(15, 23, 42, 0.18);
}

.watch-group-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  margin-bottom: 0.9rem;
}

.watch-group-title {
  color: #e2e8f0;
  font-size: 0.95rem;
  font-weight: 600;
}

.watch-group-subtitle {
  color: #94a3b8;
  font-size: 0.8rem;
  margin-top: 0.15rem;
}

.group-toggle {
  border: 1px solid rgba(148, 163, 184, 0.18);
  background: rgba(148, 163, 184, 0.08);
  color: #cbd5e1;
  border-radius: 999px;
  padding: 0.35rem 0.8rem;
  cursor: pointer;
}

.card-top {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.priority-badge {
  padding: 0.2rem 0.6rem;
  border-radius: 1rem;
  font-size: 0.75rem;
  font-weight: 600;
}

.priority-badge.high {
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
}

.priority-badge.normal {
  background: rgba(59, 130, 246, 0.2);
  color: #60a5fa;
}

.priority-badge.low {
  background: rgba(148, 163, 184, 0.2);
  color: #94a3b8;
}

.reason-badge {
  padding: 0.2rem 0.6rem;
  border-radius: 1rem;
  background: rgba(14, 165, 233, 0.16);
  color: #67e8f9;
  font-size: 0.75rem;
  font-weight: 500;
}

.reason-badge.watch {
  background: rgba(148, 163, 184, 0.16);
  color: #cbd5e1;
}

.category-tag {
  padding: 0.2rem 0.6rem;
  background: rgba(147, 51, 234, 0.2);
  color: #a78bfa;
  border-radius: 1rem;
  font-size: 0.75rem;
  font-weight: 500;
}

.created-time {
  margin-left: auto;
  font-size: 0.75rem;
  color: #64748b;
}

.question-text {
  font-size: 1.1rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
  line-height: 1.4;
}

.context-text {
  color: #cbd5e1;
  font-size: 0.875rem;
  line-height: 1.5;
  margin-bottom: 0.75rem;
}

.improvement-context {
  margin-bottom: 0.75rem;
  padding: 0.85rem 1rem;
  border-radius: 0.85rem;
  border: 1px solid rgba(125, 211, 252, 0.22);
  background: rgba(14, 116, 144, 0.12);
}

.improvement-title {
  color: #e0f2fe;
  font-size: 0.88rem;
  line-height: 1.5;
  margin-bottom: 0.35rem;
}

.improvement-reason {
  color: #a5f3fc;
  font-size: 0.8rem;
  line-height: 1.45;
}

.review-context {
  margin-bottom: 0.75rem;
  padding: 0.85rem 1rem;
  border-radius: 0.75rem;
  border: 1px solid rgba(148, 163, 184, 0.12);
  background: rgba(30, 41, 59, 0.32);
}

.review-context-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  color: #e2e8f0;
  font-size: 0.84rem;
  font-weight: 600;
  margin-bottom: 0.55rem;
}

.copy-review-btn {
  flex: 0 0 auto;
  border: 1px solid rgba(59, 130, 246, 0.28);
  border-radius: 0.5rem;
  padding: 0.35rem 0.65rem;
  background: rgba(59, 130, 246, 0.1);
  color: #93c5fd;
  font-size: 0.75rem;
  cursor: pointer;
}

.copy-review-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.evidence-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-bottom: 0.5rem;
}

.evidence-chip {
  max-width: 100%;
  padding: 0.25rem 0.5rem;
  border-radius: 0.45rem;
  background: rgba(14, 165, 233, 0.12);
  border: 1px solid rgba(14, 165, 233, 0.2);
  color: #a5f3fc;
  font-size: 0.74rem;
  line-height: 1.3;
  overflow-wrap: anywhere;
}

.evidence-chip.muted {
  background: rgba(148, 163, 184, 0.1);
  border-color: rgba(148, 163, 184, 0.18);
  color: #cbd5e1;
}

.evidence-empty,
.option-preview,
.copy-status {
  color: #94a3b8;
  font-size: 0.78rem;
  line-height: 1.45;
}

.option-preview {
  margin-top: 0.25rem;
}

.copy-status {
  margin-top: 0.35rem;
  color: #86efac;
}

.meta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  color: #94a3b8;
  font-size: 0.78rem;
  margin-bottom: 0.75rem;
}

.card-error {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 0.5rem;
  padding: 0.5rem 0.75rem;
  color: #ef4444;
  font-size: 0.8rem;
  margin-bottom: 0.5rem;
}

.detail-toggle {
  color: #60a5fa;
  font-size: 0.8rem;
  cursor: pointer;
  margin-bottom: 0.5rem;
  user-select: none;
}

.detail-toggle:hover {
  color: #93c5fd;
}

.detail-input {
  width: 100%;
  padding: 0.5rem 0.75rem;
  background: rgba(30, 41, 59, 0.6);
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 0.5rem;
  color: #ffffff;
  font-size: 0.875rem;
  resize: vertical;
  margin-bottom: 0.75rem;
}

.detail-input:focus {
  outline: none;
  border-color: #60a5fa;
}

.action-buttons {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.option-btn {
  padding: 0.5rem 1.25rem;
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.3);
  border-radius: 0.5rem;
  color: #60a5fa;
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 500;
  transition: all 0.3s ease;
}

.option-btn:hover:not(:disabled) {
  background: rgba(59, 130, 246, 0.2);
  border-color: rgba(59, 130, 246, 0.5);
}

.option-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.option-btn.yes {
  background: rgba(34, 197, 94, 0.1);
  border-color: rgba(34, 197, 94, 0.3);
  color: #22c55e;
}

.option-btn.yes:hover:not(:disabled) {
  background: rgba(34, 197, 94, 0.2);
  border-color: rgba(34, 197, 94, 0.5);
}

.option-btn.quiet {
  background: rgba(148, 163, 184, 0.08);
  border-color: rgba(148, 163, 184, 0.2);
  color: #cbd5e1;
}

.option-btn.quiet:hover:not(:disabled) {
  background: rgba(148, 163, 184, 0.16);
  border-color: rgba(148, 163, 184, 0.32);
}

.option-btn.no {
  background: rgba(239, 68, 68, 0.1);
  border-color: rgba(239, 68, 68, 0.3);
  color: #ef4444;
}

.option-btn.no:hover:not(:disabled) {
  background: rgba(239, 68, 68, 0.2);
  border-color: rgba(239, 68, 68, 0.5);
}

.watch-section {
  border-top: 1px solid rgba(148, 163, 184, 0.12);
  padding-top: 1.25rem;
}

.deferred-section {
  border-top: 1px solid rgba(148, 163, 184, 0.12);
  padding-top: 1.25rem;
}

.watch-toggle {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  border: 1px solid rgba(148, 163, 184, 0.12);
  border-radius: 1rem;
  background: rgba(15, 23, 42, 0.4);
  padding: 1rem 1.1rem;
  color: inherit;
  cursor: pointer;
  text-align: left;
  transition: border-color 0.25s ease, background 0.25s ease;
}

.watch-toggle:hover {
  border-color: rgba(148, 163, 184, 0.22);
  background: rgba(15, 23, 42, 0.56);
}

.watch-toggle-side {
  display: flex;
  align-items: center;
  gap: 0.65rem;
}

.watch-chevron {
  color: #94a3b8;
  font-size: 0.9rem;
}

.watch-content {
  margin-top: 1rem;
}

.empty-state.compact {
  padding: 2rem 1.5rem;
}

.muted-empty {
  border: 1px dashed rgba(148, 163, 184, 0.14);
  border-radius: 1rem;
  background: rgba(15, 23, 42, 0.25);
}

/* TransitionGroup animations */
.card-enter-active {
  transition: all 0.3s ease-out;
}

.card-leave-active {
  transition: all 0.3s ease-in;
}

.card-enter-from {
  opacity: 0;
  transform: translateY(20px);
}

.card-leave-to {
  opacity: 0;
  transform: translateX(30px) scale(0.95);
}
</style>
