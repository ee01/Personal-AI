<template>
  <div :class="['memory-entry-rules-page', { 'task-surface': isTaskSurface }]">
    <div v-if="onboarding" class="onboarding-banner">
      <div class="onboarding-title">配置记忆入口规则</div>
      <div class="onboarding-body">
        静默消息分析已开启。在这里添加你关心的话题规则后，系统会在后台识别相关消息并写入记忆；项目相关关注会在你维护
        Roadmap 时自动建立，无需在此重复配置。
      </div>
    </div>
    <iframe
      class="rules-frame"
      :src="iframeSrc"
      title="记忆入口规则"
      allow="clipboard-read; clipboard-write"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import {
  parseMemoryEntryRulesIntent,
  parseMemoryEntryRulesSurface,
} from '../../utils/memoryEntryRulesSurface';

const route = useRoute();

const onboarding = computed(() => {
  const raw = route.query.onboarding;
  if (Array.isArray(raw)) return raw[0] === '1' || raw[0] === 'true';
  return raw === '1' || raw === 'true';
});

const surface = computed(() => parseMemoryEntryRulesSurface(route.query.surface));
const isTaskSurface = computed(() => surface.value === 'task');
const intent = computed(() => parseMemoryEntryRulesIntent(route.query.intent));

const iframeSrc = computed(() => {
  const params = new URLSearchParams();
  if (onboarding.value) params.set('onboarding', '1');
  if (isTaskSurface.value) params.set('surface', 'task');
  if (intent.value !== 'manual') params.set('intent', intent.value);
  const query = params.toString();
  return `${chrome.runtime.getURL('topic-modal.html')}${query ? `?${query}` : ''}`;
});

onMounted(async () => {
  if (!onboarding.value) return;
  try {
    await chrome.storage.local.set({ silentAnalysisOnboarded: true });
  } catch (error) {
    console.warn('Failed to persist silentAnalysisOnboarded:', error);
  }
});
</script>

<style scoped>
.memory-entry-rules-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: #0b1020;
}

.memory-entry-rules-page.task-surface {
  border-radius: 12px;
  overflow: hidden;
}

.onboarding-banner {
  flex: none;
  margin: 12px 16px 0;
  padding: 12px 14px;
  border: 1px solid #e5e3db;
  border-radius: 10px;
  background: #fff8ef;
}

.onboarding-title {
  font-weight: 700;
  font-size: 14px;
  color: #20242a;
  margin-bottom: 4px;
}

.onboarding-body {
  font-size: 12.5px;
  line-height: 1.5;
  color: #5b6570;
}

.rules-frame {
  flex: 1;
  width: 100%;
  min-height: 0;
  border: 0;
  background: #0b1020;
}
</style>
