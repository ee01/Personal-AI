<template>
  <div class="day-pilot-home">
    <section class="brief-header">
      <div class="brief-top">
        <div>
          <div class="brief-greeting">
            今天有 {{ visibleMissionCards.length }} 件事值得关注
          </div>
          <div class="brief-subtitle">
            {{ todayLabel }} · {{ timezoneLabel }} · {{ refreshedAtLabel }} 生成
          </div>
        </div>

        <div class="brief-meta">
          <span
            v-for="source in sourceTags"
            :key="source.key"
            class="source-tag"
          >
            <span :class="['source-dot', { warn: source.warn }]" />
            {{ source.label }}
          </span>
          <button
            type="button"
            class="refresh-btn"
            :disabled="loading"
            @click="loadDayPilot()"
          >
            {{ loading ? '刷新中' : '刷新' }}
          </button>
        </div>
      </div>

      <div class="budget-strip">
        <span class="budget-label">今日提醒预算</span>
        <div class="budget-track">
          <div class="budget-fill" :style="{ width: budgetPercent }" />
        </div>
        <span class="budget-count">
          {{ attentionBudget.used }} / {{ attentionBudget.max }}
        </span>
      </div>

      <div
        v-if="rankingSummary.length > 0"
        class="ranking-strip"
        aria-label="今日领航筛选摘要"
      >
        <span class="ranking-kicker">筛选口径</span>
        <span
          v-for="item in rankingSummary"
          :key="item.key"
          :class="['ranking-chip', item.tone]"
        >
          <strong>{{ item.value }}</strong>
          {{ item.label }}
        </span>
        <span class="ranking-note">{{ rankingNote }}</span>
      </div>

      <div
        v-if="statsIdentityReceipt"
        :class="['stats-identity-receipt', statsIdentityReceipt.tone]"
        role="status"
        aria-live="polite"
      >
        <div class="stats-identity-main">
          <span class="stats-identity-kicker">记忆用户</span>
          <strong>{{ statsIdentityReceipt.title }}</strong>
          <span class="stats-identity-source">
            {{ statsIdentityReceipt.source }}
          </span>
          <span class="stats-identity-storage">
            {{ statsIdentityReceipt.storage }}
          </span>
        </div>
        <p>{{ statsIdentityReceipt.boundary }}</p>
      </div>
    </section>

    <div v-if="loadError" class="load-error" role="status">
      {{ loadError }}
    </div>

    <div
      v-if="missionFeedbackReceipt"
      :class="['mission-feedback-receipt', missionFeedbackReceipt.tone]"
      role="status"
      aria-live="polite"
    >
      <div class="feedback-receipt-main">
        <span class="feedback-receipt-kicker">Mission 反馈回执</span>
        <strong>{{ missionFeedbackReceipt.title }}</strong>
        <p>{{ missionFeedbackReceipt.detail }}</p>
        <p>{{ missionFeedbackReceipt.boundary }}</p>
      </div>
      <button
        type="button"
        class="feedback-receipt-close"
        aria-label="关闭 Mission 反馈回执"
        @click="missionFeedbackReceipt = null"
      >
        ×
      </button>
    </div>

    <section>
      <div class="section-title">
        今日 Mission
        <span class="section-count">{{ visibleMissionCards.length }}</span>
      </div>

      <div
        v-if="loading && visibleMissionCards.length === 0"
        class="empty-panel"
      >
        正在整理今天的记忆信号...
      </div>

      <div
        v-else-if="visibleMissionCards.length === 0"
        :class="['empty-panel', { error: loadError }]"
      >
        <span>{{ missionEmptyMessage }}</span>
        <button
          v-if="showMissionRetry"
          type="button"
          class="empty-retry"
          @click="loadDayPilot()"
        >
          重试生成
        </button>
      </div>

      <div v-else class="mission-cards">
        <article
          v-for="card in visibleMissionCards"
          :key="card.id"
          :class="[
            'mission-card',
            {
              expanded: expandedCardId === card.id,
              pending: isMissionFeedbackPending(card.id),
            },
          ]"
          :data-priority="card.priority"
          :aria-busy="isMissionFeedbackPending(card.id)"
        >
          <button
            type="button"
            class="mission-head"
            :aria-expanded="expandedCardId === card.id"
            @click="toggleCard(card.id)"
          >
            <div class="mission-row-1">
              <span :class="['priority-badge', card.priority]">
                {{ card.priority }}
              </span>
              <span :class="['state-badge', card.stateClass]">
                {{ card.state }}
              </span>
              <span class="mission-time">{{ card.timeLabel }}</span>
              <span class="chevron">▶</span>
            </div>
            <div class="mission-title">{{ card.title }}</div>
            <div class="mission-next">
              <span>你要做</span>
              <strong>{{ card.next || card.actions[0]?.title }}</strong>
            </div>
            <div class="mission-why">
              <span>为什么出现</span>
              <strong>{{ card.why }}</strong>
            </div>
            <div class="mission-tags">
              <span
                v-for="tag in card.tags"
                :key="`${card.id}:${tag.text}`"
                :class="['tag', tag.type]"
              >
                {{ tag.text }}
              </span>
            </div>
          </button>

          <div class="mission-body">
            <div class="mission-body-inner">
              <div v-if="card.rehearsalReceipt" class="sub-section">
                <div class="sub-title">预演回执</div>
                <div
                  :class="[
                    'rehearsal-receipt',
                    card.rehearsalReceipt.tone,
                  ]"
                >
                  <div class="receipt-row">
                    <span>线索</span>
                    <strong>{{ card.rehearsalReceipt.cueLabel }}</strong>
                  </div>
                  <div class="receipt-row">
                    <span>状态</span>
                    <strong>{{ card.rehearsalReceipt.statusLabel }}</strong>
                  </div>
                  <div class="receipt-row">
                    <span>脚本</span>
                    <strong>{{ card.rehearsalReceipt.script }}</strong>
                  </div>
                  <p>{{ card.rehearsalReceipt.boundary }}</p>
                </div>
              </div>

              <div class="sub-section">
                <div class="sub-title">排序回执</div>
                <div
                  :class="[
                    'card-ranking-receipt',
                    card.rankingReceipt.tone,
                  ]"
                >
                  <div class="receipt-row">
                    <span>去向</span>
                    <strong>{{ card.rankingReceipt.laneLabel }}</strong>
                  </div>
                  <div class="receipt-row">
                    <span>分数</span>
                    <strong>{{ card.rankingReceipt.scoreLabel }}</strong>
                  </div>
                  <div class="receipt-row">
                    <span>证据</span>
                    <strong>{{ card.rankingReceipt.evidenceLabel }}</strong>
                  </div>
                  <div class="receipt-row">
                    <span>边界</span>
                    <strong>{{ card.rankingReceipt.reason }}</strong>
                  </div>
                  <p>{{ card.rankingReceipt.boundary }}</p>
                </div>
              </div>

              <div class="sub-section">
                <div class="sub-title">证据 ({{ card.evidence.length }})</div>
                <div class="evidence-list">
                  <div
                    v-for="item in card.evidence"
                    :key="`${card.id}:${item.source}:${item.text}`"
                    class="evidence-item"
                  >
                    <div class="evidence-source">{{ item.source }}</div>
                    <div class="evidence-text">{{ item.text }}</div>
                  </div>
                </div>
              </div>

              <div class="sub-section">
                <div class="sub-title">建议动作</div>
                <div class="action-steps">
                  <div
                    v-for="(action, index) in card.actions"
                    :key="`${card.id}:action:${index}`"
                    class="action-step"
                  >
                    <div class="step-num">{{ index + 1 }}</div>
                    <div class="step-content">
                      <strong>{{ action.title }}</strong>
                      <span>{{ action.desc }}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div v-if="card.questions.length > 0" class="sub-section">
                <div class="sub-title">待确认</div>
                <div class="question-list">
                  <div
                    v-for="question in card.questions"
                    :key="`${card.id}:question:${question}`"
                    class="question-item"
                  >
                    {{ question }}
                  </div>
                </div>
              </div>

              <div
                v-if="card.executionChannel === 'openclaw'"
                class="sub-section"
              >
                <div class="sub-title">执行通道</div>
                <div class="execution-channel">
                  <div>
                    <div class="execution-channel-kicker">OpenClaw 外部执行</div>
                    <p>{{ card.executionNote }}</p>
                  </div>
                  <button
                    type="button"
                    class="execution-link"
                    @click.stop="navigateTo(card.route)"
                  >
                    {{ card.route.startsWith('/actions') ? '打开动作队列' : '打开处理页' }}
                  </button>
                </div>
              </div>

              <div v-else class="sub-section">
                <div class="context-preflight-receipt">
                  <span>上下文包范围</span>
                  <p>{{ contextPackPreActionReceipt(card) }}</p>
                </div>
                <div class="context-toolbar">
                  <div
                    class="provider-segment"
                    role="group"
                    aria-label="目标 AI"
                  >
                    <button
                      v-for="provider in providerOptions"
                      :key="provider.id"
                      type="button"
                      :class="[
                        'provider-btn',
                        { active: contextProvider === provider.id },
                      ]"
                      @click.stop="setContextProvider(provider.id, card)"
                    >
                      {{ provider.shortLabel }}
                    </button>
                  </div>
                  <label class="sensitive-toggle" @click.stop>
                    <input
                      type="checkbox"
                      :checked="includeSensitiveContext"
                      @change="setIncludeSensitiveContext($event, card)"
                    />
                    包含敏感原文
                  </label>
                  <button
                    type="button"
                    class="context-toggle"
                    @click.stop="toggleContextPack(card)"
                  >
                    {{
                      openContextPackIds.has(card.id) ? '收起' : '生成上下文包'
                    }}
                  </button>
                </div>
                <div
                  :class="[
                    'context-pack',
                    { open: openContextPackIds.has(card.id) },
                  ]"
                >
                  <div
                    v-if="isContextPackLoading(card.id)"
                    class="context-status"
                  >
                    正在生成 {{ currentProviderLabel }}...
                  </div>
                  <div
                    v-if="currentContextPack(card)"
                    class="source-coverage-note"
                  >
                    {{ contextPackSourceCoverageReceipt(currentContextPack(card)) }}
                  </div>
                  <div
                    v-if="currentContextPack(card)?.redactionApplied"
                    class="redaction-note"
                  >
                    已默认脱敏；复制前可展开预览确认。
                  </div>
                  <div
                    v-if="currentContextPack(card)?.truncated"
                    class="redaction-note"
                  >
                    正文已按当前预算截断；完整证据仍以卡片证据和详情页为准。
                  </div>
                  <div
                    v-if="currentRedactionPreview(card).length > 0"
                    class="redaction-list"
                  >
                    <div
                      v-for="item in currentRedactionPreview(card)"
                      :key="`${card.id}:redaction:${item}`"
                    >
                      {{ item }}
                    </div>
                  </div>
                  <pre>{{ currentPackText(card) }}</pre>
                </div>
              </div>

              <div
                v-if="isMissionFeedbackPending(card.id)"
                class="mission-pending-note"
                role="status"
                aria-live="polite"
              >
                反馈提交中 · 等待 Memory Service 确认；这张 mission 暂时保留，反馈按钮已锁定以避免重复提交。
              </div>

              <div class="card-actions">
                <button
                  type="button"
                  class="card-action primary"
                  :disabled="isMissionFeedbackPending(card.id)"
                  @click.stop="hideCardForToday(card, 'done')"
                >
                  {{ card.executionChannel ? '从首页移除' : '完成' }}
                </button>
                <button
                  type="button"
                  class="card-action secondary"
                  :disabled="isMissionFeedbackPending(card.id)"
                  @click.stop="hideCardForToday(card, 'later')"
                >
                  稍后 6h
                </button>
                <button
                  type="button"
                  class="card-action secondary"
                  :disabled="isMissionFeedbackPending(card.id)"
                  @click.stop="sendCardSignal(card, 'useful')"
                >
                  有用
                </button>
                <button
                  type="button"
                  class="card-action ghost"
                  :disabled="isMissionFeedbackPending(card.id)"
                  @click.stop="sendCardSignal(card, 'wrong')"
                >
                  不准确
                </button>
                <button
                  v-if="!card.executionChannel"
                  type="button"
                  class="card-action secondary"
                  @click.stop="copyContextPack(card)"
                >
                  复制上下文包
                </button>
                <button
                  type="button"
                  class="card-action ghost"
                  @click.stop="navigateTo(card.route)"
                >
                  打开详情
                </button>
                <button
                  type="button"
                  class="card-action ghost"
                  :disabled="isMissionFeedbackPending(card.id)"
                  @click.stop="hideCardForToday(card, 'mute')"
                >
                  不再提醒同类
                </button>
              </div>
            </div>
          </div>
        </article>
      </div>
    </section>

    <section v-if="catchUpSectionVisible" class="catch-up-panel">
      <div class="section-title">
        刚才错过了什么
        <span class="section-count">{{ catchUpCountLabel }}</span>
      </div>
      <div class="catch-up-card">
        <div class="catch-up-receipt" role="status">
          <span>补课回执</span>
          <p>{{ catchUpReceipt }}</p>
        </div>

        <div v-if="catchUpLoading" class="catch-up-empty">
          正在读取最近 90 分钟的新增记忆信号...
        </div>
        <div v-else-if="catchUpLoadError" class="catch-up-empty error">
          {{ catchUpLoadError }}
        </div>
        <div v-else class="catch-up-columns">
          <div class="catch-up-column">
            <div class="catch-up-column-title">高优变化</div>
            <button
              v-for="item in catchUpHighPriorityItems"
              :key="`high:${item.messageId}`"
              type="button"
              class="catch-up-item"
              @click="navigateToCatchUpItem(item)"
            >
              <span class="catch-up-item-meta">
                {{ sourceKindLabel(item.source) }} · {{ relativeTime(item.timestamp) }}
              </span>
              <strong>{{ limitText(item.title, 64) }}</strong>
              <span>{{ limitText(item.preview, 120) }}</span>
            </button>
            <div v-if="catchUpHighPriorityItems.length === 0" class="catch-up-empty">
              最近窗口没有足够高优的新增信号。
            </div>
          </div>

          <div class="catch-up-column">
            <div class="catch-up-column-title">等你回</div>
            <div
              v-if="catchUpWaitingOverlapCount > 0"
              class="catch-up-column-note"
            >
              {{ catchUpWaitingOverlapNote }}
            </div>
            <button
              v-for="item in catchUpWaitingItems"
              :key="`waiting:${item.messageId}`"
              type="button"
              class="catch-up-item waiting"
              @click="navigateToCatchUpItem(item)"
            >
              <span class="catch-up-item-meta">
                {{ sourceKindLabel(item.source) }} · {{ relativeTime(item.timestamp) }}
              </span>
              <strong>{{ limitText(item.title, 64) }}</strong>
              <span>{{ limitText(item.preview, 120) }}</span>
            </button>
            <div v-if="catchUpWaitingItems.length === 0" class="catch-up-empty">
              {{ catchUpWaitingEmptyMessage }}
            </div>
          </div>
        </div>
      </div>
    </section>

    <section>
      <div class="section-title">需要你处理</div>
      <div class="attention-bar">
        <button
          v-for="item in attentionItems"
          :key="item.id"
          type="button"
          class="attention-item"
          @click="navigateTo(item.route)"
        >
          <span class="attention-icon">{{ item.icon }}</span>
          <span class="attention-info">
            <span class="attention-count">{{ item.count }}</span>
            <span class="attention-label">{{ item.label }}</span>
          </span>
          <span class="attention-arrow">→</span>
        </button>
      </div>
    </section>

    <section v-if="topicPreviewItems.length > 0" class="topic-entry">
      <div>
        <div class="section-title compact">未读主题入口</div>
        <p>
          首页只展示少量未读主题信号；完整阅读、稍后、静音和已阅操作请进入主题页处理。
        </p>
      </div>
      <div class="topic-preview-list">
        <button
          v-for="topic in topicPreviewItems"
          :key="topic.id"
          type="button"
          class="topic-preview"
          @click="navigateTo(`/topic/${topic.id}`)"
        >
          <strong>{{ topic.name }}</strong>
          <span>{{ topic.readStatus?.unreadCount || 0 }} 条未读</span>
        </button>
      </div>
      <button
        type="button"
        class="topic-all-btn"
        @click="navigateTo('/entity/Topic')"
      >
        进入主题收件箱 →
      </button>
    </section>

    <section v-if="timelineItems.length > 0" class="timeline">
      <div class="section-title">今日时间线</div>
      <div class="timeline-list">
        <div
          v-for="item in timelineItems"
          :key="`${item.time}:${item.title}`"
          class="tl-item"
        >
          <div
            :class="['tl-dot', { active: item.active, muted: item.muted }]"
          />
          <div class="tl-time">{{ item.time }}</div>
          <div class="tl-content">
            <div class="tl-title">{{ item.title }}</div>
            <div class="tl-desc">{{ item.desc }}</div>
            <button
              v-if="item.route"
              type="button"
              class="tl-link"
              @click="navigateTo(item.route)"
            >
              查看关联内容 →
            </button>
          </div>
        </div>
      </div>
    </section>

    <div class="footer-note">
      今日领航由现有记忆数据聚合生成；决策、动作、主题阅读仍在各自子页面完成。
    </div>

    <div :class="['day-toast', { show: toastMessage }]">
      {{ toastMessage }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useMemoryStore } from '../memory-store';
