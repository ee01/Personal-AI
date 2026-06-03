<template>
  <div class="source-memory-page">
    <button class="back-link" type="button" @click="goBack">← 返回</button>

    <section v-if="loading" class="state-panel">正在读取资料记忆...</section>

    <section v-else-if="errorMessage" class="state-panel error">
      <h2>资料记忆不可用</h2>
      <p>{{ errorMessage }}</p>
      <button type="button" @click="loadCapsule">重试</button>
    </section>

    <article v-else-if="capsule" class="source-memory-detail">
      <header class="detail-header">
        <div>
          <p class="eyebrow">资料记忆</p>
          <h1>{{ capsule.sourceTitle || '未命名资料' }}</h1>
          <p class="subtitle">
            {{ capsule.summary || capsule.contentPreview }}
          </p>
        </div>
        <div class="header-actions">
          <button
            v-if="safeSourceUrl"
            type="button"
            class="primary-action"
            @click="openSource"
          >
            打开来源
          </button>
          <router-link
            v-if="capsule.messageId"
            class="secondary-action"
            :to="timelineRoute"
          >
            查看关联记忆
          </router-link>
        </div>
      </header>

      <div class="status-strip">
        <span :class="['status-chip', capsule.status]">
          {{ statusLabel(capsule.status) }}
        </span>
        <span class="status-chip">{{
          sourceKindLabel(capsule.sourceKind)
        }}</span>
        <span class="status-chip">{{
          captureModeLabel(capsule.captureMode)
        }}</span>
        <span class="status-chip">{{ scopeLabel(capsule.scope) }}</span>
        <span class="status-chip">{{
          privacyLabel(capsule.privacyLevel)
        }}</span>
      </div>

      <section class="detail-grid">
        <div class="detail-panel">
          <h2>为什么保存</h2>
          <p>{{ capsule.captureReason || '用户关注的资料内容' }}</p>
          <dl class="meta-list">
            <div>
              <dt>保存时间</dt>
              <dd>
                {{ formatTimestamp(capsule.savedAt || capsule.createdAt) }}
              </dd>
            </div>
            <div>
              <dt>更新时间</dt>
              <dd>{{ formatTimestamp(capsule.updatedAt) }}</dd>
            </div>
            <div v-if="capsule.sourceHost">
              <dt>来源站点</dt>
              <dd>{{ capsule.sourceHost }}</dd>
            </div>
            <div v-if="capsule.sourceUrl">
              <dt>来源链接</dt>
              <dd class="source-url">{{ capsule.sourceUrl }}</dd>
            </div>
          </dl>
        </div>

        <div class="detail-panel">
          <h2>原文预览</h2>
          <p class="preview-text">
            {{ capsule.contentPreview || '暂无预览内容' }}
          </p>
        </div>
      </section>

      <section class="detail-panel">
        <h2>证据锚点</h2>
        <div v-if="capsule.anchors.length" class="anchor-list">
          <article
            v-for="anchor in capsule.anchors"
            :key="anchor.id"
            class="evidence-card"
          >
            <div class="card-meta">
              <span>{{ anchorKindLabel(anchor.anchorKind) }}</span>
              <span>置信度 {{ formatConfidence(anchor.confidence) }}</span>
              <span>{{ sensitivityLabel(anchor.sensitivity) }}</span>
            </div>
            <p>{{ anchor.quoteOrPreview }}</p>
          </article>
        </div>
        <p v-else class="empty-note">这条资料记忆还没有证据锚点。</p>
      </section>

      <section class="detail-grid">
        <div class="detail-panel">
          <h2>草稿要点</h2>
          <div v-if="capsule.takeaways.length" class="takeaway-list">
            <article
              v-for="takeaway in capsule.takeaways"
              :key="takeaway.id"
              class="mini-card"
            >
              <div class="card-meta">
                <span>{{ takeaway.status || 'draft' }}</span>
                <span>置信度 {{ formatConfidence(takeaway.confidence) }}</span>
              </div>
              <h3>{{ takeaway.title }}</h3>
              <p>{{ takeaway.body }}</p>
            </article>
          </div>
          <p v-else class="empty-note">还没有抽取草稿要点。</p>
        </div>

        <div class="detail-panel">
          <h2>未来触发线索</h2>
          <div v-if="capsule.triggers.length" class="trigger-list">
            <article
              v-for="trigger in capsule.triggers"
              :key="trigger.id"
              class="mini-card"
            >
              <div class="card-meta">
                <span>{{ triggerKindLabel(trigger.triggerKind) }}</span>
                <span>{{ trigger.defaultBehavior }}</span>
              </div>
              <p>{{ trigger.description }}</p>
            </article>
          </div>
          <p v-else class="empty-note">还没有未来触发线索。</p>
        </div>
      </section>

      <section class="danger-panel" v-if="capsule.status === 'saved'">
        <div>
          <h2>不再使用这条资料</h2>
          <p>撤销后会移除关联的 web 记忆信号，后续召回不再使用这条 capsule。</p>
        </div>
        <button type="button" :disabled="dismissing" @click="dismissCapsule">
          {{ dismissing ? '撤销中...' : '撤销资料记忆' }}
        </button>
      </section>
    </article>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  getMemoryServiceClient,
  type SourceMemoryCapsule,
  type SourceMemoryCaptureMode,
  type SourceMemoryPrivacyLevel,
} from '../../services/MemoryServiceClient';

