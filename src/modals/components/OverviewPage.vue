<template>
  <div class="overview-section">
    <div class="greeting-card">
      <div class="greeting-title">
        <span>🌅</span>
        <span>早上好！今天的重点信息</span>
      </div>
      <div class="greeting-content">
        <p>你今天的主要项目进展如下：</p>
        <ul class="quick-summary">
          <li>🚀 Personal-AI 项目已进入测试阶段</li>
          <li>💬 有 {{ unreadTopicsCount }} 个主题包含未读讨论</li>
          <li>📊 {{ overviewStats?.totalEntities || 0 }} 个实体，{{ overviewStats?.totalRelationships || 0 }} 个关系</li>
          <li>📈 本周新增 {{ overviewStats?.entitiesCreatedThisWeek || 0 }} 个实体</li>
        </ul>
        <p>我帮你整理了今天你可能想先看的内容 👇</p>
      </div>
    </div>

    <div class="content-grid" id="today-cards-grid">
      <!-- 今日重点项目 -->
      <div 
        v-if="!isCardClosed('today-projects')" 
        class="content-card" 
        style="position: relative;"
        @click="navigateToEntityType('Project')"
      >
        <button class="mark-read-btn" @click.stop="handleCloseTodayCard('today-projects')">阅</button>
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
      <div 
        v-if="!isCardClosed('today-topics')" 
        class="content-card" 
        style="position: relative;"
        @click="navigateToEntityType('Topic')"
      >
        <button class="mark-read-btn" @click.stop="handleCloseTodayCard('today-topics')">阅</button>
        <div class="card-header">
          <div class="card-title">
            <span>💡</span>
            <span>热门主题讨论</span>
          </div>
          <div class="card-badge">{{ unreadTopicsCount }} 个未读</div>
        </div>
        <div class="card-content">最近讨论频繁的话题和观点</div>
        <ul class="info-list">
          <li class="info-item">
            <span>🤖</span>
            <span>AI 工作流自动化实践</span>
            <span class="info-time">30 分钟前</span>
          </li>
          <li class="info-item">
            <span>⚡</span>
            <span>前端性能优化策略</span>
            <span class="info-time">2 小时前</span>
          </li>
        </ul>
        <div class="view-more-btn">
          <span>查看所有主题</span>
          <span>→</span>
        </div>
      </div>

      <!-- 重要联系人动态 -->
      <div 
        v-if="!isCardClosed('today-people')" 
        class="content-card" 
        style="position: relative;"
        @click="navigateToEntityType('Person')"
      >
        <button class="mark-read-btn" @click.stop="handleCloseTodayCard('today-people')">阅</button>
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
        </ul>
        <div class="view-more-btn">
          <span>查看所有联系人</span>
          <span>→</span>
        </div>
      </div>

      <!-- AI 推荐内容 -->
      <div 
        v-if="!isCardClosed('today-ai-recommend')" 
        class="content-card" 
        style="position: relative;"
      >
        <button class="mark-read-btn" @click.stop="handleCloseTodayCard('today-ai-recommend')">阅</button>
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
        </ul>
        <div class="view-more-btn">
          <span>查看更多推荐</span>
          <span>→</span>
        </div>
      </div>
    </div>

    <!-- 未读主题瀑布流推送 -->
    <div v-if="waterfallTopics.length > 0" id="unread-topics-waterfall">
      <h2 style="margin: 2rem 0 1rem; font-size: 1.5rem; font-weight: 600;">📬 未读主题推送</h2>
      <div class="waterfall-container" id="waterfall-topics-container">
        <div 
          v-for="topic in waterfallTopics.slice(0, waterfallDisplayCount)" 
          :key="topic.id"
          class="waterfall-item"
        >
          <div 
            class="content-card unread" 
            :data-topic-id="topic.id"
            style="position: relative;"
            @click="handleTopicClick(topic)"
          >
            <button class="mark-read-btn" @click.stop="handleMarkTopicAsRead(topic.id)">阅</button>
            <div class="card-header">
              <div class="card-title">
                <span>💡</span>
                <span>{{ topic.name }}</span>
              </div>
              <span class="unread-badge">{{ topic.readStatus?.unreadCount || 0 }}</span>
            </div>
            <div class="card-content" style="margin-bottom: 0.75rem;">
              {{ topic.description }}
            </div>
            <div class="card-content" style="font-size: 0.875rem; line-height: 1.5;">
              {{ topic.importance >= 0.8 ? '🔥 热门' : '' }} 
              {{ topic.statistic?.conversations || 0 }}条讨论 • {{ formatTime(topic.updated || Date.now()) }}
            </div>
            <!-- 未读讨论 -->
            <div v-if="topic.unreadDiscussions && topic.unreadDiscussions.length > 0" class="unread-discussions">
              <div class="unread-discussions-title">
                💬 未读讨论 ({{topic.unreadDiscussions.length}}条)
              </div>
              <div 
                v-for="(discussion, idx) in topic.unreadDiscussions.slice(0, 2)" 
                :key="idx"
                class="discussion-item"
              >
                <span class="discussion-icon">▪</span>
                <div class="discussion-text">{{ discussion.text }}</div>
              </div>
              <div 
                v-if="topic.unreadDiscussions.length > 2" 
                style="text-align: center; color: #60a5fa; font-size: 0.75rem; margin-top: 0.5rem;"
              >
                还有 {{ topic.unreadDiscussions.length - 2 }} 条...
              </div>
            </div>
            <!-- 关联项目标签 -->
            <div v-if="topic.relatedProjects && topic.relatedProjects.length > 0" style="margin-top: 0.75rem; display: flex; gap: 0.5rem; flex-wrap: wrap;">
              <span 
                v-for="project in topic.relatedProjects" 
                :key="project.id"
                style="padding: 0.25rem 0.5rem; background: rgba(59,130,246,0.1); 
                       color: #60a5fa; border-radius: 0.25rem; font-size: 0.75rem;"
              >
                {{ project.name }}
              </span>
            </div>
          </div>
        </div>
      </div>
      <button 
        v-if="waterfallTopics.length > waterfallDisplayCount"
        class="load-more-btn" 
        @click="loadMoreTopics"
      >
        加载更多主题
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useMemoryStore } from '../memory-store';

