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
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useMemoryStore } from './memory-store';

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
  if (searchQuery.value.trim().length >= 2) {
    // 使用云端向量检索进行搜索
    store.vectorSearchEntities(searchQuery.value);
    router.push({ 
      path: '/search', 
      query: { q: searchQuery.value } 
    });
  }
};

const clearSearch = () => {
  searchQuery.value = '';
  store.searchQuery = '';
  router.push('/');
};

onMounted(() => {
  // 直接初始化 store，MemorySystem 会自动初始化
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
  font-size: 1rem;
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
  height: 100vh;
  max-height: 100vh;
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

/* 实体网格布局 */
.entities-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 1rem;
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

/* Topic卡片特殊样式 */
.topic-card {
  min-height: auto;
}

/* Person卡片特殊样式 */
.person-card {
  min-height: auto;
}

.person-card-header {
  margin-bottom: 1rem;
}

.person-card-badge {
  background: rgba(34, 197, 94, 0.2);
  color: #22c55e;
  padding: 0.25rem 0.75rem;
  border-radius: 1rem;
  font-size: 0.75rem;
  font-weight: 500;
}

.person-preview-section {
  margin: 1rem 0;
  padding: 0.75rem 0;
  border-top: 1px solid rgba(148, 163, 184, 0.1);
}

.person-preview-section:first-of-type {
  border-top: none;
  margin-top: 0;
  padding-top: 0;
}

.expertise-tags {
  display: flex;
  gap: 0.375rem;
  flex-wrap: wrap;
}

.expertise-tag {
  padding: 0.25rem 0.5rem;
  background: rgba(147, 51, 234, 0.2);
  color: #a78bfa;
  border-radius: 0.375rem;
  font-size: 0.75rem;
  font-weight: 500;
}

.collaboration-item:hover .preview-content {
  color: #60a5fa;
}

.message-item:hover .preview-content {
  color: #60a5fa;
}

.team-indicator {
  background: rgba(59, 130, 246, 0.2);
  color: #60a5fa;
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
  font-size: 0.625rem;
  font-weight: 500;
}

.topic-card-header {
  margin-bottom: 1rem;
}

.topic-card-badge {
  background: rgba(59, 130, 246, 0.2);
  color: #60a5fa;
  padding: 0.25rem 0.75rem;
  border-radius: 1rem;
  font-size: 0.75rem;
  font-weight: 500;
}

.topic-preview-section {
  margin: 1rem 0;
  padding: 0.75rem 0;
  border-top: 1px solid rgba(148, 163, 184, 0.1);
}

.topic-preview-section:first-of-type {
  border-top: none;
  margin-top: 0;
  padding-top: 0;
}

.preview-section-title {
  color: #60a5fa;
  font-size: 0.875rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.preview-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.preview-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0;
  cursor: pointer;
  transition: all 0.3s ease;
  border-radius: 0.25rem;
  margin: 0.25rem 0;
}

.preview-item:hover {
  background: rgba(59, 130, 246, 0.05);
  padding-left: 0.5rem;
}

.preview-content {
  flex: 1;
  font-size: 0.875rem;
  color: #cbd5e1;
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.preview-time {
  font-size: 0.75rem;
  color: #64748b;
  white-space: nowrap;
}

.project-status {
  background: rgba(34, 197, 94, 0.2);
  color: #22c55e;
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
  font-size: 0.625rem;
  font-weight: 500;
  white-space: nowrap;
}

.discussion-item:hover .preview-content {
  color: #60a5fa;
}

.resource-item:hover .preview-content {
  color: #60a5fa;
}

.project-item:hover .preview-content {
  color: #60a5fa;
}

/* 项目卡片特殊样式 */
.project-card {
  position: relative;
}

.project-actions {
  display: flex;
  gap: 0.5rem;
  margin: 0.75rem 0;
  flex-wrap: wrap;
}

.project-action-btn {
  padding: 0.375rem 0.75rem;
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.3);
  border-radius: 0.5rem;
  color: #60a5fa;
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: 0.75rem;
  font-weight: 500;
  white-space: nowrap;
}

.project-action-btn:hover {
  background: rgba(59, 130, 246, 0.2);
  border-color: rgba(59, 130, 246, 0.5);
}

.project-action-btn.highlight.active {
  background: rgba(251, 191, 36, 0.2);
  border-color: rgba(251, 191, 36, 0.5);
  color: #f59e0b;
}

.project-action-btn.highlight.active:hover {
  background: rgba(251, 191, 36, 0.3);
}

.project-action-btn.dashboard {
  background: rgba(34, 197, 94, 0.1);
  border-color: rgba(34, 197, 94, 0.3);
  color: #22c55e;
}

.project-action-btn.dashboard:hover {
  background: rgba(34, 197, 94, 0.2);
  border-color: rgba(34, 197, 94, 0.5);
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
  font-size: 0.875rem;
  line-height: 1.5;
}

/* 搜索控件 */
.search-controls {
  display: flex;
  gap: 1rem;
  align-items: center;
}

/* 搜索过滤控件 */
.search-filter-controls {
  display: flex;
  gap: 1rem;
  align-items: center;
  margin-bottom: 1.5rem;
  padding: 1rem;
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid rgba(148, 163, 184, 0.1);
  border-radius: 0.75rem;
  backdrop-filter: blur(10px);
}

.filter-controls {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
}

.filter-select-wrapper {
  display: flex;
  align-items: center;
}

.results-count {
  color: #94a3b8;
  font-size: 0.875rem;
  margin-left: auto;
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
  font-size: 0.875rem;
}

.group-name {
  font-size: 0.75rem;
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
  font-size: 0.75rem;
  color: #e2e8f0;
}

.context-time {
  font-size: 0.75rem;
  color: #94a3b8;
}

.context-content-text {
  color: #cbd5e1;
  line-height: 1.4;
  font-size: 0.8rem;
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
  font-size: 0.75rem;
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
  font-size: 0.875rem;
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

/* 用户画像样式 */
.user-profile-section {
  max-width: 1200px;
  margin: 0 auto;
  animation: fadeInUp 0.6s ease-out;
}

.profile-header {
  text-align: center;
  margin-bottom: 2rem;
  padding: 2rem;
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(147, 51, 234, 0.1));
  border: 1px solid rgba(59, 130, 246, 0.2);
  border-radius: 1rem;
  backdrop-filter: blur(10px);
}

.profile-header h2 {
  font-size: 1.75rem;
  font-weight: 600;
  margin-bottom: 0.75rem;
  color: #ffffff;
}

.profile-header p {
  color: #cbd5e1;
  font-size: 1rem;
  line-height: 1.6;
}

.profile-content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.profile-card {
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid rgba(148, 163, 184, 0.1);
  border-radius: 1rem;
  padding: 1.5rem;
  backdrop-filter: blur(10px);
  transition: all 0.3s ease;
}

.profile-card:hover {
  border-color: rgba(59, 130, 246, 0.3);
  box-shadow: 0 8px 32px rgba(59, 130, 246, 0.1);
}

.profile-card h3 {
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 1rem;
  color: #60a5fa;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.interest-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
}

.interest-category h4 {
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 0.75rem;
  color: #e2e8f0;
}

.interest-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.interest-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: rgba(59, 130, 246, 0.1);
  border-radius: 0.5rem;
  transition: all 0.3s ease;
}

.interest-item:hover {
  background: rgba(59, 130, 246, 0.2);
  transform: translateX(4px);
}

.interest-icon {
  font-size: 1rem;
}

.insights-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1rem;
}

