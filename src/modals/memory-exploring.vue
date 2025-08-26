<template>
  <div id="memory-app">
    <div class="memory-container">
      <!-- 侧边栏 -->
      <div class="sidebar">
        <div class="sidebar-header">
          <div class="logo">🧠 记忆查询系统</div>
        </div>
        
        <div class="entity-types">
          <router-link to="/" class="entity-type" active-class="router-link-active">
            <div class="entity-icon">🏠</div>
            <div class="entity-name">首页概览</div>
          </router-link>
          
          <router-link to="/timeline" class="entity-type" active-class="router-link-active">
            <div class="entity-icon">⏰</div>
            <div class="entity-name">时间轴</div>
          </router-link>
          
          <router-link to="/user-profile" class="entity-type" active-class="router-link-active">
            <div class="entity-icon">👤</div>
            <div class="entity-name">用户画像</div>
          </router-link>
          
          <hr class="sidebar-divider" />
          
          <router-link 
            v-for="entityType in entityTypes" 
            :key="entityType.type"
            :to="`/entity/${entityType.type}`"
            class="entity-type" 
            active-class="router-link-active"
          >
            <div class="entity-icon">{{ entityType.icon }}</div>
            <div class="entity-name">{{ entityType.name }}</div>
            <div class="entity-count">{{ entityType.count }}</div>
          </router-link>
        </div>
      </div>

      <!-- 主内容区 -->
      <div class="main-content">
        <!-- 搜索头部 -->
        <div class="search-header">
          <div class="search-box">
            <div class="search-icon">🔍</div>
            <input 
              type="text" 
              class="search-input" 
              placeholder="搜索任何内容、实体或关键词..."
              v-model="searchQuery"
              @input="handleSearchInput"
              @keypress.enter="handleSearch"
            />
          </div>
          <button class="filter-btn" @click="handleSearch">📊 搜索</button>
          <button class="filter-btn" @click="clearSearch">🔄 重置</button>
        </div>

        <!-- 路由内容 -->
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { createApp, ref, computed, onMounted, watch, defineComponent, getCurrentInstance } from 'vue';
import { createRouter, createWebHashHistory, useRoute, useRouter } from 'vue-router';
import { createPinia, defineStore } from 'pinia';

// 实体类型配置
const ENTITY_TYPE_CONFIG = {
  'Person': { name: '人物', icon: '👥', description: '团队成员、联系人、项目相关人员等' },
  'Project': { name: '项目', icon: '🚀', description: '工作项目、产品开发、研究项目等' },
  'Task': { name: '任务', icon: '📋', description: '具体工作任务、待办事项、行动项等' },
  'Organization': { name: '组织', icon: '🏢', description: '公司、部门、团队、客户组织等' },
  'Document': { name: '文档', icon: '📄', description: '文件、资料、规范、报告等' },
  'Technology': { name: '技术', icon: '🔧', description: '技术栈、工具、框架、平台等' },
  'Topic': { name: '主题', icon: '💡', description: '讨论话题、知识领域、专业概念等' }
};

// Chrome Extension API 封装
const chromeAPI = {
  async sendMessage(message: any) {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      return new Promise((resolve) => {
        chrome.runtime.sendMessage(message, resolve);
      });
    }
    console.log('模拟Chrome API调用:', message);
    return { success: true, data: null };
  }
};

