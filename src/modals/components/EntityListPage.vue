<template>
  <div class="entity-list">
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

    <!-- 过滤控件 -->
    <div v-if="!isLoading && entities.length > 0" class="filter-controls">
      <!-- 主题视图切换 -->
      <div v-if="entityType === 'Topic'" class="view-control">
        <button 
          :class="['view-toggle-btn', { active: topicViewMode === 'unread' }]"
          @click="topicViewMode = 'unread'"
        >
          🔴 仅未读
        </button>
        <button 
          :class="['view-toggle-btn', { active: topicViewMode === 'all' }]"
          @click="topicViewMode = 'all'"
        >
          📋 全部主题
        </button>
      </div>
      
      <!-- 排序选择 -->
      <div v-if="entityType === 'Topic'" class="filter-select-wrapper">
        <select class="filter-select" v-model="topicSortMode">
          <option value="time">最新消息排序</option>
          <option value="importance">热度排序</option>
          <option value="unread-count">未读数量排序</option>
        </select>
      </div>
      
      <div v-if="entityType === 'Person' || entityType === 'Project'" class="filter-select-wrapper">
        <select class="filter-select" v-model="selectedFilter">
          <option value="all">全部{{ getEntityTypeName(entityType) }}</option>
          <option v-if="entityType === 'Person'" value="recent_contact">最近联系</option>
          <option v-if="entityType === 'Person'" value="frequent_collaboration">频繁协作</option>
          <option v-if="entityType === 'Project'" value="highlighted">重点项目</option>
          <option v-if="entityType === 'Project'" value="active">活跃项目</option>
        </select>
      </div>
      <div class="results-count">
        <span v-if="searchQuery">搜索结果：</span>
        显示 {{ filteredEntities.length }} / {{ entities.length }} 项
      </div>
    </div>

    <div v-if="isLoading" class="loading-container">
      <div class="loading-spinner"></div>
      <span>加载实体数据...</span>
    </div>

    <div v-else class="entities-grid">
      <!-- Topic类型实体卡片 - 带预览 -->
      <template v-if="entityType === 'Topic'">
        <div 
          v-for="entity in filteredEntities" 
          :key="entity.id" 
          class="content-card topic-card"
          :class="{ unread: !entity.readStatus?.isRead }"
          :data-topic-id="entity.id"
          style="position: relative;"
          @click="handleEntityClick(entity)"
        >
        <!-- "阅"按钮 - 仅未读主题显示 -->
        <button 
          v-if="!entity.readStatus?.isRead" 
          class="mark-read-btn" 
          @click.stop="handleMarkTopicAsRead(entity.id)"
        >
          阅
        </button>
        <div class="card-header topic-card-header">
          <div class="card-title">
            <span>💡</span>
            <span>{{ entity.name }}</span>
            <span v-if="entity.readStatus && !entity.readStatus.isRead" class="unread-badge">
              {{ entity.readStatus.unreadCount }}条未读
            </span>
          </div>
          <div class="card-badge topic-card-badge">
            {{ entity.statistic?.conversations || 0 }} 讨论
          </div>
        </div>
        
        <div v-if="entity.description" class="card-content">
          {{ entity.description }}
        </div>
        
        <div class="card-content" style="font-size: 0.875rem; color: #94a3b8;">
          {{ entity.importance >= 0.8 ? '🔥 热度' + Math.round(entity.importance * 5) + '/5' : '' }}
          {{ entity.statistic?.conversations || 0 }}条讨论 • {{ formatTime(entity.updated || Date.now()) }}
        </div>
        
        <!-- 未读讨论预览 -->
        <div v-if="entity.unreadDiscussions && entity.unreadDiscussions.length > 0" class="unread-discussions">
          <div class="unread-discussions-title">
            💬 未读讨论 ({{ entity.unreadDiscussions.length }}条)
          </div>
          <div 
            v-for="(discussion, idx) in entity.unreadDiscussions.slice(0, 3)" 
            :key="idx"
            class="discussion-item"
          >
            <span class="discussion-icon">▪</span>
            <div class="discussion-text">{{ discussion.text }}</div>
          </div>
          <div 
            v-if="entity.unreadDiscussions.length > 3" 
            style="text-align: center; color: #60a5fa; font-size: 0.75rem; margin-top: 0.5rem;"
          >
            还有 {{ entity.unreadDiscussions.length - 3 }} 条讨论...
          </div>
        </div>
        
        <!-- 相关资源预览 -->
        <div v-if="entity.recentDataDetails?.resources && entity.recentDataDetails.resources.length > 0" class="topic-preview-section">
          <h4 class="preview-section-title">📚 相关资源</h4>
          <ul class="preview-list">
            <li 
              v-for="resource in entity.recentDataDetails.resources.slice(0, 2)" 
              :key="resource.id"
              class="preview-item resource-item"
              @click.stop="openResource(resource)"
            >
              <span>📖</span>
              <span class="preview-content">{{ resource.name }}</span>
            </li>
          </ul>
        </div>
        
        <!-- 关联项目预览 -->
        <div v-if="entity.recentDataDetails?.projects && entity.recentDataDetails.projects.length > 0" class="topic-preview-section">
          <h4 class="preview-section-title">🚀 关联项目</h4>
          <ul class="preview-list">
            <li 
              v-for="project in entity.recentDataDetails.projects.slice(0, 2)" 
              :key="project.id"
              class="preview-item project-item"
              @click.stop="navigateToProject(project.id)"
            >
              <span>🚀</span>
              <span class="preview-content">{{ project.name }}</span>
              <span class="project-status">{{ project.status }}</span>
            </li>
          </ul>
        </div>
        
        <div class="entity-footer">
          <span class="last-accessed">
            最后更新: {{ formatTime(entity.updated || Date.now()) }}
          </span>
        </div>
      </div>
      
      </template>
      
      <!-- Person类型实体卡片 - 带人物预览 -->
      <template v-else-if="entityType === 'Person'">
        <div 
          v-for="entity in filteredEntities" 
          :key="entity.id" 
          class="entity-card person-card"
          @click="handlePersonClick(entity)"
        >
        <div class="entity-card-header person-card-header">
          <div class="entity-card-title">
            <span>👤</span>
            <span>{{ entity.name }}</span>
          </div>
          <div class="person-card-badge">
            {{ entity.role || '团队成员' }}
          </div>
        </div>
        
        <div v-if="entity.description" class="entity-description">
          {{ entity.description }}
        </div>
        
        <!-- 最近协作预览 -->
        <div v-if="entity.recentCollaborations && entity.recentCollaborations.length > 0" class="person-preview-section">
          <h4 class="preview-section-title">🤝 最近协作</h4>
          <ul class="preview-list">
            <li 
              v-for="collaboration in entity.recentCollaborations.slice(0, 2)" 
              :key="collaboration.id"
              class="preview-item collaboration-item"
              @click.stop="navigateToProject(collaboration.projectId)"
            >
              <span>🚀</span>
              <span class="preview-content">{{ collaboration.projectName }}</span>
              <span class="preview-time">{{ collaboration.time }}</span>
            </li>
          </ul>
        </div>
        
        <!-- 专业技能预览 -->
        <div v-if="entity.expertise && entity.expertise.length > 0" class="person-preview-section">
          <h4 class="preview-section-title">🎯 专业技能</h4>
          <div class="expertise-tags">
            <span 
              v-for="skill in entity.expertise.slice(0, 4)" 
              :key="skill"
              class="expertise-tag"
            >
              {{ skill }}
            </span>
          </div>
        </div>
        
        <!-- 最近消息预览 -->
        <div v-if="entity.recentMessages && entity.recentMessages.length > 0" class="person-preview-section">
          <h4 class="preview-section-title">💬 最近消息</h4>
          <ul class="preview-list">
            <li 
              v-for="message in entity.recentMessages.slice(0, 2)" 
              :key="message.id"
              class="preview-item message-item"
              @click.stop="navigateToPersonMessage(entity.id, message.id)"
            >
              <span>💭</span>
              <span class="preview-content">{{ message.summary }}</span>
              <span class="preview-time">{{ message.time }}</span>
            </li>
          </ul>
        </div>
        
        <div class="entity-footer">
          <span class="last-accessed">
            最后联系: {{ formatTime(entity.lastContact || Date.now()) }}
          </span>
          <span v-if="entity.team" class="team-indicator">
            {{ entity.team }}
          </span>
        </div>
      </div>
      </template>
      
      <!-- Project类型实体卡片 - 带项目操作 -->
      <template v-else-if="entityType === 'Project'">
        <div 
          v-for="entity in filteredEntities" 
          :key="entity.id" 
          class="entity-card project-card"
          @click="handleEntityClick(entity)"
        >
        <div class="entity-card-header">
          <div class="entity-card-title">
            <span>🚀</span>
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
        
        <!-- 项目特有操作按钮 -->
        <div class="project-actions">
          <button 
            class="project-action-btn highlight"
            @click.stop="handleMarkAsHighlightProject(entity)"
            :class="{ active: entity.isHighlighted }"
            title="标记为重点项目"
          >
            ⭐ {{ entity.isHighlighted ? '已标记' : '重点项目' }}
          </button>
          <button 
            class="project-action-btn dashboard"
            @click.stop="openProjectDashboard(entity)"
            title="打开项目仪表盘"
          >
            📊 仪表盘
          </button>
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
      </template>
      
      <!-- 其他类型实体卡片 - 原始布局 -->
      <template v-else>
        <div 
          v-for="entity in filteredEntities" 
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
      </template>
      
      <div v-if="filteredEntities.length === 0 && !isLoading" class="empty-state">
        <span>{{ getEntityIcon(entityType) }}</span>
        <p v-if="entities.length === 0">暂无{{ getEntityTypeName(entityType) }}数据</p>
        <p v-else-if="entityType === 'Topic' && topicViewMode === 'unread'">
          ✅ 太棒了！所有主题都已阅读完毕
          <br><br>
          <button class="view-toggle-btn" @click="topicViewMode = 'all'" style="margin-top: 1rem;">
            查看所有主题
          </button>
        </p>
        <p v-else>没有找到匹配的{{ getEntityTypeName(entityType) }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, watch, ref, toRaw } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useMemoryStore, ENTITY_TYPE_CONFIG, chromeAPI } from '../memory-store';

