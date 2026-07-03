<template>
  <div class="rehearsals-page">
    <header class="rehearsal-hero">
      <div class="hero-copy">
        <div class="eyebrow">场景预演 | Rehearsal</div>
        <h2>未来场景触发的提示脚本</h2>
        <p>
          这些内容主要给 context-recall、会前准备、Meeting Pilot、Compose Assist
          等真实场景消费；本页只用于审计、修正和处理误命中。
        </p>
      </div>
      <div class="header-controls">
        <select
          v-model="statusFilter"
          class="filter-select"
          aria-label="按状态筛选场景预演"
          @change="applyFilters"
        >
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

    <section class="usage-strip" aria-label="场景预演使用方式">
      <div>
        <span>主要消费</span>
        <strong>Context Recall / 会前准备 / Meeting Pilot / Compose Assist</strong>
      </div>
      <div>
        <span>本页用途</span>
        <strong>审计来源、修正触发线索、暂停或归档误命中</strong>
      </div>
      <div>
        <span>不会直接做</span>
        <strong>自动发送、替代事实记忆、要求用户日常逐条阅读</strong>
      </div>
    </section>

    <section
      v-if="focusFailureReceipt"
      class="focus-failure-receipt"
      role="status"
      aria-label="深链目标回执"
    >
      <div>
        <strong>{{ focusFailureReceipt.title }}</strong>
        <p>{{ focusFailureReceipt.summary }}</p>
        <p>{{ focusFailureReceipt.boundary }}</p>
        <p>{{ focusFailureReceipt.recovery }}</p>
      </div>
      <div class="focus-failure-actions">
        <button type="button" @click="retryFocusLookup">重试目标</button>
        <button type="button" @click="showAllAfterFocusFailure">查看 All</button>
      </div>
    </section>

    <div v-if="loading" class="loading-state">加载场景预演中...</div>
    <div v-else-if="errorMessage" class="empty-state">{{ errorMessage }}</div>
    <section
      v-else-if="items.length === 0"
      class="empty-state empty-filter-receipt"
      role="status"
      aria-label="空筛选回执"
    >
      <div class="section-title">
        <span>{{ emptyFilterReceipt.title }}</span>
        <small>{{ emptyFilterReceipt.summary }}</small>
      </div>
      <div class="receipt-grid">
        <div v-for="row in emptyFilterReceipt.rows" :key="row.label">
          <span>{{ row.label }}</span>
          <strong>{{ row.value }}</strong>
        </div>
      </div>
      <p>{{ emptyFilterReceipt.boundary }}</p>
      <p>{{ emptyFilterReceipt.recovery }}</p>
      <div class="empty-filter-actions">
        <button type="button" @click="showAllFromEmptyState">查看 All</button>
        <button
          v-if="searchText.trim()"
          type="button"
          @click="clearSearchFromEmptyState"
        >
          清空搜索
        </button>
        <button type="button" @click="applyFilters">刷新</button>
      </div>
    </section>

    <div v-else class="rehearsal-layout">
      <section class="rehearsal-list" aria-label="场景预演列表">
        <div class="list-summary">
          <strong>{{ items.length }}</strong>
          <span>{{ currentFilterLabel() }}</span>
        </div>
        <section
          class="list-scope-receipt"
          role="status"
          aria-label="列表范围回执"
        >
          <div class="list-scope-title">
            <span>列表范围回执</span>
            <strong>{{ listScopeReceipt.title }}</strong>
          </div>
          <div class="list-scope-grid">
            <div v-for="row in listScopeReceipt.rows" :key="row.label">
              <span>{{ row.label }}</span>
              <strong>{{ row.value }}</strong>
            </div>
          </div>
          <p>{{ listScopeReceipt.summary }}</p>
          <p>{{ listScopeReceipt.boundary }}</p>
        </section>
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
          <div
            class="card-readiness"
            :class="cardReadinessTone(item)"
            aria-label="列表提示资格"
          >
            <span>{{ promptEligibilityLabel(item.status, item) }}</span>
            <strong>{{ futureCueSummary(item.activationCues) }}</strong>
            <small>{{ cardReadinessBoundary(item) }}</small>
          </div>
          <div class="card-meta">
            <span>{{ scenarioLabel(item.scenarioType) }}</span>
            <span>触发 {{ item.activationCount }}</span>
            <span v-if="item.validUntil">到期 {{ formatDate(item.validUntil) }}</span>
          </div>
        </button>
      </section>

      <section v-if="selected" class="detail-panel" aria-label="场景预演详情">
        <div v-if="focusNotice" class="focus-notice" role="status">
          <span>{{ focusNotice }}</span>
          <button type="button" @click="showAllForSelected">查看全部</button>
        </div>
        <div v-if="actionMessage" class="action-message" role="status">
          {{ actionMessage }}
        </div>
        <section
          v-if="actionReceipt"
          class="action-receipt"
          :class="actionReceipt.tone"
          role="status"
          aria-label="处理回执"
        >
          <div class="section-title">
            <span>{{ actionReceipt.title }}</span>
            <small>{{ actionReceipt.summary }}</small>
          </div>
          <div class="receipt-grid">
            <div v-for="row in actionReceipt.rows" :key="row.label">
              <span>{{ row.label }}</span>
              <strong>{{ row.value }}</strong>
            </div>
          </div>
          <p>{{ actionReceipt.boundary }}</p>
          <p>{{ actionReceipt.recovery }}</p>
        </section>

        <section
          class="scenario-readiness-panel"
          :class="selectedScenarioReadiness.tone"
          role="status"
          aria-label="场景资格总览"
        >
          <div class="section-title">
            <span>场景资格总览</span>
            <small>先确认这条预演是否真的能在未来场景触发</small>
          </div>
          <div class="readiness-grid">
            <div v-for="row in selectedScenarioReadiness.rows" :key="row.label">
              <span>{{ row.label }}</span>
              <strong>{{ row.value }}</strong>
            </div>
          </div>
          <p>{{ selectedScenarioReadiness.summary }}</p>
          <p>{{ selectedScenarioReadiness.boundary }}</p>
        </section>

        <div class="detail-header">
          <div>
            <span class="status-badge" :class="selected.status">
              {{ statusLabel(selected.status) }}
            </span>
            <h3>{{ selected.title }}</h3>
            <p>{{ selected.summary || '这条预演会在匹配到下方触发线索时进入场景提示。' }}</p>
          </div>
          <div class="detail-actions">
            <button
              v-if="canReactivateSelected"
              :disabled="actionPending"
              @click="reactivateSelected"
            >
              {{ reactivateLabel }}
            </button>
            <button
              v-if="selected.status !== 'paused'"
              :disabled="actionPending"
              @click="setStatus('paused')"
            >
              暂停
            </button>
            <button
              v-if="selected.status === 'paused'"
              :disabled="actionPending"
              @click="setStatus('active')"
            >
              恢复
            </button>
            <button :disabled="actionPending" @click="markUsed">标记已使用</button>
            <button :disabled="actionPending" @click="markIrrelevant">不相关</button>
            <button class="danger" :disabled="actionPending" @click="archiveSelected">
              归档
            </button>
          </div>
        </div>

        <div class="next-step-banner" role="status">
          {{ selectedNextStep }}
        </div>

        <section class="diagnostic-panel" aria-label="命中诊断">
          <div class="section-title">
            <span>命中诊断</span>
            <small>把最近触发、反馈和入口压缩成第一眼判断</small>
          </div>
          <div class="diagnostic-grid">
            <div>
              <span>最近触发</span>
              <strong>{{ selectedActivationDiagnostics.latestLabel }}</strong>
            </div>
            <div>
              <span>最高分</span>
              <strong>{{ selectedActivationDiagnostics.highestScoreLabel }}</strong>
            </div>
            <div>
              <span>反馈</span>
              <strong>{{ selectedActivationDiagnostics.feedbackLabel }}</strong>
            </div>
            <div>
              <span>主要入口</span>
              <strong>{{ selectedActivationDiagnostics.surfaceLabel }}</strong>
            </div>
          </div>
          <p>{{ selectedActivationDiagnostics.recommendation }}</p>
        </section>

        <section class="script-panel">
          <div class="section-title">
            <span>预演脚本</span>
            <small>真实场景命中时给用户看的核心提醒</small>
          </div>
          <p>{{ selected.content }}</p>
        </section>

        <section class="detail-section">
          <div class="section-title">
            <span>触发条件</span>
            <small>只有命中这些人物、项目、会议、页面或主题时才应该提示</small>
          </div>
          <div v-if="selectedCueRows.length" class="cue-columns">
            <div
              v-for="cue in selectedCueRows"
              :key="cue.label"
              class="cue-row"
            >
              <span>{{ cue.label }}</span>
              <strong>{{ cue.value }}</strong>
            </div>
          </div>
          <div
            v-else
            class="cue-boundary-warning"
            role="status"
            aria-label="未来场景边界缺失"
          >
            <strong>缺少未来场景边界</strong>
            <span>
              这条历史记录没有人物、项目、会议、工单、URL、主题或 surface 线索；请先补充触发条件，再恢复现场提示。
            </span>
          </div>
        </section>

        <section class="detail-section two-column">
          <div>
            <div class="section-title">
              <span>生命周期</span>
              <small>决定是否进入现场提示</small>
            </div>
            <div class="fact-grid">
              <div>
                <span>状态</span>
                <strong>{{ statusLabel(selected.status) }}</strong>
              </div>
              <div>
                <span>现场提示</span>
                <strong>{{ selectedPromptEligibility }}</strong>
              </div>
              <div>
                <span>优先级</span>
                <strong>{{ selected.priority }}</strong>
              </div>
              <div>
                <span>使用次数</span>
                <strong>{{ selected.usedCount }}</strong>
              </div>
              <div>
                <span>忽略次数</span>
                <strong>{{ selected.dismissedCount }}</strong>
              </div>
              <div>
                <span>来源</span>
                <strong>{{ selected.sourceKind }}</strong>
              </div>
              <div>
                <span>场景类型</span>
                <strong>{{ scenarioLabel(selected.scenarioType) }}</strong>
              </div>
            </div>
            <p v-if="selected.staleReason" class="stale-reason">
              降权原因：{{ selected.staleReason }}
            </p>
            <p v-if="selected.sourceRefId" class="source-ref">
              {{ selected.sourceRefId }}
            </p>
          </div>

          <div>
            <div class="section-title">
              <span>来源证据</span>
              <small>用于判断这条预演是否仍可信</small>
            </div>
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
        </section>

        <section class="detail-section">
          <div class="section-title">
            <span>最近触发</span>
            <small>用来排查它为什么出现、是否误命中</small>
          </div>
          <div v-if="activations.length === 0" class="muted">暂无触发记录</div>
          <div
            v-for="activation in activations"
            :key="activation.id"
            class="activation-row"
          >
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
        </section>
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
const actionReceipt = ref<ActionReceipt | null>(null);
const actionPending = ref(false);
const focusFailureReceipt = ref<FocusFailureReceipt | null>(null);