import {
  getMemoryServiceClient,
  type AmbientCalibrationEvidenceRef,
  type ConfirmRequest,
  type DayPilotBrief,
  type DayPilotCard,
  type DayPilotCatchUpBrief,
  type DayPilotCatchUpItem,
  type DayPilotContextPackResponse,
  type DayPilotProviderTarget,
  type DayPilotRehearsalCueReceipt,
  type NotificationRecord,
  type OutreachSession,
  type OutreachSummary,
  type OutreachTemplateRuntimeStatusItem,
  type PersonalSkillListItem,
  type ReflectionThread,
  type RuntimeAction,
  type StatsResponse,
} from '../../services/MemoryServiceClient';
import {
  getEnvConfig,
  isSceneRehearsalDisplayEnabledFromConfig,
} from '../../utils';
import {
  countTodayPilotCandidates,
  countTodayPilotRawSignals,
  countTodayPilotSelectedEvidence,
  getTodayPilotSourceStatItems,
  summarizeTodayPilotNoiseBreakdown,
} from '../../todayPilotSourceStats';

type MissionPriority = 'critical' | 'high' | 'medium' | 'low';
type MissionStateClass = 'now' | 'prepare' | 'waiting';
type MissionTagType = 'person' | 'source' | 'project';
type MissionRankingTone = 'normal' | 'quiet' | 'warn';
type MissionFeedbackAction = 'done' | 'later' | 'mute' | 'useful' | 'wrong';
type MissionFeedbackReceiptTone = 'success' | 'info' | 'warning' | 'failed';

interface MissionRankingReceipt {
  tagLabel: string;
  laneLabel: string;
  scoreLabel: string;
  evidenceLabel: string;
  reason: string;
  boundary: string;
  tone: MissionRankingTone;
}

interface MissionCard {
  id: string;
  missionId?: string;
  sourceHash?: string;
  cardType?: string;
  executionChannel?: 'openclaw';
  executionNote?: string;
  priority: MissionPriority;
  state: string;
  stateClass: MissionStateClass;
  timeLabel: string;
  title: string;
  next?: string;
  why: string;
  tags: Array<{ text: string; type: MissionTagType }>;
  evidence: Array<{ source: string; text: string }>;
  actions: Array<{ title: string; desc: string }>;
  questions: string[];
  pack: string;
  route: string;
  rankingReceipt: MissionRankingReceipt;
  rehearsalReceipt?: DayPilotRehearsalCueReceipt;
}

interface AttentionItem {
  id: string;
  icon: string;
  label: string;
  count: number;
  route: string;
}

interface RankingSummaryItem {
  key: string;
  value: string;
  label: string;
  tone: 'normal' | 'quiet' | 'warn';
}

interface MissionFeedbackReceipt {
  title: string;
  detail: string;
  boundary: string;
  tone: MissionFeedbackReceiptTone;
}

const store = useMemoryStore();
const router = useRouter();
const client = getMemoryServiceClient();

const loading = ref(false);
const loadError = ref('');
const dayBrief = ref<DayPilotBrief | null>(null);
const catchUpBrief = ref<DayPilotCatchUpBrief | null>(null);
const catchUpLoading = ref(false);
const catchUpLoadError = ref('');
const stats = ref<StatsResponse | null>(null);
const statsLoading = ref(false);
const statsLoadError = ref('');
const _decisionRequests = ref<ConfirmRequest[]>([]);
const decisionTotal = ref(0);
const _watchRequests = ref<ConfirmRequest[]>([]);
const watchTotal = ref(0);
const _queuedActions = ref<RuntimeAction[]>([]);
const queuedActionTotal = ref(0);
const _outreachSessions = ref<OutreachSession[]>([]);
const _outreachTemplates = ref<OutreachTemplateRuntimeStatusItem[]>([]);
const outreachSummary = ref<OutreachSummary>({
  upcomingCount: 0,
  waitingReplyCount: 0,
  escalatedCount: 0,
  pendingApprovalCount: 0,
});
const pendingTemplateCount = ref(0);
const _activeSkillTotal = ref(0);
const _skillSuggestions = ref<PersonalSkillListItem[]>([]);
const skillSuggestionTotal = ref(0);
const _pendingNotifications = ref<NotificationRecord[]>([]);
const _activeReflections = ref<ReflectionThread[]>([]);
const _activeReflectionTotal = ref(0);
const refreshedAt = ref(Date.now());
const expandedCardId = ref<string | null>(null);
const openContextPackIds = ref(new Set<string>());
const hiddenDayPilotCardIds = ref(new Set<string>());
const sceneRehearsalDisplayEnabled = ref(true);
const contextProvider = ref<DayPilotProviderTarget>('codex');
const includeSensitiveContext = ref(false);
const contextPackCache = ref<Record<string, DayPilotContextPackResponse>>({});
const contextPackLoadingIds = ref(new Set<string>());
const missionFeedbackReceipt = ref<MissionFeedbackReceipt | null>(null);
const missionFeedbackPendingCardIds = ref(new Set<string>());
const processedMissionFeedbackCount = ref(0);
const toastMessage = ref('');
let toastTimer: ReturnType<typeof setTimeout> | null = null;

const TERMINAL_OUTREACH_STATUSES = new Set([
  'resolved',
  'no_reply',
  'escalated',
  'cancelled',
  'failed',
]);

const todayLabel = computed(() =>
  new Intl.DateTimeFormat('zh-CN', {
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(new Date()),
);

const timezoneLabel = computed(
  () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'local',
);

const refreshedAtLabel = computed(() =>
  new Date(refreshedAt.value).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  }),
);

const sourceTags = computed(() => {
  const sourceStats = displaySourceStats.value;
  if (sourceStats) {
    const tags: Array<{ key: string; label: string; warn: boolean }> = [
      {
        key: 'messages',
        label: `${sourceStats.messages.totalRecent} 消息`,
        warn: false,
      },
      {
        key: 'calendar',
        label: `${sourceStats.calendar.upcoming} 日历`,
        warn: false,
      },
      {
        key: 'notifications',
        label: `${sourceStats.notifications.pending} 待提醒`,
        warn: sourceStats.notifications.pending > 0,
      },
    ];
    if (sceneRehearsalDisplayEnabled.value) {
      tags.push({
        key: 'rehearsals',
        label: `${sourceStats.rehearsals?.active || 0} 预演`,
        warn: false,
      });
    }
    tags.push({
      key: 'missions',
      label: `${visibleMissionCards.value.length} mission`,
      warn: false,
    });
    return tags;
  }
  if (statsLoading.value) {
    return [{ key: 'loading', label: '记忆统计加载中', warn: true }];
  }
  if (statsLoadError.value) {
    return [{ key: 'unavailable', label: '记忆统计暂不可用', warn: true }];
  }
  const current = stats.value;
  if (!current) {
    return [{ key: 'empty', label: '记忆统计暂不可用', warn: true }];
  }
  return [
    { key: 'messages', label: `${current.messages.total} 消息`, warn: false },
    { key: 'chunks', label: `${current.chunks.total} 片段`, warn: false },
    {
      key: 'relationships',
      label: `${current.relationships.total} 关系`,
      warn: false,
    },
    {
      key: 'notifications',
      label: `${current.notifications.pending} 待提醒`,
      warn: current.notifications.pending > 0,
    },
  ];
});

const statsIdentityReceipt = computed(() => {
  const identity = stats.value?.user;
  if (!identity) return null;

  const isDefaultFallback =
    identity.fallbackToDefault || identity.identitySource === 'default_fallback';
  const id = identity.id || 'default';
  return {
    tone: isDefaultFallback ? 'warning' : 'ok',
    title: isDefaultFallback
      ? '当前统计来自 default 只读回退'
      : `当前统计来自 ${id}`,
    source: isDefaultFallback
      ? '身份来源: 未解析，/stats 本次回退到 default'
      : '身份来源: 已解析并发送 X-User-Id',
    storage: identity.storageKey || `data/users/${id}/memory.db`,
    boundary: isDefaultFallback
      ? '这是只读兼容快照；写入、导入和恢复仍会被拦截，直到身份恢复。'
      : 'Today Mission 和顶部统计只读取这个 per-user SQLite 空间；不会迁移、导入、恢复或写回其他用户空间。',
  };
});

const outreachTotal = computed(
  () =>
    pendingTemplateCount.value +
    outreachSummary.value.upcomingCount +
    outreachSummary.value.waitingReplyCount +
    outreachSummary.value.escalatedCount +
    outreachSummary.value.pendingApprovalCount,
);

const unreadTopics = computed(() => store.getUnreadTopicsByImportance());
const unreadTopicCount = computed(() => unreadTopics.value.length);
const topicPreviewItems = computed(() => unreadTopics.value.slice(0, 2));

const providerOptions: Array<{
  id: DayPilotProviderTarget;
  shortLabel: string;
}> = [
  { id: 'codex', shortLabel: 'Codex' },
  { id: 'chatgpt', shortLabel: 'ChatGPT' },
  { id: 'claude', shortLabel: 'Claude' },
  { id: 'doubao', shortLabel: '豆包' },
  { id: 'generic', shortLabel: '通用' },
];

const currentProviderLabel = computed(
  () =>
    providerOptions.find((provider) => provider.id === contextProvider.value)
      ?.shortLabel || '上下文包',
);

function providerShortLabel(provider: DayPilotProviderTarget) {
  return (
    providerOptions.find((item) => item.id === provider)?.shortLabel || '通用'
  );
}

function contextPackEvidenceCoverage(pack: DayPilotContextPackResponse) {
  const total =
    typeof pack.sourceSummary?.evidenceCount === 'number'
      ? pack.sourceSummary.evidenceCount
      : pack.evidenceRefs.length;
  const rendered =
    typeof pack.sourceSummary?.renderedEvidenceCount === 'number'
      ? pack.sourceSummary.renderedEvidenceCount
      : pack.evidenceRefs.length;
  const omitted =
    typeof pack.sourceSummary?.omittedEvidenceCount === 'number'
      ? pack.sourceSummary.omittedEvidenceCount
      : Math.max(0, total - rendered);
  return {
    total,
    rendered: Math.max(0, Math.min(total, rendered)),
    omitted: Math.max(0, omitted),
  };
}

function formatSourceKindSummary(pack: DayPilotContextPackResponse) {
  const sourceKinds = pack.sourceSummary?.sourceKinds || {};
  const entries = Object.entries(sourceKinds)
    .filter(([, count]) => Number(count || 0) > 0)
    .sort(([left], [right]) => left.localeCompare(right));
  if (!entries.length) return '无来源';
  return entries.map(([kind, count]) => `${kind} ${count}`).join('、');
}

