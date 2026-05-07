<template>
  <div class="search-results-section">
    <div class="search-header">
      <h2>🔍 搜索结果</h2>
      <p v-if="searchQuery">关键词: "{{ searchQuery }}"</p>
      <p class="scope-caption">范围: {{ currentScopeLabel }}</p>
    </div>
    
    <!-- AI 智能回答区域（仅 overview 模式显示） -->
    <div v-if="searchContext.mode === 'overview' && searchContext.askResult" class="ai-answer-section">
      <div class="ai-answer-header" @click="toggleAiAnswer">
        <div class="header-left">
          <span class="ai-icon">🤖</span>
          <h3>AI 智能分析</h3>
        </div>
        <button class="toggle-btn">
          {{ isAiAnswerExpanded ? '收起 ▲' : '展开 ▼' }}
        </button>
      </div>
      
      <div v-show="isAiAnswerExpanded" class="ai-answer-content">
        <!-- 主要回答（支持 Markdown 渲染） -->
        <div class="answer-main" v-html="renderedAnswer"></div>
        
        <!-- 结构化信息（如果有） -->
        <div v-if="searchContext.askResult.structuredAnswer" class="answer-structured">
          <!-- 关键发现 -->
          <div v-if="searchContext.askResult.structuredAnswer.keyFindings?.length" class="findings-section">
            <h4>🔍 关键发现</h4>
            <ul>
              <li v-for="(finding, idx) in searchContext.askResult.structuredAnswer.keyFindings" :key="idx">
                {{ finding }}
              </li>
            </ul>
          </div>
          
          <!-- 时间线 -->
          <div v-if="searchContext.askResult.structuredAnswer.timeline?.length" class="timeline-section">
            <h4>⏰ 时间线</h4>
            <div class="timeline-items">
              <div v-for="(item, idx) in searchContext.askResult.structuredAnswer.timeline" :key="idx" class="timeline-item">
                <span class="timeline-date">{{ item.date }}</span>
                <span class="timeline-event">{{ item.event }}</span>
              </div>
            </div>
          </div>
          
          <!-- 深度洞察 -->
          <div v-if="searchContext.askResult.structuredAnswer.insights?.length" class="insights-section">
            <h4>💡 深度洞察</h4>
            <ul>
              <li v-for="(insight, idx) in searchContext.askResult.structuredAnswer.insights" :key="idx">
                {{ insight }}
              </li>
            </ul>
          </div>
        </div>
        
        <!-- 元数据 -->
        <div v-if="searchContext.askResult.metadata" class="answer-metadata">
          <span>共引用 {{ searchContext.askResult.metadata.totalEntities }} 条证据</span>
          <span>•</span>
          <span>耗时 {{ searchContext.askResult.metadata.processingTime }}ms</span>
        </div>
      </div>
    </div>

    <!-- 关联实体数据标题 -->
    <div v-if="!isLoading && entities.length > 0" class="entities-section-header">
      <h3>{{ getSectionTitle() }}</h3>
    </div>
    
    <div v-if="isLoading" class="loading-container">
      <div class="loading-spinner"></div>
      <span>正在搜索...</span>
    </div>
    
    <div v-else-if="entities.length > 0" class="search-results">
      <div class="results-summary">
        <span class="results-count">找到 {{ entities.length }} 个相关结果</span>
        <div class="results-filters">
          <button 
            v-for="type in availableTypes" 
            :key="type.key"
            :class="['type-filter', { active: selectedTypeFilter === type.key }]"
            @click="selectedTypeFilter = type.key"
          >
            {{ type.icon }} {{ type.name }} ({{ type.count }})
          </button>
        </div>
      </div>
      
      <div class="search-results-grid">
        <div 
          v-for="entity in filteredResults" 
          :key="entity.id" 
          class="search-result-card"
          @click="handleResultClick(entity)"
        >
          <div class="result-header">
            <div class="result-type-indicator">
              <span class="type-icon">{{ getEntityIcon(entity.type) }}</span>
              <span class="type-name">{{ getEntityTypeName(entity.type) }}</span>
            </div>
            <div v-if="entity.relevanceScore" class="relevance-score">
              {{ Math.round(entity.relevanceScore * 100) }}% 匹配
            </div>
            <div v-if="entity.scope" class="scope-badge">
              {{ getScopeLabel(entity.scope) }}
            </div>
          </div>
          
          <div class="result-content">
            <h3 class="result-title">{{ entity.name }}</h3>
            <p v-if="entity.description" class="result-description">
              {{ entity.description }}
            </p>
            <div v-if="getResultMeta(entity).length" class="result-meta">
              <span
                v-for="meta in getResultMeta(entity)"
                :key="meta"
                class="result-meta-item"
              >
                {{ meta }}
              </span>
            </div>
            <div
              v-if="getResultChannels(entity).length"
              class="match-reasons"
              aria-label="命中通道"
            >
              <span
                v-for="channel in getResultChannels(entity)"
                :key="channel"
                class="match-reason"
              >
                {{ getRecallChannelLabel(channel) }}
              </span>
            </div>
            <div v-if="entity.tags && entity.tags.length > 0" class="result-tags">
              <span 
                v-for="tag in entity.tags.slice(0, 3)" 
                :key="tag" 
                class="result-tag"
              >
                {{ tag }}
              </span>
              <span v-if="entity.tags.length > 3" class="result-tag more-tags">
                +{{ entity.tags.length - 3 }}
              </span>
            </div>
          </div>
          
          <div class="result-actions">
            <button
              v-if="entity.exploreLink"
              class="action-btn primary"
              @click.stop="openExploreLink(entity.exploreLink)"
            >
              在记忆中查看
            </button>
            <button
              v-if="getSafeSourceUrl(entity)"
              class="action-btn secondary"
              @click.stop="openSourceUrl(entity.sourceUrl)"
            >
              打开来源
            </button>
            <button
              v-if="!entity.exploreLink && !getSafeSourceUrl(entity)"
              class="action-btn primary"
            >
              查看详情
            </button>
          </div>
        </div>
      </div>
    </div>
    
    <div v-else class="empty-search-state">
      <span>🔍</span>
      <p>没有找到相关结果</p>
      <p class="search-tips">
        当前范围是 {{ currentScopeLabel }}，可以切换范围或换一个更具体的关键词
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useMemoryStore, ENTITY_TYPE_CONFIG } from '../memory-store';
import {
  MEMORY_RESULT_TYPE_CONFIG,
  getRecallChannelLabel,
  getResultChannels,
  getResultMeta,
  getScopeLabel,
  normalizeMemorySourceUrl,
  sanitizeMemoryExploreRoute,
  shouldResetTypeFilter,
} from '../searchResultPresentation';
import { markdownToHtml } from '../utils/markdown';

