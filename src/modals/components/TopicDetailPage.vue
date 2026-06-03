<template>
  <div class="topic-detail">
    <div class="detail-header">
      <button class="back-btn" @click="goBack">
        <span>←</span>
        <span>返回主题列表</span>
      </button>
      <div v-if="topicData" class="topic-header">
        <div class="topic-avatar">💡</div>
        <div class="topic-info">
          <h2>{{ topicData.name }}</h2>
          <div class="topic-meta">
            <span class="meta-item"
              >📈 {{ topicData.statistic?.conversations || 0 }} 条讨论</span
            >
            <span class="meta-item"
              >🔗 {{ topicData.statistic?.projects || 0 }} 个关联项目</span
            >
            <span class="meta-item"
              >👥 {{ topicData.statistic?.participants || 0 }} 位参与者</span
            >
            <span class="meta-item"
              >📚 {{ topicData.statistic?.resources || 0 }} 个资源</span
            >
            <span v-if="topicUnreadCount > 0" class="meta-item unread-meta"
              >● {{ topicUnreadCount }} 条未读</span
            >
            <span v-if="currentTopicMutedState" class="meta-item muted-meta">
              🔕 已静音：{{
                formatMutedReason(currentTopicMutedState.reason)
              }}{{ formatMutedUntil(currentTopicMutedState.until) }}
            </span>
            <span class="meta-item"
              >⏰ 最后更新：{{ getTopicLastUpdatedLabel(topicData) }}</span
            >
          </div>
          <div v-if="topicUnreadCount > 0" class="topic-detail-actions">
            <button
              v-if="currentTopicMutedState"
              type="button"
              class="topic-detail-action-btn topic-detail-mute-restore"
              @click.stop="handleRestoreMuteFromDetail"
            >
              ↩ 取消静音
            </button>
            <div v-else class="topic-detail-defer-menu" @click.stop>
              <button
                type="button"
                class="topic-detail-action-btn"
                :aria-expanded="detailDeferMenuOpen"
                @click.stop="toggleDetailDeferMenu"
              >
                ⏰ 稍后处理
              </button>
              <div
                v-if="detailDeferMenuOpen"
                class="topic-detail-defer-options"
                role="menu"
              >
                <button
                  v-for="option in detailDeferOptions"
                  :key="option.key"
                  type="button"
                  class="topic-detail-defer-option"
                  role="menuitem"
                  @click.stop="handleDeferTopicFromDetail(option.until)"
                >
                  <span>{{ option.label }}</span>
                  <small>{{ formatDeferredUntil(option.until) }}</small>
                </button>
              </div>
            </div>
            <div
              v-if="!currentTopicMutedState"
              class="topic-detail-defer-menu topic-detail-mute-menu"
              @click.stop
            >
              <button
                type="button"
                class="topic-detail-action-btn mute"
                :aria-expanded="detailMuteMenuOpen"
                @click.stop="toggleDetailMuteMenu"
              >
                🔕 静音
              </button>
              <div
                v-if="detailMuteMenuOpen"
                class="topic-detail-defer-options topic-detail-mute-options"
                role="menu"
              >
                <div class="topic-detail-mute-reasons" role="none">
                  <div class="topic-detail-menu-label">静音原因</div>
                  <div class="topic-detail-mute-reason-grid" role="group">
                    <button
                      v-for="reason in detailMuteReasons"
                      :key="reason.key"
                      type="button"
                      :class="[
                        'topic-detail-mute-reason-option',
                        { active: detailSelectedMuteReason === reason.key },
                      ]"
                      :aria-pressed="detailSelectedMuteReason === reason.key"
                      @click.stop="detailSelectedMuteReason = reason.key"
                    >
                      <span>{{ reason.label }}</span>
                      <small>{{ reason.description }}</small>
                    </button>
                  </div>
                </div>
                <button
                  v-for="option in detailMuteOptions"
                  :key="option.key"
                  type="button"
                  class="topic-detail-defer-option topic-detail-mute-option"
                  role="menuitem"
                  @click.stop="
                    handleMuteTopicFromDetail(
                      option.until,
                      detailSelectedMuteReason,
                    )
                  "
                >
                  <span>{{ option.label }}</span>
                  <small>{{ formatMutedUntil(option.until) }}</small>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="topicReadUndo" class="topic-undo-toast" role="status">
      <span>已将「{{ topicReadUndo.topicName }}」标记为已读</span>
      <button type="button" @click="handleUndoTopicRead">撤销</button>
    </div>

    <div
      v-if="detailDeferredUndo"
      class="topic-undo-toast topic-defer-undo-toast"
      role="status"
    >
      <span>
        已将「{{ detailDeferredUndo.topicName }}」稍后到
        {{ formatDeferredUntil(detailDeferredUndo.until) }}
      </span>
      <button type="button" @click="handleUndoDetailDefer">恢复</button>
    </div>

    <div
      v-if="detailMuteUndo"
      class="topic-undo-toast topic-mute-undo-toast"
      role="status"
    >
      <span>
        已将「{{ detailMuteUndo.topicName }}」静音：{{
          formatMutedReason(detailMuteUndo.reason)
        }}{{ formatMutedUntil(detailMuteUndo.until) }}
      </span>
      <button type="button" @click="handleUndoDetailMute">取消静音</button>
    </div>

    <div
      v-if="conversationReadUndo"
      class="topic-undo-toast conversation-undo-toast"
      role="status"
    >
      <span>
        已将「{{
          formatConversationUndoLabel(conversationReadUndo)
        }}」标记为已读
      </span>
      <button type="button" @click="handleUndoConversationRead">撤销</button>
    </div>

    <div v-if="isLoading" class="loading-container">
      <div class="loading-spinner"></div>
      <span>加载主题详情...</span>
    </div>

    <div v-else-if="topicData" class="topic-detail-content">
      <div class="tab-navigation">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          :class="['tab-btn', { active: activeTab === tab.key }]"
          @click="activeTab = tab.key"
        >
          {{ tab.label }}
        </button>
      </div>

      <!-- 相关项目标签页 -->
      <div v-if="activeTab === 'projects'" class="tab-content active">
        <div class="section-header">
          <h3>📂 相关项目</h3>
        </div>
        <div class="items-grid">
          <div
            v-for="project in topicProjects"
            :key="project.id"
            class="item-card"
          >
            <div class="item-header">
              <div class="item-title">
                <span>🚀</span>
                <span>{{ project.name }}</span>
              </div>
            </div>
            <div class="item-content">
              <div style="margin-bottom: 0.5rem">
                <span class="card-badge">{{ project.status }}</span>
              </div>
              <p>{{ project.description }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- 相关资源标签页 -->
      <div v-if="activeTab === 'resources'" class="tab-content active">
        <div class="section-header">
          <h3>📚 相关资源</h3>
        </div>
        <div class="items-grid">
          <div
            v-for="resource in topicResources"
            :key="resource.id"
            class="item-card"
          >
            <div class="item-header">
              <div class="item-title">
                <span>📚</span>
                <span>{{ resource.name }}</span>
              </div>
            </div>
            <div class="item-content">
              <div style="margin-bottom: 0.5rem">
                <span class="card-badge">{{ resource.type }}</span>
              </div>
              <p v-if="getSafeExternalUrl(resource.url)">
                <a
                  :href="getSafeExternalUrl(resource.url)"
                  class="item-link"
                  target="_blank"
                  rel="noopener noreferrer"
                  @click.stop
                  >查看资源</a
                >
              </p>
              <p v-else class="item-muted">暂无可打开链接</p>
            </div>
          </div>
        </div>
      </div>

      <!-- 相关Tickets标签页 -->
      <div v-if="activeTab === 'tickets'" class="tab-content active">
        <div class="section-header">
          <h3>🎯 相关Tickets</h3>
        </div>
        <div class="items-grid">
          <div
            v-for="ticket in topicTickets"
            :key="ticket.id"
            class="item-card"
          >
            <div class="item-header">
              <div class="item-title">
                <span>🎯</span>
                <span>{{ ticket.id }}</span>
              </div>
            </div>
            <div class="item-content">
              <h4 style="margin-bottom: 0.5rem; font-weight: 600">
                {{ ticket.title }}
              </h4>
              <div style="display: flex; gap: 0.5rem; margin-bottom: 0.5rem">
                <span class="card-badge">{{ ticket.status }}</span>
                <span
                  class="card-badge"
                  :style="getPriorityStyle(ticket.priority)"
                  >{{ ticket.priority }}</span
                >
              </div>
              <p style="font-size: 0.875rem; color: #94a3b8">
                负责人：{{ ticket.assignee }}
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- 聊天记录标签页 -->
      <div v-if="activeTab === 'conversations'" class="tab-content active">
        <div class="section-header">
          <div class="conversation-section-title">
            <h3>💬 聊天记录</h3>
            <div class="conversation-read-summary" aria-live="polite">
              <span class="read-summary-pill unread"
                >未读 {{ conversationUnreadCount }}</span
              >
              <span class="read-summary-pill"
                >全部 {{ conversationTotalCount }}</span
              >
            </div>
          </div>
          <div class="search-controls">
            <input
              type="text"
              class="search-input"
              placeholder="搜索聊天记录、上下文或来源..."
              v-model="convSearchQuery"
            />
            <select
              class="filter-select read-filter-select"
              v-model="convReadFilter"
              aria-label="按阅读状态筛选聊天记录"
            >
              <option value="all">全部状态</option>
              <option value="unread">仅未读</option>
              <option value="read">已读</option>
            </select>
            <select class="filter-select" v-model="convFilter">
              <option value="all">全部群组</option>
              <option value="team">团队群</option>
              <option value="project">项目群</option>
              <option value="tech">技术讨论</option>
            </select>
            <button
              type="button"
              class="mark-all-read-btn"
              @click="handleMarkAllAsRead"
              title="标记所有消息为已读"
              :disabled="topicUnreadCount === 0"
            >
              ✓ 全部已阅
            </button>
          </div>
        </div>
        <div
          v-if="messageFocusNotice"
          :class="['message-focus-notice', messageFocusNotice.type]"
          role="status"
        >
          {{ messageFocusNotice.text }}
        </div>
        <div v-if="filteredConversations.length === 0" class="empty-state">
          {{ conversationEmptyText }}
        </div>
        <div v-else class="conversations-list">
          <div
            v-for="(conv, index) in filteredConversations"
            :key="getConversationRenderId(conv, index)"
            class="conversation-item"
            :class="{
              expanded: isConversationExpanded(conv, index),
              unread: isConversationUnread(conv),
              targeted:
                highlightedConversationId ===
                getConversationRenderId(conv, index),
            }"
            :data-conversation-id="getConversationRenderId(conv, index)"
          >
            <div class="conversation-header">
              <div class="conversation-meta">
                <div class="sender-avatar">
                  {{ (conv.sender || '?').charAt(0) }}
                </div>
                <div class="sender-info">
                  <div class="sender-name">
                    {{ conv.sender || '未知用户' }}
                    <span
                      v-if="isConversationUnread(conv)"
                      class="unread-indicator"
                      >●</span
                    >
                  </div>
                  <div class="group-name">
                    {{ conv.groupName || '未知群组' }}
                    <span
                      v-if="doesConversationContextMatch(conv)"
                      class="context-match-badge"
                    >
                      上下文匹配
                    </span>
                  </div>
                </div>
              </div>
              <div class="conversation-side-actions">
                <a
                  v-if="getConversationSourceUrl(conv)"
                  class="conversation-source-link"
                  :href="getConversationSourceUrl(conv)"
                  target="_blank"
                  rel="noopener noreferrer"
                  :title="getConversationSourceTitle(conv)"
                  :aria-label="getConversationSourceTitle(conv)"
                  @click.stop
                >
                  {{ getConversationSourceLabel(conv) }}
                </a>
                <span
                  v-else-if="hasHiddenConversationSourceCandidates(conv)"
                  class="conversation-source-hidden"
                  :title="getConversationHiddenSourceTitle(conv)"
                  :aria-label="getConversationHiddenSourceTitle(conv)"
                >
                  {{ getConversationHiddenSourceLabel(conv) }}
                </span>
                <div class="conversation-time">
                  {{ formatTimeAgo(conv.datetime) || '未知时间' }}
                </div>
              </div>
            </div>
            <div
              class="conversation-summary"
              v-html="
                highlightText(conv.summary || '暂无摘要', convSearchQuery)
              "
            ></div>
            <button
              type="button"
              class="context-indicator"
              :class="{ expanded: isConversationExpanded(conv, index) }"
              @click="toggleConversationExpand(conv, index)"
            >
              <span class="indicator-text">
                {{
                  isConversationExpanded(conv, index)
                    ? '🔼 收起上下文'
                    : getConversationContextLabel(conv)
                }}
              </span>
            </button>
            <div
              v-if="conv.contextMessages"
              class="context-content"
              :class="{ expanded: isConversationExpanded(conv, index) }"
            >
              <div class="context-divider"></div>
              <div
                v-for="(contextMsg, index) in conv.contextMessages"
                :key="index"
                class="context-item"
                :class="{
                  'main-message': contextMsg.isMainMessage,
                  unread: isContextMessageUnread(contextMsg),
                  targeted: isTargetedContextMessage(contextMsg),
                }"
                :data-topic-message-ids="
                  getTopicMessageIdentityAttr(contextMsg)
                "
              >
                <div class="context-header">
                  <div class="context-sender">
                    {{ contextMsg.sender || '未知用户' }}
                    <span
                      v-if="isContextMessageUnread(contextMsg)"
                      class="unread-indicator"
                      >●</span
                    >
                    <span
                      v-if="isTargetedContextMessage(contextMsg)"
                      class="targeted-message-badge"
                    >
                      链接定位
                    </span>
                  </div>
                  <div class="context-time">
                    {{ formatTimeAgo(contextMsg.datetime) || '未知时间' }}
                  </div>
                </div>
                <div
                  class="context-content-text"
                  v-html="
                    highlightText(
                      contextMsg.content || '内容为空',
                      convSearchQuery,
                    )
                  "
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 网页记录标签页 -->
      <div v-if="activeTab === 'webpages'" class="tab-content active">
        <div class="section-header">
          <h3>🌐 网页记录</h3>
          <div class="search-controls">
            <input
              type="text"
              class="search-input"
              placeholder="搜索网页记录..."
              v-model="webSearchQuery"
            />
            <select class="filter-select" v-model="webTypeFilter">
              <option value="all">全部类型</option>
              <option value="jira">Jira</option>
              <option value="confluence">Confluence</option>
              <option value="github">GitHub</option>
              <option value="docs">文档</option>
              <option value="blog">博客</option>
            </select>
          </div>
        </div>
        <div class="webpages-list">
          <div v-if="filteredWebpages.length === 0" class="empty-state">
            暂无匹配网页记录
          </div>
          <div
            v-for="webpage in filteredWebpages"
            :key="webpage.id"
            class="webpage-item"
          >
            <div class="webpage-header">
              <div class="webpage-icon">{{ getWebpageIcon(webpage.type) }}</div>
              <div class="webpage-info">
                <div class="webpage-title">
                  {{ webpage.title || '未知标题' }}
                </div>
                <div class="webpage-url">{{ webpage.url || '#' }}</div>
                <div class="webpage-meta">
                  <span>访问时间：{{ webpage.visitTime || '未知时间' }}</span>
                  <span v-if="webpage.relevanceScore"
                    >相关性：{{
                      (webpage.relevanceScore * 100).toFixed(0)
                    }}%</span
                  >
                </div>
                <a
                  v-if="getSafeExternalUrl(webpage.url)"
                  class="webpage-open-link"
                  :href="getSafeExternalUrl(webpage.url)"
                  target="_blank"
                  rel="noopener noreferrer"
                  @click.stop
                >
                  打开来源
                </a>
              </div>
            </div>
            <div class="webpage-content">
              {{ webpage.summary || '暂无摘要' }}
            </div>
            <div v-if="webpage.tags" class="webpage-tags">
              <span
                v-for="tag in webpage.tags"
                :key="tag"
                class="webpage-tag"
                >{{ tag }}</span
              >
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onBeforeUnmount } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  getTopicDeferPresetOptions,
  getTopicMutePresetOptions,
  getTopicMuteReasonLabel,
  getTopicMuteReasonOptions,
  useMemoryStore,
  type TopicMuteReasonKey,
} from '../memory-store';
import {
  findTopicConversationByMessageId,
  getTopicConversationUnreadMessageCount,
  getTopicConversationUnreadCount,
  getTopicConversationPrimaryId,
  getTopicDetailRecentData,
  getTopicDetailUnreadCount,
  isTopicMessageExplicitlyUnread,
  isTopicConversationUnread,
  sortTopicConversationsForTriage,
  topicConversationHasContextMatch,
  topicConversationMatchesQuery,
  type TopicConversationReadFilter,
} from '../topic-detail-data';
import { renderHighlightedText } from '../topic-detail-rendering';
import {
  type ExternalUrlSafetyReason,
  getExternalUrlSafety,
  getFirstSafeExternalUrl,
  getSafeExternalUrl,
  hasBlockedExternalUrlCandidate,
} from '../topic-link-safety';
import { formatTopicRelativeTime } from '../topic-time';

