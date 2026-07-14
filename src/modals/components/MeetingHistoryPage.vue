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
          <small v-if="meetingTotal > meetings.length">
            已显示 {{ meetings.length }} 条
          </small>
        </div>
        <button
          class="meeting-refresh-btn"
          :disabled="loading"
          @click="loadMeetings('refresh')"
        >
          {{ loading ? '刷新中…' : '刷新列表' }}
        </button>
      </div>
    </section>

    <section class="meeting-filter-bar" aria-label="会议记录筛选">
      <form class="meeting-search-form" @submit.prevent="applyArchiveFilters">
        <input
          v-model="searchInput"
          class="meeting-search-input"
          type="search"
          aria-label="搜索会议记录"
          placeholder="搜索标题、摘要、参会者、会议 ID 或转写片段"
          :disabled="loading"
        />
        <button
          class="meeting-secondary-action"
          type="submit"
          :disabled="loading"
        >
          搜索
        </button>
      </form>
      <label class="meeting-status-filter">
        <span>状态</span>
        <select
          v-model="statusFilter"
          :disabled="loading"
          @change="applyArchiveFilters"
        >
          <option
            v-for="option in statusFilterOptions"
            :key="option.value"
            :value="option.value"
          >
            {{ option.label }}
          </option>
        </select>
      </label>
      <button
        v-if="hasActiveFilters"
        class="meeting-ghost-action"
        type="button"
        :disabled="loading"
        @click="clearArchiveFilters"
      >
        清除筛选
      </button>
    </section>

    <section
      v-if="archiveLoadReceipt"
      class="meeting-archive-receipt"
      :class="{ 'is-failed': archiveLoadReceipt.tone === 'failed' }"
      data-meeting-archive-receipt="true"
      :data-meeting-archive-receipt-state="archiveLoadReceipt.tone"
      aria-label="会议归档读取回执"
    >
      <div class="meeting-archive-receipt-head">
        <div>
          <div class="receipt-label">会议归档读取回执</div>
          <strong>{{ archiveLoadReceipt.title }}</strong>
        </div>
        <span>{{ archiveLoadReceipt.receivedAt }}</span>
      </div>
      <div class="meeting-archive-receipt-grid">
        <div>
          <span>来源</span>
          <strong>{{ archiveLoadReceipt.source }}</strong>
        </div>
        <div>
          <span>范围</span>
          <strong>{{ archiveLoadReceipt.scope }}</strong>
        </div>
        <div>
          <span>已读</span>
          <strong>{{ archiveLoadReceipt.loaded }}</strong>
        </div>
        <div>
          <span>边界</span>
          <strong>{{ archiveLoadReceipt.boundary }}</strong>
        </div>
      </div>
      <p>{{ archiveLoadReceipt.nextStep }}</p>
    </section>

    <section
      v-if="archiveCompletionReceipt"
      class="meeting-completion-receipt"
      data-meeting-completion-receipt="true"
      aria-label="会议归档完整度回执"
    >
      <div class="receipt-label">归档完整度回执</div>
      <div class="meeting-completion-head">
        <div>
          <strong>{{ archiveCompletionReceipt.title }}</strong>
          <p>{{ archiveCompletionReceipt.scope }}</p>
        </div>
        <span>{{ archiveCompletionReceipt.basis }}</span>
      </div>
      <div class="meeting-completion-grid">
        <div>
          <span>完整可交付</span>
          <strong>{{ archiveCompletionReceipt.ready }}</strong>
        </div>
        <div>
          <span>需复核</span>
          <strong>{{ archiveCompletionReceipt.attention }}</strong>
        </div>
        <div>
          <span>生成中</span>
          <strong>{{ archiveCompletionReceipt.processing }}</strong>
        </div>
        <div>
          <span>仅基础归档</span>
          <strong>{{ archiveCompletionReceipt.archived }}</strong>
        </div>
      </div>
      <p>{{ archiveCompletionReceipt.nextStep }}</p>
      <small>{{ archiveCompletionReceipt.boundary }}</small>
    </section>

    <div v-if="loading" class="loading-container">
      <div class="loading-spinner"></div>
      <span>正在加载会议记录…</span>
    </div>

    <section v-else-if="error" class="meeting-feedback-card is-error">
      <div class="feedback-title">加载会议记录失败</div>
      <p>{{ error }}</p>
      <button class="meeting-refresh-btn" @click="loadMeetings('refresh')">
        重试
      </button>
    </section>

    <section
      v-else-if="sortedMeetings.length === 0"
      class="meeting-feedback-card"
    >
      <div class="feedback-title">
        {{ hasActiveFilters ? '没有匹配的会议记录' : '还没有会议记录' }}
      </div>
      <p>
        {{
          hasActiveFilters
            ? `当前筛选：${activeFilterSummary}。可以清除筛选后回到完整会议归档。`
            : 'Meeting Pilot 会在会议结束后把结构化结果归档到这里。下次完成一场会议后，你就能从这个入口直接回看 Panorama 和 PDF 纪要。'
        }}
      </p>
      <div
        v-if="emptyArchiveReceipt"
        class="meeting-empty-receipt"
        data-meeting-empty-receipt="true"
        aria-label="会议归档空结果回执"
      >
        <div class="section-label">空结果回执</div>
        <div class="meeting-empty-receipt-body">
          <strong>{{ emptyArchiveReceipt.title }}</strong>
          <span>{{ emptyArchiveReceipt.scope }}</span>
          <span>{{ emptyArchiveReceipt.coverage }}</span>
          <small>{{ emptyArchiveReceipt.boundary }}</small>
          <small>{{ emptyArchiveReceipt.recovery }}</small>
        </div>
      </div>
      <button
        v-if="emptyArchiveReceipt"
        class="meeting-secondary-action meeting-empty-action"
        type="button"
        :disabled="loading"
        @click="clearArchiveFilters"
      >
        回到完整归档
      </button>
    </section>

    <template v-else>
      <section class="meeting-list-toolbar">
        <div>
          已显示 {{ meetings.length }} / {{ meetingTotal || meetings.length }}
          条会议
          <span v-if="hasActiveFilters" class="meeting-filter-summary">
            筛选：{{ activeFilterSummary }}
          </span>
        </div>
        <button
          class="meeting-secondary-action"
          :disabled="loadingMore || !hasMoreMeetings"
          @click="loadMoreMeetings"
        >
          {{
            loadingMore
              ? '加载中…'
              : hasMoreMeetings
              ? '加载更早会议'
              : '已加载全部会议'
          }}
        </button>
      </section>

      <section
        v-if="pageError"
        class="meeting-feedback-card is-error is-inline"
      >
        <div class="feedback-title">加载更多失败</div>
        <p>{{ pageError }}</p>
      </section>

      <section class="meeting-grid">
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
                v-if="remainingParticipantCount(meeting.participants) > 0"
                class="participant-chip muted"
              >
                还有 {{ remainingParticipantCount(meeting.participants) }} 人
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

          <div
            v-if="getAttentionRecoveryTitle(meeting)"
            class="meeting-card-section is-attention"
          >
            <div class="section-label">处理建议</div>
            <div class="meeting-attention-copy">
              <strong>{{ getAttentionRecoveryTitle(meeting) }}</strong>
              <span>{{ getAttentionRecoveryDetail(meeting) }}</span>
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

          <div class="meeting-card-section is-action-scope">
            <div class="section-label">打开范围</div>
            <div class="meeting-action-scope">
              <strong>{{ getOpenScopeTitle(meeting) }}</strong>
              <span>{{ getOpenScopeDetail(meeting) }}</span>
            </div>
          </div>

          <div class="meeting-card-footer">
            <button
              class="meeting-primary-action"
              :title="getPanoramaButtonBoundary(meeting)"
              :aria-label="getPanoramaButtonBoundary(meeting)"
              @click="openPanorama(meeting)"
            >
              打开 Panorama
            </button>
            <button
              class="meeting-secondary-action"
              :disabled="!getSafePdfUrl(meeting.pdfUrl)"
              :title="getPdfButtonBoundary(meeting)"
              :aria-label="getPdfButtonBoundary(meeting)"
              @click="openPdf(meeting.pdfUrl, meeting)"
            >
              打开 PDF
            </button>
          </div>

          <div
            v-if="openReceipts[meeting.meetingId]"
            class="meeting-card-section is-open-receipt"
            data-meeting-open-receipt="true"
            :data-meeting-id="meeting.meetingId"
            aria-label="会议记录打开回执"
          >
            <div class="section-label">打开回执</div>
            <div class="meeting-open-receipt">
              <strong>{{ openReceipts[meeting.meetingId].title }}</strong>
              <span>{{ openReceipts[meeting.meetingId].detail }}</span>
              <small>{{ openReceipts[meeting.meetingId].boundary }}</small>
            </div>
          </div>
        </article>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import {
  getMemoryServiceClient,
  type MeetingArchiveStatusFilter,
  type MeetingRecord,
  type MeetingRecordListResponse,
} from '../../services/MemoryServiceClient';
import { getExternalUrlSafety } from '../topic-link-safety';

