<template>
  <div class="reflection-detail-page">
    <div class="page-head">
      <button class="back-btn" @click="router.push('/reflection-threads')">← 返回线程列表</button>
      <div class="action-bar">
        <button class="primary-btn" :disabled="busy" @click="revisitThread">立即自我反思</button>
        <button v-if="detail?.thread.status === 'active'" class="ghost-btn" :disabled="busy" @click="pauseThread">暂停</button>
        <button v-if="detail?.thread.status !== 'active'" class="ghost-btn" :disabled="busy" @click="resumeThread">恢复</button>
        <button class="danger-btn" :disabled="busy" @click="closeThread">关闭</button>
      </div>
    </div>

    <div v-if="loading" class="loading-container">
      <div class="loading-spinner"></div>
      <p>加载自我反思详情中...</p>
    </div>

    <div v-else-if="!detail" class="empty-state">
      <p>未找到自我反思线程。</p>
    </div>

    <div v-else class="detail-layout">
      <section class="hero-card">
        <div class="hero-top">
          <div>
            <h2>{{ displayThreadTitle(detail.thread.title) }}</h2>
            <p>{{ detail.thread.latestSummary || '暂无总结。' }}</p>
          </div>
          <div class="hero-metrics">
            <span class="metric-pill">状态 {{ statusLabel(detail.thread.status) }}</span>
            <span class="metric-pill">优先级 P{{ detail.thread.priority }}</span>
            <span class="metric-pill">显著性 {{ detail.thread.salience.toFixed(2) }}</span>
          </div>
        </div>

        <div class="hero-meta">
          <span>Topic: {{ detail.thread.topicKey }}</span>
          <span>运行 {{ detail.thread.reflectionCount }}</span>
          <span v-if="detail.thread.lastReflectedAt">最近 {{ relativeTime(detail.thread.lastReflectedAt) }}</span>
          <span v-if="detail.thread.nextReflectionAt">下次 {{ relativeTime(detail.thread.nextReflectionAt) }}</span>
        </div>

        <div v-if="detail.thread.currentHypothesis" class="hypothesis-box">
          <div class="box-title">当前假设</div>
          <p>{{ detail.thread.currentHypothesis }}</p>
        </div>
      </section>

      <section class="detail-grid">
        <div class="panel">
          <div class="panel-title">开放问题</div>
          <ul v-if="detail.thread.openQuestions.length > 0" class="bullet-list">
            <li v-for="question in detail.thread.openQuestions" :key="question">{{ question }}</li>
          </ul>
          <div v-else class="muted">暂无开放问题</div>
        </div>

        <div class="panel">
          <div class="panel-title">梦境回放</div>
          <ul v-if="detail.dreamRuns.length > 0" class="bullet-list">
            <li v-for="dream in detail.dreamRuns" :key="dream.id">
              <div class="inline-head">{{ relativeTime(dream.createdAt) }}</div>
              <div>{{ dream.summary || 'Dream replay generated.' }}</div>
            </li>
          </ul>
          <div v-else class="muted">暂无关联梦境回放</div>
        </div>
      </section>

      <section class="panel">
        <div class="panel-title">动作队列</div>
        <div v-if="detail.actions.length === 0" class="muted">暂无动作</div>
        <div v-else class="action-list">
          <div v-for="action in detail.actions" :key="action.id" class="action-card">
            <div class="inline-head">
              <span>{{ action.title }}</span>
              <span class="queue-badge" :class="action.queueStatus">{{ action.queueStatus }}</span>
            </div>
            <p class="action-desc">{{ action.description || displayActionType(action.actionType) }}</p>
            <div class="action-meta">
              <span>{{ displayActionType(action.actionType) }}</span>
              <span>{{ action.executionMode }}</span>
              <span>P{{ action.priority }}</span>
            </div>
            <div class="action-buttons">
              <button
                v-if="action.queueStatus === 'queued' || action.queueStatus === 'failed'"
                class="tiny-btn"
                @click="executeAction(action.id)"
              >执行</button>
              <button
                v-if="action.queueStatus === 'failed'"
                class="tiny-btn"
                @click="retryAction(action.id)"
              >重试</button>
              <button
                v-if="action.queueStatus === 'queued'"
                class="tiny-btn danger"
                @click="cancelAction(action.id)"
              >取消</button>
            </div>
          </div>
        </div>
      </section>

      <section class="panel">
        <div class="panel-title">外部委派结果</div>
        <div v-if="(detail.actionResults?.length ?? 0) === 0" class="muted">暂无外部委派结果</div>
        <div v-else class="run-list">
          <div
            v-for="result in detail.actionResults ?? []"
            :key="result.id"
            class="run-card"
          >
            <div class="inline-head">
              <span>{{ result.resultType }}</span>
              <span class="muted small">{{ relativeTime(result.createdAt) }}</span>
            </div>
            <p class="run-summary">{{ result.summary }}</p>

            <div v-if="result.payload && Object.keys(result.payload).length > 0" class="sub-block">
              <div class="sub-title">关键结果</div>
              <pre class="json-block">{{ formatJson(result.payload) }}</pre>
            </div>

            <div v-if="result.transcriptPath" class="sub-block">
              <div class="inline-head">
                <div class="sub-title">Transcript</div>
                <button
                  class="tiny-btn"
                  @click="toggleTranscript(result.id, result.transcriptPath)"
                >{{ transcriptVisible[result.id] ? '收起' : '展开' }}</button>
              </div>
              <div class="muted small">{{ result.transcriptPath }}</div>
              <div v-if="transcriptVisible[result.id]" class="transcript-block">
                <div v-if="transcriptLoading[result.id]" class="muted">正在加载 transcript...</div>
                <pre v-else class="json-block">{{ transcriptContent[result.id] || '未能读取 transcript 内容。' }}</pre>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="panel">
        <div class="panel-title">研究补充证据</div>
        <div v-if="researchEvidence.length === 0" class="muted">暂无研究补充证据</div>
        <div v-else class="evidence-list">
          <div v-for="link in researchEvidence" :key="link.id" class="evidence-item">
            <div class="inline-head">
              <span>{{ link.previewTitle || link.sourceKind }}</span>
              <span class="muted small">{{ link.sourceKind }}/{{ link.role }}</span>
            </div>
            <p>{{ link.preview || link.sourceId }}</p>
          </div>
        </div>
      </section>

      <section class="panel">
        <div class="panel-title">证据</div>
        <div v-if="detail.links.length === 0" class="muted">暂无证据链路</div>
        <div v-else class="evidence-list">
          <div v-for="link in detail.links" :key="link.id" class="evidence-item">
            <div class="inline-head">
              <span>{{ link.previewTitle || link.sourceKind }}</span>
              <span class="muted small">{{ link.sourceKind }}/{{ link.role }}</span>
            </div>
            <p>{{ link.preview || link.sourceId }}</p>
          </div>
        </div>
      </section>

      <section class="panel">
        <div class="panel-title">运行历史</div>
        <div v-if="detail.runs.length === 0" class="muted">暂无运行记录</div>
        <div v-else class="run-list">
          <div v-for="run in detail.runs" :key="run.id" class="run-card">
            <div class="inline-head">
              <span>{{ run.runType }} / {{ run.triggerType || 'unknown' }}</span>
              <span class="muted small">{{ relativeTime(run.createdAt) }}</span>
            </div>
            <p class="run-summary">{{ run.summary }}</p>

            <div v-if="run.discoveries.length > 0" class="sub-block">
              <div class="sub-title">发现</div>
              <ul class="bullet-list compact">
                <li v-for="item in run.discoveries" :key="item">{{ item }}</li>
              </ul>
            </div>

            <div v-if="run.openQuestions.length > 0" class="sub-block">
              <div class="sub-title">开放问题</div>
              <ul class="bullet-list compact">
                <li v-for="item in run.openQuestions" :key="item">{{ item }}</li>
              </ul>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  getMemoryServiceClient,
  type ReflectionThreadDetailResponse,
} from '../../services/MemoryServiceClient';