const route = useRoute();
const router = useRouter();
const store = useMemoryStore();

const topicId = computed(() => route.params.id as string);
const topicData = computed(() => store.topicDetailData);
const isLoading = computed(() => store.isLoading);
const topicReadUndo = computed(() => store.topicReadUndo);
const conversationReadUndo = computed(() => store.conversationReadUndo);
const currentTopicMutedState = computed(() => {
  if (!topicId.value) return null;
  return store.getTopicMutedState(topicId.value) as {
    until: number | null;
    reason?: TopicMuteReasonKey;
  } | null;
});
const activeTab = ref('conversations');
const topicUnreadCount = computed(() =>
  getTopicDetailUnreadCount(topicData.value),
);
const topicRecentData = computed(() =>
  getTopicDetailRecentData(topicData.value),
);
const topicConversations = computed(() => topicRecentData.value.conversations);
const topicWebpages = computed(() => topicRecentData.value.webpages);
const topicProjects = computed(() => topicRecentData.value.projects);
const topicResources = computed(() => topicRecentData.value.resources);
const topicTickets = computed(() => topicRecentData.value.jiraTickets);

const convSearchQuery = ref('');
const normalizeReadFilterValue = (
  value: unknown,
): TopicConversationReadFilter => {
  const normalizedValue = Array.isArray(value) ? value[0] : value;
  const normalized = String(normalizedValue || '').trim();
  if (normalized === 'unread' || normalized === 'read') {
    return normalized;
  }
  return 'all';
};
const convReadFilter = ref<TopicConversationReadFilter>(
  normalizeReadFilterValue(route.query.readFilter),
);
const convFilter = ref('all');
const webSearchQuery = ref('');
const webTypeFilter = ref('all');
const expandedConversations = ref<Set<string>>(new Set());
const stickyUnreadConversationIds = ref<Set<string>>(new Set());
const highlightedConversationId = ref<string | null>(null);
const highlightedMessageId = ref<string | null>(null);
const messageFocusNotice = ref<{
  type: 'info' | 'warning';
  text: string;
} | null>(null);
const detailDeferMenuOpen = ref(false);
const detailDeferOptions = ref(getTopicDeferPresetOptions());
const detailDeferredUndo = ref<{
  topicId: string;
  topicName: string;
  until: number;
} | null>(null);
let detailDeferredUndoTimer: ReturnType<typeof window.setTimeout> | null = null;
const detailMuteMenuOpen = ref(false);
const detailMuteOptions = ref(getTopicMutePresetOptions());
const detailMuteReasons = ref(getTopicMuteReasonOptions());
const detailSelectedMuteReason = ref<TopicMuteReasonKey>('not-now');
const detailMuteUndo = ref<{
  topicId: string;
  topicName: string;
  until: number | null;
  reason?: TopicMuteReasonKey;
} | null>(null);
let detailMuteUndoTimer: ReturnType<typeof window.setTimeout> | null = null;