function contextPackSourceCoverageReceipt(
  pack?: DayPilotContextPackResponse,
) {
  if (!pack) return '';
  const coverage = contextPackEvidenceCoverage(pack);
  const details = [
    `复制正文 ${coverage.rendered}/${coverage.total} 条证据`,
    `来源 ${formatSourceKindSummary(pack)}`,
  ];
  if (coverage.omitted > 0) {
    details.push(`${coverage.omitted} 条因预算未进入正文`);
  }
  return details.join('；');
}

function contextPackPreActionReceipt(card: MissionCard) {
  const evidenceCount = Math.max(0, card.evidence?.length || 0);
  const sensitiveMode = includeSensitiveContext.value
    ? '本次包含敏感原文'
    : '默认脱敏';
  return `当前目标 ${providerShortLabel(
    contextProvider.value,
  )}；生成只读取这张 mission 的 ${evidenceCount} 条证据，${sensitiveMode}；复制只写入本机剪贴板，不会发送给外部 AI、批准/执行或写回来源系统。`;
}

function contextPackCopyReceipt(pack: DayPilotContextPackResponse) {
  const coverage = contextPackEvidenceCoverage(pack);
  const details = [`复制正文 ${coverage.rendered}/${coverage.total} 条证据`];
  if (coverage.omitted > 0) {
    details.push(`${coverage.omitted} 条未进入正文`);
  }
  if (pack.redactionApplied) {
    details.push('已脱敏');
  } else if (includeSensitiveContext.value) {
    details.push('含敏感原文');
  }
  if (pack.truncated) {
    details.push('已按预算截断');
  }
  return `已复制 ${providerShortLabel(pack.targetProvider)} 上下文包（${details.join(
    '，',
  )}）。`;
}

function hashContextPackBody(body: string) {
  let hash = 0;
  for (let index = 0; index < body.length; index += 1) {
    hash = ((hash << 5) - hash + body.charCodeAt(index)) | 0;
  }
  return Math.abs(hash).toString(36);
}

function contextPackEvidenceTraceRefs(
  pack: DayPilotContextPackResponse,
): AmbientCalibrationEvidenceRef[] {
  return pack.evidenceRefs.slice(0, 12).map((ref) => ({
    id: `${ref.sourceKind}:${ref.sourceId}`,
    type: ref.sourceKind,
    title: ref.title,
    sourceLabel: ref.sourceKind,
    role: 'used',
  }));
}

function recordContextPackCopyTrace(
  card: MissionCard,
  pack: DayPilotContextPackResponse,
) {
  void client
    .submitAmbientCalibrationTrace({
      surface: 'today_pilot',
      sceneKey: `today_pilot:${dayBrief.value?.localDate || 'unknown'}:${
        card.missionId || card.id
      }`,
      sourceRequestId: `context-pack:${card.missionId || card.id}:${
        pack.targetProvider
      }`,
      action: 'copied_context',
      strength: 'strong',
      polarity: 'positive',
      evidenceRefs: contextPackEvidenceTraceRefs(pack),
      redactedDiff: {
        rawTextStored: false,
        bodyHash: hashContextPackBody(pack.bodyMd),
        bodyLength: pack.bodyMd.length,
        evidenceCount: pack.evidenceRefs.length,
        redactionApplied: pack.redactionApplied,
        truncated: pack.truncated,
      },
      privacyClass:
        pack.redactionApplied || pack.redactionPreview.length > 0
          ? 'sensitive_redacted'
          : 'normal',
      metadata: {
        nativeSurface: 'today_pilot_home',
        cardId: card.id,
        missionId: card.missionId,
        cardType: card.cardType,
        targetProvider: pack.targetProvider,
        providerProfile: pack.providerProfile.id,
        includeSensitive: includeSensitiveContext.value,
        usageIntent: pack.usageIntent?.kind || 'external_ai_context',
        contextBoundary:
          pack.usageIntent?.boundary || 'context_only_not_execution',
      },
      createdAt: Date.now(),
    })
    .catch((error) => {
      console.warn('Today Pilot context pack copy trace failed:', error);
    });
}

const attentionBudget = computed(() => ({
  max: dayBrief.value?.attentionBudget.maxInterruptions ?? 3,
  used: displayAttentionBudgetUsed.value,
}));

const displayAttentionBudgetUsed = computed(() => {
  const budget = dayBrief.value?.attentionBudget;
  if (!budget) {
    return Math.min(
      3,
      Number(decisionTotal.value > 0) +
        Number(watchTotal.value > 0) +
        Number(queuedActionTotal.value > 0) +
        Number(outreachTotal.value > 0),
    );
  }

  const planned = budget.plannedInterruptions;
  if (planned?.length) {
    const visibleIds = visibleDayPilotCardIds.value;
    return planned.filter((item) => visibleIds.has(item.cardId)).length;
  }

  if (
    visibleDayPilotCards.value.length !== (dayBrief.value?.cards.length || 0)
  ) {
    return Math.min(budget.usedInterruptions, visibleDayPilotCards.value.length);
  }
  return budget.usedInterruptions;
});

const budgetPercent = computed(() => {
  const percent =
    (attentionBudget.value.used / Math.max(attentionBudget.value.max, 1)) * 100;
  return `${Math.min(100, Math.max(0, percent))}%`;
});

const rankingSummary = computed<RankingSummaryItem[]>(() => {
  const sourceItems = displaySourceStatItems.value;
  if (sourceItems.length === 0) return [];

  const candidates = countTodayPilotCandidates(sourceItems);
  const selected = countTodayPilotSelectedEvidence(sourceItems);
  const total = countTodayPilotRawSignals(sourceItems);
  const candidateNotSelected = Math.max(0, candidates - selected);
  const prefilteredNoise = Math.max(0, total - candidates);
  const prefilteredNoiseBreakdown =
    summarizeTodayPilotNoiseBreakdown(sourceItems);
  const boardOnly =
    dayBrief.value?.attentionBudget.boardOnlyCardIds?.filter((cardId) =>
      visibleDayPilotCardIds.value.has(cardId),
    ).length || 0;

  return [
    {
      key: 'candidates',
      value: `${candidates}/${total}`,
      label: '条信号进入候选池',
      tone: candidates > 0 ? 'normal' : 'quiet',
    },
    {
      key: 'selected',
      value: String(selected),
      label: '条证据进入首页 mission',
      tone: selected > 0 ? 'normal' : 'quiet',
    },
    {
      key: 'candidate-not-selected',
      value: String(candidateNotSelected),
      label: '条候选未入选首页',
      tone: candidateNotSelected > 0 ? 'quiet' : 'normal',
    },
    {
      key: 'prefiltered-noise',
      value: String(prefilteredNoise),
      label: prefilteredNoiseBreakdown
        ? `条前置降噪信号 · ${prefilteredNoiseBreakdown}`
        : '条前置降噪信号',
      tone: prefilteredNoise > 0 ? 'quiet' : 'normal',
    },
    {
      key: 'delivery',
      value: `${attentionBudget.value.used}/${attentionBudget.value.max}`,
      label: `计划打断，${boardOnly} 个留在首页`,
      tone: attentionBudget.value.used > 0 ? 'warn' : 'quiet',
    },
  ];
});

const rankingNote = computed(() => {
  if (!dayBrief.value) return '';
  if (processedMissionFeedbackCount.value > 0) {
    return `当前是反馈后的可见快照：本轮已写入 ${processedMissionFeedbackCount.value} 条 Today Pilot 展示/排序反馈；顶部数量只代表仍可见 mission，不代表来源任务完成、消息已读、排程变更或外部系统已同步。`;
  }
  if (visibleMissionCards.value.length === 0) {
    return '没有足够强的今日动作信号，低价值同步和旧提醒不会抬高优先级。';
  }
  if (attentionBudget.value.used > 0) {
    return '只有 Now/高优先级且低隐私风险的 mission 会占用提醒预算。';
  }
  return '当前 mission 仅在首页展示，waiting、低优先级或高隐私风险保持静默。';
});

const missionEmptyMessage = computed(() => {
  if (loadError.value) {
    return '今日领航暂时不可用，尚不能判断今天是否没有高优先级事项。请稍后刷新。';
  }
  return '当前没有需要放到首页的高优先级事项。可以从左侧进入决策中心、动作队列或主题页查看完整列表。';
});

const showMissionRetry = computed(() => Boolean(loadError.value && !loading.value));

const MISSION_LIMIT = 7;
const CATCH_UP_DISPLAY_LIMIT = 3;
const displaySourceStats = computed<DayPilotBrief['sourceStats'] | null>(() => {
  const sourceStats = dayBrief.value?.sourceStats;
  if (!sourceStats) return null;
  if (sceneRehearsalDisplayEnabled.value) return sourceStats;
  return {
    ...sourceStats,
    rehearsals: {
      scanned: 0,
      active: 0,
    },
  };
});

const displaySourceStatItems = computed(() => {
  const brief = dayBrief.value;
  const sourceStats = displaySourceStats.value;
  if (!brief || !sourceStats) return [];
  return getTodayPilotSourceStatItems(
    {
      ...brief,
      sourceStats,
    },
    visibleDayPilotCards.value,
  );
});

function isDayPilotCardDisplayable(card: DayPilotCard) {
  return (
    sceneRehearsalDisplayEnabled.value || card.cardType !== 'rehearsal_prompt'
  );
}

const displayDayPilotCards = computed(() =>
  (dayBrief.value?.cards ?? []).filter(isDayPilotCardDisplayable),
);

const missionCards = computed<MissionCard[]>(() => {
  return displayDayPilotCards.value
    .map(mapDayPilotCard)
    .slice(0, MISSION_LIMIT);
});

const visibleMissionCards = computed(() =>
  missionCards.value.filter((card) => !isDayPilotCardClosed(card.id)),
);

const visibleDayPilotCards = computed(() =>
  displayDayPilotCards.value.filter((card) => !isDayPilotCardClosed(card.id)),
);

const visibleDayPilotCardIds = computed(
  () => new Set(visibleDayPilotCards.value.map((card) => card.id)),
);

const catchUpHighPriorityItems = computed(() =>
  (catchUpBrief.value?.highPriority ?? []).slice(0, CATCH_UP_DISPLAY_LIMIT),
);

const catchUpHighPriorityItemIds = computed(
  () => new Set(catchUpHighPriorityItems.value.map((item) => item.messageId)),
);

const catchUpWaitingOverlapCount = computed(
  () =>
    (catchUpBrief.value?.waiting ?? []).filter((item) =>
      catchUpHighPriorityItemIds.value.has(item.messageId),
    ).length,
);

const catchUpWaitingItems = computed(() =>
  (catchUpBrief.value?.waiting ?? [])
    .filter((item) => !catchUpHighPriorityItemIds.value.has(item.messageId))
    .slice(0, CATCH_UP_DISPLAY_LIMIT),
);

const catchUpWaitingOverlapNote = computed(() => {
  const count = catchUpWaitingOverlapCount.value;
  return count > 0
    ? `${count} 条等你回已在高优变化展示，这里不重复列出。`
    : '';
});

const catchUpWaitingEmptyMessage = computed(() => {
  if (catchUpWaitingOverlapCount.value > 0) {
    return '等你回信号已在高优变化中展示，这里不重复列出。';
  }
  return '最近窗口没有明确 @你、问句或等回复信号。';
});

const catchUpSectionVisible = computed(
  () =>
    catchUpLoading.value ||
    Boolean(catchUpLoadError.value) ||
    Boolean(catchUpBrief.value && catchUpBrief.value.total > 0),
);

const catchUpCountLabel = computed(() => {
  if (catchUpLoading.value) return '读取中';
  return `${catchUpBrief.value?.total ?? 0} 条`;
});

const catchUpReceipt = computed(() => {
  if (catchUpLoadError.value) {
    return '补课读取失败；Today Pilot 没有把失败解释成没有新事项，也没有标记任何来源为已读。';
  }
  const brief = catchUpBrief.value;
  if (!brief) {
    return '读取最近 90 分钟新增记忆信号，只生成只读快照。';
  }
  const high = brief.highPriority?.length || 0;
  const waiting = brief.waiting?.length || 0;
  const overlapNote =
    catchUpWaitingOverlapCount.value > 0
      ? `其中 ${catchUpWaitingOverlapCount.value} 条等你回已在高优变化展示，不重复当成第二条待办。`
      : '';
  return `窗口 ${formatCatchUpWindow(
    brief,
  )}；${brief.total} 条新信号，高优 ${high} 条，等你回 ${waiting} 条。${overlapNote}这里只读排序，不会标已读、代回复、改排序或写回来源系统。`;
});

const attentionItems = computed<AttentionItem[]>(() => [
  {
    id: 'decisions',
    icon: '⚖',
    label: '待拍板决策',
    count: decisionTotal.value,
    route: '/decisions',
  },
  {
    id: 'actions',
    icon: '⚙',
    label: '排队中动作',
    count: queuedActionTotal.value,
    route: '/actions',
  },
  {
    id: 'outreach',
    icon: '📡',
    label: '跟进中询问',
    count: outreachTotal.value,
    route: '/outreach',
  },
  {
    id: 'skills',
    icon: '🧪',
    label: '技能建议',
    count: skillSuggestionTotal.value,
    route: '/skills',
  },
  {
    id: 'topics',
    icon: '💡',
    label: '未读主题',
    count: unreadTopicCount.value,
    route: '/entity/Topic',
  },
]);

const timelineItems = computed(() =>
  visibleMissionCards.value.slice(0, 5).map((card, index) => ({
    time: card.timeLabel,
    title: card.title,
    desc: card.tags.map((tag) => tag.text).join(' · '),
    active: index < 2,
    muted: card.priority === 'low',
    route: card.route,
  })),
);

