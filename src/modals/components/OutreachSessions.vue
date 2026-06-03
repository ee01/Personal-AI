<template>
  <div class="outreach-page">
    <div class="page-header">
      <div>
        <h2>主动询问</h2>
        <p>
          查看待触发计划、已排程待发出、等待回复和已完成的主动询问。系统内部观察规则采集到的证据会在这里按会话展示。
        </p>
      </div>

      <div class="summary-row">
        <span class="summary-pill"
          >待触发计划 {{ visibleTemplates.length }}</span
        >
        <span class="summary-pill"
          >已排程待发出 {{ queuedSessions.length }}</span
        >
        <span class="summary-pill"
          >等待回复 {{ summary.waitingReplyCount }}</span
        >
        <span class="summary-pill danger"
          >已升级 {{ summary.escalatedCount }}</span
        >
        <span class="summary-pill warn"
          >待审批 {{ summary.pendingApprovalCount }}</span
        >
      </div>
    </div>

    <div v-if="showSetupBanner" class="setup-banner">
      <div>
        <div class="setup-title">{{ setupBannerTitle }}</div>
        <p class="setup-text">{{ setupBannerText }}</p>
      </div>
      <button class="setup-btn" @click="openOptionsPage">
        前往主动询问配置
      </button>
    </div>

    <div class="info-banner">
      <div class="info-banner-title">系统观察规则不会进入记忆入口规则列表</div>
      <p class="info-banner-text">
        帮我问 / 自我反思等内部观察命中会在主动询问 session
        中展示为证据状态，而不会写成用户可编辑的记忆入口规则。
      </p>
    </div>

    <div class="filters">
      <select v-model="status" class="filter-select" @change="applyFilters">
        <option value="all">全部状态</option>
        <option value="pending_approval">待审批</option>
        <option value="scheduled">已排程</option>
        <option value="waiting_reply">等待回复</option>
        <option value="deferred">延期等待</option>
        <option value="resolved">已拿到结果</option>
        <option value="no_reply">无回复</option>
        <option value="escalated">已升级</option>
        <option value="cancelled">已取消</option>
        <option value="failed">失败</option>
      </select>
      <select v-model="originKind" class="filter-select" @change="applyFilters">
        <option value="">全部来源</option>
        <option value="manual">手动/定时</option>
        <option value="message_reaction">消息跟进</option>
        <option value="reflection">自我反思</option>
      </select>
      <input
        v-model="templateId"
        class="filter-input"
        placeholder="计划 ID"
        @keydown.enter="applyFilters"
      />
      <input
        v-model="threadId"
        class="filter-input"
        placeholder="threadId"
        @keydown.enter="applyFilters"
      />
      <button class="refresh-btn" @click="loadData">刷新</button>
    </div>

    <div v-if="loadError && !loading" class="load-error-banner" role="alert">
      <div>
        <div class="load-error-title">主动询问数据加载失败</div>
        <p class="load-error-text">{{ loadError }}</p>
        <p v-if="hasLoadedData" class="load-error-text muted">
          当前继续展示上次成功加载的数据，避免把服务错误误看成暂无会话。
        </p>
        <p v-else class="load-error-text muted">
          暂时没有可展示的历史数据，请检查 Memory Service 后重试。
        </p>
      </div>
      <button class="retry-btn" @click="loadData">重试加载</button>
    </div>

    <div v-if="loading" class="loading-container">
      <div class="loading-spinner"></div>
      <p>加载主动询问会话中...</p>
    </div>

    <div
      v-else-if="
        loadError && sessions.length === 0 && visibleTemplates.length === 0
      "
      class="empty-state error-empty"
    >
      <p>暂时无法加载主动询问数据。</p>
    </div>

    <div
      v-else-if="sessions.length === 0 && visibleTemplates.length === 0"
      class="empty-state"
    >
      <p>暂无主动询问会话。</p>
    </div>

    <div v-else>
      <section v-if="visibleTemplates.length > 0" class="group-section">
        <div class="group-head">
          <h3>待触发计划</h3>
          <span class="group-count">{{ visibleTemplates.length }}</span>
        </div>
        <p class="group-desc">
          这些是未来会触发的主动询问计划；循环计划会保留在这里，已发出的每次询问会单独进入历史记录。
        </p>

        <div class="session-list">
          <div
            v-for="item in visibleTemplates"
            :key="item.template.id"
            class="session-card template-card"
          >
            <div class="card-head">
              <div>
                <h3>
                  <router-link :to="templateListRoute(item)" class="title-link">
                    {{
                      item.template.questionTemplate ||
                      item.template.title ||
                      '(空问题)'
                    }}
                  </router-link>
                </h3>
                <p class="context-text">
                  {{
                    item.template.contextTemplate || '计划已同步，等待触发。'
                  }}
                </p>
              </div>
              <div class="head-badges">
                <span class="badge queued">待触发计划</span>
                <span class="badge muted">{{
                  templateSyncStateLabel(item.template.syncState)
                }}</span>
              </div>
            </div>

            <div class="card-meta">
              <span
                >将发送给
                {{
                  formatTarget(
                    item.template.targetType,
                    item.template.targetRef,
                  )
                }}</span
              >
              <span
                >目标类型 {{ targetTypeLabel(item.template.targetType) }}</span
              >
              <span>目标状态 {{ templateTargetResolutionLabel(item) }}</span>
              <span v-if="resolveTemplateNextDispatchAt(item)"
                >计划发送
                {{ relativeTime(resolveTemplateNextDispatchAt(item)!) }}</span
              >
              <span v-else>计划时间未解析</span>
              <span v-if="item.latestSession"
                >上次执行
                {{
                  relativeTime(
                    item.latestSession.updatedAt ||
                      item.latestSession.createdAt,
                  )
                }}</span
              >
              <span
                >同步状态
                {{ templateSyncStateLabel(item.template.syncState) }}</span
              >
              <router-link
                v-if="item.latestSession?.id"
                :to="`/outreach/${item.latestSession.id}`"
                class="session-link"
                >查看上次执行</router-link
              >
            </div>
          </div>
        </div>
      </section>

      <section v-if="approvalSessions.length > 0" class="group-section">
        <div class="group-head">
          <h3>待审批</h3>
          <span class="group-count">{{ approvalSessions.length }}</span>
        </div>
        <p class="group-desc">
          这些询问已经找到了目标对象，但还没有正式发出。点标题或详情可修改目标对象与计划发送时间。
        </p>
        <div class="session-list">
          <div
            v-for="session in approvalSessions"
            :key="session.id"
            class="session-card"
          >
            <div class="card-head">
              <div>
                <h3>
                  <router-link
                    :to="`/outreach/${session.id}`"
                    class="title-link"
                  >
                    {{ session.renderedQuestion || '(空问题)' }}
                  </router-link>
                </h3>
                <p class="context-text">
                  {{ session.renderedContext || '无信息目标' }}
                </p>
              </div>
              <div class="head-badges">
                <span class="badge" :class="statusClass(session.status)">{{
                  statusLabel(session.status)
                }}</span>
                <span class="badge muted">{{
                  originLabel(session.originKind)
                }}</span>
                <span
                  v-if="evidenceSnapshot(session).stateLabel"
                  class="badge evidence"
                  >{{ evidenceSnapshot(session).stateLabel }}</span
                >
              </div>
            </div>

            <div class="stage-line">
              <strong>当前阶段：</strong>{{ sessionStageHint(session) }}
            </div>

            <div
              v-if="evidenceSnapshot(session).hasEvidence"
              class="evidence-box"
            >
              <div class="evidence-head">
                <span class="evidence-title">证据状态</span>
                <span
                  v-if="evidenceSnapshot(session).phaseLabel"
                  class="evidence-pill"
                  >{{ evidenceSnapshot(session).phaseLabel }}</span
                >
                <span
                  v-if="evidenceSnapshot(session).source"
                  class="evidence-pill muted"
                  >{{ evidenceSnapshot(session).source }}</span
                >
              </div>
              <p
                v-if="evidenceSnapshot(session).summary"
                class="evidence-summary"
              >
                <RichEvidenceText
                  :text="evidenceSnapshot(session).summary"
                  :mention-labels="evidenceMentionLabels(session)"
                />
              </p>
              <p
                v-if="
                  evidenceSnapshot(session).relatedMessage &&
                  evidenceSnapshot(session).relatedMessage !==
                    evidenceSnapshot(session).summary
                "
                class="evidence-related"
              >
                <RichEvidenceText
                  :text="evidenceSnapshot(session).relatedMessage"
                  :mention-labels="evidenceMentionLabels(session)"
                />
              </p>
            </div>

            <div class="card-meta">
              <span
                >将发送给
                {{ formatTarget(session.targetType, session.targetRef) }}</span
              >
              <span>目标类型 {{ targetTypeLabel(session.targetType) }}</span>
              <span>目标状态 {{ sessionTargetResolutionLabel(session) }}</span>
              <span>创建于 {{ relativeTime(session.createdAt) }}</span>
              <span
                >追问 {{ session.followupCount }}/{{
                  session.maxFollowup
                }}</span
              >
              <router-link
                v-if="session.threadId"
                :to="`/reflection-threads/${session.threadId}`"
                class="session-link"
                >查看线程</router-link
              >
              <a
                v-if="messageReactionSourceUrl(session)"
                :href="messageReactionSourceUrl(session)"
                class="session-link"
                target="_blank"
                rel="noopener noreferrer"
                >打开原消息</a
              >
              <router-link :to="`/outreach/${session.id}`" class="session-link"
                >查看详情</router-link
              >
            </div>

            <div class="card-actions">
              <button
                class="inline-btn primary"
                :disabled="
                  Boolean(busyById[session.id]) || !canApproveSession(session)
                "
                @click="approveSession(session.id)"
              >
                {{ canApproveSession(session) ? '批准发送' : '先确认目标' }}
              </button>
              <button
                class="inline-btn ghost"
                :disabled="Boolean(busyById[session.id])"
                @click="cancelSession(session.id)"
              >
                取消
              </button>
              <router-link :to="`/outreach/${session.id}`" class="inline-link"
                >进入详情编辑</router-link
              >
            </div>
          </div>
        </div>
      </section>

      <section v-if="queuedSessions.length > 0" class="group-section">
        <div class="group-head">
          <h3>已排程待发出</h3>
          <span class="group-count">{{ queuedSessions.length }}</span>
        </div>
        <p class="group-desc">
          这些会话已完成审批或无需审批，但还没有真正发出询问。
        </p>
        <div class="session-list">
          <div
            v-for="session in queuedSessions"
            :key="session.id"
            class="session-card"
          >
            <div class="card-head">
              <div>
                <h3>
                  <router-link
                    :to="`/outreach/${session.id}`"
                    class="title-link"
                  >
                    {{ session.renderedQuestion || '(空问题)' }}
                  </router-link>
                </h3>
                <p class="context-text">
                  {{ session.renderedContext || '无信息目标' }}
                </p>
              </div>
              <div class="head-badges">
                <span class="badge" :class="statusClass(session.status)">{{
                  statusLabel(session.status)
                }}</span>
                <span class="badge muted">{{
                  originLabel(session.originKind)
                }}</span>
                <span
                  v-if="evidenceSnapshot(session).stateLabel"
                  class="badge evidence"
                  >{{ evidenceSnapshot(session).stateLabel }}</span
                >
              </div>
            </div>

            <div class="stage-line">
              <strong>当前阶段：</strong>{{ sessionStageHint(session) }}
            </div>

            <div
              v-if="evidenceSnapshot(session).hasEvidence"
              class="evidence-box"
            >
              <div class="evidence-head">
                <span class="evidence-title">证据状态</span>
                <span
                  v-if="evidenceSnapshot(session).phaseLabel"
                  class="evidence-pill"
                  >{{ evidenceSnapshot(session).phaseLabel }}</span
                >
                <span
                  v-if="evidenceSnapshot(session).source"
                  class="evidence-pill muted"
                  >{{ evidenceSnapshot(session).source }}</span
                >
              </div>
              <p
                v-if="evidenceSnapshot(session).summary"
                class="evidence-summary"
              >
                <RichEvidenceText
                  :text="evidenceSnapshot(session).summary"
                  :mention-labels="evidenceMentionLabels(session)"
                />
              </p>
              <p
                v-if="
                  evidenceSnapshot(session).relatedMessage &&
                  evidenceSnapshot(session).relatedMessage !==
                    evidenceSnapshot(session).summary
                "
                class="evidence-related"
              >
                <RichEvidenceText
                  :text="evidenceSnapshot(session).relatedMessage"
                  :mention-labels="evidenceMentionLabels(session)"
                />
              </p>
            </div>

            <div class="card-meta">
              <span
                >将发送给
                {{ formatTarget(session.targetType, session.targetRef) }}</span
              >
              <span>目标类型 {{ targetTypeLabel(session.targetType) }}</span>
              <span>目标状态 {{ sessionTargetResolutionLabel(session) }}</span>
              <span v-if="session.nextCheckAt"
                >计划发送 {{ relativeTime(session.nextCheckAt) }}</span
              >
              <span v-else>等待引擎恢复后发送</span>
              <router-link
                v-if="session.threadId"
                :to="`/reflection-threads/${session.threadId}`"
                class="session-link"
                >查看线程</router-link
              >
              <a
                v-if="messageReactionSourceUrl(session)"
                :href="messageReactionSourceUrl(session)"
                class="session-link"
                target="_blank"
                rel="noopener noreferrer"
                >打开原消息</a
              >
              <router-link :to="`/outreach/${session.id}`" class="session-link"
                >查看详情/修改</router-link
              >
            </div>
          </div>
        </div>
      </section>

      <section v-if="waitingSessions.length > 0" class="group-section">
        <div class="group-head">
          <h3>等待对方回复</h3>
          <span class="group-count">{{ waitingSessions.length }}</span>
        </div>
        <p class="group-desc">
          这些询问已经发出，正在等待对方回复或按对方 ETA 延期。
        </p>
        <div class="session-list">
          <div
            v-for="session in waitingSessions"
            :key="session.id"
            class="session-card"
          >
            <div class="card-head">
              <div>
                <h3>
                  <router-link
                    :to="`/outreach/${session.id}`"
                    class="title-link"
                  >
                    {{ session.renderedQuestion || '(空问题)' }}
                  </router-link>
                </h3>
                <p class="context-text">
                  {{ session.renderedContext || '无信息目标' }}
                </p>
              </div>
              <div class="head-badges">
                <span class="badge" :class="statusClass(session.status)">{{
                  statusLabel(session.status)
                }}</span>
                <span class="badge muted">{{
                  originLabel(session.originKind)
                }}</span>
                <span
                  v-if="evidenceSnapshot(session).stateLabel"
                  class="badge evidence"
                  >{{ evidenceSnapshot(session).stateLabel }}</span
                >
              </div>
            </div>

            <div class="stage-line">
              <strong>当前阶段：</strong>{{ sessionStageHint(session) }}
            </div>

            <div
              v-if="evidenceSnapshot(session).hasEvidence"
              class="evidence-box"
            >
              <div class="evidence-head">
                <span class="evidence-title">证据状态</span>
                <span
                  v-if="evidenceSnapshot(session).phaseLabel"
                  class="evidence-pill"
                  >{{ evidenceSnapshot(session).phaseLabel }}</span
                >
                <span
                  v-if="evidenceSnapshot(session).source"
                  class="evidence-pill muted"
                  >{{ evidenceSnapshot(session).source }}</span
                >
              </div>
              <p
                v-if="evidenceSnapshot(session).summary"
                class="evidence-summary"
              >
                <RichEvidenceText
                  :text="evidenceSnapshot(session).summary"
                  :mention-labels="evidenceMentionLabels(session)"
                />
              </p>
              <p
                v-if="
                  evidenceSnapshot(session).relatedMessage &&
                  evidenceSnapshot(session).relatedMessage !==
                    evidenceSnapshot(session).summary
                "
                class="evidence-related"
              >
                <RichEvidenceText
                  :text="evidenceSnapshot(session).relatedMessage"
                  :mention-labels="evidenceMentionLabels(session)"
                />
              </p>
            </div>

            <div class="card-meta">
              <span
                >发送给
                {{ formatTarget(session.targetType, session.targetRef) }}</span
              >
              <span>目标类型 {{ targetTypeLabel(session.targetType) }}</span>
              <span>目标状态 {{ sessionTargetResolutionLabel(session) }}</span>
              <span v-if="session.waitUntil"
                >等待至 {{ relativeTime(session.waitUntil) }}</span
              >
              <span v-if="session.nextCheckAt"
                >下次检查 {{ relativeTime(session.nextCheckAt) }}</span
              >
              <span
                >追问 {{ session.followupCount }}/{{
                  session.maxFollowup
                }}</span
              >
              <router-link
                v-if="session.threadId"
                :to="`/reflection-threads/${session.threadId}`"
                class="session-link"
                >查看线程</router-link
              >
              <a
                v-if="messageReactionSourceUrl(session)"
                :href="messageReactionSourceUrl(session)"
                class="session-link"
                target="_blank"
                rel="noopener noreferrer"
                >打开原消息</a
              >
              <router-link :to="`/outreach/${session.id}`" class="session-link"
                >查看详情</router-link
              >
            </div>

            <div v-if="session.replyRawText" class="reply-box">
              <div class="box-title">最近回复</div>
              <p>{{ session.replyRawText }}</p>
            </div>
          </div>
        </div>
      </section>

      <section v-if="historySessions.length > 0" class="group-section">
        <div class="group-head">
          <h3>历史记录</h3>
          <span class="group-count">{{ historySessions.length }}</span>
        </div>
        <p class="group-desc">已完成、失败、无回复或已取消的主动询问会话。</p>
        <div class="session-list">
          <div
            v-for="session in historySessions"
            :key="session.id"
            class="session-card"
          >
            <div class="card-head">
              <div>
                <h3>
                  <router-link
                    :to="`/outreach/${session.id}`"
                    class="title-link"
                  >
                    {{ session.renderedQuestion || '(空问题)' }}
                  </router-link>
                </h3>
                <p class="context-text">
                  {{ session.renderedContext || '无信息目标' }}
                </p>
              </div>
              <div class="head-badges">
                <span class="badge" :class="statusClass(session.status)">{{
                  statusLabel(session.status)
                }}</span>
                <span class="badge muted">{{
                  originLabel(session.originKind)
                }}</span>
                <span
                  v-if="evidenceSnapshot(session).stateLabel"
                  class="badge evidence"
                  >{{ evidenceSnapshot(session).stateLabel }}</span
                >
              </div>
            </div>

            <div class="stage-line">
              <strong>当前阶段：</strong>{{ sessionStageHint(session) }}
            </div>

            <div
              v-if="evidenceSnapshot(session).hasEvidence"
              class="evidence-box"
            >
              <div class="evidence-head">
                <span class="evidence-title">证据状态</span>
                <span
                  v-if="evidenceSnapshot(session).phaseLabel"
                  class="evidence-pill"
                  >{{ evidenceSnapshot(session).phaseLabel }}</span
                >
                <span
                  v-if="evidenceSnapshot(session).source"
                  class="evidence-pill muted"
                  >{{ evidenceSnapshot(session).source }}</span
                >
              </div>
              <p
                v-if="evidenceSnapshot(session).summary"
                class="evidence-summary"
              >
                <RichEvidenceText
                  :text="evidenceSnapshot(session).summary"
                  :mention-labels="evidenceMentionLabels(session)"
                />
              </p>
              <p
                v-if="
                  evidenceSnapshot(session).relatedMessage &&
                  evidenceSnapshot(session).relatedMessage !==
                    evidenceSnapshot(session).summary
                "
                class="evidence-related"
              >
                <RichEvidenceText
                  :text="evidenceSnapshot(session).relatedMessage"
                  :mention-labels="evidenceMentionLabels(session)"
                />
              </p>
            </div>

            <div class="card-meta">
              <span
                >发送给
                {{ formatTarget(session.targetType, session.targetRef) }}</span
              >
              <span>目标类型 {{ targetTypeLabel(session.targetType) }}</span>
              <span>目标状态 {{ sessionTargetResolutionLabel(session) }}</span>
              <span
                >最后更新
                {{ relativeTime(session.updatedAt || session.createdAt) }}</span
              >
              <router-link
                v-if="session.threadId"
                :to="`/reflection-threads/${session.threadId}`"
                class="session-link"
                >查看线程</router-link
              >
              <a
                v-if="messageReactionSourceUrl(session)"
                :href="messageReactionSourceUrl(session)"
                class="session-link"
                target="_blank"
                rel="noopener noreferrer"
                >打开原消息</a
              >
              <router-link :to="`/outreach/${session.id}`" class="session-link"
                >查看详情</router-link
              >
            </div>

            <div v-if="session.replyRawText" class="reply-box">
              <div class="box-title">最近回复</div>
              <p>{{ session.replyRawText }}</p>
            </div>

            <div
              v-if="session.outcome && Object.keys(session.outcome).length > 0"
              class="result-box"
            >
              <div class="box-title">结构化结果</div>
              <pre>{{ formatJson(session.outcome) }}</pre>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  getMemoryServiceClient,
  type OutreachSession,
  type OutreachSessionStatus,
  type OutreachSummary,
  type OutreachTemplateRuntimeStatusItem,
  type RuntimeConfigResponse,
} from '../../services/MemoryServiceClient';
import { getOutreachEvidenceSnapshot } from './outreachEvidence';
import { collectEvidenceMentionLabels, RichEvidenceText } from './evidenceText';