const route = useRoute();
const router = useRouter();
const store = useMemoryStore();

const searchQuery = computed(() => route.query.q as string || '');
const entities = computed(() => store.entities);
const isLoading = computed(() => store.isLoading);
const searchContext = computed(() => store.searchContext);
const selectedTypeFilter = ref('all');
const isAiAnswerExpanded = ref(true);

const renderedAnswer = computed(() => {
  const ans = searchContext.value.askResult?.answer;
  return ans ? markdownToHtml(ans) : '';
});

const currentScopeLabel = computed(() =>
  getScopeLabel(route.query.scope || searchContext.value.scope || 'work'),
);

// 自动设置筛选器：如果是从实体列表页搜索过来的，自动选中该实体类型
watch(() => searchContext.value.entityType, (entityType) => {
  if (entityType && searchContext.value.mode === 'entity') {
    selectedTypeFilter.value = entityType;
  } else {
    selectedTypeFilter.value = 'all';
  }
}, { immediate: true });

const toggleAiAnswer = () => {
  isAiAnswerExpanded.value = !isAiAnswerExpanded.value;
};

const getSectionTitle = () => {
  if (searchContext.value.mode === 'overview') {
    return '📚 相关记忆证据';
  } else if (searchContext.value.entityType) {
    const typeName = ENTITY_TYPE_CONFIG[searchContext.value.entityType]?.name || '实体';
    return `🔍 向量匹配查询到的${typeName}`;
  }
  return '🔍 搜索结果';
};

