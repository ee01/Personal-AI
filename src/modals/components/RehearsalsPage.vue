<template>
  <div class="rehearsals-page">
    <header class="page-header">
      <div>
        <h2>Rehearsal</h2>
        <p>未来场景预演记忆。主要在真实场景中提示，这里用于审计和修正。</p>
      </div>
      <div class="header-controls">
        <select v-model="statusFilter" class="filter-select" @change="applyFilters">
          <option value="active">Active</option>
          <option value="candidate">Candidate</option>
          <option value="paused">Paused</option>
          <option value="stale">Stale</option>
          <option value="used">Used</option>
          <option value="dismissed">Dismissed</option>
          <option value="archived">Archived</option>
          <option value="all">All</option>
        </select>
        <input
          v-model="searchText"
          class="search-input"
          placeholder="搜索标题 / 预演内容"
          @keyup.enter="applyFilters"
        />
        <button class="refresh-btn" @click="applyFilters">刷新</button>
      </div>
    </header>

    <div v-if="loading" class="loading-state">加载 Rehearsal 中...</div>
    <div v-else-if="errorMessage" class="empty-state">{{ errorMessage }}</div>
    <div v-else-if="items.length === 0" class="empty-state">
      暂无符合条件的 Rehearsal
    </div>

    <div v-else class="rehearsal-layout">
      <section class="rehearsal-list" aria-label="Rehearsal 列表">
        <button
          v-for="item in items"
          :key="item.id"
          type="button"
          class="rehearsal-card"
          :class="{ selected: selectedId === item.id }"
          @click="selectRehearsal(item.id)"
        >
          <div class="card-top">
            <span class="status-badge" :class="item.status">{{ statusLabel(item.status) }}</span>
            <span class="score">C {{ item.confidence.toFixed(2) }}</span>
          </div>
          <h3>{{ item.title }}</h3>
          <p>{{ item.summary || item.content }}</p>
          <div class="card-meta">
            <span>{{ item.scenarioType }}</span>
            <span>触发 {{ item.activationCount }}</span>
            <span v-if="item.validUntil">到期 {{ formatDate(item.validUntil) }}</span>
          </div>
        </button>
      </section>

      <section v-if="selected" class="detail-panel" aria-label="Rehearsal 详情">
        <div v-if="focusNotice" class="focus-notice" role="status">
          <span>{{ focusNotice }}</span>
          <button type="button" @click="showAllForSelected">查看全部</button>
        </div>
        <div class="action-guidance" role="status">
          <span>{{ selectedNextStep }}</span>
        </div>
        <div v-if="actionMessage" class="action-message" role="status">
          {{ actionMessage }}
        </div>

        <div class="detail-header">
          <div>
            <span class="status-badge" :class="selected.status">
              {{ statusLabel(selected.status) }}
            </span>
            <h3>{{ selected.title }}</h3>
          </div>
          <div class="detail-actions">
            <button v-if="canReactivateSelected" @click="reactivateSelected">
              {{ reactivateLabel }}
            </button>
            <button v-if="selected.status !== 'paused'" @click="setStatus('paused')">
              暂停
            </button>
            <button v-if="selected.status === 'paused'" @click="setStatus('active')">
              恢复
            </button>
            <button @click="markUsed">标记已使用</button>
            <button @click="markIrrelevant">不相关</button>
            <button class="danger" @click="archiveSelected">归档</button>
          </div>
        </div>

        <div class="section">
          <h4>预演内容</h4>
          <p>{{ selected.content }}</p>
        </div>

        <div class="section">
          <h4>触发线索</h4>
          <div class="cue-grid">
            <div v-for="cue in cueRows(selected.activationCues)" :key="cue.label" class="cue-row">
              <span>{{ cue.label }}</span>
              <strong>{{ cue.value }}</strong>
            </div>
          </div>
        </div>

        <div class="section meta-grid">
          <div>
            <span>来源</span>
            <strong>{{ selected.sourceKind }}{{ selected.sourceRefId ? `:${selected.sourceRefId}` : '' }}</strong>
          </div>
          <div>
            <span>优先级</span>
            <strong>{{ selected.priority }}</strong>
          </div>
          <div>
            <span>使用</span>
            <strong>{{ selected.usedCount }}</strong>
          </div>
          <div>
            <span>忽略</span>
            <strong>{{ selected.dismissedCount }}</strong>
          </div>
          <div v-if="selected.staleReason">
            <span>降权原因</span>
            <strong>{{ selected.staleReason }}</strong>
          </div>
        </div>

        <div class="section">
          <h4>来源证据</h4>
          <div v-if="selectedEvidenceRows.length" class="evidence-list">
            <div
              v-for="evidence in selectedEvidenceRows"
              :key="evidence.raw"
              class="evidence-row"
              :title="evidence.raw"
            >
              <span>{{ evidence.label }}</span>
              <strong>{{ evidence.value }}</strong>
            </div>
          </div>
          <div v-else class="muted">暂无来源证据记录</div>
        </div>

        <div class="section">
          <h4>最近触发</h4>
          <div v-if="activations.length === 0" class="muted">暂无触发记录</div>
          <div v-for="activation in activations" :key="activation.id" class="activation-row">
            <div class="activation-main">
              <span>{{ activation.surface }} / {{ activation.contextType || '-' }}</span>
              <strong>{{ activation.displayPriority }} · {{ activation.score.toFixed(2) }}</strong>
              <span>{{ statusTime(activation.createdAt) }}</span>
            </div>
            <div class="activation-meta">
              <span class="outcome-badge">{{ activationOutcomeLabel(activation.outcome) }}</span>
              <span v-if="activationCueSummary(activation)">
                命中 {{ activationCueSummary(activation) }}
              </span>
              <span v-else>未记录具体命中线索</span>
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
  type Rehearsal,
  type RehearsalActivation,
  type RehearsalActivationCues,
  type RehearsalStatus,
} from '../../services/MemoryServiceClient';

