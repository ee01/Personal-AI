<template>
  <div class="action-queue-page">
    <div class="page-header">
      <div>
        <h2>动作队列</h2>
        <p>{{ pageDescription }}</p>
      </div>

      <div class="filters">
        <select v-model="queueStatus" class="filter-select" @change="loadActions">
          <option value="all">全部状态</option>
          <option value="queued">queued</option>
          <option value="running">running</option>
          <option value="failed">failed</option>
          <option value="succeeded">succeeded</option>
          <option value="cancelled">cancelled</option>
          <option value="dead_letter">dead_letter</option>
        </select>
        <select v-model="executionMode" class="filter-select" @change="loadActions">
          <option value="">全部模式</option>
          <option value="manual">manual</option>
          <option value="auto">auto</option>
        </select>
        <button class="refresh-btn" @click="loadActions">刷新</button>
      </div>
    </div>

    <div v-if="loading" class="loading-container">
      <div class="loading-spinner"></div>
      <p>加载动作队列中...</p>
    </div>

    <div v-else-if="actions.length === 0" class="empty-state">
      <p>没有动作记录。</p>
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
            <span class="badge muted">{{ action.executionMode }}</span>
            <span class="badge muted">P{{ action.priority }}</span>
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
        <div v-if="actionResultTranscriptPath(action)" class="result-path">
          transcript: {{ actionResultTranscriptPath(action) }}
        </div>

        <div v-if="action.lastError" class="error-box">
          {{ action.lastError }}
        </div>

        <div class="button-row">
          <button
            v-if="action.queueStatus === 'queued' || action.queueStatus === 'failed'"
            class="tiny-btn"
            @click="executeAction(action.id)"
          >执行</button>
          <button
            v-if="action.queueStatus === 'failed'"
            class="tiny-btn"
            @click="retryAction(action.id)"
          >重试入队</button>
          <button
            v-if="action.queueStatus === 'queued'"
            class="tiny-btn danger"
            @click="cancelAction(action.id)"
          >取消</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import {
  getMemoryServiceClient,
  type OutreachSession,
  type RuntimeAction,
} from '../../services/MemoryServiceClient';

const client = getMemoryServiceClient();
const route = useRoute();
const loading = ref(true);
const actions = ref<RuntimeAction[]>([]);
const outreachByActionId = ref<Record<string, OutreachSession>>({});
const queueStatus = ref<'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled' | 'dead_letter' | 'all'>('all');
const executionMode = ref<'manual' | 'auto' | ''>('');
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

onMounted(() => {
  void loadActions();
});

watch(
  () => route.fullPath,
  () => {
    void loadActions();
  },
);

async function loadActions() {
  loading.value = true;
  try {
    const actionId = typeof route.query.actionId === 'string' ? route.query.actionId : '';
    const response = await client.getActions({
      queueStatus: queueStatus.value,
      executionMode: executionMode.value || undefined,
      sourceKind: sourceKindFilter.value || undefined,
      sourceRefId: sourceRefIdFilter.value || undefined,
      limit: 50,
    });
    const filteredItems = response.items.filter((item) => {
      if (actionId && item.id !== actionId) return false;
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
    await hydrateOutreachSessions(filteredItems);
  } catch (error) {
    console.error('Failed to load actions:', error);
    actions.value = [];
    outreachByActionId.value = {};
  } finally {
    loading.value = false;
  }
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
  await client.executeAction(id);
  await loadActions();
}

async function retryAction(id: string) {
  await client.retryAction(id);
  await loadActions();
}

async function cancelAction(id: string) {
  await client.cancelAction(id, 'Cancelled from action queue UI');
  await loadActions();
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
  gap: 0.55rem;
}

.card-meta {
  margin-top: 0.9rem;
  color: #94a3b8;
  font-size: 0.83rem;
}

.badge {
  padding: 0.18rem 0.58rem;
  border-radius: 999px;
  font-size: 0.75rem;
  background: rgba(59, 130, 246, 0.16);
  color: #93c5fd;
}

.badge.muted {
  background: rgba(148, 163, 184, 0.16);
  color: #cbd5e1;
}

.badge.queued {
  background: rgba(14, 165, 233, 0.16);
  color: #7dd3fc;
}

.badge.failed {
  background: rgba(239, 68, 68, 0.16);
  color: #fca5a5;
}

.badge.running {
  background: rgba(245, 158, 11, 0.16);
  color: #fcd34d;
}

.badge.succeeded {
  background: rgba(34, 197, 94, 0.16);
  color: #86efac;
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

.result-path {
  margin-top: 0.5rem;
  font-size: 0.8rem;
  color: #7dd3fc;
  word-break: break-all;
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

.loading-spinner {
  width: 2.3rem;
  height: 2.3rem;
  border: 2px solid rgba(56, 189, 248, 0.18);
  border-top: 2px solid #38bdf8;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 1rem;
}

@media (max-width: 900px) {
  .page-header,
  .card-head {
    flex-direction: column;
  }

  .filters {
    flex-wrap: wrap;
  }
}
</style>
