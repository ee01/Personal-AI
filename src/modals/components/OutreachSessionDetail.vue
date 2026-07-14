<template>
  <div class="outreach-detail-page">
    <div class="page-head">
      <button
        class="back-btn"
        :title="backToListButtonBoundary()"
        :aria-label="backToListButtonAriaLabel()"
        @click="goBackToList"
      >
        ← 返回主动询问列表
      </button>
      <div class="action-bar">
        <button
          v-if="detail?.status === 'pending_approval'"
          class="primary-btn"
          :disabled="busy || editing || !canApprove(detail)"
          :title="detailActionButtonTitle('approve', detail)"
          :aria-label="detailActionButtonAriaLabel('approve', detail)"
          @click="approveSession"
        >
          {{ canApprove(detail) ? '批准发送' : '目标未确认，暂不能批准' }}
        </button>
        <button
          v-if="detail && canEdit(detail.status) && !editing"
          class="ghost-btn"
          :disabled="busy"
          :title="detailActionButtonTitle('edit', detail)"
          :aria-label="detailActionButtonAriaLabel('edit', detail)"
          @click="startEdit"
        >
          编辑目标与时间
        </button>
        <button
          v-if="detail && canRetry(detail.status)"
          class="ghost-btn"
          :disabled="busy || editing"
          :title="detailActionButtonTitle('retry', detail)"
          :aria-label="detailActionButtonAriaLabel('retry', detail)"
          @click="retrySession"
        >
          重试
        </button>
        <button
          v-if="detail && canCancel(detail.status)"
          class="danger-btn"
          :disabled="busy || editing"
          :title="detailActionButtonTitle('cancel', detail)"
          :aria-label="detailActionButtonAriaLabel('cancel', detail)"
          @click="cancelSession"
        >
          取消
        </button>
      </div>
    </div>

    <div v-if="loading" class="loading-container">
      <div class="loading-spinner"></div>
      <p>加载主动询问详情中...</p>
    </div>

    <div
      v-else-if="loadError"
      class="detail-load-error"
      role="alert"
      aria-label="主动询问详情加载失败回执"
    >
      <div class="detail-load-title">主动询问详情加载失败</div>
      <p>{{ loadError }}</p>
      <p>
        页面没有把这次读取失败当成会话不存在，也没有批准、发送、追问、重试、取消或写回
        RingCentral。请重试详情读取，或返回列表核对当前队列快照。
      </p>
      <div class="detail-load-actions">
        <button
          class="ghost-btn"
          :title="retryDetailLoadButtonBoundary()"
          :aria-label="retryDetailLoadButtonAriaLabel()"
          @click="loadDetail"
        >
          重试详情
        </button>
        <button
          class="back-btn"
          :title="backToListButtonBoundary()"
          :aria-label="backToListButtonAriaLabel()"
          @click="goBackToList"
        >
          返回列表核对
        </button>
      </div>
    </div>

    <div v-else-if="!detail" class="empty-state">
      <p>未找到该会话。</p>
    </div>

    <div v-else class="detail-layout">
      <div
        v-if="detailLoadWarning"
        class="detail-load-warning"
        role="status"
        aria-label="主动询问详情降级回执"
      >
        <div class="detail-load-title">详情已加载，辅助状态读取失败</div>
        <p>{{ detailLoadWarning }}</p>
        <p>
          主会话详情仍按当前快照展示；编辑目标时如需最新 RingCentral
          目录，请在发送前调整区刷新目录。这个降级提示不会保存草稿、批准、发送、追问或写回
          RingCentral。
        </p>
      </div>

      <section class="hero-card">
        <div class="hero-top">
          <div>
            <h2>{{ detail.renderedQuestion || '(空问题)' }}</h2>
            <p>{{ detail.renderedContext || '无信息目标' }}</p>
          </div>
          <div class="hero-metrics">
            <span class="metric-pill" :class="statusClass(detail.status)"
              >状态 {{ statusLabel(detail.status) }}</span
            >
            <span class="metric-pill">{{
              originLabel(detail.originKind)
            }}</span>
            <span
              v-if="currentEvidenceSnapshot().stateLabel"
              class="metric-pill queued"
              >{{ currentEvidenceSnapshot().stateLabel }}</span
            >
            <span class="metric-pill"
              >追问 {{ detail.followupCount }}/{{ detail.maxFollowup }}</span
            >
          </div>
        </div>

        <div class="hero-meta">
          <span
            >目标 {{ targetTypeLabel(detail.targetType) }} /
            {{ detail.targetRef }}</span
          >
          <span>目标状态 {{ sessionTargetResolutionLabel(detail) }}</span>
          <span v-if="detail.nextCheckAt"
            >{{ nextTimeLabel(detail.status) }}
            {{ relativeTime(detail.nextCheckAt) }}</span
          >
          <span v-if="detail.waitUntil"
            >等待至 {{ relativeTime(detail.waitUntil) }}</span
          >
          <router-link
            v-if="detail.threadId"
            :to="`/reflection-threads/${detail.threadId}`"
            class="page-link"
            :title="detailThreadLinkBoundary(detail)"
            :aria-label="detailThreadLinkAriaLabel(detail)"
            >查看线程</router-link
          >
          <router-link
            v-if="detail.actionId"
            :to="`/actions?actionId=${encodeURIComponent(detail.actionId)}`"
            class="page-link"
            :title="detailActionLinkBoundary(detail)"
            :aria-label="detailActionLinkAriaLabel(detail)"
            >查看动作</router-link
          >
          <router-link
            v-if="detail.templateId"
            :to="`/outreach?templateId=${encodeURIComponent(detail.templateId)}`"
            class="page-link"
            :title="detailTemplateLinkBoundary(detail)"
            :aria-label="detailTemplateLinkAriaLabel(detail)"
            >查看模板会话</router-link
          >
          <a
            v-if="messageReactionSourceUrl(detail)"
            :href="messageReactionSourceUrl(detail)"
            class="page-link"
            target="_blank"
            rel="noopener noreferrer"
            :title="detailSourceMessageLinkBoundary(detail)"
            :aria-label="detailSourceMessageLinkAriaLabel(detail)"
            >打开原消息</a
          >
        </div>

        <div
          class="operation-scope-receipt"
          :class="sessionOperationReceipt(detail).tone"
          role="status"
          aria-label="主动询问本次操作范围"
        >
          <div class="operation-scope-title">
            {{ sessionOperationReceipt(detail).title }}
          </div>
          <ul>
            <li
              v-for="item in sessionOperationReceipt(detail).items"
              :key="item"
            >
              {{ item }}
            </li>
          </ul>
        </div>

        <div
          v-if="preDispatchReviewReceipt"
          class="pre-dispatch-review-receipt"
          :class="preDispatchReviewReceipt.tone"
          role="status"
          aria-label="主动询问发送前复核"
        >
          <div class="pre-dispatch-review-title">
            {{ preDispatchReviewReceipt.title }}
          </div>
          <ul>
            <li v-for="item in preDispatchReviewReceipt.items" :key="item">
              {{ item }}
            </li>
          </ul>
        </div>

        <div
          v-if="operationResult"
          class="operation-result-receipt"
          :class="operationResult.tone"
          role="status"
          aria-label="主动询问操作回执"
        >
          <div class="operation-result-title">
            {{ operationResult.title }}
          </div>
          <ul>
            <li v-for="item in operationResult.items" :key="item">
              {{ item }}
            </li>
          </ul>
        </div>
      </section>

      <section v-if="detail && canEdit(detail.status)" class="panel">
        <div class="panel-title-row">
          <div class="panel-title">发送前调整</div>
          <span class="muted small"
            >待审批或已排程时可修改目标、问题和计划发送时间。</span
          >
        </div>

        <div
          v-if="editing"
          class="draft-boundary-receipt"
          :class="draftChangeReceipt.tone"
          role="status"
          aria-label="主动询问未保存草稿回执"
        >
          <div class="draft-boundary-title">
            {{ draftChangeReceipt.title }}
          </div>
          <ul>
            <li v-for="item in draftChangeReceipt.items" :key="item">
              {{ item }}
            </li>
          </ul>
        </div>

        <div v-if="editing" class="edit-grid">
          <label class="field-block">
            <span>询问对象类型</span>
            <select
              v-model="draft.targetType"
              class="field-input"
              @change="handleTargetTypeChange"
            >
              <option value="private">某个人</option>
              <option value="group">群组</option>
            </select>
          </label>
          <label class="field-block">
            <span>目标对象</span>
            <input
              v-model="draft.targetRef"
              class="field-input"
              type="text"
              :placeholder="
                draft.targetType === 'group'
                  ? '输入群名、群聊 chat ID 或 RingCentral 聊天链接'
                  : '输入人名、邮箱、私聊 chat ID 或 RingCentral 聊天链接'
              "
              @input="handleTargetInput"
            />
            <span class="muted small">
              {{
                draft.targetType === 'group'
                  ? '群组模式用于“问某个群”。支持群名、纯数字 chat ID，以及 `https://app.ringcentral.com/l/messages/...` 这类聊天链接。通过链接或 chat ID 确认过一次后，系统会记住这个群名。'
                  : '某个人模式用于“问某个人”。你只需要输入人名、邮箱，或直接贴已有私聊链接/chat ID；系统会自动判断是命中联系人，还是命中已有私聊。若是 service account 或较早的私聊，直接贴聊天链接会更稳。'
              }}
            </span>
          </label>
          <div class="field-block full-span">
            <div class="search-row">
              <span class="muted small">
                {{
                  searchingTargets
                    ? '正在检索候选...'
                    : `当前解析状态：${draftResolutionLabel}`
                }}
              </span>
              <div class="search-action-group">
                <button
                  class="ghost-btn"
                  :disabled="busy || syncingDirectory"
                  :title="directoryRefreshButtonBoundary()"
                  :aria-label="directoryRefreshButtonAriaLabel()"
                  @click="refreshDirectory"
                >
                  {{ syncingDirectory ? '刷新目录中...' : '刷新目录' }}
                </button>
                <button
                  class="ghost-btn"
                  :disabled="busy || searchingTargets"
                  :title="targetSearchButtonBoundary()"
                  :aria-label="targetSearchButtonAriaLabel()"
                  @click="searchTargets(true)"
                >
                  重新检索
                </button>
              </div>
            </div>
            <div class="muted small" style="margin-top: 6px">
              {{ directoryStatusHint }}
            </div>
            <p v-if="searchError" class="field-error">{{ searchError }}</p>
            <div
              v-if="draft.targetCandidates.length > 0"
              class="candidate-list"
            >
              <button
                v-for="candidate in draft.targetCandidates"
                :key="`${candidate.kind}:${candidate.entityId}`"
                class="candidate-btn"
                type="button"
                :title="targetCandidateButtonBoundary(candidate)"
                :aria-label="targetCandidateButtonAriaLabel(candidate)"
                @click="selectTargetCandidate(candidate)"
              >
                <strong>{{ candidate.label }}</strong>
                <span class="muted small">
                  {{ candidateTypeLabel(candidate)
                  }}<template v-if="candidate.subtitle">
                    · {{ candidate.subtitle }}</template
                  >
                  · 匹配度 {{ candidate.score }}
                </span>
              </button>
            </div>
          </div>
          <label class="field-block full-span">
            <span>问题</span>
            <textarea
              v-model="draft.renderedQuestion"
              class="field-input field-textarea"
              rows="3"
              placeholder="输入要发送的问题"
            />
          </label>
          <label class="field-block full-span">
            <span>信息目标 / 完成标准</span>
            <textarea
              v-model="draft.renderedContext"
              class="field-input field-textarea"
              rows="4"
              placeholder="写清楚这次询问达到什么条件才算完成"
            />
          </label>
          <label class="field-block">
            <span>计划发送时间</span>
            <input
              v-model="draft.nextCheckAtInput"
              class="field-input"
              type="datetime-local"
            />
          </label>
          <div class="field-block">
            <span>说明</span>
            <p class="muted">
              留空表示批准后立即发送；如果当前已排程，留空则改为尽快发送。问某个人时不需要先分辨“联系人”还是“已有私聊”，选候选即可。
            </p>
          </div>
          <div class="edit-actions full-span">
            <button
              class="primary-btn"
              :disabled="busy"
              :title="draftActionButtonTitle('save')"
              :aria-label="draftActionButtonAriaLabel('save')"
              @click="saveDraft"
            >
              保存调整
            </button>
            <button
              class="ghost-btn"
              :disabled="busy"
              :title="draftActionButtonTitle('cancel')"
              :aria-label="draftActionButtonAriaLabel('cancel')"
              @click="cancelEdit"
            >
              取消编辑
            </button>
          </div>
        </div>

        <div v-else class="summary-text">
          <p>
            当前对象：{{ targetTypeLabel(detail.targetType) }} /
            {{ detail.targetRef }}
          </p>
          <p>目标解析：{{ sessionTargetResolutionLabel(detail) }}</p>
          <p>
            计划发送：{{
              detail.nextCheckAt
                ? relativeTime(detail.nextCheckAt)
                : '批准后立即发送'
            }}
          </p>
        </div>
      </section>

      <section
        v-if="extractOutcomeSummary(detail.outcome)"
        class="panel summary-highlight-panel"
      >
        <div class="panel-title">结果摘要</div>
        <p class="summary-text strong">
          {{ extractOutcomeSummary(detail.outcome) }}
        </p>
      </section>

      <section class="panel">
        <div class="panel-title">当前结论</div>
        <p class="summary-text">{{ sessionSummary(detail) }}</p>
      </section>

      <section v-if="currentEvidenceSnapshot().hasEvidence" class="panel">
        <div class="panel-title">证据面板</div>
        <div class="evidence-metrics">
          <span
            v-if="currentEvidenceSnapshot().phaseLabel"
            class="metric-pill queued"
            >命中阶段 {{ currentEvidenceSnapshot().phaseLabel }}</span
          >
          <span v-if="currentEvidenceSnapshot().source" class="metric-pill"
            >命中来源 {{ currentEvidenceSnapshot().source }}</span
          >
        </div>
        <p v-if="currentEvidenceSnapshot().summary" class="summary-text">
          <RichEvidenceText
            :text="currentEvidenceSnapshot().summary"
            :mention-labels="currentMentionLabels()"
          />
        </p>
        <div v-if="currentEvidenceSnapshot().relatedMessage" class="reply-box">
          <div class="inline-head">
            <span class="box-title">对应消息</span>
            <span
              v-if="currentEvidenceSnapshot().relatedMessageSpeaker"
              class="muted small"
              >{{ currentEvidenceSnapshot().relatedMessageSpeaker }}</span
            >
          </div>
          <p>
            <RichEvidenceText
              :text="currentEvidenceSnapshot().relatedMessage"
              :mention-labels="currentMentionLabels()"
            />
          </p>
          <div
            v-if="currentEvidenceSnapshot().relatedMessageId"
            class="muted small"
          >
            消息 ID: {{ currentEvidenceSnapshot().relatedMessageId }}
          </div>
        </div>
      </section>

      <section
        v-if="detail.evidence && detail.evidence.length > 0"
        class="panel"
      >
        <div class="panel-title">结构化证据明细</div>
        <div class="event-list">
          <div
            v-for="item in detail.evidence"
            :key="`${item.sourceKind}:${item.sourceId || item.title || item.content}`"
            class="event-item"
          >
            <div class="inline-head">
              <span>{{ item.title || item.sourceKind }}</span>
              <span class="muted small">{{ item.sourceId || 'no-id' }}</span>
            </div>
            <p class="summary-text">
              <RichEvidenceText
                :text="item.content"
                :mention-labels="currentMentionLabels()"
              />
            </p>
            <pre
              v-if="item.metadata && Object.keys(item.metadata).length > 0"
              class="json-block"
              >{{ formatJson(item.metadata) }}</pre
            >
          </div>
        </div>
      </section>

      <section class="panel">
        <div class="panel-title">回复内容</div>
        <div v-if="detail.replyRawText" class="reply-box">
          <div class="inline-head">
            <span>{{ replySenderDisplay(detail) }}</span>
            <span class="muted small">{{
              replyClassificationLabel(detail.replyClassification)
            }}</span>
          </div>
          <p>
            <RichEvidenceText
              :text="detail.replyRawText"
              :mention-labels="currentMentionLabels()"
            />
          </p>
          <div v-if="replySenderIsInferred(detail)" class="muted small">
            当前未拿到原始 reply sender，先按目标对象回退展示。
          </div>
          <div v-if="detail.replyConfidence !== undefined" class="muted small">
            解析置信度：{{ Number(detail.replyConfidence).toFixed(2) }}
          </div>
        </div>
        <div v-else class="muted">暂无回复内容</div>
      </section>

      <section class="panel">
        <div class="panel-title">结构化结果</div>
        <div
          v-if="detail.outcome && Object.keys(detail.outcome).length > 0"
          class="json-panel"
        >
          <pre>{{ formatJson(detail.outcome) }}</pre>
        </div>
        <div v-else class="muted">暂无结构化结果</div>
      </section>

      <section v-if="detail.actions && detail.actions.length > 0" class="panel">
        <div class="panel-title">后续查证动作</div>
        <div class="event-list">
          <div
            v-for="action in detail.actions"
            :key="action.id"
            class="event-item"
          >
            <div class="inline-head">
              <span>{{ action.title }}</span>
              <span class="muted small">{{
                followUpActionStatusLabel(action)
              }}</span>
            </div>
            <p class="summary-text">
              {{ action.description || action.actionType }}
            </p>
          </div>
        </div>
      </section>

      <section class="panel">
        <div class="panel-title">事件时间线</div>
        <div v-if="events.length === 0" class="muted">暂无事件</div>
        <div v-else class="event-list">
          <div v-for="event in events" :key="event.id" class="event-item">
            <div class="inline-head">
              <span>{{ eventTypeLabel(event) }}</span>
              <span class="muted small">{{
                relativeTime(event.createdAt)
              }}</span>
            </div>
            <p v-if="eventSummary(event)" class="summary-text">
              {{ eventSummary(event) }}
            </p>
            <pre
              v-if="event.payload && Object.keys(event.payload).length > 0"
              class="json-block"
              >{{ formatJson(event.payload) }}</pre
            >
          </div>
        </div>
      </section>

      <section
        v-if="detail.errorMessage || detail.errorCode"
        class="panel error-panel"
      >
        <div class="panel-title">错误信息</div>
        <p>
          {{ detail.errorCode || 'error' }}:
          {{ detail.errorMessage || 'unknown error' }}
        </p>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  computed,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  watch,
} from 'vue';
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router';
import {
  getMemoryServiceClient,
  type OutreachDirectoryStatus,
  type OutreachEvent,
  type OutreachSession,
  type OutreachSessionStatus,
  type OutreachTargetCandidate,
  type RuntimeAction,
} from '../../services/MemoryServiceClient';
import {
  getLatestReplyEvent,
  getOutreachEvidenceSnapshot,
} from './outreachEvidence';
import {
  collectEvidenceMentionLabels,
  RichEvidenceText,
} from './evidenceText';