type RehearsalActionKind =
  | 'pause'
  | 'restore'
  | 'reactivate'
  | 'mark-used'
  | 'mark-irrelevant'
  | 'archive'
  | 'status';

interface ActionReceipt {
  title: string;
  summary: string;
  tone: 'success' | 'warning' | 'neutral' | 'error';
  rows: Array<{ label: string; value: string }>;
  boundary: string;
  recovery: string;
}

interface FocusFailureReceipt {
  requestedId: string;
  title: string;
  summary: string;
  boundary: string;
  recovery: string;
}

interface ScenarioReadiness {
  tone: 'ready' | 'warning' | 'quiet';
  rows: Array<{ label: string; value: string }>;
  summary: string;
  boundary: string;
}

interface ListScopeReceipt {
  title: string;
  rows: Array<{ label: string; value: string }>;
  summary: string;
  boundary: string;
}

interface EmptyFilterReceipt {
  title: string;
  summary: string;
  rows: Array<{ label: string; value: string }>;
  boundary: string;
  recovery: string;
}

type CueStrength = 'anchored' | 'weak' | 'missing';

const ANCHORED_CUE_KEYS: Array<keyof RehearsalActivationCues> = [
  'people',
  'projects',
  'groupIds',
  'conversationIds',
  'meetingIds',
  'calendarEventIds',
  'issueKeys',
  'urls',
];

const WEAK_CUE_KEYS: Array<keyof RehearsalActivationCues> = [
  'topics',
  'keywords',
  'surfaces',
];

const selected = computed(() =>
  items.value.find((item) => item.id === selectedId.value) || null,
);

const selectedEvidenceRows = computed(() =>
  evidenceRows(selected.value?.evidenceRefs ?? []),
);

const selectedCueRows = computed(() =>
  selected.value ? cueRows(selected.value.activationCues) : [],
);

const selectedActivationDiagnostics = computed(() =>
  buildActivationDiagnostics(selected.value, activations.value),
);

const selectedScenarioReadiness = computed(() =>
  buildScenarioReadiness(selected.value, activations.value),
);