const client = getMemoryServiceClient();
const route = useRoute();
const router = useRouter();
const loading = ref(true);
const errorMessage = ref('');
const items = ref<Rehearsal[]>([]);
const selectedId = ref<string>('');
const activations = ref<RehearsalActivation[]>([]);
const statusFilter = ref<RehearsalStatus | 'all'>('active');
const searchText = ref('');
const focusedOutsideFilter = ref(false);
const actionMessage = ref('');

const selected = computed(() =>
  items.value.find((item) => item.id === selectedId.value) || null,
);

const selectedEvidenceRows = computed(() =>
  evidenceRows(selected.value?.evidenceRefs ?? []),
);

const focusNotice = computed(() => {
  if (!focusedOutsideFilter.value || !selected.value) return '';
  return `当前 ${statusLabel(selected.value.status)} Rehearsal 不在「${currentFilterLabel()}」列表中，已临时置顶以便继续审计。`;
});

const canReactivateSelected = computed(() =>
  Boolean(
    selected.value &&
      ['candidate', 'paused', 'stale', 'dismissed'].includes(selected.value.status),
  ),
);

const reactivateLabel = computed(() => {
  if (!selected.value) return '恢复';
  if (selected.value.status === 'candidate') return '激活';
  if (selected.value.status === 'stale') return '重新激活';
  if (selected.value.status === 'dismissed') return '恢复待观察';
  return '恢复';
});

const selectedNextStep = computed(() => {
  if (!selected.value) return '';
  const expired = isExpired(selected.value);
  if (selected.value.status === 'active') {
    return '当前会进入场景触发；如果近期不想看到它，可以暂停或标记不相关。';
  }
  if (selected.value.status === 'candidate') {
    return '当前仍在候选态；确认线索稳定后可以激活，后续场景命中才会提示。';
  }
  if (selected.value.status === 'paused') {
    return '当前已暂停，不会进入场景提示；恢复后会继续参与 Rehearsal 匹配。';
  }
  if (selected.value.status === 'stale') {
    return expired
      ? '当前因有效期过期而降权；重新激活会清除过期时间并重新参与匹配。'
      : '当前已降权保留；重新激活后会刷新老化时钟并继续参与匹配。';
  }
  if (selected.value.status === 'dismissed') {
    return '当前被标记为不相关；恢复后会重新参与场景观察。';
  }
  if (selected.value.status === 'used') {
    return '当前已标记使用；通常只需保留审计或归档。';
  }
  return '当前已归档；保留为审计记录，不再进入场景触发。';
});

onMounted(async () => {
  await loadRehearsals(routeRehearsalId(), { pinFocus: true });
});

watch(
  () => route.query.rehearsalId,
  async () => {
    const focusId = routeRehearsalId();
    if (!focusId || focusId === selectedId.value) return;
    await loadRehearsals(focusId, { pinFocus: true });
  },
);

function routeRehearsalId() {
  return typeof route.query.rehearsalId === 'string' ? route.query.rehearsalId : '';
}