declare const chrome: any;

const client = getMemoryServiceClient();
const route = useRoute();
const router = useRouter();

const loading = ref(true);
const sessions = ref<OutreachSession[]>([]);
const templateItems = ref<OutreachTemplateRuntimeStatusItem[]>([]);
const summary = ref<OutreachSummary>({
  upcomingCount: 0,
  waitingReplyCount: 0,
  escalatedCount: 0,
  pendingApprovalCount: 0,
});
const runtimeConfig = ref<RuntimeConfigResponse | null>(null);
const busyById = reactive<Record<string, boolean>>({});
const loadError = ref('');
const hasLoadedData = ref(false);
const TERMINAL_OUTREACH_STATUSES = new Set([
  'resolved',
  'no_reply',
  'escalated',
  'cancelled',
  'failed',
]);
const approvalSessions = computed(() =>
  sessions.value.filter((session) => session.status === 'pending_approval'),
);
const queuedSessions = computed(() =>
  sessions.value.filter((session) => session.status === 'scheduled'),
);
const waitingSessions = computed(() =>
  sessions.value.filter(
    (session) =>
      session.status === 'waiting_reply' || session.status === 'deferred',
  ),
);
const historySessions = computed(() =>
  sessions.value.filter((session) =>
    ['resolved', 'no_reply', 'escalated', 'cancelled', 'failed'].includes(
      session.status,
    ),
  ),
);
const visibleTemplates = computed(() =>
  sortTemplatesForDisplay(
    templateItems.value.filter(
      (item) => matchesTemplateFilters(item) && isPendingTemplate(item),
    ),
  ),
);
const showSetupBanner = computed(() => {
  if (!runtimeConfig.value) return false;
  return (
    !runtimeConfig.value.outreachEnabled ||
    !isRingCentralReady(runtimeConfig.value)
  );
});
const setupBannerTitle = computed(() => {
  if (!runtimeConfig.value?.outreachEnabled) return '主动询问引擎尚未开启';
  return 'RingCentral 配置尚未完成';
});
const setupBannerText = computed(() => {
  if (!runtimeConfig.value?.outreachEnabled) {
    return '当前页面显示的是历史记录或待触发计划，但引擎关闭时不会真正派发新的主动询问。请先到 Options 页面开启。';
  }
  return '你已经进入了主动询问页面，但缺少发送所需的 RingCentral 配置。补齐后，待审批和待发送会话才会继续推进。';
});