const route = useRoute();
const router = useRouter();
const store = useMemoryStore();

const entityType = computed(() => route.params.type as string);
const entities = computed(() => store.entities);
const isLoading = computed(() => store.isLoading);
const searchQuery = computed(() => store.searchQuery);

// 本地过滤状态
const selectedFilter = ref('all');
const topicViewMode = ref('unread'); // 'unread' | 'all'
const topicSortMode = ref('time'); // 'time' | 'importance' | 'unread-count'

// 过滤后的实体列表
const filteredEntities = computed(() => {
  let filtered = [...entities.value];
  
  // 主题未读过滤
  if (entityType.value === 'Topic' && topicViewMode.value === 'unread') {
    filtered = filtered.filter(entity => 
      !entity.readStatus?.isRead || entity.readStatus?.unreadCount > 0
    );
  }
  
  // 文本搜索过滤（使用顶部搜索框的搜索词）
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase();
    filtered = filtered.filter(entity => 
      entity.name.toLowerCase().includes(query) ||
      (entity.description && entity.description.toLowerCase().includes(query)) ||
      (entity.tags && entity.tags.some(tag => tag.toLowerCase().includes(query)))
    );
  }
  
  // 主题排序
  if (entityType.value === 'Topic') {
    switch(topicSortMode.value) {
      case 'time':
        // 按最新消息时间排序
        filtered.sort((a, b) => {
          const timeA = a.readStatus?.lastUpdateTime || a.updated || 0;
          const timeB = b.readStatus?.lastUpdateTime || b.updated || 0;
          return timeB - timeA;
        });
        break;
      case 'importance':
        // 按热度排序
        filtered.sort((a, b) => {
          const scoreA = (a.importance || 0.5) + ((a.statistic?.conversations || 0) / 20);
          const scoreB = (b.importance || 0.5) + ((b.statistic?.conversations || 0) / 20);
          return scoreB - scoreA;
        });
        break;
      case 'unread-count':
        // 按未读数量排序
        filtered.sort((a, b) => {
          const countA = a.readStatus?.unreadCount || 0;
          const countB = b.readStatus?.unreadCount || 0;
          return countB - countA;
        });
        break;
    }
    return filtered;
  }
  
  // 其他类型的分类过滤
  if (selectedFilter.value !== 'all') {
    switch (selectedFilter.value) {
        
      case 'recent_contact':
        // Person: 最近联系
        filtered = filtered.filter(entity => 
          entity.lastContact && Date.now() - entity.lastContact < 604800000 // 7天内
        );
        break;
        
      case 'frequent_collaboration':
        // Person: 频繁协作
        filtered = filtered.filter(entity => 
          entity.recentCollaborations && entity.recentCollaborations.length >= 2
        );
        break;
        
      case 'highlighted':
        // Project: 重点项目
        filtered = filtered.filter(entity => entity.isHighlighted);
        break;
        
      case 'active':
        // Project: 活跃项目
        filtered = filtered.filter(entity => 
          entity.status === 'active' && 
          entity.lastAccessed && Date.now() - entity.lastAccessed < 604800000 // 7天内
        );
        break;
    }
  }
  
  return filtered;
});