/* eslint-disable no-undef */
declare const chrome: any;
/* eslint-enable no-undef */

interface MeetingResponseEnvelope {
  success?: boolean;
  error?: string;
  total?: number;
  data?: MeetingRecordListResponse;
}

type ArchiveLoadTrigger =
  | 'initial'
  | 'refresh'
  | 'filter'
  | 'clear'
  | 'load-more';

interface MeetingArchiveLoadReceipt {
  tone: 'ok' | 'failed';
  title: string;
  source: string;
  scope: string;
  loaded: string;
  boundary: string;
  nextStep: string;
  receivedAt: string;
}

interface MeetingArchiveOpenReceipt {
  title: string;
  detail: string;
  boundary: string;
}

interface MeetingArchiveEmptyReceipt {
  title: string;
  scope: string;
  coverage: string;
  boundary: string;
  recovery: string;
}

interface MeetingArchiveCompletionReceipt {
  title: string;
  scope: string;
  basis: string;
  ready: string;
  attention: string;
  processing: string;
  archived: string;
  nextStep: string;
  boundary: string;
}

const MEETING_PAGE_SIZE = 50;

const meetings = ref<MeetingRecord[]>([]);
const meetingTotal = ref(0);
const loading = ref(false);
const loadingMore = ref(false);
const error = ref('');
const pageError = ref('');
const searchInput = ref('');
const appliedSearch = ref('');
const statusFilter = ref<MeetingArchiveStatusFilter>('all');
const archiveLoadReceipt = ref<MeetingArchiveLoadReceipt | null>(null);
const openReceipts = ref<Record<string, MeetingArchiveOpenReceipt>>({});

const statusFilterOptions: Array<{
  value: MeetingArchiveStatusFilter;
  label: string;
}> = [
  { value: 'all', label: '全部状态' },
  { value: 'ready', label: '可打开' },
  { value: 'attention', label: '需处理' },
  { value: 'processing', label: '生成中' },
  { value: 'archived', label: '仅归档' },
];

const sortedMeetings = computed(() =>
  [...meetings.value].sort(
    (left, right) =>
      (normalizeTimestamp(right.lastEventAt || right.date) || 0) -
      (normalizeTimestamp(left.lastEventAt || left.date) || 0),
  ),
);