const route = useRoute();
const router = useRouter();
const client = getMemoryServiceClient();

const capsule = ref<SourceMemoryCapsule | null>(null);
const loading = ref(false);
const dismissing = ref(false);
const errorMessage = ref('');

const capsuleId = computed(() => String(route.params.id || '').trim());
const safeSourceUrl = computed(() => {
  const value = capsule.value?.sourceUrl?.trim();
  if (!value) return '';
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
      ? parsed.href
      : '';
  } catch (_error) {
    return '';
  }
});

const timelineRoute = computed(() => ({
  path: '/timeline',
  query: {
    focus: capsule.value?.messageId || '',
    type: 'message',
  },
}));

async function loadCapsule() {
  if (!capsuleId.value) {
    errorMessage.value = '缺少资料记忆 ID。';
    return;
  }

  loading.value = true;
  errorMessage.value = '';
  try {
    const response = await client.getSourceMemoryCapsule(capsuleId.value);
    capsule.value = response.capsule;
  } catch (error) {
    capsule.value = null;
    errorMessage.value = String((error as Error)?.message || error);
  } finally {
    loading.value = false;
  }
}

async function dismissCapsule() {
  if (!capsule.value || dismissing.value) return;
  dismissing.value = true;
  errorMessage.value = '';
  try {
    const response = await client.dismissSourceMemoryCapsule(
      capsule.value.id,
      '用户在资料记忆详情页撤销',
    );
    capsule.value = response.capsule;
  } catch (error) {
    errorMessage.value = String((error as Error)?.message || error);
  } finally {
    dismissing.value = false;
  }
}

function openSource() {
  if (!safeSourceUrl.value) return;
  window.open(safeSourceUrl.value, '_blank', 'noopener,noreferrer');
}

function goBack() {
  if (window.history.state?.back) {
    router.back();
    return;
  }
  router.push('/timeline');
}

function formatTimestamp(value?: number) {
  if (!value) return '未知';
  return new Date(value * 1000).toLocaleString('zh-CN', {
    hour12: false,
  });
}

function formatConfidence(value?: number) {
  if (!Number.isFinite(value)) return '未知';
  return `${Math.round(Number(value) * 100)}%`;
}

function statusLabel(value: string) {
  if (value === 'saved') return '已保存';
  if (value === 'dismissed') return '已撤销';
  return value || '未知状态';
}

function sourceKindLabel(value: string) {
  const labels: Record<string, string> = {
    webpage: '整页资料',
    selection: '选中文本',
    jira_comment: 'Jira 评论',
    message_reply: '消息回复',
    web_ai_prompt: 'Web AI 输入',
    manual: '手动录入',
  };
  return labels[value] || value || '资料来源';
}

function captureModeLabel(value: SourceMemoryCaptureMode) {
  const labels: Record<SourceMemoryCaptureMode, string> = {
    manual: '主动保存',
    suggested: '建议后保存',
    auto: '自动保存',
  };
  return labels[value] || value;
}

function scopeLabel(value: SourceMemoryCapsule['scope']) {
  return value === 'personal' ? '个人范围' : '工作范围';
}

function privacyLabel(value: SourceMemoryPrivacyLevel) {
  const labels: Record<SourceMemoryPrivacyLevel, string> = {
    private: '私有',
    work: '工作可用',
    shareable_summary: '仅摘要可分享',
    needs_review: '需复核',
  };
  return labels[value] || value;
}

function anchorKindLabel(value: string) {
  if (value === 'text_selection') return '选区证据';
  if (value === 'page_excerpt') return '页面摘录';
  return value || '证据';
}

