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

    <div
      v-if="!loading && actionReadinessSummary && actionReadinessSummary.trackedActionCount > 0"
      class="readiness-strip"
      :class="actionReadinessSummary.status"
      aria-label="OpenClaw 执行就绪摘要"
    >
      <div class="readiness-strip-head">
        <div>
          <span class="panel-kicker">执行就绪契约</span>
          <strong>{{ actionReadinessSummary.title }}</strong>
        </div>
        <span class="readiness-strip-state">{{ readinessSummaryStateLabel }}</span>
      </div>
      <p>{{ actionReadinessSummary.detail }}</p>
      <div class="readiness-strip-facts">
        <span>跟踪 {{ actionReadinessSummary.trackedActionCount }} 条</span>
        <span v-if="actionReadinessSummary.blockedContractCount > 0">
          阻断契约 {{ actionReadinessSummary.blockedContractCount }} 个
        </span>
        <span v-if="actionReadinessSummary.affectedActionCount > 0">
          受影响 {{ actionReadinessSummary.affectedActionCount }} 条
        </span>
        <span>只读摘要 · {{ formatActionTime(actionReadinessSummary.readAt) }}</span>
      </div>
      <small>{{ actionReadinessSummary.boundary }}</small>
    </div>

    <div
      v-if="!loading && actionLocatorReceipt"
      class="queue-locator-receipt"
      :class="actionLocatorReceipt.tone"
      aria-label="动作定位请求回执"
    >
      <div>
        <span class="panel-kicker">定位请求回执</span>
        <strong>{{ actionLocatorReceipt.title }}</strong>
      </div>
      <p>{{ actionLocatorReceipt.body }}</p>
      <div class="locator-facts">
        <span
          v-for="fact in actionLocatorReceipt.facts"
          :key="fact"
        >{{ fact }}</span>
      </div>
    </div>

    <div
      v-if="!loading && attentionBreakdownReceipt"
      class="queue-attention-receipt"
      :class="attentionBreakdownReceipt.tone"
      aria-label="动作队列处理构成"
    >
      <div class="attention-receipt-head">
        <div>
          <span class="panel-kicker">处理构成</span>
          <strong>{{ attentionBreakdownReceipt.title }}</strong>
        </div>
        <span class="attention-total">{{ attentionBreakdownReceipt.totalLabel }}</span>
      </div>
      <p>{{ attentionBreakdownReceipt.body }}</p>
      <div class="attention-breakdown-rows">
        <div
          v-for="row in attentionBreakdownReceipt.rows"
          :key="row.key"
          class="attention-breakdown-row"
        >
          <span>{{ row.label }}</span>
          <strong>{{ row.value }}</strong>
          <small>{{ row.description }}</small>
        </div>
      </div>
      <div class="attention-boundary-facts">
        <span
          v-for="fact in attentionBreakdownReceipt.facts"
          :key="fact"
        >{{ fact }}</span>
      </div>
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
      <div
        v-if="emptyFilterReceipt"
        class="empty-filter-receipt"
        aria-label="动作队列空筛选回执"
      >
        <div>
          <span class="panel-kicker">筛选空结果回执</span>
          <strong>{{ emptyFilterReceipt.title }}</strong>
        </div>
        <p>{{ emptyFilterReceipt.body }}</p>
        <div class="empty-filter-facts">
          <span
            v-for="fact in emptyFilterReceipt.facts"
            :key="fact"
          >{{ fact }}</span>
        </div>
      </div>
      <div
        v-if="hasUiFilters || hasRouteFilters"
        class="empty-actions"
      >
        <button
          v-if="hasUiFilters"
          class="tiny-btn"
          @click="resetFilters"
        >清除状态/模式筛选</button>
        <router-link
          v-if="hasRouteFilters"
          class="tiny-btn"
          to="/actions"
        >查看全部动作</router-link>
      </div>
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
          <span v-if="action.requiresApproval">{{ approvalStatusLabel(action) }}</span>
          <span>置信 {{ action.confidence.toFixed(2) }}</span>
          <span>重试 {{ action.retryCount }}</span>
          <router-link
            v-if="action.threadId"
            :to="`/reflection-threads/${action.threadId}`"
            class="thread-link"
          >查看线程</router-link>
        </div>

        <div
          v-if="action.readinessReceipt"
          class="action-readiness-panel"
          :class="actionReadinessTone(action)"
          aria-label="动作执行就绪回执"
        >
          <div class="action-readiness-head">
            <div>
              <span class="panel-kicker">执行就绪</span>
              <strong>{{ actionReadinessTitle(action) }}</strong>
            </div>
            <span class="action-readiness-state">{{ actionReadinessStatusLabel(action) }}</span>
          </div>
          <p>{{ actionReadinessBody(action) }}</p>
          <div class="action-readiness-facts">
            <span
              v-for="fact in actionReadinessFacts(action)"
              :key="fact"
            >{{ fact }}</span>
          </div>
          <small>{{ actionReadinessBoundary(action) }}</small>
        </div>

        <div
          v-if="actionExecutionScopeReceipt(action)"
          class="action-scope-panel"
          :class="actionExecutionScopeReceipt(action)?.tone"
        >
          <div>
            <span class="panel-kicker">执行范围</span>
            <strong>{{ actionExecutionScopeReceipt(action)?.title }}</strong>
          </div>
          <p>{{ actionExecutionScopeReceipt(action)?.body }}</p>
          <div class="action-scope-facts">
            <span
              v-for="fact in actionExecutionScopeReceipt(action)?.facts || []"
              :key="fact"
            >{{ fact }}</span>
          </div>
        </div>

        <div
          v-if="isOpenClawDelegationAction(action)"
          class="delegation-preflight-panel"
          :class="openClawPreflightTone(action)"
        >
          <div class="delegation-preflight-head">
            <span class="panel-kicker">委派预检</span>
            <strong>{{ openClawPreflightTitle(action) }}</strong>
          </div>
          <p>{{ openClawPreflightDetail(action) }}</p>
          <div class="delegation-preflight-facts">
            <span
              v-for="fact in openClawPreflightFacts(action)"
              :key="fact"
            >{{ fact }}</span>
          </div>
        </div>

        <div v-if="showApprovalCheckpoint(action)" class="approval-panel">
          <div>
            <span class="panel-kicker">人工确认</span>
            <strong>{{ approvalCheckpointTitle(action) }}</strong>
          </div>
          <p>{{ approvalCheckpointBody(action) }}</p>
          <div class="approval-facts">
            <span
              v-for="fact in approvalCheckpointFacts(action)"
              :key="fact"
            >{{ fact }}</span>
          </div>
        </div>

        <div v-if="actionResultSummary(action)" class="result-box">
          {{ actionResultSummary(action) }}
        </div>

        <div
          v-if="openClawVerificationReceipt(action)"
          class="delegation-verification-panel"
          :class="openClawVerificationReceipt(action)?.tone"
        >
          <div>
            <span class="panel-kicker">证据校验回执</span>
            <strong>{{ openClawVerificationReceipt(action)?.title }}</strong>
          </div>
          <p>{{ openClawVerificationReceipt(action)?.body }}</p>
          <div class="delegation-verification-facts">
            <span
              v-for="fact in openClawVerificationReceipt(action)?.facts || []"
              :key="fact"
            >{{ fact }}</span>
          </div>
        </div>

        <div
          v-if="openClawRecoveryReceipt(action)"
          class="delegation-recovery-panel"
          :class="openClawRecoveryReceipt(action)?.tone"
        >
          <div>
            <span class="panel-kicker">恢复路径回执</span>
            <strong>{{ openClawRecoveryReceipt(action)?.title }}</strong>
          </div>
          <p>{{ openClawRecoveryReceipt(action)?.body }}</p>
          <div class="delegation-recovery-facts">
            <span
              v-for="fact in openClawRecoveryReceipt(action)?.facts || []"
              :key="fact"
            >{{ fact }}</span>
          </div>
          <div
            v-if="openClawRecoveryReceipt(action)?.actions.length"
            class="delegation-recovery-actions"
          >
            <router-link
              v-for="followUp in openClawRecoveryReceipt(action)?.actions || []"
              :key="followUp.id"
              :to="followUpActionRoute(followUp.id)"
              class="recovery-action-link"
            >
              <span>{{ followUpActionLabel(followUp) }}</span>
              <small>{{ followUpActionDetail(followUp) }}</small>
            </router-link>
          </div>
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
              :title="transcriptToggleBoundaryLabel(action)"
              :aria-label="transcriptToggleBoundaryLabel(action)"
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

        <div
          v-if="actionPendingOperationReceipt(action)"
          class="action-operation-receipt pending"
          :class="actionPendingOperationReceipt(action)?.tone"
        >
          <div>
            <span class="panel-kicker">操作提交中</span>
            <strong>{{ actionPendingOperationReceipt(action)?.title }}</strong>
          </div>
          <p>{{ actionPendingOperationReceipt(action)?.body }}</p>
          <div class="action-operation-facts">
            <span
              v-for="fact in actionPendingOperationReceipt(action)?.facts || []"
              :key="fact"
            >{{ fact }}</span>
          </div>
        </div>

        <div
          v-if="actionOperationReceipt(action.id)"
          class="action-operation-receipt"
          :class="actionOperationReceipt(action.id)?.tone"
        >
          <div>
            <span class="panel-kicker">操作回执</span>
            <strong>{{ actionOperationReceipt(action.id)?.title }}</strong>
          </div>
          <p>{{ actionOperationReceipt(action.id)?.body }}</p>
          <div class="action-operation-facts">
            <span
              v-for="fact in actionOperationReceipt(action.id)?.facts || []"
              :key="fact"
            >{{ fact }}</span>
          </div>
        </div>

        <div v-if="actionOperationError(action.id)" class="error-box">
          {{ actionOperationError(action.id) }}
        </div>

        <div v-if="action.lastError" class="error-box">
          {{ action.lastError }}
        </div>

        <div class="button-row">
          <button
            v-if="canShowExecuteButton(action)"
            class="tiny-btn"
            :class="{ loading: isActionOperation(action.id, 'execute') }"
            :disabled="isActionBusy(action.id)"
            :title="actionButtonBoundaryLabel(action, 'execute')"
            :aria-label="actionButtonBoundaryLabel(action, 'execute')"
            @click="executeAction(action)"
          >{{ actionButtonLabel(action.id, 'execute', executeButtonLabel(action)) }}</button>
          <button
            v-if="canRetryAction(action)"
            class="tiny-btn"
            :class="{ loading: isActionOperation(action.id, 'retry') }"
            :disabled="isActionBusy(action.id)"
            :title="actionButtonBoundaryLabel(action, 'retry')"
            :aria-label="actionButtonBoundaryLabel(action, 'retry')"
            @click="retryAction(action)"
          >{{ actionButtonLabel(action.id, 'retry', '重试入队') }}</button>
          <button
            v-if="canProbeActionReadiness(action)"
            class="tiny-btn readiness-probe-btn"
            :class="{ loading: isActionOperation(action.id, 'probe') }"
            :disabled="isActionBusy(action.id)"
            :title="actionButtonBoundaryLabel(action, 'probe')"
            :aria-label="actionButtonBoundaryLabel(action, 'probe')"
            @click="probeActionReadiness(action)"
          >{{ actionButtonLabel(action.id, 'probe', readinessProbeButtonLabel(action)) }}</button>
          <button
            v-if="action.queueStatus === 'queued'"
            class="tiny-btn danger"
            :class="{ loading: isActionOperation(action.id, 'cancel') }"
            :disabled="isActionBusy(action.id)"
            :title="actionButtonBoundaryLabel(action, 'cancel')"
            :aria-label="actionButtonBoundaryLabel(action, 'cancel')"
            @click="cancelAction(action)"
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
  type ActionReadinessSummary,
  type OutreachSession,
  type RuntimeAction,
} from '../../services/MemoryServiceClient';