const store = useMemoryStore();
const router = useRouter();

const overviewStats = computed(() => store.overviewStats);
const closedTodayCards = computed(() => store.closedTodayCards);
const waterfallDisplayCount = ref(6);

// 获取未读主题数量
const unreadTopicsCount = computed(() => store.getUnreadTopics().length);

// 获取未读主题瀑布流(按热度排序)
const waterfallTopics = computed(() => store.getUnreadTopicsByImportance());

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

const isCardClosed = (cardId: string) => {
  return closedTodayCards.value.has(cardId);
};

const handleCloseTodayCard = (cardId: string) => {
  store.closeTodayCard(cardId);
};

const handleTopicClick = (topic: any) => {
  // 点击主题进入详情页
  store.markTopicAsRead(topic.id);
  router.push(`/topic/${topic.id}`);
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

const loadMoreTopics = () => {
  waterfallDisplayCount.value += 6;
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
</script>

<style scoped>
/* "阅"字按钮 - 标记已读 */
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

.content-card:hover .mark-read-btn {
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
.content-card.unread {
  border-left: 3px solid #ef4444;
  background: rgba(239, 68, 68, 0.05);
}

/* 瀑布流布局 */
.waterfall-container {
  column-count: 2;
  column-gap: 1.5rem;
}

@media (max-width: 1400px) {
  .waterfall-container {
    column-count: 1;
  }
}

.waterfall-item {
  break-inside: avoid;
  margin-bottom: 1.5rem;
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

/* 加载更多按钮 */
.load-more-btn {
  display: block;
  width: 100%;
  padding: 1rem;
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.3);
  border-radius: 0.75rem;
  color: #60a5fa;
  cursor: pointer;
  transition: all 0.3s ease;
  margin-top: 2rem;
}

.load-more-btn:hover {
  background: rgba(59, 130, 246, 0.2);
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