// 获取可用的实体类型及其数量
const availableTypes = computed(() => {
  const typeMap = new Map();
  typeMap.set('all', { key: 'all', name: '全部', icon: '📁', count: entities.value.length });
  
  entities.value.forEach(entity => {
    const config = ENTITY_TYPE_CONFIG[entity.type] || MEMORY_RESULT_TYPE_CONFIG[entity.type];
    if (config) {
      const existing = typeMap.get(entity.type) || { 
        key: entity.type, 
        name: config.name, 
        icon: config.icon, 
        count: 0 
      };
      existing.count++;
      typeMap.set(entity.type, existing);
    }
  });
  
  return Array.from(typeMap.values()).filter(type => type.count > 0);
});

watch(
  availableTypes,
  (types) => {
    if (shouldResetTypeFilter(selectedTypeFilter.value, types)) {
      selectedTypeFilter.value = 'all';
    }
  },
  { immediate: true },
);

// 根据类型过滤的结果
const filteredResults = computed(() => {
  if (selectedTypeFilter.value === 'all') {
    return entities.value;
  }
  return entities.value.filter(entity => entity.type === selectedTypeFilter.value);
});

const getEntityIcon = (type: string) => {
  return ENTITY_TYPE_CONFIG[type]?.icon || MEMORY_RESULT_TYPE_CONFIG[type]?.icon || '📂';
};

const getEntityTypeName = (type: string) => {
  return ENTITY_TYPE_CONFIG[type]?.name || MEMORY_RESULT_TYPE_CONFIG[type]?.name || type;
};

const getSafeSourceUrl = (entity: any) => {
  return normalizeMemorySourceUrl(entity?.sourceUrl);
};

const openExploreLink = (exploreLink?: string) => {
  const safeExploreRoute = sanitizeMemoryExploreRoute(exploreLink);
  if (!safeExploreRoute) return false;
  router.push(safeExploreRoute.slice(1));
  return true;
};

const openSourceUrl = (sourceUrl?: string) => {
  const safeSourceUrl = normalizeMemorySourceUrl(sourceUrl);
  if (!safeSourceUrl) return false;
  window.open(safeSourceUrl, '_blank', 'noopener,noreferrer');
  return true;
};

const handleResultClick = (entity: any) => {
  if (openExploreLink(entity.exploreLink)) return;
  if (openSourceUrl(entity.sourceUrl)) return;

  switch (entity.type) {
    case 'Topic':
      router.push(`/topic/${entity.id}`);
      break;
    case 'Person':
      router.push(`/person/${entity.id}`);
      break;
    case 'Project':
      router.push(`/project/${entity.id}`);
      break;
    default:
      router.push(`/entity/${entity.type}`);
      break;
  }
};
</script>

<style scoped>
.search-results-section {
  max-width: 1200px;
  margin: 0 auto;
  animation: fadeInUp 0.6s ease-out;
}

.search-header {
  text-align: center;
  margin-bottom: 2rem;
  padding: 2rem;
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(147, 51, 234, 0.1));
  border: 1px solid rgba(59, 130, 246, 0.2);
  border-radius: 1rem;
  backdrop-filter: blur(10px);
}

/* AI 智能回答区域 */
.ai-answer-section {
  margin-bottom: 2rem;
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.08), rgba(147, 51, 234, 0.08));
  border: 1px solid rgba(59, 130, 246, 0.2);
  border-radius: 1rem;
  overflow: hidden;
  backdrop-filter: blur(10px);
}

