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

    <div v-if="handoffSearch" class="handoff-banner">
      <div>
        <strong>{{ handoffSourceLabel }}</strong>
        <span>
          已按“{{ handoffSearch }}”筛选反思线程；如果没有结果，可清除筛选后查看全部。
        </span>
      </div>
      <button class="handoff-clear-btn" @click="clearHandoffFilter">
        清除筛选
      </button>
    </div>

    <div v-if="loadError" class="load-error">
      <div>
        <div class="load-error-title">自我反思线程暂时不可用</div>
        <p>
          {{ loadError }}
          <span v-if="threads.length > 0">下方继续保留上次成功读取的线程。</span>
        </p>
      </div>
      <button class="load-error-retry" @click="loadThreads">重试</button>
    </div>

    <div v-if="loading" class="loading-container">
      <div class="loading-spinner"></div>
      <p>加载自我反思线程中...</p>
    </div>

    <div v-else-if="threads.length === 0" class="empty-state">
      <div class="empty-icon">🧠</div>
      <p>{{ emptyMessage }}</p>
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
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  getMemoryServiceClient,
  type ReflectionThread,
} from '../../services/MemoryServiceClient';

const route = useRoute();
const router = useRouter();
const client = getMemoryServiceClient();
const loading = ref(true);
const threads = ref<ReflectionThread[]>([]);
const loadError = ref('');
const statusFilter = ref<'active' | 'paused' | 'closed' | 'all'>('active');
const searchText = ref('');
const handoffSource = ref('');

const handoffSearch = computed(() =>
  handoffSource.value === 'dream' ? searchText.value.trim() : '',
);
const handoffSourceLabel = computed(() =>
  handoffSource.value === 'dream' ? '来自梦境重放' : '来自外部入口',
);
const emptyMessage = computed(() => {
  const query = searchText.value.trim();
  if (handoffSource.value === 'dream' && query) {
    return `没有找到与“${query}”对应的自我反思线程；可清除筛选后查看全部线程。`;
  }
  return '当前没有符合条件的自我反思线程';
});

onMounted(() => {
  applyRouteQuery();
  void loadThreads();
});

watch(
  () => route.query,
  () => {
    applyRouteQuery();
    void loadThreads();
  },
);

function applyRouteQuery() {
  const queryStatus =
    typeof route.query.status === 'string' ? route.query.status : '';
  const querySearch =
    typeof route.query.search === 'string' ? route.query.search : '';
  const querySource =
    typeof route.query.source === 'string' ? route.query.source : '';

  if (
    queryStatus === 'active' ||
    queryStatus === 'paused' ||
    queryStatus === 'closed' ||
    queryStatus === 'all'
  ) {
    statusFilter.value = queryStatus;
  } else {
    statusFilter.value = 'active';
  }
  searchText.value = querySearch;
  handoffSource.value = querySource;
}

async function loadThreads() {
  loading.value = true;
  try {
    const response = await client.getReflectionThreads({
      status: statusFilter.value,
      search: searchText.value.trim() || undefined,
      limit: 50,
    });
    threads.value = response.items;
    loadError.value = '';
  } catch (error) {
    console.error('Failed to load reflection threads:', error);
    loadError.value = errorMessage(error);
  } finally {
    loading.value = false;
  }
}

async function clearHandoffFilter() {
  statusFilter.value = 'active';
  searchText.value = '';
  handoffSource.value = '';
  await router.replace('/reflection-threads');
}

function statusLabel(status: string) {
  if (status === 'active') return '进行中';
  if (status === 'paused') return '已暂停';
  return '已关闭';
}

function displayThreadTitle(title: string) {
  return title.replace(/^思考反思:/, '自我反思:');
}

function errorMessage(error: unknown) {
  return error instanceof Error && error.message
    ? error.message
    : '无法连接 Memory Service，请稍后重试。';
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

.handoff-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  border: 1px solid rgba(45, 212, 191, 0.22);
  border-radius: 8px;
  background: rgba(20, 83, 45, 0.14);
  color: #cbd5e1;
  padding: 0.8rem 0.9rem;
  margin-bottom: 1rem;
}

.handoff-banner strong {
  display: block;
  color: #99f6e4;
  font-size: 0.82rem;
  margin-bottom: 0.25rem;
}

.handoff-banner span {
  color: #94a3b8;
  font-size: 0.82rem;
  line-height: 1.5;
}

.handoff-clear-btn {
  flex-shrink: 0;
  border: 1px solid rgba(148, 163, 184, 0.24);
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.7);
  color: #e2e8f0;
  padding: 0.48rem 0.72rem;
  cursor: pointer;
}

.handoff-clear-btn:hover {
  border-color: rgba(45, 212, 191, 0.42);
  color: #ccfbf1;
}

.load-error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  border: 1px solid rgba(248, 113, 113, 0.28);
  border-radius: 8px;
  background: rgba(127, 29, 29, 0.22);
  color: #fecaca;
  padding: 0.85rem 0.95rem;
  margin-bottom: 1rem;
}

.load-error-title {
  color: #fecaca;
  font-weight: 700;
  margin-bottom: 0.25rem;
}

.load-error p {
  color: #fca5a5;
  font-size: 0.84rem;
  line-height: 1.5;
  margin: 0;
}

.load-error-retry {
  flex-shrink: 0;
  border: 1px solid rgba(248, 113, 113, 0.36);
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.7);
  color: #fee2e2;
  padding: 0.48rem 0.75rem;
  cursor: pointer;
}

.load-error-retry:hover {
  border-color: rgba(248, 113, 113, 0.58);
  color: #fff1f2;
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

  .handoff-banner {
    align-items: flex-start;
    flex-direction: column;
  }

  .load-error {
    align-items: flex-start;
    flex-direction: column;
  }

  .search-input {
    min-width: 0;
    width: 100%;
  }
}
</style>