const listScopeReceipt = computed(() =>
  buildListScopeReceipt(items.value, selected.value, focusedOutsideFilter.value),
);

const emptyFilterReceipt = computed(() => buildEmptyFilterReceipt());

const selectedPromptEligibility = computed(() =>
  selected.value ? promptEligibilityLabel(selected.value.status, selected.value) : '-',
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
  if (!hasFutureSceneCue(selected.value)) {
    return '这条记录缺少未来场景边界；即使状态是 Active，也不应被当作可靠现场提示。请先补人物、项目、issue、URL、主题或 surface，或先暂停/归档。';
  }
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
  document.title = '场景预演 | Rehearsal · Personal AI';
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
  if (!options.pinFocus) {
    focusFailureReceipt.value = null;
  }
  try {
    const response = await client.listRehearsals({
      status: statusFilter.value,
      search: searchText.value.trim() || undefined,
      limit: 80,
    });
    items.value = response.items;
    actionMessage.value = '';
    actionReceipt.value = null;
    focusedOutsideFilter.value = false;

    if (focusId) {
      const focusInList = response.items.some((item) => item.id === focusId);
      if (!focusInList && !options.pinFocus) {
        selectedId.value = '';
      } else {
        selectedId.value = focusId;
        const detail = await loadDetail(focusId);
        if (detail) {
          focusFailureReceipt.value = null;
          focusedOutsideFilter.value = !focusInList;
          if (options.syncRoute) await replaceRouteRehearsalId(focusId);
          return;
        }
        if (options.pinFocus) {
          focusFailureReceipt.value = buildFocusFailureReceipt(focusId, focusInList);
          if (focusInList) {
            focusedOutsideFilter.value = false;
            return;
          }
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
  focusFailureReceipt.value = null;
  await loadRehearsals(selectedId.value, { pinFocus: false, syncRoute: true });
}

async function selectRehearsal(id: string) {
  selectedId.value = id;
  focusedOutsideFilter.value = false;
  actionMessage.value = '';
  actionReceipt.value = null;
  focusFailureReceipt.value = null;
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
  const rehearsal = selected.value;
  if (!rehearsal) return;
  const previousStatus = rehearsal.status;
  const action =
    status === 'paused' ? 'pause' : previousStatus === 'paused' ? 'restore' : 'status';
  await runRehearsalAction(action, rehearsal, previousStatus, async () => {
    const response = await client.updateRehearsal(rehearsal.id, { status });
    replaceSelected(response.rehearsal);
    actionMessage.value =
      status === 'paused' ? '已暂停，这条预演不会进入场景提示。' : '状态已更新。';
    actionReceipt.value = buildActionReceipt(
      action,
      response.rehearsal,
      previousStatus,
      activations.value,
    );
  });
}

async function reactivateSelected() {
  const rehearsal = selected.value;
  if (!rehearsal) return;
  const expired = isExpired(rehearsal);
  const previousStatus = rehearsal.status;
  const action = previousStatus === 'candidate' ? 'restore' : 'reactivate';
  await runRehearsalAction(action, rehearsal, previousStatus, async () => {
    const response = await client.updateRehearsal(rehearsal.id, {
      status: 'active',
      staleReason: null,
      ...(expired ? { validUntil: null } : {}),
    });
    replaceSelected(response.rehearsal);
    actionMessage.value = expired
      ? '已清除过期时间并恢复为 Active。'
      : '已恢复为 Active。';
    actionReceipt.value = buildActionReceipt(
      action,
      response.rehearsal,
      previousStatus,
      activations.value,
    );
  });
}

async function markUsed() {
  const rehearsal = selected.value;
  if (!rehearsal) return;
  const previousStatus = rehearsal.status;
  await runRehearsalAction('mark-used', rehearsal, previousStatus, async () => {
    const response = await client.submitRehearsalFeedback(rehearsal.id, {
      outcome: 'used',
    });
    replaceSelected(response.rehearsal);
    actionMessage.value = '已标记使用，后续可保留审计或归档。';
    actionReceipt.value = buildActionReceipt(
      'mark-used',
      response.rehearsal,
      previousStatus,
      activations.value,
    );
    await loadDetail(response.rehearsal.id);
  });
}

async function markIrrelevant() {
  const rehearsal = selected.value;
  if (!rehearsal) return;
  const previousStatus = rehearsal.status;
  await runRehearsalAction('mark-irrelevant', rehearsal, previousStatus, async () => {
    const response = await client.submitRehearsalFeedback(rehearsal.id, {
      outcome: 'irrelevant',
    });
    replaceSelected(response.rehearsal);
    actionMessage.value = '已标记不相关，这条预演会退出场景提示。';
    actionReceipt.value = buildActionReceipt(
      'mark-irrelevant',
      response.rehearsal,
      previousStatus,
      activations.value,
    );
    await loadDetail(response.rehearsal.id);
  });
}

async function archiveSelected() {
  const rehearsal = selected.value;
  if (!rehearsal) return;
  const previousStatus = rehearsal.status;
  await runRehearsalAction('archive', rehearsal, previousStatus, async () => {
    const response = await client.deleteRehearsal(rehearsal.id);
    replaceSelected(response.rehearsal);
    actionMessage.value = '已归档为审计记录。';
    actionReceipt.value = buildActionReceipt(
      'archive',
      response.rehearsal,
      previousStatus,
      activations.value,
    );
  });
}

async function runRehearsalAction(
  action: RehearsalActionKind,
  rehearsal: Rehearsal,
  previousStatus: RehearsalStatus,
  operation: () => Promise<void>,
) {
  if (actionPending.value) return;
  actionPending.value = true;
  try {
    await operation();
  } catch (error) {
    console.error('Failed to update rehearsal:', error);
    actionMessage.value = '处理失败：Memory Service 未确认写入，当前状态保持不变。';
    actionReceipt.value = buildActionFailureReceipt(
      action,
      rehearsal,
      previousStatus,
      activations.value,
    );
  } finally {
    actionPending.value = false;
  }
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

async function retryFocusLookup() {
  const id = focusFailureReceipt.value?.requestedId;
  if (!id) return;
  await loadRehearsals(id, { pinFocus: true });
}

async function showAllAfterFocusFailure() {
  statusFilter.value = 'all';
  searchText.value = '';
  selectedId.value = '';
  focusFailureReceipt.value = null;
  await loadRehearsals('', { syncRoute: true });
}

async function showAllFromEmptyState() {
  statusFilter.value = 'all';
  searchText.value = '';
  selectedId.value = '';
  focusFailureReceipt.value = null;
  await loadRehearsals('', { syncRoute: true });
}

async function clearSearchFromEmptyState() {
  searchText.value = '';
  selectedId.value = '';
  focusFailureReceipt.value = null;
  await loadRehearsals('', { syncRoute: true });
}

function buildFocusFailureReceipt(requestedId: string, focusInList: boolean): FocusFailureReceipt {
  const filterLabel = currentFilterLabel();
  return {
    requestedId,
    title: '深链目标未确认',
    summary: focusInList
      ? `已在「${filterLabel}」列表中看到 ${requestedId}，但详情和命中历史没有加载成功。`
      : `没有在「${filterLabel}」列表中看到 ${requestedId}，并且详情请求没有返回可用目标。`,
    boundary:
      '这不代表目标已被删除、归档或标记不相关；当前列表只是继续显示可用结果，不能当作该深链目标的详情。',
    recovery:
      '可以重试目标详情，或切到 All 重新浏览；改状态前先确认目标标题、脚本和触发线索都对应正确。',
  };
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

function buildListScopeReceipt(
  rows: Rehearsal[],
  selectedRehearsal: Rehearsal | null,
  hasPinnedFocus: boolean,
): ListScopeReceipt {
  const filterLabel = currentFilterLabel();
  const cueLessCount = rows.filter((item) => !hasFutureSceneCue(item)).length;
  const weakOnlyCount = rows.filter(
    (item) => cueStrength(item.activationCues) === 'weak',
  ).length;
  const pinnedLabel =
    hasPinnedFocus && selectedRehearsal
      ? `${statusLabel(selectedRehearsal.status)} · 临时置顶`
      : '无';
  return {
    title: `${filterLabel} · ${rows.length} 条`,
    rows: [
      { label: '读取范围', value: filterLabel },
      { label: '可见结果', value: `${rows.length} 条` },
      {
        label: '缺少 future cue',
        value: cueLessCount ? `${cueLessCount} 条仅审计` : '0 条',
      },
      {
        label: '仅弱线索',
        value: weakOnlyCount ? `${weakOnlyCount} 条需补锚点` : '0 条',
      },
      { label: '深链置顶', value: pinnedLabel },
    ],
    summary: listScopeSummary(
      filterLabel,
      rows,
      cueLessCount,
      weakOnlyCount,
      selectedRehearsal,
      hasPinnedFocus,
    ),
    boundary:
      '切换筛选、搜索、查看 All 或深链定位只读取和置顶本页列表；不会激活、暂停、归档、标记反馈、写入外部系统或执行预演脚本。',
  };
}

function listScopeSummary(
  filterLabel: string,
  rows: Rehearsal[],
  cueLessCount: number,
  weakOnlyCount: number,
  selectedRehearsal: Rehearsal | null,
  hasPinnedFocus: boolean,
) {
  const base = hasPinnedFocus && selectedRehearsal
    ? `当前按「${filterLabel}」读取列表，同时临时置顶 ${statusLabel(
        selectedRehearsal.status,
      )} Rehearsal 用于深链审计。`
    : `当前按「${filterLabel}」读取列表；列表命中只说明它符合状态或搜索条件，不等于会进入现场提示。`;
  if (!rows.length) {
    return `${base} 当前没有可见结果。`;
  }
  if (cueLessCount > 0 || weakOnlyCount > 0) {
    const parts = [];
    if (cueLessCount > 0) parts.push(`${cueLessCount} 条缺少结构化 future cue`);
    if (weakOnlyCount > 0) parts.push(`${weakOnlyCount} 条只有关键词/主题/surface 弱线索`);
    return `${base} 其中 ${parts.join('，')}；先按卡片补锚点、暂停或继续观察。`;
  }
  return `${base} 可见条目仍需按卡片提示资格判断 active、candidate、stale 或 archived 的现场消费边界。`;
}

function buildEmptyFilterReceipt(): EmptyFilterReceipt {
  const filterLabel = currentFilterLabel();
  const hasSearch = Boolean(searchText.value.trim());
  return {
    title: '空筛选回执',
    summary: `${filterLabel} · 0 条`,
    rows: [
      { label: '读取范围', value: filterLabel },
      { label: '可见结果', value: '0 条' },
      { label: '状态含义', value: '成功读取空结果' },
      { label: '下一步', value: hasSearch ? '清空搜索或查看 All' : '查看 All 或刷新' },
    ],
    boundary:
      '这只是当前筛选或搜索没有可见 Rehearsal；不代表预演被删除、归档、暂停、标记不相关，也没有写入外部系统或执行预演脚本。',
    recovery: hasSearch
      ? '可以清空搜索回到当前状态筛选，也可以查看 All 重新浏览全部 Rehearsal。'
      : '可以查看 All 扩大范围，或刷新当前筛选确认 Memory Service 的最新结果。',
  };
}

function buildActionReceipt(
  action: RehearsalActionKind,
  rehearsal: Rehearsal,
  previousStatus: RehearsalStatus,
  rows: RehearsalActivation[],
): ActionReceipt {
  return {
    title: actionReceiptTitle(action),
    summary: `${statusLabel(previousStatus)} -> ${statusLabel(rehearsal.status)}`,
    tone: actionReceiptTone(action, rehearsal.status),
    rows: [
      { label: '当前状态', value: statusLabel(rehearsal.status) },
      { label: '现场提示', value: promptEligibilityLabel(rehearsal.status, rehearsal) },
      {
        label: '审计保留',
        value: `来源 ${rehearsal.evidenceRefs.length} · 触发 ${rows.length}`,
      },
      { label: '恢复/复核', value: actionRecoveryLabel(action, rehearsal.status) },
    ],
    boundary: actionBoundary(action),
    recovery: actionRecovery(action, rehearsal.status),
  };
}

function buildActionFailureReceipt(
  action: RehearsalActionKind,
  rehearsal: Rehearsal,
  previousStatus: RehearsalStatus,
  rows: RehearsalActivation[],
): ActionReceipt {
  return {
    title: '写入失败回执',
    summary: `${actionReceiptTitle(action)} 未确认`,
    tone: 'error',
    rows: [
      { label: '当前状态', value: statusLabel(previousStatus) },
      { label: '写入结果', value: '未确认写入' },
      { label: '现场提示', value: promptEligibilityLabel(previousStatus, rehearsal) },
      {
        label: '审计保留',
        value: `来源 ${rehearsal.evidenceRefs.length} · 触发 ${rows.length}`,
      },
      { label: '恢复/复核', value: '检查服务后重试' },
    ],
    boundary:
      '本次请求失败，Personal AI 没有确认更新 Rehearsal 状态；现场提示资格、来源证据和触发历史都按原状态保留。',
    recovery:
      '请确认 Memory Service 可用后重试同一动作；不要把这次失败当成已暂停、已归档或已标记不相关。',
  };
}

function actionReceiptTitle(action: RehearsalActionKind) {
  const labels: Record<RehearsalActionKind, string> = {
    pause: '暂停回执',
    restore: '激活回执',
    reactivate: '重新激活回执',
    'mark-used': '已使用回执',
    'mark-irrelevant': '不相关回执',
    archive: '归档回执',
    status: '状态回执',
  };
  return labels[action];
}

function actionReceiptTone(
  action: RehearsalActionKind,
  status: RehearsalStatus,
): ActionReceipt['tone'] {
  if (action === 'archive' || action === 'mark-irrelevant' || status === 'dismissed') {
    return 'warning';
  }
  if (status === 'active') return 'success';
  return 'neutral';
}

function promptEligibilityLabel(status: RehearsalStatus, rehearsal?: Rehearsal) {
  if (rehearsal && !hasFutureSceneCue(rehearsal)) {
    return '缺少线索，不应现场提示';
  }
  if (rehearsal && cueStrength(rehearsal.activationCues) === 'weak') {
    if (status === 'active') return '会参与，但只有弱线索';
    if (status === 'candidate') return '弱线索候选，先补锚点';
    if (status === 'stale') return '弱线索降权，只做弱提示';
    return '弱线索，恢复前先复核';
  }
  if (status === 'active') return '会参与现场匹配';
  if (status === 'candidate') return '候选观察，强命中后才转正';
  if (status === 'stale') return '降权保留，只做弱提示';
  return '不会进入现场提示';
}

function hasFutureSceneCue(rehearsal: Rehearsal) {
  return cueStrength(rehearsal.activationCues) !== 'missing';
}

function buildScenarioReadiness(
  rehearsal: Rehearsal | null,
  rows: RehearsalActivation[],
): ScenarioReadiness {
  if (!rehearsal) {
    return {
      tone: 'quiet',
      rows: [
        { label: '未来线索', value: '-' },
        { label: '现场提示', value: '-' },
        { label: '审计保留', value: '-' },
        { label: '动作边界', value: '只读审计' },
      ],
      summary: '请选择一条 Rehearsal 查看场景资格。',
      boundary: '本页只审计和处理预演脚本；不会自动发送、写入外部系统或替用户执行动作。',
    };
  }

  const hasCue = hasFutureSceneCue(rehearsal);
  return {
    tone: scenarioReadinessTone(rehearsal, hasCue),
    rows: [
      { label: '未来线索', value: futureCueSummary(rehearsal.activationCues) },
      { label: '线索强度', value: cueStrengthLabel(rehearsal.activationCues) },
      { label: '现场提示', value: promptEligibilityLabel(rehearsal.status, rehearsal) },
      {
        label: '审计保留',
        value: `来源 ${rehearsal.evidenceRefs.length} · 触发 ${rows.length}`,
      },
      { label: '动作边界', value: '只提示脚本，不自动执行' },
    ],
    summary: scenarioReadinessSummary(rehearsal, hasCue),
    boundary:
      '管理页浏览、筛选和复核只是本地审计；预演命中也只提示脚本，不发送消息、写入外部系统或替用户执行动作。',
  };
}

function scenarioReadinessTone(
  rehearsal: Rehearsal,
  hasCue: boolean,
): ScenarioReadiness['tone'] {
  if (
    !hasCue ||
    cueStrength(rehearsal.activationCues) === 'weak' ||
    rehearsal.status === 'stale' ||
    rehearsal.status === 'candidate'
  ) {
    return 'warning';
  }
  if (['archived', 'dismissed', 'used', 'paused'].includes(rehearsal.status)) {
    return 'quiet';
  }
  return 'ready';
}

function cardReadinessTone(rehearsal: Rehearsal) {
  if (!hasFutureSceneCue(rehearsal)) return 'warning';
  if (cueStrength(rehearsal.activationCues) === 'weak') return 'warning';
  if (rehearsal.status === 'stale' || rehearsal.status === 'candidate') return 'warning';
  if (['archived', 'dismissed', 'used', 'paused'].includes(rehearsal.status)) {
    return 'quiet';
  }
  return 'ready';
}

function cardReadinessBoundary(rehearsal: Rehearsal) {
  if (!hasFutureSceneCue(rehearsal)) {
    return '先补 future cue，再恢复现场提示';
  }
  if (cueStrength(rehearsal.activationCues) === 'weak') {
    return '仅弱泛化线索，先补人物/会议/issue/URL';
  }
  if (rehearsal.status === 'active') {
    return '只提示脚本，不自动发送/写入/执行';
  }
  if (rehearsal.status === 'candidate') {
    return '候选观察，确认线索后再激活';
  }
  if (rehearsal.status === 'stale') {
    return '降权保留，强命中也先弱提示';
  }
  if (rehearsal.status === 'paused') {
    return '已暂停，不进入现场消费';
  }
  if (rehearsal.status === 'used') {
    return '已使用，主要保留审计';
  }
  if (rehearsal.status === 'dismissed') {
    return '已标记不相关，恢复前先复核';
  }
  return '已归档，不再进入现场提示';
}

function scenarioReadinessSummary(rehearsal: Rehearsal, hasCue: boolean) {
  if (!hasCue) {
    return '这条预演没有可识别的未来场景；先补人物、项目、issue、URL、主题或 surface，再恢复现场提示。';
  }
  if (cueStrength(rehearsal.activationCues) === 'weak') {
    return '这条预演只有主题、关键词或 surface 等泛化弱线索；可能在相似文本里误提示，建议补人物、项目、会话、会议、issue 或 URL 锚点后再长期依赖。';
  }
  if (rehearsal.status === 'active') {
    return '这条预演具备未来线索且处于 Active；继续复核线索是否过宽、脚本是否仍适合当前场景。';
  }
  if (rehearsal.status === 'candidate') {
    return '这条预演仍是候选；确认线索稳定后再激活，避免把弱联想直接推到现场。';
  }
  if (rehearsal.status === 'stale') {
    return '这条预演已降权保留；即使再次命中也应先作为弱提示，重新激活前需要复核来源和触发历史。';
  }
  if (rehearsal.status === 'paused') {
    return '这条预演已暂停；恢复只会重新参与场景匹配，不会执行脚本内容。';
  }
  if (rehearsal.status === 'used') {
    return '这条预演已标记使用；通常保留审计，反复复用时再考虑沉淀为 Personal Skill。';
  }
  if (rehearsal.status === 'dismissed') {
    return '这条预演被标记不相关；恢复前先检查线索是否过宽或脚本是否已经过期。';
  }
  return '这条预演已归档；默认只保留审计，不再进入现场提示。';
}

function futureCueSummary(cues: RehearsalActivationCues) {
  const rows = cueRows(cues);
  if (!rows.length) return '缺少结构化线索';
  const totalValues = Object.values(cues || {}).reduce((count, values) => {
    if (!Array.isArray(values)) return count;
    return count + values.map((value) => String(value || '').trim()).filter(Boolean).length;
  }, 0);
  const labels = rows.slice(0, 3).map((row) => row.label).join(' / ');
  return `${labels}${rows.length > 3 ? ` +${rows.length - 3}` : ''} · ${totalValues} 个值 · ${cueStrengthLabel(cues)}`;
}

function cueStrength(cues: RehearsalActivationCues): CueStrength {
  const anchoredCount = cueValueCount(cues, ANCHORED_CUE_KEYS);
  if (anchoredCount > 0) return 'anchored';
  const weakCount = cueValueCount(cues, WEAK_CUE_KEYS);
  return weakCount > 0 ? 'weak' : 'missing';
}

function cueStrengthLabel(cues: RehearsalActivationCues) {
  const strength = cueStrength(cues);
  if (strength === 'anchored') return '有锚定线索';
  if (strength === 'weak') return '仅弱泛化线索';
  return '缺少线索';
}

function cueValueCount(
  cues: RehearsalActivationCues,
  keys: Array<keyof RehearsalActivationCues>,
) {
  return keys.reduce((count, key) => {
    const values = cues?.[key];
    if (!Array.isArray(values)) return count;
    return count + values.map((value) => String(value || '').trim()).filter(Boolean).length;
  }, 0);
}

function actionRecoveryLabel(action: RehearsalActionKind, status: RehearsalStatus) {
  if (status === 'active') return '可暂停或标记不相关';
  if (status === 'paused') return '点击恢复';
  if (status === 'dismissed') return '点击恢复待观察';
  if (status === 'archived') return '用 Archived / All 复查';
  if (action === 'mark-used') return '保留审计或沉淀技能';
  return '继续观察';
}

function actionBoundary(action: RehearsalActionKind) {
  const labels: Record<RehearsalActionKind, string> = {
    pause: '暂停只停止后续现场消费；脚本、来源证据和历史命中仍保留在管理页。',
    restore: '激活只让候选回到场景匹配；不会自动发送消息或替用户执行动作。',
    reactivate: '重新激活只恢复场景匹配；不会自动发送消息或替用户执行动作。',
    'mark-used': '标记已使用会退出普通现场提示；脚本和命中历史仍作为审计记录保留。',
    'mark-irrelevant': '不相关会降权并退出现场提示；这不是物理删除，来源证据仍可复核。',
    archive: '归档只把这条预演变成审计记录；不会删除来源系统或 Memory Service 里的其他记忆。',
    status: '状态更新只影响这条 Rehearsal 的现场匹配资格，不改变来源证据。',
  };
  return labels[action];
}

function actionRecovery(action: RehearsalActionKind, status: RehearsalStatus) {
  if (status === 'active') {
    return '如果后续再次误命中，可以直接暂停或标记不相关。';
  }
  if (status === 'paused') {
    return '需要重新参与场景提示时，点击「恢复」。';
  }
  if (status === 'dismissed') {
    return '需要重新观察时，点击「恢复待观察」，再从命中诊断复核线索是否过宽。';
  }
  if (status === 'archived') {
    return '后续复查请切到 Archived 或 All；归档项默认不再进入现场提示。';
  }
  if (action === 'mark-used') {
    return '如果脚本仍会反复复用，后续更适合沉淀为 Personal Skill。';
  }
  return '继续观察后续命中，并用来源证据确认这条脚本是否仍可信。';
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

function scenarioLabel(scenario: string) {
  const labels: Record<string, string> = {
    chat: '聊天',
    meeting: '会议',
    issue: '工单',
    writing: '写作',
    general: '通用',
  };
  return labels[scenario] || scenario || '通用';
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

function buildActivationDiagnostics(
  rehearsal: Rehearsal | null,
  rows: RehearsalActivation[],
) {
  if (!rehearsal) {
    return {
      latestLabel: '-',
      highestScoreLabel: '-',
      feedbackLabel: '-',
      surfaceLabel: '-',
      recommendation: '请选择一条 Rehearsal 查看命中诊断。',
    };
  }
  if (!cueRows(rehearsal.activationCues).length) {
    return {
      latestLabel: '缺少线索',
      highestScoreLabel: '-',
      feedbackLabel: `正向 ${rehearsal.usedCount} · 负向 ${rehearsal.dismissedCount}`,
      surfaceLabel: '不会可靠触发',
      recommendation:
        '这条预演缺少未来场景边界；先补充人物、项目、issue、URL、主题或 surface，再恢复现场提示。',
    };
  }
  if (!rows.length) {
    return {
      latestLabel: '暂无触发',
      highestScoreLabel: '-',
      feedbackLabel: `正向 ${rehearsal.usedCount} · 负向 ${rehearsal.dismissedCount}`,
      surfaceLabel: '暂无入口',
      recommendation:
        '还没有现场命中记录；优先检查触发条件和来源证据，避免为了管理页手动激活弱线索。',
    };
  }

  const sorted = [...rows].sort((a, b) => b.createdAt - a.createdAt);
  const latest = sorted[0];
  const highestScore = sorted.reduce(
    (max, activation) => Math.max(max, activation.score),
    0,
  );
  const positiveCount = rows.filter((activation) =>
    ['accepted', 'used'].includes(activation.outcome),
  ).length;
  const negativeCount = rows.filter((activation) =>
    ['dismissed', 'irrelevant', 'ignored'].includes(activation.outcome),
  ).length;
  const surfaceLabel = summarizeSurfaces(rows);
  return {
    latestLabel: `${activationOutcomeLabel(latest.outcome)} · ${latest.surface}`,
    highestScoreLabel: highestScore.toFixed(2),
    feedbackLabel: `正向 ${positiveCount + rehearsal.usedCount} · 负向 ${
      negativeCount + rehearsal.dismissedCount
    }`,
    surfaceLabel,
    recommendation: activationRecommendation(rehearsal, {
      highestScore,
      negativeCount,
      positiveCount,
    }),
  };
}

function summarizeSurfaces(rows: RehearsalActivation[]) {
  const counts = new Map<string, number>();
  for (const activation of rows) {
    const label = [activation.surface, activation.contextType]
      .map((value) => String(value || '').trim())
      .filter(Boolean)
      .join(' / ');
    counts.set(label || '未知入口', (counts.get(label || '未知入口') ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 2)
    .map(([label, count]) => (count > 1 ? `${label} x${count}` : label))
    .join(' · ');
}

function activationRecommendation(
  rehearsal: Rehearsal,
  stats: { highestScore: number; negativeCount: number; positiveCount: number },
) {
  if (rehearsal.status === 'archived') {
    return '这条已归档，只保留审计；不要让它回到现场提示，除非来源证据重新变强。';
  }
  if (rehearsal.status === 'used') {
    return '这条已经使用过；如果脚本仍可复用，后续更适合沉淀为 Personal Skill。';
  }
  if (rehearsal.status === 'dismissed' || stats.negativeCount > 0) {
    return '最近有负反馈；先检查命中线索是否过宽，再决定恢复、暂停或继续标记不相关。';
  }
  if (rehearsal.status === 'stale' && stats.highestScore >= 0.72) {
    return '曾经高分命中且没有负反馈；如果来源仍可信，可以重新激活。';
  }
  if (rehearsal.status === 'candidate' && stats.highestScore >= 0.72) {
    return '候选已经出现强命中；确认未来场景边界后可以激活。';
  }
  if (stats.positiveCount > 0) {
    return '已有正向反馈；保持当前触发边界，后续可观察是否需要沉淀成技能。';
  }
  if (stats.highestScore < 0.55) {
    return '最近命中偏弱；优先补充人物、项目、issue 或 URL 等稳定线索。';
  }
  return '当前命中质量正常；可继续让它进入现场提示。';
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
  animation: fadeInUp 0.35s ease-out;
  color: #e2e8f0;
}

.rehearsal-hero {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 1rem;
}

.hero-copy {
  max-width: 720px;
}

.eyebrow {
  margin-bottom: 0.35rem;
  color: #93c5fd;
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0;
}

.rehearsal-hero h2 {
  margin: 0 0 0.45rem;
  font-size: 1.55rem;
}

.rehearsal-hero p {
  margin: 0;
  color: #94a3b8;
  font-size: 0.94rem;
  line-height: 1.6;
}

.header-controls {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.6rem;
  max-width: 520px;
}

.filter-select,
.search-input {
  background: rgba(15, 23, 42, 0.72);
  border: 1px solid rgba(148, 163, 184, 0.22);
  color: #e2e8f0;
  border-radius: 8px;
  padding: 0.7rem 0.9rem;
}

.search-input {
  min-width: min(100%, 300px);
}

.refresh-btn,
.detail-actions button,
.focus-notice button,
.focus-failure-actions button,
.empty-filter-actions button {
  border: 1px solid rgba(59, 130, 246, 0.38);
  border-radius: 8px;
  padding: 0.68rem 0.9rem;
  background: rgba(37, 99, 235, 0.18);
  color: #dbeafe;
  cursor: pointer;
}

.usage-strip {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.7rem;
  margin-bottom: 1.2rem;
  padding: 0.75rem;
  border: 1px solid rgba(148, 163, 184, 0.16);
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.38);
}

.usage-strip div {
  min-width: 0;
}

.usage-strip span,
.list-summary span,
.section-title small,
.fact-grid span,
.cue-row span,
.evidence-row span {
  display: block;
  color: #94a3b8;
  font-size: 0.75rem;
}

.usage-strip strong {
  display: block;
  margin-top: 0.18rem;
  color: #e2e8f0;
  font-size: 0.86rem;
  line-height: 1.45;
}

.detail-actions .danger {
  border-color: rgba(248, 113, 113, 0.45);
  color: #fecaca;
  background: rgba(127, 29, 29, 0.28);
}

.detail-actions button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
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

.focus-failure-receipt {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
  border: 1px solid rgba(245, 158, 11, 0.36);
  border-radius: 8px;
  padding: 0.85rem 0.95rem;
  background: rgba(120, 53, 15, 0.18);
  color: #fef3c7;
}

.focus-failure-receipt strong {
  display: block;
  color: #fde68a;
}

.focus-failure-receipt p {
  margin: 0.45rem 0 0;
  color: #fef3c7;
  line-height: 1.5;
}

.focus-failure-actions {
  display: flex;
  flex: 0 0 auto;
  flex-wrap: wrap;
  gap: 0.5rem;
  justify-content: flex-end;
}

.focus-failure-actions button {
  padding: 0.55rem 0.75rem;
}

.next-step-banner,
.diagnostic-panel,
.scenario-readiness-panel,
.action-message,
.action-receipt {
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

.action-receipt {
  border-color: rgba(59, 130, 246, 0.26);
  background: rgba(30, 64, 175, 0.14);
  color: #dbeafe;
}

.action-receipt.success {
  border-color: rgba(34, 197, 94, 0.32);
  background: rgba(20, 83, 45, 0.18);
}

.action-receipt.warning {
  border-color: rgba(245, 158, 11, 0.34);
  background: rgba(120, 53, 15, 0.18);
}

.action-receipt.error {
  border-color: rgba(248, 113, 113, 0.42);
  background: rgba(127, 29, 29, 0.2);
}

.action-receipt p {
  margin: 0.65rem 0 0;
  color: #cbd5e1;
  line-height: 1.55;
}

.diagnostic-panel {
  border-color: rgba(20, 184, 166, 0.28);
  background: rgba(13, 78, 88, 0.18);
}

.scenario-readiness-panel {
  border-color: rgba(99, 102, 241, 0.34);
  background: rgba(30, 41, 59, 0.58);
}

.scenario-readiness-panel.ready {
  border-color: rgba(34, 197, 94, 0.32);
  background: rgba(20, 83, 45, 0.16);
}

.scenario-readiness-panel.warning {
  border-color: rgba(245, 158, 11, 0.36);
  background: rgba(120, 53, 15, 0.18);
}

.scenario-readiness-panel.quiet {
  border-color: rgba(148, 163, 184, 0.2);
  background: rgba(15, 23, 42, 0.42);
}

.diagnostic-panel p {
  margin: 0.75rem 0 0;
  color: #ccfbf1;
  line-height: 1.5;
}

.scenario-readiness-panel p {
  margin: 0.65rem 0 0;
  color: #dbeafe;
  line-height: 1.55;
}

.loading-state,
.empty-state {
  color: #94a3b8;
  padding: 2rem;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 8px;
}

.empty-filter-receipt {
  display: grid;
  gap: 0.75rem;
  border-color: rgba(59, 130, 246, 0.24);
  background: rgba(30, 64, 175, 0.12);
  color: #dbeafe;
}

.empty-filter-receipt p {
  margin: 0;
  color: #cbd5e1;
  line-height: 1.55;
}

.empty-filter-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem;
}

.rehearsal-layout {
  display: grid;
  grid-template-columns: minmax(300px, 380px) minmax(0, 1fr);
  gap: 1.05rem;
  align-items: start;
}

.rehearsal-list {
  display: grid;
  gap: 0.8rem;
  align-content: start;
}

.list-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  color: #cbd5e1;
}

.list-summary strong {
  font-size: 1.35rem;
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
  line-height: 1.25;
}

.rehearsal-card p {
  color: #cbd5e1;
  margin: 0 0 0.65rem;
  line-height: 1.35;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-readiness {
  display: grid;
  gap: 0.24rem;
  margin-bottom: 0.7rem;
  border: 1px solid rgba(148, 163, 184, 0.14);
  border-radius: 8px;
  padding: 0.55rem 0.62rem;
  background: rgba(15, 23, 42, 0.42);
}

.card-readiness.ready {
  border-color: rgba(34, 197, 94, 0.26);
  background: rgba(20, 83, 45, 0.14);
}

.card-readiness.warning {
  border-color: rgba(245, 158, 11, 0.3);
  background: rgba(120, 53, 15, 0.16);
}

.card-readiness.quiet {
  border-color: rgba(148, 163, 184, 0.16);
  background: rgba(15, 23, 42, 0.36);
}

.card-readiness span,
.card-readiness small {
  color: #94a3b8;
  font-size: 0.72rem;
  line-height: 1.25;
}

.card-readiness strong {
  color: #e2e8f0;
  font-size: 0.82rem;
  line-height: 1.3;
  overflow-wrap: anywhere;
}

.list-scope-receipt {
  display: grid;
  gap: 0.65rem;
  border: 1px solid rgba(59, 130, 246, 0.24);
  border-radius: 8px;
  padding: 0.72rem 0.78rem;
  background: rgba(30, 64, 175, 0.12);
  color: #dbeafe;
}

.list-scope-title {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.75rem;
}

.list-scope-title span {
  color: #93c5fd;
  font-size: 0.76rem;
  font-weight: 800;
}

.list-scope-title strong {
  color: #e2e8f0;
  font-size: 0.86rem;
}

.list-scope-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.45rem;
}

.list-scope-grid > div {
  border: 1px solid rgba(148, 163, 184, 0.12);
  border-radius: 8px;
  padding: 0.52rem;
  background: rgba(15, 23, 42, 0.34);
}

.list-scope-grid span {
  display: block;
  color: #bfdbfe;
  font-size: 0.72rem;
}

.list-scope-grid strong {
  display: block;
  margin-top: 0.2rem;
  color: #e2e8f0;
  font-size: 0.82rem;
  overflow-wrap: anywhere;
}

.list-scope-receipt p {
  margin: 0;
  color: #cbd5e1;
  font-size: 0.78rem;
  line-height: 1.45;
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

.detail-header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid rgba(148, 163, 184, 0.14);
}

.detail-header h3 {
  margin: 0.45rem 0 0.35rem;
  font-size: 1.3rem;
  line-height: 1.3;
}

.detail-header p,
.script-panel p,
.muted,
.source-ref,
.stale-reason {
  margin: 0;
  color: #cbd5e1;
  line-height: 1.6;
}

.detail-actions {
  display: flex;
  align-items: flex-start;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 0.55rem;
  min-width: 260px;
}

.script-panel,
.detail-section {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid rgba(148, 163, 184, 0.14);
}

.script-panel {
  padding: 1rem;
  border: 1px solid rgba(59, 130, 246, 0.18);
  border-radius: 8px;
  background: rgba(30, 64, 175, 0.12);
}

.section-title {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.7rem;
}

.section-title span {
  font-weight: 800;
  color: #f8fafc;
}

.cue-columns,
.fact-grid,
.diagnostic-grid,
.readiness-grid,
.receipt-grid,
.evidence-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 0.7rem;
}

.two-column {
  display: grid;
  grid-template-columns: minmax(240px, 0.95fr) minmax(260px, 1.05fr);
  gap: 1rem;
}

.cue-row,
.cue-boundary-warning,
.evidence-row,
.receipt-grid > div,
.diagnostic-grid > div,
.readiness-grid > div,
.fact-grid > div,
.activation-row {
  border: 1px solid rgba(148, 163, 184, 0.12);
  border-radius: 8px;
  padding: 0.65rem;
  background: rgba(15, 23, 42, 0.46);
}

.cue-boundary-warning {
  display: grid;
  gap: 0.35rem;
  border-color: rgba(245, 158, 11, 0.34);
  background: rgba(120, 53, 15, 0.18);
  color: #fde68a;
}

.cue-boundary-warning span {
  color: #fef3c7;
  line-height: 1.55;
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

.source-ref,
.stale-reason {
  margin-top: 0.7rem;
  padding: 0.7rem;
  border: 1px solid rgba(148, 163, 184, 0.1);
  border-radius: 8px;
  overflow-wrap: anywhere;
  background: rgba(15, 23, 42, 0.28);
  font-size: 0.82rem;
}

.stale-reason {
  color: #fde68a;
}

.outcome-badge {
  border-radius: 999px;
  padding: 0.16rem 0.48rem;
  background: rgba(148, 163, 184, 0.16);
  color: #e2e8f0;
}

.cue-row strong,
.receipt-grid strong,
.diagnostic-grid strong,
.readiness-grid strong,
.fact-grid strong,
.evidence-row strong {
  display: block;
  margin-top: 0.25rem;
  color: #e2e8f0;
  font-size: 0.9rem;
  overflow-wrap: anywhere;
}

.diagnostic-grid span {
  display: block;
  color: #99f6e4;
  font-size: 0.75rem;
}

.readiness-grid span {
  display: block;
  color: #bfdbfe;
  font-size: 0.75rem;
}

.receipt-grid span {
  display: block;
  color: #bfdbfe;
  font-size: 0.75rem;
}

@media (max-width: 900px) {
  .rehearsal-hero,
  .detail-header {
    flex-direction: column;
  }

  .usage-strip,
  .rehearsal-layout {
    grid-template-columns: 1fr;
  }

  .two-column {
    grid-template-columns: 1fr;
  }

  .detail-actions {
    min-width: 0;
    justify-content: flex-start;
  }

  .focus-failure-receipt {
    flex-direction: column;
  }

  .focus-failure-actions {
    justify-content: flex-start;
  }

  .list-scope-grid {
    grid-template-columns: 1fr;
  }
}
</style>
