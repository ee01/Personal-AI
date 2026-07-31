<script setup lang="ts">
import { useRoadmapState } from '../composables/useRoadmapState';

const state = useRoadmapState();

function formatTime(ts: number) {
  return new Date(ts).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
</script>

<template>
  <aside class="activity-drawer" :class="{ open: state.activityOpen.value }">
    <div class="ad-head">
      <div class="ad-title">活动日志</div>
      <button class="icon-btn" @click="state.activityOpen.value = false">×</button>
    </div>
    <div class="ad-body">
      <div v-if="!state.activity.value.length" class="ad-empty">
        暂无活动记录<br />团队的导入、排期与协作操作会显示在这里
      </div>
      <div v-for="item in state.activity.value" :key="item.id" class="ad-item">
        <div class="ad-time">{{ formatTime(item.at) }}</div>
        <div class="ad-who">{{ item.actorName }}</div>
        <div>{{ item.text }}</div>
      </div>
    </div>
  </aside>
</template>