const getEntityIcon = (type: string) => {
  return ENTITY_TYPE_CONFIG[type]?.icon || '📂';
};

const getEntityTypeName = (type: string) => {
  return ENTITY_TYPE_CONFIG[type]?.name || type;
};

const handleEntityClick = (entity: any) => {
  if (entity.type === 'Topic') {
    router.push(`/topic/${entity.id}`);
  } else if (entity.type === 'Person') {
    router.push(`/person/${entity.id}`);
  } else {
    console.log('点击实体:', entity);
  }
};

const handlePersonClick = (entity: any) => {
  router.push(`/person/${entity.id}`);
};

const navigateToPersonMessage = (personId: string, messageId: string) => {
  router.push(`/person/${personId}?messageId=${messageId}`);
};

const navigateToTopicDiscussion = (topicId: string, messageId: string) => {
  router.push(`/topic/${topicId}?messageId=${messageId}`);
};

const openResource = (resource: any) => {
  if (resource.url && resource.url !== '#') {
    window.open(resource.url, '_blank');
  } else {
    console.log('打开资源:', resource);
  }
};

const navigateToProject = (projectId: string) => {
  router.push(`/project/${projectId}`);
};

const handleMarkAsHighlightProject = async (entity: any) => {
  try {
    // 通过Chrome API获取现有的重点项目列表
    const response = await chromeAPI.sendMessage({ 
      type: 'GET_HIGHLIGHT_PROJECTS' 
    });
    
    const highlightProjects = response?.data || [];
    const isAlreadyHighlighted = highlightProjects.some((p: any) => p.id === entity.id);
    
    if (isAlreadyHighlighted) {
      // 移除重点标记
      await chromeAPI.sendMessage({
        type: 'REMOVE_HIGHLIGHT_PROJECT',
        projectId: entity.id
      });
      entity.isHighlighted = false;
      console.log(`已移除重点项目标记: ${entity.name}`);
    } else {
      // 添加重点标记
      // 使用 toRaw 确保传递的是原始对象
      const rawEntity = toRaw(entity);
      await chromeAPI.sendMessage({
        type: 'ADD_HIGHLIGHT_PROJECT',
        project: {
          id: rawEntity.id,
          name: rawEntity.name,
          type: rawEntity.type,
          description: rawEntity.description,
          addedAt: Date.now()
        }
      });
      entity.isHighlighted = true;
      console.log(`已标记为重点项目: ${entity.name}`);
    }
  } catch (error) {
    console.error('标记重点项目失败:', error);
    alert('操作失败，请稍后重试');
  }
};