const hasMoreMeetings = computed(
  () => meetingTotal.value > meetings.value.length,
);

const hasActiveFilters = computed(
  () => Boolean(appliedSearch.value.trim()) || statusFilter.value !== 'all',
);

const activeFilterSummary = computed(() => {
  const parts: string[] = [];
  const query = appliedSearch.value.trim();
  if (query) parts.push(`关键词“${query}”`);
  const statusLabel = statusFilterOptions.find(
    (option) => option.value === statusFilter.value,
  )?.label;
  if (statusFilter.value !== 'all' && statusLabel) {
    parts.push(`状态 ${statusLabel}`);
  }
  return parts.join('，') || '全部会议';
});

const emptyArchiveReceipt = computed<MeetingArchiveEmptyReceipt | null>(() => {
  if (
    !hasActiveFilters.value ||
    loading.value ||
    sortedMeetings.value.length > 0
  ) {
    return null;
  }
  const query = appliedSearch.value.trim();
  const statusLabel =
    statusFilterOptions.find((option) => option.value === statusFilter.value)
      ?.label || '全部状态';
  const queryScope = query ? `关键词“${query}”` : '未输入关键词';
  const statusScope =
    statusFilter.value === 'all'
      ? '未限制状态'
      : `状态筛选为“${statusLabel}”`;

  return {
    title: '筛选已成功读取，但没有匹配会议',
    scope: `${queryScope}；${statusScope}；服务端按同一条件返回 0 条。`,
    coverage: query
      ? '关键词会同时查标题、摘要、参会者、会议 ID、错误码，以及归档转写/观察文本。'
      : '当前只按状态读取会议归档；没有隐藏本页之外的匹配结果。',
    boundary:
      '这不是读取失败，也不表示会议历史被删除；没有重新分析会议、生成 PDF、写入 Memory Service、发送纪要或修改行动项。',
    recovery:
      '可以清除筛选回到完整归档，放宽关键词，或切换到“需处理 / 生成中 / 仅归档”查看不同状态。',
  };
});

const archiveCompletionReceipt =
  computed<MeetingArchiveCompletionReceipt | null>(() => {
    if (loading.value || sortedMeetings.value.length === 0) return null;

    const counts = sortedMeetings.value.reduce(
      (summary, meeting) => {
        const bucket = getMeetingCompletionBucket(meeting);
        summary[bucket] += 1;
        return summary;
      },
      {
        ready: 0,
        attention: 0,
        processing: 0,
        archived: 0,
      },
    );
    const total = sortedMeetings.value.length;
    const needingReview =
      counts.attention + counts.processing + counts.archived;
    const scope = hasActiveFilters.value
      ? `当前筛选：${activeFilterSummary.value}；只统计本页已加载的 ${total} 条会议。`
      : `当前页已加载 ${total} / ${
          meetingTotal.value || total
        } 条会议；加载更早会议后会重新计算。`;

    return {
      title:
        needingReview > 0
          ? `有 ${needingReview} 条会议还不能当成完整纪要交付`
          : '当前已加载会议都有可复核的完整交付物',
      scope,
      basis:
        hasMoreMeetings.value && !hasActiveFilters.value
          ? '当前页快照'
          : '当前显示范围',
      ready: `${counts.ready} 条`,
      attention: `${counts.attention} 条`,
      processing: `${counts.processing} 条`,
      archived: `${counts.archived} 条`,
      nextStep:
        needingReview > 0
          ? '先用“需处理 / 生成中 / 仅归档”筛选定位会议，打开 Panorama 复核结构化内容，再排查 Digest/PDF 链路。'
          : '可以直接打开 Panorama 或安全 PDF 做会后复核；需要更早记录时继续加载下一页。',
      boundary:
        '这是当前已显示会议的只读完整度快照；不会重新分析会议、催跑 Minutes API、生成 PDF、发送纪要、写入 Memory Service 或修改行动项。',
    };
  });

onMounted(() => {
  void loadMeetings('initial');
});

async function loadMeetings(trigger: ArchiveLoadTrigger = 'refresh') {
  loading.value = true;
  pageError.value = '';
  error.value = '';

  try {
    const response = await requestMeetingsPage(0);
    meetings.value = response.items;
    meetingTotal.value = Number(response.total || response.items.length);
    archiveLoadReceipt.value = buildArchiveLoadReceipt(
      trigger,
      response.source,
    );
  } catch (directError) {
    const message =
      directError instanceof Error
        ? directError.message
        : '暂时无法连接会议记录服务';
    error.value = message;
    meetings.value = [];
    meetingTotal.value = 0;
    archiveLoadReceipt.value = buildArchiveLoadFailureReceipt(
      trigger,
      message,
      false,
    );
  } finally {
    loading.value = false;
  }
}

function applyArchiveFilters() {
  appliedSearch.value = searchInput.value.trim();
  void loadMeetings('filter');
}

function clearArchiveFilters() {
  searchInput.value = '';
  appliedSearch.value = '';
  statusFilter.value = 'all';
  void loadMeetings('clear');
}

async function loadMoreMeetings() {
  if (loadingMore.value || !hasMoreMeetings.value) return;
  loadingMore.value = true;
  pageError.value = '';

  try {
    const response = await requestMeetingsPage(meetings.value.length);
    meetings.value = mergeMeetingPages(meetings.value, response.items);
    meetingTotal.value = Number(response.total || meetings.value.length);
    archiveLoadReceipt.value = buildArchiveLoadReceipt(
      'load-more',
      response.source,
    );
  } catch (loadError) {
    const message =
      loadError instanceof Error
        ? loadError.message
        : '暂时无法加载更早的会议记录';
    pageError.value = message;
    archiveLoadReceipt.value = buildArchiveLoadFailureReceipt(
      'load-more',
      message,
      true,
    );
  } finally {
    loadingMore.value = false;
  }
}