// Pinia Store
const useMemoryStore = defineStore('memory', () => {
  const isLoading = ref(false);
  const searchQuery = ref('');
  const entities = ref([]);
  const entityTypes = ref([
    { type: 'Project', name: '项目', icon: '🚀', count: 12 },
    { type: 'Topic', name: '主题', icon: '💡', count: 28 },
    { type: 'Person', name: '人物', icon: '👥', count: 45 },
    { type: 'Organization', name: '组织', icon: '🏢', count: 8 },
    { type: 'Document', name: '文档', icon: '📄', count: 156 },
    { type: 'Technology', name: '技术', icon: '🔧', count: 23 }
  ]);
  const overviewStats = ref({
    totalEntities: 272,
    totalRelationships: 156,
    entitiesCreatedToday: 5,
    entitiesCreatedThisWeek: 23,
    entitiesCreatedThisMonth: 89
  });
  const topicDetailData = ref(null);

  const initialize = async () => {
    isLoading.value = true;
    try {
      const response = await chromeAPI.sendMessage({ type: 'GET_ENTITY_STATISTICS' });
      if (response && response.success) {
        overviewStats.value = response.data;
      }
    } catch (error) {
      console.warn('获取实体统计失败，使用模拟数据');
    } finally {
      isLoading.value = false;
    }
  };

  const loadEntitiesByType = async (entityType: string) => {
    isLoading.value = true;
    try {
      const response = await chromeAPI.sendMessage({
        type: 'GET_ENTITIES_BY_TYPE',
        entityType,
        limit: 50
      });
      
      if (response && response.success) {
        entities.value = response.data || [];
      } else {
        entities.value = generateMockEntities(entityType);
      }
    } catch (error) {
      entities.value = generateMockEntities(entityType);
    } finally {
      isLoading.value = false;
    }
  };

  const searchEntities = async (query: string) => {
    if (!query.trim()) return;
    isLoading.value = true;
    try {
      const response = await chromeAPI.sendMessage({
        type: 'SEARCH_ENTITIES',
        query,
        limit: 30
      });
      if (response && response.success) {
        entities.value = response.data || [];
      }
    } catch (error) {
      console.error('搜索失败:', error);
    } finally {
      isLoading.value = false;
    }
  };

  const loadTopicDetail = async (topicId: string) => {
    isLoading.value = true;
    try {
      const response = await chromeAPI.sendMessage({ type: 'GET_TOPIC_DETAIL', topicId });
      if (response && response.success) {
        topicDetailData.value = response.data;
      } else {
        topicDetailData.value = getMockTopicDetail(topicId);
      }
    } catch (error) {
      topicDetailData.value = getMockTopicDetail(topicId);
    } finally {
      isLoading.value = false;
    }
  };

  const generateMockEntities = (entityType: string) => {
    const config = ENTITY_TYPE_CONFIG[entityType];
    if (!config) return [];
    return Array.from({ length: 5 }, (_, i) => ({
      id: `${entityType.toLowerCase()}-${i + 1}`,
      name: `${config.name} ${i + 1}`,
      type: entityType,
      description: `这是一个${config.description}的示例`,
      importance: Math.random(),
      accessCount: Math.floor(Math.random() * 100),
      lastAccessed: Date.now() - Math.floor(Math.random() * 86400000),
      relationshipsCount: Math.floor(Math.random() * 20),
      relatedMessagesCount: Math.floor(Math.random() * 50),
      relatedWebpagesCount: Math.floor(Math.random() * 30),
      tags: ['示例', '测试'],
      status: 'active'
    }));
  };

  const getMockTopicDetail = (topicId: string) => {
    return {
      id: topicId,
      title: 'AI 工作流自动化',
      overview: { discussions: 12, projects: 5, participants: 8, resources: 15 },
      relatedProjects: [
        { id: 'project-1', name: 'Personal-AI', status: '开发中', description: 'Chrome扩展智能助手' },
        { id: 'project-2', name: 'Automation Tools', status: '规划中', description: 'CI/CD自动化工具链' }
      ],
      relatedResources: [
        { id: 'resource-1', name: 'AI开发最佳实践', type: '技术文档', url: '#' },
        { id: 'resource-2', name: '自动化工具指南', type: '教程', url: '#' }
      ],
      conversations: [{
        id: 'conv-1',
        sender: '张三',
        group: '技术讨论组',
        time: '30分钟前',
        summary: '分享了最新的AI实现方案和技术心得',
        context: [
          { sender: '李四', content: '这个AI方案看起来很有潜力', time: '35分钟前' },
          { sender: '张三', content: '是的，我们可以在下个版本中集成', time: '30分钟前', isMainMessage: true }
        ]
      }],
      webpages: [{
        id: 'webpage-1',
        title: 'AI开发技术文档',
        url: 'https://example.com/ai-docs',
        type: 'docs',
        visitTime: '2小时前',
        summary: '详细介绍了AI开发的关键技术和实现方法',
        tags: ['AI', '技术文档', '开发指南']
      }]
    };
  };

  return {
    isLoading, searchQuery, entities, entityTypes, overviewStats, topicDetailData,
    initialize, loadEntitiesByType, searchEntities, loadTopicDetail
  };
});

