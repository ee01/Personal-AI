<template>
  <div id="memory-app">
    <!-- AI 搜索动画 -->
    <AISearchAnimation :show="store.isAISearching" />

    <div class="memory-container">
      <!-- 侧边栏 -->
      <div class="sidebar">
        <div class="sidebar-header">
          <div class="logo">🧠 {{ t('memoryExplorer.title') }}</div>
          <p class="sidebar-note">
            {{ t('memoryExplorer.sidebarNote') }}
          </p>
          <div
            v-if="memoryUserIdentity || memoryUserIdentityError"
            :class="[
              'memory-user-status',
              {
                warning:
                  memoryUserIdentity?.fallbackToDefault ||
                  Boolean(memoryUserIdentityError),
              },
            ]"
          >
            <span class="memory-user-dot" aria-hidden="true"></span>
            <div class="memory-user-copy">
              <div class="memory-user-label">
                {{ t('memoryExplorer.currentUser') }}
              </div>
              <div class="memory-user-value">
                {{
                  memoryUserIdentity?.id || t('memoryExplorer.unconfirmed')
                }}
              </div>
              <div
                v-if="memoryUserIdentity?.fallbackToDefault"
                class="memory-user-hint"
              >
                {{ t('memoryExplorer.defaultSpaceHint') }}
              </div>
              <div v-else-if="memoryUserIdentityError" class="memory-user-hint">
                {{ memoryUserIdentityError }}
              </div>
            </div>
          </div>
        </div>

        <div class="entity-types">
          <router-link
            to="/"
            class="entity-type"
            active-class="router-link-active"
          >
            <div class="entity-icon">🏠</div>
            <div class="entity-name">{{ t('memoryExplorer.nav.today') }}</div>
          </router-link>

          <router-link
            to="/timeline"
            class="entity-type"
            active-class="router-link-active"
          >
            <div class="entity-icon">⏰</div>
            <div class="entity-name">
              {{ t('memoryExplorer.nav.timeline') }}
            </div>
          </router-link>

          <router-link
            to="/meetings"
            class="entity-type"
            active-class="router-link-active"
          >
            <div class="entity-icon">📡</div>
            <div class="entity-name">
              {{ t('memoryExplorer.nav.meetings') }}
            </div>
            <div v-if="meetingCount > 0" class="entity-count">
              {{ meetingCount }}
            </div>
          </router-link>

          <router-link
            to="/user-profile"
            class="entity-type"
            active-class="router-link-active"
          >
            <div class="entity-icon">👤</div>
            <div class="entity-name">
              {{ t('memoryExplorer.nav.userProfile') }}
            </div>
          </router-link>

          <router-link
            to="/follow-threads"
            class="entity-type"
            active-class="router-link-active"
          >
            <div class="entity-icon">👁</div>
            <div class="entity-labels">
              <div class="entity-name">
                {{ t('memoryExplorer.nav.followThreads') }}
              </div>
              <div class="entity-subnote">
                {{ t('memoryExplorer.nav.followThreadsSubnote') }}
              </div>
            </div>
            <div class="entity-count">{{ followThreadCount }}</div>
          </router-link>

          <router-link
            to="/dreams"
            class="entity-type"
            active-class="router-link-active"
          >
            <div class="entity-icon">🌙</div>
            <div class="entity-name">
              {{ t('memoryExplorer.nav.dreams') }}
            </div>
          </router-link>

          <router-link
            to="/reports"
            class="entity-type"
            active-class="router-link-active"
          >
            <div class="entity-icon">📄</div>
            <div class="entity-name">
              {{ t('memoryExplorer.nav.reports') }}
            </div>
          </router-link>

          <router-link
            to="/reflection-threads"
            class="entity-type"
            active-class="router-link-active"
          >
            <div class="entity-icon">🧠</div>
            <div class="entity-name">
              {{ t('memoryExplorer.nav.reflection') }}
            </div>
            <div v-if="activeReflectionCount > 0" class="entity-count">
              {{ activeReflectionCount }}
            </div>
          </router-link>

          <router-link
            to="/rehearsals"
            class="entity-type"
            active-class="router-link-active"
          >
            <div class="entity-icon">🎭</div>
            <div class="entity-labels">
              <div class="entity-name">
                {{ t('memoryExplorer.nav.rehearsal') }}
              </div>
              <div class="entity-subnote">
                {{ t('memoryExplorer.nav.rehearsalSubnote') }}
              </div>
            </div>
          </router-link>

          <router-link
            to="/decisions"
            class="entity-type"
            active-class="router-link-active"
          >
            <div class="entity-icon">⚖️</div>
            <div class="entity-name">
              {{ t('memoryExplorer.nav.decisions') }}
            </div>
            <div v-if="pendingDecisionCount > 0" class="entity-count">
              {{ pendingDecisionCount }}
            </div>
          </router-link>

          <router-link
            to="/storylines"
            class="entity-type"
            active-class="router-link-active"
          >
            <div class="entity-icon">🧵</div>
            <div class="entity-labels">
              <div class="entity-name">
                {{ t('memoryExplorer.nav.storylines') }}
              </div>
              <div class="entity-subnote">
                {{ t('memoryExplorer.nav.storylinesSubnote') }}
              </div>
            </div>
          </router-link>

          <router-link
            to="/actions"
            class="entity-type"
            active-class="router-link-active"
          >
            <div class="entity-icon">⚙️</div>
            <div class="entity-name">
              {{ t('memoryExplorer.nav.actions') }}
            </div>
            <div v-if="queuedActionCount > 0" class="entity-count">
              {{ queuedActionCount }}
            </div>
          </router-link>

          <router-link
            to="/outreach"
            class="entity-type"
            active-class="router-link-active"
          >
            <div class="entity-icon">📡</div>
            <div class="entity-labels">
              <div class="entity-name">
                {{ t('memoryExplorer.nav.outreach') }}
              </div>
              <div class="entity-subnote">
                {{ t('memoryExplorer.nav.outreachSubnote') }}
              </div>
            </div>
            <div v-if="outreachSessionCount > 0" class="entity-count">
              {{ outreachSessionCount }}
            </div>
          </router-link>

          <hr class="sidebar-divider" />

          <router-link
            to="/skills"
            class="entity-type"
            active-class="router-link-active"
          >
            <div class="entity-icon">🧪</div>
            <div class="entity-labels">
              <div class="entity-name">
                {{ t('memoryExplorer.nav.skills') }}
              </div>
              <div class="entity-subnote">
                {{ t('memoryExplorer.nav.skillsSubnote') }}
              </div>
            </div>
            <div v-if="skillCount > 0" class="entity-count">
              {{ skillCount }}
            </div>
          </router-link>

          <router-link
            to="/coverage"
            class="entity-type"
            active-class="router-link-active"
          >
            <div class="entity-icon">🗺</div>
            <div class="entity-labels">
              <div class="entity-name">
                {{ t('memoryExplorer.nav.coverage') }}
              </div>
              <div class="entity-subnote">
                {{ t('memoryExplorer.nav.coverageSubnote') }}
              </div>
            </div>
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
              :placeholder="t('memoryExplorer.search.placeholder')"
              v-model="searchQuery"
              @input="handleSearchInput"
              @keypress.enter="handleSearch"
            />
          </div>
          <div
            class="scope-segmented"
            role="group"
            :aria-label="t('memoryExplorer.search.scopeAria')"
          >
            <button
              v-for="option in recallScopeOptions"
              :key="option.value"
              type="button"
              :title="option.title"
              :aria-pressed="selectedRecallScope === option.value"
              :class="[
                'scope-option',
                { active: selectedRecallScope === option.value },
              ]"
              @click="selectRecallScope(option.value)"
            >
              {{ option.label }}
            </button>
          </div>
          <button class="filter-btn" @click="handleSearch">
            📊 {{ t('common.search') }}
          </button>
          <button class="filter-btn" @click="clearSearch">
            🔄 {{ t('common.reset') }}
          </button>
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
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useMemoryStore } from './memory-store';
import AISearchAnimation from './components/AISearchAnimation.vue';
import {
  getMemoryServiceClient,
  MemoryServiceError,
  type OutreachTemplateRuntimeStatusItem,
  type RecallScope,
} from '../services/MemoryServiceClient';
import { initExtensionVueI18n, vueT } from '../i18n/vue';