const client = getMemoryServiceClient();
const route = useRoute();
const router = useRouter();
const loading = ref(true);
const busy = ref(false);
const detail = ref<ReflectionThreadDetailResponse | null>(null);
const researchEvidence = computed(() => detail.value?.links.filter(link => link.role === 'research') ?? []);
const transcriptVisible = ref<Record<string, boolean>>({});
const transcriptLoading = ref<Record<string, boolean>>({});
const transcriptContent = ref<Record<string, string | null>>({});

onMounted(() => {
  void loadDetail();
});

watch(
  () => route.params.id,
  () => {
    void loadDetail();
  },
);

async function loadDetail() {
  const threadId = route.params.id as string;
  if (!threadId) return;
  loading.value = true;
  try {
    detail.value = await client.getReflectionThread(threadId);
  } catch (error) {
    console.error('Failed to load reflection detail:', error);
    detail.value = null;
  } finally {
    loading.value = false;
  }
}

async function revisitThread() {
  if (!detail.value) return;
  busy.value = true;
  try {
    await client.revisitReflectionThread(detail.value.thread.id, true);
    await loadDetail();
  } finally {
    busy.value = false;
  }
}

async function pauseThread() {
  if (!detail.value) return;
  busy.value = true;
  try {
    await client.pauseReflectionThread(detail.value.thread.id, 'Paused from UI');
    await loadDetail();
  } finally {
    busy.value = false;
  }
}