async function loadDayPilot() {
  loading.value = true;
  loadError.value = '';
  void loadStats();
  void loadCatchUpBrief();
  try {
    const envConfig = await getEnvConfig();
    sceneRehearsalDisplayEnabled.value =
      isSceneRehearsalDisplayEnabledFromConfig(envConfig);
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const result = await client.getTodayPilotToday({
      timezone: timezone || 'Asia/Shanghai',
      autoGenerate: true,
    });
    dayBrief.value = result.brief;
    missionFeedbackReceipt.value = null;
    processedMissionFeedbackCount.value = 0;
    decisionTotal.value = countCards('decision_check');
    queuedActionTotal.value = dayBrief.value.sourceStats.actions.queued;
    pendingTemplateCount.value = 0;
    outreachSummary.value = {
      upcomingCount: 0,
      waitingReplyCount: 0,
      escalatedCount: 0,
      pendingApprovalCount: 0,
    };
    skillSuggestionTotal.value = dayBrief.value.sourceStats.skills.suggestions;
    refreshedAt.value = Date.now();
  } catch (error) {
    console.error('加载今日领航失败:', error);
    dayBrief.value = null;
    resetDayPilotDerivedCounts();
    loadError.value =
      '今日领航后端暂时不可用，无法从原始记忆生成今日 mission。请稍后刷新。';
  } finally {
    loading.value = false;
  }
}

async function loadCatchUpBrief() {
  catchUpLoading.value = true;
  catchUpLoadError.value = '';
  try {
    catchUpBrief.value = await client.getTodayPilotCatchUp({
      awayMinutes: 90,
    });
  } catch (error) {
    console.error('加载 Today Pilot 补课失败:', error);
    catchUpBrief.value = null;
    catchUpLoadError.value =
      '补课快照暂时不可用；未标记消息已读，也没有改变来源收件箱顺序。';
  } finally {
    catchUpLoading.value = false;
  }
}

async function loadStats() {
  statsLoading.value = true;
  statsLoadError.value = '';
  try {
    stats.value = await client.getStats();
  } catch (error) {
    console.error('加载记忆统计失败:', error);
    stats.value = null;
    statsLoadError.value = '记忆统计暂不可用';
  } finally {
    statsLoading.value = false;
  }
}

function countCards(cardType: string) {
  return (dayBrief.value?.cards ?? []).filter(
    (card) => card.cardType === cardType,
  ).length;
}

function resetDayPilotDerivedCounts() {
  decisionTotal.value = 0;
  queuedActionTotal.value = 0;
  pendingTemplateCount.value = 0;
  outreachSummary.value = {
    upcomingCount: 0,
    waitingReplyCount: 0,
    escalatedCount: 0,
    pendingApprovalCount: 0,
  };
  skillSuggestionTotal.value = 0;
}

function mapDayPilotCard(card: DayPilotCard): MissionCard {
  const route = routeForDayPilotCard(card);
  const executionChannel = detectExecutionChannel(card);
  const rankingReceipt = buildDayPilotRankingReceipt(card);
  const evidence = card.evidenceRefs.slice(0, 5).map((item) => ({
    source: limitText(item.title || `${item.sourceKind}:${item.sourceId}`, 40),
    text: limitText(item.snippet, 220),
  }));
  return {
    id: card.id,
    missionId: card.missionId,
    sourceHash: card.sourceHash,
    cardType: card.cardType,
    executionChannel,
    executionNote:
      executionChannel === 'openclaw'
        ? '这条确认不是选择 Codex、ChatGPT、Claude 或豆包来执行。Today Pilot 只负责提醒和整理证据；批准、拒绝或拍板需要进入对应处理页，真正的外部执行只会由 OpenClaw 接管。'
        : undefined,
    priority: card.priority,
    state: stateLabel(card.state),
    stateClass:
      card.state === 'now'
        ? 'now'
        : card.state === 'prepare'
        ? 'prepare'
        : 'waiting',
    timeLabel: card.dueAt
      ? relativeTime(card.dueAt)
      : relativeTime(card.evidenceRefs[0]?.timestamp || card.updatedAt),
    title: limitText(card.title, 88),
    next: limitText(card.nextBestAction, 130),
    why: limitText(card.whyNow, 220),
    tags: compactTags([
      ...card.people
        .slice(0, 2)
        .map((person) => missionTag(person.name, 'person')),
      ...card.projects
        .slice(0, 2)
        .map((project) => missionTag(project.name, 'project')),
      missionTag(cardTypeLabel(card.cardType), 'source'),
      missionTag(rankingReceipt.tagLabel, 'source'),
      missionTag(`trust ${Math.round(card.trust.confidence * 100)}%`, 'source'),
    ]),
    evidence,
    actions: [
      {
        title: card.nextBestAction,
        desc: nextActionDesc(card),
      },
    ],
    questions: card.openQuestions.slice(0, 4),
    pack:
      typeof card.contextPack?.preview === 'string'
        ? card.contextPack.preview
        : buildPack([
            `Mission: ${card.title}`,
            `Why now: ${card.whyNow}`,
            `Next: ${card.nextBestAction}`,
            ...card.evidenceRefs.map(
              (item) =>
                `Evidence: ${item.title || item.sourceKind} - ${item.snippet}`,
            ),
          ]),
    route,
    rankingReceipt,
    rehearsalReceipt: card.contextPack?.rehearsalCueReceipt,
  };
}

function buildDayPilotRankingReceipt(
  card: DayPilotCard,
): MissionRankingReceipt {
  const delivery = resolveDayPilotAttentionDelivery(card);
  const score = scoreOutOf100(card.score);
  const sourceKinds = Array.from(
    new Set((card.evidenceRefs || []).map((item) => item.sourceKind)),
  );
  const evidenceKinds =
    sourceKinds.map(sourceKindLabel).filter(Boolean).join('、') || '未知来源';
  const staleCount = Number(card.trust.staleEvidenceCount || 0);
  const sensitiveCount = Number(card.trust.sensitiveEvidenceCount || 0);
  const privacy = riskLevelLabel(card.trust.riskLevel);
  const confidence = Math.round((card.trust.confidence || 0) * 100);
  const laneLabel = attentionLaneLabel(delivery);

  return {
    tagLabel: `提醒:${laneLabel}`,
    laneLabel,
    scoreLabel: `${score}/100 · ${priorityLabel(card.priority)} · ${stateLabel(
      card.state,
    )}`,
    evidenceLabel: `${card.evidenceRefs.length} 条 · ${evidenceKinds} · 置信 ${confidence}% · ${privacy}${
      staleCount || sensitiveCount
        ? ` · 陈旧 ${staleCount} / 敏感 ${sensitiveCount}`
        : ''
    }`,
    reason: attentionReasonForCard(card, delivery),
    boundary: attentionBoundaryForDelivery(delivery),
    tone:
      delivery === 'interrupt' ? 'warn' : delivery === 'silent' ? 'quiet' : 'normal',
  };
}

function resolveDayPilotAttentionDelivery(
  card: DayPilotCard,
): 'interrupt' | 'board' | 'silent' {
  const delivery = (card.contextPack?.attention as { delivery?: string } | undefined)
    ?.delivery;
  if (delivery === 'interrupt' || delivery === 'board' || delivery === 'silent') {
    return delivery;
  }
  if (card.trust.riskLevel === 'high') return 'silent';
  if (
    card.state === 'now' &&
    (card.priority === 'critical' || card.priority === 'high')
  ) {
    return 'interrupt';
  }
  if (card.priority === 'low' || card.state === 'waiting') return 'silent';
  return 'board';
}

function scoreOutOf100(score: number) {
  const value = Number.isFinite(score) ? score : 0;
  return Math.max(0, Math.min(100, Math.round(value <= 1 ? value * 100 : value)));
}

function attentionLaneLabel(delivery: 'interrupt' | 'board' | 'silent') {
  if (delivery === 'interrupt') return '计划打断';
  if (delivery === 'silent') return '静默展示';
  return '首页展示';
}

function priorityLabel(priority: DayPilotCard['priority']) {
  const labels: Record<DayPilotCard['priority'], string> = {
    critical: 'Critical',
    high: 'High',
    medium: 'Medium',
    low: 'Low',
  };
  return labels[priority] || priority;
}

function sourceKindLabel(kind: string) {
  const labels: Record<string, string> = {
    message: '消息',
    calendar: '日历',
    notification: '通知',
    action: '动作',
    reflection: '反思',
    rehearsal: '预演',
    skill: '技能',
    relationship: '关系',
  };
  return labels[kind] || kind;
}

function riskLevelLabel(level: DayPilotCard['trust']['riskLevel']) {
  const labels: Record<DayPilotCard['trust']['riskLevel'], string> = {
    low: '低隐私风险',
    medium: '中隐私风险',
    high: '高隐私风险',
  };
  return labels[level] || level;
}

function attentionReasonForCard(
  card: DayPilotCard,
  delivery: 'interrupt' | 'board' | 'silent',
) {
  if (card.trust.riskLevel === 'high') {
    return '隐私风险偏高，只保留为用户主动查看的事项，不主动推送。';
  }
  if (delivery === 'interrupt') {
    return 'Now 状态、高优先级且隐私风险低，会占用今日提醒预算。';
  }
  if (card.state === 'waiting') {
    return '仍在等待外部回复、排程或进一步证据，打开首页时可见。';
  }
  if (card.priority === 'low') {
    return '行动紧迫度较低，不主动打断，只在首页保留入口。';
  }
  if (card.trust.staleEvidenceCount > 0) {
    return '包含陈旧证据，适合先展开复核后再处理。';
  }
  return '值得今天看到，但不够紧急或不适合推送，只留在首页处理。';
}

function attentionBoundaryForDelivery(
  delivery: 'interrupt' | 'board' | 'silent',
) {
  if (delivery === 'interrupt') {
    return '提醒预算只表示这张卡可以被推到前面；不会自动批准、发送、执行或改写外部系统。';
  }
  if (delivery === 'silent') {
    return '静默展示不会产生推送；需要处理时仍要从首页或详情页进入对应子页面。';
  }
  return '首页展示只负责排序和解释原因；完成、稍后、静默或外部处理都需要用户明确点击。';
}

function detectExecutionChannel(card: DayPilotCard): 'openclaw' | undefined {
  if (card.cardType !== 'decision_check') return undefined;

  const evidenceText = card.evidenceRefs
    .map((item) =>
      [item.sourceKind, item.sourceId, item.title, item.snippet]
        .filter(Boolean)
        .join(' '),
    )
    .join(' ');
  const hasOpenClawDelegation =
    /delegate[_-]?openclaw|openclaw_delegation/i.test(evidenceText);
  const hasOpenClawActionEvidence = card.evidenceRefs.some((item) => {
    if (item.sourceKind !== 'action') return false;
    return /openclaw|ringclaw/i.test(
      [item.sourceId, item.title, item.snippet].filter(Boolean).join(' '),
    );
  });
  return hasOpenClawDelegation || hasOpenClawActionEvidence
    ? 'openclaw'
    : undefined;
}

function stateLabel(state: DayPilotCard['state']) {
  const labels: Record<DayPilotCard['state'], string> = {
    now: 'Now',
    prepare: 'Prepare',
    waiting: 'Waiting',
    done: 'Done',
    muted: 'Muted',
  };
  return labels[state] || state;
}

function cardTypeLabel(cardType: DayPilotCard['cardType']) {
  const labels: Record<DayPilotCard['cardType'], string> = {
    meeting_prepare: '会前准备',
    thread_followup: 'Thread follow-up',
    decision_check: '决策检查',
    ai_tool_shift: 'AI 工具',
    project_risk: '项目风险',
    relationship_ping: '关系上下文',
    rehearsal_prompt: '预演提醒',
    skill_opportunity: '技能机会',
    memory_quality: '记忆质量',
  };
  return labels[cardType] || cardType;
}

function routeForDayPilotCard(card: DayPilotCard) {
  const primaryEvidence = card.evidenceRefs[0];
  if (card.cardType === 'skill_opportunity') return '/skills';
  if (card.cardType === 'rehearsal_prompt') return '/rehearsals';
  if (card.cardType === 'meeting_prepare') return '/timeline';
  if (card.cardType === 'memory_quality') {
    return primaryEvidence?.sourceId
      ? `/search?q=${encodeURIComponent(card.title)}`
      : '/search';
  }
  if (primaryEvidence?.sourceKind === 'action') {
    return `/actions?actionId=${encodeURIComponent(primaryEvidence.sourceId)}`;
  }
  if (primaryEvidence?.sourceKind === 'reflection') {
    return `/reflection-threads/${encodeURIComponent(
      primaryEvidence.sourceId,
    )}`;
  }
  if (primaryEvidence?.sourceKind === 'calendar') return '/timeline';
  return `/search?q=${encodeURIComponent(card.title)}`;
}

function nextActionDesc(card: DayPilotCard) {
  if (card.cardType === 'decision_check') {
    return '强状态处理仍在对应子页面完成，首页只负责提示和上下文整理。';
  }
  if (card.cardType === 'meeting_prepare') {
    return '打开详情后可以查看相关时间线，并复制 mission context pack 给其他 AI。';
  }
  if (card.cardType === 'rehearsal_prompt') {
    return '先核对预演回执里的线索和脚本；需要更新、暂停或标记不相关时进入 Rehearsal 管理页。';
  }
  return '展开卡片查看证据和上下文包，再决定完成、稍后或静默。';
}

function _isPendingTemplate(item: OutreachTemplateRuntimeStatusItem): boolean {
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
  if (!scheduleDate) return null;
  const date = new Date(
    `${scheduleDate}T${
      scheduleTime.length === 5 ? `${scheduleTime}:00` : scheduleTime
    }`,
  );
  if (Number.isNaN(date.getTime())) return null;
  return Math.floor(date.getTime() / 1000);
}

function toggleCard(id: string) {
  expandedCardId.value = expandedCardId.value === id ? null : id;
}

async function toggleContextPack(card: MissionCard) {
  const next = new Set(openContextPackIds.value);
  if (next.has(card.id)) {
    next.delete(card.id);
  } else {
    next.add(card.id);
    void loadContextPack(card);
  }
  openContextPackIds.value = next;
}

function isDayPilotCardClosed(cardId: string) {
  return hiddenDayPilotCardIds.value.has(cardId);
}

function isMissionFeedbackPending(cardId: string) {
  return missionFeedbackPendingCardIds.value.has(cardId);
}

function setMissionFeedbackPending(cardId: string, pending: boolean) {
  const next = new Set(missionFeedbackPendingCardIds.value);
  if (pending) {
    next.add(cardId);
  } else {
    next.delete(cardId);
  }
  missionFeedbackPendingCardIds.value = next;
}

