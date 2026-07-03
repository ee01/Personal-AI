<template>
  <div class="follow-threads-container">
    <div class="header">
      <div>
        <h2>👁 关注后续</h2>
        <p class="page-subtitle">
          这里只展示你手动规则里显式开启的关注后续。系统内部观察不会出现在这里。
        </p>
      </div>
      <div class="controls">
        <select v-model="statusFilter" class="filter-select">
          <option value="all">全部</option>
          <option value="active">进行中</option>
          <option value="expired">已过期</option>
        </select>
        <select v-model="sortBy" class="filter-select">
          <option value="created">创建时间</option>
          <option value="expires">到期时间</option>
          <option value="related">关联数</option>
        </select>
      </div>
    </div>

    <div class="info-banner">
      <div class="info-banner-title">FollowThreads 只统计手动规则</div>
      <p class="info-banner-text">
        帮我问 /
        自我反思等系统内部规则产生的后续跟踪会在主动询问页面展示证据状态，不会写进这里的列表或计数。
      </p>
    </div>

    <div
      v-if="actionReceipt"
      class="follow-action-receipt"
      :class="actionReceipt.tone"
      role="status"
      aria-live="polite"
    >
      <strong>{{ actionReceipt.title }}</strong>
      <span>{{ actionReceipt.body }}</span>
    </div>

    <div class="summary-row">
      <span class="summary-pill">手动规则 {{ items.length }}</span>
      <span class="summary-pill">进行中 {{ activeCount }}</span>
      <span class="summary-pill warn">已过期 {{ expiredCount }}</span>
      <span class="summary-pill info">关联消息 {{ relatedHitCount }}</span>
    </div>

    <div v-if="loading" class="loading">
      <div class="spinner"></div>
      <p>加载中...</p>
    </div>

    <div v-else-if="filteredItems.length === 0" class="empty-state">
      <div class="empty-icon">👁</div>
      <p>{{ emptyStateTitle }}</p>
      <p class="hint">{{ emptyStateHint }}</p>
      <p v-if="showFilteredEmptyBoundary" class="hint filter-boundary">
        {{ emptyStateBoundaryText }}
      </p>
      <button
        v-if="showFilteredEmptyBoundary"
        type="button"
        class="btn-secondary empty-reset-btn"
        @click="resetStatusFilter"
      >
        查看全部
      </button>
    </div>

    <div v-else class="follow-list">
      <div
        v-for="item in filteredItems"
        :key="item.id"
        class="follow-item"
        :class="{ expired: isExpired(item) }"
      >
        <div class="item-header">
          <div class="item-info">
            <h3 class="item-title">{{ item.text }}</h3>
            <div class="item-meta">
              <span class="sender">{{
                item.followConfig.originalMessage.sender
              }}</span>
              <span class="separator">•</span>
              <span class="team">{{
                item.followConfig.originalMessage.teamName
              }}</span>
              <span class="separator">•</span>
              <span class="status-badge" :class="{ expired: isExpired(item) }">
                {{ isExpired(item) ? '已过期' : '进行中' }}
              </span>
              <span class="separator">•</span>
              <span class="rule-ref">manual:{{ item.id }}</span>
            </div>
          </div>
          <div class="item-actions">
            <button
              v-if="!isExpired(item)"
              @click="extendFollow(item)"
              class="btn-secondary"
              title="延长关注"
            >
              ⏰ 延长
            </button>
            <button
              @click="cancelFollow(item)"
              class="btn-danger"
              title="取消关注"
            >
              ❌ 取消
            </button>
          </div>
        </div>

        <div class="item-stats">
          <div class="stat">
            <span class="stat-label">关联消息</span>
            <span class="stat-value">{{
              item.followConfig.relatedMessages.length
            }}</span>
          </div>
          <div class="stat">
            <span class="stat-label">通知方式</span>
            <span class="stat-value">{{
              getNotifyMethodText(item.notifyMethod || 'bot')
            }}</span>
          </div>
          <div class="stat">
            <span class="stat-label">到期时间</span>
            <span class="stat-value">{{
              formatExpireTime(item.expiredAt)
            }}</span>
          </div>
          <div class="stat">
            <span class="stat-label">最新关联</span>
            <span class="stat-value">{{ latestRelatedTime(item) }}</span>
          </div>
        </div>

        <div class="watch-status-receipt" role="note">
          <div class="watch-status-title">
            {{ getManagementStatusReceipt(item).title }}
          </div>
          <p>{{ getManagementStatusReceipt(item).stateText }}</p>
          <p>{{ getManagementStatusReceipt(item).hitText }}</p>
          <p>{{ getManagementStatusReceipt(item).deliveryText }}</p>
          <p>{{ getManagementStatusReceipt(item).boundaryText }}</p>
        </div>

        <div class="original-message">
          <div class="message-label">原消息</div>
          <div class="message-content">
            {{ item.followConfig.originalMessage.content }}
          </div>
          <a
            :href="item.followConfig.originalMessage.messageUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="message-link"
          >
            🔗 查看原消息
          </a>
        </div>

        <div class="timeline-section">
          <div class="timeline-header" @click="toggleTimeline(item.id)">
            <span class="timeline-title">
              命中时间线 ({{ item.followConfig.relatedMessages.length }})
            </span>
            <span class="toggle-icon">{{
              expandedItems.has(item.id) ? '▼' : '▶'
            }}</span>
          </div>

          <div v-if="expandedItems.has(item.id)" class="timeline">
            <div
              v-for="(msg, index) in item.followConfig.relatedMessages"
              :key="index"
              class="timeline-item"
            >
              <div class="timeline-dot"></div>
              <div class="timeline-content">
                <div class="timeline-meta">
                  <span class="timeline-sender">{{ msg.sender }}</span>
                  <span class="timeline-type">{{
                    getRelationTypeText(msg.relationType)
                  }}</span>
                  <span class="timeline-time">{{
                    formatTime(msg.datetime)
                  }}</span>
                </div>
                <div v-if="msg.summary" class="timeline-summary">
                  {{ msg.summary }}
                </div>
                <div class="timeline-notification-status">
                  {{ getHitStatusText(msg) }}
                </div>
              </div>
            </div>

            <div
              v-if="item.followConfig.relatedMessages.length === 0"
              class="timeline-empty"
            >
              暂无关联消息
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import {
  buildFollowThreadCancelReceipt,
  buildFollowThreadExtendedReceipt,
  buildFollowThreadHitStatusText,
  buildFollowThreadManagementStatusReceipt,
  formatFollowThreadExpiry,
  getFollowThreadExtendedExpiry,
  getFollowThreadNotifyMethodText,
  isFollowThreadRuleExpired,
  type FollowThreadManagementReceipt,
  type FollowThreadManagementStatusReceipt,
} from '../../message-reaction/followThreadPresentation';