const client = getMemoryServiceClient();
const route = useRoute();
const router = useRouter();

const loading = ref(true);
const busy = ref(false);
const editing = ref(false);
const searchingTargets = ref(false);
const syncingDirectory = ref(false);
const searchError = ref('');
const loadError = ref('');
const detailLoadWarning = ref('');
const directoryStatus = ref<OutreachDirectoryStatus[]>([]);
const detail = ref<OutreachSession | null>(null);
const operationResult = ref<OperationResultReceipt | null>(null);
const draft = reactive({
  targetType: 'private',
  targetRef: '',
  targetResolutionStatus: 'unresolved' as
    | 'unresolved'
    | 'ambiguous'
    | 'resolved',
  targetResolvedType: '',
  targetResolvedId: '',
  targetResolvedLabel: '',
  targetResolvedChatId: '',
  targetCandidates: [] as OutreachTargetCandidate[],
  renderedQuestion: '',
  renderedContext: '',
  nextCheckAtInput: '',
});

interface OperationScopeReceipt {
  title: string;
  tone: 'queued' | 'waiting' | 'ok' | 'error' | 'muted';
  items: string[];
}

interface OperationResultReceipt {
  title: string;
  tone: 'ok' | 'queued' | 'error' | 'muted';
  items: string[];
}