function contextPackKey(card: MissionCard) {
  return `${card.id}:${contextProvider.value}:${
    includeSensitiveContext.value ? 'sensitive' : 'redacted'
  }`;
}

function currentContextPack(card: MissionCard) {
  return contextPackCache.value[contextPackKey(card)];
}

function currentPackText(card: MissionCard) {
  return currentContextPack(card)?.bodyMd || card.pack;
}

function currentRedactionPreview(card: MissionCard) {
  return currentContextPack(card)?.redactionPreview || [];
}

function isContextPackLoading(cardId: string) {
  return contextPackLoadingIds.value.has(cardId);
}

function setContextProvider(
  provider: DayPilotProviderTarget,
  card: MissionCard,
) {
  contextProvider.value = provider;
  if (openContextPackIds.value.has(card.id)) {
    void loadContextPack(card);
  }
}

function setIncludeSensitiveContext(event: Event, card: MissionCard) {
  includeSensitiveContext.value = Boolean(
    (event.target as HTMLInputElement | null)?.checked,
  );
  if (openContextPackIds.value.has(card.id)) {
    void loadContextPack(card, true);
  }
}

async function loadContextPack(card: MissionCard, force = false) {
  if (!card.missionId) return false;
  const key = contextPackKey(card);
  if (!force && contextPackCache.value[key]) return true;

  const loading = new Set(contextPackLoadingIds.value);
  loading.add(card.id);
  contextPackLoadingIds.value = loading;
  let loaded = false;
  try {
    const pack = await client.renderTodayPilotContextPack(card.missionId, {
      tokenBudget: 1600,
      targetProvider: contextProvider.value,
      includeSensitive: includeSensitiveContext.value,
    });
    contextPackCache.value = {
      ...contextPackCache.value,
      [key]: pack,
    };
    loaded = true;
  } catch (error) {
    console.error('生成 Day Pilot context pack 失败:', error);
    showToast('上下文包生成失败，请稍后重试。');
  } finally {
    const next = new Set(contextPackLoadingIds.value);
    next.delete(card.id);
    contextPackLoadingIds.value = next;
  }
  return loaded;
}

async function sendCardSignal(card: MissionCard, action: 'useful' | 'wrong') {
  if (isMissionFeedbackPending(card.id)) return;
  setMissionFeedbackPending(card.id, true);
  missionFeedbackReceipt.value = buildMissionFeedbackPendingReceipt(card, action);
  try {
    const feedback = await client.sendTodayPilotCardFeedback(card.id, {
      action,
      muteKey: card.sourceHash,
    });
    dayBrief.value = feedback.brief;
    processedMissionFeedbackCount.value += 1;
    missionFeedbackReceipt.value = buildMissionFeedbackReceipt(card, action);
    showToast(
      action === 'useful' ? '已记录：这张卡有用。' : '已记录：这张卡不准确。',
    );
  } catch (error) {
    console.error('写入 Day Pilot 信号失败:', error);
    missionFeedbackReceipt.value = buildMissionFeedbackFailureReceipt(card);
    showToast('反馈写入失败。');
  } finally {
    setMissionFeedbackPending(card.id, false);
  }
}

async function hideCardForToday(
  card: MissionCard,
  reason: 'done' | 'later' | 'mute',
) {
  if (isMissionFeedbackPending(card.id)) return;
  setMissionFeedbackPending(card.id, true);
  missionFeedbackReceipt.value = buildMissionFeedbackPendingReceipt(card, reason);
  try {
    const feedback = await client.sendTodayPilotCardFeedback(card.id, {
      action: reason,
      snoozeUntil:
        reason === 'later'
          ? Math.floor(Date.now() / 1000) + 6 * 3600
          : undefined,
      muteKey: reason === 'mute' ? card.sourceHash : undefined,
    });
    dayBrief.value = feedback.brief;
    hiddenDayPilotCardIds.value = new Set([
      ...Array.from(hiddenDayPilotCardIds.value),
      card.id,
    ]);
    processedMissionFeedbackCount.value += 1;
  } catch (error) {
    console.error('写入 Day Pilot feedback 失败:', error);
    missionFeedbackReceipt.value = buildMissionFeedbackFailureReceipt(card);
    showToast('反馈写入失败，卡片仍保留。');
    return;
  } finally {
    setMissionFeedbackPending(card.id, false);
  }
  missionFeedbackReceipt.value = buildMissionFeedbackReceipt(card, reason);
  const messages = {
    done: '已从今日首页移除。',
    later: '已放到稍后，6 小时内不再显示。',
    mute: '已静默同类提醒。',
  };
  showToast(messages[reason]);
}

function buildMissionFeedbackPendingReceipt(
  card: MissionCard,
  action: MissionFeedbackAction,
): MissionFeedbackReceipt {
  const cardTitle = limitText(card.title, 52);
  const labels: Record<MissionFeedbackAction, string> = {
    done: '移出首页',
    later: '稍后 6 小时',
    mute: '静默同类提醒',
    useful: '记录有用',
    wrong: '记录不准确',
  };
  return {
    title: `正在提交反馈：${labels[action]} · ${cardTitle}`,
    detail:
      '等待 Memory Service 确认前，这张 mission 仍保留当前状态；反馈按钮已暂时锁定以避免重复提交。',
    boundary:
      '尚未写入 Today Pilot 展示/排序反馈，也不会标记来源任务完成、消息已读、修改排程、发送、批准或执行外部动作。',
    tone: 'info',
  };
}

function buildMissionFeedbackReceipt(
  card: MissionCard,
  action: MissionFeedbackAction,
): MissionFeedbackReceipt {
  const cardTitle = limitText(card.title, 52);
  if (action === 'done') {
    return {
      title: `已从今日首页移除：${cardTitle}`,
      detail: '只记录 Today Pilot 的完成反馈，今天首页不再展示这张 mission。',
      boundary:
        '这不会把来源任务、动作队列、决策、消息或外部系统标记为已完成；真正处理仍需进入对应详情页。',
      tone: 'success',
    };
  }
  if (action === 'later') {
    return {
      title: `已稍后 6 小时：${cardTitle}`,
      detail: '到期前 Today Pilot 不再展示这张卡，稍后时间只作用于今日领航反馈。',
      boundary:
        '这不是修改来源排程、日历或动作执行时间，也不会发送、批准或执行任何外部动作。',
      tone: 'info',
    };
  }
  if (action === 'mute') {
    return {
      title: `已静默同类提醒：${cardTitle}`,
      detail: '同类 source hash 的 Today Pilot mission 会被后续降噪或隐藏。',
      boundary:
        '这不会删除原始记忆、证据或来源消息；需要删除或修正内容时仍要进入来源详情。',
      tone: 'warning',
    };
  }
  if (action === 'useful') {
    return {
      title: `已记录有用：${cardTitle}`,
      detail: '这是一条 Today Pilot 排序反馈，会帮助后续类似 mission 提升权重。',
      boundary:
        '这不会批准、发送、执行、创建任务或写入新的长期事实；它只是排序学习信号。',
      tone: 'success',
    };
  }
  return {
    title: `已记录不准确：${cardTitle}`,
    detail: '这是一条 Today Pilot 去噪反馈，会帮助后续类似 mission 降权。',
    boundary:
      '这不会删除原始证据或改写长期记忆；需要修正事实时请打开来源详情处理。',
    tone: 'warning',
  };
}

function buildMissionFeedbackFailureReceipt(
  card: MissionCard,
): MissionFeedbackReceipt {
  return {
    title: `反馈未写入：${limitText(card.title, 52)}`,
    detail: 'Today Pilot 没有保存这次反馈；如果卡片曾被暂时隐藏，已经恢复。',
    boundary:
      '来源任务、动作队列、决策、消息、记忆和外部系统都没有被修改。请稍后重试。',
    tone: 'failed',
  };
}

async function copyContextPack(card: MissionCard) {
  try {
    if (!navigator.clipboard?.writeText) {
      showToast('当前环境不支持直接复制，请展开上下文包手动复制。');
      return;
    }
    const loaded = await loadContextPack(card);
    const pack = currentContextPack(card);
    if (!loaded || !pack) {
      showToast('上下文包生成失败，未复制。请展开卡片重试。');
      return;
    }
    await navigator.clipboard.writeText(pack.bodyMd);
    recordContextPackCopyTrace(card, pack);
    showToast(contextPackCopyReceipt(pack));
  } catch (error) {
    console.error('复制上下文包失败:', error);
    showToast('复制失败，请展开上下文包手动复制。');
  }
}

function navigateTo(path: string) {
  router.push(path);
}

function navigateToCatchUpItem(item: DayPilotCatchUpItem) {
  const query = item.title || item.preview || item.messageId;
  router.push(`/search?q=${encodeURIComponent(query)}`);
}

function showToast(message: string) {
  toastMessage.value = message;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastMessage.value = '';
    toastTimer = null;
  }, 1800);
}

function relativeTime(timestamp?: number) {
  if (!timestamp) return '刚刚';
  const value = timestamp > 20_000_000_000 ? timestamp : timestamp * 1000;
  const diff = Date.now() - value;
  if (diff < -24 * 60 * 60 * 1000) {
    return `${Math.ceil(Math.abs(diff) / (24 * 60 * 60 * 1000))}天后`;
  }
  if (diff < -60 * 60 * 1000) {
    return `${Math.ceil(Math.abs(diff) / (60 * 60 * 1000))}小时后`;
  }
  if (diff < -60_000) return `${Math.ceil(Math.abs(diff) / 60_000)}分钟后`;
  if (diff < 0) return '即将';
  if (diff < 60_000) return '刚刚';
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `${minutes}分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}小时前`;
  return `${Math.floor(hours / 24)}天前`;
}

function formatCatchUpWindow(brief: DayPilotCatchUpBrief) {
  const minutes = Math.max(
    1,
    Math.round((brief.nowTs - brief.sinceTs) / 60),
  );
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest > 0 ? `${hours} 小时 ${rest} 分钟` : `${hours} 小时`;
  }
  return `${minutes} 分钟`;
}

function _buildDecisionMission(request: ConfirmRequest): MissionCard {
  const context = confirmContextText(request);
  return {
    id: `decision:${request.id}`,
    priority: priorityFromString(request.priority, 'high'),
    state: 'Now',
    stateClass: 'now',
    timeLabel: relativeTime(request.createdAt),
    title: limitText(request.question, 80),
    why:
      context ||
      `${confirmReasonLabel(
        request,
      )}，需要你在决策中心完成选择后系统才能继续推进。`,
    tags: compactTags([
      missionTag('决策中心', 'source'),
      missionTag(confirmReasonLabel(request), 'project'),
      missionTag(request.category, 'source'),
    ]),
    evidence: compactEvidence([
      {
        source: request.category || request.reasonCode || 'Confirm Request',
        text: context || request.question,
      },
      {
        source: '状态',
        text: `priority=${request.priority}，state=${request.state}，queue=${
          request.routing || 'decision'
        }`,
      },
    ]),
    actions: [
      {
        title: '进入决策中心处理',
        desc: '首页只展示这件具体事项；批准、拒绝、选项回答仍在决策中心完成。',
      },
    ],
    questions: request.options?.map((option) => option.label).slice(0, 4) || [],
    pack: buildPack([
      'Mission: Review one pending Personal AI decision',
      `Question: ${request.question}`,
      context ? `Context: ${context}` : '',
      request.options?.length
        ? `Options: ${request.options
            .map((option) => option.label)
            .join(' / ')}`
        : '',
      'Boundary: answer inside Decision Center; homepage only previews.',
    ]),
    route: '/decisions',
  };
}

function _buildWatchMission(request: ConfirmRequest): MissionCard {
  const context = confirmContextText(request);
  return {
    id: `watch:${request.id}`,
    priority: priorityFromString(request.priority, 'medium'),
    state: 'Waiting',
    stateClass: 'waiting',
    timeLabel: relativeTime(request.updatedAt || request.createdAt),
    title: limitText(request.question, 80),
    why:
      context ||
      '这是一个仍在观察中的具体事项。首页提示今天值得扫一眼，状态变更仍回到决策中心完成。',
    tags: compactTags([
      missionTag('观察队列', 'source'),
      missionTag(confirmReasonLabel(request), 'project'),
      missionTag(request.category, 'source'),
    ]),
    evidence: compactEvidence([
      {
        source: request.category || request.reasonCode || 'Watch Request',
        text: context || request.question,
      },
      request.snoozeCount > 0
        ? {
            source: '观察次数',
            text: `已观察 ${request.snoozeCount} 次。`,
          }
        : null,
    ]),
    actions: [
      {
        title: '进入观察队列复查',
        desc: '决定立即查证、继续观察或结束追踪。',
      },
    ],
    questions: request.gapType ? [request.gapType] : [],
    pack: buildPack([
      'Mission: Review one Personal AI watch item',
      `Question: ${request.question}`,
      context ? `Context: ${context}` : '',
      request.snoozeUntil ? `Snoozed until: ${request.snoozeUntil}` : '',
      'Boundary: state transitions stay inside Decision Center.',
    ]),
    route: '/decisions',
  };
}