function sensitivityLabel(value: string) {
  if (value === 'normal') return '普通';
  if (value === 'internal') return '内部';
  return value || '未标记';
}

function triggerKindLabel(value: string) {
  if (value === 'host') return '站点';
  if (value === 'entity') return '实体';
  if (value === 'title') return '标题';
  return value || '线索';
}

watch(capsuleId, () => {
  void loadCapsule();
});

onMounted(() => {
  void loadCapsule();
});
</script>

<style scoped>
.source-memory-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 24px;
  color: #111827;
}

.back-link {
  align-self: flex-start;
  border: 1px solid #d1d5db;
  background: #ffffff;
  color: #374151;
  border-radius: 6px;
  padding: 8px 12px;
  cursor: pointer;
}

.back-link:hover,
.back-link:focus-visible {
  border-color: #2563eb;
  color: #1d4ed8;
}

.state-panel,
.source-memory-detail {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 10px 28px rgba(15, 23, 42, 0.08);
}

.state-panel.error {
  border-color: #fecaca;
  background: #fff7f7;
}

.state-panel h2 {
  margin: 0 0 8px;
  font-size: 20px;
}

.state-panel button {
  border: none;
  border-radius: 6px;
  background: #1d4ed8;
  color: #ffffff;
  padding: 8px 12px;
  cursor: pointer;
}

.source-memory-detail {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.detail-header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 18px;
  align-items: start;
}

.eyebrow {
  margin: 0 0 6px;
  font-size: 13px;
  font-weight: 700;
  color: #2563eb;
}

.detail-header h1 {
  margin: 0;
  font-size: 28px;
  line-height: 1.2;
}

.subtitle {
  margin: 10px 0 0;
  color: #4b5563;
  line-height: 1.6;
}

.header-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.primary-action,
.secondary-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 36px;
  border-radius: 6px;
  padding: 8px 12px;
  font-weight: 700;
  text-decoration: none;
  cursor: pointer;
}

.primary-action {
  border: none;
  background: #2563eb;
  color: #ffffff;
}

.secondary-action {
  border: 1px solid #d1d5db;
  background: #ffffff;
  color: #1f2937;
}

.status-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.status-chip {
  border: 1px solid #d1d5db;
  border-radius: 999px;
  padding: 5px 10px;
  background: #f9fafb;
  color: #374151;
  font-size: 13px;
  font-weight: 700;
}

.status-chip.saved {
  border-color: #bbf7d0;
  background: #ecfdf5;
  color: #047857;
}

.status-chip.dismissed {
  border-color: #fecaca;
  background: #fff1f2;
  color: #be123c;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.detail-panel {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fbfdff;
  padding: 16px;
}

.detail-panel h2,
.danger-panel h2 {
  margin: 0 0 10px;
  font-size: 17px;
}

.detail-panel p {
  margin: 0;
  line-height: 1.65;
  color: #374151;
}

.preview-text,
.source-url {
  overflow-wrap: anywhere;
}

.meta-list {
  display: grid;
  gap: 10px;
  margin: 14px 0 0;
}

.meta-list div {
  display: grid;
  grid-template-columns: 88px minmax(0, 1fr);
  gap: 10px;
}

.meta-list dt {
  color: #6b7280;
  font-weight: 700;
}

.meta-list dd {
  margin: 0;
  color: #111827;
}

.anchor-list,
.takeaway-list,
.trigger-list {
  display: grid;
  gap: 10px;
}

.evidence-card,
.mini-card {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #ffffff;
  padding: 12px;
}

.mini-card h3 {
  margin: 8px 0 6px;
  font-size: 15px;
}

.card-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  color: #6b7280;
  font-size: 12px;
  font-weight: 700;
}

.empty-note {
  color: #6b7280;
}

.danger-panel {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  border: 1px solid #fecaca;
  border-radius: 8px;
  background: #fff7f7;
  padding: 16px;
}

.danger-panel p {
  margin: 0;
  color: #7f1d1d;
}

.danger-panel button {
  border: none;
  border-radius: 6px;
  background: #dc2626;
  color: #ffffff;
  padding: 8px 12px;
  font-weight: 700;
  cursor: pointer;
}

.danger-panel button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

@media (max-width: 820px) {
  .source-memory-page {
    padding: 16px;
  }

  .detail-header,
  .detail-grid {
    grid-template-columns: 1fr;
  }

  .header-actions {
    justify-content: flex-start;
  }

  .danger-panel {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