const client = getMemoryServiceClient();
const route = useRoute();
const loading = ref(true);
const loadError = ref('');
const actions = ref<RuntimeAction[]>([]);
const actionReadinessSummary = ref<ActionReadinessSummary | null>(null);
const outreachByActionId = ref<Record<string, OutreachSession>>({});
const totalActions = ref(0);
const queueStatus = ref<'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled' | 'dead_letter' | 'all'>('all');
const executionMode = ref<'manual' | 'auto' | ''>('');
type ActionOperation = 'execute' | 'retry' | 'cancel' | 'probe';
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
interface ActionLocatorReceipt {
  tone: QueueGuidanceTone;
  title: string;
  body: string;
  facts: string[];
}
interface AttentionBreakdownRow {
  key: string;
  label: string;
  value: string;
  description: string;
}
interface AttentionBreakdownReceipt {
  title: string;
  totalLabel: string;
  body: string;
  tone: QueueGuidanceTone;
  rows: AttentionBreakdownRow[];
  facts: string[];
}
interface EmptyFilterReceipt {
  title: string;
  body: string;
  facts: string[];
}
interface DelegationArtifactView {
  kind: string;
  title?: string;
  content?: string;
  metadata?: Record<string, unknown>;
}
interface OpenClawVerificationReceipt {
  tone: Extract<QueueGuidanceTone, 'warning' | 'danger'>;
  title: string;
  body: string;
  facts: string[];
}
interface OpenClawFollowUpActionView {
  id: string;
  actionType?: string;
  title?: string;
  queueStatus?: string;
  sourceKind?: string;
  sourceRefId?: string;
}
interface OpenClawRecoveryReceipt {
  tone: Extract<QueueGuidanceTone, 'info' | 'warning' | 'danger'>;
  title: string;
  body: string;
  facts: string[];
  actions: OpenClawFollowUpActionView[];
}
interface ActionOperationReceipt {
  tone: Extract<QueueGuidanceTone, 'success' | 'info' | 'warning'>;
  title: string;
  body: string;
  facts: string[];
}
interface ActionExecutionScopeReceipt {
  tone: QueueGuidanceTone;
  title: string;
  body: string;
  facts: string[];
}
const actionOperations = ref<Record<string, ActionOperation>>({});
const actionOperationErrors = ref<Record<string, string>>({});
const actionOperationReceipts = ref<Record<string, ActionOperationReceipt>>({});
const transcriptVisible = ref<Record<string, boolean>>({});
const transcriptLoading = ref<Record<string, boolean>>({});
const transcriptContent = ref<Record<string, string>>({});
const lastSuccessfulLoadAt = ref<number | null>(null);
const lastSuccessfulQueryKey = ref('');
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
  actions.value.filter(
    (action) => action.queueStatus === 'queued' && action.requiresApproval && !action.approvedAt,
  ).length,
);
const highRiskActionCount = computed(() =>
  actions.value.filter((action) => action.queueStatus === 'queued' && action.riskLevel === 'high').length,
);
const highRiskReadyActionCount = computed(() =>
  actions.value.filter(
    (action) =>
      action.queueStatus === 'queued' &&
      action.riskLevel === 'high' &&
      !(action.requiresApproval && !action.approvedAt) &&
      !isScheduledDue(action),
  ).length,
);
const attentionActionCount = computed(() =>
  actions.value.filter((action) => isAttentionAction(action)).length,
);
const isShowingStaleSnapshot = computed(() =>
  Boolean(
    loadError.value &&
      actions.value.length > 0 &&
      lastSuccessfulLoadAt.value &&
      lastSuccessfulQueryKey.value === currentActionQueryKey(),
  ),
);
const visibleCountLabel = computed(() => {
  if (totalActions.value > 0 && totalActions.value !== actions.value.length) {
    return `${actions.value.length}/${totalActions.value}`;
  }
  return String(actions.value.length);
});
const readinessSummaryStateLabel = computed(() => {
  if (actionReadinessSummary.value?.status === 'blocked') return 'BLOCKED';
  if (actionReadinessSummary.value?.status === 'attention') return 'CHECK';
  return 'READY';
});
const queueSummaryCards = computed<QueueSummaryCard[]>(() => [
  {
    key: 'visible',
    label: '当前结果',
    value: visibleCountLabel.value,
    description: isShowingStaleSnapshot.value
      ? `上次成功读取：${formatActionTime(lastSuccessfulLoadAt.value || undefined)}`
      : hasRouteFilters.value || hasUiFilters.value
      ? '已按当前来源、状态或模式筛选'
      : '队列中可查看的动作记录',
    tone: isShowingStaleSnapshot.value
      ? 'warning'
      : actions.value.length > 0
      ? 'info'
      : 'success',
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
  if (isShowingStaleSnapshot.value) {
    return {
      title: '当前显示上次成功快照',
      body: `最近一次刷新失败，当前服务状态未确认；下面保留 ${formatActionTime(
        lastSuccessfulLoadAt.value || undefined,
      )} 成功读取的动作，不会把读取失败误当成队列清空或执行完成。`,
      tone: 'warning',
    };
  }
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
      body: '先查看参数、来源和关联线程；点击“确认并执行”会记录批准时间，再触发动作。',
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
const actionLocatorReceipt = computed<ActionLocatorReceipt | null>(() => {
  const actionId = routeActionIdFilter.value;
  if (!actionId) return null;

  const compactId = compactReceiptText(actionId, 72);
  const exactMatch = actions.value.find((action) => action.id === actionId);
  const filterFacts = [
    queueStatus.value !== 'all' ? `状态筛选：${queueStatus.value}` : '',
    executionMode.value ? `模式筛选：${executionMode.value}` : '',
    sourceKindFilter.value ? `来源类型：${sourceKindFilter.value}` : '',
    sourceRefIdFilter.value ? `来源 ID：${compactReceiptText(sourceRefIdFilter.value, 48)}` : '',
  ].filter(Boolean);

  if (isShowingStaleSnapshot.value) {
    return {
      tone: 'warning',
      title: exactMatch ? '定位结果来自上次成功快照' : '定位刷新失败，未确认当前结果',
      body: exactMatch
        ? `动作 ${compactId} 出现在上次成功读取的定位结果中；最近一次刷新失败，不能证明当前队列状态仍然一致。`
        : `这次按动作 ID ${compactId} 定位时刷新失败；页面不会把读取失败解释成动作不存在或已经完成。`,
      facts: [
        '定位：服务端 actionId 查询',
        '快照：上次成功读取',
        '当前状态：未确认',
        ...filterFacts,
        '边界：不执行 / 不批准 / 不重试 / 不取消',
      ],
    };
  }

  if (loadError.value) {
    return {
      tone: 'danger',
      title: '动作定位暂时无法读取',
      body: `Memory Service 没有返回动作 ${compactId} 的定位结果；这不是动作不存在、已完成或已取消的确认。`,
      facts: [
        '定位：服务端 actionId 查询',
        '结果：读取失败',
        ...filterFacts,
        '边界：只读失败回执',
      ],
    };
  }

  if (exactMatch) {
    return {
      tone: 'info',
      title: '已按动作 ID 定位',
      body: `Memory Service 已按动作 ID ${compactId} 返回目标动作；这不是从当前第一页列表里猜测出来的可见切片。`,
      facts: [
        '定位：服务端 actionId 查询',
        `命中：${exactMatch.queueStatus}`,
        ...filterFacts,
        '边界：只读定位，不执行动作',
      ],
    };
  }

  return {
    tone: 'warning',
    title: '未找到这条动作',
    body: `Memory Service 未返回动作 ${compactId}；可能已被其它筛选条件排除、已清理，或该链接不属于当前用户数据。`,
    facts: [
      '定位：服务端 actionId 查询',
      '结果：0 条',
      ...filterFacts,
      '边界：不确认外部副作用',
    ],
  };
});
const attentionBreakdownReceipt = computed<AttentionBreakdownReceipt | null>(() => {
  if (actions.value.length === 0 || attentionActionCount.value === 0) return null;

  const rows = [
    {
      key: 'failed',
      label: '失败/死信',
      value: failedActionCount.value,
      description: '先看 lastError、结果回执和外部副作用',
    },
    {
      key: 'due',
      label: '已到期自动动作',
      value: dueActionCount.value,
      description: '等待调度扫描，或在卡片上手动执行',
    },
    {
      key: 'approval',
      label: '待人工确认',
      value: approvalActionCount.value,
      description: '点击确认前先核对范围和证据',
    },
    {
      key: 'high-risk',
      label: '高风险已可执行',
      value: highRiskReadyActionCount.value,
      description: '无待审批拦截，但仍需人工看清影响',
    },
  ].filter((row) => row.value > 0);

  return {
    tone: isShowingStaleSnapshot.value ? 'warning' : failedActionCount.value > 0 ? 'danger' : 'warning',
    title: isShowingStaleSnapshot.value ? '上次成功快照的处理构成' : '当前需要处理的动作已拆分',
    totalLabel: `${attentionActionCount.value} 条`,
    body: isShowingStaleSnapshot.value
      ? '最近一次刷新失败，下面只是上次成功读取时的阻塞构成；不能据此确认当前动作已经完成、失败已恢复或队列已清空。'
      : '这里把需要处理的动作拆成互斥类别，帮助先处理失败、到期、审批和高风险项；本区域只是只读统计，不会执行、批准、重试或取消任何动作。',
    rows: rows.map((row) => ({
      ...row,
      value: String(row.value),
    })),
    facts: [
      '口径：当前可见筛选结果',
      isShowingStaleSnapshot.value ? '快照：上次成功读取' : '快照：本次读取',
      '边界：只读统计',
      '无副作用：不执行 / 不批准 / 不重试 / 不取消',
    ],
  };
});
const emptyFilterReceipt = computed<EmptyFilterReceipt | null>(() => {
  if (loadError.value || actions.value.length > 0) return null;
  if (!hasRouteFilters.value && !hasUiFilters.value) return null;

  const facts = [
    routeActionIdFilter.value
      ? `动作 ID：${compactReceiptText(routeActionIdFilter.value, 56)}`
      : '',
    sourceKindFilter.value ? `来源类型：${sourceKindFilter.value}` : '',
    sourceRefIdFilter.value
      ? `来源 ID：${compactReceiptText(sourceRefIdFilter.value, 48)}`
      : '',
    queueStatus.value !== 'all' ? `状态：${queueStatus.value}` : '',
    executionMode.value ? `模式：${executionMode.value}` : '',
    '结果：0 条',
    '边界：只读筛选，不执行 / 不批准 / 不重试 / 不取消',
  ].filter(Boolean);

  return {
    title: hasRouteFilters.value
      ? '当前深链筛选没有返回动作'
      : '当前状态/模式筛选没有动作',
    body: hasRouteFilters.value
      ? '这只说明当前 actionId、来源、状态或模式切片没有命中；不能据此判断动作已完成、已取消、外部副作用已发生或整个队列已清空。'
      : '这只说明当前状态或模式切片没有命中；清除筛选后才能确认其它队列记录是否仍需要处理。',
    facts: [
      ...facts,
      hasRouteFilters.value ? '恢复：查看全部动作' : '恢复：清除状态/模式筛选',
    ],
  };
});
const emptyStateTitle = computed(() =>
  loadError.value
    ? '动作队列暂时无法读取'
    : hasRouteFilters.value || hasUiFilters.value
    ? '当前筛选没有动作'
    : '没有动作记录',
);
const emptyStateDetail = computed(() => {
  if (loadError.value) {
    return '请确认 Memory Service 可用后重试；页面不会把读取失败误当成队列已清空。';
  }
  if (hasRouteFilters.value) {
    return '当前深链、来源、状态或执行模式没有命中。查看全部动作可以确认队列里是否还有其他记录。';
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
  const queryKey = currentActionQueryKey();
  if (shouldShowLoading) {
    loading.value = true;
  }
  try {
    const response = await client.getActions({
      actionId: routeActionIdFilter.value || undefined,
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
    actionReadinessSummary.value = response.readinessSummary ?? null;
    totalActions.value = routeActionIdFilter.value
      ? filteredItems.length
      : response.total ?? filteredItems.length;
    loadError.value = '';
    lastSuccessfulLoadAt.value = Date.now();
    lastSuccessfulQueryKey.value = queryKey;
    await hydrateOutreachSessions(filteredItems);
  } catch (error) {
    console.error('Failed to load actions:', error);
    const canKeepSnapshot =
      actions.value.length > 0 && lastSuccessfulQueryKey.value === queryKey;
    loadError.value = canKeepSnapshot
      ? `刷新动作队列失败，已保留上次快照：${formatActionError(error)}`
      : `读取动作队列失败：${formatActionError(error)}`;
    if (shouldShowLoading && !canKeepSnapshot) {
      actions.value = [];
      actionReadinessSummary.value = null;
      outreachByActionId.value = {};
      totalActions.value = 0;
    }
  } finally {
    if (shouldShowLoading) {
      loading.value = false;
    }
  }
}

function currentActionQueryKey(): string {
  return JSON.stringify({
    queueStatus: queueStatus.value,
    executionMode: executionMode.value || '',
    actionId: routeActionIdFilter.value || '',
    sourceKind: sourceKindFilter.value || '',
    sourceRefId: sourceRefIdFilter.value || '',
    sourceTitle: sourceTitleFilter.value || '',
  });
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

async function executeAction(action: RuntimeAction) {
  const { id } = action;
  setActionOperation(id, 'execute');
  try {
    const approvalPayload = approvalExecutePayload(action);
    const result = await client.executeAction(id, approvalPayload);
    if (result.error) {
      throw new Error(result.error);
    }
    applyExecuteAcceptedState(action, result, approvalPayload?.approve === true);
    setActionOperationReceipt(
      id,
      buildExecuteOperationReceipt(action, result, approvalPayload?.approve === true),
    );
    await loadActions({ silent: true });
  } catch (error) {
    setActionOperationError(id, buildActionOperationError(action, 'execute', error));
    await loadActions({ silent: true });
  } finally {
    clearActionOperation(id);
  }
}

async function retryAction(action: RuntimeAction) {
  const { id } = action;
  setActionOperation(id, 'retry');
  try {
    const response = await client.retryAction(id);
    setActionOperationReceipt(
      id,
      buildRetryOperationReceipt(action, response.action ?? action),
    );
    await loadActions({ silent: true });
  } catch (error) {
    setActionOperationError(id, buildActionOperationError(action, 'retry', error));
  } finally {
    clearActionOperation(id);
  }
}

async function probeActionReadiness(action: RuntimeAction) {
  const { id } = action;
  setActionOperation(id, 'probe');
  try {
    const response = await client.probeActionReadiness(id);
    setActionOperationReceipt(
      id,
      buildReadinessProbeOperationReceipt(action, response),
    );
    await loadActions({ silent: true });
  } catch (error) {
    setActionOperationError(
      id,
      buildActionOperationError(action, 'probe', error),
    );
    await loadActions({ silent: true });
  } finally {
    clearActionOperation(id);
  }
}

async function cancelAction(action: RuntimeAction) {
  const { id } = action;
  setActionOperation(id, 'cancel');
  try {
    const response = await client.cancelAction(id, 'Cancelled from action queue UI');
    setActionOperationReceipt(
      id,
      buildCancelOperationReceipt(action, response.action ?? action),
    );
    await loadActions({ silent: true });
  } catch (error) {
    setActionOperationError(id, buildActionOperationError(action, 'cancel', error));
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
  actionOperationReceipts.value = omitActionEntry(actionOperationReceipts.value, id);
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

function actionOperationReceipt(id: string): ActionOperationReceipt | null {
  return actionOperationReceipts.value[id] ?? null;
}

function actionPendingOperationReceipt(action: RuntimeAction): ActionOperationReceipt | null {
  const operation = actionOperations.value[action.id];
  if (!operation) return null;

  const isOpenClaw = isOpenClawDelegationAction(action);
  const mode = isOpenClaw ? openClawDelegationMode(action) : 'read';
  const tone: ActionOperationReceipt['tone'] =
    isOpenClaw && (mode === 'write' || action.requiresApproval || action.riskLevel === 'high')
      ? 'warning'
      : 'info';
  const facts = [
    '状态：等待服务确认',
    `队列快照：${action.queueStatus}`,
    action.requiresApproval && !action.approvedAt ? '批准：尚未确认写入' : '',
    isOpenClaw ? `模式：${mode === 'write' ? '写操作' : '只读查询'}` : `类型：${actionScopeTypeLabel(action)}`,
    isOpenClaw ? `范围：${openClawTargetSystem(action) || '由 OpenClaw 判断'}` : '',
  ].filter(Boolean);

  if (operation === 'execute') {
    return {
      tone,
      title: action.requiresApproval && !action.approvedAt
        ? '确认与执行请求正在提交'
        : '执行请求正在提交',
      body: isOpenClaw
        ? '正在等待 Memory Service 确认接收这次批准或执行请求；当前卡片仍是上次读取的队列快照，不代表 OpenClaw 已开始、外部系统已完成或批准已经写入。'
        : '正在等待 Memory Service 确认接收这次执行请求；当前卡片仍是上次读取的队列快照，不代表通知、主动询问、决策请求或本地真值写入已经完成。',
      facts,
    };
  }

  if (operation === 'retry') {
    return {
      tone,
      title: isOpenClaw ? 'OpenClaw 重试请求正在提交' : '重试入队请求正在提交',
      body: isOpenClaw
        ? '正在等待 Memory Service 确认把这条 OpenClaw 动作重新入队；此时还没有清除旧错误，也不能证明外部副作用已经发生、撤销或重新执行。'
        : '正在等待 Memory Service 确认把这条动作重新入队；此时还没有清除旧错误，也不代表后续通知、询问或本地写入已经重新执行。',
      facts: [...facts, '重试：尚未确认入队'],
    };
  }

  if (operation === 'probe') {
    return {
      tone: 'info',
      title: '执行就绪重测正在提交',
      body: '正在等待 Memory Service 检查 OpenClaw 连接、鉴权和 capability；本次重测不会提交原动作，也不会抹掉历史 attempt 或潜在外部副作用。',
      facts: [
        ...facts,
        '重测：只检查 readiness',
        '本次重测：不执行原动作',
      ],
    };
  }

  return {
    tone,
    title: isOpenClaw ? 'OpenClaw 取消请求正在提交' : '取消请求正在提交',
    body: isOpenClaw
      ? '正在等待 Memory Service 确认取消队列动作；取消只作用于未完成的队列项，不会撤销可能已经发生的 Jira、Drive、部署等外部副作用。'
      : '正在等待 Memory Service 确认取消队列动作；取消不会删除来源记忆、反思证据或已经产生的历史结果。',
    facts: [...facts, '取消：尚未确认写入'],
  };
}

function setActionOperationReceipt(
  id: string,
  receipt: ActionOperationReceipt,
) {
  actionOperationReceipts.value = {
    ...actionOperationReceipts.value,
    [id]: receipt,
  };
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
  if (operation === 'probe') return '重测中...';
  return '取消中...';
}

function actionButtonBoundaryLabel(action: RuntimeAction, operation: ActionOperation): string {
  if (isActionOperation(action.id, operation)) {
    return pendingActionButtonBoundaryLabel(action, operation);
  }
  if (operation === 'execute') return executeButtonBoundaryLabel(action);
  if (operation === 'retry') return retryButtonBoundaryLabel(action);
  if (operation === 'probe') return readinessProbeButtonBoundaryLabel(action);
  return cancelButtonBoundaryLabel(action);
}

function pendingActionButtonBoundaryLabel(action: RuntimeAction, operation: ActionOperation): string {
  if (operation === 'execute') {
    return action.requiresApproval && !action.approvedAt
      ? '确认并执行正在提交：等待 Memory Service 确认批准和执行；当前卡片仍是上次队列快照。'
      : '执行请求正在提交：等待 Memory Service 确认；当前卡片仍是上次队列快照，不代表动作已完成。';
  }
  if (operation === 'retry') {
    return '重试入队正在提交：等待 Memory Service 确认；旧错误和队列状态尚未被新结果替换。';
  }
  if (operation === 'probe') {
    return '重测正在提交：只检查 OpenClaw 连接、鉴权和 capability；本次重测不会再次执行原动作。';
  }
  return '取消正在提交：等待 Memory Service 确认；当前卡片仍是上次队列快照，不代表队列项已取消。';
}

function executeButtonBoundaryLabel(action: RuntimeAction): string {
  if (action.requiresApproval && !action.approvedAt) {
    return '确认并执行：先写入批准并提交执行请求；不会证明外部系统已完成，结果以队列状态、artifact 或 transcript 为准。';
  }
  if (isOpenClawDelegationAction(action)) {
    return openClawDelegationMode(action) === 'write'
      ? '执行：把 OpenClaw 写操作提交给 Memory Service；不会立即证明 Jira、Drive 或部署系统已完成。'
      : '执行：把 OpenClaw 只读查询提交给 Memory Service；不会立即确认外部事实。';
  }
  switch (action.actionType) {
    case 'notify_user':
      return '执行：提交通知动作；送达仍以 Notification Center 或 provider 回执为准。';
    case 'ask_external_user':
      return '执行：交给 Outreach 引擎；不在本页确认消息已发送或外部人员已回复。';
    case 'create_confirm_request':
      return '执行：创建或更新决策中心请求；不替用户选择答案，也不执行后续外部动作。';
    case 'update_truth_property':
      return '执行：提交本地真值或画像写入；不外发、不跨平台同步、不删除原始证据。';
    default:
      return '执行：提交 Memory Service action runtime；完成、外部副作用和写入结果以后续队列状态或结果回执为准。';
  }
}

function retryButtonBoundaryLabel(action: RuntimeAction): string {
  if (isOpenClawDelegationAction(action)) {
    return openClawDelegationMode(action) === 'write'
      ? '重试入队：只把 OpenClaw 写操作重新放回队列；重试前请确认外部副作用是否已经发生。'
      : '重试入队：只把 OpenClaw 只读查询重新放回队列；不代表外部事实已确认。';
  }
  return '重试入队：只把动作重新排队；不抹掉旧错误，也不代表通知、询问或本地写入已经重新执行。';
}

function readinessProbeButtonBoundaryLabel(action: RuntimeAction): string {
  const scope = action.readinessReceipt?.scopeKey || 'openclaw:unknown';
  return `修复后重测 ${scope}：只检查连接、鉴权和 capability；不会提交原动作，不代表外部事实或写操作已经完成。`;
}

function cancelButtonBoundaryLabel(action: RuntimeAction): string {
  if (isOpenClawDelegationAction(action)) {
    return '取消：只取消未完成队列项；不会撤销可能已经发生的外部副作用，也不会删除反思证据或历史结果。';
  }
  return '取消：只取消未完成队列项；不会删除来源记忆、反思证据或已经产生的历史结果。';
}

function buildActionOperationError(
  action: RuntimeAction,
  operation: ActionOperation,
  error: unknown,
): string {
  const message = formatActionError(error);
  if (!isOpenClawDelegationAction(action)) {
    if (operation === 'execute') return `执行请求失败：${message}`;
    if (operation === 'retry') return `重试入队失败：${message}`;
    return `取消失败：${message}`;
  }

  const modeLabel = openClawDelegationMode(action) === 'write' ? '写操作' : '只读查询';
  if (operation === 'probe') {
    return `OpenClaw ${modeLabel}就绪重测失败：${message}。这次没有提交原动作，也不能证明外部系统已经开始、完成或撤销任何操作。`;
  }
  if (operation === 'execute') {
    return `OpenClaw ${modeLabel}执行请求失败：${message}。Memory Service 没有确认接收这次执行请求；本页不会把它标成 running，也不证明外部系统已经开始或完成。若这是“确认并执行”，批准是否写入仍以刷新后的队列状态为准。`;
  }
  if (operation === 'retry') {
    return `OpenClaw ${modeLabel}重试入队失败：${message}。这次请求没有确认重新入队，也不会证明外部副作用已经发生或撤销。`;
  }
  return `OpenClaw ${modeLabel}取消失败：${message}。这次请求没有确认取消队列动作，也不会撤销可能已经发生的外部副作用。`;
}

function approvalExecutePayload(action: RuntimeAction): { approve: boolean } | undefined {
  if (!action.requiresApproval || action.approvedAt) return undefined;
  return {
    approve: true,
  };
}

function buildExecuteOperationReceipt(
  action: RuntimeAction,
  result: {
    queueStatus?: string;
    result?: Record<string, any>;
  },
  submittedApproval: boolean,
): ActionOperationReceipt {
  const isOpenClaw = isOpenClawDelegationAction(action);
  const mode = isOpenClaw ? openClawDelegationMode(action) : 'read';
  const tone: ActionOperationReceipt['tone'] =
    isOpenClaw && (mode === 'write' || submittedApproval || action.riskLevel === 'high')
      ? 'warning'
      : 'info';
  const title = isOpenClaw
    ? submittedApproval
      ? '已确认并提交 OpenClaw 执行'
      : 'OpenClaw 执行请求已提交'
    : '执行请求已提交';
  const body = isOpenClaw
    ? mode === 'write'
      ? 'Memory Service 已把这条写操作交给 OpenClaw；这里还不确认 Jira、Drive、部署等外部系统已经完成，最终以 artifact、transcript 和后续队列状态为准。'
      : 'Memory Service 已把只读查询交给 OpenClaw；这只表示队列开始执行，不代表外部事实已确认，最终以 artifact / transcript 回流为准。'
    : '执行请求已发送到 Memory Service；是否完成仍以队列状态和后续结果回执为准。';
  return {
    tone,
    title,
    body,
    facts: [
      `服务端状态：${result.queueStatus || 'unknown'}`,
      submittedApproval ? '批准：已随请求提交' : '',
      isOpenClaw ? `模式：${mode === 'write' ? '写操作' : '只读查询'}` : '',
      isOpenClaw ? `范围：${openClawTargetSystem(action) || '由 OpenClaw 判断'}` : '',
      isOpenClaw ? '结论：等待 artifact / transcript' : '',
    ].filter(Boolean),
  };
}

function buildRetryOperationReceipt(
  originalAction: RuntimeAction,
  updatedAction: RuntimeAction,
): ActionOperationReceipt {
  const isOpenClaw = isOpenClawDelegationAction(originalAction);
  const mode = isOpenClaw ? openClawDelegationMode(originalAction) : 'read';
  return {
    tone: isOpenClaw && mode === 'write' ? 'warning' : 'info',
    title: isOpenClaw ? 'OpenClaw 重试已入队' : '重试已入队',
    body: isOpenClaw
      ? mode === 'write'
        ? '这次只把写操作重新放回队列；再次执行前仍要确认外部系统没有已经发生不可重复的副作用。'
        : '这次只把只读查询重新放回队列；重试成功不等于外部事实已确认，仍以 artifact / transcript 回流为准。'
      : '这次只把动作重新放回队列；后续是否完成仍以队列状态和结果回执为准。',
    facts: [
      `队列状态：${updatedAction.queueStatus || 'queued'}`,
      `重试次数：${updatedAction.retryCount ?? originalAction.retryCount}`,
      isOpenClaw ? `模式：${mode === 'write' ? '写操作' : '只读查询'}` : '',
      isOpenClaw ? '结论：未写入外部事实' : '',
    ].filter(Boolean),
  };
}

function buildCancelOperationReceipt(
  originalAction: RuntimeAction,
  updatedAction: RuntimeAction,
): ActionOperationReceipt {
  const isOpenClaw = isOpenClawDelegationAction(originalAction);
  const mode = isOpenClaw ? openClawDelegationMode(originalAction) : 'read';
  return {
    tone: isOpenClaw && mode === 'write' ? 'warning' : 'success',
    title: isOpenClaw ? 'OpenClaw 动作已取消' : '动作已取消',
    body: isOpenClaw
      ? '取消只作用于队列里的未完成动作；它不会撤销已经发生的 Jira、Drive、部署等外部改动，也不会删除反思证据或历史结果。'
      : '取消只作用于队列里的未完成动作；它不会删除来源记忆、反思证据或已经产生的历史结果。',
    facts: [
      `队列状态：${updatedAction.queueStatus || 'cancelled'}`,
      isOpenClaw ? '外部副作用：未撤销' : '',
      '证据：保留',
    ].filter(Boolean),
  };
}

function buildReadinessProbeOperationReceipt(
  action: RuntimeAction,
  response: Awaited<ReturnType<typeof client.probeActionReadiness>>,
): ActionOperationReceipt {
  const ready = response.receipt.status === 'ready';
  const blocked = isBlockingReadinessStatus(response.receipt.status);
  return {
    tone: ready ? 'success' : blocked ? 'warning' : 'info',
    title: ready
      ? '执行就绪重测通过'
      : blocked
      ? '执行就绪仍被阻断'
      : '执行就绪需要人工复核',
    body: response.probeReceipt.summary,
    facts: [
      `契约：${response.receipt.scopeKey}`,
      `状态：${actionReadinessStatusText(response.receipt.status)}`,
      '原动作：未由本次重测执行',
      '外部写入：未由本次重测触发',
    ],
  };
}

function actionReadinessStatusText(status?: string): string {
  switch (status) {
    case 'ready':
      return '可执行';
    case 'blocked_auth':
      return '鉴权阻断';
    case 'blocked_capability':
      return '能力阻断';
    case 'blocked_input':
      return '输入不完整';
    case 'blocked_proof':
      return '证明不完整';
    case 'degraded':
      return '能力降级';
    case 'expired':
      return '证明过期';
    default:
      return '尚未证明';
  }
}

function isBlockingReadinessStatus(status?: string): boolean {
  return Boolean(status?.startsWith('blocked_'));
}

function isActionReadinessBlocked(action: RuntimeAction): boolean {
  return isBlockingReadinessStatus(action.readinessReceipt?.status);
}

function actionReadinessStatusLabel(action: RuntimeAction): string {
  return actionReadinessStatusText(action.readinessReceipt?.status).toUpperCase();
}

function actionReadinessTone(action: RuntimeAction): QueueGuidanceTone {
  const status = action.readinessReceipt?.status;
  if (isBlockingReadinessStatus(status)) return 'danger';
  if (status === 'degraded' || status === 'expired') return 'warning';
  if (status === 'ready') return 'success';
  return 'info';
}

function actionReadinessTitle(action: RuntimeAction): string {
  const status = action.readinessReceipt?.status;
  if (isBlockingReadinessStatus(status)) {
    return action.readinessReceipt?.dispatchState === 'dispatched'
      ? '历史派发后暴露就绪阻断'
      : '原动作已在派发前阻断';
  }
  if (status === 'ready') return '近期 capability 证明有效';
  if (status === 'degraded' || status === 'expired') {
    return '自动执行前需要重测';
  }
  return action.executionMode === 'manual'
    ? '可手动执行并建立首次证明'
    : '首次执行将建立就绪证明';
}

function actionReadinessBody(action: RuntimeAction): string {
  const receipt = action.readinessReceipt;
  if (!receipt) return '';
  const base = receipt.reason || '当前没有更详细的执行就绪说明。';
  if (isBlockingReadinessStatus(receipt.status)) {
    return receipt.dispatchState === 'dispatched'
      ? `${base} 这条动作已有历史 dispatch attempt；不能据此断言外部没有执行或没有副作用，请先复核 result / transcript，再重测。`
      : `${base} 当前卡片保留在队列中，没有增加重试次数，也没有提交原动作。`;
  }
  if (receipt.status === 'ready') {
    return `${base} 这只证明 capability 近期可用，审批和最终结果仍以本动作回执为准。`;
  }
  if (receipt.status === 'degraded' || receipt.status === 'expired') {
    return `${base} 重测只检查连接、鉴权和 capability，不会执行原动作。`;
  }
  return `${base} 未知状态不代表失败，也不代表任何外部操作已经发生。`;
}

function actionReadinessFacts(action: RuntimeAction): string[] {
  const receipt = action.readinessReceipt;
  if (!receipt) return [];
  return [
    `契约：${receipt.scopeKey}`,
    `检查：${formatActionTime(receipt.checkedAt)}`,
    receipt.expiresAt ? `有效至：${formatActionTime(receipt.expiresAt)}` : '',
    receipt.affectedActionCount > 0
      ? `受影响动作：${receipt.affectedActionCount}`
      : '',
    receipt.requiredInputs.length > 0
      ? `必填输入：${receipt.requiredInputs.join(' / ')}`
      : '',
    receipt.requiredApprovals.length > 0
      ? `审批：${receipt.requiredApprovals.join(' / ')}`
      : '',
    receipt.proofRequirements.length > 0
      ? `结果证明：${receipt.proofRequirements.join(' / ')}`
      : '',
    receipt.dispatchState === 'dispatched'
      ? '历史：原动作已有派发记录'
      : '本次门禁：原动作未派发',
  ].filter(Boolean);
}

function actionReadinessBoundary(action: RuntimeAction): string {
  const boundaries = action.readinessReceipt?.doesNotProve ?? [];
  return boundaries.length > 0
    ? boundaries.join('；')
    : '就绪状态不代表原动作或外部写操作已经完成。';
}

function canProbeActionReadiness(action: RuntimeAction): boolean {
  const status = action.readinessReceipt?.status;
  if (!status) return false;
  if (
    action.queueStatus === 'running' ||
    action.queueStatus === 'succeeded' ||
    action.queueStatus === 'cancelled'
  ) {
    return isActionOperation(action.id, 'probe');
  }
  return (
    isBlockingReadinessStatus(status) ||
    status === 'degraded' ||
    status === 'expired' ||
    isActionOperation(action.id, 'probe')
  );
}

function readinessProbeButtonLabel(action: RuntimeAction): string {
  return isActionReadinessBlocked(action) ? '修复后重测' : '重测就绪';
}

function canRetryAction(action: RuntimeAction): boolean {
  return (
    action.queueStatus === 'failed' &&
    !canProbeActionReadiness(action)
  );
}

function canShowExecuteButton(action: RuntimeAction): boolean {
  return (
    isActionOperation(action.id, 'execute') ||
    (!isActionReadinessBlocked(action) &&
      action.readinessReceipt?.status !== 'degraded' &&
      action.readinessReceipt?.status !== 'expired' &&
      (action.queueStatus === 'queued' || action.queueStatus === 'failed'))
  );
}

function executeButtonLabel(action: RuntimeAction): string {
  if (action.requiresApproval && !action.approvedAt) return '确认并执行';
  return '执行';
}

function applyExecuteAcceptedState(
  acceptedAction: RuntimeAction,
  result: {
    queueStatus?: string;
    result?: Record<string, any>;
  },
  submittedApproval: boolean,
) {
  const acceptedStatus = normalizeQueueStatus(result.queueStatus);
  const currentTime = Date.now();
  actions.value = actions.value.map((action) =>
    action.id === acceptedAction.id
      ? {
          ...action,
          queueStatus: acceptedStatus || action.queueStatus,
          approvedAt:
            submittedApproval && !action.approvedAt ? currentTime : action.approvedAt,
          startedAt:
            acceptedStatus === 'running' ? action.startedAt || currentTime : action.startedAt,
          finishedAt:
            acceptedStatus === 'succeeded' ||
            acceptedStatus === 'failed' ||
            acceptedStatus === 'dead_letter' ||
            acceptedStatus === 'cancelled'
              ? action.finishedAt || currentTime
              : action.finishedAt,
          lastError: undefined,
          result: result.result ?? action.result,
        }
      : action,
  );
}

function normalizeQueueStatus(value?: string): RuntimeAction['queueStatus'] | '' {
  if (
    value === 'queued' ||
    value === 'running' ||
    value === 'succeeded' ||
    value === 'failed' ||
    value === 'cancelled' ||
    value === 'dead_letter'
  ) {
    return value;
  }
  return '';
}

function isActionRunning(action: RuntimeAction): boolean {
  return action.queueStatus === 'running';
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

function approvalStatusLabel(action: RuntimeAction): string {
  if (!action.requiresApproval) return '';
  if (action.approvedAt) return `已人工确认 ${formatActionTime(action.approvedAt)}`;
  return '待人工确认';
}

function showApprovalCheckpoint(action: RuntimeAction): boolean {
  return (
    action.requiresApproval &&
    action.queueStatus !== 'succeeded' &&
    action.queueStatus !== 'cancelled'
  );
}

function approvalCheckpointTitle(action: RuntimeAction): string {
  if (action.approvedAt) return '已经记录人工批准';
  if (isOpenClawDelegationAction(action)) {
    return openClawDelegationMode(action) === 'write'
      ? '确认前核对外部写操作'
      : '确认前核对外部查询';
  }
  if (action.riskLevel === 'high') return '执行前需要确认高风险动作';
  return '执行前需要人工确认';
}

function approvalCheckpointBody(action: RuntimeAction): string {
  if (action.approvedAt) {
    if (isOpenClawDelegationAction(action)) {
      return '这条 OpenClaw 动作已经记录人工批准；批准只说明允许继续执行，外部系统是否完成仍要看 artifact、transcript 和队列状态。';
    }
    return '这条动作已经记录批准时间；后续重试仍会保留批准痕迹，便于审计为什么允许继续执行。';
  }
  if (isOpenClawDelegationAction(action)) {
    const mode = openClawDelegationMode(action);
    if (mode === 'write') {
      return '点击“确认并执行”会先写入批准时间，再把写操作交给 OpenClaw；这不是 Jira、Drive、部署等外部系统已经完成的证明。';
    }
    return '点击“确认并执行”会先写入批准时间，再把只读查询交给 OpenClaw；这不是外部事实已经确认的证明。';
  }
  return '点击“确认并执行”会先写入批准时间，再触发执行；如果只是想放弃这条动作，请使用取消。';
}

function approvalCheckpointFacts(action: RuntimeAction): string[] {
  if (isOpenClawDelegationAction(action)) {
    return [
      riskReviewLabel(action),
      executionReviewLabel(action),
      `OpenClaw：${openClawDelegationMode(action) === 'write' ? '写操作' : '只读查询'}`,
      `目标：${openClawTargetSystem(action) || '由 OpenClaw 判断'}`,
      '结果证明：artifact / transcript / 队列状态',
      action.approvedAt ? `批准时间 ${formatActionTime(action.approvedAt)}` : '批准：点击后才写入',
    ];
  }
  return [
    riskReviewLabel(action),
    executionReviewLabel(action),
    action.approvedAt ? `批准时间 ${formatActionTime(action.approvedAt)}` : '',
  ].filter(Boolean);
}

function riskReviewLabel(action: RuntimeAction): string {
  if (action.riskLevel === 'high') return '风险：高';
  if (action.riskLevel === 'medium') return '风险：中';
  if (action.riskLevel === 'low') return '风险：低';
  return `风险：${action.riskLevel || '未知'}`;
}

function executionReviewLabel(action: RuntimeAction): string {
  return action.executionMode === 'auto'
    ? '模式：自动调度'
    : '模式：手动执行';
}

function actionExecutionScopeReceipt(action: RuntimeAction): ActionExecutionScopeReceipt | null {
  if (isOpenClawDelegationAction(action)) return null;
  if (action.queueStatus === 'succeeded' || action.queueStatus === 'cancelled') return null;

  const isFailed = action.queueStatus === 'failed' || action.queueStatus === 'dead_letter';
  const isRunning = action.queueStatus === 'running';
  const isLocalWrite = isLocalTruthWriteAction(action);
  const tone: QueueGuidanceTone = isFailed
    ? 'danger'
    : isLocalWrite || (action.requiresApproval && !action.approvedAt) || action.riskLevel === 'high'
    ? 'warning'
    : isRunning
    ? 'info'
    : 'info';

  return {
    tone,
    title: actionExecutionScopeTitle(action),
    body: actionExecutionScopeBody(action),
    facts: actionExecutionScopeFacts(action),
  };
}

function actionExecutionScopeTitle(action: RuntimeAction): string {
  if (action.queueStatus === 'running') return '执行中，等待结果回执';
  if (action.queueStatus === 'failed' || action.queueStatus === 'dead_letter') {
    return '重试前确认执行范围';
  }
  if (action.requiresApproval && !action.approvedAt) return '确认前先看执行范围';
  if (isScheduledDue(action)) return '到期自动动作范围';
  return '执行前范围';
}

function actionExecutionScopeBody(action: RuntimeAction): string {
  if (action.queueStatus === 'running') {
    return 'Memory Service 已经接手这条动作；页面刷新只读取状态，不代表通知送达、外部回复、决策完成或本地真值写入已经确认。';
  }
  if (action.queueStatus === 'failed' || action.queueStatus === 'dead_letter') {
    return '重试只会把动作重新放回队列；它不会抹掉本次错误、不会确认之前的外部副作用，也不会自动撤销已经产生的结果。';
  }

  switch (action.actionType) {
    case 'notify_user':
      return '执行会把这条通知交给 Memory Service 的通知通道；本页不直接确认 Chrome、Doubao 或 Glip 已送达，最终以 Notification Center / provider 回执为准。';
    case 'ask_external_user':
      return '执行会交给 Outreach 引擎创建或推进询问；它不会绕过审批，也不会在本页确认 RingCentral 消息已发送或外部人员已回复。';
    case 'create_confirm_request':
      return '执行会在决策中心创建或更新确认请求；它不会替用户选择答案，也不会执行这个决定后面的外部动作。';
    case 'update_truth_property':
      return '执行会尝试写入本地 Memory Service 真值或画像属性；它不会外发、不会跨平台同步，也不会删除原始证据。';
    default:
      return '执行会提交到 Memory Service action runtime；本页只发起队列操作，完成、外部副作用和写入结果都以后续状态或结果回执为准。';
  }
}

function actionExecutionScopeFacts(action: RuntimeAction): string[] {
  return [
    `类型：${actionScopeTypeLabel(action)}`,
    executionReviewLabel(action),
    `队列：${action.queueStatus}`,
    action.requiresApproval && !action.approvedAt ? '审批：先确认再执行' : '',
    action.queueStatus === 'failed' || action.queueStatus === 'dead_letter'
      ? '重试：只重新入队'
      : '',
    action.queueStatus === 'queued' ? '完成：等待结果回执' : '',
    action.queueStatus === 'running' ? '完成：尚未确认' : '',
    action.sourceKind ? `来源：${action.sourceKind}` : '',
  ].filter(Boolean);
}

function actionScopeTypeLabel(action: RuntimeAction): string {
  switch (action.actionType) {
    case 'notify_user':
      return '通知提醒';
    case 'ask_external_user':
      return '主动询问';
    case 'create_confirm_request':
      return '决策中心确认请求';
    case 'update_truth_property':
      return '本地真值/画像更新';
    case 'query_external_tool':
      return '外部工具查询';
    default:
      return action.actionType || '运行时动作';
  }
}

function isLocalTruthWriteAction(action: RuntimeAction): boolean {
  return action.actionType === 'update_truth_property';
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

function openClawDelegationMode(action: RuntimeAction): 'read' | 'write' {
  return action.params?.mode === 'write' ? 'write' : 'read';
}

function openClawTargetSystem(action: RuntimeAction): string {
  const target = action.params?.targetSystem;
  return typeof target === 'string' && target.trim().length > 0
    ? target.trim()
    : '';
}

function compactReceiptText(value: string, maxLength = 96): string {
  const compacted = value.replace(/\s+/g, ' ').trim();
  if (compacted.length <= maxLength) return compacted;
  return `${compacted.slice(0, maxLength - 1)}…`;
}

function openClawTaskPreview(action: RuntimeAction): string {
  const task = action.params?.task;
  if (typeof task === 'string' && task.trim().length > 0) {
    return compactReceiptText(task);
  }
  return compactReceiptText(action.description || action.title || '未提供任务说明');
}

function openClawPreflightTone(action: RuntimeAction): QueueGuidanceTone {
  const mode = openClawDelegationMode(action);
  if (action.queueStatus === 'succeeded') return 'success';
  if (action.queueStatus === 'dead_letter') return mode === 'write' ? 'danger' : 'warning';
  if (action.queueStatus === 'failed') return mode === 'write' ? 'danger' : 'warning';
  if (isStaleRunningAction(action)) return 'warning';
  if (mode === 'write' || (action.requiresApproval && !action.approvedAt) || action.riskLevel === 'high') {
    return 'warning';
  }
  return 'info';
}

function openClawPreflightTitle(action: RuntimeAction): string {
  const mode = openClawDelegationMode(action);
  if (action.queueStatus === 'succeeded') return '结果已回流，按 artifact / transcript 审计';
  if (action.queueStatus === 'failed' || action.queueStatus === 'dead_letter') {
    return mode === 'write'
      ? '重试前先确认外部副作用'
      : '失败后先看错误和 transcript';
  }
  if (isActionRunning(action)) return '正在等待 OpenClaw 最终结果';
  if (isAutoExecutable(action)) {
    return mode === 'write'
      ? '自动调度会委派外部写操作'
      : '等待自动调度委派';
  }
  if (mode === 'write') {
    return action.requiresApproval && !action.approvedAt
      ? '写操作会先停在人工确认'
      : '外部写操作将由 OpenClaw 接管';
  }
  return '只读查询会委派给 OpenClaw';
}

function openClawPreflightDetail(action: RuntimeAction): string {
  const mode = openClawDelegationMode(action);
  if (action.queueStatus === 'succeeded') {
    return '这条动作已经返回最终结果；优先核对下方 artifact、payload 和 transcript，再让反思线程继续消费结果。';
  }
  if (action.queueStatus === 'failed' || action.queueStatus === 'dead_letter') {
    return mode === 'write'
      ? '这条写操作没有拿到可信完成回执；重试前先确认 Jira、Drive、部署等外部系统是否已经发生副作用。'
      : '这条查询没有成功完成；先查看 lastError、结果摘要或 transcript，再决定重试还是回到线程改写任务。';
  }
  if (isActionRunning(action)) {
    return '执行中会自动刷新；超过 OpenClaw 超时加 60 秒仍未回流时会转入 dead_letter，避免重复触发外部操作。';
  }
  if (isAutoExecutable(action)) {
    const trigger = action.scheduledAt
      ? '到达预计时间后的下一次 Memory Service 调度扫描'
      : '下一次 Memory Service 调度扫描';
    return `当前页面只是读取队列快照；${trigger}才会把「${openClawTaskPreview(action)}」发送给 OpenClaw。查看这张卡、刷新列表或展开 transcript 都不会提前执行、批准写操作或确认外部系统已开始。`;
  }
  return `将把「${openClawTaskPreview(action)}」发送给 OpenClaw；Memory Service 只消费最终 JSON 结果，中间步骤不写入反思证据链。`;
}

function openClawApprovalFact(action: RuntimeAction): string {
  if (action.requiresApproval && !action.approvedAt) return '审批：待人工确认';
  if (action.requiresApproval && action.approvedAt) return `审批：已确认 ${formatActionTime(action.approvedAt)}`;
  if (openClawDelegationMode(action) === 'write') return '审批：未要求审批，确认规则配置';
  return '审批：无需审批';
}

function openClawRecoveryFact(action: RuntimeAction): string {
  if (action.queueStatus === 'succeeded') return '恢复：结果已回流';
  if (action.queueStatus === 'running') return '恢复：自动刷新 / stale 转 dead_letter';
  if (action.queueStatus === 'failed' || action.queueStatus === 'dead_letter') {
    return openClawDelegationMode(action) === 'write'
      ? '恢复：先查外部结果再重试'
      : '恢复：查看错误后可重试入队';
  }
  if (isAutoExecutable(action)) {
    return action.scheduledAt
      ? '触发：到期后等调度扫描'
      : '触发：下一次调度扫描';
  }
  return action.executionMode === 'auto'
    ? '恢复：失败会派生通知或确认请求'
    : '恢复：手动执行后保留结果回执';
}

function openClawTriggerFact(action: RuntimeAction): string {
  if (isAutoExecutable(action)) {
    return action.scheduledAt
      ? '触发：到期后的后台调度'
      : '触发：后台调度，不由本页点击';
  }
  if (action.queueStatus !== 'queued') return '';
  if (action.requiresApproval && !action.approvedAt) return '触发：先人工确认';
  if (action.executionMode === 'manual') return '触发：手动执行按钮';
  return '';
}

function openClawFollowUpFact(action: RuntimeAction): string {
  const followUps = openClawFollowUpActions(action);
  if (followUps.length === 0) return '';
  return `后续：已派生 ${followUps.length} 个恢复入口`;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function rawOpenClawFollowUpIds(action: RuntimeAction): string[] {
  const ids = action.result?.followUpActionIds;
  return Array.isArray(ids)
    ? ids
        .filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
        .map((id) => id.trim())
    : [];
}

function coerceOpenClawFollowUpAction(value: unknown): OpenClawFollowUpActionView | null {
  if (!isObjectRecord(value) || typeof value.id !== 'string' || !value.id.trim()) return null;
  return {
    id: value.id.trim(),
    actionType:
      typeof value.actionType === 'string' && value.actionType.trim()
        ? value.actionType.trim()
        : undefined,
    title:
      typeof value.title === 'string' && value.title.trim()
        ? value.title.trim()
        : undefined,
    queueStatus:
      typeof value.queueStatus === 'string' && value.queueStatus.trim()
        ? value.queueStatus.trim()
        : undefined,
    sourceKind:
      typeof value.sourceKind === 'string' && value.sourceKind.trim()
        ? value.sourceKind.trim()
        : undefined,
    sourceRefId:
      typeof value.sourceRefId === 'string' && value.sourceRefId.trim()
        ? value.sourceRefId.trim()
        : undefined,
  };
}

function openClawFollowUpActions(action: RuntimeAction): OpenClawFollowUpActionView[] {
  if (!isOpenClawDelegationAction(action) || !action.result) return [];
  const rawSummaries = Array.isArray(action.result.followUpActions)
    ? action.result.followUpActions
    : [];
  const summaries = rawSummaries
    .map(coerceOpenClawFollowUpAction)
    .filter((item): item is OpenClawFollowUpActionView => Boolean(item));
  const byId = new Map<string, OpenClawFollowUpActionView>();
  for (const summary of summaries) {
    byId.set(summary.id, summary);
  }
  for (const id of rawOpenClawFollowUpIds(action)) {
    if (!byId.has(id)) {
      byId.set(id, { id });
    }
  }
  return Array.from(byId.values());
}

function openClawRecoveryReceipt(action: RuntimeAction): OpenClawRecoveryReceipt | null {
  const followUps = openClawFollowUpActions(action);
  if (followUps.length === 0) return null;

  const mode = openClawDelegationMode(action);
  const status = openClawResultStatus(action);
  const hasSummaries = followUps.some((item) => Boolean(item.actionType || item.title || item.queueStatus));
  const tone: OpenClawRecoveryReceipt['tone'] =
    mode === 'write' || action.queueStatus === 'dead_letter'
      ? 'danger'
      : 'warning';
  const title =
    status === 'capability_missing'
      ? '已派生 OpenClaw 配置恢复入口'
      : status === 'auth_error'
      ? '已派生 OpenClaw 授权恢复入口'
      : status === 'need_human_decision'
      ? '已派生人工判断入口'
      : '已派生委派恢复入口';

  return {
    tone,
    title,
    body:
      '这些入口只说明通知、决策或规则改进动作已经创建；它们不会自动重试原 OpenClaw 动作、确认外部事实、发送外部消息或撤销外部副作用。',
    facts: [
      `恢复入口：${followUps.length}`,
      `原动作：${action.queueStatus}`,
      `模式：${mode === 'write' ? '写操作' : '只读查询'}`,
      status ? `委派状态：${delegationOutcomeLabel(action)}` : '',
      hasSummaries ? '明细：可跳转到派生动作' : '明细：旧结果仅保留 action id',
    ].filter(Boolean),
    actions: followUps,
  };
}

function followUpActionTypeLabel(type?: string): string {
  if (type === 'notify_user') return '通知恢复动作';
  if (type === 'create_confirm_request') return '决策中心确认动作';
  if (type === 'delegate_openclaw') return 'OpenClaw 委派动作';
  if (type === 'ask_external_user') return '主动询问动作';
  if (type === 'update_truth_property') return '真值写入动作';
  if (type === 'message_rule_improvement') return '规则改进动作';
  return type || '恢复动作';
}

function followUpActionLabel(action: OpenClawFollowUpActionView): string {
  const typeLabel = followUpActionTypeLabel(action.actionType);
  if (action.title) {
    return `${typeLabel}：${compactReceiptText(action.title, 72)}`;
  }
  return `${typeLabel}：${action.id}`;
}

function followUpActionDetail(action: OpenClawFollowUpActionView): string {
  const parts = [
    action.queueStatus ? `队列 ${action.queueStatus}` : '队列状态未随结果返回',
    action.sourceKind ? `来源 ${action.sourceKind}` : '',
    action.sourceRefId ? `关联 ${action.sourceRefId}` : '',
    `id ${compactReceiptText(action.id, 48)}`,
  ].filter(Boolean);
  return parts.join(' · ');
}

function followUpActionRoute(id: string): string {
  return `/actions?actionId=${encodeURIComponent(id)}`;
}

function openClawPreflightFacts(action: RuntimeAction): string[] {
  return [
    `范围：${openClawTargetSystem(action) || '由 OpenClaw 根据任务判断'}`,
    `模式：${openClawDelegationMode(action) === 'write' ? '写操作' : '只读查询'}`,
    openClawTriggerFact(action),
    openClawApprovalFact(action),
    openClawRecoveryFact(action),
    openClawFollowUpFact(action),
  ].filter(Boolean);
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
    (action.queueStatus === 'queued' &&
      ((action.requiresApproval && !action.approvedAt) || action.riskLevel === 'high'))
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
    return action.approvedAt
      ? '已人工确认；等待手动执行或重试'
      : '等待人工确认后才能执行';
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

function transcriptToggleBoundaryLabel(action: RuntimeAction): string {
  const transcriptPath = actionResultTranscriptPath(action);
  const pathLabel = transcriptPath
    ? compactReceiptText(transcriptPath, 72)
    : '未记录 transcript 路径';
  const isExpanded = Boolean(transcriptVisible.value[action.id]);

  if (isExpanded) {
    return `收起 transcript：只隐藏当前已读取的审计文本；不会删除 ${pathLabel}、重跑 OpenClaw、批准、重试、取消、写 action_result 或确认外部事实。`;
  }

  if (isOpenClawDelegationAction(action)) {
    const modeLabel = openClawDelegationMode(action) === 'write'
      ? '写操作'
      : '只读查询';
    const targetLabel = openClawTargetSystem(action) || '由 OpenClaw 判断';
    return `展开 OpenClaw transcript：只读取本地 delegations 审计文件 ${pathLabel}；模式 ${modeLabel}，目标 ${targetLabel}；不会重跑 OpenClaw、批准、重试、取消、写 action_result、确认外部事实或改动 Jira/Drive/部署。`;
  }

  return `展开 transcript：只读取本地审计文件 ${pathLabel}；不会执行、批准、重试、取消、写入结果或触发外部系统。`;
}

function isOpenClawDelegationAction(action: RuntimeAction): boolean {
  // Agent Task rows are delegate_agent; they share the same readiness gate and
  // boundary copy, so excluding them mislabels probe/execute errors as cancels.
  return (
    action.actionType === 'delegate_openclaw' ||
    action.actionType === 'delegate_agent'
  );
}

function actionResultPayload(action: RuntimeAction): Record<string, unknown> {
  const payload = action.result?.payload;
  return payload && typeof payload === 'object' && !Array.isArray(payload)
    ? (payload as Record<string, unknown>)
    : {};
}

function openClawResultStatus(action: RuntimeAction): string {
  return typeof action.result?.status === 'string' ? action.result.status : '';
}

function openClawVerificationReceipt(
  action: RuntimeAction,
): OpenClawVerificationReceipt | null {
  if (!isOpenClawDelegationAction(action) || !action.result) return null;

  const payload = actionResultPayload(action);
  if (payload.artifactValidation === 'missing_verifiable_artifact') {
    return {
      tone: 'danger',
      title: 'OpenClaw 返回缺少可验证 artifact',
      body:
        '这次委派返回了最终文本或字段，但缺少来源系统、对象、验证方式和字段/操作等证据锚点；Memory Service 不会把它写回 action_result。',
      facts: [
        `状态：${delegationOutcomeLabel(action)}`,
        '写回：已阻断',
        '恢复：改写任务或补齐 artifact 后重试',
      ],
    };
  }

  if (payload.fallback === 'plain_text_summary_without_verifiable_artifact') {
    const rawSummary =
      typeof payload.rawSummary === 'string' && payload.rawSummary.trim()
        ? `摘要：${compactReceiptText(payload.rawSummary, 72)}`
        : '';
    return {
      tone: 'warning',
      title: '只返回文本，未形成可验证外部证据',
      body:
        'OpenClaw 返回了纯文本摘要；页面保留 transcript 和原始摘要供人工核对，但不会把这段文本当作已验证外部事实沉淀。',
      facts: [
        `状态：${openClawResultStatus(action) || 'error'}`,
        '写回：未写入 action_result',
        '恢复：要求 OpenClaw 返回 JSON artifact',
        rawSummary,
      ].filter(Boolean),
    };
  }

  return null;
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
  const artifacts = allDelegationArtifacts(action);
  const total = artifacts.length;
  if (total === 0) return '无 artifact';
  const verified = artifacts.filter((artifact) => isVerifiableDelegationArtifact(action, artifact)).length;
  if (verified === total) return `可验证 artifact ${total} 条`;
  if (verified === 0) return `未验证 artifact ${total} 条`;
  return `可验证 artifact ${verified}/${total} 条`;
}

function delegationArtifactKey(artifact: DelegationArtifactView): string {
  return [artifact.kind, artifact.title, artifact.content].filter(Boolean).join(':').slice(0, 120);
}

function artifactTitle(artifact: DelegationArtifactView): string {
  return artifact.title || artifact.kind || '外部证据';
}

function allDelegationArtifacts(action: RuntimeAction): DelegationArtifactView[] {
  const raw = action.result?.artifacts;
  if (!Array.isArray(raw)) return [];
  return raw.map(coerceDelegationArtifact).filter((item): item is DelegationArtifactView => Boolean(item));
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

function artifactSourceValue(action: RuntimeAction, artifact: DelegationArtifactView): string {
  return (
    metadataString(artifact.metadata, ['sourceSystem', 'targetSystem', 'system']) ||
    openClawTargetSystem(action)
  );
}

function artifactEntityValue(artifact: DelegationArtifactView): string {
  return metadataString(artifact.metadata, [
    'entityId',
    'entityKey',
    'recordId',
    'resourceId',
    'ticketId',
    'ticketKey',
    'issueKey',
  ]);
}

function artifactVerificationValue(artifact: DelegationArtifactView): string {
  return artifact.metadata?.verified === true
    ? 'verified'
    : metadataString(artifact.metadata, ['verification', 'verificationMethod']);
}

function artifactFieldOrOperationValue(artifact: DelegationArtifactView): string {
  const fields = metadataStringList(artifact.metadata, ['observedFields', 'changedFields']);
  if (fields.length > 0) return fields.join(', ');
  return (
    metadataString(artifact.metadata, ['operation', 'operationType', 'action']) ||
    metadataString(artifact.metadata, ['observedAt', 'verifiedAt', 'updatedAt'])
  );
}

function isVerifiableDelegationArtifact(action: RuntimeAction, artifact: DelegationArtifactView): boolean {
  const hasBody = Boolean(artifact.content || artifact.title);
  return Boolean(
    hasBody &&
      artifactSourceValue(action, artifact) &&
      artifactEntityValue(artifact) &&
      artifactVerificationValue(artifact) &&
      artifactFieldOrOperationValue(artifact),
  );
}

function artifactSourceLabel(artifact: DelegationArtifactView): string {
  const source = metadataString(artifact.metadata, ['sourceSystem', 'targetSystem', 'system']);
  return source ? `来源 ${source}` : '';
}

function artifactEntityLabel(artifact: DelegationArtifactView): string {
  const entity = artifactEntityValue(artifact);
  return entity ? `对象 ${entity}` : '';
}

function artifactVerificationLabel(artifact: DelegationArtifactView): string {
  const verification = artifactVerificationValue(artifact);
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

.readiness-strip {
  margin-bottom: 1rem;
  padding: 0.95rem 1rem;
  border-radius: 0.5rem;
  border: 1px solid rgba(56, 189, 248, 0.24);
  border-left-width: 4px;
  background: rgba(8, 47, 73, 0.22);
  color: #dbeafe;
}

.readiness-strip.blocked {
  border-color: rgba(248, 113, 113, 0.32);
  background: rgba(127, 29, 29, 0.18);
  color: #fecaca;
}

.readiness-strip.attention {
  border-color: rgba(245, 158, 11, 0.3);
  background: rgba(120, 53, 15, 0.16);
  color: #fde68a;
}

.readiness-strip.ready {
  border-color: rgba(74, 222, 128, 0.28);
  background: rgba(20, 83, 45, 0.14);
  color: #dcfce7;
}

.readiness-strip-head,
.action-readiness-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.8rem;
}

.readiness-strip-head strong,
.action-readiness-head strong {
  display: block;
  color: #f8fafc;
}

.readiness-strip-state,
.action-readiness-state {
  flex: 0 0 auto;
  color: currentColor;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0;
}

.readiness-strip p,
.action-readiness-panel p {
  margin: 0.48rem 0 0;
  line-height: 1.55;
}

.readiness-strip small,
.action-readiness-panel small {
  display: block;
  margin-top: 0.62rem;
  color: #cbd5e1;
  line-height: 1.5;
}

.readiness-strip-facts,
.action-readiness-facts {
  display: flex;
  flex-wrap: wrap;
  gap: 0.42rem;
  margin-top: 0.65rem;
}

.readiness-strip-facts span,
.action-readiness-facts span {
  max-width: 100%;
  padding: 0.2rem 0.48rem;
  border-radius: 0.25rem;
  background: rgba(15, 23, 42, 0.42);
  color: #e2e8f0;
  font-size: 0.73rem;
  overflow-wrap: anywhere;
}

.queue-locator-receipt {
  margin-bottom: 1rem;
  padding: 0.86rem 0.96rem;
  border-radius: 0.8rem;
  background: rgba(8, 47, 73, 0.22);
  border: 1px solid rgba(56, 189, 248, 0.24);
  color: #dbeafe;
  line-height: 1.5;
}

.queue-locator-receipt.warning {
  background: rgba(120, 53, 15, 0.16);
  border-color: rgba(245, 158, 11, 0.3);
  color: #fde68a;
}

.queue-locator-receipt.danger {
  background: rgba(127, 29, 29, 0.18);
  border-color: rgba(248, 113, 113, 0.32);
  color: #fecaca;
}

.queue-locator-receipt strong {
  display: block;
  color: #f8fafc;
}

.queue-locator-receipt p {
  margin: 0.45rem 0 0;
}

.locator-facts {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  margin-top: 0.65rem;
}

.locator-facts span {
  border-radius: 999px;
  padding: 0.18rem 0.5rem;
  background: rgba(15, 23, 42, 0.52);
  border: 1px solid rgba(148, 163, 184, 0.15);
  color: #cbd5e1;
  font-size: 0.72rem;
}

.queue-attention-receipt {
  margin-bottom: 1rem;
  padding: 0.9rem 1rem;
  border-radius: 0.8rem;
  background: rgba(15, 23, 42, 0.62);
  border: 1px solid rgba(245, 158, 11, 0.26);
  color: #fde68a;
  line-height: 1.5;
}

.queue-attention-receipt.danger {
  background: rgba(127, 29, 29, 0.18);
  border-color: rgba(248, 113, 113, 0.3);
  color: #fecaca;
}

.attention-receipt-head {
  display: flex;
  justify-content: space-between;
  gap: 0.9rem;
  align-items: flex-start;
}

.attention-receipt-head strong {
  display: block;
  color: #f8fafc;
}

.attention-total {
  flex: 0 0 auto;
  padding: 0.18rem 0.58rem;
  border-radius: 999px;
  background: rgba(245, 158, 11, 0.14);
  border: 1px solid rgba(245, 158, 11, 0.24);
  color: #fef3c7;
  font-size: 0.76rem;
}

.queue-attention-receipt.danger .attention-total {
  background: rgba(248, 113, 113, 0.12);
  border-color: rgba(248, 113, 113, 0.24);
  color: #fecaca;
}

.queue-attention-receipt p {
  margin: 0.5rem 0 0;
}

.attention-breakdown-rows {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.55rem;
  margin-top: 0.8rem;
}

.attention-breakdown-row {
  min-width: 0;
  padding: 0.68rem 0.75rem;
  border-radius: 0.75rem;
  background: rgba(15, 23, 42, 0.42);
  border: 1px solid rgba(245, 158, 11, 0.16);
}

.queue-attention-receipt.danger .attention-breakdown-row {
  border-color: rgba(248, 113, 113, 0.16);
}

.attention-breakdown-row span,
.attention-breakdown-row small {
  display: block;
  color: #fef3c7;
  font-size: 0.73rem;
  line-height: 1.35;
}

.queue-attention-receipt.danger .attention-breakdown-row span,
.queue-attention-receipt.danger .attention-breakdown-row small {
  color: #fecaca;
}

.attention-breakdown-row strong {
  display: block;
  margin: 0.2rem 0;
  color: #f8fafc;
  font-size: 1.25rem;
  line-height: 1.1;
}

.attention-boundary-facts {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  margin-top: 0.75rem;
}

.attention-boundary-facts span {
  padding: 0.18rem 0.52rem;
  border-radius: 999px;
  background: rgba(245, 158, 11, 0.12);
  color: #fef3c7;
  font-size: 0.73rem;
}

.queue-attention-receipt.danger .attention-boundary-facts span {
  background: rgba(248, 113, 113, 0.11);
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

.tiny-btn.readiness-probe-btn {
  background: rgba(13, 148, 136, 0.18);
  border: 1px solid rgba(45, 212, 191, 0.3);
  color: #99f6e4;
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

.action-readiness-panel {
  margin-top: 0.85rem;
  padding: 0.85rem 0.95rem;
  border-radius: 0.5rem;
  border: 1px solid rgba(56, 189, 248, 0.22);
  border-left-width: 4px;
  background: rgba(8, 47, 73, 0.18);
  color: #dbeafe;
}

.action-readiness-panel.warning {
  border-color: rgba(245, 158, 11, 0.3);
  background: rgba(120, 53, 15, 0.15);
  color: #fde68a;
}

.action-readiness-panel.danger {
  border-color: rgba(248, 113, 113, 0.32);
  background: rgba(127, 29, 29, 0.18);
  color: #fecaca;
}

.action-readiness-panel.success {
  border-color: rgba(74, 222, 128, 0.28);
  background: rgba(20, 83, 45, 0.14);
  color: #dcfce7;
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

.delegation-verification-panel {
  margin-top: 0.85rem;
  padding: 0.85rem 0.95rem;
  border-radius: 0.8rem;
  line-height: 1.55;
}

.delegation-verification-panel.warning {
  background: rgba(120, 53, 15, 0.16);
  border: 1px solid rgba(245, 158, 11, 0.26);
  color: #fde68a;
}

.delegation-verification-panel.danger {
  background: rgba(127, 29, 29, 0.18);
  border: 1px solid rgba(248, 113, 113, 0.28);
  color: #fecaca;
}

.delegation-verification-panel strong {
  display: block;
  color: #f8fafc;
}

.delegation-verification-panel p {
  margin: 0.45rem 0 0;
}

.delegation-verification-facts {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  margin-top: 0.65rem;
}

.delegation-verification-facts span {
  padding: 0.18rem 0.5rem;
  border-radius: 999px;
  font-size: 0.74rem;
}

.delegation-verification-panel.warning .delegation-verification-facts span {
  background: rgba(245, 158, 11, 0.14);
  color: #fef3c7;
}

.delegation-verification-panel.danger .delegation-verification-facts span {
  background: rgba(248, 113, 113, 0.12);
  color: #fecaca;
}

.delegation-recovery-panel {
  margin-top: 0.85rem;
  padding: 0.85rem 0.95rem;
  border-radius: 0.8rem;
  background: rgba(8, 47, 73, 0.24);
  border: 1px solid rgba(56, 189, 248, 0.22);
  color: #dbeafe;
  line-height: 1.55;
}

.delegation-recovery-panel.warning {
  background: rgba(120, 53, 15, 0.16);
  border-color: rgba(245, 158, 11, 0.26);
  color: #fde68a;
}

.delegation-recovery-panel.danger {
  background: rgba(127, 29, 29, 0.18);
  border-color: rgba(248, 113, 113, 0.28);
  color: #fecaca;
}

.delegation-recovery-panel strong {
  display: block;
  color: #f8fafc;
}

.delegation-recovery-panel p {
  margin: 0.45rem 0 0;
}

.delegation-recovery-facts,
.delegation-recovery-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  margin-top: 0.65rem;
}

.delegation-recovery-facts span {
  padding: 0.18rem 0.5rem;
  border-radius: 999px;
  background: rgba(14, 165, 233, 0.1);
  color: #bae6fd;
  font-size: 0.74rem;
}

.delegation-recovery-panel.warning .delegation-recovery-facts span {
  background: rgba(245, 158, 11, 0.14);
  color: #fef3c7;
}

.delegation-recovery-panel.danger .delegation-recovery-facts span {
  background: rgba(248, 113, 113, 0.12);
  color: #fecaca;
}

.recovery-action-link {
  min-width: min(100%, 18rem);
  flex: 1 1 18rem;
  padding: 0.6rem 0.72rem;
  border-radius: 0.75rem;
  background: rgba(15, 23, 42, 0.5);
  border: 1px solid rgba(148, 163, 184, 0.16);
  color: #dbeafe;
  text-decoration: none;
}

.recovery-action-link:hover {
  border-color: rgba(125, 211, 252, 0.36);
  background: rgba(14, 165, 233, 0.14);
}

.recovery-action-link span,
.recovery-action-link small {
  display: block;
}

.recovery-action-link span {
  color: #f8fafc;
  font-weight: 600;
}

.recovery-action-link small {
  margin-top: 0.2rem;
  color: #cbd5e1;
  line-height: 1.35;
}

.delegation-preflight-panel {
  margin-top: 0.85rem;
  padding: 0.85rem 0.95rem;
  border-radius: 0.8rem;
  background: rgba(8, 47, 73, 0.24);
  border: 1px solid rgba(56, 189, 248, 0.22);
  color: #dbeafe;
}

.delegation-preflight-panel.warning {
  background: rgba(120, 53, 15, 0.16);
  border-color: rgba(245, 158, 11, 0.26);
  color: #fde68a;
}

.delegation-preflight-panel.danger {
  background: rgba(127, 29, 29, 0.18);
  border-color: rgba(248, 113, 113, 0.28);
  color: #fecaca;
}

.delegation-preflight-panel.success {
  background: rgba(20, 83, 45, 0.14);
  border-color: rgba(74, 222, 128, 0.22);
  color: #dcfce7;
}

.delegation-preflight-head strong {
  display: block;
  color: #f8fafc;
}

.delegation-preflight-panel p {
  margin: 0.45rem 0 0;
  color: inherit;
  line-height: 1.55;
}

.delegation-preflight-facts {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  margin-top: 0.65rem;
}

.delegation-preflight-facts span {
  padding: 0.18rem 0.5rem;
  border-radius: 999px;
  background: rgba(14, 165, 233, 0.1);
  color: #bae6fd;
  font-size: 0.74rem;
}

.delegation-preflight-panel.warning .delegation-preflight-facts span {
  background: rgba(245, 158, 11, 0.14);
  color: #fef3c7;
}

.delegation-preflight-panel.danger .delegation-preflight-facts span {
  background: rgba(248, 113, 113, 0.12);
  color: #fecaca;
}

.delegation-preflight-panel.success .delegation-preflight-facts span {
  background: rgba(34, 197, 94, 0.12);
  color: #bbf7d0;
}

.approval-panel {
  margin-top: 0.85rem;
  padding: 0.85rem 0.95rem;
  border-radius: 0.8rem;
  background: rgba(120, 53, 15, 0.18);
  border: 1px solid rgba(245, 158, 11, 0.28);
  color: #fde68a;
}

.approval-panel strong {
  display: block;
  color: #fef3c7;
}

.approval-panel p {
  margin: 0.45rem 0 0;
  color: #fde68a;
  line-height: 1.55;
}

.approval-facts {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  margin-top: 0.65rem;
}

.approval-facts span {
  padding: 0.18rem 0.5rem;
  border-radius: 999px;
  background: rgba(245, 158, 11, 0.14);
  color: #fef3c7;
  font-size: 0.74rem;
}

.action-scope-panel {
  margin-top: 0.85rem;
  padding: 0.85rem 0.95rem;
  border-radius: 0.8rem;
  background: rgba(8, 47, 73, 0.24);
  border: 1px solid rgba(56, 189, 248, 0.22);
  color: #dbeafe;
  line-height: 1.55;
}

.action-scope-panel.warning {
  background: rgba(120, 53, 15, 0.16);
  border-color: rgba(245, 158, 11, 0.26);
  color: #fde68a;
}

.action-scope-panel.danger {
  background: rgba(127, 29, 29, 0.18);
  border-color: rgba(248, 113, 113, 0.28);
  color: #fecaca;
}

.action-scope-panel.success {
  background: rgba(20, 83, 45, 0.14);
  border-color: rgba(74, 222, 128, 0.22);
  color: #dcfce7;
}

.action-scope-panel strong {
  display: block;
  color: #f8fafc;
}

.action-scope-panel p {
  margin: 0.45rem 0 0;
}

.action-scope-facts {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  margin-top: 0.65rem;
}

.action-scope-facts span {
  padding: 0.18rem 0.5rem;
  border-radius: 999px;
  background: rgba(14, 165, 233, 0.1);
  color: #bae6fd;
  font-size: 0.74rem;
}

.action-scope-panel.warning .action-scope-facts span {
  background: rgba(245, 158, 11, 0.14);
  color: #fef3c7;
}

.action-scope-panel.danger .action-scope-facts span {
  background: rgba(248, 113, 113, 0.12);
  color: #fecaca;
}

.action-scope-panel.success .action-scope-facts span {
  background: rgba(34, 197, 94, 0.12);
  color: #bbf7d0;
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

.action-operation-receipt {
  margin-top: 0.8rem;
  padding: 0.82rem 0.92rem;
  border-radius: 0.8rem;
  background: rgba(8, 47, 73, 0.24);
  border: 1px solid rgba(56, 189, 248, 0.22);
  color: #dbeafe;
  line-height: 1.55;
}

.action-operation-receipt.success {
  background: rgba(20, 83, 45, 0.14);
  border-color: rgba(74, 222, 128, 0.22);
  color: #dcfce7;
}

.action-operation-receipt.warning {
  background: rgba(120, 53, 15, 0.16);
  border-color: rgba(245, 158, 11, 0.28);
  color: #fde68a;
}

.action-operation-receipt strong {
  display: block;
  color: #f8fafc;
}

.action-operation-receipt p {
  margin: 0.45rem 0 0;
}

.action-operation-facts {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  margin-top: 0.65rem;
}

.action-operation-facts span {
  padding: 0.18rem 0.5rem;
  border-radius: 999px;
  background: rgba(14, 165, 233, 0.1);
  color: #bae6fd;
  font-size: 0.74rem;
}

.action-operation-receipt.success .action-operation-facts span {
  background: rgba(34, 197, 94, 0.12);
  color: #bbf7d0;
}

.action-operation-receipt.warning .action-operation-facts span {
  background: rgba(245, 158, 11, 0.14);
  color: #fef3c7;
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

.empty-filter-receipt {
  max-width: 42rem;
  margin: 1rem auto;
  padding: 0.85rem 0.95rem;
  text-align: left;
  border-radius: 0.8rem;
  background: rgba(15, 23, 42, 0.58);
  border: 1px solid rgba(56, 189, 248, 0.22);
  color: #dbeafe;
  line-height: 1.5;
}

.empty-filter-receipt strong {
  display: block;
  color: #f8fafc;
}

.empty-filter-receipt p {
  margin: 0.45rem 0 0;
}

.empty-filter-facts {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  margin-top: 0.65rem;
}

.empty-filter-facts span {
  border-radius: 999px;
  padding: 0.18rem 0.5rem;
  background: rgba(2, 6, 23, 0.48);
  border: 1px solid rgba(148, 163, 184, 0.16);
  color: #cbd5e1;
  font-size: 0.72rem;
}

.empty-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.65rem;
}

.empty-actions .tiny-btn {
  text-decoration: none;
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

  .attention-breakdown-rows {
    grid-template-columns: repeat(2, minmax(0, 1fr));
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
  .readiness-strip-head,
  .action-readiness-head {
    flex-direction: column;
  }

  .queue-overview,
  .attention-breakdown-rows {
    grid-template-columns: 1fr;
  }

  .attention-receipt-head {
    flex-direction: column;
  }
}
</style>