/* eslint-disable no-undef */
declare const chrome: any;
/* eslint-enable no-undef */

// 应用初始化逻辑
const store = useMemoryStore();
const router = useRouter();
const route = useRoute();
const t = vueT;
const entityTypes = computed(() => store.entityTypes);
const searchQuery = ref('');
const selectedRecallScope = ref<RecallScope>('work');
const followThreadCount = ref(0);
const meetingCount = ref(0);
const pendingDecisionCount = ref(0);
const activeReflectionCount = ref(0);
const queuedActionCount = ref(0);
const outreachSessionCount = ref(0);
const skillCount = ref(0);
const memoryUserIdentity = ref<{
  id: string;
  fallbackToDefault: boolean;
} | null>(null);
const memoryUserIdentityError = ref('');
let outreachCountTimer: ReturnType<typeof setInterval> | null = null;
const TERMINAL_OUTREACH_STATUSES = new Set([
  'resolved',
  'no_reply',
  'escalated',
  'cancelled',
  'failed',
]);
const stopI18n = initExtensionVueI18n();
onUnmounted(() => {
  stopI18n();
});

const recallScopeOptions = computed<
  Array<{
  value: RecallScope;
  label: string;
  title: string;
  }>
>(() => [
  {
    value: 'work',
    label: t('common.work'),
    title: t('memoryExplorer.scope.work.title'),
  },
  {
    value: 'personal',
    label: t('common.personal'),
    title: t('memoryExplorer.scope.personal.title'),
  },
  {
    value: 'all',
    label: t('common.all'),
    title: t('memoryExplorer.scope.all.title'),
  },
]);