async function requestMeetingsPage(offset: number) {
  try {
    const response = (await chrome.runtime.sendMessage({
      type: 'GET_MEETINGS',
      limit: MEETING_PAGE_SIZE,
      offset,
      q: appliedSearch.value.trim(),
      status: statusFilter.value,
    })) as MeetingResponseEnvelope;

    if (!response?.success) {
      throw new Error(response?.error || '会议记录接口返回异常');
    }

    const items = response?.data?.items || [];
    const total = Number(
      response?.data?.total || response?.total || items.length,
    );
    return { items, total, source: 'extension background' };
  } catch (runtimeError) {
    console.warn(
      '通过 background 加载会议记录失败，尝试直接请求:',
      runtimeError,
    );
  }

  try {
    const client = getMemoryServiceClient();
    const response = await client.getMeetings(MEETING_PAGE_SIZE, offset, {
      query: appliedSearch.value.trim(),
      status: statusFilter.value,
    });
    return {
      items: response.items || [],
      total: Number(response.total || response.items?.length || 0),
      source: 'memory-service direct',
    };
  } catch (directError) {
    throw directError instanceof Error
      ? directError
      : new Error('暂时无法连接会议记录服务');
  }
}

function buildArchiveLoadReceipt(
  trigger: ArchiveLoadTrigger,
  source: string,
): MeetingArchiveLoadReceipt {
  const titleByTrigger: Record<ArchiveLoadTrigger, string> = {
    initial: '已读取最新会议归档',
    refresh: '已刷新会议归档列表',
    filter: '已按筛选读取会议归档',
    clear: '已回到完整会议归档',
    'load-more': '已追加更早会议',
  };
  const total = meetingTotal.value || meetings.value.length;
  const loaded = `已显示 ${meetings.value.length} / ${total} 条`;

  return {
    tone: 'ok',
    title: titleByTrigger[trigger],
    source:
      source === 'memory-service direct'
        ? 'memory-service 直接读取'
        : 'extension background 读取',
    scope: getArchiveScopeText(),
    loaded,
    boundary:
      '只读取会议归档列表和状态；没有重新分析会议、生成 PDF、写入 Memory Service、发送纪要或修改行动项。',
    nextStep: hasMoreMeetings.value
      ? '需要更早记录时继续加载更早会议；要复核结构化内容或排查 PDF/Digest 时打开 Panorama。'
      : '当前筛选范围已加载完；要复核结构化内容或排查 PDF/Digest 时打开 Panorama。',
    receivedAt: formatReceiptTime(Date.now()),
  };
}

function buildArchiveLoadFailureReceipt(
  trigger: ArchiveLoadTrigger,
  errorMessage: string,
  keepCurrentSnapshot: boolean,
): MeetingArchiveLoadReceipt {
  const titleByTrigger: Record<ArchiveLoadTrigger, string> = {
    initial: '会议归档读取失败',
    refresh: '刷新会议归档失败',
    filter: '筛选会议归档失败',
    clear: '清除筛选读取失败',
    'load-more': '加载更早会议失败',
  };
  const total = meetingTotal.value || meetings.value.length;
  const loaded = keepCurrentSnapshot
    ? `本次未更新；仍显示 ${meetings.value.length} / ${total} 条`
    : '本次未显示会议';
  const safeMessage = errorMessage.trim().slice(0, 140);

  return {
    tone: 'failed',
    title: titleByTrigger[trigger],
    source: '本次读取未确认',
    scope: getArchiveScopeText(),
    loaded,
    boundary:
      '失败只影响本次读取；没有重新分析会议、生成 PDF、写入 Memory Service、发送纪要或修改行动项。',
    nextStep: keepCurrentSnapshot
      ? `当前列表仍是上次成功读取的只读快照；可以重试加载更早会议或刷新列表。失败原因：${safeMessage}`
      : `当前没有可确认的新会议列表；可以重试、清除筛选或稍后再打开会议归档。失败原因：${safeMessage}`,
    receivedAt: formatReceiptTime(Date.now()),
  };
}

function getArchiveScopeText() {
  const filters = getArchiveFilterParts();
  return filters.length
    ? `${filters.join('，')}；服务端筛选后分页`
    : '全部会议；按最近会议时间分页';
}

function getArchiveFilterParts() {
  const query = appliedSearch.value.trim();
  const statusLabel = statusFilterOptions.find(
    (option) => option.value === statusFilter.value,
  )?.label;
  const filters: string[] = [];
  if (query) filters.push(`关键词“${query}”`);
  if (statusFilter.value !== 'all' && statusLabel) {
    filters.push(`状态 ${statusLabel}`);
  }
  return filters;
}

function mergeMeetingPages(
  current: MeetingRecord[],
  incoming: MeetingRecord[],
) {
  const merged = new Map<string, MeetingRecord>();
  current.forEach((meeting) => merged.set(meeting.meetingId, meeting));
  incoming.forEach((meeting) => merged.set(meeting.meetingId, meeting));
  return [...merged.values()];
}

function getDigestState(meeting: MeetingRecord) {
  if (meeting.digestStatus) return meeting.digestStatus;
  if (meeting.pdfUrl) return 'completed';
  if (meeting.digestId) return 'processing';
  return 'idle';
}