/* eslint-disable no-undef */
declare const chrome: any;
/* eslint-enable no-undef */

interface FollowThreadItem {
  id: string;
  text: string;
  expiredAt: number; // rule 的过期时间
  // 🆕 通用通知配置（移到外层）
  notifyMethod?: string;
  notifyFrequency?: 'immediate' | 'merged';
  followConfig: {
    originalMessage: {
      postId: string;
      teamId: string;
      teamName: string;
      sender: string;
      content: string;
      datetime: string;
      messageUrl: string;
    };
    createdAt: string;
    // 🆕 移除 expiresAt 和通知配置，使用外层字段
    keywordFilter?: string[];
    relatedMessages: Array<{
      postId: string;
      sender: string;
      datetime: string;
      relationType:
        | 'thread_reply'
        | 'mention'
        | 'quote'
        | 'semantic'
        | 'direct_reply'
        | 'same_thread'
        | 'semantic_related';
      notifiedAt?: string;
      summary?: string;
    }>;
  };
}

const loading = ref(true);
const items = ref<FollowThreadItem[]>([]);
const statusFilter = ref('all');
const sortBy = ref('created');
const expandedItems = ref(new Set<string>());
const actionReceipt = ref<FollowThreadManagementReceipt | null>(null);

onMounted(async () => {
  await loadFollowThreads();

  chrome.storage.onChanged.addListener(handleStorageChange);
});

