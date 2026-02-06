<template>
  <div class="follow-threads-container">
    <div class="header">
      <h2>👁 关注后续</h2>
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

    <div v-if="loading" class="loading">
      <div class="spinner"></div>
      <p>加载中...</p>
    </div>

    <div v-else-if="filteredItems.length === 0" class="empty-state">
      <div class="empty-icon">👁</div>
      <p>暂无关注项</p>
      <p class="hint">在消息旁点击"关注后续"按钮来添加关注</p>
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
              <span class="sender">{{ item.followConfig.originalMessage.sender }}</span>
              <span class="separator">•</span>
              <span class="team">{{ item.followConfig.originalMessage.teamName }}</span>
              <span class="separator">•</span>
              <span class="status-badge" :class="{ expired: isExpired(item) }">
                {{ isExpired(item) ? '已过期' : '进行中' }}
              </span>
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
            <span class="stat-value">{{ item.followConfig.relatedMessages.length }}</span>
          </div>
          <div class="stat">
            <span class="stat-label">通知方式</span>
            <span class="stat-value">{{ getNotifyMethodText(item.notifyMethod || 'bot') }}</span>
          </div>
          <div class="stat">
            <span class="stat-label">到期时间</span>
            <span class="stat-value">{{ formatExpireTime(item.expiredAt) }}</span>
          </div>
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
              关联消息时间线 ({{ item.followConfig.relatedMessages.length }})
            </span>
            <span class="toggle-icon">{{ expandedItems.has(item.id) ? '▼' : '▶' }}</span>
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
                  <span class="timeline-type">{{ getRelationTypeText(msg.relationType) }}</span>
                  <span class="timeline-time">{{ formatTime(msg.datetime) }}</span>
                </div>
                <div v-if="msg.summary" class="timeline-summary">
                  {{ msg.summary }}
                </div>
              </div>
            </div>

            <div v-if="item.followConfig.relatedMessages.length === 0" class="timeline-empty">
              暂无关联消息
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';

/* eslint-disable no-undef */
declare const chrome: any;
/* eslint-enable no-undef */

