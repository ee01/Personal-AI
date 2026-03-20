<template>
  <div class="outreach-detail-page">
    <div class="page-head">
      <button class="back-btn" @click="router.push('/outreach')">← 返回主动询问列表</button>
      <div class="action-bar">
        <button
          v-if="detail?.status === 'pending_approval'"
          class="primary-btn"
          :disabled="busy || editing || !canApprove(detail)"
          @click="approveSession"
        >{{ canApprove(detail) ? '批准发送' : '目标未确认，暂不能批准' }}</button>
        <button
          v-if="detail && canEdit(detail.status) && !editing"
          class="ghost-btn"
          :disabled="busy"
          @click="startEdit"
        >编辑目标与时间</button>
        <button
          v-if="detail && canRetry(detail.status)"
          class="ghost-btn"
          :disabled="busy || editing"
          @click="retrySession"
        >重试</button>
        <button
          v-if="detail && canCancel(detail.status)"
          class="danger-btn"
          :disabled="busy || editing"
          @click="cancelSession"
        >取消</button>
      </div>
    </div>

    <div v-if="loading" class="loading-container">
      <div class="loading-spinner"></div>
      <p>加载主动询问详情中...</p>
    </div>

    <div v-else-if="!detail" class="empty-state">
      <p>未找到该会话。</p>
    </div>

    <div v-else class="detail-layout">
      <section class="hero-card">
        <div class="hero-top">
          <div>
            <h2>{{ detail.renderedQuestion || '(空问题)' }}</h2>
            <p>{{ detail.renderedContext || '无上下文信息' }}</p>
          </div>
          <div class="hero-metrics">
            <span class="metric-pill" :class="statusClass(detail.status)">状态 {{ statusLabel(detail.status) }}</span>
            <span class="metric-pill">{{ originLabel(detail.originKind) }}</span>
            <span class="metric-pill">追问 {{ detail.followupCount }}/{{ detail.maxFollowup }}</span>
          </div>
        </div>

        <div class="hero-meta">
          <span>目标 {{ targetTypeLabel(detail.targetType) }} / {{ detail.targetRef }}</span>
          <span>目标状态 {{ sessionTargetResolutionLabel(detail) }}</span>
          <span v-if="detail.nextCheckAt">{{ nextTimeLabel(detail.status) }} {{ relativeTime(detail.nextCheckAt) }}</span>
          <span v-if="detail.waitUntil">等待至 {{ relativeTime(detail.waitUntil) }}</span>
          <router-link
            v-if="detail.threadId"
            :to="`/reflection-threads/${detail.threadId}`"
            class="page-link"
          >查看线程</router-link>
          <router-link
            v-if="detail.actionId"
            :to="`/actions?actionId=${encodeURIComponent(detail.actionId)}`"
            class="page-link"
          >查看动作</router-link>
          <router-link
            v-if="detail.templateId"
            :to="`/outreach?templateId=${encodeURIComponent(detail.templateId)}`"
            class="page-link"
          >查看模板会话</router-link>
        </div>
      </section>

      <section v-if="detail && canEdit(detail.status)" class="panel">
        <div class="panel-title-row">
          <div class="panel-title">发送前调整</div>
          <span class="muted small">待审批或已排程时可修改目标、问题和计划发送时间。</span>
        </div>

        <div v-if="editing" class="edit-grid">
          <label class="field-block">
            <span>目标类型</span>
            <select v-model="draft.targetType" class="field-input" @change="handleTargetTypeChange">
              <option value="private">私聊</option>
              <option value="group">群组</option>
              <option value="person">联系人</option>
            </select>
          </label>
          <label class="field-block">
            <span>目标用户/群组</span>
            <input
              v-model="draft.targetRef"
              class="field-input"
              type="text"
              placeholder="输入用户名、群组名或群组 ID"
              @input="handleTargetInput"
            />
            <span class="muted small">输入时会自动检索 RingCentral 用户或群组候选。</span>
          </label>
          <div class="field-block full-span">
            <div class="search-row">
              <span class="muted small">
                {{ searchingTargets ? '正在检索候选...' : `当前解析状态：${draftResolutionLabel}` }}
              </span>
              <button class="ghost-btn" :disabled="busy || searchingTargets" @click="searchTargets(true)">
                重新检索
              </button>
            </div>
            <p v-if="searchError" class="field-error">{{ searchError }}</p>
            <div v-if="draft.targetCandidates.length > 0" class="candidate-list">
              <button
                v-for="candidate in draft.targetCandidates"
                :key="`${candidate.kind}:${candidate.entityId}`"
                class="candidate-btn"
                type="button"
                @click="selectTargetCandidate(candidate)"
              >
                <strong>{{ candidate.label }}</strong>
                <span class="muted small">
                  {{ candidate.subtitle || candidate.source }} · 匹配度 {{ candidate.score }}
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
            <span>上下文</span>
            <textarea
              v-model="draft.renderedContext"
              class="field-input field-textarea"
              rows="4"
              placeholder="补充对方需要的上下文"
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
            <p class="muted">留空表示批准后立即发送；如果当前已排程，留空则改为尽快发送。</p>
          </div>
          <div class="edit-actions full-span">
            <button class="primary-btn" :disabled="busy" @click="saveDraft">保存调整</button>
            <button class="ghost-btn" :disabled="busy" @click="cancelEdit">取消编辑</button>
          </div>
        </div>

        <div v-else class="summary-text">
          <p>当前目标：{{ targetTypeLabel(detail.targetType) }} / {{ detail.targetRef }}</p>
          <p>目标解析：{{ sessionTargetResolutionLabel(detail) }}</p>
          <p>计划发送：{{ detail.nextCheckAt ? relativeTime(detail.nextCheckAt) : '批准后立即发送' }}</p>
        </div>
      </section>

      <section class="panel">
        <div class="panel-title">当前结论</div>
        <p class="summary-text">{{ sessionSummary(detail) }}</p>
      </section>

      <section class="panel">
        <div class="panel-title">回复内容</div>
        <div v-if="detail.replyRawText" class="reply-box">
          <div class="inline-head">
            <span>{{ detail.replySender || '未知发送者' }}</span>
            <span class="muted small">{{ replyClassificationLabel(detail.replyClassification) }}</span>
          </div>
          <p>{{ detail.replyRawText }}</p>
          <div v-if="detail.replyConfidence !== undefined" class="muted small">
            解析置信度：{{ Number(detail.replyConfidence).toFixed(2) }}
          </div>
        </div>
        <div v-else class="muted">暂无回复内容</div>
      </section>

      <section class="panel">
        <div class="panel-title">结构化结果</div>
        <div v-if="detail.outcome && Object.keys(detail.outcome).length > 0" class="json-panel">
          <pre>{{ formatJson(detail.outcome) }}</pre>
        </div>
        <div v-else class="muted">暂无结构化结果</div>
      </section>

      <section class="panel">
        <div class="panel-title">事件时间线</div>
        <div v-if="events.length === 0" class="muted">暂无事件</div>
        <div v-else class="event-list">
          <div v-for="event in events" :key="event.id" class="event-item">
            <div class="inline-head">
              <span>{{ eventTypeLabel(event.eventType) }}</span>
              <span class="muted small">{{ relativeTime(event.createdAt) }}</span>
            </div>
            <pre v-if="event.payload && Object.keys(event.payload).length > 0" class="json-block">{{ formatJson(event.payload) }}</pre>
          </div>
        </div>
      </section>

      <section v-if="detail.errorMessage || detail.errorCode" class="panel error-panel">
        <div class="panel-title">错误信息</div>
        <p>{{ detail.errorCode || 'error' }}: {{ detail.errorMessage || 'unknown error' }}</p>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  getMemoryServiceClient,
  type OutreachEvent,
  type OutreachSession,
  type OutreachSessionStatus,
  type OutreachTargetCandidate,
} from '../../services/MemoryServiceClient';