onUnmounted(() => {
  chrome.storage.onChanged.removeListener(handleStorageChange);
});

async function loadFollowThreads() {
  try {
    loading.value = true;
    const result = await chrome.storage.local.get('concernedItems');
    const allItems = (result.concernedItems || []).filter((item: any) => {
      if (item?.source && item.source !== 'manual') return false;
      if (typeof item?.id === 'string' && item.id.startsWith('outreach:')) {
        return false;
      }
      return true;
    });

    // 筛选出有 followThread 配置的项
    items.value = allItems.filter(
      (item: any) => item.followThread && item.followConfig,
    );
  } catch (error) {
    console.error('❌ 加载关注项失败:', error);
  } finally {
    loading.value = false;
  }
}

function handleStorageChange(
  changes: { [key: string]: chrome.storage.StorageChange },
  areaName: string,
) {
  if (areaName === 'local' && changes.concernedItems) {
    void loadFollowThreads();
  }
}

function getExpirySortValue(item: FollowThreadItem): number {
  return item.expiredAt && item.expiredAt > 0
    ? item.expiredAt
    : Number.POSITIVE_INFINITY;
}

const filteredItems = computed(() => {
  let filtered = items.value;

  // 状态过滤
  if (statusFilter.value === 'active') {
    filtered = filtered.filter((item) => !isExpired(item));
  } else if (statusFilter.value === 'expired') {
    filtered = filtered.filter((item) => isExpired(item));
  }

  // 排序
  if (sortBy.value === 'created') {
    filtered = [...filtered].sort(
      (a, b) =>
        new Date(b.followConfig.createdAt).getTime() -
        new Date(a.followConfig.createdAt).getTime(),
    );
  } else if (sortBy.value === 'expires') {
    filtered = [...filtered].sort(
      (a, b) => getExpirySortValue(a) - getExpirySortValue(b),
    );
  } else if (sortBy.value === 'related') {
    filtered = [...filtered].sort(
      (a, b) =>
        b.followConfig.relatedMessages.length -
        a.followConfig.relatedMessages.length,
    );
  }

  return filtered;
});

const activeCount = computed(
  () => items.value.filter((item) => !isExpired(item)).length,
);

const expiredCount = computed(
  () => items.value.filter((item) => isExpired(item)).length,
);

const relatedHitCount = computed(() =>
  items.value.reduce(
    (total, item) => total + item.followConfig.relatedMessages.length,
    0,
  ),
);

const showFilteredEmptyBoundary = computed(
  () =>
    items.value.length > 0 &&
    filteredItems.value.length === 0 &&
    statusFilter.value !== 'all',
);

const emptyStateTitle = computed(() => {
  if (!showFilteredEmptyBoundary.value) return '暂无手动关注项';
  if (statusFilter.value === 'active') return '当前筛选没有进行中的 Watch';
  if (statusFilter.value === 'expired') return '当前筛选没有已过期 Watch';
  return '当前筛选无结果';
});

const emptyStateHint = computed(() => {
  if (!showFilteredEmptyBoundary.value) {
    return '在消息旁点击“关注后续”创建手动规则；系统内部跟踪不会显示在这里。';
  }

  const hiddenStatusText =
    statusFilter.value === 'active'
      ? `已有 ${expiredCount.value} 条已过期规则被当前筛选隐藏。`
      : `已有 ${activeCount.value} 条进行中规则被当前筛选隐藏。`;
  return `已有 ${items.value.length} 条手动 Watch 规则；${hiddenStatusText}这是筛选结果为空，不是规则丢失或读取失败。`;
});

const emptyStateBoundaryText =
  '切换筛选只改变本页显示，不会取消、延长、补发通知或重新读取远端。';

function resetStatusFilter() {
  statusFilter.value = 'all';
}

function isExpired(item: FollowThreadItem): boolean {
  return isFollowThreadRuleExpired(item.expiredAt);
}