const tabs = [
  { key: 'conversations', label: '💬 聊天记录' },
  { key: 'projects', label: '🚀 相关项目' },
  { key: 'resources', label: '📚 相关资源' },
  { key: 'tickets', label: '🎯 相关Tickets' },
  { key: 'webpages', label: '🌐 网页记录' },
];

const conversationUnreadCount = computed(() =>
  getTopicConversationUnreadCount(topicConversations.value),
);
const conversationTotalCount = computed(() => topicConversations.value.length);
const conversationEmptyText = computed(() => {
  if (convReadFilter.value === 'unread') return '没有匹配的未读聊天记录';
  if (convReadFilter.value === 'read') return '没有匹配的已读聊天记录';
  return '没有匹配的聊天记录';
});

const getConversationRenderId = (conversation: any, index = 0): string => {
  return getTopicConversationPrimaryId(conversation) || `conversation-${index}`;
};

const shouldKeepConversationForReadFilter = (
  conversation: any,
  sortedIndex = 0,
): boolean => {
  if (convReadFilter.value === 'unread') {
    return (
      isTopicConversationUnread(conversation) ||
      stickyUnreadConversationIds.value.has(
        getConversationRenderId(conversation, sortedIndex),
      )
    );
  }

  if (convReadFilter.value === 'read') {
    return !isTopicConversationUnread(conversation);
  }

  return true;
};