const events = computed<OutreachEvent[]>(() => {
  const list = detail.value?.events ?? [];
  return [...list].sort(
    (a, b) => normalizeTimestamp(b.createdAt) - normalizeTimestamp(a.createdAt),
  );
});
const preDispatchReviewReceipt = computed<OperationScopeReceipt | null>(() =>
  detail.value ? buildPreDispatchReviewReceipt(detail.value) : null,
);
const draftChangedFields = computed(() => buildDraftChangedFields());
const draftChangeReceipt = computed<OperationResultReceipt>(() =>
  buildDraftChangeReceipt(),
);

let targetSearchTimer: ReturnType<typeof setTimeout> | null = null;
let targetSearchSequence = 0;
let skipNextUnsavedDraftPrompt = false;
const PRE_DISPATCH_STALE_MS = 24 * 60 * 60 * 1000;

onMounted(() => {
  void loadDetail();
});

onBeforeUnmount(() => {
  if (targetSearchTimer) {
    clearTimeout(targetSearchTimer);
    targetSearchTimer = null;
  }
});

onBeforeRouteLeave((_to, _from, next) => {
  if (skipNextUnsavedDraftPrompt) {
    skipNextUnsavedDraftPrompt = false;
    next();
    return;
  }
  if (!shouldWarnUnsavedDraft()) {
    next();
    return;
  }
  const confirmed = window.confirm(
    '当前主动询问编辑草稿尚未保存，离开会丢弃本页草稿。确认离开？',
  );
  if (confirmed) {
    next();
    return;
  }
  next(false);
});

watch(
  () => route.params.id,
  () => {
    void loadDetail();
  },
);

async function loadDetail(
  options: { preserveOperationResult?: boolean } = {},
) {
  const id = route.params.id as string;
  if (!id) return;
  loading.value = true;
  loadError.value = '';
  detailLoadWarning.value = '';
  if (!options.preserveOperationResult) {
    operationResult.value = null;
  }
  try {
    const [sessionResult, directoryResult] = await Promise.allSettled([
      client.getOutreachSession(id),
      client.getOutreachDirectoryStatus(),
    ]);
    if (sessionResult.status !== 'fulfilled') {
      throw sessionResult.reason;
    }
    const session = sessionResult.value;
    detail.value = session;
    if (directoryResult.status === 'fulfilled') {
      directoryStatus.value = Array.isArray(directoryResult.value?.items)
        ? directoryResult.value.items
        : [];
    } else {
      directoryStatus.value = [];
      detailLoadWarning.value = formatDetailLoadFailure(
        '目标目录状态',
        directoryResult.reason,
      );
    }
    resetDraft(detail.value);
  } catch (error) {
    console.error('Failed to load outreach session detail:', error);
    loadError.value = formatDetailLoadFailure('会话详情', error);
    detail.value = null;
    directoryStatus.value = [];
    resetDraft(null);
  } finally {
    loading.value = false;
  }
}

function isSystemPseudoTarget(value: string) {
  return value.trim().toLowerCase() === 'sync.service';
}

function scheduleTargetSearch(delayMs = 260) {
  if (targetSearchTimer) {
    clearTimeout(targetSearchTimer);
    targetSearchTimer = null;
  }
  if (!editing.value) return;
  const query = draft.targetRef.trim();
  if (!query || query.length < 2) {
    searchError.value = '';
    draft.targetCandidates = [];
    return;
  }
  targetSearchTimer = setTimeout(() => {
    void searchTargets(false);
  }, delayMs);
}

function handleTargetInput() {
  clearResolvedTarget();
  scheduleTargetSearch();
}

function handleTargetTypeChange() {
  if (draft.targetType !== 'group') {
    draft.targetType = 'private';
  }
  clearResolvedTarget();
  scheduleTargetSearch(120);
}

async function approveSession() {
  if (!detail.value) return;
  operationResult.value = buildOperationPendingReceipt('approve', detail.value);
  busy.value = true;
  try {
    const response = await client.approveOutreachSession(detail.value.id);
    await loadDetail({ preserveOperationResult: true });
    operationResult.value = buildOperationSuccessReceipt(
      'approve',
      detail.value || response.session,
    );
  } catch (error) {
    operationResult.value = buildOperationFailureReceipt('批准发送', error);
  } finally {
    busy.value = false;
  }
}

async function cancelSession() {
  if (!detail.value) return;
  if (!window.confirm('确认取消这个主动询问会话吗？')) return;
  operationResult.value = buildOperationPendingReceipt('cancel', detail.value);
  busy.value = true;
  try {
    const response = await client.cancelOutreachSession(
      detail.value.id,
      'Cancelled from outreach detail UI',
    );
    await loadDetail({ preserveOperationResult: true });
    operationResult.value = buildOperationSuccessReceipt(
      'cancel',
      detail.value || response.session,
    );
  } catch (error) {
    operationResult.value = buildOperationFailureReceipt('取消主动询问', error);
  } finally {
    busy.value = false;
  }
}

async function retrySession() {
  if (!detail.value) return;
  operationResult.value = buildOperationPendingReceipt('retry', detail.value);
  busy.value = true;
  try {
    const response = await client.retryOutreachSession(detail.value.id);
    await loadDetail({ preserveOperationResult: true });
    operationResult.value = buildOperationSuccessReceipt(
      'retry',
      detail.value || response.session,
    );
  } catch (error) {
    operationResult.value = buildOperationFailureReceipt('重试主动询问', error);
  } finally {
    busy.value = false;
  }
}

async function saveDraft() {
  if (!detail.value) return;
  if (!draft.targetRef.trim()) {
    operationResult.value = buildOperationValidationReceipt('请先填写目标对象。');
    return;
  }
  if (!draft.renderedQuestion.trim()) {
    operationResult.value =
      buildOperationValidationReceipt('请先填写要发送的问题。');
    return;
  }
  const normalizedTargetRef = draft.targetRef.trim().toLowerCase();
  if (
    draft.targetType !== 'group' &&
    (normalizedTargetRef === 'user' ||
      normalizedTargetRef === 'me' ||
      normalizedTargetRef === 'self')
  ) {
    operationResult.value = buildOperationValidationReceipt(
      '主动询问只用于对外询问，不应把当前用户作为目标。',
    );
    return;
  }
  if (draft.targetResolutionStatus !== 'resolved') {
    operationResult.value = buildOperationValidationReceipt(
      '请先通过 RingCentral 检索并确认目标，确认后才能保存可审批的主动询问。',
    );
    return;
  }

  operationResult.value = buildOperationPendingReceipt('save', detail.value);
  busy.value = true;
  try {
    const response = await client.updateOutreachSessionDraft(detail.value.id, {
      targetType: draft.targetType,
      targetRef: draft.targetRef.trim(),
      targetResolutionStatus: draft.targetResolutionStatus,
      targetResolvedType: draft.targetResolvedType || undefined,
      targetResolvedId: draft.targetResolvedId || undefined,
      targetResolvedLabel: draft.targetResolvedLabel || undefined,
      targetResolvedChatId: draft.targetResolvedChatId || undefined,
      targetCandidates: draft.targetCandidates,
      renderedQuestion: draft.renderedQuestion.trim(),
      renderedContext: draft.renderedContext.trim(),
      nextCheckAt: parseDateTimeLocal(draft.nextCheckAtInput),
    });
    editing.value = false;
    await loadDetail({ preserveOperationResult: true });
    operationResult.value = buildOperationSuccessReceipt(
      'save',
      detail.value || response.session,
    );
  } catch (error) {
    operationResult.value =
      buildOperationFailureReceipt('保存主动询问调整', error);
  } finally {
    busy.value = false;
  }
}

function startEdit() {
  resetDraft(detail.value);
  searchError.value = '';
  editing.value = true;
  if (detail.value?.targetResolutionStatus !== 'resolved') {
    scheduleTargetSearch(80);
  }
}

function cancelEdit() {
  const hadChanges = draftChangedFields.value.length > 0;
  resetDraft(detail.value);
  searchError.value = '';
  editing.value = false;
  operationResult.value = buildDiscardDraftReceipt(hadChanges);
}

function canRetry(status: OutreachSessionStatus) {
  return status === 'failed' || status === 'no_reply' || status === 'escalated';
}