function normalizeClientRecallScope(value: unknown): RecallScope | null {
  const rawValue = Array.isArray(value) ? value[0] : value;
  if (rawValue === 'both') return 'all';
  if (
    rawValue === 'work' ||
    rawValue === 'personal' ||
    rawValue === 'all'
  ) {
    return rawValue;
  }
  return null;
}

function getRouteSearchQuery() {
  const rawQuery = route.query.q;
  if (Array.isArray(rawQuery)) return String(rawQuery[0] || '');
  return typeof rawQuery === 'string' ? rawQuery : '';
}

function getRouteRecallScope(): RecallScope {
  const routeScope = normalizeClientRecallScope(route.query.scope);
  if (routeScope) return routeScope;
  return route.path === '/timeline' ? 'all' : 'work';
}

function syncSearchControlsFromRoute() {
  selectedRecallScope.value = getRouteRecallScope();
  const routedQuery = getRouteSearchQuery();
  if (routedQuery) {
    searchQuery.value = routedQuery;
  }
}

async function hydrateSearchFromRoute() {
  if (route.path !== '/search') return;
  const routedQuery = getRouteSearchQuery().trim();
  if (routedQuery.length < 2) return;

  const routedScope = getRouteRecallScope();
  searchQuery.value = routedQuery;
  selectedRecallScope.value = routedScope;

  if (
    store.searchContext.mode &&
    store.searchContext.query === routedQuery &&
    store.searchContext.scope === routedScope
  ) {
    return;
  }

  await store.performAskSearch(routedQuery, routedScope);
}

function hasChromeStorage() {
  return typeof chrome !== 'undefined' && Boolean(chrome.storage?.local);
}

function hasChromeStorageChangeListener() {
  return typeof chrome !== 'undefined' && Boolean(chrome.storage?.onChanged);
}

