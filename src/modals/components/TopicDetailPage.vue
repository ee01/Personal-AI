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
            <span class="meta-item"
              >⏰ 最后更新：{{
                formatTimeAgo(
                  topicData.readStatus?.lastUpdateTime ||
                    topicData.updated ||
                    Date.now(),
                )
              }}</span
            >
          </div>
        </div>
      </div>
    </div>

    <div v-if="topicReadUndo" class="topic-undo-toast" role="status">
      <span>已将「{{ topicReadUndo.topicName }}」标记为已读</span>
      <button type="button" @click="handleUndoTopicRead">撤销</button>
    </div>

    <div
      v-if="conversationReadUndo"
      class="topic-undo-toast conversation-undo-toast"
      role="status"
    >
      <span>
        已将「{{ formatConversationUndoLabel(conversationReadUndo) }}」标记为已读
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
                  rel="noreferrer"
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
            v-for="conv in filteredConversations"
            :key="conv.id"
            class="conversation-item"
            :class="{
              expanded: expandedConversations.has(conv.id),
              unread: isConversationUnread(conv),
              targeted: highlightedConversationId === conv.id,
            }"
            :data-conversation-id="conv.id"
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
                  rel="noreferrer"
                  @click.stop
                >
                  来源
                </a>
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
              :class="{ expanded: expandedConversations.has(conv.id) }"
              @click="toggleConversationExpand(conv.id)"
            >
              <span class="indicator-text">
                {{
                  expandedConversations.has(conv.id)
                    ? '🔼 收起上下文'
                    : getConversationContextLabel(conv)
                }}
              </span>
            </button>
            <div
              v-if="conv.contextMessages"
              class="context-content"
              :class="{ expanded: expandedConversations.has(conv.id) }"
            >
              <div class="context-divider"></div>
              <div
                v-for="(contextMsg, index) in conv.contextMessages"
                :key="index"
                class="context-item"
                :class="{
                  'main-message': contextMsg.isMainMessage,
                  unread: isContextMessageUnread(contextMsg),
                }"
              >
                <div class="context-header">
                  <div class="context-sender">
                    {{ contextMsg.sender || '未知用户' }}
                    <span
                      v-if="isContextMessageUnread(contextMsg)"
                      class="unread-indicator"
                      >●</span
                    >
                  </div>
                  <div class="context-time">
                    {{ formatTimeAgo(contextMsg.datetime) || '未知时间' }}
                  </div>
                </div>
                <div
                  class="context-content-text"
                  v-html="
                    highlightText(contextMsg.content || '内容为空', convSearchQuery)
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
                  rel="noreferrer"
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
import { ref, computed, watch, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useMemoryStore } from '../memory-store';
import {
  findTopicConversationByMessageId,
  filterTopicConversationsByReadState,
  getTopicConversationUnreadMessageCount,
  getTopicConversationUnreadCount,
  getTopicDetailRecentData,
  isTopicConversationUnread,
  sortTopicConversationsForTriage,
  topicConversationHasContextMatch,
  topicConversationMatchesQuery,
  type TopicConversationReadFilter,
} from '../topic-detail-data';
import { renderHighlightedText } from '../topic-detail-rendering';

const route = useRoute();
const router = useRouter();
const store = useMemoryStore();