function formatExpireTime(expiredAt: number): string {
  return formatFollowThreadExpiry(expiredAt);
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) {
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours === 0) {
      const minutes = Math.floor(diff / (1000 * 60));
      return `${minutes}分钟前`;
    }
    return `${hours}小时前`;
  } else if (days < 7) {
    return `${days}天前`;
  } else {
    return date.toLocaleDateString();
  }
}

function latestRelatedTime(item: FollowThreadItem): string {
  const relatedMessages = item.followConfig.relatedMessages;
  if (!relatedMessages.length) return '暂无';
  const timestamps = relatedMessages
    .map((message) => new Date(message.datetime).getTime())
    .filter((value) => !Number.isNaN(value));
  if (!timestamps.length) return '暂无';
  return formatTime(new Date(Math.max(...timestamps)).toISOString());
}

function getNotifyMethodText(method: string): string {
  return getFollowThreadNotifyMethodText(method);
}

function getLatestNotifiedAt(item: FollowThreadItem): string | undefined {
  const timestamps = item.followConfig.relatedMessages
    .map((message) => new Date(message.notifiedAt || '').getTime())
    .filter((value) => !Number.isNaN(value));
  if (!timestamps.length) return undefined;
  return new Date(Math.max(...timestamps)).toISOString();
}

function getManagementStatusReceipt(
  item: FollowThreadItem,
): FollowThreadManagementStatusReceipt {
  return buildFollowThreadManagementStatusReceipt({
    relatedCount: item.followConfig.relatedMessages.length,
    latestHitText: latestRelatedTime(item),
    latestNotifiedAt: getLatestNotifiedAt(item),
    expiredAt: item.expiredAt,
    notifyMethod: item.notifyMethod || 'bot',
    notifyFrequency: item.notifyFrequency,
  });
}

function getHitStatusText(
  message: FollowThreadItem['followConfig']['relatedMessages'][number],
): string {
  return buildFollowThreadHitStatusText({
    notifiedAt: message.notifiedAt,
    summary: message.summary,
  });
}

function getRelationTypeText(type: string): string {
  const map: Record<string, string> = {
    thread_reply: '线程回复',
    mention: '@提及',
    quote: '引用',
    semantic: '语义相关',
    direct_reply: '直接回复',
    same_thread: '同线程',
    semantic_related: '语义相关',
  };
  return map[type] || type;
}

function toggleTimeline(itemId: string) {
  if (expandedItems.value.has(itemId)) {
    expandedItems.value.delete(itemId);
  } else {
    expandedItems.value.add(itemId);
  }
}

async function extendFollow(item: FollowThreadItem) {
  try {
    const result = await chrome.storage.local.get('concernedItems');
    const allItems = result.concernedItems || [];
    const index = allItems.findIndex((i: any) => i.id === item.id);

    if (index !== -1) {
      const nextExpiredAt = getFollowThreadExtendedExpiry(
        allItems[index].expiredAt,
      );
      allItems[index].expiredAt = nextExpiredAt;

      await chrome.storage.local.set({ concernedItems: allItems });
      await loadFollowThreads();
      actionReceipt.value = buildFollowThreadExtendedReceipt({
        ruleName: item.text,
        expiredAt: nextExpiredAt,
      });
    }
  } catch (error) {
    console.error('❌ 延长关注失败:', error);
    actionReceipt.value = {
      tone: 'warning',
      title: '延长关注失败',
      body: '本地手动规则没有更新；请稍后重试，原关注状态保持不变。',
    };
  }
}

async function cancelFollow(item: FollowThreadItem) {
  if (!confirm(`确定要取消关注"${item.text}"吗？`)) {
    return;
  }

  try {
    const result = await chrome.storage.local.get('concernedItems');
    const allItems = result.concernedItems || [];
    const updatedItems = allItems.filter((i: any) => i.id !== item.id);

    await chrome.storage.local.set({ concernedItems: updatedItems });
    await loadFollowThreads();
    actionReceipt.value = buildFollowThreadCancelReceipt({
      ruleName: item.text,
    });
  } catch (error) {
    console.error('❌ 取消关注失败:', error);
    actionReceipt.value = {
      tone: 'warning',
      title: '取消关注失败',
      body: '本地手动规则没有删除；请稍后重试，原关注状态保持不变。',
    };
  }
}
</script>