.ai-answer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  cursor: pointer;
  transition: background 0.3s ease;
  border-bottom: 1px solid rgba(59, 130, 246, 0.1);
}

.ai-answer-header:hover {
  background: rgba(59, 130, 246, 0.05);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.ai-icon {
  font-size: 1.5rem;
}

.ai-answer-header h3 {
  font-size: 1.25rem;
  font-weight: 600;
  color: #60a5fa;
  margin: 0;
}

.toggle-btn {
  padding: 0.5rem 1rem;
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.3);
  border-radius: 0.5rem;
  color: #60a5fa;
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: 0.875rem;
  font-weight: 500;
}

.toggle-btn:hover {
  background: rgba(59, 130, 246, 0.2);
}

.ai-answer-content {
  padding: 1.5rem;
}

.answer-main {
  margin-bottom: 1.5rem;
}

.answer-main p {
  color: #e2e8f0;
  font-size: 1rem;
  line-height: 1.8;
  margin: 0 0 0.75rem 0;
}

.answer-main p:last-child {
  margin-bottom: 0;
}

.answer-main strong {
  font-weight: 600;
  color: #f1f5f9;
}

.answer-main a {
  color: #60a5fa;
  text-decoration: none;
}

.answer-main a:hover {
  text-decoration: underline;
}

.answer-structured {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid rgba(148, 163, 184, 0.1);
}

.findings-section h4,
.timeline-section h4,
.insights-section h4 {
  font-size: 1rem;
  font-weight: 600;
  color: #60a5fa;
  margin-bottom: 0.75rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.findings-section ul,
.insights-section ul {
  list-style: none;
  margin: 0;
  padding: 0;
}

.findings-section li,
.insights-section li {
  padding: 0.75rem;
  margin-bottom: 0.5rem;
  background: rgba(30, 41, 59, 0.4);
  border-left: 3px solid #60a5fa;
  border-radius: 0.25rem;
  color: #cbd5e1;
  font-size: 0.875rem;
  line-height: 1.6;
}

.timeline-items {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.timeline-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem;
  background: rgba(30, 41, 59, 0.4);
  border-radius: 0.5rem;
}

.timeline-date {
  font-size: 0.875rem;
  font-weight: 600;
  color: #60a5fa;
  min-width: 100px;
}

.timeline-event {
  flex: 1;
  color: #cbd5e1;
  font-size: 0.875rem;
  line-height: 1.5;
}

.answer-metadata {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 1.5rem;
  padding-top: 1rem;
  border-top: 1px solid rgba(148, 163, 184, 0.1);
  font-size: 0.875rem;
  color: #94a3b8;
}

/* 关联实体数据标题 */
.entities-section-header {
  margin-bottom: 1.5rem;
}

.entities-section-header h3 {
  font-size: 1.25rem;
  font-weight: 600;
  color: #e2e8f0;
  margin: 0;
  padding-bottom: 0.75rem;
  border-bottom: 2px solid rgba(59, 130, 246, 0.3);
}

.search-header h2 {
  font-size: 1.75rem;
  font-weight: 600;
  margin-bottom: 0.75rem;
  color: #ffffff;
}

.search-header p {
  color: #cbd5e1;
  font-size: 1rem;
}

.search-header .scope-caption {
  margin-top: 0.5rem;
  color: #94a3b8;
  font-size: 0.9rem;
}

.results-summary {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
  gap: 1rem;
}

.results-count {
  color: #94a3b8;
  font-size: 0.875rem;
}

.results-filters {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.type-filter {
  padding: 0.5rem 1rem;
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.3);
  border-radius: 0.5rem;
  color: #60a5fa;
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: 0.875rem;
  white-space: nowrap;
}

.type-filter:hover {
  background: rgba(59, 130, 246, 0.2);
}

.type-filter.active {
  background: rgba(59, 130, 246, 0.3);
  border-color: rgba(59, 130, 246, 0.5);
  color: #93c5fd;
}

.search-results-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
  gap: 1rem;
}

