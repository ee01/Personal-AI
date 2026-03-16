<template>
  <div class="reflection-threads-page">
    <div class="page-header">
      <div>
        <h2>自我反思线程</h2>
        <p>持续跟进需要复盘、判断或继续发酵的话题。</p>
      </div>

      <div class="header-controls">
        <select v-model="statusFilter" class="filter-select" @change="loadThreads">
          <option value="active">进行中</option>
          <option value="paused">已暂停</option>
          <option value="closed">已关闭</option>
          <option value="all">全部</option>
        </select>
        <input
          v-model="searchText"
          class="search-input"
          placeholder="搜索标题 / topic key"
          @keyup.enter="loadThreads"
        />
        <button class="refresh-btn" @click="loadThreads">刷新</button>
      </div>
    </div>

    <div v-if="loading" class="loading-container">
      <div class="loading-spinner"></div>
      <p>加载自我反思线程中...</p>
    </div>

    <div v-else-if="threads.length === 0" class="empty-state">
      <div class="empty-icon">🧠</div>
      <p>当前没有符合条件的自我反思线程</p>
    </div>

    <div v-else class="thread-grid">
      <router-link
        v-for="thread in threads"
        :key="thread.id"
        :to="`/reflection-threads/${thread.id}`"
        class="thread-card"
      >
        <div class="thread-top">
          <span class="status-badge" :class="thread.status">{{ statusLabel(thread.status) }}</span>
          <span class="priority-badge">P{{ thread.priority }}</span>
          <span class="salience-score">S {{ thread.salience.toFixed(2) }}</span>
        </div>

        <h3 class="thread-title">{{ displayThreadTitle(thread.title) }}</h3>
        <p class="thread-summary">{{ thread.latestSummary || '暂无总结，等待首次反思运行。' }}</p>

        <div class="thread-meta">
          <span>问题 {{ thread.openQuestions.length }}</span>
          <span>运行 {{ thread.reflectionCount }}</span>
          <span v-if="thread.sourceType">{{ thread.sourceType }}</span>
        </div>

        <div class="thread-bottom">
          <span>{{ relativeTime(thread.updatedAt) }}</span>
          <span v-if="thread.nextReflectionAt">下次 {{ relativeTime(thread.nextReflectionAt) }}</span>
        </div>
      </router-link>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import {
  getMemoryServiceClient,
  type ReflectionThread,
} from '../../services/MemoryServiceClient';

const client = getMemoryServiceClient();
const loading = ref(true);
const threads = ref<ReflectionThread[]>([]);
const statusFilter = ref<'active' | 'paused' | 'closed' | 'all'>('active');
const searchText = ref('');

onMounted(() => {
  void loadThreads();
});

async function loadThreads() {
  loading.value = true;
  try {
    const response = await client.getReflectionThreads({
      status: statusFilter.value,
      search: searchText.value.trim() || undefined,
      limit: 50,
    });
    threads.value = response.items;
  } catch (error) {
    console.error('Failed to load reflection threads:', error);
    threads.value = [];
  } finally {
    loading.value = false;
  }
}

function statusLabel(status: string) {
  if (status === 'active') return '进行中';
  if (status === 'paused') return '已暂停';
  return '已关闭';
}

function displayThreadTitle(title: string) {
  return title.replace(/^思考反思:/, '自我反思:');
}

function relativeTime(ts?: number) {
  if (!ts) return '未知';
  const diff = Date.now() - ts * 1000;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes}分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  return `${days}天前`;
}
</script>

<style scoped>
.reflection-threads-page {
  animation: fadeInUp 0.5s ease-out;
}

.page-header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.page-header h2 {
  font-size: 1.5rem;
  margin-bottom: 0.35rem;
}

.page-header p {
  color: #94a3b8;
  font-size: 0.9rem;
}

.header-controls {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.filter-select,
.search-input {
  background: rgba(15, 23, 42, 0.72);
  border: 1px solid rgba(148, 163, 184, 0.22);
  color: #e2e8f0;
  border-radius: 0.75rem;
  padding: 0.7rem 0.9rem;
}

.search-input {
  min-width: 220px;
}

.refresh-btn {
  border: none;
  border-radius: 0.8rem;
  padding: 0.72rem 1rem;
  background: linear-gradient(135deg, #2563eb, #0891b2);
  color: white;
  cursor: pointer;
}

.thread-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
}

.thread-card {
  display: block;
  text-decoration: none;
  color: inherit;
  background: rgba(15, 23, 42, 0.72);
  border: 1px solid rgba(148, 163, 184, 0.12);
  border-radius: 1rem;
  padding: 1.25rem;
  transition: all 0.25s ease;
}

.thread-card:hover {
  transform: translateY(-2px);
  border-color: rgba(14, 165, 233, 0.36);
  box-shadow: 0 14px 36px rgba(14, 165, 233, 0.1);
}

.thread-top,
.thread-meta,
.thread-bottom {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.thread-top {
  margin-bottom: 0.8rem;
}

.thread-title {
  font-size: 1.05rem;
  margin-bottom: 0.6rem;
  line-height: 1.45;
}

.thread-summary {
  color: #cbd5e1;
  font-size: 0.88rem;
  line-height: 1.55;
  min-height: 4.2rem;
  margin-bottom: 0.8rem;
}

.thread-meta,
.thread-bottom {
  color: #94a3b8;
  font-size: 0.78rem;
}

.thread-bottom {
  justify-content: space-between;
  margin-top: 0.9rem;
}

.status-badge,
.priority-badge,
.salience-score {
  padding: 0.18rem 0.55rem;
  border-radius: 999px;
  font-size: 0.75rem;
}

.status-badge.active {
  background: rgba(34, 197, 94, 0.16);
  color: #4ade80;
}

.status-badge.paused {
  background: rgba(245, 158, 11, 0.16);
  color: #fbbf24;
}

.status-badge.closed {
  background: rgba(148, 163, 184, 0.18);
  color: #cbd5e1;
}

.priority-badge {
  background: rgba(59, 130, 246, 0.16);
  color: #93c5fd;
}

.salience-score {
  background: rgba(168, 85, 247, 0.14);
  color: #c084fc;
}

.loading-container,
.empty-state {
  text-align: center;
  padding: 3rem 1rem;
  color: #94a3b8;
}

.empty-icon {
  font-size: 2.5rem;
  margin-bottom: 0.7rem;
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

@media (max-width: 960px) {
  .page-header {
    flex-direction: column;
  }

  .header-controls {
    flex-wrap: wrap;
  }

  .search-input {
    min-width: 0;
    width: 100%;
  }
}
</style>