async function loadRehearsals(
  focusId = selectedId.value,
  options: { pinFocus?: boolean; syncRoute?: boolean } = {},
) {
  loading.value = true;
  errorMessage.value = '';
  try {
    const response = await client.listRehearsals({
      status: statusFilter.value,
      search: searchText.value.trim() || undefined,
      limit: 80,
    });
    items.value = response.items;
    actionMessage.value = '';
    focusedOutsideFilter.value = false;

    if (focusId) {
      const focusInList = response.items.some((item) => item.id === focusId);
      if (!focusInList && !options.pinFocus) {
        selectedId.value = '';
      } else {
        selectedId.value = focusId;
        const detail = await loadDetail(focusId);
        if (detail) {
          focusedOutsideFilter.value = !focusInList;
          if (options.syncRoute) await replaceRouteRehearsalId(focusId);
          return;
        }
      }
    }

    selectedId.value = items.value[0]?.id || '';
    if (selectedId.value) {
      await loadDetail(selectedId.value);
      if (options.syncRoute) await replaceRouteRehearsalId(selectedId.value);
    } else if (options.syncRoute) {
      await replaceRouteRehearsalId('');
    }
  } catch (error) {
    console.error('Failed to load rehearsals:', error);
    errorMessage.value = 'Rehearsal 暂不可用，请确认 Memory Service 已启动。';
    items.value = [];
    focusedOutsideFilter.value = false;
  } finally {
    loading.value = false;
  }
}

async function applyFilters() {
  await loadRehearsals(selectedId.value, { pinFocus: false, syncRoute: true });
}

async function selectRehearsal(id: string) {
  selectedId.value = id;
  focusedOutsideFilter.value = false;
  actionMessage.value = '';
  await router.replace({ query: { ...route.query, rehearsalId: id } });
  await loadDetail(id);
}

async function replaceRouteRehearsalId(id: string) {
  const query = { ...route.query };
  if (id) {
    query.rehearsalId = id;
  } else {
    delete query.rehearsalId;
  }
  await router.replace({ query });
}

async function loadDetail(id: string) {
  try {
    const detail = await client.getRehearsal(id);
    activations.value = detail.activations;
    upsertRehearsal(detail.rehearsal);
    return detail;
  } catch (error) {
    console.error('Failed to load rehearsal detail:', error);
    activations.value = [];
    return null;
  }
}

async function setStatus(status: RehearsalStatus) {
  if (!selected.value) return;
  const response = await client.updateRehearsal(selected.value.id, { status });
  replaceSelected(response.rehearsal);
  actionMessage.value =
    status === 'paused' ? '已暂停，这条预演不会进入场景提示。' : '状态已更新。';
}

async function reactivateSelected() {
  if (!selected.value) return;
  const expired = isExpired(selected.value);
  const response = await client.updateRehearsal(selected.value.id, {
    status: 'active',
    staleReason: null,
    ...(expired ? { validUntil: null } : {}),
  });
  replaceSelected(response.rehearsal);
  actionMessage.value = expired
    ? '已清除过期时间并恢复为 Active。'
    : '已恢复为 Active。';
}

async function markUsed() {
  if (!selected.value) return;
  const response = await client.submitRehearsalFeedback(selected.value.id, {
    outcome: 'used',
  });
  replaceSelected(response.rehearsal);
  actionMessage.value = '已标记使用，后续可保留审计或归档。';
  await loadDetail(response.rehearsal.id);
}

async function markIrrelevant() {
  if (!selected.value) return;
  const response = await client.submitRehearsalFeedback(selected.value.id, {
    outcome: 'irrelevant',
  });
  replaceSelected(response.rehearsal);
  actionMessage.value = '已标记不相关，这条预演会退出场景提示。';
  await loadDetail(response.rehearsal.id);
}

async function archiveSelected() {
  if (!selected.value) return;
  const response = await client.deleteRehearsal(selected.value.id);
  replaceSelected(response.rehearsal);
  actionMessage.value = '已归档为审计记录。';
}

function replaceSelected(next: Rehearsal) {
  upsertRehearsal(next);
  focusedOutsideFilter.value = !rehearsalMatchesCurrentView(next);
}

function upsertRehearsal(next: Rehearsal) {
  const existingIndex = items.value.findIndex((item) => item.id === next.id);
  if (existingIndex >= 0) {
    items.value = items.value.map((item) => (item.id === next.id ? next : item));
    return;
  }
  items.value = [next, ...items.value];
}

async function showAllForSelected() {
  if (!selected.value) return;
  const id = selected.value.id;
  statusFilter.value = 'all';
  searchText.value = '';
  focusedOutsideFilter.value = false;
  await loadRehearsals(id);
}