// 页面组件定义
const OverviewPage = defineComponent({
  template: `
    <div class="overview-section">
      <div class="greeting-card">
        <div class="greeting-title">
          <span>🌅</span>
          <span>欢迎来到记忆查询系统</span>
        </div>
        <div class="greeting-content">
          <p>您的个人知识图谱中包含:</p>
          <ul class="quick-summary">
            <li>📊 {{ overviewStats?.totalEntities || 0 }} 个实体，{{ overviewStats?.totalRelationships || 0 }} 个关系</li>
            <li>📈 今日新增 {{ overviewStats?.entitiesCreatedToday || 0 }} 个实体</li>
            <li>📅 本周新增 {{ overviewStats?.entitiesCreatedThisWeek || 0 }} 个实体</li>
            <li>📆 本月新增 {{ overviewStats?.entitiesCreatedThisMonth || 0 }} 个实体</li>
          </ul>
          <p>点击左侧类别开始探索您的记忆 👈</p>
        </div>
      </div>

      <div class="content-grid">
        <!-- 今日重点项目 -->
        <div class="content-card" @click="navigateToEntityType('Project')">
          <div class="card-header">
            <div class="card-title">
              <span>🚀</span>
              <span>今日重点项目</span>
            </div>
            <div class="card-badge">{{ getEntityCount('Project') }} 个活跃</div>
          </div>
          <div class="card-content">最近活跃的项目和相关信息</div>
          <ul class="info-list">
            <li class="info-item">
              <span>🔥</span>
              <span>Personal-AI - Chrome 扩展开发</span>
              <span class="info-time">2 小时前</span>
            </li>
            <li class="info-item">
              <span>📊</span>
              <span>Data Pipeline - 性能优化</span>
              <span class="info-time">5 小时前</span>
            </li>
            <li class="info-item">
              <span>🎨</span>
              <span>Design System - 组件库更新</span>
              <span class="info-time">1 天前</span>
            </li>
          </ul>
          <div class="view-more-btn">
            <span>查看所有项目</span>
            <span>→</span>
          </div>
        </div>

        <!-- 热门主题讨论 -->
        <div class="content-card" @click="navigateToEntityType('Topic')">
          <div class="card-header">
            <div class="card-title">
              <span>💡</span>
              <span>热门主题讨论</span>
            </div>
            <div class="card-badge">{{ getEntityCount('Topic') }} 个活跃</div>
          </div>
          <div class="card-content">最近讨论频繁的话题和观点</div>
          <ul class="info-list">
            <li class="info-item" @click.stop="navigateToTopic('ai-workflow')">
              <span>🤖</span>
              <span>AI 工作流自动化实践</span>
              <span class="info-time">30 分钟前</span>
            </li>
            <li class="info-item">
              <span>⚡</span>
              <span>前端性能优化策略</span>
              <span class="info-time">2 小时前</span>
            </li>
            <li class="info-item">
              <span>🎯</span>
              <span>产品设计思维方法</span>
              <span class="info-time">4 小时前</span>
            </li>
          </ul>
          <div class="view-more-btn">
            <span>查看所有主题</span>
            <span>→</span>
          </div>
        </div>

        <!-- 重要联系人动态 -->
        <div class="content-card" @click="navigateToEntityType('Person')">
          <div class="card-header">
            <div class="card-title">
              <span>👥</span>
              <span>重要联系人动态</span>
            </div>
            <div class="card-badge">新消息</div>
          </div>
          <div class="card-content">来自同事和合作伙伴的重要更新</div>
          <ul class="info-list">
            <li class="info-item">
              <span>👤</span>
              <span>张三 - 代码审查反馈</span>
              <span class="info-time">1 小时前</span>
            </li>
            <li class="info-item">
              <span>👤</span>
              <span>李四 - 设计稿更新通知</span>
              <span class="info-time">3 小时前</span>
            </li>
            <li class="info-item">
              <span>👤</span>
              <span>王五 - 会议纪要分享</span>
              <span class="info-time">6 小时前</span>
            </li>
          </ul>
          <div class="view-more-btn">
            <span>查看所有联系人</span>
            <span>→</span>
          </div>
        </div>

        <!-- AI 推荐内容 -->
        <div class="content-card">
          <div class="card-header">
            <div class="card-title">
              <span>🎯</span>
              <span>AI 推荐内容</span>
            </div>
            <div class="card-badge">智能推荐</div>
          </div>
          <div class="card-content">基于你的兴趣和工作习惯推荐的内容</div>
          <ul class="info-list">
            <li class="info-item">
              <span>📖</span>
              <span>《Clean Architecture》读书笔记复习</span>
              <span class="info-time">推荐</span>
            </li>
            <li class="info-item">
              <span>🔧</span>
              <span>Webpack 5 迁移指南</span>
              <span class="info-time">推荐</span>
            </li>
            <li class="info-item">
              <span>💡</span>
              <span>React 18 新特性总结</span>
              <span class="info-time">推荐</span>
            </li>
          </ul>
          <div class="view-more-btn">
            <span>查看更多推荐</span>
            <span>→</span>
          </div>
        </div>
      </div>
    </div>
  `,
  setup() {
    const store = useMemoryStore();
    const router = useRouter();
    
    const overviewStats = computed(() => store.overviewStats);
    
    const navigateToEntityType = (entityType: string) => {
      router.push(`/entity/${entityType}`);
    };
    
    const navigateToTopic = (topicId: string) => {
      router.push(`/topic/${topicId}`);
    };
    
    const getEntityCount = (entityType: string) => {
      const entity = store.entityTypes.find(e => e.type === entityType);
      return entity ? entity.count : 0;
    };
    
    return { overviewStats, navigateToEntityType, navigateToTopic, getEntityCount };
  }
});

const TimelinePage = defineComponent({
  template: `
    <div class="timeline-view">
      <h2 style="margin-bottom: 2rem; font-size: 1.5rem; font-weight: 600;">📅 今日时间轴</h2>
      
      <div v-if="isLoading" class="loading-container">
        <div class="loading-spinner"></div>
        <span>加载时间轴数据...</span>
      </div>
      
      <div v-else class="timeline-container">
        <div v-for="event in timelineEvents" :key="event.id" class="timeline-item">
          <div class="timeline-dot">{{ getTimelineIcon(event.type) }}</div>
          <div class="timeline-content">
            <div class="timeline-time">{{ formatTime(event.timestamp) }}</div>
            <div class="content-card" style="margin: 0;">
              <div class="card-title">{{ event.title }}</div>
              <div class="card-content">{{ event.content }}</div>
              <div v-if="event.source" class="event-source">来源: {{ event.source }}</div>
            </div>
          </div>
        </div>
        
        <div v-if="timelineEvents.length === 0" class="empty-state">
          <span>📭</span>
          <p>暂无时间轴数据</p>
        </div>
      </div>
    </div>
  `,
  setup() {
    const store = useMemoryStore();
    
    const timelineEvents = ref([
      {
        id: 'event-1',
        type: 'start',
        title: '开始新的一天',
        content: '查看了昨天的工作总结和今日计划',
        timestamp: Date.now() - 4 * 3600000
      },
      {
        id: 'event-2',
        type: 'message',
        title: '团队晨会讨论',
        content: '讨论了 Personal-AI 项目的进展，张三提出了代码审查建议',
        timestamp: Date.now() - 3 * 3600000,
        source: '团队会议'
      },
      {
        id: 'event-3',
        type: 'update',
        title: '技术文档更新',
        content: '更新了 React Query 集成文档，添加了错误处理最佳实践',
        timestamp: Date.now() - 2 * 3600000
      },
      {
        id: 'event-4',
        type: 'task',
        title: 'Jira 任务更新',
        content: '完成了 3 个 bug 修复，更新了任务状态到"待测试"',
        timestamp: Date.now() - 1 * 3600000,
        source: 'Jira'
      }
    ]);
    
    const isLoading = computed(() => store.isLoading);
    
    const getTimelineIcon = (type: string) => {
      const icons = {
        'start': '🌅',
        'message': '💬',
        'update': '🔧',
        'task': '📊',
        'webpage': '🌐',
        'relation_created': '🔗',
        'entity_updated': '📝'
      };
      return icons[type] || '📅';
    };
    
    const formatTime = (timestamp: number) => {
      const now = Date.now();
      const diff = now - timestamp;
      const minutes = Math.floor(diff / 60000);
      const hours = Math.floor(diff / 3600000);
      const days = Math.floor(diff / 86400000);
      
      if (minutes < 60) return `${minutes}分钟前`;
      if (hours < 24) return `${hours}小时前`;
      if (days < 30) return `${days}天前`;
      return new Date(timestamp).toLocaleDateString();
    };
    
    return { isLoading, timelineEvents, getTimelineIcon, formatTime };
  }
});

