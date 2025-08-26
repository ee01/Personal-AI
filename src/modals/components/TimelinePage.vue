<template>
  <div class="timeline-view">
    <h2 style="margin-bottom: 2rem; font-size: 1.5rem; font-weight: 600;">📅 今日时间轴</h2>
    
    <div v-if="isLoading" class="loading-container">
      <div class="loading-spinner"></div>
      <span>加载时间轴数据...</span>
    </div>
    
    <div v-else class="timeline-container">
      <div v-for="event in timelineEvents" :key="event.id" class="timeline-item">
        <div class="timeline-dot">{{ getTimelineIcon(event.type) }}</div>
        <div class="timeline-content">
          <div class="timeline-time">{{ formatTime(event.timestamp) }}</div>
          <div class="content-card" style="margin: 0;">
            <div class="card-title">{{ event.title }}</div>
            <div class="card-content">{{ event.content }}</div>
            <div v-if="event.source" class="event-source">来源: {{ event.source }}</div>
          </div>
        </div>
      </div>
      
      <div v-if="timelineEvents.length === 0" class="empty-state">
        <span>📭</span>
        <p>暂无时间轴数据</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useMemoryStore } from '../memory-store';

const store = useMemoryStore();

const timelineEvents = ref([
  {
    id: 'event-1',
    type: 'start',
    title: '开始新的一天',
    content: '查看了昨天的工作总结和今日计划',
    timestamp: Date.now() - 4 * 3600000
  },
  {
    id: 'event-2',
    type: 'message',
    title: '团队晨会讨论',
    content: '讨论了 Personal-AI 项目的进展，张三提出了代码审查建议',
    timestamp: Date.now() - 3 * 3600000,
    source: '团队会议'
  },
  {
    id: 'event-3',
    type: 'update',
    title: '技术文档更新',
    content: '更新了 React Query 集成文档，添加了错误处理最佳实践',
    timestamp: Date.now() - 2 * 3600000
  },
  {
    id: 'event-4',
    type: 'task',
    title: 'Jira 任务更新',
    content: '完成了 3 个 bug 修复，更新了任务状态到"待测试"',
    timestamp: Date.now() - 1 * 3600000,
    source: 'Jira'
  }
]);

const isLoading = computed(() => store.isLoading);

const getTimelineIcon = (type: string) => {
  const icons = {
    'start': '🌅',
    'message': '💬',
    'update': '🔧',
    'task': '📊',
    'webpage': '🌐',
    'relation_created': '🔗',
    'entity_updated': '📝'
  };
  return icons[type] || '📅';
};

const formatTime = (timestamp: number) => {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 60) return `${minutes}分钟前`;
  if (hours < 24) return `${hours}小时前`;
  if (days < 30) return `${days}天前`;
  return new Date(timestamp).toLocaleDateString();
};
</script>