function rehearsalMatchesCurrentView(rehearsal: Rehearsal) {
  if (statusFilter.value !== 'all' && rehearsal.status !== statusFilter.value) {
    return false;
  }
  const query = searchText.value.trim().toLowerCase();
  if (!query) return true;
  return [rehearsal.title, rehearsal.summary || '', rehearsal.content].some((value) =>
    value.toLowerCase().includes(query),
  );
}

function currentFilterLabel() {
  const status = statusFilter.value === 'all' ? 'All' : statusLabel(statusFilter.value);
  const query = searchText.value.trim();
  return query ? `${status} / 搜索 ${query}` : status;
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    active: 'Active',
    candidate: 'Candidate',
    paused: 'Paused',
    used: 'Used',
    stale: 'Stale',
    archived: 'Archived',
    dismissed: 'Dismissed',
  };
  return labels[status] || status;
}

function activationOutcomeLabel(outcome: string) {
  const labels: Record<string, string> = {
    matched: '已匹配',
    shown: '已展示',
    accepted: '已接受',
    used: '已使用',
    ignored: '已忽略',
    dismissed: '已关闭',
    irrelevant: '不相关',
  };
  return labels[outcome] || outcome;
}

function cueRows(cues: RehearsalActivationCues) {
  const labels: Record<keyof RehearsalActivationCues, string> = {
    people: '人物',
    projects: '项目',
    topics: '主题',
    keywords: '关键词',
    groupIds: '群组',
    conversationIds: '会话',
    meetingIds: '会议',
    calendarEventIds: '日历',
    issueKeys: '工单',
    urls: '页面',
    surfaces: '场景',
  };
  return (Object.keys(labels) as Array<keyof RehearsalActivationCues>)
    .map((key) => ({
      label: labels[key],
      value: cueValue(cues[key] ?? []),
    }))
    .filter((row) => row.value);
}

function activationCueSummary(activation: RehearsalActivation) {
  const rows = cueRows(activation.matchedCues).slice(0, 3);
  return rows.map((row) => `${row.label}: ${row.value}`).join(' · ');
}

function evidenceRows(refs: string[]) {
  return refs
    .map((ref) => parseEvidenceRef(ref))
    .filter((row): row is { raw: string; label: string; value: string } => Boolean(row));
}

function parseEvidenceRef(ref: string) {
  const raw = String(ref || '').trim();
  if (!raw) return null;
  const separatorIndex = raw.indexOf(':');
  if (separatorIndex <= 0) {
    return { raw, label: '证据', value: raw };
  }
  const kind = raw.slice(0, separatorIndex);
  const value = raw.slice(separatorIndex + 1).trim() || raw;
  return {
    raw,
    label: evidenceKindLabel(kind),
    value,
  };
}

function evidenceKindLabel(kind: string) {
  const labels: Record<string, string> = {
    message: '消息',
    reflection_thread: '反思线程',
    reflection_run: '反思运行',
    confirm_request: '确认请求',
    action: '动作',
    dream: '梦境',
    manual: '手动来源',
    memory: '记忆',
    meeting: '会议',
    jira: 'Jira',
  };
  return labels[kind] || kind;
}

function cueValue(values: string[]) {
  const cleanValues = values.map((value) => String(value || '').trim()).filter(Boolean);
  if (!cleanValues.length) return '';
  const shown = cleanValues.slice(0, 3).join(', ');
  return cleanValues.length > 3 ? `${shown} +${cleanValues.length - 3}` : shown;
}

function formatDate(ts: number) {
  return new Date(ts * 1000).toLocaleDateString();
}

function statusTime(ts: number) {
  return new Date(ts * 1000).toLocaleString();
}

function isExpired(rehearsal: Rehearsal) {
  return Boolean(
    rehearsal.validUntil && rehearsal.validUntil < Math.floor(Date.now() / 1000),
  );
}
</script>

<style scoped>
.rehearsals-page {
  animation: fadeInUp 0.45s ease-out;
}

.page-header,
.detail-header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.25rem;
}

.page-header h2,
.detail-header h3 {
  margin: 0 0 0.35rem;
}

.page-header p {
  color: #94a3b8;
  font-size: 0.9rem;
}

.header-controls,
.detail-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.7rem;
}

.filter-select,
.search-input {
  background: rgba(15, 23, 42, 0.72);
  border: 1px solid rgba(148, 163, 184, 0.22);
  color: #e2e8f0;
  border-radius: 8px;
  padding: 0.7rem 0.9rem;
}

.refresh-btn,
.detail-actions button,
.focus-notice button {
  border: 1px solid rgba(59, 130, 246, 0.38);
  border-radius: 8px;
  padding: 0.68rem 0.9rem;
  background: rgba(37, 99, 235, 0.18);
  color: #dbeafe;
  cursor: pointer;
}