function canCancel(status: OutreachSessionStatus) {
  return (
    status === 'pending_approval' ||
    status === 'scheduled' ||
    status === 'waiting_reply' ||
    status === 'deferred'
  );
}

function canEdit(status: OutreachSessionStatus) {
  return status === 'pending_approval' || status === 'scheduled';
}

function canApprove(session: OutreachSession) {
  return session.targetResolutionStatus === 'resolved';
}

function detailActionButtonLabel(
  action: 'approve' | 'edit' | 'retry' | 'cancel',
  session: OutreachSession,
) {
  if (action === 'approve') {
    return canApprove(session) ? '批准发送' : '目标未确认，暂不能批准';
  }
  if (action === 'edit') return '编辑目标与时间';
  if (action === 'retry') return '重试';
  return '取消';
}

function backToListButtonBoundary() {
  return '返回主动询问列表；如果本页有未保存编辑草稿，会先询问是否丢弃。点击本按钮不会保存草稿、批准、发送、追问、重试、取消或写回 RingCentral。';
}

function backToListButtonAriaLabel() {
  return `返回主动询问列表：${backToListButtonBoundary()}`;
}

function retryDetailLoadButtonBoundary() {
  return '重新读取当前 Outreach 会话详情和目标目录状态；不会批准、发送、追问、重试、取消、保存草稿或写回 RingCentral。';
}

function retryDetailLoadButtonAriaLabel() {
  return `重试详情：${retryDetailLoadButtonBoundary()}`;
}

function formatDetailLoadFailure(label: string, error: unknown) {
  const raw = error instanceof Error ? error.message : String(error || '');
  const message = raw.replace(/^MemoryService\s+\d+:\s*/i, '').trim();
  return `${label}：${message || 'unknown error'}`;
}

function detailThreadLinkBoundary(session: OutreachSession) {
  return `打开关联自我反思线程 ${session.threadId}，用于核对这条主动询问的来源和阻塞原因；这是只读导航，不会推进反思、批准/取消 Outreach、发送消息、追问或写回 RingCentral。`;
}

function detailThreadLinkAriaLabel(session: OutreachSession) {
  return `查看线程：${detailThreadLinkBoundary(session)}`;
}

function detailActionLinkBoundary(session: OutreachSession) {
  return `打开关联动作 ${session.actionId} 的动作队列视图，只用于核对动作状态和来源；不会执行动作、批准/取消 Outreach、发送消息、追问或写回 RingCentral。`;
}

function detailActionLinkAriaLabel(session: OutreachSession) {
  return `查看动作：${detailActionLinkBoundary(session)}`;
}

function detailTemplateLinkBoundary(session: OutreachSession) {
  return `回到主动询问列表并按模板 ${session.templateId} 筛选会话；只更新列表 URL 和读取状态，不会创建新会话、批准、发送、追问、取消或写回 RingCentral。`;
}

function detailTemplateLinkAriaLabel(session: OutreachSession) {
  return `查看模板会话：${detailTemplateLinkBoundary(session)}`;
}

function detailSourceMessageLinkBoundary(session: OutreachSession) {
  return `在新标签页打开这条消息跟进的原消息，用于核对线程上下文；不会发送新追问、标记已回复、更新 Outreach 状态、保存草稿、写用户画像或写回 RingCentral。当前状态：${statusLabel(session.status)}。`;
}

function detailSourceMessageLinkAriaLabel(session: OutreachSession) {
  return `打开原消息：${detailSourceMessageLinkBoundary(session)}`;
}

function directoryRefreshButtonBoundary() {
  return '刷新 RingCentral 目标目录缓存，并在当前目标文本足够长时重新读取候选；不会保存本页草稿、批准、发送、追问、取消当前会话或写回 RingCentral 消息。';
}

function directoryRefreshButtonAriaLabel() {
  const label = syncingDirectory.value ? '刷新目录中' : '刷新目录';
  return `${label}：${directoryRefreshButtonBoundary()}`;
}

function targetSearchButtonBoundary() {
  const query = draft.targetRef.trim();
  const scope = draft.targetType === 'group' ? '群组' : '联系人或私聊';
  return `按当前目标文本${query ? `「${truncateReviewText(query)}」` : ''}重新检索 ${scope} 候选；只更新本页候选列表，不会保存草稿、批准、发送、追问或写回 RingCentral。`;
}

function targetSearchButtonAriaLabel() {
  return `重新检索：${targetSearchButtonBoundary()}`;
}

function targetCandidateButtonBoundary(candidate: OutreachTargetCandidate) {
  return `选择候选「${candidate.label}」只会把本页编辑草稿的目标标成已确认；保存调整前不会写入 Memory Service，也不会批准、发送、追问或写回 RingCentral。`;
}

function targetCandidateButtonAriaLabel(candidate: OutreachTargetCandidate) {
  return `选择候选 ${candidate.label}：${targetCandidateButtonBoundary(candidate)}`;
}

function detailActionButtonTitle(
  action: 'approve' | 'edit' | 'retry' | 'cancel',
  session: OutreachSession,
) {
  const targetText = receiptTargetLabel(session);
  if (action === 'approve') {
    if (!canApprove(session)) {
      return '目标未确认；先编辑并选择唯一 RingCentral 用户或群组，按钮不会外发消息。';
    }
    return `批准后才会把当前问题交给 Outreach 引擎处理，目标：${targetText}；是否已发出仍以 dispatched 事件、sentPostId 和等待回复状态为准。`;
  }
  if (action === 'edit') {
    return '只打开本页发送前草稿；保存前不会更新 Memory Service、审批、发送、追问或写回 RingCentral。';
  }
  if (action === 'retry') {
    const nextStatus = session.requiresApproval ? '待审批' : '已排程';
    return `重试会请求 Memory Service 将这个终态会话重置为「${nextStatus}」并写入 retried 审计；不会直接发送、确认回复或清除旧错误。`;
  }
  return '取消会请求 Memory Service 停止这个会话后续发送、检查和追问；不会撤回已发 RingCentral 消息、删除来源证据或写用户画像。';
}

function detailActionButtonAriaLabel(
  action: 'approve' | 'edit' | 'retry' | 'cancel',
  session: OutreachSession,
) {
  return `${detailActionButtonLabel(action, session)}：${detailActionButtonTitle(action, session)}`;
}

function draftActionButtonTitle(action: 'save' | 'cancel') {
  if (action === 'save') {
    return '保存调整只更新目标、问题、完成标准和计划发送时间；不会批准、发送、追问或写回 RingCentral。';
  }
  return '取消编辑只丢弃本页未保存草稿，恢复为 Memory Service 上次确认内容；不会提交、审批或外发。';
}

function draftActionButtonAriaLabel(action: 'save' | 'cancel') {
  const label = action === 'save' ? '保存调整' : '取消编辑';
  return `${label}：${draftActionButtonTitle(action)}`;
}

