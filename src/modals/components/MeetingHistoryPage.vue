<template>
  <div class="meeting-history-page">
    <section class="meeting-hero">
      <div>
        <div class="meeting-hero-eyebrow">Meeting Pilot Archive</div>
        <h2>📡 会议记录</h2>
        <p>
          这里收拢所有已归档会议。你可以快速查看参会者、Digest/PDF 状态，
          然后重新打开 Panorama 继续回顾会中脉络。归档后的会议也会默认参与
          `/ask` 与普通记忆召回，方便下次继续关联历史结论与行动项。
        </p>
      </div>
      <div class="meeting-hero-side">
        <div class="meeting-hero-stat">
          <span>已归档</span>
          <strong>{{ meetingTotal || meetings.length }}</strong>
        </div>
        <button
          class="meeting-refresh-btn"
          :disabled="loading"
          @click="loadMeetings"
        >
          {{ loading ? '刷新中…' : '刷新列表' }}
        </button>
      </div>
    </section>

    <div v-if="loading" class="loading-container">
      <div class="loading-spinner"></div>
      <span>正在加载会议记录…</span>
    </div>

    <section v-else-if="error" class="meeting-feedback-card is-error">
      <div class="feedback-title">加载会议记录失败</div>
      <p>{{ error }}</p>
      <button class="meeting-refresh-btn" @click="loadMeetings">重试</button>
    </section>

    <section
      v-else-if="sortedMeetings.length === 0"
      class="meeting-feedback-card"
    >
      <div class="feedback-title">还没有会议记录</div>
      <p>
        Meeting Pilot 会在会议结束后把结构化结果归档到这里。下次完成一场会议后，
        你就能从这个入口直接回看 Panorama 和 PDF 纪要。
      </p>
    </section>

    <section v-else class="meeting-grid">
      <article
        v-for="meeting in sortedMeetings"
        :key="meeting.meetingId"
        class="meeting-card"
      >
        <div class="meeting-card-head">
          <div>
            <div class="meeting-card-date">
              {{ formatMeetingDate(meeting.date) }}
            </div>
            <h3>{{ meeting.title || '未命名会议' }}</h3>
          </div>
          <div class="meeting-card-badges">
            <span class="status-pill" :class="getDigestStatus(meeting).kind">
              {{ getDigestStatus(meeting).label }}
            </span>
            <span class="status-pill" :class="getPdfStatus(meeting).kind">
              {{ getPdfStatus(meeting).label }}
            </span>
          </div>
        </div>

        <div class="meeting-card-meta">
          <span
            >🕒
            {{ formatMeetingTime(meeting.lastEventAt || meeting.date) }}</span
          >
          <span>🆔 {{ shortMeetingId(meeting.meetingId) }}</span>
        </div>

        <div class="meeting-card-section">
          <div class="section-label">参会者</div>
          <div class="participant-list">
            <span
              v-for="participant in displayParticipants(meeting.participants)"
              :key="`${meeting.meetingId}-${participant}`"
              class="participant-chip"
            >
              {{ participant }}
            </span>
            <span
              v-if="!meeting.participants?.length"
              class="participant-chip muted"
            >
              待补充参会者信息
            </span>
          </div>
        </div>

        <div class="meeting-card-section">
          <div class="section-label">会后状态</div>
          <div class="meeting-card-summary">
            <strong>{{ getDigestSummary(meeting) }}</strong>
            <span>{{ getPdfSummary(meeting) }}</span>
          </div>
        </div>

        <div v-if="meeting.summary" class="meeting-card-section">
          <div class="section-label">会议摘要</div>
          <div class="meeting-card-summary is-summary">
            <span>{{ meeting.summary }}</span>
          </div>
        </div>

        <div class="meeting-card-section">
          <div class="section-label">结构化信息</div>
          <div class="meeting-card-metrics">
            <span>话题 {{ meeting.topicCount || 0 }}</span>
            <span>行动项 {{ meeting.actionItemCount || 0 }}</span>
            <span>决议 {{ meeting.decisionCount || 0 }}</span>
          </div>
        </div>

        <div class="meeting-card-footer">
          <button class="meeting-primary-action" @click="openPanorama(meeting)">
            打开 Panorama
          </button>
          <button
            class="meeting-secondary-action"
            :disabled="!meeting.pdfUrl"
            @click="openPdf(meeting.pdfUrl)"
          >
            打开 PDF
          </button>
        </div>
      </article>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import {
  getMemoryServiceClient,
  type MeetingRecord,
  type MeetingRecordListResponse,
} from '../../services/MemoryServiceClient';