.detail-actions .danger {
  border-color: rgba(248, 113, 113, 0.45);
  color: #fecaca;
  background: rgba(127, 29, 29, 0.28);
}

.focus-notice {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.8rem;
  margin-bottom: 1rem;
  border: 1px solid rgba(59, 130, 246, 0.3);
  border-radius: 8px;
  padding: 0.75rem 0.85rem;
  background: rgba(30, 64, 175, 0.18);
  color: #bfdbfe;
  font-size: 0.84rem;
}

.focus-notice button {
  flex: 0 0 auto;
  padding: 0.5rem 0.7rem;
}

.action-guidance,
.action-message {
  margin-bottom: 0.85rem;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 8px;
  padding: 0.75rem 0.85rem;
  background: rgba(15, 23, 42, 0.48);
  color: #cbd5e1;
  font-size: 0.84rem;
  line-height: 1.5;
}

.action-message {
  border-color: rgba(34, 197, 94, 0.3);
  background: rgba(20, 83, 45, 0.22);
  color: #bbf7d0;
}

.loading-state,
.empty-state {
  color: #94a3b8;
  padding: 2rem;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 8px;
}

.rehearsal-layout {
  display: grid;
  grid-template-columns: minmax(260px, 360px) minmax(0, 1fr);
  gap: 1rem;
}

.rehearsal-list {
  display: grid;
  gap: 0.8rem;
  align-content: start;
}

.rehearsal-card {
  text-align: left;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.58);
  color: #e2e8f0;
  padding: 1rem;
  cursor: pointer;
}

.rehearsal-card.selected {
  border-color: rgba(59, 130, 246, 0.68);
  background: rgba(30, 64, 175, 0.22);
}

.rehearsal-card h3 {
  margin: 0.7rem 0 0.45rem;
  font-size: 1rem;
}

.rehearsal-card p {
  color: #cbd5e1;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-top,
.card-meta,
.activation-main {
  display: flex;
  justify-content: space-between;
  gap: 0.7rem;
  color: #94a3b8;
  font-size: 0.78rem;
}

.status-badge {
  border-radius: 999px;
  padding: 0.2rem 0.55rem;
  background: rgba(148, 163, 184, 0.16);
  color: #cbd5e1;
}

.status-badge.active {
  background: rgba(34, 197, 94, 0.16);
  color: #bbf7d0;
}

.status-badge.candidate {
  background: rgba(59, 130, 246, 0.16);
  color: #bfdbfe;
}

.status-badge.stale,
.status-badge.paused {
  background: rgba(245, 158, 11, 0.16);
  color: #fde68a;
}

.status-badge.used {
  background: rgba(20, 184, 166, 0.16);
  color: #99f6e4;
}

.status-badge.archived,
.status-badge.dismissed {
  background: rgba(100, 116, 139, 0.2);
  color: #cbd5e1;
}

.detail-panel {
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 8px;
  background: rgba(2, 6, 23, 0.38);
  padding: 1.1rem;
}

.section {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid rgba(148, 163, 184, 0.14);
}

.section h4 {
  margin: 0 0 0.6rem;
}

.section p,
.muted {
  color: #cbd5e1;
}

.cue-grid,
.meta-grid,
.evidence-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 0.7rem;
}

.cue-row,
.meta-grid > div,
.evidence-row,
.activation-row {
  border: 1px solid rgba(148, 163, 184, 0.12);
  border-radius: 8px;
  padding: 0.65rem;
  background: rgba(15, 23, 42, 0.46);
}

.activation-row {
  display: grid;
  gap: 0.55rem;
  color: #94a3b8;
  font-size: 0.78rem;
}

.activation-main strong {
  color: #dbeafe;
}

.activation-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
  color: #cbd5e1;
}

.outcome-badge {
  border-radius: 999px;
  padding: 0.16rem 0.48rem;
  background: rgba(148, 163, 184, 0.16);
  color: #e2e8f0;
}

.cue-row span,
.meta-grid span,
.evidence-row span {
  display: block;
  color: #94a3b8;
  font-size: 0.75rem;
  margin-bottom: 0.25rem;
}

.cue-row strong,
.meta-grid strong,
.evidence-row strong {
  color: #e2e8f0;
  font-size: 0.9rem;
  overflow-wrap: anywhere;
}

@media (max-width: 900px) {
  .page-header,
  .detail-header {
    flex-direction: column;
  }

  .rehearsal-layout {
    grid-template-columns: 1fr;
  }
}
</style>
