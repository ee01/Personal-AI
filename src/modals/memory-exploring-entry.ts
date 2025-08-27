import { createApp } from 'vue';
import { createRouter, createWebHashHistory } from 'vue-router';
import { createPinia } from 'pinia';
import MemoryExploring from './memory-exploring.vue';

// 导入页面组件
import OverviewPage from './components/OverviewPage.vue';
import TimelinePage from './components/TimelinePage.vue';
import EntityListPage from './components/EntityListPage.vue';
import TopicDetailPage from './components/TopicDetailPage.vue';
import UserProfilePage from './components/UserProfilePage.vue';
import PersonDetailPage from './components/PersonDetailPage.vue';
import SearchResultPage from './components/SearchResultPage.vue';
import PlaceholderPage from './components/PlaceholderPage.vue';

// 路由配置
const routes = [
  { path: '/', name: 'Overview', component: OverviewPage },
  { path: '/timeline', name: 'Timeline', component: TimelinePage },
  { path: '/user-profile', name: 'UserProfile', component: UserProfilePage },
  { path: '/entity/:type', name: 'EntityDetail', component: EntityListPage, props: true },
  { path: '/topic/:id', name: 'TopicDetail', component: TopicDetailPage, props: true },
  { path: '/person/:id', name: 'PersonDetail', component: PersonDetailPage, props: true },
  { path: '/project/:id', name: 'ProjectDetail', component: PlaceholderPage, props: true },
  { path: '/search', name: 'Search', component: SearchResultPage }
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
