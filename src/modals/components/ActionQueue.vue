<template>
  <div class="action-queue-page">
    <div class="page-header">
      <div>
        <h2>动作队列</h2>
        <p>{{ pageDescription }}</p>
      </div>

      <div class="filters">
        <select v-model="queueStatus" class="filter-select" @change="loadActions()">
          <option value="all">全部状态</option>
          <option value="queued">queued</option>
          <option value="running">running</option>
          <option value="failed">failed</option>
          <option value="succeeded">succeeded</option>
          <option value="cancelled">cancelled</option>
          <option value="dead_letter">dead_letter</option>
        </select>
        <select v-model="executionMode" class="filter-select" @change="loadActions()">
          <option value="">全部模式</option>
          <option value="manual">manual</option>
          <option value="auto">auto</option>
        </select>
        <button class="refresh-btn" @click="loadActions()">刷新</button>
      </div>
    </div>

    <div v-if="!loading" class="queue-overview" aria-label="动作队列健康摘要">
      <div
        v-for="card in queueSummaryCards"
        :key="card.key"
        class="queue-stat"
        :class="card.tone"
      >
        <span class="stat-label">{{ card.label }}</span>
        <strong>{{ card.value }}</strong>
        <span class="stat-desc">{{ card.description }}</span>
      </div>
    </div>

    <div v-if="!loading && queueGuidance" class="queue-guidance" :class="queueGuidance.tone">
      <strong>{{ queueGuidance.title }}</strong>
      <span>{{ queueGuidance.body }}</span>
    </div>

    <div v-if="!loading && loadError" class="error-box queue-load-error">
      {{ loadError }}
    </div>

    <div v-if="loading" class="loading-container">
      <div class="loading-spinner"></div>
      <p>加载动作队列中...</p>
    </div>

    <div v-else-if="actions.length === 0" class="empty-state">
      <p>{{ emptyStateTitle }}</p>
      <p class="empty-detail">{{ emptyStateDetail }}</p>
      <button
        v-if="hasUiFilters"
        class="tiny-btn"
        @click="resetFilters"
      >清除状态/模式筛选</button>
    </div>

    <div v-else class="action-list">
      <div v-for="action in actions" :key="action.id" class="action-card">
        <div class="card-head">
          <div>
            <h3>{{ action.title }}</h3>
            <p>{{ action.description || action.actionType }}</p>
          </div>
          <div class="head-badges">
            <span class="badge" :class="action.queueStatus">{{ action.queueStatus }}</span>
            <span
              v-if="scheduleBadgeLabel(action)"
              class="badge"
              :class="scheduleBadgeClass(action)"
            >{{ scheduleBadgeLabel(action) }}</span>
            <span class="badge muted">{{ action.executionMode }}</span>
            <span class="badge muted">P{{ action.priority }}</span>
          </div>
        </div>

        <div class="schedule-panel">
          <div class="schedule-item" :class="scheduleToneClass(action)">
            <span class="schedule-label">预计执行</span>
            <span class="schedule-value">{{ scheduledExecutionLabel(action) }}</span>
          </div>
          <div v-if="action.startedAt" class="schedule-item">
            <span class="schedule-label">开始执行</span>
            <span class="schedule-value">{{ formatActionTime(action.startedAt) }}</span>
          </div>
          <div v-if="action.finishedAt || action.executedAt" class="schedule-item">
            <span class="schedule-label">完成时间</span>
            <span class="schedule-value">{{ formatActionTime(action.finishedAt || action.executedAt) }}</span>
          </div>
        </div>

        <div class="card-meta">
          <span>{{ action.actionType }}</span>
          <span v-if="delegationModeLabel(action)">{{ delegationModeLabel(action) }}</span>
          <span v-if="delegationTargetLabel(action)">{{ delegationTargetLabel(action) }}</span>
          <span v-if="action.actionType === 'ask_external_user'">{{ outreachStatusLabel(action) }}</span>
          <router-link
            v-if="outreachSessionForAction(action)"
            :to="`/outreach/${outreachSessionForAction(action)!.id}`"
            class="thread-link"
          >查看询问会话</router-link>
          <span v-if="action.requiresApproval">需人工确认</span>
          <span>置信 {{ action.confidence.toFixed(2) }}</span>
          <span>重试 {{ action.retryCount }}</span>
          <router-link
            v-if="action.threadId"
            :to="`/reflection-threads/${action.threadId}`"
            class="thread-link"
          >查看线程</router-link>
        </div>

        <div v-if="actionResultSummary(action)" class="result-box">
          {{ actionResultSummary(action) }}
        </div>

        <div
          v-if="isOpenClawDelegationAction(action) && hasDelegationResult(action)"
          class="delegation-result-panel"
        >
          <div class="delegation-panel-head">
            <div>
              <span class="panel-kicker">外部委派结果</span>
              <strong>{{ delegationOutcomeLabel(action) }}</strong>
            </div>
            <span class="badge muted">{{ delegationArtifactCountLabel(action) }}</span>
          </div>

          <div v-if="delegationArtifacts(action).length > 0" class="delegation-artifacts">
            <div
              v-for="artifact in delegationArtifacts(action)"
              :key="delegationArtifactKey(artifact)"
              class="delegation-artifact"
            >
              <div class="artifact-head">
                <span>{{ artifactTitle(artifact) }}</span>
                <span class="badge muted">{{ artifact.kind }}</span>
              </div>
              <p v-if="artifact.content" class="artifact-content">{{ artifact.content }}</p>
              <div class="artifact-meta">
                <span v-if="artifactSourceLabel(artifact)">{{ artifactSourceLabel(artifact) }}</span>
                <span v-if="artifactEntityLabel(artifact)">{{ artifactEntityLabel(artifact) }}</span>
                <span v-if="artifactVerificationLabel(artifact)">{{ artifactVerificationLabel(artifact) }}</span>
                <span v-if="artifactFieldLabel(artifact)">{{ artifactFieldLabel(artifact) }}</span>
              </div>
            </div>
          </div>
          <div v-else class="delegation-empty">
            没有可展示的 artifact；请展开 transcript 或查看关联线程确认 OpenClaw 返回内容。
          </div>

          <div v-if="delegationPayloadPreview(action)" class="delegation-payload">
            <div class="sub-title">结构化 payload</div>
            <pre>{{ delegationPayloadPreview(action) }}</pre>
          </div>
        </div>

        <div v-if="actionResultTranscriptPath(action)" class="transcript-panel">
          <div class="transcript-head">
            <span>transcript: {{ actionResultTranscriptPath(action) }}</span>
            <button
              class="tiny-btn"
              @click="toggleActionTranscript(action)"
            >{{ transcriptVisible[action.id] ? '收起' : '展开' }}</button>
          </div>
          <div v-if="transcriptVisible[action.id]" class="transcript-body">
            <div v-if="transcriptLoading[action.id]" class="muted-line">正在加载 transcript...</div>
            <pre v-else>{{ transcriptContent[action.id] || '未能读取 transcript 内容。' }}</pre>
          </div>
        </div>

        <div v-if="isActionRunning(action)" class="running-box">
          <span class="running-dot" aria-hidden="true"></span>
          <span>{{ runningStatusLabel(action) }}</span>
        </div>

        <div v-if="actionOperationError(action.id)" class="error-box">
          {{ actionOperationError(action.id) }}
        </div>

        <div v-if="action.lastError" class="error-box">
          {{ action.lastError }}
        </div>

        <div class="button-row">
          <button
            v-if="action.queueStatus === 'queued' || action.queueStatus === 'failed' || isActionOperation(action.id, 'execute')"
            class="tiny-btn"
            :class="{ loading: isActionOperation(action.id, 'execute') }"
            :disabled="isActionBusy(action.id)"
            @click="executeAction(action.id)"
          >{{ actionButtonLabel(action.id, 'execute', '执行') }}</button>
          <button
            v-if="action.queueStatus === 'failed'"
            class="tiny-btn"
            :class="{ loading: isActionOperation(action.id, 'retry') }"
            :disabled="isActionBusy(action.id)"
            @click="retryAction(action.id)"
          >{{ actionButtonLabel(action.id, 'retry', '重试入队') }}</button>
          <button
            v-if="action.queueStatus === 'queued'"
            class="tiny-btn danger"
            :class="{ loading: isActionOperation(action.id, 'cancel') }"
            :disabled="isActionBusy(action.id)"
            @click="cancelAction(action.id)"
          >{{ actionButtonLabel(action.id, 'cancel', '取消') }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import {
  getMemoryServiceClient,
  type OutreachSession,
  type RuntimeAction,
} from '../../services/MemoryServiceClient';

const client = getMemoryServiceClient();
const route = useRoute();
const loading = ref(true);
const loadError = ref('');
const actions = ref<RuntimeAction[]>([]);
const outreachByActionId = ref<Record<string, OutreachSession>>({});
const totalActions = ref(0);
const queueStatus = ref<'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled' | 'dead_letter' | 'all'>('all');
const executionMode = ref<'manual' | 'auto' | ''>('');
type ActionOperation = 'execute' | 'retry' | 'cancel';
type QueueGuidanceTone = 'success' | 'info' | 'warning' | 'danger';
interface QueueSummaryCard {
  key: string;
  label: string;
  value: string;
  description: string;
  tone: QueueGuidanceTone;
}
interface QueueGuidance {
  title: string;
  body: string;
  tone: QueueGuidanceTone;
}
interface DelegationArtifactView {
  kind: string;
  title?: string;
  content?: string;
  metadata?: Record<string, unknown>;
}
const actionOperations = ref<Record<string, ActionOperation>>({});
const actionOperationErrors = ref<Record<string, string>>({});
const transcriptVisible = ref<Record<string, boolean>>({});
const transcriptLoading = ref<Record<string, boolean>>({});
const transcriptContent = ref<Record<string, string>>({});
let queuePollTimer: number | undefined;
const routeActionIdFilter = computed(() =>
  typeof route.query.actionId === 'string' ? route.query.actionId : '',
);
const sourceRefIdFilter = computed(() =>
  typeof route.query.sourceRefId === 'string' ? route.query.sourceRefId : '',
);
const sourceKindFilter = computed(() =>
  typeof route.query.sourceKind === 'string' ? route.query.sourceKind : '',
);
const sourceTitleFilter = computed(() =>
  typeof route.query.sourceTitle === 'string' ? route.query.sourceTitle : '',
);
const pageDescription = computed(() => {
  if (sourceTitleFilter.value) {
    return `查看规则「${sourceTitleFilter.value}」关联的执行动作。`;
  }
  if (sourceRefIdFilter.value) {
    return `查看来源 ${sourceRefIdFilter.value} 关联的执行动作。`;
  }
  return '查看自我反思、主动询问与记忆规则产出的执行动作。';
});
const hasRunningActions = computed(() => actions.value.some((action) => action.queueStatus === 'running'));
const hasPendingActionOperation = computed(() => Object.keys(actionOperations.value).length > 0);
const hasUiFilters = computed(() => queueStatus.value !== 'all' || executionMode.value !== '');
const hasRouteFilters = computed(() =>
  Boolean(routeActionIdFilter.value || sourceRefIdFilter.value || sourceKindFilter.value),
);
const failedActionCount = computed(() =>
  actions.value.filter((action) => action.queueStatus === 'failed' || action.queueStatus === 'dead_letter').length,
);
const runningActionCount = computed(() =>
  actions.value.filter((action) => action.queueStatus === 'running').length,
);
const staleRunningActionCount = computed(() =>
  actions.value.filter((action) => isStaleRunningAction(action)).length,
);
const dueActionCount = computed(() => actions.value.filter((action) => isScheduledDue(action)).length);
const approvalActionCount = computed(() =>
  actions.value.filter((action) => action.queueStatus === 'queued' && action.requiresApproval).length,
);
const highRiskActionCount = computed(() =>
  actions.value.filter((action) => action.queueStatus === 'queued' && action.riskLevel === 'high').length,
);
const attentionActionCount = computed(() =>
  actions.value.filter((action) => isAttentionAction(action)).length,
);
const visibleCountLabel = computed(() => {
  if (totalActions.value > 0 && totalActions.value !== actions.value.length) {
    return `${actions.value.length}/${totalActions.value}`;
  }
  return String(actions.value.length);
});
const queueSummaryCards = computed<QueueSummaryCard[]>(() => [
  {
    key: 'visible',
    label: '当前结果',
    value: visibleCountLabel.value,
    description: hasRouteFilters.value || hasUiFilters.value
      ? '已按当前来源、状态或模式筛选'
      : '队列中可查看的动作记录',
    tone: actions.value.length > 0 ? 'info' : 'success',
  },
  {
    key: 'attention',
    label: '需要处理',
    value: String(attentionActionCount.value),
    description: '失败、到期、需审批或高风险动作',
    tone: attentionActionCount.value > 0 ? 'warning' : 'success',
  },
  {
    key: 'running',
    label: '执行中',
    value: String(runningActionCount.value),
    description: staleRunningActionCount.value > 0
      ? `${staleRunningActionCount.value} 条运行超过 30 分钟`
      : '页面会静默刷新运行结果',
    tone: staleRunningActionCount.value > 0 ? 'warning' : 'info',
  },
  {
    key: 'failed',
    label: '失败/死信',
    value: String(failedActionCount.value),
    description: '可从卡片查看错误并重试或取消',
    tone: failedActionCount.value > 0 ? 'danger' : 'success',
  },
]);
const queueGuidance = computed<QueueGuidance | null>(() => {
  if (actions.value.length === 0) {
    return {
      title: hasRouteFilters.value || hasUiFilters.value ? '当前筛选没有动作' : '动作队列暂时清空',
      body: hasRouteFilters.value || hasUiFilters.value
        ? '这通常表示来源、状态或模式筛选没有命中；可以清除筛选，或回到来源页面确认是否已经生成 RuntimeAction。'
        : '当前没有等待执行、审批或复查的后台动作。',
      tone: 'info',
    };
  }
  if (staleRunningActionCount.value > 0) {
    return {
      title: '有动作运行时间过长',
      body: '先检查对应卡片的 started 时间、错误提示和关联线程；刷新页面后 running 状态仍会保留，不会误报为已完成。',
      tone: 'warning',
    };
  }
  if (failedActionCount.value > 0) {
    return {
      title: '优先处理失败动作',
      body: '失败或 dead_letter 动作会保留 lastError；确认原因后再重试入队，避免重复触发外部写操作。',
      tone: 'danger',
    };
  }
  if (dueActionCount.value > 0) {
    return {
      title: '有自动动作已到期',
      body: '这些动作会等待下一次后台调度扫描；如果很急，可以在卡片上手动执行。',
      tone: 'warning',
    };
  }
  if (approvalActionCount.value > 0 || highRiskActionCount.value > 0) {
    return {
      title: '有动作需要人工确认',
      body: '先查看参数、来源和关联线程，再决定是否执行；高风险动作不会在未确认前静默推进。',
      tone: 'warning',
    };
  }
  if (runningActionCount.value > 0) {
    return {
      title: '动作正在执行',
      body: '页面会每 5 秒静默刷新运行中动作；你可以离开页面，刷新后仍能看到最新队列状态。',
      tone: 'info',
    };
  }
  return {
    title: '队列状态正常',
    body: '当前可见动作没有失败、到期或待审批阻塞；需要追溯来源时可进入关联线程或询问会话。',
    tone: 'success',
  };
});
const emptyStateTitle = computed(() =>
  loadError.value ? '动作队列暂时无法读取' : '没有动作记录',
);
const emptyStateDetail = computed(() => {
  if (loadError.value) {
    return '请确认 Memory Service 可用后重试；页面不会把读取失败误当成队列已清空。';
  }
  if (hasRouteFilters.value || hasUiFilters.value) {
    return '当前来源、动作 ID、状态或执行模式没有命中。清除筛选后可以确认队列里是否还有其他动作。';
  }
  return '自我反思、主动询问或记忆规则生成动作后，会在这里展示执行状态、风险和结果。';
});

onMounted(() => {
  void loadActions();
  queuePollTimer = window.setInterval(() => {
    if (hasRunningActions.value && !hasPendingActionOperation.value) {
      void loadActions({ silent: true });
    }
  }, 5000);
});

onUnmounted(() => {
  if (queuePollTimer) {
    window.clearInterval(queuePollTimer);
  }
});

watch(
  () => route.fullPath,
  () => {
    void loadActions();
  },
);

async function loadActions(options: { silent?: boolean } = {}) {
  const shouldShowLoading = options.silent !== true;
  if (shouldShowLoading) {
    loading.value = true;
  }
  try {
    const response = await client.getActions({
      queueStatus: queueStatus.value,
      executionMode: executionMode.value || undefined,
      sourceKind: sourceKindFilter.value || undefined,
      sourceRefId: sourceRefIdFilter.value || undefined,
      limit: 50,
    });
    const filteredItems = response.items.filter((item) => {
      if (routeActionIdFilter.value && item.id !== routeActionIdFilter.value) return false;
      if (
        sourceRefIdFilter.value &&
        item.sourceRefId !== sourceRefIdFilter.value &&
        item.params?.sourceRefId !== sourceRefIdFilter.value &&
        item.params?.ruleRef !== sourceRefIdFilter.value
      ) {
        return false;
      }
      if (
        sourceKindFilter.value &&
        item.sourceKind !== sourceKindFilter.value &&
        item.params?.sourceKind !== sourceKindFilter.value
      ) {
        return false;
      }
      return true;
    });
    actions.value = filteredItems;
    totalActions.value = routeActionIdFilter.value
      ? filteredItems.length
      : response.total ?? filteredItems.length;
    loadError.value = '';
    await hydrateOutreachSessions(filteredItems);
  } catch (error) {
    console.error('Failed to load actions:', error);
    loadError.value = `读取动作队列失败：${formatActionError(error)}`;
    if (shouldShowLoading) {
      actions.value = [];
      outreachByActionId.value = {};
      totalActions.value = 0;
    }
  } finally {
    if (shouldShowLoading) {
      loading.value = false;
    }
  }
}

function resetFilters() {
  queueStatus.value = 'all';
  executionMode.value = '';
  void loadActions();
}

async function hydrateOutreachSessions(items: RuntimeAction[]) {
  const askActions = items.filter((action) => action.actionType === 'ask_external_user');
  if (askActions.length === 0) {
    outreachByActionId.value = {};
    return;
  }

  const mapping: Record<string, OutreachSession> = {};
  const sessionIdPairs = askActions
    .map((action) => ({ actionId: action.id, sessionId: resolveOutreachSessionId(action) }))
    .filter((item): item is { actionId: string; sessionId: string } => Boolean(item.sessionId));

  await Promise.all(
    sessionIdPairs.map(async (pair) => {
      try {
        const session = await client.getOutreachSession(pair.sessionId);
        mapping[pair.actionId] = session;
      } catch {
        // ignore lookup failures to keep the queue usable
      }
    }),
  );

  const unresolved = askActions.filter((action) => !mapping[action.id] && action.threadId);
  const threadIds = Array.from(new Set(unresolved.map((action) => action.threadId!).filter(Boolean)));
  await Promise.all(
    threadIds.map(async (threadId) => {
      try {
        const sessions = await client.getOutreachSessions({
          threadId,
          limit: 50,
        });
        for (const action of unresolved) {
          if (action.threadId !== threadId || mapping[action.id]) continue;
          const matched = sessions.items.find((session) => session.actionId === action.id);
          if (matched) {
            mapping[action.id] = matched;
          }
        }
      } catch {
        // ignore lookup failures to keep the queue usable
      }
    }),
  );

  outreachByActionId.value = mapping;
}

async function executeAction(id: string) {
  setActionOperation(id, 'execute');
  markActionRunning(id);
  try {
    await client.executeAction(id);
    await loadActions({ silent: true });
  } catch (error) {
    setActionOperationError(id, `执行请求失败：${formatActionError(error)}`);
    await loadActions({ silent: true });
  } finally {
    clearActionOperation(id);
  }
}

async function retryAction(id: string) {
  setActionOperation(id, 'retry');
  try {
    await client.retryAction(id);
    await loadActions({ silent: true });
  } catch (error) {
    setActionOperationError(id, `重试入队失败：${formatActionError(error)}`);
  } finally {
    clearActionOperation(id);
  }
}

async function cancelAction(id: string) {
  setActionOperation(id, 'cancel');
  try {
    await client.cancelAction(id, 'Cancelled from action queue UI');
    await loadActions({ silent: true });
  } catch (error) {
    setActionOperationError(id, `取消失败：${formatActionError(error)}`);
  } finally {
    clearActionOperation(id);
  }
}

function setActionOperation(id: string, operation: ActionOperation) {
  actionOperations.value = {
    ...actionOperations.value,
    [id]: operation,
  };
  actionOperationErrors.value = omitActionEntry(actionOperationErrors.value, id);
}

function clearActionOperation(id: string) {
  actionOperations.value = omitActionEntry(actionOperations.value, id);
}

function setActionOperationError(id: string, message: string) {
  actionOperationErrors.value = {
    ...actionOperationErrors.value,
    [id]: message,
  };
}

function actionOperationError(id: string): string {
  return actionOperationErrors.value[id] || '';
}

function isActionOperation(id: string, operation: ActionOperation): boolean {
  return actionOperations.value[id] === operation;
}

function isActionBusy(id: string): boolean {
  return Boolean(actionOperations.value[id]);
}

function actionButtonLabel(id: string, operation: ActionOperation, fallback: string): string {
  if (!isActionOperation(id, operation)) return fallback;
  if (operation === 'execute') return '执行中...';
  if (operation === 'retry') return '入队中...';
  return '取消中...';
}

function markActionRunning(id: string) {
  const currentTime = Date.now();
  actions.value = actions.value.map((action) =>
    action.id === id
      ? {
          ...action,
          queueStatus: 'running',
          startedAt: action.startedAt || currentTime,
          lastError: undefined,
        }
      : action,
  );
}

function isActionRunning(action: RuntimeAction): boolean {
  return action.queueStatus === 'running' || isActionOperation(action.id, 'execute');
}

function runningStatusLabel(action: RuntimeAction): string {
  if (isStaleRunningAction(action)) {
    return `动作已运行超过 30 分钟，开始于 ${formatActionTime(action.startedAt)}；请检查服务日志或关联线程，避免重复执行同一外部操作。`;
  }
  if (action.actionType === 'delegate_openclaw') {
    return 'OpenClaw 正在执行，页面会静默刷新结果；刷新页面后也会继续显示 running 状态。';
  }
  return '动作正在执行，页面会静默刷新结果；刷新页面后也会继续显示 running 状态。';
}

function formatActionError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function omitActionEntry<T>(map: Record<string, T>, id: string): Record<string, T> {
  const next = { ...map };
  delete next[id];
  return next;
}

function delegationModeLabel(action: RuntimeAction) {
  if (action.actionType !== 'delegate_openclaw' && action.actionType !== 'query_external_tool') {
    return '';
  }
  if (action.actionType === 'query_external_tool') {
    return '外部工具查询（兼容模式）';
  }
  const mode = String(action.params?.mode || 'read').toLowerCase();
  return mode === 'write' ? '外部写操作委派' : '外部查询委派';
}

function resolveOutreachSessionId(action: RuntimeAction): string {
  const idCandidates: unknown[] = [
    action.outreachSessionId,
    action.params?.outreachSessionId,
    action.params?.sessionId,
    action.result?.outreachSessionId,
    action.result?.sessionId,
  ];
  const found = idCandidates.find((value) => typeof value === 'string' && value.trim().length > 0);
  return typeof found === 'string' ? found.trim() : '';
}

function outreachSessionForAction(action: RuntimeAction): OutreachSession | null {
  if (action.actionType !== 'ask_external_user') return null;
  return outreachByActionId.value[action.id] ?? null;
}

function outreachStatusLabel(action: RuntimeAction): string {
  const session = outreachSessionForAction(action);
  return session ? `主动询问：${outreachSessionStatusLabel(session.status)}` : '主动询问：会话尚未创建';
}

function outreachSessionStatusLabel(status: string): string {
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

function delegationTargetLabel(action: RuntimeAction) {
  if (action.actionType === 'query_external_tool') {
    const path = action.params?.path;
    return typeof path === 'string' && path.trim().length > 0
      ? `路径 ${path.trim()}`
      : '';
  }
  if (action.actionType !== 'delegate_openclaw') return '';
  const target = action.params?.targetSystem;
  return typeof target === 'string' && target.trim().length > 0
    ? `目标 ${target.trim()}`
    : '';
}

function normalizeEpochMs(value?: number): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return value < 1_000_000_000_000 ? value * 1000 : value;
}

function formatActionTime(value?: number): string {
  const ms = normalizeEpochMs(value);
  if (!ms) return '未记录';
  return new Date(ms).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function relativeScheduleText(value?: number): string {
  const ms = normalizeEpochMs(value);
  if (!ms) return '';
  const diffMs = ms - Date.now();
  const absMins = Math.round(Math.abs(diffMs) / 60000);
  if (absMins < 1) return diffMs >= 0 ? '1 分钟内' : '已到期';
  if (absMins < 60) return diffMs >= 0 ? `${absMins} 分钟后` : `已过 ${absMins} 分钟`;
  const hours = Math.round(absMins / 60);
  if (hours < 24) return diffMs >= 0 ? `${hours} 小时后` : `已过 ${hours} 小时`;
  const days = Math.round(hours / 24);
  return diffMs >= 0 ? `${days} 天后` : `已过 ${days} 天`;
}

function isAutoExecutable(action: RuntimeAction): boolean {
  return (
    action.queueStatus === 'queued' &&
    action.executionMode === 'auto' &&
    action.requiresApproval !== true
  );
}

function isScheduledDue(action: RuntimeAction): boolean {
  const scheduledMs = normalizeEpochMs(action.scheduledAt);
  return Boolean(isAutoExecutable(action) && scheduledMs && scheduledMs <= Date.now());
}

function isStaleRunningAction(action: RuntimeAction): boolean {
  if (action.queueStatus !== 'running') return false;
  const startedMs = normalizeEpochMs(action.startedAt);
  if (!startedMs) return false;
  return Date.now() - startedMs > 30 * 60 * 1000;
}

function isAttentionAction(action: RuntimeAction): boolean {
  return (
    action.queueStatus === 'failed' ||
    action.queueStatus === 'dead_letter' ||
    isScheduledDue(action) ||
    (action.queueStatus === 'queued' && (action.requiresApproval || action.riskLevel === 'high'))
  );
}

function scheduledExecutionLabel(action: RuntimeAction): string {
  if (action.scheduledAt) {
    const base = formatActionTime(action.scheduledAt);
    const relative = relativeScheduleText(action.scheduledAt);
    if (isScheduledDue(action)) {
      return `${base}（${relative}，等待下一次调度扫描）`;
    }
    return relative ? `${base}（${relative}）` : base;
  }

  if (isAutoExecutable(action)) {
    return '未设置具体时间；下一次调度扫描会执行';
  }
  if (action.queueStatus === 'queued' && action.requiresApproval) {
    return '等待人工批准后才能执行';
  }
  if (action.queueStatus === 'queued' && action.executionMode === 'manual') {
    return '手动执行模式；不会被定时调度自动触发';
  }
  return '无待执行时间';
}

function scheduleBadgeLabel(action: RuntimeAction): string {
  if (isScheduledDue(action)) return '已到期';
  if (action.scheduledAt && action.queueStatus === 'queued') {
    return relativeScheduleText(action.scheduledAt) || '已排程';
  }
  if (isAutoExecutable(action) && !action.scheduledAt) return '下次扫描';
  return '';
}

function scheduleBadgeClass(action: RuntimeAction): string {
  if (isScheduledDue(action)) return 'due';
  if (action.scheduledAt && action.queueStatus === 'queued') return 'scheduled';
  return 'muted';
}

function scheduleToneClass(action: RuntimeAction): string {
  if (isScheduledDue(action)) return 'due';
  if (action.scheduledAt && action.queueStatus === 'queued') return 'scheduled';
  if (isAutoExecutable(action)) return 'ready';
  return '';
}

function actionResultSummary(action: RuntimeAction): string {
  return action.result && typeof action.result.summary === 'string'
    ? action.result.summary
    : '';
}

function actionResultTranscriptPath(action: RuntimeAction): string {
  return action.result && typeof action.result.transcriptPath === 'string'
    ? action.result.transcriptPath
    : '';
}

function isOpenClawDelegationAction(action: RuntimeAction): boolean {
  return action.actionType === 'delegate_openclaw';
}

function hasDelegationResult(action: RuntimeAction): boolean {
  return Boolean(action.result && (action.result.status || action.result.artifacts || action.result.payload));
}

function delegationOutcomeLabel(action: RuntimeAction): string {
  const status = typeof action.result?.status === 'string' ? action.result.status : '';
  if (status === 'success') return '成功获取外部事实';
  if (status === 'capability_missing') return '缺少外部能力';
  if (status === 'auth_error') return '鉴权或权限失败';
  if (status === 'need_human_decision') return '等待人工判断';
  if (status === 'timeout') return '委派超时';
  if (status === 'error') return '委派失败';
  return '已返回委派结果';
}

function coerceDelegationArtifact(item: unknown): DelegationArtifactView | null {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
  const record = item as Record<string, unknown>;
  return {
    kind: typeof record.kind === 'string' && record.kind.trim() ? record.kind.trim() : 'note',
    title: typeof record.title === 'string' && record.title.trim() ? record.title.trim() : undefined,
    content: typeof record.content === 'string' && record.content.trim() ? record.content.trim() : undefined,
    metadata:
      record.metadata && typeof record.metadata === 'object' && !Array.isArray(record.metadata)
        ? (record.metadata as Record<string, unknown>)
        : undefined,
  };
}

function delegationArtifacts(action: RuntimeAction): DelegationArtifactView[] {
  const raw = action.result?.artifacts;
  if (!Array.isArray(raw)) return [];
  return raw.map(coerceDelegationArtifact).filter((item): item is DelegationArtifactView => Boolean(item)).slice(0, 4);
}

function delegationArtifactCountLabel(action: RuntimeAction): string {
  const raw = action.result?.artifacts;
  const total = Array.isArray(raw) ? raw.length : 0;
  if (total === 0) return '无 artifact';
  return `可验证 artifact ${total} 条`;
}

function delegationArtifactKey(artifact: DelegationArtifactView): string {
  return [artifact.kind, artifact.title, artifact.content].filter(Boolean).join(':').slice(0, 120);
}

function artifactTitle(artifact: DelegationArtifactView): string {
  return artifact.title || artifact.kind || '外部证据';
}

function metadataString(metadata: Record<string, unknown> | undefined, keys: string[]): string {
  if (!metadata) return '';
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  }
  return '';
}

function metadataStringList(metadata: Record<string, unknown> | undefined, keys: string[]): string[] {
  if (!metadata) return [];
  for (const key of keys) {
    const value = metadata[key];
    if (Array.isArray(value)) {
      const items = value
        .filter((item): item is string | number | boolean =>
          typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean',
        )
        .map((item) => String(item).trim())
        .filter(Boolean);
      if (items.length > 0) return items;
    }
  }
  return [];
}

function artifactSourceLabel(artifact: DelegationArtifactView): string {
  const source = metadataString(artifact.metadata, ['sourceSystem', 'targetSystem', 'system']);
  return source ? `来源 ${source}` : '';
}

function artifactEntityLabel(artifact: DelegationArtifactView): string {
  const entity = metadataString(artifact.metadata, [
    'entityId',
    'entityKey',
    'recordId',
    'resourceId',
    'ticketId',
    'ticketKey',
    'issueKey',
  ]);
  return entity ? `对象 ${entity}` : '';
}

function artifactVerificationLabel(artifact: DelegationArtifactView): string {
  const verification = artifact.metadata?.verified === true
    ? 'verified'
    : metadataString(artifact.metadata, ['verification', 'verificationMethod']);
  return verification ? `验证 ${verification}` : '';
}

function artifactFieldLabel(artifact: DelegationArtifactView): string {
  const fields = metadataStringList(artifact.metadata, ['observedFields', 'changedFields']);
  if (fields.length > 0) return `字段 ${fields.slice(0, 5).join(', ')}`;
  const operation = metadataString(artifact.metadata, ['operation', 'operationType', 'action']);
  return operation ? `操作 ${operation}` : '';
}

function delegationPayloadPreview(action: RuntimeAction): string {
  const payload = action.result?.payload;
  if (!payload || typeof payload !== 'object') return '';
  try {
    const json = JSON.stringify(payload, null, 2);
    return json.length > 1200 ? `${json.slice(0, 1200)}\n...` : json;
  } catch {
    return '';
  }
}

async function toggleActionTranscript(action: RuntimeAction) {
  const transcriptPath = actionResultTranscriptPath(action);
  if (!transcriptPath) return;
  const nextVisible = !transcriptVisible.value[action.id];
  transcriptVisible.value = {
    ...transcriptVisible.value,
    [action.id]: nextVisible,
  };
  if (!nextVisible || transcriptContent.value[action.id] !== undefined) {
    return;
  }

  const filename = transcriptFilename(transcriptPath);
  if (!filename) {
    transcriptContent.value = {
      ...transcriptContent.value,
      [action.id]: '暂不支持读取该 transcript 路径。',
    };
    return;
  }

  transcriptLoading.value = {
    ...transcriptLoading.value,
    [action.id]: true,
  };
  try {
    const content = await client.readUserFile('delegations', filename);
    transcriptContent.value = {
      ...transcriptContent.value,
      [action.id]: content || '未能读取 transcript 内容。',
    };
  } finally {
    transcriptLoading.value = {
      ...transcriptLoading.value,
      [action.id]: false,
    };
  }
}

function transcriptFilename(transcriptPath: string): string | null {
  if (!transcriptPath.startsWith('delegations/')) {
    return null;
  }
  return transcriptPath.slice('delegations/'.length);
}
</script>

<style scoped>
.action-queue-page {
  animation: fadeInUp 0.5s ease-out;
}

.page-header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.page-header h2 {
  font-size: 1.5rem;
  margin-bottom: 0.35rem;
}

.page-header p {
  color: #94a3b8;
  font-size: 0.9rem;
}

.filters {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

.queue-overview {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.75rem;
  margin-bottom: 0.9rem;
}

.queue-stat {
  min-width: 0;
  padding: 0.85rem 0.95rem;
  border-radius: 0.8rem;
  background: rgba(15, 23, 42, 0.66);
  border: 1px solid rgba(148, 163, 184, 0.14);
}

.queue-stat strong {
  display: block;
  margin: 0.2rem 0;
  color: #f8fafc;
  font-size: 1.45rem;
  line-height: 1.1;
}

.queue-stat.info {
  border-color: rgba(56, 189, 248, 0.22);
}

.queue-stat.success {
  border-color: rgba(34, 197, 94, 0.2);
}

.queue-stat.warning {
  border-color: rgba(245, 158, 11, 0.3);
  background: rgba(120, 53, 15, 0.14);
}

.queue-stat.danger {
  border-color: rgba(248, 113, 113, 0.3);
  background: rgba(127, 29, 29, 0.14);
}

.stat-label,
.stat-desc {
  display: block;
  color: #94a3b8;
  font-size: 0.76rem;
  line-height: 1.35;
}

.stat-desc {
  color: #cbd5e1;
}

.queue-guidance {
  display: flex;
  gap: 0.65rem;
  align-items: flex-start;
  margin-bottom: 1rem;
  padding: 0.8rem 0.95rem;
  border-radius: 0.8rem;
  background: rgba(15, 23, 42, 0.58);
  border: 1px solid rgba(148, 163, 184, 0.14);
  color: #dbeafe;
  line-height: 1.5;
}

.queue-guidance strong {
  flex: 0 0 auto;
  color: #f8fafc;
}

.queue-guidance.success {
  border-color: rgba(34, 197, 94, 0.22);
  color: #dcfce7;
}

.queue-guidance.warning {
  border-color: rgba(245, 158, 11, 0.3);
  color: #fde68a;
}

.queue-guidance.danger {
  border-color: rgba(248, 113, 113, 0.32);
  color: #fecaca;
}

.queue-load-error {
  margin-bottom: 1rem;
}

.filter-select,
.refresh-btn,
.tiny-btn {
  border: none;
  border-radius: 0.8rem;
  padding: 0.72rem 0.95rem;
}

.filter-select {
  background: rgba(15, 23, 42, 0.72);
  border: 1px solid rgba(148, 163, 184, 0.22);
  color: #e2e8f0;
}

.refresh-btn,
.tiny-btn {
  cursor: pointer;
  background: rgba(30, 41, 59, 0.84);
  color: #f8fafc;
}

.tiny-btn:disabled {
  cursor: progress;
  opacity: 0.72;
}

.tiny-btn.loading {
  background: rgba(245, 158, 11, 0.16);
  color: #fde68a;
  border: 1px solid rgba(245, 158, 11, 0.3);
}

.tiny-btn.danger {
  background: rgba(239, 68, 68, 0.16);
  color: #fca5a5;
}

.action-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.action-card {
  background: rgba(15, 23, 42, 0.72);
  border: 1px solid rgba(148, 163, 184, 0.12);
  border-radius: 1rem;
  padding: 1.2rem;
}

.card-head {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
}

.card-head h3 {
  margin-bottom: 0.4rem;
}

.card-head p {
  color: #cbd5e1;
  line-height: 1.55;
}

.head-badges,
.card-meta,
.button-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}

.head-badges {
  align-self: flex-start;
  align-items: center;
  justify-content: flex-end;
  max-width: 60%;
}

.card-meta {
  margin-top: 0.9rem;
  color: #94a3b8;
  font-size: 0.83rem;
}

.badge {
  display: inline-flex;
  align-items: center;
  align-self: flex-start;
  padding: 0.22rem 0.65rem;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 500;
  line-height: 1.25;
  letter-spacing: 0.01em;
  white-space: nowrap;
  background: rgba(59, 130, 246, 0.16);
  color: #93c5fd;
  border: 1px solid rgba(59, 130, 246, 0.24);
}

.badge.muted {
  background: rgba(148, 163, 184, 0.14);
  color: #cbd5e1;
  border-color: rgba(148, 163, 184, 0.22);
}

.badge.queued {
  background: rgba(14, 165, 233, 0.16);
  color: #7dd3fc;
  border-color: rgba(14, 165, 233, 0.28);
}

.badge.failed {
  background: rgba(239, 68, 68, 0.16);
  color: #fca5a5;
  border-color: rgba(239, 68, 68, 0.28);
}

.badge.running {
  background: rgba(245, 158, 11, 0.16);
  color: #fcd34d;
  border-color: rgba(245, 158, 11, 0.28);
}

.badge.scheduled {
  background: rgba(99, 102, 241, 0.18);
  color: #c4b5fd;
  border-color: rgba(129, 140, 248, 0.3);
}

.badge.due {
  background: rgba(245, 158, 11, 0.2);
  color: #fde68a;
  border-color: rgba(245, 158, 11, 0.36);
}

.badge.succeeded {
  background: rgba(34, 197, 94, 0.16);
  color: #86efac;
  border-color: rgba(34, 197, 94, 0.28);
}

.schedule-panel {
  display: flex;
  flex-wrap: wrap;
  gap: 0.7rem;
  margin-top: 1rem;
}

.schedule-item {
  min-width: 12rem;
  padding: 0.68rem 0.82rem;
  border-radius: 0.85rem;
  background: rgba(15, 23, 42, 0.52);
  border: 1px solid rgba(148, 163, 184, 0.14);
}

.schedule-item.scheduled {
  background: rgba(49, 46, 129, 0.22);
  border-color: rgba(129, 140, 248, 0.24);
}

.schedule-item.due {
  background: rgba(120, 53, 15, 0.2);
  border-color: rgba(245, 158, 11, 0.28);
}

.schedule-item.ready {
  background: rgba(20, 83, 45, 0.16);
  border-color: rgba(74, 222, 128, 0.2);
}

.schedule-label {
  display: block;
  margin-bottom: 0.28rem;
  color: #94a3b8;
  font-size: 0.72rem;
}

.schedule-value {
  color: #e2e8f0;
  font-size: 0.86rem;
  line-height: 1.35;
}

.thread-link {
  color: #7dd3fc;
  text-decoration: none;
}

.thread-link:hover {
  text-decoration: underline;
}

.error-box {
  margin-top: 0.8rem;
  padding: 0.8rem 0.9rem;
  border-radius: 0.8rem;
  background: rgba(127, 29, 29, 0.24);
  border: 1px solid rgba(248, 113, 113, 0.25);
  color: #fecaca;
}

.result-box {
  margin-top: 0.8rem;
  padding: 0.75rem 0.9rem;
  border-radius: 0.8rem;
  background: rgba(30, 41, 59, 0.7);
  border: 1px solid rgba(125, 211, 252, 0.18);
  color: #e2e8f0;
  line-height: 1.55;
}

.delegation-result-panel {
  margin-top: 0.75rem;
  padding: 0.82rem;
  border-radius: 0.8rem;
  background: rgba(8, 47, 73, 0.28);
  border: 1px solid rgba(56, 189, 248, 0.22);
}

.delegation-panel-head,
.artifact-head,
.transcript-head {
  display: flex;
  justify-content: space-between;
  gap: 0.8rem;
  align-items: flex-start;
}

.panel-kicker,
.sub-title {
  display: block;
  margin-bottom: 0.25rem;
  color: #93c5fd;
  font-size: 0.74rem;
  letter-spacing: 0;
}

.delegation-panel-head strong {
  color: #e0f2fe;
}

.delegation-artifacts {
  display: grid;
  gap: 0.6rem;
  margin-top: 0.75rem;
}

.delegation-artifact {
  padding: 0.68rem 0.75rem;
  border-radius: 0.72rem;
  background: rgba(15, 23, 42, 0.48);
  border: 1px solid rgba(125, 211, 252, 0.16);
}

.artifact-head span:first-child {
  color: #f8fafc;
  font-weight: 650;
}

.artifact-content {
  margin: 0.45rem 0 0;
  color: #cbd5e1;
  line-height: 1.5;
}

.artifact-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  margin-top: 0.55rem;
}