/* eslint-disable no-undef */
declare const chrome: any;
/* eslint-enable no-undef */

interface MeetingResponseEnvelope {
  success?: boolean;
  error?: string;
  total?: number;
  data?: MeetingRecordListResponse;
}

const meetings = ref<MeetingRecord[]>([]);
const meetingTotal = ref(0);
const loading = ref(false);
const error = ref('');

const sortedMeetings = computed(() =>
  [...meetings.value].sort(
    (left, right) =>
      (normalizeTimestamp(right.lastEventAt || right.date) || 0) -
      (normalizeTimestamp(left.lastEventAt || left.date) || 0),
  ),
);

onMounted(() => {
  void loadMeetings();
});

async function loadMeetings() {
  loading.value = true;
  error.value = '';

  try {
    const response = (await chrome.runtime.sendMessage({
      type: 'GET_MEETINGS',
      limit: 50,
      offset: 0,
    })) as MeetingResponseEnvelope;

    if (!response?.success) {
      throw new Error(response?.error || '会议记录接口返回异常');
    }

    meetings.value = response?.data?.items || [];
    meetingTotal.value = Number(
      response?.data?.total || response?.total || meetings.value.length,
    );
    loading.value = false;
    return;
  } catch (runtimeError) {
    console.warn(
      '通过 background 加载会议记录失败，尝试直接请求:',
      runtimeError,
    );
  }

  try {
    const client = getMemoryServiceClient();
    const response = await client.getMeetings(50, 0);
    meetings.value = response.items || [];
    meetingTotal.value = Number(response.total || meetings.value.length);
  } catch (directError) {
    error.value =
      directError instanceof Error
        ? directError.message
        : '暂时无法连接会议记录服务';
    meetings.value = [];
    meetingTotal.value = 0;
  } finally {
    loading.value = false;
  }
}

function getDigestStatus(meeting: MeetingRecord) {
  if (meeting.pdfUrl) return { label: 'Digest 完成', kind: 'is-ready' };
  if (meeting.digestId) return { label: 'Digest 生成中', kind: 'is-progress' };
  return { label: '已落库', kind: 'is-archived' };
}

function getPdfStatus(meeting: MeetingRecord) {
  if (meeting.pdfUrl) return { label: 'PDF 已就绪', kind: 'is-ready' };
  if (meeting.digestId) return { label: '等待 PDF', kind: 'is-progress' };
  return { label: '暂未生成 PDF', kind: 'is-muted' };
}

function getDigestSummary(meeting: MeetingRecord) {
  if (meeting.pdfUrl) {
    return '会后 Digest 与 PDF 纪要都已完成，可以直接进入 Panorama 或打开正式 PDF。';
  }
  if (meeting.digestId) {
    return '结构化会议记录已经归档，Digest 正在继续生成 PDF 纪要。';
  }
  return '会议基础记录已归档，当前还没有关联的 Digest/PDF 产物。';
}

function getPdfSummary(meeting: MeetingRecord) {
  if (meeting.pdfUrl) {
    return 'PDF 可直接预览或下载。';
  }
  if (meeting.digestId) {
    return '可先打开 Panorama 回顾会议结构，稍后再回来查看 PDF。';
  }
  return '该会议当前只保留了历史记录入口。';
}

function displayParticipants(participants: string[] = []) {
  return participants.slice(0, 5);
}

