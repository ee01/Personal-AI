import { createApp } from 'vue';
import { createRouter, createWebHashHistory } from 'vue-router';
import { createPinia } from 'pinia';
import MemoryExploring from './memory-exploring.vue';

// 路由配置（简单路由，让Vue组件内部处理具体逻辑）
const routes = [
  { path: '/', name: 'home' },
  { path: '/timeline', name: 'timeline' },
  { path: '/user-profile', name: 'profile' },
  { path: '/entity/:type', name: 'entity' },
  { path: '/topic/:id', name: 'topic' },
  { path: '/search', name: 'search' }
];

// 等待DOM加载完成
document.addEventListener('DOMContentLoaded', () => {
  const mountElement = document.getElementById('memory-app');
  if (mountElement) {
    // 创建路由实例
    const router = createRouter({
      history: createWebHashHistory(),
      routes
    });
    
    // 创建 Pinia 实例
    const pinia = createPinia();
    
    // 创建 Vue 应用
    const app = createApp(MemoryExploring);
    
    // 使用插件
    app.use(pinia);
    app.use(router);
    
    // 挂载应用
    app.mount('#memory-app');
  }
});

// 导出应用实例（可选，用于调试）
export default MemoryExploring;