const client = getMemoryServiceClient();
const route = useRoute();
const router = useRouter();

const loading = ref(true);
const busy = ref(false);
const editing = ref(false);
const searchingTargets = ref(false);
const searchError = ref('');
const detail = ref<OutreachSession | null>(null);
const draft = reactive({
  targetType: 'private',
  targetRef: '',
  targetResolutionStatus: 'unresolved' as 'unresolved' | 'ambiguous' | 'resolved',
  targetResolvedType: '',
  targetResolvedId: '',
  targetResolvedLabel: '',
  targetResolvedChatId: '',
  targetCandidates: [] as OutreachTargetCandidate[],
  renderedQuestion: '',
  renderedContext: '',
  nextCheckAtInput: '',
});

const events = computed<OutreachEvent[]>(() => {
  const list = detail.value?.events ?? [];
  return [...list].sort((a, b) => normalizeTimestamp(b.createdAt) - normalizeTimestamp(a.createdAt));
});

let targetSearchTimer: ReturnType<typeof setTimeout> | null = null;
let targetSearchSequence = 0;

onMounted(() => {
  void loadDetail();
});

onBeforeUnmount(() => {
  if (targetSearchTimer) {
    clearTimeout(targetSearchTimer);
    targetSearchTimer = null;
  }
});