function relativeTime(ts: number) {
  const normalized = normalizeTimestamp(ts);
  const diff = normalized - Date.now();
  const abs = Math.abs(diff);
  const minutes = Math.floor(abs / 60000);
  if (minutes < 1) return diff >= 0 ? '即将' : '刚刚';
  if (minutes < 60) return diff >= 0 ? `${minutes}分钟后` : `${minutes}分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return diff >= 0 ? `${hours}小时后` : `${hours}小时前`;
  const days = Math.floor(hours / 24);
  return diff >= 0 ? `${days}天后` : `${days}天前`;
}

function normalizeTimestamp(ts?: number) {
  if (!ts || !Number.isFinite(ts)) return Date.now();
  return ts > 1_000_000_000_000 ? ts : ts * 1000;
}

function toDateTimeLocal(ts?: number) {
  if (!ts || !Number.isFinite(ts)) return '';
  const normalized = normalizeTimestamp(ts);
  const date = new Date(normalized);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function parseDateTimeLocal(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return Math.floor(parsed.getTime() / 1000);
}

function resetDraft(session: OutreachSession | null) {
  draft.targetType = session?.targetType === 'group' ? 'group' : 'private';
  draft.targetRef = session?.targetRef || '';
  draft.targetResolutionStatus =
    session?.targetResolutionStatus || 'unresolved';
  draft.targetResolvedType = session?.targetResolvedType || '';
  draft.targetResolvedId = session?.targetResolvedId || '';
  draft.targetResolvedLabel = session?.targetResolvedLabel || '';
  draft.targetResolvedChatId = session?.targetResolvedChatId || '';
  draft.targetCandidates = Array.isArray(session?.targetCandidates)
    ? [...session!.targetCandidates!]
    : [];
  draft.renderedQuestion = session?.renderedQuestion || '';
  draft.renderedContext = session?.renderedContext || '';
  draft.nextCheckAtInput = toDateTimeLocal(session?.nextCheckAt);
}

function goBackToList() {
  if (shouldWarnUnsavedDraft()) {
    const confirmed = window.confirm(
      '当前主动询问编辑草稿尚未保存，返回列表会丢弃本页草稿。确认返回？',
    );
    if (!confirmed) return;
    skipNextUnsavedDraftPrompt = true;
  }
  void router.push('/outreach');
}

function shouldWarnUnsavedDraft() {
  return editing.value && draftChangedFields.value.length > 0;
}

function normalizeDraftValue(value: string | null | undefined) {
  return (value ?? '').trim();
}

function buildDraftChangedFields() {
  const session = detail.value;
  if (!editing.value || !session) return [];

  const fields: string[] = [];
  const targetChanged =
    draft.targetType !==
      (session.targetType === 'group' ? 'group' : 'private') ||
    normalizeDraftValue(draft.targetRef) !==
      normalizeDraftValue(session.targetRef) ||
    draft.targetResolutionStatus !==
      (session.targetResolutionStatus || 'unresolved') ||
    normalizeDraftValue(draft.targetResolvedType) !==
      normalizeDraftValue(session.targetResolvedType) ||
    normalizeDraftValue(draft.targetResolvedId) !==
      normalizeDraftValue(session.targetResolvedId) ||
    normalizeDraftValue(draft.targetResolvedLabel) !==
      normalizeDraftValue(session.targetResolvedLabel) ||
    normalizeDraftValue(draft.targetResolvedChatId) !==
      normalizeDraftValue(session.targetResolvedChatId);
  if (targetChanged) fields.push('目标对象');
  if (
    normalizeDraftValue(draft.renderedQuestion) !==
    normalizeDraftValue(session.renderedQuestion)
  ) {
    fields.push('问题');
  }
  if (
    normalizeDraftValue(draft.renderedContext) !==
    normalizeDraftValue(session.renderedContext)
  ) {
    fields.push('信息目标 / 完成标准');
  }
  if (draft.nextCheckAtInput !== toDateTimeLocal(session.nextCheckAt)) {
    fields.push('计划发送时间');
  }
  return fields;
}

function buildDraftChangeReceipt(): OperationResultReceipt {
  const fields = draftChangedFields.value;
  if (fields.length === 0) {
    return {
      title: '未保存草稿回执',
      tone: 'muted',
      items: [
        '当前只是打开本页编辑草稿；保存调整前不会写入 Memory Service、审批、发送、追问或写回 RingCentral。',
        '暂无未保存字段；你可以继续修改、保存调整或取消编辑。',
      ],
    };
  }
  return {
    title: '未保存草稿回执',
    tone: 'queued',
    items: [
      `未保存字段：${fields.join('、')}。`,
      '保存调整后才会更新 Memory Service 会话草稿；批准、发送和追问仍按当前状态另行推进。',
      '取消编辑、返回列表或离开页面会丢弃这些本页草稿，不会把草稿写入队列。',
    ],
  };
}

function buildDiscardDraftReceipt(hadChanges: boolean): OperationResultReceipt {
  return {
    title: hadChanges
      ? '操作回执：未保存草稿已丢弃'
      : '操作回执：已退出编辑',
    tone: 'muted',
    items: [
      hadChanges
        ? '已恢复为 Memory Service 上次确认的会话内容。'
        : '本页没有检测到未保存字段。',
      '没有保存目标、问题、完成标准或计划时间，也没有批准、发送、追问或写回 RingCentral。',
    ],
  };
}

function buildOperationPendingReceipt(
  action: 'approve' | 'cancel' | 'retry' | 'save',
  session: OutreachSession,
): OperationResultReceipt {
  const targetText = receiptTargetLabel(session);
  const actionText =
    action === 'approve'
      ? '批准发送'
      : action === 'cancel'
        ? '取消主动询问'
        : action === 'retry'
          ? '重试主动询问'
          : '保存发送前调整';
  const nextTruth =
    action === 'approve'
      ? '审批、排程、dispatched 事件、sentPostId 和等待回复状态'
      : action === 'cancel'
        ? '取消状态、后续检查停止和事件时间线'
        : action === 'retry'
          ? '重置后的状态、retried 审计事件和下一轮排程'
          : 'Memory Service 返回的目标、问题、完成标准和计划时间';

  return {
    title: `操作提交中回执：${actionText}请求已提交`,
    tone: 'queued',
    items: [
      `本页已向 Memory Service 提交请求；当前仍显示上次成功读取的状态 ${statusLabel(session.status)}，目标：${targetText}。`,
      `按钮已临时锁定，避免重复提交；${nextTruth}要等 Memory Service 返回后才能确认。`,
      '提交中回执不代表 RingCentral 已发送、对方已回复、用户画像已写入、外部平台已同步或来源证据已删除。',
    ],
  };
}

async function searchTargets(manual = true) {
  const query = draft.targetRef.trim();
  if (!query) {
    searchError.value = manual ? '请先输入要检索的目标文本。' : '';
    return;
  }
  if (query.length < 2) {
    searchError.value = manual ? '请至少输入 2 个字符后再检索。' : '';
    draft.targetCandidates = [];
    return;
  }
  if (isSystemPseudoTarget(query)) {
    clearResolvedTarget();
    searchError.value =
      '`sync.service` 是定时消息里的系统伪目标，不是实际的 RingCentral 用户/群组，不能直接用于主动询问。';
    return;
  }
  const currentSearch = ++targetSearchSequence;
  searchingTargets.value = true;
  searchError.value = '';
  try {
    const response = await client.searchOutreachTargets(
      draft.targetType,
      query,
      8,
    );
    if (currentSearch !== targetSearchSequence) {
      return;
    }
    directoryStatus.value = Array.isArray(response.directoryStatus)
      ? response.directoryStatus
      : directoryStatus.value;
    draft.targetCandidates = response.items;
    if (response.items.length === 0) {
      clearResolvedTarget();
      const scopeStatus = activeDirectoryScopeStatus();
      const syncHint =
        scopeStatus?.status === 'syncing'
          ? '目录仍在同步中，你也可以稍后再试。'
          : scopeStatus?.status === 'error'
            ? '目录同步失败，建议先去 Options 刷新目录，或直接粘贴聊天链接 / chat ID。'
            : '';
      searchError.value =
        draft.targetType === 'group'
          ? `未找到与 “${query}” 匹配的群组目标。请确认当前已切到群组模式；也可以直接粘贴群聊链接或 chat ID。${syncHint ? ` ${syncHint}` : ''}`
          : `未找到与 “${query}” 匹配的人员或私聊目标。某个人模式不会检索群名；如果你要找群，请切到群组模式。若是 service account 或历史私聊，建议直接粘贴聊天链接。${syncHint ? ` ${syncHint}` : ''}`;
      return;
    }
    if (response.items.length === 1 && response.items[0].score >= 90) {
      selectTargetCandidate(response.items[0]);
      return;
    }
    draft.targetResolutionStatus = 'ambiguous';
    draft.targetResolvedType = '';
    draft.targetResolvedId = '';
    draft.targetResolvedLabel = '';
    draft.targetResolvedChatId = '';
    searchError.value = '找到多个可能目标，请从下方候选中明确选择。';
  } catch (error) {
    if (currentSearch !== targetSearchSequence) {
      return;
    }
    clearResolvedTarget();
    searchError.value = error instanceof Error ? error.message : String(error);
  } finally {
    if (currentSearch === targetSearchSequence) {
      searchingTargets.value = false;
    }
  }
}

async function refreshDirectory() {
  syncingDirectory.value = true;
  try {
    const response = await client.syncOutreachDirectory(true);
    directoryStatus.value = Array.isArray(response?.items)
      ? response.items
      : [];
    if (draft.targetRef.trim().length >= 2) {
      await searchTargets(false);
    }
  } catch (error) {
    searchError.value = error instanceof Error ? error.message : String(error);
  } finally {
    syncingDirectory.value = false;
  }
}

function selectTargetCandidate(candidate: OutreachTargetCandidate) {
  draft.targetRef = candidate.label;
  draft.targetResolutionStatus = 'resolved';
  draft.targetResolvedType = candidate.kind;
  draft.targetResolvedId = candidate.entityId;
  draft.targetResolvedLabel = candidate.label;
  draft.targetResolvedChatId = candidate.chatId || '';
  searchError.value = '';
}

function clearResolvedTarget() {
  draft.targetResolutionStatus = 'unresolved';
  draft.targetResolvedType = '';
  draft.targetResolvedId = '';
  draft.targetResolvedLabel = '';
  draft.targetResolvedChatId = '';
  draft.targetCandidates = [];
}

const draftResolutionLabel = computed(() => {
  if (draft.targetResolutionStatus === 'resolved') {
    return `已确认：${resolvedTargetSummary(draft.targetType, draft.targetResolvedType, draft.targetResolvedLabel || draft.targetRef)}`;
  }
  if (draft.targetResolutionStatus === 'ambiguous') {
    return '找到多个候选，待你确认';
  }
  return '未确认';
});

function activeDirectoryScopeStatus() {
  const scope = draft.targetType === 'group' ? 'teams' : 'users';
  return directoryStatus.value.find((item) => item.scope === scope);
}

const directoryStatusHint = computed(() => {
  const current = activeDirectoryScopeStatus();
  if (!current) return '目录状态未知';
  if (current.status === 'ready') {
    return current.stale
      ? `目录已同步 ${current.recordCount} 条，但缓存已过期，后台会继续刷新。`
      : `目录已就绪，共 ${current.recordCount} 条。`;
  }
  if (current.status === 'syncing') {
    return `目录同步中，当前 ${current.recordCount} 条。`;
  }
  if (current.status === 'error') {
    return `目录同步失败：${current.lastError || 'unknown error'}`;
  }
  return '目录尚未同步';
});

function formatJson(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function statusLabel(status: string) {
  if (status === 'pending_approval') return '待审批';
  if (status === 'scheduled') return '已排程';
  if (status === 'waiting_reply') return '等待回复';
  if (status === 'deferred') return '延期等待';
  if (status === 'resolved') return '已拿到结果';
  if (status === 'no_reply') return '无回复';
  if (status === 'escalated') return '已升级';
  if (status === 'cancelled') return '已取消';
  if (status === 'failed') return '失败';
  return status || '未知状态';
}

function originLabel(originKind?: string) {
  if (originKind === 'reflection_action') return '自我反思';
  if (originKind === 'message_reaction') return '消息跟进';
  if (originKind === 'scheduled_template' || originKind === 'manual_action')
    return '手动/定时';
  return '未知来源';
}

function isMessageReactionSession(session: OutreachSession) {
  return session.originKind === 'message_reaction';
}

function messageReactionSourceUrl(session: OutreachSession): string {
  if (!isMessageReactionSession(session)) return '';
  const raw = session.outcome?.messageUrl;
  if (typeof raw !== 'string' || !raw.trim()) return '';
  try {
    const url = new URL(raw);
    return url.protocol === 'http:' || url.protocol === 'https:'
      ? url.href
      : '';
  } catch {
    return '';
  }
}

function targetTypeLabel(targetType?: string) {
  if (targetType === 'private' || targetType === 'person') return '某个人';
  if (targetType === 'group') return '群组';
  return targetType || '未知目标';
}

function targetResolutionLabel(targetRef?: string) {
  const normalizedRef = targetRef?.trim().toLowerCase() || '';
  if (!normalizedRef) return '目标待确认';
  return '原始对象文本';
}

function resolvedTargetSummary(
  targetType?: string,
  resolvedType?: string | null,
  label?: string,
) {
  const resolvedLabel = label || '未知对象';
  if (targetType === 'group') {
    return `已确认群组：${resolvedLabel}`;
  }
  if (resolvedType === 'user') {
    return `已确认联系人：${resolvedLabel}`;
  }
  if (resolvedType === 'chat') {
    return `已确认已有私聊：${resolvedLabel}`;
  }
  return `已确认对象：${resolvedLabel}`;
}

function sessionTargetResolutionLabel(session: OutreachSession) {
  if (session.targetResolutionStatus === 'resolved') {
    return resolvedTargetSummary(
      session.targetType,
      session.targetResolvedType,
      session.targetResolvedLabel || session.targetRef,
    );
  }
  if (session.targetResolutionStatus === 'ambiguous') {
    return '找到多个候选，待你确认';
  }
  return targetResolutionLabel(session.targetRef);
}

function candidateTypeLabel(candidate: OutreachTargetCandidate) {
  if (draft.targetType === 'group') return '群组';
  if (candidate.kind === 'user') return '联系人';
  if (candidate.kind === 'chat') return '已有私聊';
  return '候选对象';
}

function latestReplyEvent(session: OutreachSession) {
  return getLatestReplyEvent(session);
}

function currentEvidenceSnapshot() {
  return detail.value
    ? getOutreachEvidenceSnapshot(detail.value)
    : {
        hasEvidence: false,
        stateLabel: '',
        phaseKey: '',
        phaseLabel: '',
        source: '',
        summary: '',
        relatedMessage: '',
        relatedMessageId: '',
        relatedMessageSpeaker: '',
      };
}

function currentMentionLabels() {
  return collectEvidenceMentionLabels(detail.value);
}

function replySenderDisplay(session: OutreachSession) {
  const explicitSender = session.replySender?.trim();
  if (explicitSender) return explicitSender;

  const replyEventSender = latestReplyEvent(session)?.payload?.replySender;
  if (typeof replyEventSender === 'string' && replyEventSender.trim()) {
    return replyEventSender.trim();
  }

  if (
    (session.targetType === 'private' || session.targetType === 'person') &&
    session.targetResolutionStatus === 'resolved'
  ) {
    return session.targetResolvedLabel || session.targetRef || '未知发送者';
  }

  if (
    (session.targetType === 'private' || session.targetType === 'person') &&
    session.targetRef?.trim()
  ) {
    return session.targetRef.trim();
  }

  return '未知发送者';
}

function replySenderIsInferred(session: OutreachSession) {
  const explicitSender = session.replySender?.trim();
  if (explicitSender) return false;
  const replyEventSender = latestReplyEvent(session)?.payload?.replySender;
  if (typeof replyEventSender === 'string' && replyEventSender.trim()) {
    return false;
  }
  return session.targetType === 'private' || session.targetType === 'person';
}

function nextTimeLabel(status: OutreachSessionStatus) {
  if (status === 'pending_approval' || status === 'scheduled') {
    return '计划发送';
  }
  return '下次检查';
}

function receiptTargetLabel(session: OutreachSession) {
  const resolved =
    session.targetResolvedLabel?.trim() ||
    session.targetResolvedChatId?.trim() ||
    session.targetResolvedId?.trim();
  const fallback = session.targetRef?.trim() || '未确认目标';
  return `${targetTypeLabel(session.targetType)}「${resolved || fallback}」`;
}

function buildOperationSuccessReceipt(
  action: 'approve' | 'cancel' | 'retry' | 'save',
  session: OutreachSession | null | undefined,
): OperationResultReceipt {
  const statusText = session ? statusLabel(session.status) : '未知状态';
  const targetText = session ? receiptTargetLabel(session) : '未知目标';

  if (action === 'approve') {
    return {
      title: '操作回执：批准请求已由 Memory Service 处理',
      tone:
        session?.status === 'failed'
          ? 'error'
          : session?.status === 'scheduled'
            ? 'queued'
            : 'ok',
      items: [
        `当前会话状态：${statusText}；目标：${targetText}。`,
        '这表示审批状态已刷新；是否已经发出仍以 dispatched 事件、sentPostId 和等待回复状态为准。',
        '这次回执不代表对方已回复、不写用户画像、不确认决策，也不向其它外部系统同步。',
      ],
    };
  }

  if (action === 'retry') {
    return {
      title: '操作回执：重试请求已记录',
      tone: session?.status === 'pending_approval' ? 'queued' : 'ok',
      items: [
        `当前会话状态：${statusText}；目标：${targetText}。`,
        '重试会保留旧终态和 retried 审计事件；它不证明 RingCentral 已重新发送或外部人员已回复。',
        '下一轮是否外发仍取决于目标确认、审批状态、计划时间和 Outreach 引擎轮询。',
      ],
    };
  }

  if (action === 'cancel') {
    return {
      title: '操作回执：会话已取消',
      tone: 'muted',
      items: [
        `当前会话状态：${statusText}；目标：${targetText}。`,
        '取消只停止这个 Outreach session 的后续发送、检查和追问。',
        '它不会撤回已发 RingCentral 消息，不删除来源证据、反思线程、事件记录或定时模板。',
      ],
    };
  }

  return {
    title: '操作回执：发送前调整已保存',
    tone: 'queued',
    items: [
      `当前会话状态：${statusText}；目标：${targetText}。`,
      '保存调整只更新目标、问题、完成标准和计划发送时间。',
      '保存本身不会发送消息、追问、确认答案、写用户画像或同步外部平台。',
    ],
  };
}

function buildOperationFailureReceipt(
  actionLabel: string,
  error: unknown,
): OperationResultReceipt {
  const raw = error instanceof Error ? error.message : String(error);
  const message = raw.replace(/^MemoryService\s+\d+:\s*/i, '').trim();
  return {
    title: `操作失败回执：${actionLabel}未确认`,
    tone: 'error',
    items: [
      message || 'Memory Service 没有返回可用错误信息。',
      '页面不会把这次点击当成已批准、已发送、已重试、已取消或已保存。',
      '请先刷新详情或回到列表核对当前队列状态，再决定是否重试。',
    ],
  };
}

function buildOperationValidationReceipt(
  message: string,
): OperationResultReceipt {
  return {
    title: '操作前检查未通过',
    tone: 'error',
    items: [
      message,
      '这次检查只在本页拦截输入，没有发送消息、保存调整或修改 Memory Service 队列。',
    ],
  };
}

function sessionOperationReceipt(
  session: OutreachSession,
): OperationScopeReceipt {
  const targetLabel = receiptTargetLabel(session);
  const nextCheckText = session.nextCheckAt
    ? relativeTime(session.nextCheckAt)
    : '引擎下次轮询时';
  const waitText = session.waitUntil
    ? relativeTime(session.waitUntil)
    : '对方给出新回复前';

  if (session.status === 'pending_approval') {
    return {
      title: '本次操作范围',
      tone: canApprove(session) ? 'queued' : 'error',
      items: [
        canApprove(session)
          ? `批准会把问题交给 Outreach 引擎，${nextCheckText}发送到 ${targetLabel}。`
          : '目标尚未确认，顶部批准按钮不会发起外部消息；先编辑并选择唯一 RingCentral 候选。',
        '编辑只更新目标、问题、完成标准和计划时间；保存调整不会发送、追问或写回 RingCentral。',
        '取消只关闭这个 Outreach session，保留事件和来源证据，不删除原始消息、反思线程或定时模板。',
      ],
    };
  }

  if (session.status === 'scheduled') {
    return {
      title: '本次操作范围',
      tone: 'queued',
      items: [
        `这条会话已完成审批或无需审批；到达计划时间才会尝试发送到 ${targetLabel}。`,
        '编辑仍只更新目标、问题、完成标准和计划时间；保存后不会立刻发送。',
        '取消会停止本会话后续发送和轮询，不撤回已存在的原消息，也不改写模板历史。',
      ],
    };
  }

  if (session.status === 'waiting_reply') {
    return {
      title: '本次操作范围',
      tone: 'waiting',
      items: [
        isMessageReactionSession(session)
          ? '这条跟进先检查原消息线程和目标会话回复；刷新详情不会发送新追问。'
          : `当前只等待 ${targetLabel} 回复；刷新详情不会重复打扰同一目标。`,
        `下次检查在 ${nextCheckText}，届时引擎才会判断是否追问、延期或结束；追问上限仍是 ${session.followupCount}/${session.maxFollowup}。`,
        '取消只停止后续检查和追问，不删除已发 RingCentral 消息、来源证据或已记录事件。',
      ],
    };
  }

  if (session.status === 'deferred') {
    return {
      title: '本次操作范围',
      tone: 'waiting',
      items: [
        `当前按对方回复或系统判断延期等待；${waitText} 不会重复追问 ${targetLabel}。`,
        `下次检查在 ${nextCheckText}，刷新页面只读取 Memory Service 状态。`,
        '取消只停止后续检查和追问，不确认答案、不写外部系统，也不删除已有回复证据。',
      ],
    };
  }

  if (
    session.status === 'failed' ||
    session.status === 'no_reply' ||
    session.status === 'escalated'
  ) {
    const nextStatus = session.requiresApproval ? '待审批' : '已排程';
    const errorText = session.errorMessage?.trim()
      ? `旧失败原因仍保留：${session.errorMessage.trim()}。`
      : '旧终态和事件仍保留在时间线中。';
    return {
      title: '本次操作范围',
      tone: 'error',
      items: [
        `重试会把这个终态会话重置为「${nextStatus}」，并写入 retried 审计事件。`,
        '重试不是确认已发送或已回复；下一轮是否外发仍取决于目标确认、审批状态和引擎轮询。',
        errorText,
      ],
    };
  }

  if (session.status === 'resolved') {
    return {
      title: '本次操作范围',
      tone: 'ok',
      items: [
        '当前只是查看已归档结果；刷新详情不会重新发送、追问或改写原消息。',
        '结果摘要和结构化证据来自 Memory Service 记录；需要继续查证时应从后续查证动作或新会话进入。',
        '本页不会把结果自动写入用户画像、确认决策或同步到外部平台。',
      ],
    };
  }

  if (session.status === 'cancelled') {
    return {
      title: '本次操作范围',
      tone: 'muted',
      items: [
        '这条主动询问已取消；查看详情不会恢复发送、追问或轮询。',
        '历史事件和来源证据仍保留供复核，不会删除原始消息或反思线程。',
        '如需重新询问，应从新的触发来源或可重试终态重新进入。',
      ],
    };
  }

  return {
    title: '本次操作范围',
    tone: 'muted',
    items: [
      '本页读取当前 Outreach session 状态，不会自动发送、追问、重试或写回 RingCentral。',
      '可用按钮会按当前状态决定是否需要目标确认、审批或人工恢复。',
    ],
  };
}

function buildPreDispatchReviewReceipt(
  session: OutreachSession,
): OperationScopeReceipt | null {
  if (session.status !== 'pending_approval' && session.status !== 'scheduled') {
    return null;
  }

  const snapshot = getOutreachEvidenceSnapshot(session);
  const hasReply = Boolean(session.replyRawText?.trim());
  const outcomeSummary = extractOutcomeSummary(session.outcome);
  const hasExistingAnswer =
    hasReply || Boolean(outcomeSummary) || snapshot.hasEvidence;
  const updatedAt = normalizeTimestamp(session.updatedAt || session.createdAt);
  const ageMs = Date.now() - updatedAt;
  const stale = ageMs > PRE_DISPATCH_STALE_MS;
  const targetText = receiptTargetLabel(session);
  const timing =
    session.status === 'pending_approval'
      ? session.nextCheckAt
        ? `批准后计划在 ${relativeTime(session.nextCheckAt)} 发送。`
        : '批准后会交给 Outreach 引擎在下一轮轮询中尽快发送。'
      : session.nextCheckAt
        ? `当前已排程，计划在 ${relativeTime(session.nextCheckAt)} 发送。`
        : '当前已排程但缺少下一次检查时间，需刷新详情或回到列表核对。';
  const items = [
    canApprove(session)
      ? `目标已确认：${targetText}。`
      : '目标尚未确认，不能批准外发；先编辑并选择唯一 RingCentral 候选。',
    timing,
    stale
      ? `这条会话最后更新于 ${relativeTime(updatedAt)}；批准前建议核对问题是否仍然需要外发。`
      : `这条会话最近更新于 ${relativeTime(updatedAt)}，仍按当前详情复核。`,
  ];

  if (hasExistingAnswer) {
    const evidenceLabel =
      outcomeSummary ||
      session.replyRawText?.trim() ||
      snapshot.summary ||
      '已有结构化证据或回复线索';
    items.push(
      `本页已有证据线索：${truncateReviewText(evidenceLabel)}。如果这已经回答问题，优先取消或编辑问题，避免重复打扰。`,
    );
  } else {
    items.push(
      '本页未看到可直接替代外发的问题答案；仍需以目标、时间和完成标准为准复核。',
    );
  }

  if (isMessageReactionSession(session) && messageReactionSourceUrl(session)) {
    items.push(
      '这条来自消息跟进；批准前可以先打开原消息确认线程里没有新回复。',
    );
  }

  items.push(
    '复核回执只读取当前详情页快照，不会自动刷新 RingCentral、发送消息、确认答案或写用户画像。',
  );

  return {
    title: '发送前复核',
    tone: !canApprove(session)
      ? 'error'
      : stale || hasExistingAnswer
        ? 'waiting'
        : 'queued',
    items,
  };
}

function truncateReviewText(value: string) {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= 90) return normalized;
  return `${normalized.slice(0, 87)}...`;
}

function replyClassificationLabel(value?: string) {
  if (value === 'answer') return '已答复';
  if (value === 'defer') return '稍后回复';
  if (value === 'irrelevant') return '回复不相关';
  if (value === 'decline') return '明确拒绝';
  if (value === 'unclear') return '回复不明确';
  return '未分类';
}

function eventTypeLabel(eventOrType?: OutreachEvent | string) {
  const value =
    typeof eventOrType === 'string' ? eventOrType : eventOrType?.eventType;
  const payload =
    typeof eventOrType === 'string' ? undefined : eventOrType?.payload;
  if (value === 'created' && payload?.retried === true) return '已重试';
  if (value === 'created') return '已创建';
  if (value === 'edited') return '已调整发送信息';
  if (value === 'approved') return '已批准发送';
  if (value === 'dispatched') return '已发送';
  if (value === 'reply_received') return '收到回复';
  if (value === 'reply_classified') return '回复已解析';
  if (value === 'deferred_by_reply') return '按回复延期';
  if (value === 'followup_sent') return '已发送追问';
  if (value === 'resolved') return '已结束并拿到结果';
  if (value === 'no_reply') return '超时无回复';
  if (value === 'escalated') return '已升级处理';
  if (value === 'cancelled') return '已取消';
  if (value === 'retried') return '已重试';
  if (value === 'failed') return '执行失败';
  return value || '未知事件';
}

function eventSummary(event: OutreachEvent): string {
  const payload = event.payload ?? {};
  const isRetry =
    event.eventType === 'retried' ||
    (event.eventType === 'created' && payload.retried === true);
  if (!isRetry) return '';

  const previousStatus =
    typeof payload.previousStatus === 'string'
      ? statusLabel(payload.previousStatus)
      : '上一次终态';
  const nextStatus =
    typeof payload.nextStatus === 'string'
      ? statusLabel(payload.nextStatus)
      : '下一轮待处理状态';
  const nextCheckAt =
    typeof payload.nextCheckAt === 'number' && Number.isFinite(payload.nextCheckAt)
      ? `，下次检查 ${relativeTime(payload.nextCheckAt)}`
      : '';
  return `已从「${previousStatus}」重置为「${nextStatus}」${nextCheckAt}。`;
}

function extractOutcomeSummary(
  outcome: Record<string, unknown> | undefined,
): string {
  if (!outcome) return '';
  const candidates = [
    outcome.resolvedConclusion,
    outcome.summary,
    outcome.reason,
    outcome.answer,
    outcome.answerText,
    outcome.reply,
  ];
  const found = candidates.find(
    (value) => typeof value === 'string' && value.trim().length > 0,
  );
  return typeof found === 'string' ? found.trim() : '';
}

function sessionSummary(session: OutreachSession): string {
  const outcomeSummary = extractOutcomeSummary(session.outcome);
  if (outcomeSummary) return outcomeSummary;
  if (session.status === 'pending_approval')
    return '等待人工审批。批准后系统才会正式发出询问。';
  if (session.status === 'scheduled') return '会话已创建，等待到达发送时间。';
  if (session.status === 'waiting_reply')
    return isMessageReactionSession(session)
      ? '这条跟进来自原始消息。系统正在检查当前会话是否已有满足完成标准的回复；没有命中时才会继续追问。'
      : '询问已发出，系统正在等待对方回复。';
  if (session.status === 'deferred') {
    return session.waitUntil
      ? `对方表示稍后回复，当前等待到 ${relativeTime(session.waitUntil)}。`
      : '对方表示稍后回复，当前继续等待。';
  }
  if (session.status === 'resolved') {
    const resolutionState =
      typeof session.outcome?.resolutionState === 'string'
        ? session.outcome.resolutionState
        : '';
    if (resolutionState === 'partial') {
      return '已拿到部分可用结论，系统正在继续查证更精确的细节。';
    }
    if (resolutionState === 'insufficient') {
      return '已收到线索，但仍需继续查证或等待人工判断。';
    }
    return session.replyRawText?.trim() || '已收到可用回复，结果已归档。';
  }
  if (session.status === 'no_reply')
    return '已达到等待与追问上限，仍未收到回复。';
  if (session.status === 'escalated')
    return '系统无法自动继续，已升级等待人工判断。';
  if (session.status === 'cancelled') return '该主动询问已被取消。';
  if (session.status === 'failed') {
    return session.errorMessage?.trim() || '发送或轮询过程中发生错误。';
  }
  return '会话状态已更新。';
}

function statusClass(status: string) {
  if (status === 'resolved') return 'ok';
  if (status === 'waiting_reply' || status === 'deferred') return 'waiting';
  if (status === 'pending_approval' || status === 'scheduled') return 'queued';
  if (status === 'escalated' || status === 'failed' || status === 'no_reply')
    return 'error';
  return '';
}

function followUpActionStatusLabel(action: RuntimeAction) {
  if (action.queueStatus === 'succeeded') return '已完成';
  if (action.queueStatus === 'running') return '执行中';
  if (action.queueStatus === 'queued')
    return action.executionMode === 'auto' ? '等待自动执行' : '等待审批';
  if (action.queueStatus === 'failed') return '执行失败';
  if (action.queueStatus === 'dead_letter') return '已停止重试';
  if (action.queueStatus === 'cancelled') return '已取消';
  return action.queueStatus;
}
</script>

<style scoped>
.outreach-detail-page {
  animation: fadeInUp 0.5s ease-out;
}

.page-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.25rem;
}

.back-btn,
.primary-btn,
.ghost-btn,
.danger-btn {
  border: none;
  border-radius: 0.8rem;
  padding: 0.7rem 1rem;
  cursor: pointer;
}

.back-btn,
.ghost-btn {
  background: rgba(30, 41, 59, 0.8);
  color: #e2e8f0;
}

.primary-btn {
  background: linear-gradient(135deg, #0284c7, #2563eb);
  color: #fff;
}

.danger-btn {
  background: rgba(239, 68, 68, 0.18);
  color: #fca5a5;
}

.action-bar {
  display: flex;
  gap: 0.75rem;
}

.detail-layout {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.detail-load-error,
.detail-load-warning {
  border: 1px solid rgba(248, 113, 113, 0.28);
  border-radius: 0.95rem;
  padding: 1rem;
  background: rgba(69, 10, 10, 0.28);
  color: #fecaca;
}

.detail-load-warning {
  border-color: rgba(245, 158, 11, 0.25);
  background: rgba(69, 26, 3, 0.28);
  color: #fed7aa;
}

.detail-load-title {
  font-weight: 700;
  color: #f8fafc;
  margin-bottom: 0.45rem;
}

.detail-load-error p,
.detail-load-warning p {
  margin: 0.45rem 0 0;
  line-height: 1.6;
}

.detail-load-actions {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin-top: 0.9rem;
}

.hero-card,
.panel {
  background: rgba(15, 23, 42, 0.72);
  border: 1px solid rgba(148, 163, 184, 0.12);
  border-radius: 1rem;
  padding: 1.25rem;
}

.hero-top,
.hero-meta,
.inline-head {
  display: flex;
  gap: 0.75rem;
}

.hero-top {
  justify-content: space-between;
}

.hero-top h2 {
  margin-bottom: 0.5rem;
}

.hero-top p {
  color: #cbd5e1;
  line-height: 1.6;
}

.hero-meta {
  margin-top: 0.9rem;
  color: #94a3b8;
  font-size: 0.83rem;
  flex-wrap: wrap;
}

.operation-scope-receipt,
.operation-result-receipt,
.draft-boundary-receipt,
.pre-dispatch-review-receipt {
  margin-top: 1rem;
  border: 1px solid rgba(148, 163, 184, 0.16);
  border-radius: 0.85rem;
  padding: 0.9rem 1rem;
  background: rgba(30, 41, 59, 0.56);
  color: #cbd5e1;
}

.operation-scope-title,
.operation-result-title,
.draft-boundary-title,
.pre-dispatch-review-title {
  font-weight: 700;
  color: #e2e8f0;
  margin-bottom: 0.55rem;
}

.operation-scope-receipt ul,
.operation-result-receipt ul,
.draft-boundary-receipt ul,
.pre-dispatch-review-receipt ul {
  margin: 0;
  padding-left: 1.1rem;
  display: grid;
  gap: 0.4rem;
}

.operation-scope-receipt li,
.operation-result-receipt li,
.draft-boundary-receipt li,
.pre-dispatch-review-receipt li {
  line-height: 1.55;
}

.operation-scope-receipt.queued,
.operation-result-receipt.queued,
.draft-boundary-receipt.queued,
.pre-dispatch-review-receipt.queued {
  border-color: rgba(56, 189, 248, 0.26);
  background: rgba(8, 47, 73, 0.34);
}

.operation-scope-receipt.waiting,
.pre-dispatch-review-receipt.waiting {
  border-color: rgba(245, 158, 11, 0.25);
  background: rgba(69, 26, 3, 0.28);
}

.operation-scope-receipt.ok,
.operation-result-receipt.ok,
.pre-dispatch-review-receipt.ok {
  border-color: rgba(34, 197, 94, 0.25);
  background: rgba(20, 83, 45, 0.25);
}

.operation-scope-receipt.error,
.operation-result-receipt.error,
.draft-boundary-receipt.error,
.pre-dispatch-review-receipt.error {
  border-color: rgba(248, 113, 113, 0.28);
  background: rgba(69, 10, 10, 0.28);
}

.operation-scope-receipt.muted,
.operation-result-receipt.muted,
.draft-boundary-receipt.muted,
.pre-dispatch-review-receipt.muted {
  border-color: rgba(148, 163, 184, 0.16);
  background: rgba(15, 23, 42, 0.5);
}

.evidence-metrics {
  display: flex;
  gap: 0.55rem;
  flex-wrap: wrap;
  margin-bottom: 0.75rem;
}

.metric-pill {
  padding: 0.18rem 0.6rem;
  border-radius: 999px;
  font-size: 0.75rem;
  background: rgba(59, 130, 246, 0.16);
  color: #93c5fd;
}

.metric-pill.ok {
  background: rgba(34, 197, 94, 0.16);
  color: #86efac;
}

.metric-pill.waiting {
  background: rgba(245, 158, 11, 0.16);
  color: #fcd34d;
}

.metric-pill.queued {
  background: rgba(14, 165, 233, 0.16);
  color: #7dd3fc;
}

.metric-pill.error {
  background: rgba(239, 68, 68, 0.16);
  color: #fca5a5;
}

.panel-title {
  font-weight: 600;
  margin-bottom: 0.75rem;
}

.panel-title-row {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: center;
  margin-bottom: 0.75rem;
}

.edit-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.9rem;
}

.field-block {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  color: #cbd5e1;
  font-size: 0.9rem;
}

.field-block.full-span,
.edit-actions.full-span {
  grid-column: 1 / -1;
}

.search-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.search-action-group {
  display: inline-flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.field-input {
  width: 100%;
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 0.8rem;
  padding: 0.72rem 0.85rem;
  background: rgba(30, 41, 59, 0.65);
  color: #e2e8f0;
}

.field-textarea {
  resize: vertical;
}

.edit-actions {
  display: flex;
  gap: 0.75rem;
}

.field-error {
  margin: 0;
  color: #fca5a5;
}

.candidate-list {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.candidate-btn {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  align-items: flex-start;
  border: 1px solid rgba(125, 211, 252, 0.18);
  border-radius: 0.8rem;
  padding: 0.75rem 0.85rem;
  background: rgba(30, 41, 59, 0.5);
  color: #e2e8f0;
  cursor: pointer;
}

.candidate-btn:hover {
  border-color: rgba(125, 211, 252, 0.45);
}

.reply-box,
.json-panel,
.event-item {
  background: rgba(30, 41, 59, 0.65);
  border-radius: 0.9rem;
  padding: 1rem;
}

.reply-box p {
  margin: 0.4rem 0;
  color: #cbd5e1;
  line-height: 1.6;
}

.summary-text {
  margin: 0;
  color: #cbd5e1;
  line-height: 1.7;
}

.summary-text.strong {
  color: #f8fafc;
  font-size: 1rem;
  font-weight: 600;
}

:deep(.rich-evidence-text) {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

:deep(.rich-evidence-link) {
  color: #7dd3fc;
  text-decoration: underline;
  text-underline-offset: 0.16em;
}

.summary-highlight-panel {
  border-color: rgba(96, 165, 250, 0.35);
  background: linear-gradient(
    135deg,
    rgba(30, 41, 59, 0.96),
    rgba(30, 64, 175, 0.26)
  );
}

.event-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.inline-head {
  justify-content: space-between;
  align-items: center;
}

.json-panel pre,
.json-block {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 0.8rem;
  color: #cbd5e1;
  line-height: 1.55;
}

.json-block {
  margin-top: 0.45rem;
}

.error-panel {
  border-color: rgba(248, 113, 113, 0.25);
  background: rgba(127, 29, 29, 0.2);
  color: #fecaca;
}

.page-link {
  color: #7dd3fc;
  text-decoration: none;
}

.page-link:hover {
  text-decoration: underline;
}

.loading-container,
.empty-state {
  text-align: center;
  padding: 3rem 1rem;
  color: #94a3b8;
}

.loading-spinner {
  width: 2.3rem;
  height: 2.3rem;
  border: 2px solid rgba(56, 189, 248, 0.18);
  border-top: 2px solid #38bdf8;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 1rem;
}

.muted,
.small {
  color: #94a3b8;
}

.small {
  font-size: 0.78rem;
}

@media (max-width: 900px) {
  .page-head {
    flex-direction: column;
    align-items: stretch;
  }

  .action-bar {
    flex-wrap: wrap;
  }

  .hero-top {
    flex-direction: column;
  }

  .panel-title-row {
    flex-direction: column;
    align-items: flex-start;
  }

  .edit-grid {
    grid-template-columns: 1fr;
  }
}
</style>