<style scoped>
.follow-threads-container {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
  animation: fadeInUp 0.5s ease-out;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  margin-bottom: 20px;
}

.header h2 {
  margin: 0;
  font-size: 24px;
  color: #f8fafc;
}

.page-subtitle {
  margin-top: 8px;
  color: #94a3b8;
  line-height: 1.55;
}

.controls {
  display: flex;
  gap: 12px;
}

.filter-select {
  padding: 8px 12px;
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 10px;
  background: rgba(15, 23, 42, 0.72);
  color: #e2e8f0;
  font-size: 14px;
  cursor: pointer;
}

.info-banner {
  margin-bottom: 16px;
  padding: 14px 16px;
  border-radius: 16px;
  background: rgba(139, 92, 246, 0.12);
  border: 1px solid rgba(167, 139, 250, 0.24);
}

.info-banner-title {
  font-weight: 700;
  color: #ddd6fe;
  margin-bottom: 6px;
}

.info-banner-text {
  margin: 0;
  color: #c4b5fd;
  line-height: 1.55;
}

.summary-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 20px;
}

.follow-action-receipt {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 16px;
  padding: 12px 14px;
  border-radius: 8px;
  border: 1px solid rgba(56, 189, 248, 0.28);
  background: rgba(14, 165, 233, 0.12);
  color: #dbeafe;
  line-height: 1.45;
}

.follow-action-receipt.warning {
  border-color: rgba(245, 158, 11, 0.32);
  background: rgba(245, 158, 11, 0.12);
  color: #fde68a;
}

.follow-action-receipt strong {
  color: #f8fafc;
}

.summary-pill {
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(14, 165, 233, 0.16);
  color: #7dd3fc;
  font-size: 13px;
}

.summary-pill.warn {
  background: rgba(245, 158, 11, 0.16);
  color: #fcd34d;
}

.summary-pill.info {
  background: rgba(34, 197, 94, 0.16);
  color: #86efac;
}

.loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: #94a3b8;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid rgba(56, 189, 248, 0.18);
  border-top: 4px solid #38bdf8;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: #94a3b8;
}

.empty-icon {
  font-size: 64px;
  margin-bottom: 16px;
}

.empty-state p {
  margin: 8px 0;
}

.hint {
  font-size: 14px;
  color: #64748b;
}

.filter-boundary {
  color: #94a3b8;
}

.empty-reset-btn {
  margin-top: 12px;
}

.follow-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.follow-item {
  background: rgba(15, 23, 42, 0.72);
  border: 1px solid rgba(196, 181, 253, 0.18);
  border-radius: 16px;
  padding: 18px;
  transition: all 0.2s ease;
}

.follow-item:hover {
  box-shadow: 0 12px 32px rgba(76, 29, 149, 0.18);
  border-color: rgba(167, 139, 250, 0.3);
}

.follow-item.expired {
  opacity: 0.7;
  border-color: rgba(148, 163, 184, 0.2);
}

.item-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
}

.item-info {
  flex: 1;
}

.item-title {
  margin: 0 0 8px 0;
  font-size: 17px;
  font-weight: 600;
  color: #f8fafc;
}

.item-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 13px;
  color: #94a3b8;
}

.sender {
  font-weight: 500;
  color: #c4b5fd;
}

.separator {
  color: rgba(148, 163, 184, 0.4);
}

.rule-ref {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  color: #7dd3fc;
}

.status-badge {
  padding: 2px 8px;
  background: rgba(34, 197, 94, 0.16);
  color: #86efac;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.status-badge.expired {
  background: rgba(239, 68, 68, 0.16);
  color: #fca5a5;
}

.item-actions {
  display: flex;
  gap: 8px;
}

