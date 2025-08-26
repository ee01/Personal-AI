<template>
  <div class="loading-container">
    <div class="loading-spinner"></div>
    <span>{{ getPageMessage() }}</span>
  </div>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router';

const route = useRoute();

const getPageMessage = () => {
  const routeName = route.name;
  switch (routeName) {
    case 'UserProfile':
      return '用户画像页面开发中...';
    case 'Search':
      return '搜索结果页面开发中...';
    default:
      return '页面开发中...';
  }
};
</script>
