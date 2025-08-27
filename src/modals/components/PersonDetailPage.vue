<template>
  <div class="person-detail">
    <div class="detail-header">
      <button class="back-btn" @click="goBack">
        <span>←</span>
        <span>返回人物列表</span>
      </button>
      <div v-if="personData" class="person-header">
        <div class="person-avatar">👤</div>
        <div class="person-info">
          <h2>{{ personData.title }}</h2>
          <div class="person-meta">
            <span class="meta-item">🏢 {{ personData.overview?.team || '技术团队' }}</span>
            <span class="meta-item">🤝 {{ personData.overview?.collaborations || 0 }} 个协作项目</span>
            <span class="meta-item">💬 {{ personData.overview?.messages || 0 }} 条消息</span>
            <span class="meta-item">📚 {{ personData.overview?.resources || 0 }} 个资源</span>
            <span class="meta-item">⏰ 最后联系：1小时前</span>
          </div>
        </div>
        <div class="person-actions">
          <button class="action-btn">💬 发送消息</button>
          <button class="action-btn">🤝 查看协作</button>
        </div>
      </div>
    </div>

    <div v-if="isLoading" class="loading-container">
      <div class="loading-spinner"></div>
      <span>加载人物详情...</span>
    </div>

    <div v-else-if="personData" class="person-detail-content">
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

      <!-- 协作项目标签页 -->
      <div v-if="activeTab === 'projects'" class="tab-content active">
        <div class="section-header">
          <h3>🚀 协作项目</h3>
          <button class="add-btn">+ 添加协作</button>
        </div>
        <div class="items-grid">
          <div v-for="project in personData.collaborationProjects" :key="project.id" class="item-card">
            <div class="item-header">
              <div class="item-title">
                <span>🚀</span>
                <span>{{ project.name }}</span>
              </div>
              <div class="item-actions">
                <button class="item-action" title="移除协作">❌</button>
              </div>
            </div>
            <div class="item-content">
              <div style="margin-bottom: 0.5rem;">
                <span class="card-badge">{{ project.status }}</span>
                <span class="card-badge" style="background: rgba(147, 51, 234, 0.2); color: #a78bfa;">{{ project.role }}</span>
              </div>
              <p>{{ project.description }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- 专业技能标签页 -->
      <div v-if="activeTab === 'skills'" class="tab-content active">
        <div class="section-header">
          <h3>🎯 专业技能</h3>
          <button class="add-btn">+ 添加技能</button>
        </div>
        <div class="skills-grid">
          <div v-for="skill in personData.skills" :key="skill.id" class="skill-card">
            <div class="skill-header">
              <div class="skill-name">{{ skill.name }}</div>
              <div class="skill-level">{{ skill.level }}</div>
            </div>
            <div class="skill-progress">
              <div class="skill-progress-bar" :style="{ width: skill.proficiency + '%' }"></div>
            </div>
            <div v-if="skill.projects" class="skill-projects">
              <span class="projects-label">相关项目：</span>
              <span v-for="(project, index) in skill.projects" :key="index" class="skill-project-tag">
                {{ project }}
              </span>
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
                <div class="sender-avatar">{{ conv.sender.charAt(0) }}</div>
                <div class="sender-info">
                  <div class="sender-name">{{ conv.sender }}</div>
                  <div class="group-name">{{ conv.group }}</div>
                </div>
              </div>
              <div class="conversation-time">{{ conv.time }}</div>
            </div>
            <div class="conversation-summary" v-html="highlightText(conv.summary, convSearchQuery)"></div>
            <div 
              class="context-indicator"
              :class="{ expanded: expandedConversations.has(conv.id) }"
              @click="toggleConversationExpand(conv.id)"
            >
              <span class="indicator-text">
                {{ expandedConversations.has(conv.id) ? '🔼 收起上下文' : `🔍 查看上下文 (${conv.context?.length || 0} 条相关消息)` }}
              </span>
            </div>
            <div 
              v-if="conv.context" 
              class="context-content"
              :class="{ expanded: expandedConversations.has(conv.id) }"
            >
              <div class="context-divider"></div>
              <div 
                v-for="(contextMsg, index) in conv.context" 
                :key="index" 
                class="context-item"
                :class="{ 'main-message': contextMsg.isMainMessage }"
              >
                <div class="context-header">
                  <div class="context-sender">{{ contextMsg.sender }}</div>
                  <div class="context-time">{{ contextMsg.time }}</div>
                </div>
                <div 
                  class="context-content-text"
                  v-html="contextMsg.isMainMessage ? highlightText(contextMsg.content, convSearchQuery) : contextMsg.content"
                ></div>
              </div>
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
          <div v-for="resource in personData.relatedResources" :key="resource.id" class="item-card">
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

const personId = computed(() => route.params.id as string);
const personData = computed(() => store.personDetailData);
const isLoading = computed(() => store.isLoading);
const activeTab = ref('projects');

const convSearchQuery = ref('');
const convFilter = ref('all');
const expandedConversations = ref(new Set());

const tabs = [
  { key: 'projects', label: '🚀 协作项目' },
  { key: 'skills', label: '🎯 专业技能' },
  { key: 'conversations', label: '💬 聊天记录' },
  { key: 'resources', label: '📚 相关资源' }
];

const filteredConversations = computed(() => {
  let filtered = personData.value?.conversations || [];
  
  if (convSearchQuery.value.trim()) {
    const query = convSearchQuery.value.toLowerCase();
    filtered = filtered.filter(conv => 
      conv.summary.toLowerCase().includes(query) ||
      conv.sender.toLowerCase().includes(query) ||
      conv.group.toLowerCase().includes(query)
    );
  }
  
  if (convFilter.value !== 'all') {
    filtered = filtered.filter(conv => {
      switch (convFilter.value) {
        case 'team':
          return conv.group.includes('团队') || conv.group.includes('Team');
        case 'project':
          return conv.group.includes('项目') || conv.group.includes('Project');
        case 'tech':
          return conv.group.includes('技术') || conv.group.includes('Tech') || conv.group.includes('开发');
        default:
          return true;
      }
    });
  }
  
  return filtered;
});

const goBack = () => {
  router.push('/entity/Person');
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

// 模拟加载人物详情数据
const loadPersonDetail = (personId: string) => {
  store.personDetailData = {
    id: personId,
    title: '张三',
    overview: { team: '技术团队', collaborations: 3, messages: 25, resources: 8 },
    collaborationProjects: [
      { id: 'project-1', name: 'Personal-AI', status: '开发中', role: '前端负责人', description: 'Chrome扩展智能助手开发' },
      { id: 'project-2', name: 'Web Platform', status: '维护中', role: '核心开发', description: '前端平台维护和优化' }
    ],
    skills: [
      { id: 'skill-1', name: 'React', level: '专家', proficiency: 95, projects: ['Personal-AI', 'Web Platform'] },
      { id: 'skill-2', name: 'TypeScript', level: '高级', proficiency: 88, projects: ['Personal-AI'] },
      { id: 'skill-3', name: '性能优化', level: '中级', proficiency: 75, projects: ['Web Platform'] }
    ],
    conversations: [{
      id: 'conv-1',
      sender: '张三',
      group: '技术讨论组',
      time: '1小时前',
      summary: '代码审查反馈：建议优化组件性能',
      context: [
        { sender: '李四', content: '这个组件的渲染次数有点多', time: '2小时前' },
        { sender: '张三', content: '我建议使用useMemo来优化', time: '1小时前', isMainMessage: true }
      ]
    }],
    relatedResources: [
      { id: 'resource-1', name: 'React 性能优化指南', type: '技术文档', url: '#' },
      { id: 'resource-2', name: 'TypeScript 最佳实践', type: '教程', url: '#' }
    ]
  };
};

watch(personId, (newId) => {
  if (newId) {
    loadPersonDetail(newId);
  }
}, { immediate: true });

watch(() => route.query, (newQuery) => {
  if (newQuery.messageId) {
    activeTab.value = 'conversations';
    console.log('定位到消息:', newQuery.messageId);
  }
});
</script>

<style scoped>
.skills-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1rem;
}

.skill-card {
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid rgba(148, 163, 184, 0.1);
  border-radius: 0.75rem;
  padding: 1rem;
  transition: all 0.3s ease;
}

.skill-card:hover {
  border-color: rgba(59, 130, 246, 0.3);
  transform: translateY(-2px);
}

.skill-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.skill-name {
  font-weight: 600;
  font-size: 1.1rem;
  color: #e2e8f0;
}

.skill-level {
  background: rgba(34, 197, 94, 0.2);
  color: #22c55e;
  padding: 0.25rem 0.75rem;
  border-radius: 1rem;
  font-size: 0.75rem;
  font-weight: 500;
}

.skill-progress {
  width: 100%;
  height: 0.5rem;
  background: rgba(148, 163, 184, 0.2);
  border-radius: 0.25rem;
  overflow: hidden;
  margin-bottom: 0.75rem;
}

.skill-progress-bar {
  height: 100%;
  background: linear-gradient(90deg, #60a5fa, #a78bfa);
  transition: width 0.5s ease;
}

.skill-projects {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  align-items: center;
}

.projects-label {
  font-size: 0.75rem;
  color: #94a3b8;
  margin-right: 0.25rem;
}

.skill-project-tag {
  background: rgba(59, 130, 246, 0.2);
  color: #60a5fa;
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
  font-size: 0.625rem;
  font-weight: 500;
}

.person-header {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid rgba(148, 163, 184, 0.1);
  border-radius: 1rem;
  padding: 2rem;
  backdrop-filter: blur(10px);
}

.person-avatar {
  width: 4rem;
  height: 4rem;
  border-radius: 1rem;
  background: linear-gradient(135deg, #34d399, #22c55e);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
  flex-shrink: 0;
}
</style>