async function loadFollowThreadCount() {
  if (!hasChromeStorage()) {
    followThreadCount.value = 0;
    return;
  }

  try {
    const result = await chrome.storage.local.get('concernedItems');
    const items = (result.concernedItems || []).filter((item: any) => {
      if (item?.source && item.source !== 'manual') return false;
      if (typeof item?.id === 'string' && item.id.startsWith('outreach:')) {
        return false;
      }
      return true;
    });
    followThreadCount.value = items.filter(
      (item: any) => item.followThread && item.followConfig,
    ).length;
  } catch (error) {
    console.error('加载关注后续数量失败:', error);
  }
}

async function loadMeetingCount() {
  if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_MEETINGS',
        limit: 1,
        offset: 0,
      });
      if (response?.success) {
        meetingCount.value = Number(
          response?.data?.total || response?.total || 0,
        );
        return;
      }
    } catch (error) {
      console.warn('通过消息通道加载会议数量失败，尝试直接请求:', error);
    }
  }

  try {
    const client = getMemoryServiceClient();
    const result = await client.getMeetings(1, 0);
    meetingCount.value = Number(result.total || 0);
  } catch (error) {
    console.error('加载会议记录数量失败:', error);
    meetingCount.value = 0;
  }
}

async function loadPendingDecisionCount() {
  try {
    const client = getMemoryServiceClient();
    const res = await client.getConfirmRequests('pending', 1, 'decision');
    pendingDecisionCount.value = res.total;
  } catch (error) {
    console.error('加载待决策数量失败:', error);
    pendingDecisionCount.value = 0;
  }
}

async function loadMemoryUserIdentity() {
  try {
    const client = getMemoryServiceClient();
    const stats = await client.getStats();
    const identity = stats.user;
    const fallbackId = client.getUserId();
    memoryUserIdentity.value = {
      id: identity?.id || fallbackId,
      fallbackToDefault:
        identity?.fallbackToDefault ?? fallbackId === 'default',
    };
    memoryUserIdentityError.value = '';
  } catch (error) {
    console.error('加载当前记忆用户失败:', error);
    const client = getMemoryServiceClient();
    memoryUserIdentity.value = {
      id: client.getUserId(),
      fallbackToDefault: client.getUserId() === 'default',
    };
    memoryUserIdentityError.value = describeMemoryUserIdentityError(error);
  }
}

function describeMemoryUserIdentityError(error: unknown) {
  if (error instanceof MemoryServiceError) {
    const errorCode = String(error.body?.code || '');
    const errorMessage = String(error.body?.message || error.message || '');
    if (error.status === 404) {
      return '服务端未提供身份校验接口，当前按本机用户访问。';
    }
    if (
      error.status >= 500 &&
      /SQLITE_CORRUPT|database disk image is malformed/i.test(
        `${errorCode} ${errorMessage}`,
      )
    ) {
      return '服务端记忆库当前异常，身份边界暂时无法校验。';
    }
    return `服务端暂时无法确认身份边界（${error.status}）。`;
  }
  return '无法确认服务端身份边界。';
}

function handleStorageChange(
  changes: { [key: string]: chrome.storage.StorageChange },
  areaName: string,
) {
  if (areaName === 'local' && changes.concernedItems) {
    void loadFollowThreadCount();
  }
  if (areaName === 'local' && changes.userinfo) {
    void loadMemoryUserIdentity();
  }
}

// 加载关注后续数量
onMounted(async () => {
  await loadFollowThreadCount();
  await loadMeetingCount();
  await loadMemoryUserIdentity();
  if (hasChromeStorageChangeListener()) {
    chrome.storage.onChanged.addListener(handleStorageChange);
  }
});

onUnmounted(() => {
  if (hasChromeStorageChangeListener()) {
    chrome.storage.onChanged.removeListener(handleStorageChange);
  }
  if (outreachCountTimer) {
    clearInterval(outreachCountTimer);
    outreachCountTimer = null;
  }
});

// 加载待决策数量
onMounted(async () => {
  await loadPendingDecisionCount();
});

onMounted(async () => {
  try {
    const client = getMemoryServiceClient();
    const [threads, actions] = await Promise.all([
      client.getReflectionThreads({ status: 'active', limit: 1 }),
      client.getActions({ queueStatus: 'queued', limit: 1 }),
    ]);
    activeReflectionCount.value = threads.total;
    queuedActionCount.value = actions.total;
  } catch (error) {
    console.error('加载反思线程/动作数量失败:', error);
  }
});