const status = ref<OutreachSessionStatus | 'all'>('all');
const originKind = ref('');
const templateId = ref('');
const threadId = ref('');

onMounted(() => {
  hydrateFilters();
  void loadData();
});

watch(
  () => route.fullPath,
  () => {
    hydrateFilters();
    void loadData();
  },
);

function hydrateFilters() {
  status.value = normalizeStatus(route.query.status);
  originKind.value =
    typeof route.query.originKind === 'string' ? route.query.originKind : '';
  templateId.value =
    typeof route.query.templateId === 'string' ? route.query.templateId : '';
  threadId.value =
    typeof route.query.threadId === 'string' ? route.query.threadId : '';
}

function normalizeStatus(value: unknown): OutreachSessionStatus | 'all' {
  if (typeof value !== 'string' || value.length === 0) return 'all';
  const allowed: Array<OutreachSessionStatus | 'all'> = [
    'all',
    'pending_approval',
    'scheduled',
    'waiting_reply',
    'deferred',
    'resolved',
    'no_reply',
    'escalated',
    'cancelled',
    'failed',
  ];
  return allowed.includes(value as OutreachSessionStatus | 'all')
    ? (value as OutreachSessionStatus | 'all')
    : 'all';
}

function applyFilters() {
  const query: Record<string, string> = {};
  if (status.value !== 'all') query.status = status.value;
  if (originKind.value.trim()) query.originKind = originKind.value.trim();
  if (templateId.value.trim()) query.templateId = templateId.value.trim();
  if (threadId.value.trim()) query.threadId = threadId.value.trim();

  void router.replace({ path: '/outreach', query });
}