const topicId = computed(() => route.params.id as string);
const topicData = computed(() => store.topicDetailData);
const isLoading = computed(() => store.isLoading);
const topicReadUndo = computed(() => store.topicReadUndo);
const conversationReadUndo = computed(() => store.conversationReadUndo);
const activeTab = ref('conversations');
const topicUnreadCount = computed(
  () => topicData.value?.readStatus?.unreadCount || 0,
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
const convReadFilter = ref<TopicConversationReadFilter>('all');
const convFilter = ref('all');
const webSearchQuery = ref('');
const webTypeFilter = ref('all');
const expandedConversations = ref(new Set());
const highlightedConversationId = ref<string | null>(null);
const messageFocusNotice = ref<{
  type: 'info' | 'warning';
  text: string;
} | null>(null);

const tabs = [
  { key: 'projects', label: '🚀 相关项目' },
  { key: 'resources', label: '📚 相关资源' },
  { key: 'tickets', label: '🎯 相关Tickets' },
  { key: 'conversations', label: '💬 聊天记录' },
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

const filteredConversations = computed(() => {
  let filtered = sortTopicConversationsForTriage(topicConversations.value);

  filtered = filterTopicConversationsByReadState(
    filtered,
    convReadFilter.value,
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

const toggleConversationExpand = (conversationId: string) => {
  const newExpanded = new Set(expandedConversations.value);
  if (newExpanded.has(conversationId)) {
    newExpanded.delete(conversationId);
  } else {
    newExpanded.clear();
    newExpanded.add(conversationId);
    // 展开时标记为已读
    void store.markConversationAsRead(topicId.value, conversationId);
  }
  expandedConversations.value = newExpanded;
};

const handleMarkAllAsRead = async () => {
  if (topicId.value) {
    await store.markTopicAsRead(topicId.value);
  }
};

const handleUndoTopicRead = async () => {
  await store.undoLastTopicRead();
};

const handleUndoConversationRead = async () => {
  await store.undoLastConversationRead();
};

const doesConversationContextMatch = (conversation: any): boolean => {
  return topicConversationHasContextMatch(
    conversation,
    convSearchQuery.value,
  );
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
  return contextMessage?.isRead !== true;
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

const focusConversationFromQuery = async (messageIdValue: unknown) => {
  const messageId = normalizeQueryValue(messageIdValue);
  if (!messageId) {
    messageFocusNotice.value = null;
    return;
  }
  if (!topicId.value || !topicData.value) return;

  const targetConversation = findTopicConversationByMessageId(
    topicData.value,
    messageId,
  );
  if (!targetConversation?.id) {
    activeTab.value = 'conversations';
    convFilter.value = 'all';
    convSearchQuery.value = '';
    messageFocusNotice.value = {
      type: 'warning',
      text: '没有在当前主题详情中找到链接里的消息，已显示全部聊天记录。',
    };
    return;
  }

  activeTab.value = 'conversations';
  convFilter.value = 'all';
  messageFocusNotice.value = {
    type: 'info',
    text: '已定位到链接里的聊天记录，并同步为已读。',
  };

  if (
    convSearchQuery.value &&
    !filteredConversations.value.some(
      (conversation: any) => conversation.id === targetConversation.id,
    )
  ) {
    convSearchQuery.value = '';
  }

  expandedConversations.value = new Set([targetConversation.id]);
  highlightedConversationId.value = targetConversation.id;
  await store.markConversationAsRead(topicId.value, targetConversation.id);
  await nextTick();

  const targetElement = Array.from(
    document.querySelectorAll<HTMLElement>('[data-conversation-id]'),
  ).find((element) => element.dataset.conversationId === targetConversation.id);
  targetElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });

  window.setTimeout(() => {
    if (highlightedConversationId.value === targetConversation.id) {
      highlightedConversationId.value = null;
    }
    if (messageFocusNotice.value?.type === 'info') {
      messageFocusNotice.value = null;
    }
  }, 2400);
};

const highlightText = (text: string, searchQuery: string) => {
  return renderHighlightedText(text, searchQuery);
};

const getSafeExternalUrl = (url: unknown): string => {
  if (!url || url === '#') return '';
  const normalizedUrl = String(url).trim();
  if (/^https?:\/\//i.test(normalizedUrl)) return normalizedUrl;
  return '';
};

const getConversationSourceUrl = (conversation: any): string => {
  return getSafeExternalUrl(
    conversation?.teamUrl ||
      conversation?.sourceUrl ||
      conversation?.permalink ||
      conversation?.url,
  );
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
const formatTimeAgo = (timestamp: number): string => {
  const now = Date.now();
  const diff = now - timestamp;

  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  const weeks = Math.floor(diff / 604800000);

  if (hours < 1) return '刚刚';
  if (hours < 24) return `${hours}小时前`;
  if (days < 7) return `${days}天前`;
  if (weeks < 4) return `${weeks}周前`;
  return new Date(timestamp).toLocaleDateString();
};

watch(
  topicId,
  async (newId) => {
    if (newId) {
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