const EntityDetailPage = defineComponent({
  template: `
    <div class="entity-detail">
      <div class="entity-header">
        <div class="entity-avatar">{{ getEntityIcon(entityType) }}</div>
        <div class="entity-info">
          <h2>{{ getEntityTypeName(entityType) }}</h2>
          <div class="entity-meta">
            共 {{ entities.length }} 个{{ getEntityTypeName(entityType) }}
            <span v-if="searchQuery"> • 搜索: "{{ searchQuery }}"</span>
          </div>
        </div>
      </div>

      <div v-if="isLoading" class="loading-container">
        <div class="loading-spinner"></div>
        <span>加载实体数据...</span>
      </div>

      <div v-else class="entities-grid">
        <div 
          v-for="entity in entities" 
          :key="entity.id" 
          class="entity-card"
          @click="handleEntityClick(entity)"
        >
          <div class="entity-card-header">
            <div class="entity-card-title">
              <span>{{ getEntityIcon(entity.type) }}</span>
              <span>{{ entity.name }}</span>
            </div>
            <div v-if="entity.importance !== undefined" class="importance-indicator">
              <div 
                class="importance-bar" 
                :style="{ width: (entity.importance * 100) + '%' }"
              ></div>
            </div>
          </div>
          
          <div v-if="entity.description" class="entity-description">
            {{ entity.description }}
          </div>
          
          <div class="entity-stats">
            <div class="stat-item">
              <span>🔗</span>
              <span>{{ entity.relationshipsCount || 0 }} 关系</span>
            </div>
            <div class="stat-item">
              <span>💬</span>
              <span>{{ entity.relatedMessagesCount || 0 }} 消息</span>
            </div>
            <div class="stat-item">
              <span>🌐</span>
              <span>{{ entity.relatedWebpagesCount || 0 }} 网页</span>
            </div>
            <div class="stat-item">
              <span>👁️</span>
              <span>{{ entity.accessCount || 0 }} 访问</span>
            </div>
          </div>
          
          <div v-if="entity.tags && entity.tags.length > 0" class="entity-tags">
            <span 
              v-for="(tag, index) in entity.tags.slice(0, 3)" 
              :key="index" 
              class="entity-tag"
            >
              {{ tag }}
            </span>
            <span v-if="entity.tags.length > 3" class="entity-tag more-tags">
              +{{ entity.tags.length - 3 }}
            </span>
          </div>
          
          <div class="entity-footer">
            <span class="last-accessed">
              最后访问: {{ formatTime(entity.lastAccessed || Date.now()) }}
            </span>
            <span v-if="entity.status" :class="'status-indicator ' + entity.status">
              {{ entity.status }}
            </span>
          </div>
        </div>
        
        <div v-if="entities.length === 0 && !isLoading" class="empty-state">
          <span>{{ getEntityIcon(entityType) }}</span>
          <p>暂无{{ getEntityTypeName(entityType) }}数据</p>
        </div>
      </div>
    </div>
  `,
  setup() {
    const route = useRoute();
    const router = useRouter();
    const store = useMemoryStore();
    
    const entityType = computed(() => route.params.type);
    const entities = computed(() => store.entities);
    const isLoading = computed(() => store.isLoading);
    const searchQuery = computed(() => store.searchQuery);
    
    const getEntityIcon = (type: string) => {
      return ENTITY_TYPE_CONFIG[type]?.icon || '📂';
    };
    
    const getEntityTypeName = (type: string) => {
      return ENTITY_TYPE_CONFIG[type]?.name || type;
    };
    
    const handleEntityClick = (entity: any) => {
      if (entity.type === 'Topic') {
        router.push(`/topic/${entity.id}`);
      } else {
        console.log('点击实体:', entity);
      }
    };
    
    const formatTime = (timestamp: number) => {
      const now = Date.now();
      const diff = now - timestamp;
      const hours = Math.floor(diff / 3600000);
      const days = Math.floor(diff / 86400000);
      
      if (hours < 24) return `${hours}小时前`;
      if (days < 30) return `${days}天前`;
      return new Date(timestamp).toLocaleDateString();
    };
    
    watch(entityType, (newType) => {
      if (newType) {
        store.loadEntitiesByType(newType);
      }
    }, { immediate: true });
    
    return {
      entityType, entities, isLoading, searchQuery,
      getEntityIcon, getEntityTypeName, handleEntityClick, formatTime
    };
  }
});