const filteredConversations = computed(() => {
  let filtered = sortTopicConversationsForTriage(topicConversations.value);

  filtered = filtered.filter((conv, index) =>
    shouldKeepConversationForReadFilter(conv, index),
  );

  if (convSearchQuery.value.trim()) {
    filtered = filtered.filter((conv) =>
      topicConversationMatchesQuery(conv, convSearchQuery.value),
    );
  }

  if (convFilter.value !== 'all') {
    filtered = filtered.filter((conv) => {
      switch (convFilter.value) {
        case 'team':
          return (
            (conv.groupName || '').includes('团队') ||
            (conv.groupName || '').includes('Team')
          );
        case 'project':
          return (
            (conv.groupName || '').includes('项目') ||
            (conv.groupName || '').includes('Project')
          );
        case 'tech':
          return (
            (conv.groupName || '').includes('技术') ||
            (conv.groupName || '').includes('Tech') ||
            (conv.groupName || '').includes('开发')
          );
        default:
          return true;
      }
    });
  }

  return filtered;
});

const filteredWebpages = computed(() => {
  let filtered = topicWebpages.value;

  if (webSearchQuery.value.trim()) {
    const query = webSearchQuery.value.toLowerCase();
    filtered = filtered.filter(
      (webpage) =>
        (webpage.title || '').toLowerCase().includes(query) ||
        (webpage.summary || '').toLowerCase().includes(query) ||
        (webpage.url || '').toLowerCase().includes(query),
    );
  }

  if (webTypeFilter.value !== 'all') {
    filtered = filtered.filter(
      (webpage) => webpage.type === webTypeFilter.value,
    );
  }

  return filtered;
});

const goBack = () => {
  router.push('/entity/Topic');
};

const rememberStickyUnreadConversation = (conversationId: string) => {
  stickyUnreadConversationIds.value = new Set([
    ...stickyUnreadConversationIds.value,
    conversationId,
  ]);
};

const forgetStickyUnreadConversation = (conversationId: string) => {
  if (!stickyUnreadConversationIds.value.has(conversationId)) return;
  const next = new Set(stickyUnreadConversationIds.value);
  next.delete(conversationId);
  stickyUnreadConversationIds.value = next;
};

const clearStickyUnreadConversations = () => {
  if (stickyUnreadConversationIds.value.size === 0) return;
  stickyUnreadConversationIds.value = new Set();
};

const isConversationExpanded = (conversation: any, index = 0): boolean => {
  return expandedConversations.value.has(
    getConversationRenderId(conversation, index),
  );
};

const toggleConversationExpand = (conversation: any, index = 0) => {
  const conversationId = getConversationRenderId(conversation, index);
  const newExpanded = new Set(expandedConversations.value);
  if (newExpanded.has(conversationId)) {
    newExpanded.delete(conversationId);
    forgetStickyUnreadConversation(conversationId);
  } else {
    const wasUnread = isConversationUnread(conversation);
    newExpanded.clear();
    newExpanded.add(conversationId);
    const messageId = getTopicConversationPrimaryId(conversation);
    if (convReadFilter.value === 'unread' && wasUnread) {
      rememberStickyUnreadConversation(conversationId);
    }
    if (messageId && wasUnread) {
      void store.markConversationAsRead(topicId.value, messageId);
    }
  }
  expandedConversations.value = newExpanded;
};

const handleMarkAllAsRead = async () => {
  if (topicId.value) {
    await store.markTopicAsRead(topicId.value);
    clearStickyUnreadConversations();
  }
};

const handleUndoTopicRead = async () => {
  await store.undoLastTopicRead();
};

const handleUndoConversationRead = async () => {
  await store.undoLastConversationRead();
};