async function loadData() {
  loading.value = true;
  loadError.value = '';
  try {
    const results = await Promise.allSettled([
      client.getRuntimeConfig(),
      client.getOutreachSummary(),
      client.getOutreachTemplateRuntimeStatus(undefined, 100),
      client.getOutreachSessions({
        status: status.value,
        originKind: originKind.value || undefined,
        templateId: templateId.value || undefined,
        threadId: threadId.value || undefined,
        limit: 50,
      }),
    ] as const);

    const failures: string[] = [];
    const [configResult, summaryResult, templateResult, listResult] = results;

    if (configResult.status === 'fulfilled') {
      runtimeConfig.value = configResult.value;
    } else {
      failures.push(formatLoadFailure('运行配置', configResult.reason));
    }

    if (summaryResult.status === 'fulfilled') {
      summary.value = summaryResult.value;
    } else {
      failures.push(formatLoadFailure('统计摘要', summaryResult.reason));
    }

    if (templateResult.status === 'fulfilled') {
      templateItems.value = templateResult.value.items;
    } else {
      failures.push(formatLoadFailure('待触发计划', templateResult.reason));
    }

    if (listResult.status === 'fulfilled') {
      sessions.value = sortSessionsForDisplay(listResult.value.items);
    } else {
      failures.push(formatLoadFailure('会话列表', listResult.reason));
    }

    if (failures.length > 0) {
      loadError.value = failures.join('；');
      console.error('Failed to load outreach sessions:', failures.join('; '));
    }
    if (
      templateResult.status === 'fulfilled' ||
      listResult.status === 'fulfilled'
    ) {
      hasLoadedData.value =
        sessions.value.length > 0 || templateItems.value.length > 0;
    }
  } finally {
    loading.value = false;
  }
}

