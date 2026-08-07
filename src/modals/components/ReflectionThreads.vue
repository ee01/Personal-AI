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

    <section class="list-scope-box" :class="listScopeReceipt.tone">
      <div class="list-scope-main">
        <div class="list-scope-title">列表查看范围</div>
        <h3>{{ listScopeReceipt.title }}</h3>
        <p>{{ listScopeReceipt.summary }}</p>
      </div>
      <div class="list-scope-grid">
        <div>
          <span>状态筛选</span>
          <strong>{{ listScopeReceipt.statusLine }}</strong>
        </div>
        <div>
          <span>搜索范围</span>
          <strong>{{ listScopeReceipt.searchLine }}</strong>
        </div>
        <div>
          <span>当前快照</span>
          <strong>{{ listScopeReceipt.countLine }}</strong>
        </div>
        <div>
          <span>推进节奏</span>
          <strong>{{ listScopeReceipt.overdueLine }}</strong>
        </div>
        <div>
          <span>边界</span>
          <strong>{{ listScopeReceipt.boundary }}</strong>
        </div>
      </div>
      <div class="list-scope-chips">
        <span
          v-for="chip in listScopeReceipt.chips"
          :key="chip"
          class="list-scope-chip"
        >
          {{ chip }}
        </span>
      </div>
    </section>

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

    <div v-if="loading && threads.length > 0" class="refreshing-snapshot">
      <div>
        <strong>刷新中 · 保留上次成功快照</strong>
        <span>
          下方线程仍是上次读取结果；刷新完成前不会运行反思、写记忆或改变线程状态。
        </span>
      </div>
    </div>

    <div v-if="loading && threads.length === 0" class="loading-container">
      <div class="loading-spinner"></div>
      <p>加载自我反思线程中...</p>
    </div>

    <section
      v-if="emptyFilterReceipt"
      class="empty-filter-receipt"
      :class="emptyFilterReceipt.tone"
    >
      <div class="empty-filter-main">
        <div class="empty-filter-title">筛选未命中回执</div>
        <h3>{{ emptyFilterReceipt.title }}</h3>
        <p>{{ emptyFilterReceipt.summary }}</p>
      </div>
      <div class="empty-filter-grid">
        <div>
          <span>请求</span>
          <strong>{{ emptyFilterReceipt.requestLine }}</strong>
        </div>
        <div>
          <span>读取结果</span>
          <strong>{{ emptyFilterReceipt.resultLine }}</strong>
        </div>
        <div>
          <span>边界</span>
          <strong>{{ emptyFilterReceipt.boundary }}</strong>
        </div>
        <div>
          <span>恢复路径</span>
          <strong>{{ emptyFilterReceipt.recovery }}</strong>
        </div>
      </div>
      <div class="empty-filter-chips">
        <span
          v-for="chip in emptyFilterReceipt.chips"
          :key="chip"
          class="empty-filter-chip"
        >
          {{ chip }}
        </span>
      </div>
    </section>

    <div v-if="!loading && threads.length === 0" class="empty-state">
      <div class="empty-icon">🧠</div>
      <p>{{ emptyMessage }}</p>
    </div>

    <div v-if="threads.length > 0" class="thread-grid">
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

        <div class="thread-handoff" :class="threadReceipt(thread).tone">
          <div class="thread-handoff-title">{{ threadReceipt(thread).title }}</div>
          <p>{{ threadReceipt(thread).summary }}</p>
          <div class="thread-handoff-chips">
            <span
              v-for="chip in threadReceipt(thread).chips.slice(0, 4)"
              :key="chip"
              class="handoff-chip"
            >
              {{ chip }}
            </span>
          </div>
        </div>

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

    <section
      v-if="hasMoreThreads"
      class="list-pagination-receipt"
      role="group"
      aria-label="反思线程列表分页回执"
    >
      <div>
        <div class="list-pagination-title">列表分页回执</div>
        <h3>{{ listPaginationReceipt.title }}</h3>
        <p>{{ listPaginationReceipt.summary }}</p>
        <p>{{ listPaginationReceipt.boundary }}</p>
      </div>
      <button
        class="load-more-btn"
        :disabled="loadingMore"
        :title="loadMoreBoundary"
        :aria-label="loadMoreBoundary"
        @click="loadMoreThreads"
      >{{ loadingMore ? '正在读取下一批…' : '加载更多线程' }}</button>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  getMemoryServiceClient,
  type ReflectionThread,
} from '../../services/MemoryServiceClient';
import { buildReflectionHandoffReceipt } from '../reflectionThreadPresentation';