async function resumeThread() {
  if (!detail.value) return;
  busy.value = true;
  try {
    await client.resumeReflectionThread(detail.value.thread.id);
    await loadDetail();
  } finally {
    busy.value = false;
  }
}

async function closeThread() {
  if (!detail.value) return;
  if (!window.confirm('确认关闭这个反思线程吗？')) return;
  busy.value = true;
  try {
    await client.closeReflectionThread(detail.value.thread.id, 'Closed from UI');
    await loadDetail();
  } finally {
    busy.value = false;
  }
}

async function executeAction(id: string) {
  await client.executeAction(id);
  await loadDetail();
}

async function retryAction(id: string) {
  await client.retryAction(id);
  await loadDetail();
}

async function cancelAction(id: string) {
  await client.cancelAction(id, 'Cancelled from UI');
  await loadDetail();
}

async function toggleTranscript(resultId: string, transcriptPath?: string) {
  if (!transcriptPath) return;
  const nextVisible = !transcriptVisible.value[resultId];
  transcriptVisible.value = {
    ...transcriptVisible.value,
    [resultId]: nextVisible,
  };
  if (!nextVisible || transcriptContent.value[resultId] !== undefined) {
    return;
  }

  const filename = transcriptFilename(transcriptPath);
  if (!filename) {
    transcriptContent.value = {
      ...transcriptContent.value,
      [resultId]: '暂不支持读取该 transcript 路径。',
    };
    return;
  }

  transcriptLoading.value = {
    ...transcriptLoading.value,
    [resultId]: true,
  };
  try {
    const content = await client.readUserFile('delegations', filename);
    transcriptContent.value = {
      ...transcriptContent.value,
      [resultId]: content,
    };
  } finally {
    transcriptLoading.value = {
      ...transcriptLoading.value,
      [resultId]: false,
    };
  }
}

function transcriptFilename(transcriptPath: string): string | null {
  if (!transcriptPath.startsWith('delegations/')) {
    return null;
  }
  return transcriptPath.slice('delegations/'.length);
}

function formatJson(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function statusLabel(status: string) {
  if (status === 'active') return '进行中';
  if (status === 'paused') return '已暂停';
  return '已关闭';
}

function displayActionType(actionType: string) {
  if (actionType === 'delegate_openclaw') return 'delegate_openclaw';
  if (actionType === 'query_external_tool') return 'query_external_tool（兼容模式）';
  return actionType;
}

function displayThreadTitle(title: string) {
  return title.replace(/^思考反思:/, '自我反思:');
}

function relativeTime(ts: number) {
  const diff = Date.now() - ts * 1000;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes}分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  return `${days}天前`;
}
</script>