function formatLoadFailure(label: string, error: unknown) {
  const raw = error instanceof Error ? error.message : String(error);
  const message = raw.replace(/^MemoryService\s+\d+:\s*/i, '').trim();
  return `${label}：${message || 'unknown error'}`;
}

async function approveSession(id: string) {
  busyById[id] = true;
  try {
    await client.approveOutreachSession(id);
    await loadData();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    window.alert(message || '批准发送失败。');
  } finally {
    busyById[id] = false;
  }
}

async function cancelSession(id: string) {
  if (!window.confirm('确认取消这个主动询问会话吗？')) return;
  busyById[id] = true;
  try {
    await client.cancelOutreachSession(id, 'Cancelled from outreach list UI');
    await loadData();
  } finally {
    busyById[id] = false;
  }
}

function openOptionsPage() {
  const url = chrome?.runtime?.getURL
    ? chrome.runtime.getURL('options.html#outreach-config')
    : 'options.html#outreach-config';
  window.open(url, '_blank');
}

function relativeTime(ts: number) {
  const normalized = normalizeTimestamp(ts);
  if (!normalized) return '-';
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
  if (!ts || !Number.isFinite(ts)) return null;
  return ts > 1_000_000_000_000 ? ts : ts * 1000;
}

function formatJson(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function statusClass(statusValue: string) {
  if (statusValue === 'resolved') return 'resolved';
  if (statusValue === 'waiting_reply' || statusValue === 'deferred')
    return 'waiting';
  if (statusValue === 'pending_approval' || statusValue === 'scheduled')
    return 'queued';
  if (statusValue === 'escalated' || statusValue === 'failed') return 'error';
  if (statusValue === 'no_reply') return 'warn';
  return 'muted';
}

function statusLabel(statusValue: string) {
  if (statusValue === 'pending_approval') return '待审批';
  if (statusValue === 'scheduled') return '已排程';
  if (statusValue === 'waiting_reply') return '等待回复';
  if (statusValue === 'deferred') return '延期等待';
  if (statusValue === 'resolved') return '已拿到结果';
  if (statusValue === 'no_reply') return '无回复';
  if (statusValue === 'escalated') return '已升级';
  if (statusValue === 'cancelled') return '已取消';
  if (statusValue === 'failed') return '失败';
  return statusValue || '未知';
}

function originLabel(originKind?: string) {
  if (originKind === 'reflection_action') return '自我反思';
  if (originKind === 'message_reaction') return '消息跟进';
  if (originKind === 'scheduled_template' || originKind === 'manual_action')
    return '手动/定时';
  return originKind || '未知来源';
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

function formatTarget(targetType?: string, targetRef?: string) {
  const normalizedRef = targetRef?.trim();
  if (!normalizedRef) return '未指定目标';
  if (
    (targetType === 'person' || targetType === 'private') &&
    normalizedRef === 'user'
  ) {
    return '当前用户';
  }
  return normalizedRef;
}

function templateTargetResolutionLabel(
  item: OutreachTemplateRuntimeStatusItem,
) {
  if (item.latestSession?.targetResolutionStatus === 'resolved') {
    return `已确认：${
      item.latestSession.targetResolvedLabel || item.latestSession.targetRef
    }`;
  }
  if (item.latestSession?.targetResolutionStatus === 'ambiguous') {
    return '待你确认目标';
  }
  return '运行时解析';
}

function sessionTargetResolutionLabel(session: OutreachSession) {
  if (session.targetResolutionStatus === 'resolved') {
    return `已确认：${session.targetResolvedLabel || session.targetRef}`;
  }
  if (session.targetResolutionStatus === 'ambiguous') {
    return '待你确认目标';
  }
  if (session.targetResolutionStatus === 'unresolved') {
    return '目标未解析';
  }
  return '原始目标文本';
}

function canApproveSession(session: OutreachSession) {
  return session.targetResolutionStatus === 'resolved';
}

function targetTypeLabel(targetType?: string) {
  if (targetType === 'private') return '私聊';
  if (targetType === 'group') return '群组';
  if (targetType === 'person') return '联系人';
  return targetType || '未知目标';
}

function templateSyncStateLabel(syncState?: string) {
  if (syncState === 'synced' || !syncState) return '已同步';
  if (syncState === 'sync_error') return '同步失败';
  if (syncState === 'paused') return '已暂停';
  if (syncState === 'cancelled') return '已取消';
  return syncState;
}

function templateListRoute(item: OutreachTemplateRuntimeStatusItem) {
  return `/outreach?templateId=${encodeURIComponent(item.template.id)}`;
}

function resolveTemplateNextDispatchAt(
  item: OutreachTemplateRuntimeStatusItem,
): number | null {
  const raw = item.template.scheduleSpec?.nextDispatchAt;
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return raw;
  const scheduleDate =
    typeof item.template.scheduleSpec?.scheduleDate === 'string'
      ? item.template.scheduleSpec.scheduleDate
      : '';
  const scheduleTime =
    typeof item.template.scheduleSpec?.scheduleTime === 'string'
      ? item.template.scheduleSpec.scheduleTime
      : '09:00';
  const repeatEvery = Number(item.template.scheduleSpec?.repeatEvery);
  const repeatUnit =
    typeof item.template.scheduleSpec?.repeatUnit === 'string'
      ? item.template.scheduleSpec.repeatUnit
      : '';
  if (!scheduleDate) return null;
  const date = new Date(
    `${scheduleDate}T${
      scheduleTime.length === 5 ? `${scheduleTime}:00` : scheduleTime
    }`,
  );
  if (Number.isNaN(date.getTime())) return null;
  const baseline = Math.floor(Date.now() / 1000);

  if (Number.isFinite(repeatEvery) && repeatEvery > 0 && repeatUnit) {
    const candidate = new Date(date.getTime());
    while (Math.floor(candidate.getTime() / 1000) <= baseline) {
      if (repeatUnit === 'Day') {
        candidate.setDate(candidate.getDate() + repeatEvery);
      } else if (repeatUnit === 'Week') {
        candidate.setDate(candidate.getDate() + repeatEvery * 7);
      } else if (repeatUnit === 'Month') {
        candidate.setMonth(candidate.getMonth() + repeatEvery);
      } else if (repeatUnit === 'Year') {
        candidate.setFullYear(candidate.getFullYear() + repeatEvery);
      } else {
        break;
      }
    }
    const nextAt = Math.floor(candidate.getTime() / 1000);
    return nextAt > baseline ? nextAt : null;
  }

  const nextAt = Math.floor(date.getTime() / 1000);
  return nextAt > baseline ? nextAt : null;
}

function isPendingTemplate(item: OutreachTemplateRuntimeStatusItem): boolean {
  const template = item.template;
  const nextDispatchAt = resolveTemplateNextDispatchAt(item);
  if (template.enabled === false) return false;
  if (template.syncState && template.syncState !== 'synced') return false;
  if (!nextDispatchAt) return false;
  return (
    !item.latestSession ||
    TERMINAL_OUTREACH_STATUSES.has(item.latestSession.status)
  );
}

function matchesTemplateFilters(
  item: OutreachTemplateRuntimeStatusItem,
): boolean {
  if (status.value !== 'all' && status.value !== 'scheduled') return false;
  if (originKind.value && originKind.value !== 'manual') return false;
  if (threadId.value.trim()) return false;
  if (templateId.value.trim() && item.template.id !== templateId.value.trim())
    return false;
  return true;
}

function sortTemplatesForDisplay(items: OutreachTemplateRuntimeStatusItem[]) {
  return [...items].sort((a, b) => {
    const aNext = resolveTemplateNextDispatchAt(a) ?? Number.MAX_SAFE_INTEGER;
    const bNext = resolveTemplateNextDispatchAt(b) ?? Number.MAX_SAFE_INTEGER;
    return aNext - bNext;
  });
}

function sortSessionsForDisplay(items: OutreachSession[]): OutreachSession[] {
  const priority = new Map<string, number>([
    ['pending_approval', 0],
    ['waiting_reply', 1],
    ['deferred', 2],
    ['scheduled', 3],
    ['escalated', 4],
    ['no_reply', 5],
    ['failed', 6],
    ['resolved', 7],
    ['cancelled', 8],
  ]);

  return [...items].sort((a, b) => {
    if (status.value === 'all') {
      const statusDiff =
        (priority.get(a.status) ?? 99) - (priority.get(b.status) ?? 99);
      if (statusDiff !== 0) {
        return statusDiff;
      }
    }

    const aTime = normalizeTimestamp(a.updatedAt || a.createdAt || 0) ?? 0;
    const bTime = normalizeTimestamp(b.updatedAt || b.createdAt || 0) ?? 0;
    return bTime - aTime;
  });
}

function isRingCentralReady(config: RuntimeConfigResponse) {
  return (
    Boolean(config.ringCentralServerUrl?.trim()) &&
    Boolean(config.ringCentralClientId?.trim()) &&
    Boolean(config.ringCentralClientSecretConfigured) &&
    Boolean(config.ringCentralJwtConfigured)
  );
}

function sessionStageHint(session: OutreachSession) {
  const summary = extractOutcomeSummary(session.outcome);
  if (session.status === 'pending_approval') {
    if (session.targetResolutionStatus !== 'resolved') {
      return '目标还没有解析成明确的 RingCentral 用户/群组，需先进入详情确认目标。';
    }
    if (session.nextCheckAt) {
      return `已找到询问对象 ${formatTarget(
        session.targetType,
        session.targetRef,
      )}。批准后会按计划在 ${relativeTime(session.nextCheckAt)} 发出。`;
    }
    return `已找到询问对象 ${formatTarget(
      session.targetType,
      session.targetRef,
    )}，等待你确认是否真的发出。`;
  }
  if (session.status === 'scheduled') {
    if (session.nextCheckAt) {
      return `已完成审批或无需审批，计划在 ${relativeTime(
        session.nextCheckAt,
      )} 发出。`;
    }
    return '已完成审批或无需审批，等待引擎真正发出。';
  }
  if (session.status === 'waiting_reply') {
    if (isMessageReactionSession(session)) {
      return '这条跟进来自原始消息；系统会先检查当前会话是否已有满足目标的回复，没命中才在等待时间后追问。';
    }
    return '消息已发出，当前正在等待对方回复。';
  }
  if (session.status === 'deferred') {
    return '对方表示稍后回复，系统会按新的等待时间继续跟进。';
  }
  if (session.status === 'resolved') {
    const resolutionState =
      typeof session.outcome?.resolutionState === 'string'
        ? session.outcome.resolutionState
        : '';
    if (resolutionState === 'partial') {
      return summary || '已经拿到部分可用结果，系统正在继续查证。';
    }
    if (resolutionState === 'insufficient') {
      return summary || '已经收到线索，但仍需继续查证或等待人工判断。';
    }
    return summary ? `已经拿到可用结果。${summary}` : '已经拿到可用结果。';
  }
  if (session.status === 'no_reply') {
    return summary || '已经超过追问额度，仍然没有收到回复。';
  }
  if (session.status === 'escalated') {
    return summary || '系统判断需要你介入决定下一步。';
  }
  if (session.status === 'failed') {
    return session.errorMessage || '发送或推进过程中失败。';
  }
  if (session.status === 'cancelled') {
    return '这条主动询问已被取消。';
  }
  return '状态未知。';
}

function extractOutcomeSummary(outcome?: Record<string, unknown>) {
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

function evidenceSnapshot(session: OutreachSession) {
  return getOutreachEvidenceSnapshot(session);
}

function evidenceMentionLabels(
  session: OutreachSession,
): Record<string, string> {
  return collectEvidenceMentionLabels(session);
}
</script>

<style scoped>
.outreach-page {
  animation: fadeInUp 0.5s ease-out;
}

.page-header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
}

.page-header h2 {
  font-size: 1.5rem;
  margin-bottom: 0.35rem;
}

.page-header p {
  color: #94a3b8;
  font-size: 0.9rem;
}

.summary-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem;
  align-items: flex-start;
}

.summary-pill {
  padding: 0.24rem 0.62rem;
  border-radius: 999px;
  font-size: 0.78rem;
  background: rgba(14, 165, 233, 0.16);
  color: #7dd3fc;
}

.summary-pill.warn {
  background: rgba(245, 158, 11, 0.16);
  color: #fcd34d;
}

.summary-pill.danger {
  background: rgba(239, 68, 68, 0.16);
  color: #fca5a5;
}

.setup-banner {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: center;
  padding: 1rem 1.1rem;
  margin-bottom: 1rem;
  border-radius: 1rem;
  background: rgba(245, 158, 11, 0.12);
  border: 1px solid rgba(245, 158, 11, 0.35);
}

.setup-title {
  font-weight: 700;
  color: #fcd34d;
  margin-bottom: 0.35rem;
}

.setup-text {
  margin: 0;
  color: #fde68a;
  line-height: 1.5;
}

.setup-btn {
  border: none;
  border-radius: 0.8rem;
  padding: 0.72rem 1rem;
  cursor: pointer;
  background: #f59e0b;
  color: #111827;
  font-weight: 600;
}

.info-banner {
  margin-bottom: 1rem;
  padding: 0.95rem 1.05rem;
  border-radius: 1rem;
  background: rgba(99, 102, 241, 0.12);
  border: 1px solid rgba(129, 140, 248, 0.24);
}

.info-banner-title {
  font-weight: 700;
  color: #c4b5fd;
  margin-bottom: 0.35rem;
}

.info-banner-text {
  margin: 0;
  color: #ddd6fe;
  line-height: 1.55;
}

.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.filter-select,
.filter-input,
.refresh-btn {
  border: none;
  border-radius: 0.8rem;
  padding: 0.72rem 0.95rem;
  background: rgba(15, 23, 42, 0.72);
  border: 1px solid rgba(148, 163, 184, 0.22);
  color: #e2e8f0;
}

.filter-input {
  min-width: 9rem;
}

.refresh-btn {
  cursor: pointer;
  background: rgba(30, 41, 59, 0.84);
}

.load-error-banner {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: center;
  padding: 1rem 1.05rem;
  margin-bottom: 1rem;
  border-radius: 1rem;
  background: rgba(127, 29, 29, 0.26);
  border: 1px solid rgba(248, 113, 113, 0.32);
}

.load-error-title {
  font-weight: 700;
  color: #fecaca;
  margin-bottom: 0.35rem;
}

.load-error-text {
  margin: 0;
  color: #fee2e2;
  line-height: 1.5;
}

.load-error-text.muted {
  color: #fca5a5;
  margin-top: 0.25rem;
}

.retry-btn {
  border: none;
  border-radius: 0.8rem;
  padding: 0.72rem 1rem;
  cursor: pointer;
  background: #ef4444;
  color: #fff;
  font-weight: 600;
  white-space: nowrap;
}

.error-empty p {
  color: #fecaca;
}

.title-link {
  color: #e2e8f0;
  text-decoration: none;
}

.title-link:hover {
  text-decoration: underline;
}

.session-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.group-section {
  margin-bottom: 1.25rem;
}

.group-head {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin-bottom: 0.3rem;
}

.group-head h3 {
  margin: 0;
  font-size: 1.05rem;
}

.group-count {
  padding: 0.15rem 0.55rem;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.16);
  color: #cbd5e1;
  font-size: 0.76rem;
}

