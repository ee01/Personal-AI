<template>
  <div class="decision-center">
    <h2 class="section-title">⚖ 决策中心 ({{ pendingRequests.length }})</h2>

    <div v-if="loading" class="loading-container">
      <div class="loading-spinner"></div>
      <p>加载中...</p>
    </div>

    <div v-else-if="pendingRequests.length === 0" class="empty-state">
      <span>✅</span>
      <p>暂无待处理决策</p>
    </div>

    <TransitionGroup v-else name="card" tag="div" class="decision-list">
      <div
        v-for="req in pendingRequests"
        :key="req.id"
        class="decision-card"
      >
        <div class="card-top">
          <span
            class="priority-badge"
            :class="priorityClass(req.priority)"
          >{{ priorityLabel(req.priority) }}</span>
          <span v-if="req.category" class="category-tag">{{ req.category }}</span>
          <span class="created-time">{{ relativeTime(req.createdAt) }}</span>
        </div>

        <h3 class="question-text">{{ req.question }}</h3>
        <p v-if="req.context" class="context-text">{{ req.context }}</p>

        <div v-if="cardErrors[req.id]" class="card-error">
          {{ cardErrors[req.id] }}
        </div>

        <div class="detail-toggle" @click="toggleDetail(req.id)">
          {{ showDetail[req.id] ? '收起备注 ▲' : '添加备注 ▼' }}
        </div>
        <textarea
          v-if="showDetail[req.id]"
          v-model="detailTexts[req.id]"
          class="detail-input"
          placeholder="可选：补充说明..."
          rows="2"
        />

        <div class="action-buttons">
          <template v-if="req.options && req.options.length > 0">
            <button
              v-for="opt in req.options"
              :key="opt.value"
              class="option-btn"
              :disabled="submitting[req.id]"
              @click="submitAnswer(req.id, opt.value)"
            >
              {{ opt.label }}
            </button>
          </template>
          <template v-else>
            <button
              class="option-btn yes"
              :disabled="submitting[req.id]"
              @click="submitAnswer(req.id, 'yes')"
            >是</button>
            <button
              class="option-btn no"
              :disabled="submitting[req.id]"
              @click="submitAnswer(req.id, 'no')"
            >否</button>
          </template>
        </div>
      </div>
    </TransitionGroup>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, reactive } from 'vue';
import {
  getMemoryServiceClient,
  type ConfirmRequest,
} from '../../services/MemoryServiceClient';

const client = getMemoryServiceClient();

const loading = ref(true);
const pendingRequests = ref<ConfirmRequest[]>([]);
const showDetail = reactive<Record<string, boolean>>({});
const detailTexts = reactive<Record<string, string>>({});
const submitting = reactive<Record<string, boolean>>({});
const cardErrors = reactive<Record<string, string>>({});

onMounted(async () => {
  await fetchPending();
});

async function fetchPending() {
  loading.value = true;
  try {
    const res = await client.getConfirmRequests('pending', 50);
    pendingRequests.value = res.items;
  } catch (e: any) {
    console.error('Failed to load confirm requests', e);
  } finally {
    loading.value = false;
  }
}

function toggleDetail(id: string) {
  showDetail[id] = !showDetail[id];
}

async function submitAnswer(id: string, answer: string) {
  submitting[id] = true;
  delete cardErrors[id];
  try {
    const detail = detailTexts[id]?.trim() || undefined;
    await client.answerConfirmRequest(id, answer, detail);
    pendingRequests.value = pendingRequests.value.filter((r) => r.id !== id);
  } catch (e: any) {
    cardErrors[id] = e.message || '提交失败，请重试';
  } finally {
    submitting[id] = false;
  }
}

function priorityClass(p: string) {
  if (p === 'high') return 'high';
  if (p === 'low') return 'low';
  return 'normal';
}

function priorityLabel(p: string) {
  if (p === 'high') return '高';
  if (p === 'low') return '低';
  return '普通';
}