function normalizeTimestamp(timestamp?: number) {
  const parsed = Number(timestamp || 0);
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return parsed > 1_000_000_000_000 ? parsed : parsed * 1000;
}

function formatMeetingDate(timestamp?: number) {
  const normalized = normalizeTimestamp(timestamp);
  if (!normalized) return '时间待补充';
  return new Date(normalized).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  });
}

function formatMeetingTime(timestamp?: number) {
  const normalized = normalizeTimestamp(timestamp);
  if (!normalized) return '--:--';
  return new Date(normalized).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function shortMeetingId(meetingId: string) {
  if (!meetingId) return '未知会议';
  return meetingId.length > 18
    ? `${meetingId.slice(0, 8)}…${meetingId.slice(-6)}`
    : meetingId;
}

function openPanorama(meeting: MeetingRecord) {
  const date = normalizeTimestamp(meeting.date) || 0;
  const lastEventAt =
    normalizeTimestamp(meeting.lastEventAt || meeting.date) || date;
  const params = new URLSearchParams({
    history: '1',
    meetingId: meeting.meetingId,
    title: meeting.title || '会议记录',
    date: String(date),
    lastEventAt: String(lastEventAt),
    participants: JSON.stringify(meeting.participants || []),
  });

  if (meeting.pdfUrl) params.set('pdfUrl', meeting.pdfUrl);
  if (meeting.digestId) params.set('digestId', meeting.digestId);

  const url =
    typeof chrome !== 'undefined' && chrome?.runtime?.getURL
      ? chrome.runtime.getURL(`meeting-panorama.html?${params.toString()}`)
      : `meeting-panorama.html?${params.toString()}`;
  window.open(url, '_blank', 'noopener');
}

function openPdf(pdfUrl?: string) {
  if (!pdfUrl) return;
  window.open(pdfUrl, '_blank', 'noopener');
}
</script>

<style scoped>
.meeting-history-page {
  animation: fadeInUp 0.6s ease-out;
}

.meeting-hero,
.meeting-card,
.meeting-feedback-card {
  background:
    radial-gradient(
      circle at top right,
      rgba(108, 92, 231, 0.14),
      transparent 30%
    ),
    rgba(15, 23, 42, 0.72);
  border: 1px solid rgba(148, 163, 184, 0.12);
  border-radius: 1rem;
  backdrop-filter: blur(14px);
}

.meeting-hero {
  display: flex;
  justify-content: space-between;
  gap: 1.5rem;
  padding: 1.75rem;
  margin-bottom: 1.5rem;
}

.meeting-hero-eyebrow {
  font-size: 0.72rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: #a29bfe;
  margin-bottom: 0.75rem;
}

.meeting-hero h2 {
  margin: 0;
  font-size: 1.75rem;
  font-weight: 700;
}

.meeting-hero p,
.meeting-feedback-card p {
  margin: 0.75rem 0 0;
  color: #cbd5e1;
  line-height: 1.6;
  max-width: 42rem;
}

.meeting-hero-side {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
}

.meeting-hero-stat {
  min-width: 7rem;
  padding: 0.9rem 1rem;
  border-radius: 1rem;
  background: rgba(36, 40, 54, 0.78);
  border: 1px solid rgba(108, 92, 231, 0.28);
  text-align: right;
}

.meeting-hero-stat span {
  display: block;
  font-size: 0.75rem;
  color: #8b8fa3;
}

.meeting-hero-stat strong {
  display: block;
  margin-top: 0.3rem;
  font-size: 1.8rem;
  line-height: 1;
}

.meeting-refresh-btn,
.meeting-primary-action,
.meeting-secondary-action {
  border: none;
  border-radius: 0.85rem;
  padding: 0.8rem 1.1rem;
  font-size: 0.92rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.25s ease;
}

.meeting-refresh-btn,
.meeting-primary-action {
  background: linear-gradient(
    135deg,
    rgba(108, 92, 231, 0.95),
    rgba(162, 155, 254, 0.92)
  );
  color: #fff;
  box-shadow: 0 10px 24px rgba(108, 92, 231, 0.22);
}

.meeting-refresh-btn:hover,
.meeting-primary-action:hover {
  transform: translateY(-1px);
  box-shadow: 0 14px 28px rgba(108, 92, 231, 0.28);
}

.meeting-secondary-action {
  background: rgba(148, 163, 184, 0.1);
  color: #e2e8f0;
  border: 1px solid rgba(148, 163, 184, 0.14);
}

.meeting-secondary-action:hover:not(:disabled) {
  background: rgba(148, 163, 184, 0.16);
}

.meeting-refresh-btn:disabled,
.meeting-secondary-action:disabled {
  opacity: 0.55;
  cursor: not-allowed;
  box-shadow: none;
  transform: none;
}

.meeting-feedback-card {
  padding: 1.5rem;
}

.meeting-feedback-card.is-error {
  border-color: rgba(255, 107, 107, 0.28);
}

.feedback-title {
  font-size: 1.05rem;
  font-weight: 700;
}

.meeting-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 1rem;
}