.group-desc {
  margin: 0 0 0.85rem;
  color: #94a3b8;
  font-size: 0.84rem;
}

.session-card {
  background: rgba(15, 23, 42, 0.72);
  border: 1px solid rgba(148, 163, 184, 0.12);
  border-radius: 1rem;
  padding: 1.1rem;
}

.card-head {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
}

.card-head h3 {
  margin-bottom: 0.45rem;
}

.context-text {
  color: #cbd5e1;
  line-height: 1.55;
}

.head-badges,
.card-meta {
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
  margin-top: 0.8rem;
  color: #94a3b8;
  font-size: 0.82rem;
}

.stage-line {
  margin-top: 0.8rem;
  color: #cbd5e1;
  font-size: 0.86rem;
  line-height: 1.5;
}

.evidence-box {
  margin-top: 0.8rem;
  padding: 0.9rem 1rem;
  border-radius: 0.95rem;
  background: rgba(15, 23, 42, 0.54);
  border: 1px solid rgba(96, 165, 250, 0.16);
}

.evidence-head {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  flex-wrap: wrap;
  margin-bottom: 0.55rem;
}

.evidence-title {
  font-size: 0.78rem;
  font-weight: 700;
  color: #bfdbfe;
}

.evidence-pill {
  padding: 0.2rem 0.56rem;
  border-radius: 999px;
  background: rgba(59, 130, 246, 0.16);
  color: #93c5fd;
  font-size: 0.74rem;
}