const route = useRoute();
const router = useRouter();
const client = getMemoryServiceClient();
const loading = ref(true);
const threads = ref<ReflectionThread[]>([]);
const totalThreads = ref(0);
const loadError = ref('');
const loadingMore = ref(false);
const statusFilter = ref<'active' | 'paused' | 'closed' | 'all'>('active');
const searchText = ref('');
const handoffSource = ref('');
const PAGE_SIZE = 50;

const handoffSearch = computed(() =>
  handoffSource.value === 'dream' ? searchText.value.trim() : '',
);
const handoffSourceLabel = computed(() =>
  handoffSource.value === 'dream' ? '来自梦境重放' : '来自外部入口',
);
const threadReceipts = computed(() =>
  new Map(
    threads.value.map((thread) => [
      thread.id,
      buildReflectionHandoffReceipt({ thread }),
    ]),
  ),
);
const hasMoreThreads = computed(() => threads.value.length < totalThreads.value);
const overdueVisibleCount = computed(() => {
  const currentSeconds = Math.floor(Date.now() / 1000);
  return threads.value.filter(
    thread =>
      thread.status === 'active' &&
      typeof thread.nextReflectionAt === 'number' &&
      thread.nextReflectionAt <= currentSeconds,
  ).length;
});
const emptyMessage = computed(() => {
  const query = searchText.value.trim();
  if (handoffSource.value === 'dream' && query) {
    return `没有找到与“${query}”对应的自我反思线程；可清除筛选后查看全部线程。`;
  }
  return '当前没有符合条件的自我反思线程';
});
const listScopeReceipt = computed(() => {
  const query = searchText.value.trim();
  const fromDream = handoffSource.value === 'dream' && query.length > 0;
  const staleSnapshot = Boolean(loadError.value && threads.value.length > 0);
  const visible = threads.value.length;
  const total = totalThreads.value || visible;
  const status = statusLabel(statusFilter.value);
  const overdue = overdueVisibleCount.value;
  const hasMore = hasMoreThreads.value;

  return {
    tone:
      staleSnapshot || overdue > 0
        ? 'attention'
        : fromDream || query
          ? 'handoff'
          : 'ready',
    title: staleSnapshot
      ? '保留上次成功快照'
      : fromDream
        ? '梦境复核筛选中的反思快照'
        : query
          ? '筛选后的反思快照'
          : '当前反思快照',
    summary: staleSnapshot
      ? '本次刷新没有拿到新的 Reflection 列表；下方仍是上次成功读取的线程快照。'
      : fromDream
        ? `当前只在自我反思线程内查找“${query}”，用于承接梦境重放复核。`
        : query
          ? `当前只按标题或 topic key 查找“${query}”，不会搜索全部原始记忆。`
          : overdue > 0
            ? `当前已读取的 ${visible} 条中有 ${overdue} 条已到推进时间；它们仍是只读快照，系统不会因为打开列表而自动补跑。`
            : '当前列表只读取 Reflection thread 索引，用来查看长期复盘主题。',
    statusLine: `${statusFilter.value === 'all' ? '全部状态' : status}`,
    searchLine: query
      ? `${fromDream ? '梦境 handoff' : '本页搜索'}: ${query}`
      : '未输入搜索词',
    countLine: `已读取 ${visible} / 总计 ${total}`,
    overdueLine:
      overdue > 0
        ? `已逾期 ${overdue} 条${hasMore ? '（仅已读取）' : ''}`
        : hasMore
          ? '当前已读取未见逾期'
          : '当前可见未见逾期',
    boundary:
      '筛选、搜索和刷新只读列表快照，不会运行反思、写记忆、确认决策、发送消息或执行动作。',
    chips: [
      staleSnapshot ? '上次成功快照' : '最新读取快照',
      statusFilter.value === 'all' ? '全部状态' : `状态 ${status}`,
      query ? '标题/topic key' : '无搜索词',
      fromDream ? '梦境复核' : '',
      `已读取 ${visible}`,
      overdue > 0 ? `已逾期 ${overdue}` : '当前未见逾期',
      hasMore ? `未读取 ${Math.max(total - visible, 0)}` : '已读取全部',
    ].filter((chip): chip is string => Boolean(chip)),
  };
});
const listPaginationReceipt = computed(() => {
  const visible = threads.value.length;
  const total = totalThreads.value;
  const remaining = Math.max(total - visible, 0);
  return {
    title: '还有线程未读取',
    summary: `已读取 ${visible} / ${total} 条，仍有 ${remaining} 条未读取。未读取线程不能被视为不存在、已处理或没有待推进事项。`,
    boundary:
      '加载更多只读取当前筛选和搜索条件的下一批线程；不会运行反思、改变线程状态、确认决策、发送消息或执行动作。',
  };
});
const loadMoreBoundary = computed(
  () =>
    `加载更多自我反思线程：只读取当前筛选的下一批，已读取 ${threads.value.length}/${totalThreads.value} 条；不会运行反思、写记忆、改变线程状态、确认决策、发送消息或执行动作。`,
);
const emptyFilterReceipt = computed(() => {
  if (
    loading.value ||
    loadError.value ||
    threads.value.length > 0
  ) {
    return null;
  }

  const query = searchText.value.trim();
  const fromDream = handoffSource.value === 'dream' && query.length > 0;
  const hasQuery = query.length > 0;
  const status = statusLabel(statusFilter.value);
  const total = totalThreads.value || 0;

  return {
    tone: fromDream ? 'handoff' : hasQuery ? 'attention' : 'ready',
    title: fromDream
      ? '梦境复核未匹配反思线程'
      : hasQuery
        ? '筛选未匹配反思线程'
        : '当前筛选没有反思线程',
    summary: fromDream
      ? `Memory Service 已按梦境复核请求查找“${query}”，但当前 Reflection thread 索引没有匹配项。`
      : hasQuery
        ? `Memory Service 已按标题或 topic key 查找“${query}”，当前没有匹配线程。`
        : `Memory Service 已读取 ${status} 线程列表，当前没有可展示线程。`,
    requestLine: hasQuery
      ? `${fromDream ? 'source=dream · ' : ''}search=${query} · 状态 ${status}`
      : `无搜索词 · 状态 ${status}`,
    resultLine: `服务返回 0 / 总计 ${total}`,
    boundary:
      '这是一次成功的列表读取，不会新建反思线程、运行 manual_revisit、写记忆、确认决策、发送消息或执行动作。',
    recovery: fromDream
      ? '清除筛选后查看全部线程；必要时回到梦境页换一个主题复核。'
      : hasQuery
        ? '修改搜索词或清除筛选；也可以切换状态查看暂停/关闭线程。'
        : '切换到全部状态或稍后刷新；没有空结果需要人工确认。',
    chips: [
      '成功空结果',
      fromDream ? '梦境 handoff' : '',
      hasQuery ? '标题/topic key' : '无搜索词',
      `状态 ${status}`,
      '无副作用',
    ].filter((chip): chip is string => Boolean(chip)),
  };
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
      limit: PAGE_SIZE,
      offset: 0,
    });
    threads.value = response.items;
    totalThreads.value = response.total;
    loadError.value = '';
  } catch (error) {
    console.error('Failed to load reflection threads:', error);
    loadError.value = errorMessage(error);
  } finally {
    loading.value = false;
  }
}

