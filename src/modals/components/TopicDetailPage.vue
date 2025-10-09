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
            <span class="meta-item">📈 {{ topicData.statistic?.conversations || 0 }} 条讨论</span>
            <span class="meta-item">🔗 {{ topicData.statistic?.projects || 0 }} 个关联项目</span>
            <span class="meta-item">👥 {{ topicData.statistic?.participants || 0 }} 位参与者</span>
            <span class="meta-item">📚 {{ topicData.statistic?.resources || 0 }} 个资源</span> 
            <span class="meta-item">⏰ 最后更新：30 分钟前</span>
          </div>
        </div>
        <div class="topic-actions">
          <button class="action-btn">📝 编辑主题</button>
          <button class="action-btn">🔗 添加关联</button>
        </div>
      </div>
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
          <button class="add-btn">+ 添加项目</button>
        </div>
        <div class="items-grid">
          <div v-for="project in topicData.recentDataDetails.projects" :key="project.id" class="item-card">
            <div class="item-header">
              <div class="item-title">
                <span>🚀</span>
                <span>{{ project.name }}</span>
              </div>
              <div class="item-actions">
                <button class="item-action" title="取消关联">❌</button>
              </div>
            </div>
            <div class="item-content">
              <div style="margin-bottom: 0.5rem;">
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
          <button class="add-btn">+ 添加资源</button>
        </div>
        <div class="items-grid">
          <div v-for="resource in topicData.recentDataDetails.resources" :key="resource.id" class="item-card">
            <div class="item-header">
              <div class="item-title">
                <span>📚</span>
                <span>{{ resource.name }}</span>
              </div>
              <div class="item-actions">
                <button class="item-action" title="删除资源">❌</button>
              </div>
            </div>
            <div class="item-content">
              <div style="margin-bottom: 0.5rem;">
                <span class="card-badge">{{ resource.type }}</span>
              </div>
              <p><a :href="resource.url" style="color: #60a5fa;">查看资源</a></p>
            </div>
          </div>
        </div>
      </div>

      <!-- 相关Tickets标签页 -->
      <div v-if="activeTab === 'tickets'" class="tab-content active">
        <div class="section-header">
          <h3>🎯 相关Tickets</h3>
          <button class="add-btn">+ 添加Ticket</button>
        </div>
        <div class="items-grid">
          <div v-for="ticket in topicData.recentDataDetails.jiraTickets" :key="ticket.id" class="item-card">
            <div class="item-header">
              <div class="item-title">
                <span>🎯</span>
                <span>{{ ticket.id }}</span>
              </div>
              <div class="item-actions">
                <button class="item-action" title="取消关联">❌</button>
              </div>
            </div>
            <div class="item-content">
              <h4 style="margin-bottom: 0.5rem; font-weight: 600;">{{ ticket.title }}</h4>
              <div style="display: flex; gap: 0.5rem; margin-bottom: 0.5rem;">
                <span class="card-badge">{{ ticket.status }}</span>
                <span class="card-badge" :style="getPriorityStyle(ticket.priority)">{{ ticket.priority }}</span>
              </div>
              <p style="font-size: 0.875rem; color: #94a3b8;">负责人：{{ ticket.assignee }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- 聊天记录标签页 -->
      <div v-if="activeTab === 'conversations'" class="tab-content active">
        <div class="section-header">
          <h3>💬 聊天记录</h3>
          <div class="search-controls">
            <input type="text" class="search-input" placeholder="搜索聊天记录..." v-model="convSearchQuery" />
            <select class="filter-select" v-model="convFilter">
              <option value="all">全部群组</option>
              <option value="team">团队群</option>
              <option value="project">项目群</option>
              <option value="tech">技术讨论</option>
            </select>
          </div>
        </div>
        <div class="conversations-list">
          <div 
            v-for="conv in filteredConversations" 
            :key="conv.id" 
            class="conversation-item"
            :class="{ expanded: expandedConversations.has(conv.id) }"
          >
            <div class="conversation-header">
              <div class="conversation-meta">
                <div class="sender-avatar">{{ (conv.sender || '?').charAt(0) }}</div>
                <div class="sender-info">
                  <div class="sender-name">{{ conv.sender || '未知用户' }}</div>
                  <div class="group-name">{{ conv.groupName || '未知群组' }}</div>
                </div>
              </div>
              <div class="conversation-time">{{ formatTimeAgo(conv.datetime) || '未知时间' }}</div>
            </div>
            <div class="conversation-summary" v-html="highlightText(conv.summary || '暂无摘要', convSearchQuery)"></div>
            <div 
              class="context-indicator"
              :class="{ expanded: expandedConversations.has(conv.id) }"
              @click="toggleConversationExpand(conv.id)"
            >
              <span class="indicator-text">
                {{ expandedConversations.has(conv.id) ? '🔼 收起上下文' : `🔍 查看上下文 (${conv.contextMessages?.length || 0} 条相关消息)` }}
              </span>
            </div>
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
                :class="{ 'main-message': contextMsg.isMainMessage }"
              >
                <div class="context-header">
                  <div class="context-sender">{{ contextMsg.sender || '未知用户' }}</div>
                  <div class="context-time">{{ formatTimeAgo(contextMsg.datetime) || '未知时间' }}</div>
                </div>
                <div 
                  class="context-content-text"
                  v-html="contextMsg.isMainMessage ? highlightText(contextMsg.content || '', convSearchQuery) : (contextMsg.content || '内容为空')"
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
            <input type="text" class="search-input" placeholder="搜索网页记录..." v-model="webSearchQuery" />
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
          <div v-for="webpage in filteredWebpages" :key="webpage.id" class="webpage-item">
            <div class="webpage-header">
              <div class="webpage-icon">{{ getWebpageIcon(webpage.type) }}</div>
              <div class="webpage-info">
                <div class="webpage-title">{{ webpage.title || '未知标题' }}</div>
                <div class="webpage-url">{{ webpage.url || '#' }}</div>
                <div class="webpage-meta">
                  <span>访问时间：{{ webpage.visitTime || '未知时间' }}</span>
                  <span v-if="webpage.relevanceScore">相关性：{{ (webpage.relevanceScore * 100).toFixed(0) }}%</span>
                </div>
              </div>
            </div>
            <div class="webpage-content">{{ webpage.summary || '暂无摘要' }}</div>
            <div v-if="webpage.tags" class="webpage-tags">
              <span v-for="tag in webpage.tags" :key="tag" class="webpage-tag">{{ tag }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useMemoryStore } from '../memory-store';

const route = useRoute();
const router = useRouter();
const store = useMemoryStore();

const topicId = computed(() => route.params.id as string);
const topicData = computed(() => store.topicDetailData);
const isLoading = computed(() => store.isLoading);
const activeTab = ref('conversations');

const convSearchQuery = ref('');
const convFilter = ref('all');
const webSearchQuery = ref('');
const webTypeFilter = ref('all');
const expandedConversations = ref(new Set());

const tabs = [
  { key: 'projects', label: '🚀 相关项目' },
  { key: 'resources', label: '📚 相关资源' },
  { key: 'tickets', label: '🎯 相关Tickets' },
  { key: 'conversations', label: '💬 聊天记录' },
  { key: 'webpages', label: '🌐 网页记录' }
];

const filteredConversations = computed(() => {
  let filtered = topicData.value?.recentDataDetails?.conversations || [];
  
  if (convSearchQuery.value.trim()) {
    const query = convSearchQuery.value.toLowerCase();
    filtered = filtered.filter(conv => 
      conv.summary.toLowerCase().includes(query) ||
      conv.sender.toLowerCase().includes(query) ||
      conv.groupName.toLowerCase().includes(query)
    );
  }
  
  if (convFilter.value !== 'all') {
    filtered = filtered.filter(conv => {
      switch (convFilter.value) {
        case 'team':
          return conv.groupName.includes('团队') || conv.groupName.includes('Team');
        case 'project':
          return conv.groupName.includes('项目') || conv.groupName.includes('Project');
        case 'tech':
          return conv.groupName.includes('技术') || conv.groupName.includes('Tech') || conv.groupName.includes('开发');
        default:
          return true;
      }
    });
  }
  
  return filtered;
});

const filteredWebpages = computed(() => {
  let filtered = topicData.value?.recentDataDetails?.webpages || [];
  
  if (webSearchQuery.value.trim()) {
    const query = webSearchQuery.value.toLowerCase();
    filtered = filtered.filter(webpage => 
      webpage.title.toLowerCase().includes(query) ||
      webpage.summary.toLowerCase().includes(query) ||
      webpage.url.toLowerCase().includes(query)
    );
  }
  
  if (webTypeFilter.value !== 'all') {
    filtered = filtered.filter(webpage => webpage.type === webTypeFilter.value);
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
  }
  expandedConversations.value = newExpanded;
};

const highlightText = (text: string, searchQuery: string) => {
  if (!searchQuery.trim()) return text;
  
  const regex = new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return text.replace(regex, '<mark style="background: rgba(251, 191, 36, 0.3); color: #fbbf24; padding: 0.125rem 0.25rem; border-radius: 0.25rem; font-weight: 600;">$1</mark>');
};

const getWebpageIcon = (type: string) => {
  const icons = {
    jira: '🎯',
    confluence: '📝',
    github: '🐙',
    docs: '📄',
    blog: '📰'
  };
  return icons[type] || '🌐';
};

const getPriorityStyle = (priority: string) => {
  const styles = {
    '高': { background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444' },
    '中': { background: 'rgba(251, 191, 36, 0.2)', color: '#f59e0b' },
    '低': { background: 'rgba(34, 197, 94, 0.2)', color: '#22c55e' }
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
}

watch(topicId, (newId) => {
  if (newId) {
    store.loadTopicDetail(newId);
  }
}, { immediate: true });

watch(() => route.query, (newQuery) => {
  if (newQuery.messageId) {
    activeTab.value = 'conversations';
    console.log('定位到消息:', newQuery.messageId);
  }
});
</script>