const formatDeferredUntil = (timestamp?: number) => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const now = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const time = date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });

  if (date.toDateString() === now.toDateString()) {
    return `今天 ${time}`;
  }
  if (date.toDateString() === tomorrow.toDateString()) {
    return `明天 ${time}`;
  }
  return date.toLocaleString(undefined, {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatMutedUntil = (timestamp?: number | null) => {
  if (timestamp === null) return '，直到手动恢复';
  if (!timestamp) return '';
  return `到 ${formatDeferredUntil(timestamp)}`;
};

const formatMutedReason = (reason?: string) => {
  return getTopicMuteReasonLabel(reason);
};

const clearDetailDeferredUndo = () => {
  detailDeferredUndo.value = null;
  if (detailDeferredUndoTimer !== null) {
    window.clearTimeout(detailDeferredUndoTimer);
    detailDeferredUndoTimer = null;
  }
};

const showDetailDeferredUndo = (
  undoState: NonNullable<typeof detailDeferredUndo.value>,
) => {
  clearDetailDeferredUndo();
  detailDeferredUndo.value = undoState;
  detailDeferredUndoTimer = window.setTimeout(clearDetailDeferredUndo, 10_000);
};

const clearDetailMuteUndo = () => {
  detailMuteUndo.value = null;
  if (detailMuteUndoTimer !== null) {
    window.clearTimeout(detailMuteUndoTimer);
    detailMuteUndoTimer = null;
  }
};

const showDetailMuteUndo = (
  undoState: NonNullable<typeof detailMuteUndo.value>,
) => {
  clearDetailMuteUndo();
  detailMuteUndo.value = undoState;
  detailMuteUndoTimer = window.setTimeout(clearDetailMuteUndo, 10_000);
};

const toggleDetailDeferMenu = () => {
  if (detailDeferMenuOpen.value) {
    detailDeferMenuOpen.value = false;
    return;
  }

  detailMuteMenuOpen.value = false;
  detailDeferOptions.value = getTopicDeferPresetOptions();
  detailDeferMenuOpen.value = true;
};

const toggleDetailMuteMenu = () => {
  if (detailMuteMenuOpen.value) {
    detailMuteMenuOpen.value = false;
    return;
  }

  detailDeferMenuOpen.value = false;
  detailMuteOptions.value = getTopicMutePresetOptions();
  detailMuteReasons.value = getTopicMuteReasonOptions();
  detailSelectedMuteReason.value = 'not-now';
  detailMuteMenuOpen.value = true;
};

const handleDeferTopicFromDetail = async (until?: number) => {
  if (!topicId.value) return;

  detailDeferMenuOpen.value = false;
  await store.deferTopicForLater(topicId.value, until);
  const deferredState = store.getTopicDeferredState(topicId.value) as {
    until: number;
  } | null;
  showDetailDeferredUndo({
    topicId: topicId.value,
    topicName: String(topicData.value?.name || topicId.value),
    until: deferredState?.until || Number(until) || Date.now(),
  });
};

const handleUndoDetailDefer = () => {
  const undoState = detailDeferredUndo.value;
  if (!undoState) return;

  store.restoreDeferredTopic(undoState.topicId);
  clearDetailDeferredUndo();
};

const handleMuteTopicFromDetail = async (
  until?: number | null,
  reason: TopicMuteReasonKey = detailSelectedMuteReason.value,
) => {
  if (!topicId.value) return;

  detailMuteMenuOpen.value = false;
  await store.muteTopic(topicId.value, until, reason);
  const mutedState = store.getTopicMutedState(topicId.value) as {
    until: number | null;
    reason?: TopicMuteReasonKey;
  } | null;
  showDetailMuteUndo({
    topicId: topicId.value,
    topicName: String(topicData.value?.name || topicId.value),
    until: mutedState?.until ?? null,
    reason: mutedState?.reason || reason,
  });
};

const handleRestoreMuteFromDetail = () => {
  if (!topicId.value) return;
  store.restoreMutedTopic(topicId.value);
  if (detailMuteUndo.value?.topicId === topicId.value) {
    clearDetailMuteUndo();
  }
};

const handleUndoDetailMute = () => {
  const undoState = detailMuteUndo.value;
  if (!undoState) return;

  store.restoreMutedTopic(undoState.topicId);
  clearDetailMuteUndo();
};

const doesConversationContextMatch = (conversation: any): boolean => {
  return topicConversationHasContextMatch(conversation, convSearchQuery.value);
};

const isConversationUnread = (conversation: any): boolean => {
  return isTopicConversationUnread(conversation);
};

const getConversationContextLabel = (conversation: any): string => {
  const contextCount = conversation?.contextMessages?.length || 0;
  const unreadCount = getTopicConversationUnreadMessageCount(conversation);
  const unreadSuffix = unreadCount > 0 ? ` · ${unreadCount} 未读` : '';
  return `🔍 查看上下文 (${contextCount} 条相关消息${unreadSuffix})`;
};

const isContextMessageUnread = (contextMessage: any): boolean => {
  return isTopicMessageExplicitlyUnread(contextMessage);
};

const formatConversationUndoLabel = (undoState: any): string => {
  const label =
    undoState?.conversationLabel || undoState?.conversationId || '这条讨论';
  const normalizedLabel = String(label).replace(/\s+/g, ' ').trim();
  return normalizedLabel.length > 36
    ? `${normalizedLabel.slice(0, 36)}...`
    : normalizedLabel;
};

const normalizeQueryValue = (value: unknown): string => {
  if (Array.isArray(value)) return String(value[0] || '').trim();
  return String(value || '').trim();
};

const getTopicMessageIds = (message: any): string[] => {
  return [
    message?.id,
    message?.messageId,
    message?.conversationId,
    message?.sourceMessageId,
  ]
    .filter((value) => value !== undefined && value !== null)
    .map((value) => String(value).trim())
    .filter(Boolean);
};

const doesTopicMessageMatchId = (message: any, messageId: string): boolean => {
  const normalizedMessageId = String(messageId || '').trim();
  if (!normalizedMessageId) return false;
  return getTopicMessageIds(message).includes(normalizedMessageId);
};

const getTopicMessageIdentityAttr = (message: any): string =>
  getTopicMessageIds(message).map(encodeURIComponent).join(' ');

const doesTopicMessageIdentityAttrMatch = (
  identityAttr: string | undefined,
  messageId: string,
): boolean => {
  const encodedMessageId = encodeURIComponent(String(messageId || '').trim());
  if (!encodedMessageId) return false;
  return String(identityAttr || '')
    .split(/\s+/)
    .includes(encodedMessageId);
};

const isTargetedContextMessage = (message: any): boolean => {
  const messageId = highlightedMessageId.value;
  if (!messageId) return false;
  return doesTopicMessageMatchId(message, messageId);
};

const focusConversationFromQuery = async (messageIdValue: unknown) => {
  const messageId = normalizeQueryValue(messageIdValue);
  if (!messageId) {
    highlightedConversationId.value = null;
    highlightedMessageId.value = null;
    messageFocusNotice.value = null;
    return;
  }
  if (!topicId.value || !topicData.value) return;

  const targetConversation = findTopicConversationByMessageId(
    topicData.value,
    messageId,
  );
  const targetConversationId =
    getTopicConversationPrimaryId(targetConversation);
  if (!targetConversationId) {
    activeTab.value = 'conversations';
    convFilter.value = 'all';
    convReadFilter.value = 'all';
    convSearchQuery.value = '';
    highlightedConversationId.value = null;
    highlightedMessageId.value = null;
    messageFocusNotice.value = {
      type: 'warning',
      text: '没有在当前主题详情中找到链接里的消息，已显示全部聊天记录。',
    };
    return;
  }

  const isConversationTarget = doesTopicMessageMatchId(
    targetConversation,
    messageId,
  );
  activeTab.value = 'conversations';
  convFilter.value = 'all';
  convReadFilter.value = 'all';

  if (
    convSearchQuery.value &&
    !filteredConversations.value.some(
      (conversation: any) =>
        getTopicConversationPrimaryId(conversation) === targetConversationId,
    )
  ) {
    convSearchQuery.value = '';
  }

  expandedConversations.value = new Set([targetConversationId]);
  highlightedConversationId.value = targetConversationId;
  highlightedMessageId.value = messageId;
  const didSyncReadState = await store.markConversationAsRead(
    topicId.value,
    messageId,
  );
  const targetLabel = isConversationTarget ? '聊天记录' : '上下文消息';
  messageFocusNotice.value = {
    type: 'info',
    text: didSyncReadState
      ? `已定位到链接里的${targetLabel}，并同步为已读。`
      : `已定位到链接里的${targetLabel}；当前没有明确未读状态需要同步。`,
  };
  await nextTick();

  const targetElement = Array.from(
    document.querySelectorAll<HTMLElement>('[data-conversation-id]'),
  ).find((element) => element.dataset.conversationId === targetConversationId);
  const targetMessageElement = Array.from(
    document.querySelectorAll<HTMLElement>('[data-topic-message-ids]'),
  ).find((element) =>
    doesTopicMessageIdentityAttrMatch(
      element.dataset.topicMessageIds,
      messageId,
    ),
  );
  (targetMessageElement || targetElement)?.scrollIntoView({
    behavior: 'smooth',
    block: 'center',
  });

  window.setTimeout(() => {
    if (highlightedConversationId.value === targetConversationId) {
      highlightedConversationId.value = null;
    }
    if (highlightedMessageId.value === messageId) {
      highlightedMessageId.value = null;
    }
    if (messageFocusNotice.value?.type === 'info') {
      messageFocusNotice.value = null;
    }
  }, 6000);
};

const highlightText = (text: string, searchQuery: string) => {
  return renderHighlightedText(text, searchQuery);
};

const getConversationSourceUrl = (conversation: any): string => {
  const contextMessages = Array.isArray(conversation?.contextMessages)
    ? conversation.contextMessages
    : [];

  return getFirstSafeExternalUrl(
    conversation?.teamUrl,
    conversation?.sourceUrl,
    conversation?.permalink,
    conversation?.url,
    ...contextMessages.flatMap((contextMessage: any) => [
      contextMessage?.teamUrl,
      contextMessage?.sourceUrl,
      contextMessage?.permalink,
      contextMessage?.url,
    ]),
  );
};

type ConversationSourceOrigin = 'conversation' | 'context';

interface ConversationSourceCandidate {
  url: unknown;
  origin: ConversationSourceOrigin;
}

const getConversationSourceCandidates = (
  conversation: any,
): ConversationSourceCandidate[] => {
  const contextMessages = Array.isArray(conversation?.contextMessages)
    ? conversation.contextMessages
    : [];

  return [
    { url: conversation?.teamUrl, origin: 'conversation' },
    { url: conversation?.sourceUrl, origin: 'conversation' },
    { url: conversation?.permalink, origin: 'conversation' },
    { url: conversation?.url, origin: 'conversation' },
    ...contextMessages.flatMap((contextMessage: any) => [
      { url: contextMessage?.teamUrl, origin: 'context' as const },
      { url: contextMessage?.sourceUrl, origin: 'context' as const },
      { url: contextMessage?.permalink, origin: 'context' as const },
      { url: contextMessage?.url, origin: 'context' as const },
    ]),
  ];
};

const getConversationSourceLink = (conversation: any) => {
  for (const candidate of getConversationSourceCandidates(conversation)) {
    const safety = getExternalUrlSafety(candidate.url);
    if (!safety.safeUrl) continue;

    const originLabel = candidate.origin === 'context' ? '上下文来源' : '来源';
    const sourceLabel =
      candidate.origin === 'context' ? '上下文来源' : '原始来源';

    return {
      url: safety.safeUrl,
      label: originLabel,
      title: safety.hostname
        ? `打开${sourceLabel}：${safety.hostname}`
        : `打开${sourceLabel}`,
    };
  }

  return null;
};

const getConversationSourceLabel = (conversation: any): string =>
  getConversationSourceLink(conversation)?.label || '来源';

const getConversationSourceTitle = (conversation: any): string =>
  getConversationSourceLink(conversation)?.title || '没有可信来源链接';

const hasHiddenConversationSourceCandidates = (conversation: any): boolean => {
  return hasBlockedExternalUrlCandidate(
    ...getConversationSourceCandidates(conversation).map(
      (candidate) => candidate.url,
    ),
  );
};

const getExternalUrlBlockedReasonLabel = (
  reason: ExternalUrlSafetyReason,
): string => {
  switch (reason) {
    case 'credentialed_url':
      return '包含账号信息';
    case 'invalid':
      return '格式无效';
    case 'unsupported_protocol':
      return '非 http/https';
    default:
      return '不符合安全规则';
  }
};

const getBlockedConversationSourceResults = (conversation: any) =>
  getConversationSourceCandidates(conversation)
    .map((candidate) => getExternalUrlSafety(candidate.url))
    .filter((safety) => safety.blocked);

const getConversationHiddenSourceLabel = (conversation: any): string => {
  const blockedResults = getBlockedConversationSourceResults(conversation);
  if (!blockedResults.length) return '来源已隐藏';

  const reasonLabels = Array.from(
    new Set(
      blockedResults.map((safety) =>
        getExternalUrlBlockedReasonLabel(safety.reason),
      ),
    ),
  );
  if (blockedResults.length === 1 && reasonLabels.length === 1) {
    return `来源已隐藏 · ${reasonLabels[0]}`;
  }

  return `来源已隐藏 · ${blockedResults.length} 个不可信链接`;
};

const getConversationHiddenSourceTitle = (conversation: any): string => {
  const blockedResults = getBlockedConversationSourceResults(conversation);
  const reasonSummary = Array.from(
    new Set(
      blockedResults.map((safety) =>
        getExternalUrlBlockedReasonLabel(safety.reason),
      ),
    ),
  ).join('、');

  return blockedResults.length > 1
    ? `已隐藏 ${blockedResults.length} 个不可信来源链接：${reasonSummary}`
    : `来源链接已隐藏：${reasonSummary || '不符合安全规则'}`;
};

const getWebpageIcon = (type: string) => {
  const icons = {
    jira: '🎯',
    confluence: '📝',
    github: '🐙',
    docs: '📄',
    blog: '📰',
  };
  return icons[type] || '🌐';
};

const getPriorityStyle = (priority: string) => {
  const styles = {
    高: { background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444' },
    中: { background: 'rgba(251, 191, 36, 0.2)', color: '#f59e0b' },
    低: { background: 'rgba(34, 197, 94, 0.2)', color: '#22c55e' },
  };
  return styles[priority] || styles['中'];
};

/**
 * 格式化时间为相对时间
 */
const formatTimeAgo = (timestamp: unknown): string => {
  return formatTopicRelativeTime(timestamp);
};

const getTopicLastUpdatedLabel = (topic: any): string => {
  return (
    formatTimeAgo(
      topic?.readStatus?.lastUpdateTime ?? topic?.updated ?? topic?.cachedAt,
    ) || '未知时间'
  );
};

watch(
  topicId,
  async (newId) => {
    if (newId) {
      clearStickyUnreadConversations();
      await store.loadTopicDetail(newId);
      await focusConversationFromQuery(route.query.messageId);
    }
  },
  { immediate: true },
);

watch(
  () => route.query.messageId,
  (messageId) => {
    focusConversationFromQuery(messageId);
  },
);

watch(
  () => route.query.readFilter,
  (readFilter) => {
    if (normalizeQueryValue(route.query.messageId)) return;
    convReadFilter.value = normalizeReadFilterValue(readFilter);
  },
);

watch(convReadFilter, (readFilter) => {
  if (readFilter !== 'unread') {
    clearStickyUnreadConversations();
  }
});

onBeforeUnmount(() => {
  clearDetailDeferredUndo();
  clearDetailMuteUndo();
});
</script>

<style scoped>
.topic-undo-toast {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin: 0 0 1rem;
  padding: 0.75rem 1rem;
  border: 1px solid rgba(96, 165, 250, 0.28);
  border-radius: 0.5rem;
  background: rgba(15, 23, 42, 0.88);
  color: #dbeafe;
  font-size: 0.875rem;
}

.topic-undo-toast button {
  flex: 0 0 auto;
  padding: 0.35rem 0.7rem;
  border: 1px solid rgba(96, 165, 250, 0.42);
  border-radius: 0.375rem;
  background: rgba(37, 99, 235, 0.18);
  color: #93c5fd;
  cursor: pointer;
  font-size: 0.8rem;
  font-weight: 700;
}

.topic-undo-toast button:hover,
.topic-undo-toast button:focus-visible {
  outline: none;
  background: rgba(37, 99, 235, 0.32);
  color: #ffffff;
}

.conversation-undo-toast {
  border-color: rgba(245, 158, 11, 0.28);
  background: rgba(245, 158, 11, 0.1);
  color: #fde68a;
}

.topic-defer-undo-toast {
  border-color: rgba(245, 158, 11, 0.28);
  background: rgba(245, 158, 11, 0.1);
  color: #fde68a;
}

.topic-mute-undo-toast {
  border-color: rgba(148, 163, 184, 0.3);
  background: rgba(51, 65, 85, 0.42);
  color: #cbd5e1;
}

.topic-detail-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.75rem;
  flex-wrap: wrap;
}

.topic-detail-defer-menu {
  position: relative;
}

.topic-detail-action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 2.25rem;
  padding: 0.45rem 0.8rem;
  border: 1px solid rgba(245, 158, 11, 0.32);
  border-radius: 0.5rem;
  background: rgba(245, 158, 11, 0.1);
  color: #fde68a;
  cursor: pointer;
  font-size: 0.82rem;
  font-weight: 700;
  line-height: 1.2;
}

.topic-detail-action-btn.mute,
.topic-detail-mute-restore {
  border-color: rgba(148, 163, 184, 0.32);
  background: rgba(51, 65, 85, 0.36);
  color: #cbd5e1;
}

.topic-detail-action-btn:hover,
.topic-detail-action-btn:focus-visible {
  outline: none;
  background: rgba(245, 158, 11, 0.18);
  border-color: rgba(245, 158, 11, 0.48);
}

.topic-detail-defer-options {
  position: absolute;
  z-index: 20;
  top: calc(100% + 0.4rem);
  left: 0;
  display: grid;
  gap: 0.35rem;
  width: min(18rem, 78vw);
  padding: 0.55rem;
  border: 1px solid rgba(245, 158, 11, 0.28);
  border-radius: 0.5rem;
  background: rgba(15, 23, 42, 0.96);
  box-shadow: 0 1rem 2rem rgba(0, 0, 0, 0.22);
}

.topic-detail-defer-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  width: 100%;
  min-height: 2.25rem;
  padding: 0.45rem 0.55rem;
  border: 1px solid transparent;
  border-radius: 0.4rem;
  background: transparent;
  color: #e2e8f0;
  cursor: pointer;
  font-size: 0.82rem;
  text-align: left;
}