watch(
  () => route.params.id,
  () => {
    void loadDetail();
  },
);

async function loadDetail() {
  const id = route.params.id as string;
  if (!id) return;
  loading.value = true;
  try {
    detail.value = await client.getOutreachSession(id);
    resetDraft(detail.value);
  } catch (error) {
    console.error('Failed to load outreach session detail:', error);
    detail.value = null;
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
  clearResolvedTarget();
  scheduleTargetSearch(120);
}

async function approveSession() {
  if (!detail.value) return;
  busy.value = true;
  try {
    await client.approveOutreachSession(detail.value.id);
    await loadDetail();
  } finally {
    busy.value = false;
  }
}

async function cancelSession() {
  if (!detail.value) return;
  if (!window.confirm('确认取消这个主动询问会话吗？')) return;
  busy.value = true;
  try {
    await client.cancelOutreachSession(detail.value.id, 'Cancelled from outreach detail UI');
    await loadDetail();
  } finally {
    busy.value = false;
  }
}

async function retrySession() {
  if (!detail.value) return;
  busy.value = true;
  try {
    await client.retryOutreachSession(detail.value.id);
    await loadDetail();
  } finally {
    busy.value = false;
  }
}

async function saveDraft() {
  if (!detail.value) return;
  if (!draft.targetRef.trim()) {
    window.alert('请先填写目标用户/群组。');
    return;
  }
  if (!draft.renderedQuestion.trim()) {
    window.alert('请先填写要发送的问题。');
    return;
  }
  const normalizedTargetRef = draft.targetRef.trim().toLowerCase();
  if (
    (draft.targetType === 'private' || draft.targetType === 'person') &&
    (normalizedTargetRef === 'user' || normalizedTargetRef === 'me' || normalizedTargetRef === 'self')
  ) {
    window.alert('主动询问只用于对外询问，不应把当前用户作为目标。');
    return;
  }
  if (draft.targetResolutionStatus !== 'resolved') {
    window.alert('请先通过 RingCentral 检索并确认目标，确认后才能保存可审批的主动询问。');
    return;
  }

  busy.value = true;
  try {
    await client.updateOutreachSessionDraft(detail.value.id, {
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
    await loadDetail();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    window.alert(message || '保存主动询问调整失败。');
  } finally {
    busy.value = false;
  }
}

function startEdit() {
  resetDraft(detail.value);
  searchError.value = '';
  editing.value = true;
  scheduleTargetSearch(80);
}

function cancelEdit() {
  resetDraft(detail.value);
  searchError.value = '';
  editing.value = false;
}

function canRetry(status: OutreachSessionStatus) {
  return status === 'failed' || status === 'no_reply' || status === 'escalated';
}

function canCancel(status: OutreachSessionStatus) {
  return status === 'pending_approval' || status === 'scheduled' || status === 'waiting_reply' || status === 'deferred';
}

function canEdit(status: OutreachSessionStatus) {
  return status === 'pending_approval' || status === 'scheduled';
}

function canApprove(session: OutreachSession) {
  return session.targetResolutionStatus === 'resolved';
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
  draft.targetType = session?.targetType || 'private';
  draft.targetRef = session?.targetRef || '';
  draft.targetResolutionStatus = session?.targetResolutionStatus || 'unresolved';
  draft.targetResolvedType = session?.targetResolvedType || '';
  draft.targetResolvedId = session?.targetResolvedId || '';
  draft.targetResolvedLabel = session?.targetResolvedLabel || '';
  draft.targetResolvedChatId = session?.targetResolvedChatId || '';
  draft.targetCandidates = Array.isArray(session?.targetCandidates) ? [...session!.targetCandidates!] : [];
  draft.renderedQuestion = session?.renderedQuestion || '';
  draft.renderedContext = session?.renderedContext || '';
  draft.nextCheckAtInput = toDateTimeLocal(session?.nextCheckAt);
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
    searchError.value = '`sync.service` 是定时消息里的系统伪目标，不是实际的 RingCentral 用户/群组，不能直接用于主动询问。';
    return;
  }
  const currentSearch = ++targetSearchSequence;
  searchingTargets.value = true;
  searchError.value = '';
  try {
    const response = await client.searchOutreachTargets(draft.targetType, query, 8);
    if (currentSearch !== targetSearchSequence) {
      return;
    }
    draft.targetCandidates = response.items;
    if (response.items.length === 0) {
      clearResolvedTarget();
      searchError.value = `未找到与 “${query}” 匹配的 RingCentral 用户/群组，请调整后重试。`;
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
    return `已确认：${draft.targetResolvedLabel || draft.targetRef}`;
  }
  if (draft.targetResolutionStatus === 'ambiguous') {
    return '找到多个候选，待你确认';
  }
  return '未确认';
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
  if (originKind === 'scheduled_template' || originKind === 'manual_action') return '手动/定时';
  return '未知来源';
}

function targetTypeLabel(targetType?: string) {
  if (targetType === 'private') return '私聊';
  if (targetType === 'group') return '群组';
  return targetType || '未知目标';
}

function targetResolutionLabel(targetRef?: string) {
  const normalizedRef = targetRef?.trim().toLowerCase() || '';
  if (!normalizedRef) return '目标待确认';
  return '原始目标文本';
}

function sessionTargetResolutionLabel(session: OutreachSession) {
  if (session.targetResolutionStatus === 'resolved') {
    return `已确认：${session.targetResolvedLabel || session.targetRef}`;
  }
  if (session.targetResolutionStatus === 'ambiguous') {
    return '找到多个候选，待你确认';
  }
  return targetResolutionLabel(session.targetRef);
}

function nextTimeLabel(status: OutreachSessionStatus) {
  if (status === 'pending_approval' || status === 'scheduled') {
    return '计划发送';
  }
  return '下次检查';
}

function replyClassificationLabel(value?: string) {
  if (value === 'answer') return '已答复';
  if (value === 'defer') return '稍后回复';
  if (value === 'irrelevant') return '回复不相关';
  if (value === 'decline') return '明确拒绝';
  if (value === 'unclear') return '回复不明确';
  return '未分类';
}

function eventTypeLabel(value?: string) {
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
  if (value === 'failed') return '执行失败';
  return value || '未知事件';
}

function extractOutcomeSummary(outcome: Record<string, unknown> | undefined): string {
  if (!outcome) return '';
  const candidates = [
    outcome.summary,
    outcome.reason,
    outcome.answer,
    outcome.answerText,
    outcome.reply,
  ];
  const found = candidates.find((value) => typeof value === 'string' && value.trim().length > 0);
  return typeof found === 'string' ? found.trim() : '';
}

function sessionSummary(session: OutreachSession): string {
  const outcomeSummary = extractOutcomeSummary(session.outcome);
  if (outcomeSummary) return outcomeSummary;
  if (session.status === 'pending_approval') return '等待人工审批。批准后系统才会正式发出询问。';
  if (session.status === 'scheduled') return '会话已创建，等待到达发送时间。';
  if (session.status === 'waiting_reply') return '询问已发出，系统正在等待对方回复。';
  if (session.status === 'deferred') {
    return session.waitUntil
      ? `对方表示稍后回复，当前等待到 ${relativeTime(session.waitUntil)}。`
      : '对方表示稍后回复，当前继续等待。';
  }
  if (session.status === 'resolved') {
    return session.replyRawText?.trim() || '已收到可用回复，结果已归档。';
  }
  if (session.status === 'no_reply') return '已达到等待与追问上限，仍未收到回复。';
  if (session.status === 'escalated') return '系统无法自动继续，已升级等待人工判断。';
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
  if (status === 'escalated' || status === 'failed' || status === 'no_reply') return 'error';
  return '';
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