async function loadMoreThreads() {
  if (loadingMore.value || !hasMoreThreads.value) return;
  loadingMore.value = true;
  try {
    const response = await client.getReflectionThreads({
      status: statusFilter.value,
      search: searchText.value.trim() || undefined,
      limit: PAGE_SIZE,
      offset: threads.value.length,
    });
    const existingIds = new Set(threads.value.map(thread => thread.id));
    threads.value = [
      ...threads.value,
      ...response.items.filter(thread => !existingIds.has(thread.id)),
    ];
    totalThreads.value = response.total;
    loadError.value = '';
  } catch (error) {
    console.error('Failed to load more reflection threads:', error);
    loadError.value = errorMessage(error);
  } finally {
    loadingMore.value = false;
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

function threadReceipt(thread: ReflectionThread) {
  return (
    threadReceipts.value.get(thread.id) ??
    buildReflectionHandoffReceipt({ thread })
  );
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

.list-scope-box {
  border: 1px solid rgba(45, 212, 191, 0.2);
  border-left: 3px solid rgba(45, 212, 191, 0.7);
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.66);
  color: #cbd5e1;
  padding: 0.95rem;
  margin-bottom: 1rem;
}

.list-scope-box.handoff {
  border-color: rgba(45, 212, 191, 0.24);
  border-left-color: rgba(20, 184, 166, 0.86);
}

.list-scope-box.attention {
  border-color: rgba(248, 113, 113, 0.28);
  border-left-color: rgba(248, 113, 113, 0.82);
}

.list-scope-title {
  color: #99f6e4;
  font-size: 0.78rem;
  font-weight: 700;
  margin-bottom: 0.25rem;
}

.list-scope-box h3 {
  color: #e2e8f0;
  font-size: 0.96rem;
  margin: 0 0 0.3rem;
}

.list-scope-box p {
  color: #94a3b8;
  font-size: 0.82rem;
  line-height: 1.5;
  margin: 0;
}

.list-scope-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 0.65rem;
  margin-top: 0.8rem;
}

.list-scope-grid div {
  border: 1px solid rgba(148, 163, 184, 0.14);
  border-radius: 8px;
  background: rgba(30, 41, 59, 0.5);
  padding: 0.62rem;
  min-width: 0;
}

.list-scope-grid span {
  display: block;
  color: #64748b;
  font-size: 0.72rem;
  margin-bottom: 0.26rem;
}

.list-scope-grid strong {
  display: block;
  color: #e2e8f0;
  font-size: 0.78rem;
  line-height: 1.45;
  overflow-wrap: anywhere;
}

.list-scope-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-top: 0.72rem;
}