const TopicDetailPage = defineComponent({
  template: `
    <div class="topic-detail">
      <div class="detail-header">
        <button class="back-btn" @click="goBack">
          <span>←</span>
          <span>返回主题列表</span>
        </button>
        <div v-if="topicData" class="topic-header">
          <div class="topic-avatar">💡</div>
          <div class="topic-info">
            <h2>{{ topicData.title }}</h2>
            <div class="topic-meta">
              <span class="meta-item">📈 {{ topicData.overview?.discussions || 0 }} 条讨论</span>
              <span class="meta-item">🔗 {{ topicData.overview?.projects || 0 }} 个关联项目</span>
              <span class="meta-item">👥 {{ topicData.overview?.participants || 0 }} 位参与者</span>
              <span class="meta-item">📚 {{ topicData.overview?.resources || 0 }} 个资源</span>
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
            <div v-for="project in topicData.relatedProjects" :key="project.id" class="item-card">
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
            <div v-for="resource in topicData.relatedResources" :key="resource.id" class="item-card">
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
                  {{ expandedConversations.has(conv.id) ? '🔼 收起上下文' : \`🔍 查看上下文 (\${conv.context?.length || 0} 条相关消息)\` }}
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
                  <div class="webpage-title">{{ webpage.title }}</div>
                  <div class="webpage-url">{{ webpage.url }}</div>
                  <div class="webpage-meta">
                    <span>访问时间：{{ webpage.visitTime }}</span>
                  </div>
                </div>
              </div>
              <div class="webpage-content">{{ webpage.summary }}</div>
              <div v-if="webpage.tags" class="webpage-tags">
                <span v-for="tag in webpage.tags" :key="tag" class="webpage-tag">{{ tag }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  setup() {
    const route = useRoute();
    const router = useRouter();
    const store = useMemoryStore();
    
    const topicId = computed(() => route.params.id);
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
      { key: 'conversations', label: '💬 聊天记录' },
      { key: 'webpages', label: '🌐 网页记录' }
    ];
    
    const filteredConversations = computed(() => {
      let filtered = topicData.value?.conversations || [];
      
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
    
    const filteredWebpages = computed(() => {
      let filtered = topicData.value?.webpages || [];
      
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
    
    return {
      topicId, topicData, isLoading, activeTab, tabs,
      convSearchQuery, convFilter, webSearchQuery, webTypeFilter, expandedConversations,
      filteredConversations, filteredWebpages,
      goBack, toggleConversationExpand, highlightText, getWebpageIcon
    };
  }
});

const PlaceholderPage = defineComponent({
  template: `
    <div class="loading-container">
      <div class="loading-spinner"></div>
      <span>{{ getPageMessage() }}</span>
    </div>
  `,
  setup() {
    const route = useRoute();
    
    const getPageMessage = () => {
      const routeName = route.name;
      switch (routeName) {
        case 'UserProfile':
          return '用户画像页面开发中...';
        case 'Search':
          return '搜索结果页面开发中...';
        default:
          return '页面开发中...';
      }
    };
    
    return { getPageMessage };
  }
});

// 路由配置
const routes = [
  { path: '/', name: 'Overview', component: OverviewPage },
  { path: '/timeline', name: 'Timeline', component: TimelinePage },
  { path: '/user-profile', name: 'UserProfile', component: PlaceholderPage },
  { path: '/entity/:type', name: 'EntityDetail', component: EntityDetailPage, props: true },
  { path: '/topic/:id', name: 'TopicDetail', component: TopicDetailPage, props: true },
  { path: '/search', name: 'Search', component: PlaceholderPage }
];

// 应用初始化逻辑
const store = useMemoryStore();
const router = useRouter();
const entityTypes = computed(() => store.entityTypes);
const searchQuery = ref('');

const handleSearchInput = () => {
  if (searchQuery.value.length > 2) {
    performSearch();
  }
};

const handleSearch = () => {
  if (searchQuery.value.trim()) {
    performSearch();
  }
};

const performSearch = () => {
  store.searchEntities(searchQuery.value);
  router.push({ 
    path: '/search', 
    query: { q: searchQuery.value } 
  });
};

const clearSearch = () => {
  searchQuery.value = '';
  store.searchQuery = '';
  router.push('/');
};

onMounted(() => {
  store.initialize();
});
</script>

<style>
/* 全局样式 */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: linear-gradient(135deg, #0c0c0c 0%, #1a1a2e 50%, #16213e 100%);
  color: #ffffff;
  overflow-x: hidden;
  min-height: 100vh;
}

.memory-container {
  display: flex;
  min-height: 100vh;
  font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: linear-gradient(135deg, #0c0c0c 0%, #1a1a2e 50%, #16213e 100%);
  color: #ffffff;
  overflow-x: hidden;
}

.main-content {
  flex: 1;
  padding: 2rem;
  overflow-y: auto;
}

/* 侧边栏样式 */
.sidebar {
  width: 280px;
  background: rgba(15, 23, 42, 0.8);
  backdrop-filter: blur(20px);
  border-right: 1px solid rgba(148, 163, 184, 0.1);
  padding: 2rem 0;
  transition: all 0.3s ease;
}

.sidebar-header {
  padding: 0 2rem 2rem;
  border-bottom: 1px solid rgba(148, 163, 184, 0.1);
}

.logo {
  font-size: 1.5rem;
  font-weight: 700;
  background: linear-gradient(135deg, #60a5fa, #a78bfa);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.entity-types {
  padding: 1.5rem 0;
}

.entity-type {
  display: flex;
  align-items: center;
  padding: 0.75rem 2rem;
  margin: 0.25rem 0;
  cursor: pointer;
  transition: all 0.3s ease;
  border-left: 3px solid transparent;
  text-decoration: none;
  color: inherit;
}

.entity-type:hover {
  background: rgba(59, 130, 246, 0.1);
  border-left-color: #60a5fa;
}

.entity-type.router-link-active {
  background: rgba(59, 130, 246, 0.2);
  border-left-color: #60a5fa;
}

.entity-icon {
  width: 1.5rem;
  height: 1.5rem;
  margin-right: 0.75rem;
  font-size: 1.2rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.entity-name {
  font-weight: 500;
  flex: 1;
}

.entity-count {
  background: rgba(59, 130, 246, 0.2);
  color: #60a5fa;
  padding: 0.25rem 0.5rem;
  border-radius: 0.75rem;
  font-size: 0.75rem;
  font-weight: 600;
}

.sidebar-divider {
  margin: 1rem 0;
  border: none;
  border-top: 1px solid rgba(148, 163, 184, 0.1);
}

/* 搜索头部样式 */
.search-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 2rem;
}

.search-box {
  flex: 1;
  position: relative;
}

.search-input {
  width: 100%;
  padding: 0.75rem 1rem 0.75rem 3rem;
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 0.75rem;
  color: #ffffff;
  font-size: 1rem;
  transition: all 0.3s ease;
}

.search-input:focus {
  outline: none;
  border-color: #60a5fa;
  box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.1);
}

.search-input::placeholder {
  color: #64748b;
}

.search-icon {
  position: absolute;
  left: 1rem;
  top: 50%;
  transform: translateY(-50%);
  color: #64748b;
}

.filter-btn {
  padding: 0.75rem 1.5rem;
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.3);
  border-radius: 0.75rem;
  color: #60a5fa;
  cursor: pointer;
  transition: all 0.3s ease;
  white-space: nowrap;
  border: none;
}

.filter-btn:hover {
  background: rgba(59, 130, 246, 0.2);
}

/* 页面过渡动画 */
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from, .fade-leave-to {
  opacity: 0;
}

/* 概览样式 */
.overview-section {
  animation: fadeInUp 0.6s ease-out;
}

.greeting-card {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(147, 51, 234, 0.1));
  border: 1px solid rgba(59, 130, 246, 0.2);
  border-radius: 1rem;
  padding: 2rem;
  margin-bottom: 2rem;
  backdrop-filter: blur(10px);
}

.greeting-title {
  font-size: 1.5rem;
  font-weight: 600;
  margin-bottom: 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.greeting-content {
  color: #cbd5e1;
  line-height: 1.6;
}

.quick-summary {
  list-style: none;
  margin: 1rem 0;
}

.quick-summary li {
  padding: 0.5rem 0;
  border-left: 3px solid #60a5fa;
  padding-left: 1rem;
  margin: 0.5rem 0;
}

/* 内容网格 */
.content-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.content-card {
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid rgba(148, 163, 184, 0.1);
  border-radius: 1rem;
  padding: 1.5rem;
  transition: all 0.3s ease;
  backdrop-filter: blur(10px);
  cursor: pointer;
}

.content-card:hover {
  transform: translateY(-2px);
  border-color: rgba(59, 130, 246, 0.3);
  box-shadow: 0 8px 32px rgba(59, 130, 246, 0.1);
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.card-title {
  font-size: 1.1rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.card-badge {
  background: rgba(59, 130, 246, 0.2);
  color: #60a5fa;
  padding: 0.25rem 0.75rem;
  border-radius: 1rem;
  font-size: 0.75rem;
  font-weight: 500;
}

.card-content {
  color: #cbd5e1;
  line-height: 1.5;
  margin-bottom: 1rem;
}

.info-list {
  list-style: none;
}

.info-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0;
  border-bottom: 1px solid rgba(148, 163, 184, 0.1);
  transition: all 0.3s ease;
}

.info-item:hover {
  background: rgba(59, 130, 246, 0.05);
  border-radius: 0.5rem;
  padding-left: 0.5rem;
}

.info-item:last-child {
  border-bottom: none;
}

.info-time {
  color: #64748b;
  font-size: 0.875rem;
  margin-left: auto;
}

.view-more-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  color: #60a5fa;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
}

.view-more-btn:hover {
  color: #93c5fd;
}

/* 加载动画 */
.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  color: #94a3b8;
}

.loading-spinner {
  width: 2rem;
  height: 2rem;
  border: 2px solid rgba(96, 165, 250, 0.3);
  border-top: 2px solid #60a5fa;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 1rem;
}

/* 时间轴样式 */
.timeline-view {
  animation: fadeInUp 0.6s ease-out;
}

.timeline-container {
  position: relative;
}

.timeline-item {
  display: flex;
  gap: 1rem;
  margin-bottom: 1.5rem;
  position: relative;
}

.timeline-item:not(:last-child)::before {
  content: '';
  position: absolute;
  left: 1.25rem;
  top: 3rem;
  width: 2px;
  height: calc(100% + 1rem);
  background: linear-gradient(to bottom, #60a5fa, rgba(96, 165, 250, 0.3));
}

.timeline-dot {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 50%;
  background: linear-gradient(135deg, #60a5fa, #a78bfa);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  color: white;
  flex-shrink: 0;
  z-index: 1;
}

.timeline-content {
  flex: 1;
}

.timeline-time {
  color: #64748b;
  font-size: 0.875rem;
  margin-bottom: 0.5rem;
}

.event-source {
  color: #94a3b8;
  font-size: 0.75rem;
  margin-top: 0.5rem;
}

/* 实体详情样式 */
.entity-detail {
  animation: fadeInUp 0.6s ease-out;
}

.entity-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid rgba(148, 163, 184, 0.1);
}

.entity-avatar {
  width: 3rem;
  height: 3rem;
  border-radius: 50%;
  background: linear-gradient(135deg, #60a5fa, #a78bfa);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
}

.entity-info h2 {
  font-size: 1.75rem;
  font-weight: 600;
  margin-bottom: 0.25rem;
}

.entity-meta {
  color: #64748b;
  font-size: 1rem;
}

/* 实体网格样式 */
.entities-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 1rem;
}

.entity-card {
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid rgba(148, 163, 184, 0.1);
  border-radius: 0.75rem;
  padding: 1rem;
  transition: all 0.3s ease;
  cursor: pointer;
}

.entity-card:hover {
  border-color: rgba(59, 130, 246, 0.3);
  transform: translateY(-2px);
}

.entity-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}

.entity-card-title {
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1.1rem;
}

.importance-indicator {
  width: 60px;
  height: 4px;
  background: rgba(148, 163, 184, 0.2);
  border-radius: 2px;
  overflow: hidden;
}

.importance-bar {
  height: 100%;
  background: linear-gradient(90deg, #60a5fa, #a78bfa);
  transition: width 0.3s ease;
}

.entity-description {
  color: #cbd5e1;
  font-size: 0.875rem;
  line-height: 1.5;
  margin-bottom: 0.75rem;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.entity-stats {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.75rem;
  color: #94a3b8;
}

.entity-tags {
  display: flex;
  gap: 0.25rem;
  flex-wrap: wrap;
  margin-bottom: 0.75rem;
}

.entity-tag {
  padding: 0.125rem 0.375rem;
  background: rgba(59, 130, 246, 0.2);
  color: #60a5fa;
  border-radius: 0.25rem;
  font-size: 0.625rem;
}

.entity-tag.more-tags {
  background: rgba(148, 163, 184, 0.2);
  color: #94a3b8;
}

.entity-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.75rem;
  color: #64748b;
}

.last-accessed {
  color: #64748b;
}

.status-indicator {
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
  font-size: 0.625rem;
  font-weight: 500;
}

.status-indicator.active {
  background: rgba(34, 197, 94, 0.2);
  color: #22c55e;
}

.status-indicator.inactive {
  background: rgba(148, 163, 184, 0.2);
  color: #94a3b8;
}

/* 主题详情样式 */
.topic-detail {
  animation: fadeInUp 0.6s ease-out;
}

.detail-header {
  margin-bottom: 2rem;
}

.back-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.3);
  border-radius: 0.5rem;
  padding: 0.75rem 1.5rem;
  color: #60a5fa;
  cursor: pointer;
  transition: all 0.3s ease;
  margin-bottom: 1.5rem;
}

.back-btn:hover {
  background: rgba(59, 130, 246, 0.2);
}

.topic-header {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid rgba(148, 163, 184, 0.1);
  border-radius: 1rem;
  padding: 2rem;
  backdrop-filter: blur(10px);
}

.topic-avatar {
  width: 4rem;
  height: 4rem;
  border-radius: 1rem;
  background: linear-gradient(135deg, #60a5fa, #a78bfa);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
  flex-shrink: 0;
}

.topic-info {
  flex: 1;
}

.topic-info h2 {
  font-size: 1.75rem;
  font-weight: 600;
  margin-bottom: 0.75rem;
}

.topic-meta {
  display: flex;
  gap: 1.5rem;
  flex-wrap: wrap;
}

.meta-item {
  color: #94a3b8;
  font-size: 0.875rem;
}

.topic-actions {
  display: flex;
  gap: 0.75rem;
}

.action-btn {
  padding: 0.75rem 1.5rem;
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.3);
  border-radius: 0.5rem;
  color: #60a5fa;
  cursor: pointer;
  transition: all 0.3s ease;
  white-space: nowrap;
}

.action-btn:hover {
  background: rgba(59, 130, 246, 0.2);
}

/* 选项卡样式 */
.tab-navigation {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 2rem;
  border-bottom: 1px solid rgba(148, 163, 184, 0.1);
  padding-bottom: 1rem;
  overflow-x: auto;
}

.tab-btn {
  padding: 0.75rem 1.5rem;
  background: transparent;
  border: none;
  border-radius: 0.5rem;
  color: #94a3b8;
  cursor: pointer;
  transition: all 0.3s ease;
  white-space: nowrap;
  font-size: 0.875rem;
}

.tab-btn.active {
  background: rgba(59, 130, 246, 0.2);
  color: #60a5fa;
}

.tab-btn:hover:not(.active) {
  background: rgba(59, 130, 246, 0.1);
  color: #93c5fd;
}

.tab-content {
  display: block;
  animation: fadeInUp 0.4s ease-out;
}

/* 列表项样式 */
.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5rem;
}

.section-header h3 {
  font-size: 1.25rem;
  font-weight: 600;
}

.add-btn {
  padding: 0.75rem 1.5rem;
  background: rgba(34, 197, 94, 0.1);
  border: 1px solid rgba(34, 197, 94, 0.3);
  border-radius: 0.5rem;
  color: #22c55e;
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: 1rem;
}

.add-btn:hover {
  background: rgba(34, 197, 94, 0.2);
}

.items-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 1rem;
}

.item-card {
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid rgba(148, 163, 184, 0.1);
  border-radius: 0.75rem;
  padding: 1rem;
  transition: all 0.3s ease;
  cursor: pointer;
}

.item-card:hover {
  border-color: rgba(59, 130, 246, 0.3);
  transform: translateY(-2px);
}

.item-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}

.item-title {
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1.1rem;
}

.item-actions {
  display: flex;
  gap: 0.25rem;
}

.item-action {
  padding: 0.25rem;
  background: transparent;
  border: none;
  border-radius: 0.25rem;
  color: #94a3b8;
  cursor: pointer;
  transition: all 0.3s ease;
}

.item-action:hover {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.item-content {
  color: #cbd5e1;
  font-size: 1rem;
  line-height: 1.5;
}

/* 搜索控件 */
.search-controls {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.filter-select {
  padding: 0.5rem;
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 0.5rem;
  color: #ffffff;
  min-width: 120px;
  font-size: 0.875rem;
}

/* 聊天记录样式 */
.conversations-list {
  margin-bottom: 2rem;
}

.conversation-item {
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid rgba(148, 163, 184, 0.1);
  border-radius: 0.75rem;
  padding: 1rem;
  margin-bottom: 1rem;
  position: relative;
  cursor: pointer;
  transition: all 0.3s ease;
}

.conversation-item:hover {
  border-color: rgba(59, 130, 246, 0.3);
}

.conversation-item.expanded {
  cursor: default;
}

.conversation-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}

.conversation-meta {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.sender-avatar {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 50%;
  background: linear-gradient(135deg, #60a5fa, #a78bfa);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
}

.sender-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.sender-name {
  font-weight: 600;
  font-size: 1rem;
}

.group-name {
  font-size: 0.875rem;
  color: #94a3b8;
}

.conversation-time {
  font-size: 0.875rem;
  color: #64748b;
}

.conversation-summary {
  color: #cbd5e1;
  line-height: 1.5;
  margin-bottom: 0.5rem;
  font-size: 1rem;
}

.context-indicator {
  margin-top: 0.75rem;
  padding: 0.5rem 0.75rem;
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.3);
  border-radius: 0.5rem;
  cursor: pointer;
  transition: all 0.3s ease;
  user-select: none;
}

.context-indicator:hover {
  background: rgba(59, 130, 246, 0.2);
  border-color: rgba(59, 130, 246, 0.5);
}

.context-indicator.expanded {
  background: rgba(59, 130, 246, 0.2);
  border-color: rgba(59, 130, 246, 0.4);
}

.indicator-text {
  font-size: 0.875rem;
  color: #60a5fa;
  font-weight: 500;
}

.context-content {
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.3s ease;
}

.context-content.expanded {
  max-height: 500px;
  overflow-y: auto;
}

.context-divider {
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(148, 163, 184, 0.3), transparent);
  margin: 1rem 0;
}

.context-item {
  background: rgba(30, 41, 59, 0.4);
  border: 1px solid rgba(148, 163, 184, 0.1);
  border-radius: 0.5rem;
  padding: 0.75rem;
  margin-bottom: 0.5rem;
  transition: all 0.3s ease;
}

.context-item:last-child {
  margin-bottom: 0;
}

.context-item.main-message {
  border-color: rgba(34, 197, 94, 0.3);
  background: rgba(34, 197, 94, 0.1);
}

.context-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.context-sender {
  font-weight: 600;
  font-size: 0.875rem;
  color: #e2e8f0;
}

.context-time {
  font-size: 0.75rem;
  color: #94a3b8;
}

.context-content-text {
  color: #cbd5e1;
  line-height: 1.5;
  font-size: 0.875rem;
}

/* 网页记录样式 */
.webpages-list {
  margin-bottom: 2rem;
}

.webpage-item {
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid rgba(148, 163, 184, 0.1);
  border-radius: 0.75rem;
  padding: 1rem;
  margin-bottom: 1rem;
  transition: all 0.3s ease;
}

.webpage-item:hover {
  border-color: rgba(59, 130, 246, 0.3);
  transform: translateY(-1px);
}

.webpage-header {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 0.75rem;
}

.webpage-icon {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 0.5rem;
  background: linear-gradient(135deg, #60a5fa, #a78bfa);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  flex-shrink: 0;
}

.webpage-info {
  flex: 1;
  min-width: 0;
}

.webpage-title {
  font-weight: 600;
  margin-bottom: 0.25rem;
  font-size: 1.1rem;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.webpage-url {
  font-size: 0.875rem;
  color: #60a5fa;
  margin-bottom: 0.5rem;
  word-break: break-all;
}

.webpage-meta {
  display: flex;
  gap: 1rem;
  font-size: 0.875rem;
  color: #94a3b8;
}

.webpage-content {
  color: #cbd5e1;
  font-size: 1rem;
  line-height: 1.5;
  margin-bottom: 0.75rem;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.webpage-tags {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.webpage-tag {
  padding: 0.25rem 0.5rem;
  background: rgba(59, 130, 246, 0.2);
  color: #60a5fa;
  border-radius: 0.25rem;
  font-size: 0.875rem;
}

/* 空状态 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  color: #94a3b8;
  text-align: center;
}

.empty-state span {
  font-size: 3rem;
  margin-bottom: 1rem;
}

/* 动画 */
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* 响应式设计 */
@media (max-width: 768px) {
  .memory-container {
    flex-direction: column;
  }

  .sidebar {
    width: 100%;
    height: auto;
    position: static;
  }

  .main-content {
    padding: 1rem;
  }

  .content-grid,
  .entities-grid {
    grid-template-columns: 1fr;
  }

  .search-header {
    flex-direction: column;
    gap: 0.5rem;
  }

  .search-box {
    width: 100%;
  }

  .topic-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }

  .topic-actions {
    width: 100%;
    justify-content: stretch;
  }

  .action-btn {
    flex: 1;
  }

  .tab-navigation {
    overflow-x: auto;
  }
}
</style>