function _buildActionMission(action: RuntimeAction): MissionCard {
  const needsApproval = action.requiresApproval || action.riskLevel === 'high';
  return {
    id: `action:${action.id}`,
    priority: priorityFromString(
      action.riskLevel,
      needsApproval ? 'high' : 'medium',
    ),
    state: needsApproval ? 'Now' : 'Prepare',
    stateClass: needsApproval ? 'now' : 'prepare',
    timeLabel: action.scheduledAt
      ? relativeTime(action.scheduledAt)
      : relativeTime(action.createdAt),
    title: limitText(action.title || action.actionType, 80),
    why:
      limitText(action.description || action.lastError || '', 180) ||
      `动作队列里有一条 ${action.actionType} 动作等待执行或确认。`,
    tags: compactTags([
      missionTag('动作队列', 'source'),
      missionTag(action.actionType, 'project'),
      missionTag(action.executionMode, 'source'),
    ]),
    evidence: compactEvidence([
      {
        source: action.sourceKind || action.source || 'Runtime Action',
        text: action.description || action.title,
      },
      action.lastError
        ? { source: '最近错误', text: action.lastError }
        : {
            source: '执行状态',
            text: `queue=${action.queueStatus}，risk=${action.riskLevel}，retry=${action.retryCount}`,
          },
    ]),
    actions: [
      {
        title: needsApproval ? '确认是否执行' : '查看排队动作',
        desc: '进入动作队列查看参数、依赖、风险和执行结果。',
      },
    ],
    questions: needsApproval ? ['是否允许这条动作继续执行？'] : [],
    pack: buildPack([
      'Mission: Review one queued Personal AI action',
      `Action: ${action.title}`,
      `Type: ${action.actionType}`,
      action.description ? `Description: ${action.description}` : '',
      action.requiresApproval ? 'Needs approval before execution.' : '',
    ]),
    route: `/actions?actionId=${encodeURIComponent(action.id)}`,
  };
}

function _buildOutreachSessionMission(session: OutreachSession): MissionCard {
  const statusLabel = outreachSessionStatusLabel(session.status);
  const isUrgent =
    session.status === 'pending_approval' || session.status === 'escalated';
  return {
    id: `outreach-session:${session.id}`,
    priority: isUrgent ? 'high' : 'medium',
    state: isUrgent
      ? 'Now'
      : session.status === 'scheduled'
      ? 'Prepare'
      : 'Waiting',
    stateClass: isUrgent
      ? 'now'
      : session.status === 'scheduled'
      ? 'prepare'
      : 'waiting',
    timeLabel: session.waitUntil
      ? relativeTime(session.waitUntil)
      : relativeTime(session.updatedAt || session.createdAt),
    title: limitText(`主动询问：${session.renderedQuestion}`, 82),
    why:
      limitText(session.renderedContext || session.errorMessage || '', 180) ||
      `这条主动询问当前处于「${statusLabel}」状态，需要按会话推进。`,
    tags: compactTags([
      missionTag('主动询问', 'source'),
      missionTag(statusLabel, 'project'),
      missionTag(session.targetResolvedLabel || session.targetRef, 'person'),
    ]),
    evidence: compactEvidence([
      { source: '问题', text: session.renderedQuestion },
      session.renderedContext
        ? { source: '信息目标', text: session.renderedContext }
        : null,
      session.replyRawText
        ? { source: '最近回复', text: session.replyRawText }
        : null,
    ]),
    actions: [
      {
        title: isUrgent ? '处理这条询问' : '查看询问进展',
        desc: '进入具体会话查看审批、排程、等待回复或升级信息。',
      },
    ],
    questions: session.requiresApproval ? ['今天是否允许这条询问发出？'] : [],
    pack: buildPack([
      'Mission: Review one outreach session',
      `Question: ${session.renderedQuestion}`,
      session.renderedContext
        ? `Information goal: ${session.renderedContext}`
        : '',
      `Status: ${statusLabel}`,
      session.targetResolvedLabel
        ? `Target: ${session.targetResolvedLabel}`
        : '',
    ]),
    route: `/outreach/${encodeURIComponent(session.id)}`,
  };
}

function _buildOutreachTemplateMission(
  item: OutreachTemplateRuntimeStatusItem,
): MissionCard {
  const nextDispatchAt = resolveTemplateNextDispatchAt(item);
  return {
    id: `outreach-template:${item.template.id}`,
    priority: item.template.approvalPolicy === 'manual' ? 'high' : 'medium',
    state: 'Prepare',
    stateClass: 'prepare',
    timeLabel: nextDispatchAt ? relativeTime(nextDispatchAt) : '待排程',
    title: limitText(
      item.template.title || item.template.questionTemplate || '待触发主动询问',
      82,
    ),
    why:
      limitText(
        item.template.contextTemplate || item.template.questionTemplate || '',
        180,
      ) || '这是一条即将触发的主动询问计划，需要确认是否仍适合今天发出。',
    tags: compactTags([
      missionTag('主动询问计划', 'source'),
      missionTag(item.template.approvalPolicy || 'auto', 'project'),
      missionTag(item.template.targetRef, 'person'),
    ]),
    evidence: compactEvidence([
      {
        source: '计划问题',
        text: item.template.questionTemplate || item.template.title,
      },
      nextDispatchAt
        ? { source: '下一次触发', text: relativeTime(nextDispatchAt) }
        : null,
      item.template.lastSyncError
        ? { source: '同步错误', text: item.template.lastSyncError }
        : null,
    ]),
    actions: [
      {
        title: '检查计划是否发出',
        desc: '进入主动询问页确认目标、信息目标和审批策略。',
      },
    ],
    questions:
      item.template.approvalPolicy === 'manual'
        ? ['这条询问今天是否允许发出？']
        : [],
    pack: buildPack([
      'Mission: Review one pending outreach plan',
      `Plan: ${item.template.title}`,
      item.template.questionTemplate
        ? `Question: ${item.template.questionTemplate}`
        : '',
      item.template.contextTemplate
        ? `Information goal: ${item.template.contextTemplate}`
        : '',
    ]),
    route: `/outreach?templateId=${encodeURIComponent(item.template.id)}`,
  };
}

function _buildSkillSuggestionMission(
  skill: PersonalSkillListItem,
): MissionCard {
  return {
    id: `skill:${skill.id}`,
    priority: skill.risk === 'high' ? 'high' : 'medium',
    state: 'Prepare',
    stateClass: 'prepare',
    timeLabel: skill.suggestedAt ? relativeTime(skill.suggestedAt) : '可萃取',
    title: limitText(`沉淀技能：${skill.title}`, 82),
    why:
      limitText(
        skill.summary || skill.repetition || skill.trigger || '',
        180,
      ) || 'Personal AI 发现了一条可能值得沉淀的具体做事方法。',
    tags: compactTags([
      missionTag('个人技能', 'source'),
      missionTag(skill.scope, 'project'),
      missionTag(skill.risk, 'source'),
    ]),
    evidence: compactEvidence([
      { source: '摘要', text: skill.summary },
      skill.suggestedFrom
        ? { source: '来源', text: skill.suggestedFrom }
        : null,
      skill.riskBrief ? { source: '风险', text: skill.riskBrief } : null,
    ]),
    actions: [
      {
        title: '审阅这条技能建议',
        desc: '进入技能库决定使用、丢弃或稍后审。',
      },
    ],
    questions: ['这条方法是否会重复使用？'],
    pack: buildPack([
      'Mission: Review one personal skill suggestion',
      `Skill: ${skill.title}`,
      skill.summary ? `Summary: ${skill.summary}` : '',
      skill.trigger ? `Trigger: ${skill.trigger}` : '',
      skill.notUse ? `Do not use when: ${skill.notUse}` : '',
    ]),
    route: '/skills',
  };
}

function _buildNotificationMission(
  notification: NotificationRecord,
): MissionCard {
  return {
    id: `notification:${notification.id}`,
    priority:
      Number(notification.utilityScore || 0) >= 0.8 ||
      notification.type === 'truth_conflict'
        ? 'high'
        : 'medium',
    state: 'Now',
    stateClass: 'now',
    timeLabel: relativeTime(notification.createdAt),
    title: limitText(notification.title, 82),
    why:
      limitText(notification.body || '', 180) ||
      '这是一条尚未处理的具体记忆提醒，不应该只藏在统计数字里。',
    tags: compactTags([
      missionTag('记忆提醒', 'source'),
      missionTag(notification.type, 'project'),
      missionTag(notification.channel, 'source'),
    ]),
    evidence: compactEvidence([
      {
        source: notification.type || 'Notification',
        text: notification.body || notification.title,
      },
      notification.payload
        ? { source: 'payload', text: JSON.stringify(notification.payload) }
        : null,
    ]),
    actions: [
      {
        title: '查看相关记忆',
        desc: '进入对应主题或搜索页确认这条提醒是否需要处理。',
      },
    ],
    questions: [],
    pack: buildPack([
      'Mission: Review one pending memory notification',
      `Title: ${notification.title}`,
      notification.body ? `Body: ${notification.body}` : '',
      notification.type ? `Type: ${notification.type}` : '',
    ]),
    route: notification.topicId
      ? `/topic/${encodeURIComponent(notification.topicId)}`
      : `/search?q=${encodeURIComponent(notification.title)}`,
  };
}

function _buildTopicMission(topic: any): MissionCard {
  const unreadCount = Number(topic.readStatus?.unreadCount || 0);
  return {
    id: `topic:${topic.id}`,
    priority: Number(topic.importance || 0) >= 0.8 ? 'medium' : 'low',
    state: 'Waiting',
    stateClass: 'waiting',
    timeLabel: topic.updated ? relativeTime(topic.updated) : '阅读入口',
    title: limitText(topic.name || '未读主题', 82),
    why:
      limitText(topic.description || '', 180) ||
      `${unreadCount} 条未读讨论适合进入主题页集中处理。`,
    tags: compactTags([
      missionTag('主题', 'source'),
      missionTag(`${unreadCount} 未读`, 'project'),
    ]),
    evidence: compactEvidence(
      Array.isArray(topic.unreadDiscussions)
        ? topic.unreadDiscussions.slice(0, 3).map((discussion: any) => ({
            source: '未读讨论',
            text: discussion.text || discussion.summary || '',
          }))
        : [
            {
              source: '主题状态',
              text: `${unreadCount} 条未读讨论。`,
            },
          ],
    ),
    actions: [
      {
        title: '进入主题页阅读',
        desc: '在主题页完成阅读、稍后、静音和已阅操作，首页不承载完整阅读流。',
      },
    ],
    questions: [],
    pack: buildPack([
      'Mission: Review one unread topic',
      `Topic: ${topic.name}`,
      `Unread messages: ${unreadCount}`,
      topic.description ? `Description: ${topic.description}` : '',
    ]),
    route: `/topic/${encodeURIComponent(topic.id)}`,
  };
}

function _buildReflectionMission(thread: ReflectionThread): MissionCard {
  return {
    id: `reflection:${thread.id}`,
    priority: thread.priority >= 8 ? 'medium' : 'low',
    state: 'Waiting',
    stateClass: 'waiting',
    timeLabel: thread.nextReflectionAt
      ? relativeTime(thread.nextReflectionAt)
      : relativeTime(thread.updatedAt),
    title: limitText(thread.title, 82),
    why:
      limitText(
        thread.currentHypothesis ||
          thread.latestSummary ||
          thread.continueReason ||
          '',
        180,
      ) || '这条自我反思线程仍在跟踪，今天没有更高优先级事项时可以复查。',
    tags: compactTags([
      missionTag('自我反思', 'source'),
      missionTag(thread.sourceType, 'project'),
    ]),
    evidence: compactEvidence([
      {
        source: '当前假设',
        text: thread.currentHypothesis || thread.latestSummary,
      },
      thread.openQuestions?.length
        ? { source: '开放问题', text: thread.openQuestions.join(' / ') }
        : null,
    ]),
    actions: [
      {
        title: '查看反思线程',
        desc: '决定继续推进、暂停或关闭这个观察。',
      },
    ],
    questions: thread.openQuestions?.slice(0, 3) || [],
    pack: buildPack([
      'Mission: Review one active reflection thread',
      `Thread: ${thread.title}`,
      thread.currentHypothesis ? `Hypothesis: ${thread.currentHypothesis}` : '',
      thread.latestSummary ? `Summary: ${thread.latestSummary}` : '',
    ]),
    route: `/reflection-threads/${encodeURIComponent(thread.id)}`,
  };
}

function _sortMissionCards(a: MissionCard, b: MissionCard) {
  const priorityOrder: Record<MissionPriority, number> = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1,
  };
  return priorityOrder[b.priority] - priorityOrder[a.priority];
}

function missionTag(
  text: string | number | undefined | null,
  type: MissionTagType,
) {
  if (text === undefined || text === null || String(text).trim().length === 0) {
    return null;
  }
  return { text: limitText(String(text), 24), type };
}

function compactTags(
  tags: Array<{ text: string; type: MissionTagType } | null>,
) {
  return tags.filter((tag): tag is { text: string; type: MissionTagType } =>
    Boolean(tag),
  );
}

function compactEvidence(
  items: Array<{ source: string; text?: string | null } | null>,
) {
  return items
    .filter((item): item is { source: string; text?: string | null } =>
      Boolean(item && item.text && item.text.trim().length > 0),
    )
    .slice(0, 4)
    .map((item) => ({
      source: limitText(item.source, 40),
      text: limitText(item.text || '', 220),
    }));
}

function priorityFromString(
  value: string | undefined,
  fallback: MissionPriority,
): MissionPriority {
  if (value === 'critical') return 'critical';
  if (value === 'high') return 'high';
  if (value === 'low') return 'low';
  if (value === 'medium' || value === 'normal') return 'medium';
  return fallback;
}

function confirmReasonLabel(request: ConfirmRequest) {
  const labels: Record<string, string> = {
    authority_required: '需要你定夺',
    approval_required: '需要审批',
    action_result_improvement: '规则改进',
    future_monitoring: '持续观察',
    owner_eta_gap: '负责人 / ETA 缺口',
    artifact_gap: '等待更多证据',
    time_sensitive_blocker: '时效阻塞',
  };
  if (request.reasonCode && labels[request.reasonCode]) {
    return labels[request.reasonCode];
  }
  if (request.category) return request.category;
  return request.routing === 'watch' ? '观察项' : '待确认';
}

function confirmContextText(request: ConfirmRequest) {
  if (!request.context) return '';
  try {
    const parsed = JSON.parse(request.context) as Record<string, unknown>;
    const candidates = [
      parsed.summary,
      parsed.reason,
      parsed.sourceActionTitle,
      parsed.sourceMessage,
      parsed.outcomeSummary,
    ];
    const found = candidates.find(
      (item) => typeof item === 'string' && item.trim().length > 0,
    );
    if (typeof found === 'string') return limitText(found, 220);
  } catch {
    // Plain text context is expected for most confirm requests.
  }
  return limitText(request.context, 220);
}