function getDigestStatus(meeting: MeetingRecord) {
  const digestState = getDigestState(meeting);
  if (digestState === 'failed') {
    return { label: 'Digest 失败', kind: 'is-error' };
  }
  if (digestState === 'completed' || getSafePdfUrl(meeting.pdfUrl)) {
    return { label: 'Digest 完成', kind: 'is-ready' };
  }
  if (digestState === 'uploading') {
    return { label: 'Digest 上传中', kind: 'is-progress' };
  }
  if (digestState === 'processing' || meeting.digestId) {
    return { label: 'Digest 生成中', kind: 'is-progress' };
  }
  return { label: '已落库', kind: 'is-archived' };
}

function getPdfStatus(meeting: MeetingRecord) {
  const pdfSafety = getExternalUrlSafety(meeting.pdfUrl);
  const digestState = getDigestState(meeting);
  if (pdfSafety.safeUrl) return { label: 'PDF 已就绪', kind: 'is-ready' };
  if (pdfSafety.blocked) return { label: 'PDF 链接不可用', kind: 'is-error' };
  if (digestState === 'failed') {
    return { label: 'PDF 生成失败', kind: 'is-error' };
  }
  if (digestState === 'completed') {
    return { label: 'PDF 缺失', kind: 'is-error' };
  }
  if (digestState === 'uploading' || digestState === 'processing') {
    return { label: '等待 PDF', kind: 'is-progress' };
  }
  return { label: '暂未生成 PDF', kind: 'is-muted' };
}

function getDigestSummary(meeting: MeetingRecord) {
  const digestState = getDigestState(meeting);
  if (digestState === 'failed') {
    const errorCode = meeting.digestErrorCode
      ? `错误码：${meeting.digestErrorCode}`
      : '后台没有返回错误码';
    return `结构化会议记录仍可回看，但 Digest/PDF 生成失败，${errorCode}。`;
  }
  if (getSafePdfUrl(meeting.pdfUrl)) {
    return '会后 Digest 与 PDF 纪要都已完成，可以直接进入 Panorama 或打开正式 PDF。';
  }
  if (digestState === 'completed') {
    return 'Digest 标记为完成，但当前会议没有可打开的安全 PDF 链接。';
  }
  if (
    digestState === 'uploading' ||
    digestState === 'processing' ||
    meeting.digestId
  ) {
    return '结构化会议记录已经归档，Digest 正在继续生成 PDF 纪要。';
  }
  return '会议基础记录已归档，当前还没有关联的 Digest/PDF 产物。';
}

function getPdfSummary(meeting: MeetingRecord) {
  const pdfSafety = getExternalUrlSafety(meeting.pdfUrl);
  const digestState = getDigestState(meeting);
  if (pdfSafety.safeUrl) {
    return 'PDF 可直接预览或下载。';
  }
  if (pdfSafety.blocked) {
    return 'PDF 链接不符合安全打开规则，历史页已禁用打开动作。';
  }
  if (digestState === 'failed') {
    return '打开 Panorama 可继续查看摘要、行动项和决议；PDF 需要重新生成或排查 Minutes API。';
  }
  if (digestState === 'completed') {
    return 'Digest 完成状态已归档，但 PDF URL 缺失或不可用。';
  }
  if (
    digestState === 'uploading' ||
    digestState === 'processing' ||
    meeting.digestId
  ) {
    return '可先打开 Panorama 回顾会议结构，稍后再回来查看 PDF。';
  }
  return '该会议当前只保留了历史记录入口。';
}

function getAttentionRecoveryTitle(meeting: MeetingRecord) {
  const pdfSafety = getExternalUrlSafety(meeting.pdfUrl);
  const digestState = getDigestState(meeting);
  if (pdfSafety.blocked) return 'PDF 链接被拦截';
  if (digestState === 'failed') return 'Digest / PDF 生成失败';
  if (digestState === 'completed' && !pdfSafety.safeUrl) {
    return 'Digest 完成但缺少 PDF';
  }
  return '';
}

function getAttentionRecoveryDetail(meeting: MeetingRecord) {
  const pdfSafety = getExternalUrlSafety(meeting.pdfUrl);
  const digestState = getDigestState(meeting);
  if (pdfSafety.blocked) {
    return '不要打开该 PDF 链接；先用 Panorama 回看结构化归档，再检查 Minutes API 返回的 pdfUrl 或重新生成 PDF。';
  }
  if (digestState === 'failed') {
    const errorCode = meeting.digestErrorCode
      ? `错误码 ${meeting.digestErrorCode}`
      : '后台没有返回错误码';
    return `${errorCode}。可先从 Panorama 继续复核摘要、行动项和决议，再排查 Minutes API 或重新生成 PDF。`;
  }
  if (digestState === 'completed' && !pdfSafety.safeUrl) {
    return '结构化归档可用，但正式 PDF 没有安全链接；优先检查 PDF 写回或重新触发纪要生成。';
  }
  return '';
}

function getMeetingCompletionBucket(
  meeting: MeetingRecord,
): 'ready' | 'attention' | 'processing' | 'archived' {
  const pdfSafety = getExternalUrlSafety(meeting.pdfUrl);
  const digestState = getDigestState(meeting);
  if (pdfSafety.blocked || digestState === 'failed') return 'attention';
  if (digestState === 'completed' && !pdfSafety.safeUrl) return 'attention';
  if (pdfSafety.safeUrl || digestState === 'completed') return 'ready';
  if (
    digestState === 'uploading' ||
    digestState === 'processing' ||
    meeting.digestId
  ) {
    return 'processing';
  }
  return 'archived';
}