.evidence-pill.muted {
  background: rgba(148, 163, 184, 0.16);
  color: #cbd5e1;
}

.evidence-summary,
.evidence-related {
  margin: 0;
  color: #e2e8f0;
  line-height: 1.55;
}

.evidence-related {
  margin-top: 0.45rem;
  color: #cbd5e1;
  font-size: 0.86rem;
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

.badge.evidence {
  background: rgba(34, 197, 94, 0.16);
  color: #86efac;
  border-color: rgba(34, 197, 94, 0.28);
}

.badge.queued {
  background: rgba(14, 165, 233, 0.16);
  color: #7dd3fc;
  border-color: rgba(14, 165, 233, 0.28);
}

.badge.waiting {
  background: rgba(245, 158, 11, 0.16);
  color: #fcd34d;
  border-color: rgba(245, 158, 11, 0.28);
}

.badge.resolved {
  background: rgba(34, 197, 94, 0.16);
  color: #86efac;
  border-color: rgba(34, 197, 94, 0.28);
}

.badge.error {
  background: rgba(239, 68, 68, 0.16);
  color: #fca5a5;
  border-color: rgba(239, 68, 68, 0.28);
}

.badge.warn {
  background: rgba(245, 158, 11, 0.16);
  color: #fcd34d;
  border-color: rgba(245, 158, 11, 0.28);
}

.session-link {
  color: #7dd3fc;
  text-decoration: none;
}

.session-link:hover {
  text-decoration: underline;
}

.card-actions {
  display: flex;
  gap: 0.7rem;
  margin-top: 0.9rem;
}

.inline-btn {
  border: none;
  border-radius: 0.7rem;
  padding: 0.55rem 0.9rem;
  cursor: pointer;
  font-size: 0.84rem;
}

.inline-btn.primary {
  background: #22c55e;
  color: #052e16;
  font-weight: 700;
}

.inline-btn.ghost {
  background: rgba(148, 163, 184, 0.16);
  color: #e2e8f0;
}

.inline-btn:disabled {
  cursor: not-allowed;
  opacity: 0.65;
}

.inline-link {
  display: inline-flex;
  align-items: center;
  color: #7dd3fc;
  text-decoration: none;
  font-size: 0.84rem;
}

.inline-link:hover {
  text-decoration: underline;
}

.reply-box,
.result-box {
  margin-top: 0.8rem;
  padding: 0.75rem 0.9rem;
  border-radius: 0.8rem;
  background: rgba(30, 41, 59, 0.7);
  border: 1px solid rgba(148, 163, 184, 0.16);
}

.box-title {
  margin-bottom: 0.4rem;
  font-weight: 600;
  color: #cbd5e1;
  font-size: 0.85rem;
}

.result-box pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  color: #cbd5e1;
  font-size: 0.8rem;
  line-height: 1.55;
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
}
</style>