.list-scope-chip {
  border-radius: 999px;
  background: rgba(30, 41, 59, 0.82);
  color: #cbd5e1;
  font-size: 0.72rem;
  line-height: 1;
  padding: 0.28rem 0.48rem;
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

.refreshing-snapshot {
  border: 1px solid rgba(56, 189, 248, 0.22);
  border-left: 3px solid rgba(56, 189, 248, 0.78);
  border-radius: 8px;
  background: rgba(8, 47, 73, 0.36);
  color: #cbd5e1;
  padding: 0.78rem 0.9rem;
  margin-bottom: 1rem;
}

.refreshing-snapshot strong {
  display: block;
  color: #bae6fd;
  font-size: 0.84rem;
  margin-bottom: 0.25rem;
}

.refreshing-snapshot span {
  color: #94a3b8;
  font-size: 0.82rem;
  line-height: 1.5;
}

.empty-filter-receipt {
  border: 1px solid rgba(56, 189, 248, 0.2);
  border-left: 3px solid rgba(56, 189, 248, 0.75);
  border-radius: 8px;
  background: rgba(8, 47, 73, 0.32);
  color: #cbd5e1;
  padding: 0.95rem;
  margin-bottom: 1rem;
}

.empty-filter-receipt.handoff {
  border-color: rgba(45, 212, 191, 0.24);
  border-left-color: rgba(20, 184, 166, 0.86);
}

.empty-filter-receipt.attention {
  border-color: rgba(251, 191, 36, 0.28);
  border-left-color: rgba(251, 191, 36, 0.82);
}

.empty-filter-title {
  color: #bae6fd;
  font-size: 0.78rem;
  font-weight: 700;
  margin-bottom: 0.25rem;
}

.empty-filter-receipt.handoff .empty-filter-title {
  color: #99f6e4;
}

.empty-filter-receipt.attention .empty-filter-title {
  color: #fde68a;
}

.empty-filter-receipt h3 {
  color: #e2e8f0;
  font-size: 0.96rem;
  margin: 0 0 0.3rem;
}

.empty-filter-receipt p {
  color: #94a3b8;
  font-size: 0.82rem;
  line-height: 1.5;
  margin: 0;
}

.empty-filter-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.65rem;
  margin-top: 0.8rem;
}