function getOpenScopeTitle(meeting: MeetingRecord) {
  const digestState = getDigestState(meeting);
  const pdfSafety = getExternalUrlSafety(meeting.pdfUrl);
  if (pdfSafety.safeUrl) return 'Panorama 复核 + 安全 PDF 可打开';
  if (pdfSafety.blocked) return '优先 Panorama 复核，PDF 暂不打开';
  if (digestState === 'failed') return 'PDF 失败，先回 Panorama';
  if (digestState === 'completed') return 'Digest 已完成，PDF 待补';
  if (
    digestState === 'uploading' ||
    digestState === 'processing' ||
    meeting.digestId
  ) {
    return 'PDF 生成中，Panorama 先可用';
  }
  return '仅归档回看';
}

function getOpenScopeDetail(meeting: MeetingRecord) {
  const digestState = getDigestState(meeting);
  const pdfSafety = getExternalUrlSafety(meeting.pdfUrl);
  if (pdfSafety.safeUrl) {
    return '打开 Panorama 只进入只读归档复盘；打开 PDF 只打开安全 http(s) 链接，不重新分析会议、发送纪要、写入 Memory Service 或修改行动项。';
  }
  if (pdfSafety.blocked) {
    return 'PDF 链接未通过安全检查，按钮保持禁用；打开 Panorama 不带入不安全链接，也不会重新生成 PDF、发送纪要或写回归档。';
  }
  if (digestState === 'failed') {
    return 'PDF 生成失败，按钮保持禁用；打开 Panorama 可复核摘要、行动项和决议，但不会重试 Minutes API、发送纪要或修改行动项。';
  }
  if (digestState === 'completed') {
    return 'Digest 已完成但没有安全 PDF，按钮保持禁用；打开 Panorama 不会补发 PDF、写回 URL 或发送纪要。';
  }
  if (
    digestState === 'uploading' ||
    digestState === 'processing' ||
    meeting.digestId
  ) {
    return 'Digest/PDF 仍在生成，按钮保持禁用；打开 Panorama 只回看已归档结构，不会催跑、重试或写入 Memory Service。';
  }
  return '当前只有基础会议归档；打开 Panorama 只回看已有结构，不会生成 PDF、重新分析会议或外发纪要。';
}

function getPanoramaButtonBoundary(meeting: MeetingRecord) {
  const title = meeting.title || '未命名会议';
  const counts = `卡片快照：话题 ${meeting.topicCount || 0}、行动项 ${
    meeting.actionItemCount || 0
  }、决议 ${meeting.decisionCount || 0}`;
  return `打开 Panorama：只在新标签打开“${title}”的现有结构化归档复盘，并带入${counts}；不会重新分析会议、生成 PDF、发送纪要、写入 Memory Service、修改行动项或创建外部任务。`;
}

function getPdfButtonBoundary(meeting: MeetingRecord) {
  const title = meeting.title || '未命名会议';
  const pdfSafety = getExternalUrlSafety(meeting.pdfUrl);
  const digestState = getDigestState(meeting);
  if (pdfSafety.safeUrl) {
    return `打开 PDF：只把“${title}”已通过安全检查的 http(s) PDF 链接交给浏览器；不会分享、发送纪要、下载到归档、重跑 Minutes API、写回会议记录或修改行动项。`;
  }
  if (pdfSafety.blocked) {
    return `PDF 不可打开：“${title}”的 PDF 链接未通过安全检查，按钮保持禁用；不会打开不安全链接、带入 Panorama、重新生成 PDF、发送纪要或写回归档。`;
  }
  if (digestState === 'failed') {
    return `PDF 不可打开：“${title}”的 Digest/PDF 生成失败，按钮保持禁用；不会重试 Minutes API、生成 PDF、发送纪要、写回会议记录或修改行动项。`;
  }
  if (digestState === 'completed') {
    return `PDF 不可打开：“${title}”的 Digest 已完成但没有安全 PDF 链接，按钮保持禁用；不会补发 PDF、写回 URL、发送纪要或修改行动项。`;
  }
  if (
    digestState === 'uploading' ||
    digestState === 'processing' ||
    meeting.digestId
  ) {
    return `PDF 不可打开：“${title}”的 Digest/PDF 仍在生成，按钮保持禁用；不会催跑、重试、写入 Memory Service、发送纪要或修改行动项。`;
  }
  return `PDF 不可打开：“${title}”当前只有基础会议归档，按钮保持禁用；不会生成 PDF、重新分析会议、发送纪要、写回会议记录或修改行动项。`;
}

function displayParticipants(participants: string[] = []) {
  return participants.slice(0, 5);
}

function remainingParticipantCount(participants: string[] = []) {
  return Math.max(
    0,
    participants.length - displayParticipants(participants).length,
  );
}

function getSafePdfUrl(pdfUrl?: string) {
  return getExternalUrlSafety(pdfUrl).safeUrl;
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

function formatReceiptTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
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

  setOptionalSnapshotParam(params, 'summary', meeting.summary);
  setOptionalCountParam(params, 'topicCount', meeting.topicCount);
  setOptionalCountParam(params, 'actionItemCount', meeting.actionItemCount);
  setOptionalCountParam(params, 'decisionCount', meeting.decisionCount);

  const safePdfUrl = getSafePdfUrl(meeting.pdfUrl);
  if (safePdfUrl) params.set('pdfUrl', safePdfUrl);
  if (meeting.digestId) params.set('digestId', meeting.digestId);
  if (meeting.digestStatus) params.set('digestStatus', meeting.digestStatus);
  if (meeting.digestErrorCode) {
    params.set('digestErrorCode', meeting.digestErrorCode);
  }

  const url =
    typeof chrome !== 'undefined' && chrome?.runtime?.getURL
      ? chrome.runtime.getURL(`meeting-panorama.html?${params.toString()}`)
      : `meeting-panorama.html?${params.toString()}`;
  window.open(url, '_blank', 'noopener');
  setOpenReceipt(meeting.meetingId, {
    title: '已打开 Panorama',
    detail: `${meeting.title || '未命名会议'} · ${formatReceiptTime(
      Date.now(),
    )} · 只读进入结构化归档复盘。`,
    boundary:
      '本次点击只打开现有归档页面；没有重新分析会议、生成 PDF、发送纪要、写入 Memory Service 或修改行动项。',
  });
}