function relativeTime(ts: number) {
  const diff = Date.now() - ts * 1000;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins}分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  return `${days}天前`;
}
</script>

<style scoped>
.decision-center {
  animation: fadeInUp 0.6s ease-out;
}

.section-title {
  font-size: 1.5rem;
  font-weight: 600;
  margin-bottom: 1.5rem;
}

.decision-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.decision-card {
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid rgba(148, 163, 184, 0.1);
  border-radius: 1rem;
  padding: 1.5rem;
  backdrop-filter: blur(10px);
  transition: all 0.3s ease;
}

.decision-card:hover {
  border-color: rgba(59, 130, 246, 0.3);
  box-shadow: 0 8px 32px rgba(59, 130, 246, 0.1);
}

.card-top {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.priority-badge {
  padding: 0.2rem 0.6rem;
  border-radius: 1rem;
  font-size: 0.75rem;
  font-weight: 600;
}

.priority-badge.high {
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
}

.priority-badge.normal {
  background: rgba(59, 130, 246, 0.2);
  color: #60a5fa;
}

.priority-badge.low {
  background: rgba(148, 163, 184, 0.2);
  color: #94a3b8;
}

.category-tag {
  padding: 0.2rem 0.6rem;
  background: rgba(147, 51, 234, 0.2);
  color: #a78bfa;
  border-radius: 1rem;
  font-size: 0.75rem;
  font-weight: 500;
}

.created-time {
  margin-left: auto;
  font-size: 0.75rem;
  color: #64748b;
}

.question-text {
  font-size: 1.1rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
  line-height: 1.4;
}

.context-text {
  color: #cbd5e1;
  font-size: 0.875rem;
  line-height: 1.5;
  margin-bottom: 0.75rem;
}

.card-error {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 0.5rem;
  padding: 0.5rem 0.75rem;
  color: #ef4444;
  font-size: 0.8rem;
  margin-bottom: 0.5rem;
}

.detail-toggle {
  color: #60a5fa;
  font-size: 0.8rem;
  cursor: pointer;
  margin-bottom: 0.5rem;
  user-select: none;
}

.detail-toggle:hover {
  color: #93c5fd;
}

.detail-input {
  width: 100%;
  padding: 0.5rem 0.75rem;
  background: rgba(30, 41, 59, 0.6);
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 0.5rem;
  color: #ffffff;
  font-size: 0.875rem;
  resize: vertical;
  margin-bottom: 0.75rem;
}

.detail-input:focus {
  outline: none;
  border-color: #60a5fa;
}

.action-buttons {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.option-btn {
  padding: 0.5rem 1.25rem;
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.3);
  border-radius: 0.5rem;
  color: #60a5fa;
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 500;
  transition: all 0.3s ease;
}

.option-btn:hover:not(:disabled) {
  background: rgba(59, 130, 246, 0.2);
  border-color: rgba(59, 130, 246, 0.5);
}

.option-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.option-btn.yes {
  background: rgba(34, 197, 94, 0.1);
  border-color: rgba(34, 197, 94, 0.3);
  color: #22c55e;
}

.option-btn.yes:hover:not(:disabled) {
  background: rgba(34, 197, 94, 0.2);
  border-color: rgba(34, 197, 94, 0.5);
}

.option-btn.no {
  background: rgba(239, 68, 68, 0.1);
  border-color: rgba(239, 68, 68, 0.3);
  color: #ef4444;
}

.option-btn.no:hover:not(:disabled) {
  background: rgba(239, 68, 68, 0.2);
  border-color: rgba(239, 68, 68, 0.5);
}

/* TransitionGroup animations */
.card-enter-active {
  transition: all 0.3s ease-out;
}

.card-leave-active {
  transition: all 0.3s ease-in;
}

.card-enter-from {
  opacity: 0;
  transform: translateY(20px);
}

.card-leave-to {
  opacity: 0;
  transform: translateX(30px) scale(0.95);
}
</style>