interface FollowThreadItem {
  id: string;
  text: string;
  expiredAt: number;  // rule 的过期时间
  // 🆕 通用通知配置（移到外层）
  notifyMethod?: 'bot' | 'chrome' | 'both';
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
      relationType: 'thread_reply' | 'mention' | 'quote' | 'semantic';
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

onMounted(async () => {
  await loadFollowThreads();
});

async function loadFollowThreads() {
  try {
    loading.value = true;
    const result = await chrome.storage.local.get('concernedItems');
    const allItems = result.concernedItems || [];

    // 筛选出有 followThread 配置的项
    items.value = allItems.filter(
      (item: any) => item.followThread && item.followConfig
    );
  } catch (error) {
    console.error('❌ 加载关注项失败:', error);
  } finally {
    loading.value = false;
  }
}

const filteredItems = computed(() => {
  let filtered = items.value;

  // 状态过滤
  if (statusFilter.value === 'active') {
    filtered = filtered.filter(item => !isExpired(item));
  } else if (statusFilter.value === 'expired') {
    filtered = filtered.filter(item => isExpired(item));
  }

  // 排序
  if (sortBy.value === 'created') {
    filtered = [...filtered].sort(
      (a, b) =>
        new Date(b.followConfig.createdAt).getTime() -
        new Date(a.followConfig.createdAt).getTime()
    );
  } else if (sortBy.value === 'expires') {
    filtered = [...filtered].sort(
      (a, b) => a.expiredAt - b.expiredAt
    );
  } else if (sortBy.value === 'related') {
    filtered = [...filtered].sort(
      (a, b) =>
        b.followConfig.relatedMessages.length -
        a.followConfig.relatedMessages.length
    );
  }

  return filtered;
});

function isExpired(item: FollowThreadItem): boolean {
  // 🆕 使用外层 expiredAt
  return item.expiredAt < Date.now();
}

function formatExpireTime(expiredAt: number): string {
  // 🆕 接收时间戳而不是字符串
  const now = Date.now();
  const diff = expiredAt - now;

  if (diff < 0) {
    return '已过期';
  }

  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  if (days === 0) {
    const hours = Math.ceil(diff / (1000 * 60 * 60));
    return `${hours}小时后`;
  }
  return `${days}天后`;
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

function getNotifyMethodText(method: string): string {
  const map: Record<string, string> = {
    bot: 'Bot推送',
    chrome: 'Chrome通知',
    both: '两者都推送'
  };
  return map[method] || method;
}

function getRelationTypeText(type: string): string {
  const map: Record<string, string> = {
    thread_reply: '线程回复',
    mention: '@提及',
    quote: '引用',
    semantic: '语义相关'
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
      // 🆕 只需更新外层 expiredAt（延长7天）
      allItems[index].expiredAt = allItems[index].expiredAt + 7 * 24 * 60 * 60 * 1000;

      await chrome.storage.local.set({ concernedItems: allItems });
      await loadFollowThreads();

      alert('已延长7天关注时间');
    }
  } catch (error) {
    console.error('❌ 延长关注失败:', error);
    alert('延长失败，请稍后重试');
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

    // TODO: 同时删除 ChromaDB 中的记录
  } catch (error) {
    console.error('❌ 取消关注失败:', error);
    alert('取消失败，请稍后重试');
  }
}
</script>

<style scoped>
.follow-threads-container {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.header h2 {
  margin: 0;
  font-size: 24px;
  color: #333;
}

.controls {
  display: flex;
  gap: 12px;
}

.filter-select {
  padding: 6px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  background: white;
  font-size: 14px;
  cursor: pointer;
}

.loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: #666;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #9c27b0;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: #666;
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
  color: #999;
}

.follow-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.follow-item {
  background: white;
  border: 2px solid #e1bee7;
  border-radius: 12px;
  padding: 16px;
  transition: all 0.2s ease;
}

.follow-item:hover {
  box-shadow: 0 4px 12px rgba(156, 39, 176, 0.15);
}

.follow-item.expired {
  opacity: 0.7;
  border-color: #ddd;
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
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

.item-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #666;
}

.sender {
  font-weight: 500;
  color: #9c27b0;
}

.separator {
  color: #ddd;
}

.status-badge {
  padding: 2px 8px;
  background: #e8f5e9;
  color: #2e7d32;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.status-badge.expired {
  background: #ffebee;
  color: #c62828;
}

.item-actions {
  display: flex;
  gap: 8px;
}

.btn-secondary,
.btn-danger {
  padding: 6px 12px;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-secondary {
  background: #f5f5f5;
  color: #666;
}

.btn-secondary:hover {
  background: #e0e0e0;
}

.btn-danger {
  background: #ffebee;
  color: #c62828;
}

.btn-danger:hover {
  background: #ffcdd2;
}

.item-stats {
  display: flex;
  gap: 24px;
  margin-bottom: 12px;
  padding: 12px;
  background: #faf5ff;
  border-radius: 8px;
}

.stat {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stat-label {
  font-size: 12px;
  color: #999;
}

.stat-value {
  font-size: 14px;
  font-weight: 600;
  color: #333;
}

.original-message {
  padding: 12px;
  background: white;
  border: 1px solid #e1bee7;
  border-radius: 8px;
  margin-bottom: 12px;
}

.message-label {
  font-size: 12px;
  font-weight: 600;
  color: #9c27b0;
  margin-bottom: 6px;
}

.message-content {
  font-size: 13px;
  color: #333;
  line-height: 1.5;
  margin-bottom: 8px;
  max-height: 60px;
  overflow-y: auto;
}

.message-link {
  font-size: 12px;
  color: #9c27b0;
  text-decoration: none;
}

.message-link:hover {
  text-decoration: underline;
}

.timeline-section {
  border-top: 1px solid #f0f0f0;
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
  background: #f5f5f5;
}

.timeline-title {
  font-size: 14px;
  font-weight: 600;
  color: #333;
}

.toggle-icon {
  color: #999;
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
  background: #9c27b0;
  border-radius: 50%;
  border: 2px solid white;
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
  color: #9c27b0;
}

.timeline-type {
  padding: 2px 6px;
  background: #f3e5f5;
  color: #7b1fa2;
  border-radius: 4px;
  font-size: 11px;
}

.timeline-time {
  color: #999;
}

.timeline-summary {
  font-size: 13px;
  color: #666;
  line-height: 1.4;
}

.timeline-empty {
  padding: 20px;
  text-align: center;
  color: #999;
  font-size: 13px;
}
</style>