.artifact-meta span {
  padding: 0.18rem 0.45rem;
  border-radius: 999px;
  background: rgba(14, 165, 233, 0.1);
  color: #bae6fd;
  font-size: 0.74rem;
}

.delegation-empty {
  margin-top: 0.65rem;
  color: #bae6fd;
  line-height: 1.5;
}

.delegation-payload {
  margin-top: 0.75rem;
}

.delegation-payload pre,
.transcript-body pre {
  max-height: 14rem;
  overflow: auto;
  margin: 0;
  padding: 0.72rem;
  border-radius: 0.65rem;
  background: rgba(2, 6, 23, 0.72);
  color: #dbeafe;
  font-size: 0.78rem;
  line-height: 1.45;
  white-space: pre-wrap;
  word-break: break-word;
}

.transcript-panel {
  margin-top: 0.5rem;
  font-size: 0.8rem;
  color: #7dd3fc;
  word-break: break-all;
}

.transcript-body {
  margin-top: 0.55rem;
}

.muted-line {
  color: #94a3b8;
}

.running-box {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  margin-top: 0.8rem;
  padding: 0.75rem 0.9rem;
  border-radius: 0.8rem;
  background: rgba(120, 53, 15, 0.18);
  border: 1px solid rgba(245, 158, 11, 0.24);
  color: #fde68a;
  line-height: 1.5;
}

.running-dot {
  width: 0.52rem;
  height: 0.52rem;
  border-radius: 999px;
  background: #f59e0b;
  box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.5);
  animation: pulse 1.4s ease-out infinite;
  flex: 0 0 auto;
}

.button-row {
  margin-top: 0.9rem;
}

.loading-container,
.empty-state {
  text-align: center;
  padding: 3rem 1rem;
  color: #94a3b8;
}

.empty-detail {
  max-width: 34rem;
  margin: 0.45rem auto 1rem;
  color: #cbd5e1;
  line-height: 1.6;
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

@keyframes pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.5);
  }

  70% {
    box-shadow: 0 0 0 0.55rem rgba(245, 158, 11, 0);
  }

  100% {
    box-shadow: 0 0 0 0 rgba(245, 158, 11, 0);
  }
}

@media (max-width: 900px) {
  .page-header,
  .card-head {
    flex-direction: column;
  }

  .queue-overview {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .queue-guidance {
    flex-direction: column;
  }

  .filters {
    flex-wrap: wrap;
  }

  .head-badges {
    justify-content: flex-start;
    max-width: none;
  }
}

@media (max-width: 560px) {
  .queue-overview {
    grid-template-columns: 1fr;
  }
}
</style>