.empty-filter-grid div {
  border: 1px solid rgba(148, 163, 184, 0.14);
  border-radius: 8px;
  background: rgba(30, 41, 59, 0.5);
  padding: 0.62rem;
  min-width: 0;
}

.empty-filter-grid span {
  display: block;
  color: #64748b;
  font-size: 0.72rem;
  margin-bottom: 0.26rem;
}

.empty-filter-grid strong {
  display: block;
  color: #e2e8f0;
  font-size: 0.78rem;
  line-height: 1.45;
  overflow-wrap: anywhere;
}

.empty-filter-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-top: 0.72rem;
}

.empty-filter-chip {
  border-radius: 999px;
  background: rgba(30, 41, 59, 0.82);
  color: #cbd5e1;
  font-size: 0.72rem;
  line-height: 1;
  padding: 0.28rem 0.48rem;
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
  margin-bottom: 0.8rem;
}

.thread-handoff {
  border: 1px solid rgba(148, 163, 184, 0.14);
  border-left: 3px solid rgba(56, 189, 248, 0.55);
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.58);
  padding: 0.75rem;
  margin-bottom: 0.85rem;
}

.thread-handoff.waiting {
  border-left-color: rgba(251, 191, 36, 0.78);
}

.thread-handoff.attention {
  border-left-color: rgba(248, 113, 113, 0.82);
}

.thread-handoff.paused {
  border-left-color: rgba(167, 139, 250, 0.76);
}

.thread-handoff.closed {
  border-left-color: rgba(148, 163, 184, 0.66);
}

.thread-handoff-title {
  color: #e2e8f0;
  font-size: 0.82rem;
  font-weight: 700;
  margin-bottom: 0.32rem;
}

.thread-handoff p {
  color: #94a3b8;
  font-size: 0.78rem;
  line-height: 1.45;
  margin: 0;
}

.thread-handoff-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.38rem;
  margin-top: 0.55rem;
}

.handoff-chip {
  border-radius: 999px;
  background: rgba(30, 41, 59, 0.82);
  color: #cbd5e1;
  font-size: 0.72rem;
  line-height: 1;
  padding: 0.28rem 0.48rem;
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

.list-pagination-receipt {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  border: 1px solid rgba(56, 189, 248, 0.24);
  border-left: 3px solid rgba(56, 189, 248, 0.82);
  border-radius: 8px;
  background: rgba(8, 47, 73, 0.3);
  color: #cbd5e1;
  padding: 0.9rem;
  margin-top: 1rem;
}

.list-pagination-title {
  color: #bae6fd;
  font-size: 0.78rem;
  font-weight: 700;
  margin-bottom: 0.25rem;
}

.list-pagination-receipt h3 {
  color: #e2e8f0;
  font-size: 0.96rem;
  margin: 0 0 0.3rem;
}

.list-pagination-receipt p {
  color: #94a3b8;
  font-size: 0.82rem;
  line-height: 1.5;
  margin: 0.22rem 0 0;
}

.load-more-btn {
  flex-shrink: 0;
  border: 1px solid rgba(125, 211, 252, 0.36);
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.72);
  color: #e0f2fe;
  cursor: pointer;
  padding: 0.52rem 0.78rem;
}

.load-more-btn:hover:not(:disabled) {
  border-color: rgba(125, 211, 252, 0.7);
  color: #fff;
}

.load-more-btn:disabled {
  cursor: wait;
  opacity: 0.7;
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

  .list-pagination-receipt {
    align-items: flex-start;
    flex-direction: column;
  }

  .list-scope-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .empty-filter-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .search-input {
    min-width: 0;
    width: 100%;
  }
}

@media (max-width: 640px) {
  .list-scope-grid {
    grid-template-columns: 1fr;
  }
}
</style>