function setOptionalSnapshotParam(
  params: URLSearchParams,
  key: string,
  value?: string,
) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return;
  params.set(key, trimmed.slice(0, 500));
}

function setOptionalCountParam(
  params: URLSearchParams,
  key: string,
  value?: number,
) {
  if (value === undefined || value === null) return;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return;
  params.set(key, String(Math.floor(parsed)));
}

function openPdf(pdfUrl: string | undefined, meeting?: MeetingRecord) {
  const safePdfUrl = getSafePdfUrl(pdfUrl);
  if (!safePdfUrl) return;
  window.open(safePdfUrl, '_blank', 'noopener,noreferrer');
  if (meeting) {
    setOpenReceipt(meeting.meetingId, {
      title: '已打开安全 PDF',
      detail: `${meeting.title || '未命名会议'} · ${formatReceiptTime(
        Date.now(),
      )} · 外部 http(s) PDF 链接已交给浏览器打开。`,
      boundary:
        '本次点击只打开已通过安全检查的 PDF；没有分享、发送、下载到归档、重跑 Minutes API 或写回会议记录。',
    });
  }
}

function setOpenReceipt(
  meetingId: string,
  receipt: MeetingArchiveOpenReceipt,
) {
  openReceipts.value = {
    ...openReceipts.value,
    [meetingId]: receipt,
  };
}
</script>

<style scoped>
.meeting-history-page {
  animation: fadeInUp 0.6s ease-out;
}