async function loadOutreachSummaryCount() {
  try {
    const client = getMemoryServiceClient();
    const [runtime, summary, templates] = await Promise.all([
      client.getRuntimeConfig(),
      client.getOutreachSummary(),
      client.getOutreachTemplateRuntimeStatus(undefined, 100),
    ]);
    if (!runtime.outreachEnabled) {
      outreachSessionCount.value = 0;
      return;
    }
    const pendingTemplateCount = countPendingOutreachTemplates(templates.items);
    outreachSessionCount.value =
      Number(summary.upcomingCount || 0) +
      Number(summary.waitingReplyCount || 0) +
      Number(summary.escalatedCount || 0) +
      pendingTemplateCount;
  } catch (error) {
    console.error('加载主动询问数量失败:', error);
    outreachSessionCount.value = 0;
  }
}

async function loadSkillCount() {
  try {
    const client = getMemoryServiceClient();
    const [active, suggestions] = await Promise.all([
      client.getPersonalSkills({ filter: 'active' }),
      client.getSkillSuggestions(),
    ]);
    skillCount.value = Number(active.total || 0) + Number(suggestions.total || 0);
  } catch (error) {
    console.error('加载个人技能数量失败:', error);
    skillCount.value = 0;
  }
}

function countPendingOutreachTemplates(
  items: OutreachTemplateRuntimeStatusItem[],
): number {
  return items.filter((item) => isPendingTemplate(item)).length;
}

function isPendingTemplate(item: OutreachTemplateRuntimeStatusItem): boolean {
  const template = item.template;
  const nextDispatchAt = resolveTemplateNextDispatchAt(item);
  if (template.enabled === false) return false;
  if (template.syncState && template.syncState !== 'synced') return false;
  if (!nextDispatchAt) return false;
  return (
    !item.latestSession ||
    TERMINAL_OUTREACH_STATUSES.has(item.latestSession.status)
  );
}

function resolveTemplateNextDispatchAt(
  item: OutreachTemplateRuntimeStatusItem,
): number | null {
  const raw = item.template.scheduleSpec?.nextDispatchAt;
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return raw;
  const scheduleDate =
    typeof item.template.scheduleSpec?.scheduleDate === 'string'
      ? item.template.scheduleSpec.scheduleDate
      : '';
  const scheduleTime =
    typeof item.template.scheduleSpec?.scheduleTime === 'string'
      ? item.template.scheduleSpec.scheduleTime
      : '09:00';
  if (!scheduleDate) return null;
  const date = new Date(
    `${scheduleDate}T${
      scheduleTime.length === 5 ? `${scheduleTime}:00` : scheduleTime
    }`,
  );
  if (Number.isNaN(date.getTime())) return null;
  return Math.floor(date.getTime() / 1000);
}

onMounted(async () => {
  await loadOutreachSummaryCount();
  await loadSkillCount();
  outreachCountTimer = setInterval(() => {
    void loadOutreachSummaryCount();
    void loadSkillCount();
  }, 60_000);
});

const handleSearchInput = () => {
  // 今日领航搜索：不在输入时触发搜索，避免频繁调用 ask()
  // 用户需要按 Enter 或点击搜索按钮才触发
  if (router.currentRoute.value.path.startsWith('/entity/')) {
    store.searchQuery = searchQuery.value;
  }
};

const handleSearch = () => {
  if (searchQuery.value.trim()) {
    performSearch();
  }
};

const selectRecallScope = (scope: RecallScope) => {
  if (selectedRecallScope.value === scope) return;
  selectedRecallScope.value = scope;

  const query = searchQuery.value.trim();
  if (router.currentRoute.value.path === '/search' && query.length >= 2) {
    performSearch();
  }
};