.topic-detail-defer-option small {
  flex: 0 0 auto;
  color: #fbbf24;
  font-size: 0.75rem;
}

.topic-detail-defer-option:hover,
.topic-detail-defer-option:focus-visible {
  outline: none;
  border-color: rgba(245, 158, 11, 0.3);
  background: rgba(245, 158, 11, 0.12);
}

.topic-detail-mute-options {
  width: min(21rem, 82vw);
  border-color: rgba(148, 163, 184, 0.28);
}

.topic-detail-mute-reasons {
  display: grid;
  gap: 0.4rem;
  padding-bottom: 0.4rem;
}

.topic-detail-menu-label {
  color: #94a3b8;
  font-size: 0.72rem;
  font-weight: 700;
}

.topic-detail-mute-reason-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.35rem;
}

.topic-detail-mute-reason-option {
  display: grid;
  gap: 0.15rem;
  min-height: 3.4rem;
  padding: 0.45rem;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 0.4rem;
  background: rgba(15, 23, 42, 0.34);
  color: #dbeafe;
  cursor: pointer;
  text-align: left;
}

.topic-detail-mute-reason-option span {
  font-size: 0.78rem;
  font-weight: 700;
}

.topic-detail-mute-reason-option small {
  color: #94a3b8;
  font-size: 0.68rem;
  line-height: 1.25;
}