function outreachSessionStatusLabel(status: string) {
  const labels: Record<string, string> = {
    pending_approval: '待审批',
    scheduled: '已排程',
    waiting_reply: '等待回复',
    deferred: '延期等待',
    resolved: '已拿到结果',
    no_reply: '无回复',
    escalated: '已升级',
    cancelled: '已取消',
    failed: '失败',
  };
  return labels[status] || status || '未知状态';
}

function limitText(text: string, maxLength: number) {
  const normalized = String(text || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1)}…`;
}

function buildPack(lines: Array<string | false | null | undefined>) {
  return lines.filter(Boolean).join('\n');
}

onMounted(() => {
  void loadDayPilot();
});
</script>

<style scoped>
.day-pilot-home {
  max-width: 980px;
  margin: 0 auto;
  padding: 1.5rem;
  animation: fadeInUp 0.45s ease-out;
}

.brief-header,
.mission-card,
.catch-up-card,
.attention-item,
.topic-entry,
.empty-panel,
.load-error,
.mission-feedback-receipt {
  border: 1px solid rgba(148, 163, 184, 0.1);
  background: rgba(15, 23, 42, 0.6);
  backdrop-filter: blur(10px);
  border-radius: 0.85rem;
}

.brief-header {
  padding: 1.25rem 1.5rem;
  margin-bottom: 1.5rem;
  background: linear-gradient(
      135deg,
      rgba(59, 130, 246, 0.1),
      rgba(147, 51, 234, 0.1)
    ),
    rgba(15, 23, 42, 0.55);
}

.brief-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}

.brief-greeting {
  color: #ffffff;
  font-size: 1.35rem;
  font-weight: 650;
  line-height: 1.3;
}

.brief-subtitle {
  margin-top: 0.35rem;
  color: #cbd5e1;
  font-size: 0.875rem;
}

.brief-meta {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.source-tag {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.3rem 0.6rem;
  background: rgba(15, 23, 42, 0.62);
  border: 1px solid rgba(148, 163, 184, 0.14);
  border-radius: 999px;
  color: #94a3b8;
  font-size: 0.75rem;
  font-weight: 650;
  white-space: nowrap;
}

.source-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #22c55e;
}

.source-dot.warn {
  background: #f59e0b;
}

.refresh-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 2rem;
  padding: 0.4rem 0.85rem;
  border: 1px solid rgba(59, 130, 246, 0.3);
  border-radius: 0.5rem;
  background: rgba(59, 130, 246, 0.18);
  color: #60a5fa;
  cursor: pointer;
  font-size: 0.8rem;
  font-weight: 750;
}

.refresh-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.budget-strip {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 1rem;
  padding-top: 0.85rem;
  border-top: 1px solid rgba(148, 163, 184, 0.1);
}

.budget-label,
.budget-count {
  color: #94a3b8;
  font-size: 0.78rem;
  font-weight: 750;
  white-space: nowrap;
}

.budget-count {
  color: #22c55e;
}

.budget-track {
  flex: 1;
  height: 6px;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.15);
}

.budget-fill {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #22c55e, #60a5fa);
  transition: width 0.3s ease;
}

.ranking-strip {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.85rem;
  padding-top: 0.85rem;
  border-top: 1px solid rgba(148, 163, 184, 0.1);
}

.ranking-kicker,
.ranking-chip,
.ranking-note {
  font-size: 0.74rem;
  line-height: 1.45;
}

.ranking-kicker {
  color: #60a5fa;
  font-weight: 850;
  white-space: nowrap;
}

.ranking-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  min-height: 1.75rem;
  padding: 0.2rem 0.55rem;
  border: 1px solid rgba(148, 163, 184, 0.12);
  border-radius: 0.45rem;
  color: #cbd5e1;
  background: rgba(15, 23, 42, 0.55);
  font-weight: 650;
  white-space: nowrap;
}

.ranking-chip strong {
  color: #ffffff;
  font-weight: 850;
}

.ranking-chip.quiet strong {
  color: #22c55e;
}

.ranking-chip.warn strong {
  color: #fbbf24;
}

.ranking-note {
  flex: 1 1 260px;
  min-width: 0;
  color: #94a3b8;
}

.stats-identity-receipt {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0.45rem;
  margin-top: 0.85rem;
  padding-top: 0.85rem;
  border-top: 1px solid rgba(148, 163, 184, 0.1);
  color: #cbd5e1;
}

.stats-identity-receipt.ok {
  color: #cbd5e1;
}

.stats-identity-receipt.warning {
  color: #fde68a;
}

.stats-identity-main {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.45rem;
  min-width: 0;
}

.stats-identity-kicker,
.stats-identity-source,
.stats-identity-storage,
.stats-identity-receipt p {
  font-size: 0.72rem;
  line-height: 1.45;
}

.stats-identity-kicker {
  color: #60a5fa;
  font-weight: 850;
}

.stats-identity-receipt.warning .stats-identity-kicker {
  color: #fbbf24;
}

.stats-identity-receipt strong {
  color: #ffffff;
  font-size: 0.78rem;
  font-weight: 850;
  overflow-wrap: anywhere;
}

.stats-identity-source {
  color: #94a3b8;
}

.stats-identity-receipt.warning .stats-identity-source {
  color: #fde68a;
}

.stats-identity-storage {
  min-width: 0;
  color: #bfdbfe;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
    'Liberation Mono', 'Courier New', monospace;
  overflow-wrap: anywhere;
}

.stats-identity-receipt p {
  margin: 0;
  color: #94a3b8;
}

.stats-identity-receipt.warning p {
  color: #fcd34d;
}

.load-error {
  margin-bottom: 1rem;
  padding: 0.75rem 1rem;
  color: #fbbf24;
  background: rgba(245, 158, 11, 0.1);
}

.mission-feedback-receipt {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
  padding: 0.85rem 1rem;
  border-color: rgba(96, 165, 250, 0.24);
  background: rgba(15, 23, 42, 0.72);
}

.mission-feedback-receipt.success {
  border-color: rgba(34, 197, 94, 0.28);
  background: rgba(20, 83, 45, 0.22);
}

.mission-feedback-receipt.info {
  border-color: rgba(96, 165, 250, 0.28);
  background: rgba(30, 64, 175, 0.18);
}

.mission-feedback-receipt.warning {
  border-color: rgba(251, 191, 36, 0.3);
  background: rgba(120, 53, 15, 0.2);
}

.mission-feedback-receipt.failed {
  border-color: rgba(248, 113, 113, 0.32);
  background: rgba(127, 29, 29, 0.2);
}

.feedback-receipt-main {
  min-width: 0;
}

.feedback-receipt-kicker {
  display: block;
  margin-bottom: 0.25rem;
  color: #93c5fd;
  font-size: 0.72rem;
  font-weight: 850;
}

.mission-feedback-receipt.success .feedback-receipt-kicker {
  color: #86efac;
}

.mission-feedback-receipt.warning .feedback-receipt-kicker {
  color: #fbbf24;
}

.mission-feedback-receipt.failed .feedback-receipt-kicker {
  color: #fca5a5;
}

.feedback-receipt-main strong {
  display: block;
  color: #ffffff;
  font-size: 0.92rem;
  line-height: 1.4;
}

.feedback-receipt-main p {
  margin: 0.25rem 0 0;
  color: #cbd5e1;
  font-size: 0.78rem;
  line-height: 1.45;
}

.feedback-receipt-main p + p {
  color: #94a3b8;
}

.feedback-receipt-close {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 0.45rem;
  background: rgba(15, 23, 42, 0.4);
  color: #94a3b8;
  cursor: pointer;
  font-size: 1rem;
  line-height: 1;
}

.feedback-receipt-close:hover {
  border-color: rgba(96, 165, 250, 0.35);
  color: #ffffff;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0 0 1rem;
  color: #ffffff;
  font-size: 1.1rem;
  font-weight: 650;
}

.section-title.compact {
  margin-bottom: 0.35rem;
}

.section-count {
  padding: 0.15rem 0.55rem;
  border-radius: 999px;
  background: rgba(59, 130, 246, 0.2);
  color: #60a5fa;
  font-size: 0.75rem;
  font-weight: 800;
}

.empty-panel {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  flex-wrap: wrap;
  padding: 1.25rem;
  color: #94a3b8;
  line-height: 1.6;
}

.empty-panel.error {
  border-color: rgba(245, 158, 11, 0.24);
  background: rgba(120, 53, 15, 0.2);
  color: #fcd34d;
}

.empty-retry {
  border: 1px solid rgba(251, 191, 36, 0.45);
  border-radius: 0.6rem;
  background: rgba(251, 191, 36, 0.12);
  color: #fde68a;
  cursor: pointer;
  font-weight: 750;
  padding: 0.45rem 0.85rem;
}

.empty-retry:hover {
  background: rgba(251, 191, 36, 0.18);
}

.mission-cards {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 2rem;
}

.catch-up-panel {
  margin-bottom: 2rem;
}

.catch-up-card {
  padding: 1rem;
}

.catch-up-receipt {
  display: grid;
  gap: 0.25rem;
  margin-bottom: 0.85rem;
  padding: 0.75rem 0.85rem;
  border: 1px solid rgba(34, 197, 94, 0.22);
  border-radius: 0.55rem;
  background: rgba(20, 83, 45, 0.16);
}

.catch-up-receipt span,
.catch-up-column-title {
  color: #86efac;
  font-size: 0.75rem;
  font-weight: 850;
}

.catch-up-receipt p {
  margin: 0;
  color: #cbd5e1;
  font-size: 0.82rem;
  line-height: 1.55;
}

.catch-up-columns {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.85rem;
}

.catch-up-column {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 0.55rem;
}

.catch-up-column-title {
  color: #93c5fd;
}

.catch-up-column-note {
  color: #cbd5e1;
  font-size: 0.76rem;
  line-height: 1.45;
}

.catch-up-item {
  display: grid;
  gap: 0.25rem;
  width: 100%;
  padding: 0.75rem 0.85rem;
  border: 1px solid rgba(148, 163, 184, 0.14);
  border-radius: 0.55rem;
  background: rgba(15, 23, 42, 0.42);
  color: #cbd5e1;
  cursor: pointer;
  text-align: left;
}

.catch-up-item:hover {
  border-color: rgba(96, 165, 250, 0.32);
  background: rgba(30, 64, 175, 0.16);
}

.catch-up-item.waiting {
  border-color: rgba(251, 191, 36, 0.18);
}

.catch-up-item-meta {
  color: #94a3b8;
  font-size: 0.72rem;
  font-weight: 750;
}

.catch-up-item strong {
  color: #ffffff;
  font-size: 0.88rem;
  line-height: 1.35;
}

.catch-up-item span:last-child {
  color: #94a3b8;
  font-size: 0.78rem;
  line-height: 1.45;
}

.catch-up-empty {
  padding: 0.75rem 0.85rem;
  border: 1px dashed rgba(148, 163, 184, 0.18);
  border-radius: 0.55rem;
  color: #94a3b8;
  font-size: 0.8rem;
  line-height: 1.5;
}

.catch-up-empty.error {
  border-color: rgba(248, 113, 113, 0.24);
  color: #fecaca;
  background: rgba(127, 29, 29, 0.12);
}

.mission-card {
  overflow: hidden;
  transition: border-color 0.25s ease, background 0.25s ease;
}

.mission-card:hover {
  border-color: rgba(59, 130, 246, 0.3);
  background: rgba(15, 23, 42, 0.78);
}

.mission-card.pending {
  border-color: rgba(96, 165, 250, 0.34);
  background: rgba(15, 23, 42, 0.78);
}

.mission-card[data-priority='critical'] {
  border-left: 3px solid #f43f5e;
}

.mission-card[data-priority='high'] {
  border-left: 3px solid #f59e0b;
}

.mission-card[data-priority='medium'] {
  border-left: 3px solid #60a5fa;
}

.mission-card[data-priority='low'] {
  border-left: 3px solid #64748b;
}

.mission-head {
  width: 100%;
  padding: 1rem 1.25rem;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  text-align: left;
}

.mission-head:hover {
  background: rgba(59, 130, 246, 0.04);
}

.mission-row-1 {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin-bottom: 0.45rem;
}

.priority-badge,
.state-badge {
  display: inline-flex;
  align-items: center;
  min-height: 20px;
  padding: 0 0.55rem;
  border-radius: 999px;
  font-size: 0.68rem;
  font-weight: 850;
  letter-spacing: 0.02em;
  white-space: nowrap;
}

.priority-badge {
  text-transform: uppercase;
}

.priority-badge.critical {
  color: #f43f5e;
  background: rgba(244, 63, 94, 0.15);
}

.priority-badge.high {
  color: #f59e0b;
  background: rgba(245, 158, 11, 0.15);
}

.priority-badge.medium,
.state-badge.prepare {
  color: #60a5fa;
  background: rgba(59, 130, 246, 0.2);
}

.priority-badge.low {
  color: #94a3b8;
  background: rgba(148, 163, 184, 0.12);
}

.state-badge.now {
  color: #22c55e;
  background: rgba(34, 197, 94, 0.2);
}

.state-badge.waiting {
  color: #f59e0b;
  background: rgba(245, 158, 11, 0.15);
}

.mission-time {
  margin-left: auto;
  color: #64748b;
  font-size: 0.75rem;
  font-weight: 750;
  white-space: nowrap;
}

.chevron {
  color: #64748b;
  font-size: 0.7rem;
  transition: transform 0.25s ease;
}

.mission-card.expanded .chevron {
  transform: rotate(90deg);
}

.mission-title {
  margin-bottom: 0.35rem;
  color: #ffffff;
  font-size: 1.05rem;
  font-weight: 650;
  line-height: 1.35;
}

.mission-next,
.mission-why {
  display: grid;
  grid-template-columns: 4.5rem minmax(0, 1fr);
  gap: 0.55rem;
  align-items: baseline;
  margin-top: 0.35rem;
  color: #cbd5e1;
  font-size: 0.85rem;
  line-height: 1.5;
}

.mission-next span,
.mission-why span {
  color: #60a5fa;
  font-size: 0.72rem;
  font-weight: 850;
  white-space: nowrap;
}

.mission-next strong,
.mission-why strong {
  min-width: 0;
  color: inherit;
  font-weight: 650;
}

.mission-next strong {
  color: #ffffff;
}

.mission-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-top: 0.6rem;
}

.tag {
  padding: 0.2rem 0.5rem;
  border-radius: 0.3rem;
  font-size: 0.7rem;
  font-weight: 700;
  white-space: nowrap;
}

.tag.person {
  background: rgba(147, 51, 234, 0.2);
  color: #a78bfa;
}

.tag.source {
  background: rgba(148, 163, 184, 0.12);
  color: #94a3b8;
}

.tag.project {
  background: rgba(59, 130, 246, 0.2);
  color: #60a5fa;
}

.mission-body {
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.35s ease;
}

.mission-card.expanded .mission-body {
  max-height: 1500px;
}

.mission-body-inner {
  padding: 0 1.25rem 1.25rem;
  border-top: 1px solid rgba(148, 163, 184, 0.1);
}

.sub-section {
  margin-top: 1rem;
}

.sub-title {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  margin-bottom: 0.5rem;
  color: #60a5fa;
  font-size: 0.8rem;
  font-weight: 800;
}

.evidence-list,
.action-steps,
.question-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.rehearsal-receipt,
.card-ranking-receipt {
  display: grid;
  gap: 0.5rem;
  padding: 0.75rem 0.85rem;
  border: 1px solid rgba(96, 165, 250, 0.22);
  border-radius: 0.5rem;
  background: rgba(15, 23, 42, 0.52);
}

.rehearsal-receipt.warning,
.card-ranking-receipt.warn {
  border-color: rgba(245, 158, 11, 0.32);
  background: rgba(69, 43, 7, 0.22);
}

.card-ranking-receipt.quiet {
  border-color: rgba(148, 163, 184, 0.18);
  background: rgba(15, 23, 42, 0.36);
}

.receipt-row {
  display: grid;
  grid-template-columns: 3.25rem minmax(0, 1fr);
  gap: 0.65rem;
  align-items: start;
}

.receipt-row span {
  color: #93c5fd;
  font-size: 0.72rem;
  font-weight: 800;
}

.rehearsal-receipt.warning .receipt-row span,
.card-ranking-receipt.warn .receipt-row span {
  color: #fbbf24;
}

.card-ranking-receipt.quiet .receipt-row span {
  color: #94a3b8;
}

.receipt-row strong {
  color: #e5e7eb;
  font-size: 0.82rem;
  line-height: 1.45;
}

.rehearsal-receipt p,
.card-ranking-receipt p {
  margin: 0;
  color: #94a3b8;
  font-size: 0.78rem;
  line-height: 1.45;
}

.evidence-item {
  padding: 0.65rem 0.85rem;
  border: 1px solid rgba(148, 163, 184, 0.1);
  border-radius: 0.5rem;
  background: rgba(30, 41, 59, 0.4);
}

.evidence-source {
  margin-bottom: 0.2rem;
  color: #94a3b8;
  font-size: 0.72rem;
  font-weight: 800;
}

.evidence-text {
  color: #cbd5e1;
  font-size: 0.82rem;
  line-height: 1.45;
}

.action-step {
  display: flex;
  align-items: flex-start;
  gap: 0.65rem;
}

.step-num {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  margin-top: 1px;
  border-radius: 6px;
  background: rgba(59, 130, 246, 0.2);
  color: #60a5fa;
  font-size: 0.7rem;
  font-weight: 900;
}

.step-content strong {
  display: block;
  color: #ffffff;
  font-size: 0.85rem;
  line-height: 1.35;
}

.step-content span {
  display: block;
  margin-top: 0.15rem;
  color: #94a3b8;
  font-size: 0.78rem;
  line-height: 1.45;
}

.question-item {
  position: relative;
  padding-left: 1rem;
  color: #cbd5e1;
  font-size: 0.82rem;
}

.question-item::before {
  content: '?';
  position: absolute;
  left: 0;
  color: #f59e0b;
  font-weight: 900;
}

.context-toggle,
.card-action,
.tl-link,
.topic-all-btn {
  border-radius: 0.5rem;
  cursor: pointer;
  font-family: inherit;
  font-weight: 700;
}

.context-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
}

.context-preflight-receipt {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 0.55rem;
  align-items: start;
  margin-bottom: 0.6rem;
  padding: 0.65rem 0.75rem;
  border: 1px solid rgba(96, 165, 250, 0.18);
  border-radius: 0.5rem;
  background: rgba(30, 41, 59, 0.42);
}

.context-preflight-receipt span {
  color: #60a5fa;
  font-size: 0.74rem;
  font-weight: 900;
  line-height: 1.45;
  white-space: nowrap;
}

.context-preflight-receipt p {
  margin: 0;
  color: #cbd5e1;
  font-size: 0.76rem;
  line-height: 1.45;
}

.provider-segment {
  display: inline-flex;
  overflow: hidden;
  border: 1px solid rgba(148, 163, 184, 0.12);
  border-radius: 0.5rem;
  background: rgba(15, 23, 42, 0.45);
}

.provider-btn {
  min-height: 2rem;
  padding: 0.35rem 0.55rem;
  border: 0;
  border-right: 1px solid rgba(148, 163, 184, 0.1);
  background: transparent;
  color: #94a3b8;
  cursor: pointer;
  font-size: 0.74rem;
  font-weight: 750;
}

.provider-btn:last-child {
  border-right: 0;
}

.provider-btn.active {
  background: rgba(59, 130, 246, 0.22);
  color: #60a5fa;
}

.sensitive-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  min-height: 2rem;
  padding: 0 0.55rem;
  border: 1px solid rgba(148, 163, 184, 0.12);
  border-radius: 0.5rem;
  color: #94a3b8;
  cursor: pointer;
  font-size: 0.74rem;
  font-weight: 750;
}

.sensitive-toggle input {
  width: 13px;
  height: 13px;
  accent-color: #60a5fa;
}

.context-toggle {
  display: inline-flex;
  align-items: center;
  min-height: 2rem;
  padding: 0.4rem 0.75rem;
  border: 1px solid rgba(148, 163, 184, 0.12);
  background: rgba(30, 41, 59, 0.6);
  color: #94a3b8;
  font-size: 0.78rem;
}

.context-toggle:hover {
  border-color: rgba(59, 130, 246, 0.3);
  color: #60a5fa;
}

.execution-channel {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.8rem 0.9rem;
  border: 1px solid rgba(96, 165, 250, 0.2);
  border-radius: 0.5rem;
  background: rgba(30, 41, 59, 0.42);
}

.execution-channel-kicker {
  color: #60a5fa;
  font-size: 0.76rem;
  font-weight: 900;
}

.execution-channel p {
  max-width: 760px;
  margin: 0.25rem 0 0;
  color: #cbd5e1;
  font-size: 0.8rem;
  line-height: 1.5;
}

.execution-link {
  min-height: 2rem;
  padding: 0.4rem 0.75rem;
  border: 1px solid rgba(59, 130, 246, 0.35);
  border-radius: 0.5rem;
  background: rgba(59, 130, 246, 0.18);
  color: #60a5fa;
  cursor: pointer;
  font-family: inherit;
  font-size: 0.78rem;
  font-weight: 800;
}

.context-pack {
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.3s ease;
}

.context-pack.open {
  max-height: 460px;
}

.context-pack pre {
  max-height: 300px;
  margin-top: 0.5rem;
  overflow: auto;
  padding: 0.85rem;
  border-radius: 0.5rem;
  background: #111827;
  color: #e5e7eb;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.72rem;
  line-height: 1.55;
  white-space: pre-wrap;
}

.context-status,
.source-coverage-note,
.redaction-note,
.redaction-list {
  margin-top: 0.5rem;
  padding: 0.55rem 0.7rem;
  border-radius: 0.5rem;
  font-size: 0.74rem;
  line-height: 1.45;
}

.context-status {
  color: #60a5fa;
  background: rgba(59, 130, 246, 0.1);
}

.source-coverage-note {
  color: #a7f3d0;
  background: rgba(16, 185, 129, 0.1);
  border: 1px solid rgba(16, 185, 129, 0.14);
}

.redaction-note {
  color: #fbbf24;
  background: rgba(245, 158, 11, 0.1);
}

.redaction-list {
  display: grid;
  gap: 0.25rem;
  color: #cbd5e1;
  background: rgba(30, 41, 59, 0.55);
}

.mission-pending-note {
  margin-top: 1rem;
  padding: 0.65rem 0.8rem;
  border: 1px solid rgba(96, 165, 250, 0.22);
  border-radius: 0.5rem;
  background: rgba(59, 130, 246, 0.12);
  color: #bfdbfe;
  font-size: 0.78rem;
  line-height: 1.45;
}

.card-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 1rem;
}

.card-action {
  padding: 0.45rem 0.85rem;
  border: 1px solid transparent;
  font-size: 0.78rem;
  transition: all 0.2s ease;
}

.card-action.primary {
  border-color: rgba(52, 211, 153, 0.35);
  background: rgba(34, 197, 94, 0.2);
  color: #22c55e;
}

.card-action.secondary {
  border-color: rgba(59, 130, 246, 0.3);
  background: rgba(59, 130, 246, 0.2);
  color: #60a5fa;
}

.card-action.ghost {
  border-color: rgba(148, 163, 184, 0.12);
  background: transparent;
  color: #94a3b8;
}

.card-action:hover {
  filter: brightness(1.15);
}

.card-action:disabled {
  cursor: not-allowed;
  filter: none;
  opacity: 0.52;
}

.attention-bar {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 0.75rem;
  margin-bottom: 2rem;
}

.attention-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  color: inherit;
  cursor: pointer;
  text-align: left;
  transition: border-color 0.25s ease, transform 0.25s ease;
}

.attention-item:hover {
  border-color: rgba(59, 130, 246, 0.3);
  transform: translateY(-1px);
}

.attention-icon {
  flex: 0 0 auto;
  font-size: 1.35rem;
}

.attention-info {
  display: grid;
  min-width: 0;
}

.attention-count {
  color: #60a5fa;
  font-size: 1.25rem;
  font-weight: 800;
  line-height: 1;
}

.attention-label {
  overflow: hidden;
  margin-top: 0.2rem;
  color: #94a3b8;
  font-size: 0.75rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.attention-arrow {
  margin-left: auto;
  color: #64748b;
}

.topic-entry {
  display: grid;
  grid-template-columns: minmax(220px, 1fr) minmax(220px, 1.2fr) auto;
  gap: 1rem;
  align-items: center;
  margin-bottom: 2rem;
  padding: 1rem;
}

.topic-entry p {
  color: #94a3b8;
  font-size: 0.82rem;
  line-height: 1.5;
}

.topic-preview-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.topic-preview {
  display: grid;
  min-width: 150px;
  padding: 0.65rem 0.8rem;
  border: 1px solid rgba(148, 163, 184, 0.12);
  border-radius: 0.5rem;
  background: rgba(30, 41, 59, 0.45);
  color: inherit;
  cursor: pointer;
  text-align: left;
}

.topic-preview strong {
  overflow: hidden;
  color: #ffffff;
  font-size: 0.82rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.topic-preview span {
  margin-top: 0.2rem;
  color: #f59e0b;
  font-size: 0.74rem;
  font-weight: 750;
}

.topic-all-btn {
  min-height: 2.25rem;
  padding: 0.45rem 0.85rem;
  border: 1px solid rgba(59, 130, 246, 0.3);
  background: rgba(59, 130, 246, 0.18);
  color: #60a5fa;
}

.timeline {
  margin-bottom: 2rem;
}

.timeline-list {
  position: relative;
  display: flex;
  flex-direction: column;
  padding-left: 1.5rem;
}

.timeline-list::before {
  content: '';
  position: absolute;
  top: 8px;
  bottom: 8px;
  left: 5px;
  width: 2px;
  border-radius: 999px;
  background: linear-gradient(to bottom, #60a5fa, rgba(96, 165, 250, 0.15));
}

.tl-item {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 0.85rem;
  padding: 0.6rem 0;
}

.tl-dot {
  position: absolute;
  top: 0.75rem;
  left: -1.5rem;
  z-index: 1;
  width: 12px;
  height: 12px;
  border: 2px solid #60a5fa;
  border-radius: 50%;
  background: #0f172a;
}

.tl-dot.active {
  background: #60a5fa;
  box-shadow: 0 0 8px rgba(96, 165, 250, 0.5);
}

.tl-dot.muted {
  border-color: #64748b;
}

.tl-time {
  flex: 0 0 64px;
  min-width: 64px;
  color: #64748b;
  font-size: 0.75rem;
  font-weight: 850;
}

.tl-content {
  min-width: 0;
}

.tl-title {
  color: #ffffff;
  font-size: 0.85rem;
  font-weight: 650;
  line-height: 1.35;
}

.tl-desc {
  margin-top: 0.1rem;
  color: #94a3b8;
  font-size: 0.78rem;
}

.tl-link {
  display: inline-block;
  margin-top: 0.15rem;
  padding: 0;
  border: 0;
  background: transparent;
  color: #60a5fa;
  font-size: 0.72rem;
}

.footer-note {
  padding: 1.5rem 0 0.5rem;
  border-top: 1px solid rgba(148, 163, 184, 0.1);
  color: #64748b;
  font-size: 0.75rem;
  text-align: center;
}

.day-toast {
  position: fixed;
  bottom: 24px;
  left: 50%;
  z-index: 100;
  transform: translateX(-50%) translateY(16px);
  padding: 0.6rem 1rem;
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 0.5rem;
  background: #1e293b;
  color: #e2e8f0;
  font-size: 0.82rem;
  opacity: 0;
  pointer-events: none;
  transition: all 0.2s ease;
}

.day-toast.show {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 720px) {
  .day-pilot-home {
    padding: 1rem;
  }

  .brief-top {
    flex-direction: column;
  }

  .brief-meta {
    justify-content: flex-start;
  }

  .topic-entry {
    grid-template-columns: 1fr;
  }

  .catch-up-columns {
    grid-template-columns: 1fr;
  }
}
</style>