const performSearch = () => {
  if (searchQuery.value.trim().length < 2) return;

  const path = router.currentRoute.value.path;

  // 判断搜索模式
  // 1. 如果在搜索结果页再次搜索，保留原来的搜索模式
  if (path === '/search' && store.searchContext.mode) {
    if (store.searchContext.mode === 'overview') {
      // 原来是 AI 搜索，继续用 AI 搜索
      console.log('[搜索] 保持智能 AI 搜索模式:', searchQuery.value);
      store.performAskSearch(searchQuery.value, selectedRecallScope.value);
    } else if (store.searchContext.mode === 'entity') {
      // 原来是实体向量搜索，继续用实体向量搜索
      const entityType = store.searchContext.entityType;
      console.log(
        '[搜索] 保持实体向量搜索模式:',
        searchQuery.value,
        entityType,
      );
      store.performEntityVectorSearch(
        searchQuery.value,
        entityType,
        selectedRecallScope.value,
      );
    }
  } else if (path === '/' || path === '/user-profile' || path === '/timeline') {
    // 今日领航、用户画像、时间轴 - 使用 ask() 智能搜索
    console.log('[搜索] 执行智能 AI 搜索:', searchQuery.value);
    store.performAskSearch(searchQuery.value, selectedRecallScope.value);
  } else if (path.startsWith('/entity/')) {
    // 分栏搜索 - 使用向量匹配
    const entityType =
      path === '/entity/Person' ? 'Person' : (route.params.type as string);
    console.log('[搜索] 执行实体向量搜索:', searchQuery.value, entityType);
    store.performEntityVectorSearch(
      searchQuery.value,
      entityType,
      selectedRecallScope.value,
    );
  } else {
    // 其他情况 - 通用向量搜索
    console.log('[搜索] 执行通用向量搜索:', searchQuery.value);
    store.performEntityVectorSearch(
      searchQuery.value,
      undefined,
      selectedRecallScope.value,
    );
  }

  // 跳转到搜索结果页
  router.push({
    path: '/search',
    query: { q: searchQuery.value, scope: selectedRecallScope.value },
  });
};

const clearSearch = () => {
  searchQuery.value = '';
  selectedRecallScope.value = 'work';
  store.clearSearchContext();
  router.push('/');
};

onMounted(() => {
  syncSearchControlsFromRoute();
  // 直接初始化 store，MemorySystem 会自动初始化
  store.initialize();
  void hydrateSearchFromRoute();
});

watch(
  () => [route.path, route.query.q, route.query.scope],
  () => {
    syncSearchControlsFromRoute();
    void hydrateSearchFromRoute();
  },
);
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
  font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI',
    Roboto, sans-serif;
  background: linear-gradient(135deg, #0c0c0c 0%, #1a1a2e 50%, #16213e 100%);
  color: #ffffff;
  height: max-content;
  overflow-x: hidden;
  min-height: 100vh;
}

html,
#memory-app {
  min-height: 100vh;
  background: linear-gradient(135deg, #0c0c0c 0%, #1a1a2e 50%, #16213e 100%);
}

#memory-app {
  height: max-content;
}

.memory-container {
  display: flex;
  min-height: 100vh;
  font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI',
    Roboto, sans-serif;
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
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  height: 100vh;
  max-height: 100vh;
  min-height: 0;
  overflow: hidden;
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

.sidebar-note {
  margin-top: 0.85rem;
  color: #cbd5e1;
  font-size: 0.78rem;
  line-height: 1.55;
}

.memory-user-status {
  display: grid;
  grid-template-columns: 0.55rem minmax(0, 1fr);
  gap: 0.6rem;
  align-items: start;
  margin-top: 1rem;
  padding: 0.75rem;
  border: 1px solid rgba(34, 197, 94, 0.28);
  border-radius: 0.5rem;
  background: rgba(15, 23, 42, 0.62);
}

.memory-user-status.warning {
  border-color: rgba(245, 158, 11, 0.36);
  background: rgba(69, 48, 12, 0.28);
}

.memory-user-dot {
  width: 0.5rem;
  height: 0.5rem;
  margin-top: 0.25rem;
  border-radius: 999px;
  background: #22c55e;
  box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.12);
}

.memory-user-status.warning .memory-user-dot {
  background: #f59e0b;
  box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.14);
}