<style scoped>
.reflection-detail-page {
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
.danger-btn,
.tiny-btn {
  border: none;
  border-radius: 0.8rem;
  padding: 0.7rem 1rem;
  cursor: pointer;
}

.back-btn,
.ghost-btn,
.tiny-btn {
  background: rgba(30, 41, 59, 0.8);
  color: #e2e8f0;
}

.primary-btn {
  background: linear-gradient(135deg, #0284c7, #2563eb);
  color: white;
}

.danger-btn,
.tiny-btn.danger {
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

.hero-card,
.panel {
  background: rgba(15, 23, 42, 0.72);
  border: 1px solid rgba(148, 163, 184, 0.12);
  border-radius: 1rem;
  padding: 1.25rem;
}

.hero-top,
.hero-meta,
.inline-head,
.action-meta,
.action-buttons {
  display: flex;
  gap: 0.75rem;
}

.hero-top {
  justify-content: space-between;
  align-items: flex-start;
}

.hero-top h2 {
  margin-bottom: 0.5rem;
}

.hero-top p,
.action-desc,
.run-summary,
.evidence-item p {
  color: #cbd5e1;
  line-height: 1.6;
}

.hero-metrics,
.hero-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
}

.hero-meta {
  color: #94a3b8;
  font-size: 0.83rem;
  margin-top: 0.9rem;
}

.transcript-block,
.json-block {
  margin-top: 0.6rem;
}

.json-block {
  white-space: pre-wrap;
  word-break: break-word;
  background: rgba(15, 23, 42, 0.9);
  border: 1px solid rgba(148, 163, 184, 0.12);
  border-radius: 0.8rem;
  padding: 0.85rem;
  color: #cbd5e1;
  font-size: 0.8rem;
  line-height: 1.5;
}

.metric-pill,
.queue-badge {
  padding: 0.18rem 0.6rem;
  border-radius: 999px;
  font-size: 0.75rem;
  background: rgba(59, 130, 246, 0.16);
  color: #93c5fd;
}

.queue-badge.queued {
  background: rgba(14, 165, 233, 0.16);
  color: #7dd3fc;
}

.queue-badge.failed {
  background: rgba(239, 68, 68, 0.16);
  color: #fca5a5;
}

.queue-badge.succeeded {
  background: rgba(34, 197, 94, 0.16);
  color: #86efac;
}

.queue-badge.running {
  background: rgba(245, 158, 11, 0.16);
  color: #fcd34d;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

.panel-title,
.box-title,
.sub-title {
  font-weight: 600;
  margin-bottom: 0.75rem;
}

.hypothesis-box {
  margin-top: 1rem;
  background: rgba(30, 41, 59, 0.66);
  border-radius: 0.9rem;
  padding: 1rem;
}

.muted,
.small {
  color: #94a3b8;
}

.small {
  font-size: 0.78rem;
}

.bullet-list {
  padding-left: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.bullet-list.compact {
  gap: 0.35rem;
}

.action-list,
.evidence-list,
.run-list {
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
}

.action-card,
.evidence-item,
.run-card {
  background: rgba(30, 41, 59, 0.65);
  border-radius: 0.9rem;
  padding: 1rem;
}

.inline-head {
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.45rem;
}

.action-meta,
.action-buttons {
  flex-wrap: wrap;
  color: #94a3b8;
  font-size: 0.8rem;
  margin-top: 0.55rem;
}

.sub-block + .sub-block {
  margin-top: 0.75rem;
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
  .page-head {
    flex-direction: column;
    align-items: stretch;
  }

  .action-bar {
    flex-wrap: wrap;
  }

  .detail-grid {
    grid-template-columns: 1fr;
  }
}
</style>