.btn-secondary,
.btn-danger {
  padding: 7px 12px;
  border: none;
  border-radius: 10px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-secondary {
  background: rgba(59, 130, 246, 0.14);
  color: #bfdbfe;
}

.btn-secondary:hover {
  background: rgba(59, 130, 246, 0.22);
}

.btn-danger {
  background: rgba(239, 68, 68, 0.18);
  color: #fca5a5;
}

.btn-danger:hover {
  background: rgba(239, 68, 68, 0.26);
}

.item-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 24px;
  margin-bottom: 12px;
  padding: 12px;
  background: rgba(30, 41, 59, 0.52);
  border: 1px solid rgba(148, 163, 184, 0.12);
  border-radius: 12px;
}

.stat {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stat-label {
  font-size: 12px;
  color: #94a3b8;
}

.stat-value {
  font-size: 14px;
  font-weight: 600;
  color: #f8fafc;
}

.watch-status-receipt {
  margin-bottom: 12px;
  padding: 12px 14px;
  border-radius: 8px;
  border: 1px solid rgba(56, 189, 248, 0.22);
  background: rgba(14, 165, 233, 0.1);
  color: #dbeafe;
  line-height: 1.5;
}

.watch-status-title {
  margin-bottom: 6px;
  font-weight: 700;
  color: #f8fafc;
}

.watch-status-receipt p {
  margin: 4px 0;
}

.original-message {
  padding: 12px;
  background: rgba(15, 23, 42, 0.46);
  border: 1px solid rgba(167, 139, 250, 0.22);
  border-radius: 12px;
  margin-bottom: 12px;
}

.message-label {
  font-size: 12px;
  font-weight: 600;
  color: #c4b5fd;
  margin-bottom: 6px;
}

.message-content {
  font-size: 13px;
  color: #e2e8f0;
  line-height: 1.5;
  margin-bottom: 8px;
  max-height: 60px;
  overflow-y: auto;
}

.message-link {
  font-size: 12px;
  color: #7dd3fc;
  text-decoration: none;
}

.message-link:hover {
  text-decoration: underline;
}

.timeline-section {
  border-top: 1px solid rgba(148, 163, 184, 0.12);
  padding-top: 12px;
}

.timeline-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px;
  cursor: pointer;
  border-radius: 6px;
  transition: background 0.2s ease;
}

.timeline-header:hover {
  background: rgba(30, 41, 59, 0.5);
}

.timeline-title {
  font-size: 14px;
  font-weight: 600;
  color: #f8fafc;
}

.toggle-icon {
  color: #94a3b8;
  font-size: 12px;
}

.timeline {
  margin-top: 12px;
  padding-left: 12px;
}

.timeline-item {
  display: flex;
  gap: 12px;
  padding: 12px 0;
  border-left: 2px solid #e1bee7;
  position: relative;
}

.timeline-dot {
  position: absolute;
  left: -6px;
  top: 18px;
  width: 10px;
  height: 10px;
  background: #8b5cf6;
  border-radius: 50%;
  border: 2px solid #0f172a;
}

.timeline-content {
  flex: 1;
  padding-left: 8px;
}

.timeline-meta {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 4px;
  font-size: 12px;
}

.timeline-sender {
  font-weight: 600;
  color: #c4b5fd;
}

.timeline-type {
  padding: 2px 6px;
  background: rgba(139, 92, 246, 0.18);
  color: #ddd6fe;
  border-radius: 4px;
  font-size: 11px;
}

.timeline-time {
  color: #94a3b8;
}

.timeline-summary {
  font-size: 13px;
  color: #cbd5e1;
  line-height: 1.4;
}

.timeline-notification-status {
  margin-top: 6px;
  font-size: 12px;
  line-height: 1.45;
  color: #bae6fd;
}

.timeline-empty {
  padding: 20px;
  text-align: center;
  color: #94a3b8;
  font-size: 13px;
}

@media (max-width: 900px) {
  .header,
  .item-header {
    flex-direction: column;
    align-items: stretch;
  }

  .controls,
  .item-actions {
    flex-wrap: wrap;
  }
}
</style>
