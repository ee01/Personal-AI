<template>
  <div class="entity-detail">
    <div class="entity-header">
      <div class="entity-avatar">{{ getEntityIcon(entityType) }}</div>
      <div class="entity-info">
        <h2>{{ getEntityTypeName(entityType) }}</h2>
        <div class="entity-meta">
          共 {{ entities.length }} 个{{ getEntityTypeName(entityType) }}
          <span v-if="searchQuery"> • 搜索: "{{ searchQuery }}"</span>
        </div>
      </div>
    </div>

    <div v-if="isLoading" class="loading-container">
      <div class="loading-spinner"></div>
      <span>加载实体数据...</span>
    </div>

    <div v-else class="entities-grid">
      <div 
        v-for="entity in entities" 
        :key="entity.id" 
        class="entity-card"
        @click="handleEntityClick(entity)"
      >
        <div class="entity-card-header">
          <div class="entity-card-title">
            <span>{{ getEntityIcon(entity.type) }}</span>
            <span>{{ entity.name }}</span>
          </div>
          <div v-if="entity.importance !== undefined" class="importance-indicator">
            <div 
              class="importance-bar" 
              :style="{ width: (entity.importance * 100) + '%' }"
            ></div>
          </div>
        </div>
        
        <div v-if="entity.description" class="entity-description">
          {{ entity.description }}
        </div>
        
        <div class="entity-stats">
          <div class="stat-item">
            <span>🔗</span>
            <span>{{ entity.relationshipsCount || 0 }} 关系</span>
          </div>
          <div class="stat-item">
            <span>💬</span>
            <span>{{ entity.relatedMessagesCount || 0 }} 消息</span>
          </div>
          <div class="stat-item">
            <span>🌐</span>
            <span>{{ entity.relatedWebpagesCount || 0 }} 网页</span>
          </div>
          <div class="stat-item">
            <span>👁️</span>
            <span>{{ entity.accessCount || 0 }} 访问</span>
          </div>
        </div>
        
        <div v-if="entity.tags && entity.tags.length > 0" class="entity-tags">
          <span 
            v-for="(tag, index) in entity.tags.slice(0, 3)" 
            :key="index" 
            class="entity-tag"
          >
            {{ tag }}
          </span>
          <span v-if="entity.tags.length > 3" class="entity-tag more-tags">
            +{{ entity.tags.length - 3 }}
          </span>
        </div>
        
        <div class="entity-footer">
          <span class="last-accessed">
            最后访问: {{ formatTime(entity.lastAccessed || Date.now()) }}
          </span>
          <span v-if="entity.status" :class="'status-indicator ' + entity.status">
            {{ entity.status }}
          </span>
        </div>
      </div>
      
      <div v-if="entities.length === 0 && !isLoading" class="empty-state">
        <span>{{ getEntityIcon(entityType) }}</span>
        <p>暂无{{ getEntityTypeName(entityType) }}数据</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useMemoryStore, ENTITY_TYPE_CONFIG } from '../memory-store';

const route = useRoute();
const router = useRouter();
const store = useMemoryStore();

const entityType = computed(() => route.params.type as string);
const entities = computed(() => store.entities);
const isLoading = computed(() => store.isLoading);
const searchQuery = computed(() => store.searchQuery);

const getEntityIcon = (type: string) => {
  return ENTITY_TYPE_CONFIG[type]?.icon || '📂';
};

const getEntityTypeName = (type: string) => {
  return ENTITY_TYPE_CONFIG[type]?.name || type;
};

const handleEntityClick = (entity: any) => {
  if (entity.type === 'Topic') {
    router.push(`/topic/${entity.id}`);
  } else {
    console.log('点击实体:', entity);
  }
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

watch(entityType, (newType) => {
  if (newType) {
    store.loadEntitiesByType(newType);
  }
}, { immediate: true });
</script>