.search-result-card {
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid rgba(148, 163, 184, 0.1);
  border-radius: 0.75rem;
  padding: 1.5rem;
  transition: all 0.3s ease;
  cursor: pointer;
  backdrop-filter: blur(10px);
}

.search-result-card:hover {
  border-color: rgba(59, 130, 246, 0.3);
  transform: translateY(-2px);
  box-shadow: 0 8px 32px rgba(59, 130, 246, 0.1);
}

.result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-bottom: 1rem;
}

.result-type-indicator {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0.75rem;
  background: rgba(59, 130, 246, 0.2);
  border-radius: 1rem;
}

.type-icon {
  font-size: 1rem;
}

.type-name {
  font-size: 0.75rem;
  font-weight: 500;
  color: #60a5fa;
}

.relevance-score {
  font-size: 0.75rem;
  color: #22c55e;
  background: rgba(34, 197, 94, 0.2);
  padding: 0.25rem 0.5rem;
  border-radius: 0.375rem;
}

.scope-badge {
  font-size: 0.75rem;
  color: #34d399;
  background: rgba(16, 185, 129, 0.16);
  padding: 0.25rem 0.5rem;
  border-radius: 0.375rem;
}

.result-content {
  margin-bottom: 1rem;
}

.result-title {
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
  color: #e2e8f0;
}

.result-description {
  color: #cbd5e1;
  font-size: 0.875rem;
  line-height: 1.5;
  margin-bottom: 0.75rem;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.result-meta {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-bottom: 0.75rem;
  color: #94a3b8;
  font-size: 0.75rem;
}

.result-meta-item {
  max-width: 100%;
  overflow-wrap: anywhere;
}

.result-meta-item + .result-meta-item::before {
  content: '·';
  margin-right: 0.5rem;
  color: #475569;
}

.match-reasons {
  display: flex;
  gap: 0.375rem;
  flex-wrap: wrap;
  margin-bottom: 0.75rem;
}

.match-reason {
  padding: 0.2rem 0.45rem;
  border: 1px solid rgba(96, 165, 250, 0.22);
  border-radius: 0.375rem;
  color: #bfdbfe;
  background: rgba(37, 99, 235, 0.12);
  font-size: 0.72rem;
  line-height: 1.2;
}

.result-tags {
  display: flex;
  gap: 0.375rem;
  flex-wrap: wrap;
}

.result-tag {
  padding: 0.25rem 0.5rem;
  background: rgba(147, 51, 234, 0.2);
  color: #a78bfa;
  border-radius: 0.375rem;
  font-size: 0.75rem;
  font-weight: 500;
}

.result-tag.more-tags {
  background: rgba(148, 163, 184, 0.2);
  color: #94a3b8;
}

.result-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.action-btn {
  padding: 0.5rem 1rem;
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.3);
  border-radius: 0.5rem;
  color: #60a5fa;
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: 0.875rem;
  font-weight: 500;
}

.action-btn.primary {
  background: rgba(59, 130, 246, 0.2);
  border-color: rgba(59, 130, 246, 0.4);
}

.action-btn.secondary {
  color: #cbd5e1;
  border-color: rgba(148, 163, 184, 0.28);
  background: rgba(148, 163, 184, 0.08);
}

.action-btn:hover {
  background: rgba(59, 130, 246, 0.3);
  border-color: rgba(59, 130, 246, 0.5);
}

.empty-search-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  color: #94a3b8;
  text-align: center;
}

.empty-search-state span {
  font-size: 4rem;
  margin-bottom: 1rem;
  opacity: 0.5;
}

.empty-search-state p {
  margin-bottom: 0.5rem;
}

.search-tips {
  font-size: 0.875rem;
  color: #64748b;
}

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

@media (max-width: 768px) {
  .search-results-grid {
    grid-template-columns: 1fr;
  }
  
  .results-summary {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .results-filters {
    width: 100%;
    justify-content: flex-start;
  }
}
</style>