.insight-item {
  padding: 1rem;
  background: rgba(30, 41, 59, 0.4);
  border: 1px solid rgba(148, 163, 184, 0.1);
  border-radius: 0.75rem;
}

.insight-item h4 {
  font-size: 0.875rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
  color: #60a5fa;
}

.insight-item p {
  color: #cbd5e1;
  font-size: 0.875rem;
  line-height: 1.5;
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.focus-tag {
  padding: 0.25rem 0.75rem;
  background: rgba(34, 197, 94, 0.2);
  color: #22c55e;
  border-radius: 1rem;
  font-size: 0.75rem;
  font-weight: 500;
}

.suggestions-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.suggestion-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  background: rgba(30, 41, 59, 0.4);
  border: 1px solid rgba(148, 163, 184, 0.1);
  border-radius: 0.5rem;
  transition: all 0.3s ease;
}

.suggestion-item:hover {
  background: rgba(59, 130, 246, 0.1);
  border-color: rgba(59, 130, 246, 0.3);
}

.suggestion-icon {
  font-size: 1rem;
  color: #60a5fa;
}

.predictions-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.prediction-item {
  padding: 1rem;
  background: rgba(30, 41, 59, 0.4);
  border: 1px solid rgba(148, 163, 184, 0.1);
  border-radius: 0.75rem;
}

.prediction-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.prediction-type {
  background: rgba(147, 51, 234, 0.2);
  color: #a78bfa;
  padding: 0.25rem 0.75rem;
  border-radius: 1rem;
  font-size: 0.75rem;
  font-weight: 500;
}

.prediction-confidence {
  font-size: 0.75rem;
  color: #94a3b8;
}

.prediction-name {
  font-weight: 600;
  margin-bottom: 0.25rem;
  color: #e2e8f0;
}

.prediction-reason {
  font-size: 0.875rem;
  color: #94a3b8;
  line-height: 1.4;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1rem;
}

.stat-card {
  text-align: center;
  padding: 1rem;
  background: rgba(59, 130, 246, 0.1);
  border-radius: 0.75rem;
  transition: all 0.3s ease;
}

.stat-card:hover {
  background: rgba(59, 130, 246, 0.2);
  transform: translateY(-2px);
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: #60a5fa;
  margin-bottom: 0.25rem;
}

.stat-label {
  font-size: 0.75rem;
  color: #94a3b8;
}

.empty-hint {
  font-size: 0.875rem;
  color: #94a3b8;
  margin-top: 0.5rem;
}

/* 滚动条样式 */
::-webkit-scrollbar {
  width: 8px;
}

::-webkit-scrollbar-track {
  background: rgba(15, 23, 42, 0.3);
}

::-webkit-scrollbar-thumb {
  background: rgba(59, 130, 246, 0.3);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(59, 130, 246, 0.5);
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