const openProjectDashboard = async (entity: any) => {
  try {
    // 先确保项目在重点项目列表中
    const response = await chromeAPI.sendMessage({ 
      type: 'GET_HIGHLIGHT_PROJECTS' 
    });
    
    const highlightProjects = response?.data || [];
    const isHighlighted = highlightProjects.some((p: any) => p.id === entity.id);
    
    if (!isHighlighted) {
      // 如果不在重点项目中，询问是否添加
      const shouldAdd = confirm(`"${entity.name}" 不在重点项目列表中，是否添加并打开仪表盘？`);
      if (shouldAdd) {
        await handleMarkAsHighlightProject(entity);
      }
    }
    
    // 通过Chrome API打开项目仪表盘
    await chromeAPI.sendMessage({
      type: 'OPEN_PROJECT_DASHBOARD',
      projectId: entity.id,
      projectName: entity.name
    });
    
  } catch (error) {
    console.error('打开项目仪表盘失败:', error);
    alert('打开项目仪表盘失败，请稍后重试');
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

const handleMarkTopicAsRead = async (topicId: string) => {
  // 找到对应的DOM元素
  const cardElement = document.querySelector(`[data-topic-id="${topicId}"]`) as HTMLElement;
  
  if (cardElement) {
    // 添加淡出动画class
    cardElement.classList.add('fade-out');
    
    // 等待动画完成(300ms)后再标记已读
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // 标记已读(这会触发Vue的响应式更新)
    await store.markTopicAsRead(topicId);
  } else {
    // 如果找不到元素,直接标记已读
    await store.markTopicAsRead(topicId);
  }
};

watch(entityType, (newType) => {
  if (newType) {
    store.loadEntitiesByType(newType);
  }
}, { immediate: true });
</script>

<style scoped>
/* "阅"字按钮样式 */
.mark-read-btn {
  position: absolute;
  bottom: 1rem;
  right: 1rem;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 50%;
  background: linear-gradient(135deg, rgba(34, 197, 94, 0.2), rgba(16, 185, 129, 0.2));
  border: 2px solid rgba(34, 197, 94, 0.4);
  color: #22c55e;
  font-weight: 700;
  font-size: 0.875rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
  opacity: 0;
  box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.4);
  z-index: 10;
}

.content-card:hover .mark-read-btn,
.topic-card:hover .mark-read-btn {
  opacity: 1;
}

.mark-read-btn:hover {
  background: linear-gradient(135deg, rgba(34, 197, 94, 0.3), rgba(16, 185, 129, 0.3));
  border-color: #22c55e;
  transform: scale(1.1);
  box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.2);
}