.memory-user-copy {
  min-width: 0;
}

.memory-user-label {
  color: #94a3b8;
  font-size: 0.68rem;
  line-height: 1.2;
}

.memory-user-value {
  margin-top: 0.15rem;
  color: #f8fafc;
  font-size: 0.82rem;
  font-weight: 650;
  line-height: 1.25;
  overflow-wrap: anywhere;
}

.memory-user-hint {
  margin-top: 0.35rem;
  color: #fbbf24;
  font-size: 0.7rem;
  line-height: 1.4;
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
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
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

.entity-labels {
  flex: 1;
  min-width: 0;
}

.entity-subnote {
  margin-top: 0.15rem;
  color: #94a3b8;
  font-size: 0.7rem;
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

.scope-segmented {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  padding: 0.2rem;
  background: rgba(15, 23, 42, 0.65);
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 0.75rem;
}

.scope-option {
  min-width: 3.25rem;
  padding: 0.55rem 0.75rem;
  background: transparent;
  border: none;
  border-radius: 0.55rem;
  color: #94a3b8;
  cursor: pointer;
  font-size: 0.86rem;
  font-weight: 700;
  line-height: 1.2;
  white-space: nowrap;
}

.scope-option:hover {
  color: #e2e8f0;
  background: rgba(148, 163, 184, 0.12);
}

.scope-option.active {
  color: #f8fafc;
  background: rgba(16, 185, 129, 0.26);
  box-shadow: inset 0 0 0 1px rgba(52, 211, 153, 0.35);
}

/* 页面过渡动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* 概览样式 */
.overview-section {
  animation: fadeInUp 0.6s ease-out;
}

.greeting-card {
  background: linear-gradient(
    135deg,
    rgba(59, 130, 246, 0.1),
    rgba(147, 51, 234, 0.1)
  );
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
  font-size: 0.875rem;
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
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
  background: linear-gradient(
    90deg,
    transparent,
    rgba(148, 163, 184, 0.3),
    transparent
  );
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
  background: linear-gradient(
    135deg,
    rgba(59, 130, 246, 0.1),
    rgba(147, 51, 234, 0.1)
  );
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
  html {
    height: auto;
    min-height: 100%;
    overflow-y: auto;
  }

  body {
    height: auto;
    min-height: 100vh;
    overflow-y: auto;
  }

  #memory-app {
    height: auto;
    min-height: 100vh;
  }

  .memory-container {
    flex-direction: column;
    min-height: 100vh;
    overflow-x: hidden;
    overflow-y: auto;
  }

  .sidebar {
    width: 100%;
    height: auto;
    max-height: none;
    display: block;
    overflow: visible;
    position: static;
    padding: 1rem 0 0.7rem;
    border-right: none;
    border-bottom: 1px solid rgba(148, 163, 184, 0.1);
  }

  .sidebar-header {
    padding: 0 1rem 0.75rem;
  }

  .sidebar-note {
    display: none;
  }

  .logo {
    font-size: 1.25rem;
  }

  .entity-types {
    display: flex;
    flex: none;
    min-height: auto;
    gap: 0.4rem;
    overflow-x: auto;
    overflow-y: hidden;
    padding: 0.75rem 1rem 0.1rem;
  }

  .entity-type {
    flex: 0 0 auto;
    min-width: max-content;
    margin: 0;
    padding: 0.5rem 0.7rem;
    border-left: 0;
    border-bottom: 2px solid transparent;
    border-radius: 0.55rem;
  }

  .entity-type:hover,
  .entity-type.router-link-active {
    border-left-color: transparent;
    border-bottom-color: #60a5fa;
  }

  .entity-icon {
    margin-right: 0.45rem;
  }

  .entity-subnote,
  .sidebar-divider {
    display: none;
  }

  .main-content {
    padding: 1rem;
    width: 100%;
    height: auto;
    max-height: none;
    overflow: visible;
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

  .scope-segmented,
  .filter-btn {
    width: 100%;
  }

  .scope-option {
    flex: 1;
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
