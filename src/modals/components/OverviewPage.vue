<template>
  <div class="overview-section">
    <div class="greeting-card">
      <div class="greeting-title">
        <span>🌅</span>
        <span>欢迎来到记忆查询系统</span>
      </div>
      <div class="greeting-content">
        <p>您的个人知识图谱中包含:</p>
        <ul class="quick-summary">
          <li>📊 {{ overviewStats?.totalEntities || 0 }} 个实体，{{ overviewStats?.totalRelationships || 0 }} 个关系</li>
          <li>📈 今日新增 {{ overviewStats?.entitiesCreatedToday || 0 }} 个实体</li>
          <li>📅 本周新增 {{ overviewStats?.entitiesCreatedThisWeek || 0 }} 个实体</li>
          <li>📆 本月新增 {{ overviewStats?.entitiesCreatedThisMonth || 0 }} 个实体</li>
        </ul>
        <p>点击左侧类别开始探索您的记忆 👈</p>
      </div>
    </div>

    <div class="content-grid">
      <!-- 今日重点项目 -->
      <div class="content-card" @click="navigateToEntityType('Project')">
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
      <div class="content-card" @click="navigateToEntityType('Topic')">
        <div class="card-header">
          <div class="card-title">
            <span>💡</span>
            <span>热门主题讨论</span>
          </div>
          <div class="card-badge">{{ getEntityCount('Topic') }} 个活跃</div>
        </div>
        <div class="card-content">最近讨论频繁的话题和观点</div>
        <ul class="info-list">
          <li class="info-item" @click.stop="navigateToTopic('ai-workflow')">
            <span>🤖</span>
            <span>AI 工作流自动化实践</span>
            <span class="info-time">30 分钟前</span>
          </li>
          <li class="info-item">
            <span>⚡</span>
            <span>前端性能优化策略</span>
            <span class="info-time">2 小时前</span>
          </li>
          <li class="info-item">
            <span>🎯</span>
            <span>产品设计思维方法</span>
            <span class="info-time">4 小时前</span>
          </li>
        </ul>
        <div class="view-more-btn">
          <span>查看所有主题</span>
          <span>→</span>
        </div>
      </div>

      <!-- 重要联系人动态 -->
      <div class="content-card" @click="navigateToEntityType('Person')">
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
          <li class="info-item">
            <span>👤</span>
            <span>王五 - 会议纪要分享</span>
            <span class="info-time">6 小时前</span>
          </li>
        </ul>
        <div class="view-more-btn">
          <span>查看所有联系人</span>
          <span>→</span>
        </div>
      </div>

      <!-- AI 推荐内容 -->
      <div class="content-card">
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
          <li class="info-item">
            <span>💡</span>
            <span>React 18 新特性总结</span>
            <span class="info-time">推荐</span>
          </li>
        </ul>
        <div class="view-more-btn">
          <span>查看更多推荐</span>
          <span>→</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useMemoryStore } from '../memory-store';

const store = useMemoryStore();
const router = useRouter();

const overviewStats = computed(() => store.overviewStats);

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
</script>