.mark-read-btn:active {
  transform: scale(0.95);
}

/* 未读徽章 */
.unread-badge {
  background: linear-gradient(135deg, #ef4444, #dc2626);
  color: #ffffff;
  padding: 0.25rem 0.5rem;
  border-radius: 0.75rem;
  font-size: 0.75rem;
  font-weight: 700;
  box-shadow: 0 0 10px rgba(239, 68, 68, 0.3);
  animation: pulse 2s infinite;
  margin-left: 0.5rem;
}

@keyframes pulse {
  0%, 100% { box-shadow: 0 0 10px rgba(239, 68, 68, 0.3); }
  50% { box-shadow: 0 0 20px rgba(239, 68, 68, 0.6); }
}

/* 主题卡片未读状态 */
.content-card.unread,
.topic-card.unread {
  border-left: 3px solid #ef4444;
  background: rgba(239, 68, 68, 0.05);
}

/* 未读讨论列表样式 */
.unread-discussions {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid rgba(148, 163, 184, 0.1);
}

.unread-discussions-title {
  font-size: 0.75rem;
  color: #94a3b8;
  margin-bottom: 0.5rem;
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.discussion-item {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.5rem;
  margin: 0.25rem 0;
  background: rgba(59, 130, 246, 0.05);
  border-left: 2px solid rgba(59, 130, 246, 0.3);
  border-radius: 0.25rem;
  font-size: 0.8rem;
  line-height: 1.4;
  color: #cbd5e1;
  transition: all 0.2s ease;
}

.discussion-item:hover {
  background: rgba(59, 130, 246, 0.1);
  border-left-color: #60a5fa;
}

.discussion-icon {
  color: #60a5fa;
  flex-shrink: 0;
}

.discussion-text {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

/* 视图切换控制 */
.view-control {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.view-toggle-btn {
  padding: 0.5rem 1rem;
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 0.5rem;
  color: #94a3b8;
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: 0.875rem;
}

.view-toggle-btn.active {
  background: rgba(59, 130, 246, 0.2);
  border-color: rgba(59, 130, 246, 0.3);
  color: #60a5fa;
}

.view-toggle-btn:hover:not(.active) {
  background: rgba(59, 130, 246, 0.1);
}

/* 淡出动画 */
.fade-out {
  animation: fadeOutCard 0.3s ease forwards;
}

@keyframes fadeOutCard {
  from {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
  to {
    opacity: 0;
    transform: translateY(-10px) scale(0.95);
  }
}
</style>