.topic-detail-mute-reason-option:hover,
.topic-detail-mute-reason-option:focus-visible {
  outline: none;
  border-color: rgba(148, 163, 184, 0.38);
  background: rgba(51, 65, 85, 0.46);
}

.topic-detail-mute-reason-option.active {
  border-color: rgba(96, 165, 250, 0.42);
  background: rgba(37, 99, 235, 0.18);
}

.conversation-section-title {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.conversation-read-summary {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.read-summary-pill {
  display: inline-flex;
  align-items: center;
  min-height: 1.5rem;
  padding: 0.18rem 0.5rem;
  border: 1px solid rgba(148, 163, 184, 0.24);
  border-radius: 999px;
  color: #cbd5e1;
  background: rgba(15, 23, 42, 0.42);
  font-size: 0.75rem;
  font-weight: 700;
  line-height: 1;
}

.read-summary-pill.unread {
  border-color: rgba(248, 113, 113, 0.3);
  color: #fecaca;
  background: rgba(127, 29, 29, 0.18);
}

.read-filter-select {
  min-width: 7.5rem;
}

.conversation-side-actions {
  display: grid;
  justify-items: end;
  gap: 0.25rem;
  margin-left: 1rem;
}

.conversation-source-link {
  color: #93c5fd;
  font-size: 0.75rem;
  font-weight: 700;
  text-decoration: none;
}

.conversation-source-link:hover,
.conversation-source-link:focus-visible {
  color: #bfdbfe;
  text-decoration: underline;
}

.conversation-source-hidden {
  padding: 0.1rem 0.35rem;
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 999px;
  color: #94a3b8;
  background: rgba(15, 23, 42, 0.44);
  cursor: help;
  font-size: 0.72rem;
  font-weight: 700;
  line-height: 1.1;
  max-width: min(14rem, 42vw);
  text-align: right;
  white-space: normal;
}

.item-link,
.webpage-open-link {
  color: #60a5fa;
  font-weight: 700;
  text-decoration: none;
}

.item-link:hover,
.item-link:focus-visible,
.webpage-open-link:hover,
.webpage-open-link:focus-visible {
  color: #bfdbfe;
  text-decoration: underline;
}

.item-muted {
  color: #64748b;
}

.context-indicator {
  display: block;
  width: 100%;
  color: inherit;
  font: inherit;
  text-align: left;
}

/* 全部已阅按钮 */
.mark-all-read-btn {
  padding: 0.75rem 1.5rem;
  background: rgba(34, 197, 94, 0.1);
  border: 1px solid rgba(34, 197, 94, 0.3);
  border-radius: 0.5rem;
  color: #22c55e;
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: 0.875rem;
  font-weight: 500;
  white-space: nowrap;
}

.mark-all-read-btn:hover {
  background: rgba(34, 197, 94, 0.2);
  border-color: rgba(34, 197, 94, 0.5);
}

.mark-all-read-btn:disabled {
  opacity: 0.45;
  cursor: default;
}

.mark-all-read-btn:disabled:hover {
  background: rgba(34, 197, 94, 0.1);
  border-color: rgba(34, 197, 94, 0.3);
}

.unread-meta {
  color: #f87171;
  font-weight: 600;
}

.muted-meta {
  color: #cbd5e1;
  font-weight: 600;
}

/* 未读指示器 */
.unread-indicator {
  color: #ef4444;
  font-size: 0.5rem;
  margin-left: 0.25rem;
  animation: blink 1.5s infinite;
}

@keyframes blink {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.3;
  }
}

/* 未读消息样式 */
.conversation-item.unread {
  border-left: 3px solid #ef4444;
  background: rgba(239, 68, 68, 0.03);
}

.conversation-item.unread .sender-name {
  color: #60a5fa;
  font-weight: 600;
}

.context-item.unread {
  border-left: 2px solid rgba(248, 113, 113, 0.55);
  padding-left: 0.75rem;
}

.context-item.targeted {
  border-left: 3px solid rgba(96, 165, 250, 0.82);
  padding-left: 0.75rem;
  background: rgba(37, 99, 235, 0.12);
  border-radius: 0.375rem;
}

.context-match-badge {
  display: inline-flex;
  align-items: center;
  margin-left: 0.5rem;
  padding: 0.08rem 0.35rem;
  border: 1px solid rgba(96, 165, 250, 0.28);
  border-radius: 999px;
  color: #93c5fd;
  background: rgba(37, 99, 235, 0.12);
  font-size: 0.68rem;
  font-weight: 700;
  line-height: 1.3;
  vertical-align: middle;
}

.targeted-message-badge {
  display: inline-flex;
  align-items: center;
  margin-left: 0.45rem;
  padding: 0.08rem 0.35rem;
  border: 1px solid rgba(96, 165, 250, 0.32);
  border-radius: 999px;
  color: #bfdbfe;
  background: rgba(37, 99, 235, 0.16);
  font-size: 0.68rem;
  font-weight: 700;
  line-height: 1.3;
  vertical-align: middle;
}

.conversation-item.targeted {
  outline: 2px solid rgba(96, 165, 250, 0.75);
  box-shadow: 0 0 0 4px rgba(96, 165, 250, 0.12);
}

.message-focus-notice {
  margin: 0 0 1rem;
  padding: 0.75rem 1rem;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  line-height: 1.45;
}

.message-focus-notice.info {
  color: #bfdbfe;
  border: 1px solid rgba(96, 165, 250, 0.28);
  background: rgba(37, 99, 235, 0.12);
}

.message-focus-notice.warning {
  color: #fde68a;
  border: 1px solid rgba(245, 158, 11, 0.32);
  background: rgba(245, 158, 11, 0.1);
}

.empty-state {
  padding: 1.5rem;
  color: #94a3b8;
  text-align: center;
  border: 1px dashed rgba(148, 163, 184, 0.25);
  border-radius: 0.5rem;
  background: rgba(15, 23, 42, 0.24);
}
</style>