.meeting-hero,
.meeting-card,
.meeting-feedback-card {
  background: radial-gradient(
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

.meeting-hero-stat small {
  display: block;
  margin-top: 0.35rem;
  color: #aeb9ca;
  font-size: 0.75rem;
}

.meeting-refresh-btn,
.meeting-primary-action,
.meeting-secondary-action,
.meeting-ghost-action {
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

.meeting-ghost-action {
  background: transparent;
  color: #cbd5e1;
  border: 1px solid rgba(148, 163, 184, 0.16);
}

.meeting-secondary-action:hover:not(:disabled) {
  background: rgba(148, 163, 184, 0.16);
}

.meeting-refresh-btn:disabled,
.meeting-secondary-action:disabled,
.meeting-ghost-action:disabled {
  opacity: 0.55;
  cursor: not-allowed;
  box-shadow: none;
  transform: none;
}

.meeting-filter-bar {
  display: grid;
  grid-template-columns: minmax(16rem, 1fr) auto auto;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
  padding: 0.9rem;
  border-radius: 0.85rem;
  background: rgba(15, 23, 42, 0.56);
  border: 1px solid rgba(148, 163, 184, 0.1);
}

.meeting-search-form {
  display: flex;
  gap: 0.6rem;
  min-width: 0;
}

.meeting-search-input,
.meeting-status-filter select {
  width: 100%;
  min-height: 2.75rem;
  border-radius: 0.75rem;
  border: 1px solid rgba(148, 163, 184, 0.16);
  background: rgba(2, 6, 23, 0.42);
  color: #e2e8f0;
  font-size: 0.92rem;
}

.meeting-search-input {
  min-width: 0;
  padding: 0 0.9rem;
}

.meeting-search-input::placeholder {
  color: #64748b;
}

.meeting-status-filter {
  display: grid;
  grid-template-columns: auto minmax(8.5rem, 1fr);
  align-items: center;
  gap: 0.55rem;
  color: #cbd5e1;
  font-size: 0.86rem;
}

.meeting-status-filter select {
  padding: 0 0.75rem;
}

.meeting-feedback-card {
  padding: 1.5rem;
}

.meeting-feedback-card.is-inline {
  margin-bottom: 1rem;
}

.meeting-feedback-card.is-error {
  border-color: rgba(255, 107, 107, 0.28);
}

.meeting-empty-receipt {
  margin-top: 1rem;
  padding-left: 0.9rem;
  border-left: 3px solid rgba(34, 211, 238, 0.5);
}

.meeting-empty-receipt-body {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.meeting-empty-receipt-body strong {
  color: #cffafe;
  font-size: 0.94rem;
  line-height: 1.45;
}

.meeting-empty-receipt-body span,
.meeting-empty-receipt-body small {
  color: #bae6fd;
  font-size: 0.84rem;
  line-height: 1.55;
}

.meeting-empty-receipt-body small {
  color: #a5f3fc;
}

.meeting-empty-action {
  margin-top: 1rem;
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

.meeting-list-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
  color: #cbd5e1;
  font-size: 0.9rem;
}

.meeting-filter-summary {
  display: inline-block;
  margin-left: 0.5rem;
  color: #94a3b8;
}

.meeting-archive-receipt {
  margin-bottom: 1rem;
  padding: 1rem;
  border-radius: 0.85rem;
  background: rgba(14, 116, 144, 0.18);
  border: 1px solid rgba(34, 211, 238, 0.22);
  color: #dbeafe;
}

.meeting-archive-receipt.is-failed {
  background: rgba(127, 29, 29, 0.2);
  border-color: rgba(248, 113, 113, 0.28);
  color: #fee2e2;
}

.meeting-archive-receipt.is-failed .receipt-label,
.meeting-archive-receipt.is-failed .meeting-archive-receipt-head > span,
.meeting-archive-receipt.is-failed .meeting-archive-receipt-grid span,
.meeting-archive-receipt.is-failed p {
  color: #fecaca;
}

.meeting-archive-receipt.is-failed .meeting-archive-receipt-grid div {
  background: rgba(69, 10, 10, 0.34);
  border-color: rgba(248, 113, 113, 0.16);
}

.meeting-archive-receipt.is-failed .meeting-archive-receipt-grid strong {
  color: #fff7ed;
}

.meeting-archive-receipt-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 0.85rem;
}

.meeting-archive-receipt-head strong {
  display: block;
  margin-top: 0.25rem;
  font-size: 0.98rem;
  line-height: 1.45;
}

.meeting-archive-receipt-head > span {
  flex: 0 0 auto;
  color: #a5f3fc;
  font-size: 0.78rem;
}

.receipt-label {
  color: #67e8f9;
  font-size: 0.72rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.meeting-archive-receipt-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.65rem;
}

.meeting-archive-receipt-grid div {
  min-width: 0;
  padding: 0.7rem;
  border-radius: 0.7rem;
  background: rgba(8, 47, 73, 0.36);
  border: 1px solid rgba(125, 211, 252, 0.12);
}

.meeting-archive-receipt-grid span {
  display: block;
  margin-bottom: 0.35rem;
  color: #7dd3fc;
  font-size: 0.7rem;
}

.meeting-archive-receipt-grid strong {
  display: block;
  color: #ecfeff;
  font-size: 0.8rem;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.meeting-archive-receipt p {
  margin: 0.8rem 0 0;
  color: #bae6fd;
  font-size: 0.84rem;
  line-height: 1.55;
}

.meeting-completion-receipt {
  margin-bottom: 1rem;
  padding: 1rem;
  border-radius: 0.85rem;
  background: rgba(88, 28, 135, 0.18);
  border: 1px solid rgba(216, 180, 254, 0.2);
  color: #f3e8ff;
}

.meeting-completion-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  margin-top: 0.35rem;
}

.meeting-completion-head strong {
  display: block;
  font-size: 0.98rem;
  line-height: 1.45;
}

.meeting-completion-head p {
  margin: 0.35rem 0 0;
  color: #e9d5ff;
  font-size: 0.84rem;
  line-height: 1.55;
}

.meeting-completion-head > span {
  flex: 0 0 auto;
  padding: 0.35rem 0.65rem;
  border-radius: 999px;
  background: rgba(168, 85, 247, 0.14);
  border: 1px solid rgba(216, 180, 254, 0.2);
  color: #f5d0fe;
  font-size: 0.76rem;
  white-space: nowrap;
}

.meeting-completion-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.65rem;
  margin-top: 0.85rem;
}

.meeting-completion-grid div {
  min-width: 0;
  padding: 0.7rem;
  border-radius: 0.7rem;
  background: rgba(59, 7, 100, 0.34);
  border: 1px solid rgba(216, 180, 254, 0.12);
}

.meeting-completion-grid span {
  display: block;
  margin-bottom: 0.35rem;
  color: #d8b4fe;
  font-size: 0.7rem;
}

.meeting-completion-grid strong {
  display: block;
  color: #faf5ff;
  font-size: 0.86rem;
  line-height: 1.5;
}

.meeting-completion-receipt > p,
.meeting-completion-receipt > small {
  display: block;
  margin: 0.8rem 0 0;
  color: #e9d5ff;
  font-size: 0.84rem;
  line-height: 1.55;
}

.meeting-completion-receipt > small {
  color: #f0abfc;
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

.status-pill.is-error {
  background: rgba(255, 107, 107, 0.1);
  color: #ff8787;
  border-color: rgba(255, 107, 107, 0.28);
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

.meeting-card-section.is-attention {
  background: rgba(127, 29, 29, 0.22);
  border-color: rgba(248, 113, 113, 0.28);
}

.meeting-card-section.is-action-scope {
  background: rgba(14, 116, 144, 0.14);
  border-color: rgba(34, 211, 238, 0.18);
}

.meeting-card-section.is-open-receipt {
  background: rgba(22, 101, 52, 0.16);
  border-color: rgba(74, 222, 128, 0.2);
}

.meeting-action-scope {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.meeting-action-scope strong {
  color: #cffafe;
  font-size: 0.92rem;
  line-height: 1.45;
}

.meeting-action-scope span {
  color: #bae6fd;
  font-size: 0.84rem;
  line-height: 1.5;
}

.meeting-attention-copy {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.meeting-attention-copy strong {
  color: #fecaca;
  font-size: 0.92rem;
  line-height: 1.45;
}

.meeting-attention-copy span {
  color: #fca5a5;
  font-size: 0.84rem;
  line-height: 1.5;
}

.meeting-open-receipt {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.meeting-open-receipt strong {
  color: #bbf7d0;
  font-size: 0.92rem;
  line-height: 1.45;
}

.meeting-open-receipt span,
.meeting-open-receipt small {
  color: #dcfce7;
  font-size: 0.84rem;
  line-height: 1.5;
}

.meeting-open-receipt small {
  color: #a7f3d0;
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

  .meeting-filter-bar {
    grid-template-columns: 1fr;
  }

  .meeting-archive-receipt-grid,
  .meeting-completion-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .meeting-card-head,
  .meeting-card-footer {
    grid-template-columns: 1fr;
    display: grid;
  }

  .meeting-search-form,
  .meeting-status-filter {
    grid-template-columns: 1fr;
    display: grid;
  }

  .meeting-card-badges {
    align-items: flex-start;
  }

  .meeting-archive-receipt-head,
  .meeting-archive-receipt-grid,
  .meeting-completion-head,
  .meeting-completion-grid {
    grid-template-columns: 1fr;
    display: grid;
  }

  .meeting-completion-head > span {
    justify-self: start;
  }
}
</style>