.meeting-card {
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.meeting-card-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
}

.meeting-card-head h3 {
  margin: 0.3rem 0 0;
  font-size: 1.1rem;
  line-height: 1.4;
}

.meeting-card-date {
  font-size: 0.8rem;
  color: #8b8fa3;
}

.meeting-card-badges {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  align-items: flex-end;
}

.status-pill {
  padding: 0.35rem 0.75rem;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 700;
  border: 1px solid transparent;
  white-space: nowrap;
}

.status-pill.is-ready {
  background: rgba(105, 219, 124, 0.1);
  color: #69db7c;
  border-color: rgba(105, 219, 124, 0.28);
}

.status-pill.is-progress {
  background: rgba(255, 212, 59, 0.1);
  color: #ffd43b;
  border-color: rgba(255, 212, 59, 0.22);
}

.status-pill.is-archived,
.status-pill.is-muted {
  background: rgba(148, 163, 184, 0.1);
  color: #cbd5e1;
  border-color: rgba(148, 163, 184, 0.16);
}

.meeting-card-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  font-size: 0.82rem;
  color: #94a3b8;
}

.meeting-card-section {
  padding: 0.9rem 1rem;
  border-radius: 0.9rem;
  background: rgba(36, 40, 54, 0.68);
  border: 1px solid rgba(148, 163, 184, 0.08);
}

.section-label {
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: #8b8fa3;
  margin-bottom: 0.65rem;
}

.participant-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.participant-chip {
  padding: 0.35rem 0.7rem;
  border-radius: 999px;
  background: rgba(108, 92, 231, 0.12);
  border: 1px solid rgba(108, 92, 231, 0.22);
  color: #e4e7ef;
  font-size: 0.78rem;
}

.participant-chip.muted {
  background: rgba(148, 163, 184, 0.08);
  border-color: rgba(148, 163, 184, 0.14);
  color: #94a3b8;
}

.meeting-card-summary {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.meeting-card-summary.is-summary span {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.meeting-card-summary strong {
  font-size: 0.95rem;
  line-height: 1.5;
}

.meeting-card-summary span {
  color: #aeb9ca;
  font-size: 0.84rem;
  line-height: 1.5;
}

.meeting-card-metrics {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.meeting-card-metrics span {
  padding: 0.35rem 0.7rem;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.08);
  border: 1px solid rgba(148, 163, 184, 0.14);
  color: #e2e8f0;
  font-size: 0.78rem;
  font-weight: 600;
}

.meeting-card-footer {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.75rem;
}

@media (max-width: 900px) {
  .meeting-hero {
    flex-direction: column;
  }

  .meeting-hero-side {
    align-items: stretch;
  }
}

@media (max-width: 640px) {
  .meeting-card-head,
  .meeting-card-footer {
    grid-template-columns: 1fr;
    display: grid;
  }

  .meeting-card-badges {
    align-items: flex-start;
  }
}
</style>
