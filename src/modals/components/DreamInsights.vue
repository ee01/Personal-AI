<template>
  <div class="dream-insights-container">
    <div class="header-row">
      <div>
        <h2 class="section-title">梦境重放</h2>
        <p class="section-subtitle">
          长期记忆回放生成的联想入口；新关系和风险先按线索复核。
        </p>
      </div>
      <router-link to="/reflection-threads" class="review-link">
        去自我反思复核
      </router-link>
    </div>

    <div v-if="loading" class="loading-container">
      <div class="loading-spinner"></div>
      <p>正在加载梦境重放...</p>
    </div>

    <template v-else>
      <div v-if="loadError" class="load-error">
        <div>
          <div class="load-error-title">梦境重放暂时不可用</div>
          <p>{{ loadError }}</p>
        </div>
        <button class="load-error-retry" @click="loadDreams()">重试</button>
      </div>

      <div v-if="!loadError" class="dream-scope-receipt" aria-label="梦境重放本页范围">
        <div class="scope-receipt-main">
          <span class="scope-receipt-label">本页范围</span>
          <strong>{{ dreamScopeReceiptTitle }}</strong>
        </div>
        <div class="scope-receipt-grid">
          <span>{{ dreamScopeEvidenceLine }}</span>
          <span>{{ dreamScopeDeepLinkLine }}</span>
          <span>读取窗口：最近 10 个 dreams/*.md；通知深链文件会额外尝试读取。</span>
          <span>生成节奏：Dream Replay 每周离线生成；梦境报表只代表当前 digest 周期。</span>
        </div>
        <div class="scope-receipt-boundary">
          边界：这里只读展示低置信线索，不会写用户画像、创建 Rehearsal、确认关系、发送通知或执行外部动作。
        </div>
      </div>

      <div v-if="dreams.length > 0" class="dream-overview">
        <div class="overview-metric">
          <span class="metric-label">梦境主题</span>
          <strong>{{ dreams.length }}</strong>
        </div>
        <div class="overview-metric">
          <span class="metric-label">洞察线索</span>
          <strong>{{ totalInsights }}</strong>
        </div>
        <div class="overview-metric risk">
          <span class="metric-label">待复核风险</span>
          <strong>{{ totalRisks }}</strong>
        </div>
        <div class="overview-metric relation">
          <span class="metric-label">新关系</span>
          <strong>{{ totalRelationships }}</strong>
        </div>
        <div class="overview-metric priority">
          <span class="metric-label">优先复核</span>
          <strong>{{ priorityReviewDreamCount }}</strong>
        </div>
        <div class="overview-metric ready">
          <span class="metric-label">可带证据复核</span>
          <strong>{{ reviewReadyDreamCount }}</strong>
        </div>
        <div class="overview-metric warning">
          <span class="metric-label">缺证据</span>
          <strong>{{ ungroundedDreamCount }}</strong>
        </div>
      </div>

      <div
        v-if="dreams.length > 0"
        class="dream-review-filter"
        aria-label="梦境复核视图筛选"
      >
        <div class="filter-head">
          <div>
            <span class="filter-label">复核视图</span>
            <strong>{{ dreamReviewFilterReceipt.title }}</strong>
          </div>
          <span>{{ dreamReviewFilterReceipt.summary }}</span>
        </div>
        <div class="filter-options" role="group" aria-label="选择梦境复核视图">
          <button
            v-for="option in dreamReviewFilterOptions"
            :key="option.value"
            class="filter-option"
            :class="{ active: activeDreamReviewFilter === option.value }"
            :aria-pressed="activeDreamReviewFilter === option.value"
            :title="dreamReviewFilterButtonBoundary(option)"
            :aria-label="dreamReviewFilterButtonBoundary(option)"
            @click="setDreamReviewFilter(option.value)"
          >
            <span>{{ option.label }}</span>
            <strong>{{ option.count }}</strong>
          </button>
        </div>
        <div class="filter-boundary">{{ dreamReviewFilterReceipt.boundary }}</div>
      </div>

      <div v-if="requestedFileMissing" class="partial-warning targeted-warning">
        通知指向的梦境文件 {{ requestedFilename }} 暂时无法读取；已先展示最近可用内容。
      </div>

      <div v-if="invalidRequestedFileParam" class="partial-warning targeted-warning">
        深链已忽略：通知文件参数无效；只接受 dreams/文件名.md 或 文件名.md，不能包含子目录、路径穿越、反斜杠或非 Markdown 文件。页面没有读取该参数，已按最近可用 dream 展示；这不会重跑 Dream Replay、更新 digest、确认内容或写回记忆。
      </div>

      <div v-if="skippedFiles.length > 0" class="partial-warning">
        {{ skippedFiles.length }} 个梦境文件暂时无法读取：{{ skippedFilesLabel }}；已先展示可用结果。
      </div>

      <div v-if="ungroundedDreamCount > 0" class="grounding-warning">
        {{ ungroundedDreamCount }} 个梦境缺少可核对证据或没有召回结果；这些内容只能作为低置信假设，先走自我反思或原始记忆复核。
      </div>

      <div v-if="dreams.length === 0 && !loadError" class="empty-state">
        <div class="empty-title">暂无梦境重放内容</div>
        <p class="empty-hint">下一次长期记忆回放完成后会出现在这里。</p>
      </div>

      <div
        v-else-if="filteredDreams.length === 0"
        class="empty-state filtered-empty"
      >
        <div class="empty-title">当前复核视图没有梦境</div>
        <p class="empty-hint">
          本地筛选未命中；不会重跑 Dream Replay、更新 digest 或写回记忆。
        </p>
        <button
          class="filter-reset"
          title="恢复显示全部梦境；只改变本页可见筛选，不读取新 dream、不确认内容或写回记忆。"
          aria-label="恢复显示全部梦境；只改变本页可见筛选，不读取新 dream、不确认内容或写回记忆。"
          @click="setDreamReviewFilter('all')"
        >
          显示全部
        </button>
      </div>

      <div v-else-if="filteredDreams.length > 0" class="dream-list">
        <article
          v-for="dream in filteredDreams"
          :key="dream.filename"
          class="dream-card"
          :class="{
            expanded: dream.expanded,
            targeted: dream.filename === requestedFilename,
          }"
        >
          <button
            class="dream-toggle"
            :aria-expanded="dream.expanded"
            @click="toggleExpand(dream)"
          >
            <div class="dream-header">
              <div class="dream-title-block">
                <div class="dream-title-row">
                  <div class="dream-title">{{ dream.title }}</div>
                  <span v-if="isRequestedDream(dream)" class="dream-target-chip">
                    通知命中
                  </span>
                  <span class="dream-date">{{ dream.date || '未知日期' }}</span>
                </div>
                <div class="dream-badges">
                  <span class="dream-badge">洞察 {{ dream.insights.length }}</span>
                  <span class="dream-badge risk"
                    >风险 {{ dream.risks.length }}</span
                  >
                  <span class="dream-badge relation"
                    >新关系 {{ dream.relationships.length }}</span
                  >
                </div>
                <div class="dream-source-row">
                  <span :title="`dreams/${dream.filename}`">
                    来源 dreams/{{ dream.filename }}
                  </span>
                  <span>低置信联想，需复核后使用</span>
                  <span>{{ dreamFreshnessLabel(dream) }}</span>
                  <span
                    class="dream-grounding-chip"
                    :class="{ missing: !dream.grounding.available }"
                  >
                    {{ groundingSummary(dream) }}
                  </span>
                  <span
                    class="dream-readiness-chip"
                    :class="dreamReadinessClass(dream)"
                  >
                    {{ dreamReadinessLabel(dream) }}
                  </span>
                  <span
                    class="dream-triage-chip"
                    :class="dreamTriage(dream).tone"
                  >
                    {{ dreamTriage(dream).label }}
                  </span>
                </div>
              </div>
              <span class="expand-indicator">{{
                dream.expanded ? '收起' : '展开'
              }}</span>
            </div>
            <div class="dream-preview" v-if="!dream.expanded">
              {{ dream.preview }}
            </div>
          </button>

          <div
            v-if="isRequestedDream(dream)"
            class="dream-notification-receipt"
            aria-label="梦境通知命中回执"
          >
            <div class="notification-receipt-head">
              <span>通知命中回执</span>
              <strong>{{ dreamNotificationHandoffReceipt(dream).title }}</strong>
            </div>
            <div class="notification-receipt-lines">
              <span
                v-for="line in dreamNotificationHandoffReceipt(dream).lines"
                :key="line"
              >
                {{ line }}
              </span>
            </div>
            <div class="notification-receipt-boundary">
              {{ dreamNotificationHandoffReceipt(dream).boundary }}
            </div>
          </div>

          <div class="dream-freshness-receipt" aria-label="梦境时间回执">
            <div class="freshness-receipt-head">
              <span>时间回执</span>
              <strong>{{ dreamFreshnessReceipt(dream).title }}</strong>
            </div>
            <div class="freshness-receipt-lines">
              <span
                v-for="line in dreamFreshnessReceipt(dream).lines"
                :key="line"
              >
                {{ line }}
              </span>
            </div>
            <div class="freshness-receipt-boundary">
              {{ dreamFreshnessReceipt(dream).boundary }}
            </div>
          </div>

          <div class="dream-triage-receipt" :class="dreamTriage(dream).tone">
            <div class="triage-head">
              <span>处理回执</span>
              <strong>{{ dreamTriage(dream).title }}</strong>
            </div>
            <p>{{ dreamTriage(dream).summary }}</p>
            <div class="triage-boundary">{{ dreamTriage(dream).boundary }}</div>
          </div>

          <div class="dream-visible-handoff" aria-label="梦境可见复核入口">
            <div class="visible-handoff-copy">
              <span>复核入口</span>
              <strong>{{ dreamVisibleHandoffLabel(dream) }}</strong>
              <p>{{ dreamReviewHandoffReceipt(dream).boundary }}</p>
            </div>
            <router-link
              class="dream-visible-handoff-link"
              :to="reflectionReviewRoute(dream)"
            >
              打开反思筛选
            </router-link>
          </div>

          <div class="dream-brief" v-if="!dream.expanded">
            <div v-if="dream.risks.length > 0" class="brief-block risk">
              <div class="brief-label">优先复核</div>
              <ul>
                <li v-for="risk in visibleItems(dream.risks)" :key="risk">
                  {{ risk }}
                </li>
              </ul>
            </div>
            <div v-else-if="dream.insights.length > 0" class="brief-block">
              <div class="brief-label">主要洞察</div>
              <ul>
                <li v-for="insight in visibleItems(dream.insights)" :key="insight">
                  {{ insight }}
                </li>
              </ul>
            </div>
            <div v-if="dream.relationships.length > 0" class="relation-strip">
              <span>低置信度新关系</span>
              <span>{{ dream.relationships[0] }}</span>
            </div>
          </div>

          <div class="dream-content" v-if="dream.expanded">
            <div class="review-note">
              这是生成式回放产出的低置信度联想；进入行动前先核对原始记忆或对应反思线程。
            </div>
            <div
              class="grounding-receipt"
              :class="{ missing: !dream.grounding.available }"
            >
              <div class="grounding-title">证据回执</div>
              <div class="grounding-body">{{ groundingSummary(dream) }}</div>
              <div class="grounding-meta" v-if="groundingMeta(dream)">
                {{ groundingMeta(dream) }}
              </div>
              <ul v-if="dream.grounding.snippets.length > 0">
                <li
                  v-for="snippet in visibleItems(dream.grounding.snippets)"
                  :key="snippet"
                >
                  {{ snippet }}
                </li>
              </ul>
              <div v-else class="grounding-empty">
                旧梦境或无召回结果没有记录可核对片段；先进入反思线程确认。
              </div>
            </div>
            <div class="dream-review-actions">
              <div class="dream-review-command">
                <router-link
                  class="dream-review-topic-link"
                  :to="reflectionReviewRoute(dream)"
                >
                  复核这个主题
                </router-link>
                <span>会带上当前梦境主题，方便定位对应反思线程。</span>
              </div>
              <div
                class="dream-review-handoff-receipt"
                aria-label="梦境复核交接回执"
              >
                <div class="handoff-receipt-head">
                  <span>复核交接回执</span>
                  <strong>{{ dreamReviewHandoffReceipt(dream).title }}</strong>
                </div>
                <div class="handoff-receipt-lines">
                  <span
                    v-for="line in dreamReviewHandoffReceipt(dream).lines"
                    :key="line"
                  >
                    {{ line }}
                  </span>
                </div>
                <div class="handoff-receipt-boundary">
                  {{ dreamReviewHandoffReceipt(dream).boundary }}
                </div>
              </div>
            </div>
            <div class="dream-markdown" v-html="renderMarkdown(dream.content)"></div>
          </div>
        </article>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { getMemoryServiceClient } from '../../services/MemoryServiceClient';

interface DreamItem {
  filename: string;
  title: string;
  date: string;
  fileDate: string;
  generatedDate: string;
  preview: string;
  content: string;
  insights: string[];
  risks: string[];
  relationships: string[];
  grounding: DreamGroundingReceipt;
  expanded: boolean;
}

interface DreamGroundingReceipt {
  available: boolean;
  memoryCount: number | null;
  resultTypes: string[];
  hitChannels: string[];
  checkedChannels: string[];
  snippets: string[];
}

interface DreamReviewTriage {
  tone: 'risk' | 'relation' | 'evidence' | 'insight' | 'quiet';
  label: string;
  title: string;
  summary: string;
  boundary: string;
}

interface DreamReviewHandoffReceipt {
  title: string;
  lines: string[];
  boundary: string;
}

interface DreamFreshnessReceipt {
  title: string;
  lines: string[];
  boundary: string;
}

type DreamReviewFilter = 'all' | 'priority' | 'ready' | 'missing';

interface DreamReviewFilterOption {
  value: DreamReviewFilter;
  label: string;
  count: number;
  description: string;
}

interface DreamReviewFilterReceipt {
  title: string;
  summary: string;
  boundary: string;
}

const loading = ref(true);
const loadError = ref('');
const dreams = ref<DreamItem[]>([]);
const skippedFiles = ref<string[]>([]);
const activeDreamReviewFilter = ref<DreamReviewFilter>('all');
const route = useRoute();

const hasRequestedFileParam = computed(
  () => typeof route.query.file !== 'undefined',
);
const rawRequestedFileParam = computed(() =>
  (firstQueryValue(route.query.file) ?? '').trim(),
);
const requestedFilename = computed(() =>
  normalizeDreamFilename(rawRequestedFileParam.value),
);
const invalidRequestedFileParam = computed(
  () => hasRequestedFileParam.value && !requestedFilename.value,
);

const totalInsights = computed(() =>
  dreams.value.reduce((count, dream) => count + dream.insights.length, 0),
);
const totalRisks = computed(() =>
  dreams.value.reduce((count, dream) => count + dream.risks.length, 0),
);
const totalRelationships = computed(() =>
  dreams.value.reduce((count, dream) => count + dream.relationships.length, 0),
);
const priorityReviewDreamCount = computed(
  () => dreams.value.filter(isPriorityReviewDream).length,
);
const reviewReadyDreamCount = computed(
  () => dreams.value.filter(isDreamReviewReady).length,
);
const ungroundedDreamCount = computed(
  () => dreams.value.filter(needsGroundingReview).length,
);
const filteredDreams = computed(() =>
  dreams.value.filter((dream) =>
    dreamMatchesReviewFilter(dream, activeDreamReviewFilter.value),
  ),
);
const dreamReviewFilterOptions = computed<DreamReviewFilterOption[]>(() => [
  {
    value: 'all',
    label: '全部',
    count: dreams.value.length,
    description: '按深链命中和生成日期展示当前读取窗口内的所有梦境',
  },
  {
    value: 'priority',
    label: '优先复核',
    count: priorityReviewDreamCount.value,
    description: '只看有证据且包含风险或新关系的梦境',
  },
  {
    value: 'ready',
    label: '可带证据',
    count: reviewReadyDreamCount.value,
    description: '只看已经带原始证据回执、适合进入 Reflection 复核的梦境',
  },
  {
    value: 'missing',
    label: '缺证据',
    count: ungroundedDreamCount.value,
    description: '只看缺少证据回执或召回结果为 0 的梦境',
  },
]);
const activeDreamReviewFilterOption = computed(
  () =>
    dreamReviewFilterOptions.value.find(
      (option) => option.value === activeDreamReviewFilter.value,
    ) ?? dreamReviewFilterOptions.value[0],
);
const dreamReviewFilterReceipt = computed<DreamReviewFilterReceipt>(() => {
  const option = activeDreamReviewFilterOption.value;
  const visibleCount = filteredDreams.value.length;
  const totalCount = dreams.value.length;
  return {
    title: `复核视图：${option.label}`,
    summary: `当前显示 ${visibleCount}/${totalCount} 个梦境；${option.description}。`,
    boundary:
      '本地筛选只改变本页可见列表，不重跑 Dream Replay、不重新读取 digest、不确认梦境内容、不写用户画像、记忆、Rehearsal、通知或外部系统。',
  };
});
const requestedFileLoaded = computed(
  () =>
    Boolean(requestedFilename.value) &&
    dreams.value.some((dream) => dream.filename === requestedFilename.value),
);
const requestedFileMissing = computed(
  () =>
    Boolean(requestedFilename.value) &&
    skippedFiles.value.includes(requestedFilename.value),
);
const dreamScopeReceiptTitle = computed(() => {
  if (dreams.value.length === 0) {
    return '当前没有可读取的梦境文件';
  }
  return `最近可读取的 ${dreams.value.length} 个梦境文件`;
});
const dreamScopeEvidenceLine = computed(
  () =>
    `证据状态：${reviewReadyDreamCount.value} 个可带证据复核，${ungroundedDreamCount.value} 个缺证据，${skippedFiles.value.length} 个读取失败。`,
);
const dreamScopeDeepLinkLine = computed(() => {
  if (invalidRequestedFileParam.value) {
    return '深链状态：已忽略无效 dream 文件参数；只接受 dreams/文件名.md 或 文件名.md。';
  }
  if (!requestedFilename.value) {
    return '深链状态：未指定通知文件，按最近生成日期展示。';
  }
  if (requestedFileLoaded.value) {
    return `深链状态：已额外载入通知文件 ${requestedFilename.value}。`;
  }
  if (requestedFileMissing.value) {
    return `深链状态：通知文件 ${requestedFilename.value} 暂时无法读取。`;
  }
  return `深链状态：正在尝试读取通知文件 ${requestedFilename.value}。`;
});
const skippedFilesLabel = computed(() => {
  const visible = skippedFiles.value.slice(0, 3);
  const suffix =
    skippedFiles.value.length > visible.length
      ? ` 等 ${skippedFiles.value.length} 个`
      : '';
  return `${visible.join('、')}${suffix}`;
});

function extractDate(filename: string): string {
  const match = filename.match(/(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : '';
}

function extractGeneratedDate(content: string): string {
  const match = content.match(
    /^_?\s*Generated:\s*(\d{4}-\d{2}-\d{2})(?:[T\s][^_\n]*)?_?\s*$/im,
  );
  return match ? match[1] : '';
}

function extractTitle(content: string, filename: string): string {
  const headingMatch = content.match(/^#\s+(.+)$/m);
  if (headingMatch) return headingMatch[1].trim().replace(/^Dream:\s*/i, '');
  // Fallback: use filename without extension
  return filename.replace(/\.md$/, '').replace(/-/g, ' ');
}

function firstQueryValue(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    return typeof value[0] === 'string' ? value[0] : undefined;
  }
  return typeof value === 'string' ? value : undefined;
}

function normalizeDreamFilename(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  const filename = trimmed.startsWith('dreams/')
    ? trimmed.slice('dreams/'.length)
    : trimmed;
  if (
    !filename ||
    filename.includes('/') ||
    filename.includes('\\') ||
    filename.includes('..') ||
    !filename.endsWith('.md')
  ) {
    return '';
  }
  return filename;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function cleanInlineMarkdown(text: string): string {
  return text
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/`/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractSection(content: string, heading: string): string {
  const pattern = new RegExp(`^##\\s+${escapeRegExp(heading)}\\s*$`, 'im');
  const match = pattern.exec(content);
  if (!match) return '';
  const body = content.slice(match.index + match[0].length);
  const nextHeadingIndex = body.search(/^##\s+/m);
  return (nextHeadingIndex >= 0 ? body.slice(0, nextHeadingIndex) : body).trim();
}

function extractListItems(content: string, heading: string): string[] {
  const section = extractSection(content, heading);
  if (!section) return [];
  return section
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- '))
    .map((line) => cleanInlineMarkdown(line.slice(2)))
    .filter((line) => line.length > 0 && line.toLowerCase() !== 'none');
}

function extractReceiptValue(section: string, label: string): string {
  const pattern = new RegExp(`^-\\s+${escapeRegExp(label)}:\\s*(.+)$`, 'im');
  const match = pattern.exec(section);
  return match ? cleanInlineMarkdown(match[1]) : '';
}

function splitReceiptList(value: string): string[] {
  if (!value || value.toLowerCase() === 'none') return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function extractGroundingReceipt(content: string): DreamGroundingReceipt {
  const section = extractSection(content, 'Grounding Receipt');
  if (!section) {
    return {
      available: false,
      memoryCount: null,
      resultTypes: [],
      hitChannels: [],
      checkedChannels: [],
      snippets: [],
    };
  }

  const memoryCountValue = extractReceiptValue(section, 'Recalled memories');
  const parsedMemoryCount = Number.parseInt(memoryCountValue, 10);

  return {
    available: true,
    memoryCount: Number.isFinite(parsedMemoryCount) ? parsedMemoryCount : null,
    resultTypes: splitReceiptList(
      extractReceiptValue(section, 'Recall result types'),
    ),
    hitChannels: splitReceiptList(
      extractReceiptValue(section, 'Recall hit channels'),
    ),
    checkedChannels: splitReceiptList(
      extractReceiptValue(section, 'Recall checked channels'),
    ),
    snippets: extractListItems(content, 'Grounding Snippets'),
  };
}

function formatList(items: string[]): string {
  return items.length > 0 ? items.join(' / ') : '';
}

function groundingSummary(dream: DreamItem): string {
  if (!dream.grounding.available) return '证据回执未记录';
  if (dream.grounding.memoryCount === null) return '原始证据数量未记录';
  return `原始证据 ${dream.grounding.memoryCount} 条`;
}

function groundingMeta(dream: DreamItem): string {
  if (!dream.grounding.available) return '';
  const parts = [];
  const hitChannels = formatList(dream.grounding.hitChannels);
  if (hitChannels) parts.push(`命中通道 ${hitChannels}`);
  const resultTypes = formatList(dream.grounding.resultTypes);
  if (resultTypes) parts.push(`结果类型 ${resultTypes}`);
  const checkedChannels = formatList(dream.grounding.checkedChannels);
  if (checkedChannels) parts.push(`检查通道 ${checkedChannels}`);
  return parts.join('；');
}

function isDreamReviewReady(dream: DreamItem): boolean {
  return dream.grounding.available && (dream.grounding.memoryCount ?? 0) > 0;
}

function needsGroundingReview(dream: DreamItem): boolean {
  return !isDreamReviewReady(dream);
}

function dreamReadinessLabel(dream: DreamItem): string {
  if (isDreamReviewReady(dream)) return '复核就绪';
  if (dream.grounding.available) return '无召回证据';
  return '缺证据回执';
}

function dreamReadinessClass(dream: DreamItem): string {
  if (isDreamReviewReady(dream)) return 'ready';
  if (dream.grounding.available) return 'empty';
  return 'missing';
}

function dreamFreshnessLabel(dream: DreamItem): string {
  if (dream.generatedDate) return `生成 ${dream.generatedDate}`;
  if (dream.fileDate) return `文件日期 ${dream.fileDate}`;
  return '生成日期未记录';
}

function dreamFreshnessReceipt(dream: DreamItem): DreamFreshnessReceipt {
  const generated = dream.generatedDate || '未记录';
  const fileDate = dream.fileDate || '未记录';
  const boundary =
    '本回执只说明时间依据；不会重跑 Dream Replay、更新 digest、确认内容、写用户画像或写回记忆。';

  if (
    dream.generatedDate &&
    dream.fileDate &&
    dream.generatedDate !== dream.fileDate
  ) {
    return {
      title: '生成时间与文件名日期不一致',
      lines: [
        `生成日期：${generated}；文件名日期：${fileDate}。`,
        '阅读口径：优先按 Markdown Generated 行理解生成时间，文件名只作为归档线索。',
      ],
      boundary,
    };
  }

  if (dream.generatedDate) {
    return {
      title: '按生成时间阅读',
      lines: [
        `生成日期：${generated}；文件名日期：${fileDate}。`,
        '阅读口径：这条梦境代表该生成周期的低置信回放，不代表当前状态已重新核对。',
      ],
      boundary,
    };
  }

  if (dream.fileDate) {
    return {
      title: '按文件名日期阅读',
      lines: [
        `生成日期：${generated}；文件名日期：${fileDate}。`,
        '阅读口径：Markdown 未记录 Generated 行，只能把文件名日期当作归档线索。',
      ],
      boundary,
    };
  }

  return {
    title: '生成日期未记录',
    lines: [
      `生成日期：${generated}；文件名日期：${fileDate}。`,
      '阅读口径：这是一条无日期依据的历史 dream，进入复核前先核对原始证据。',
    ],
    boundary,
  };
}

function isPriorityReviewDream(dream: DreamItem): boolean {
  return (
    isDreamReviewReady(dream) &&
    (dream.risks.length > 0 || dream.relationships.length > 0)
  );
}

function dreamMatchesReviewFilter(
  dream: DreamItem,
  filter: DreamReviewFilter,
): boolean {
  if (filter === 'priority') return isPriorityReviewDream(dream);
  if (filter === 'ready') return isDreamReviewReady(dream);
  if (filter === 'missing') return needsGroundingReview(dream);
  return true;
}

function setDreamReviewFilter(filter: DreamReviewFilter) {
  activeDreamReviewFilter.value = filter;
}

function dreamReviewFilterButtonBoundary(
  option: DreamReviewFilterOption,
): string {
  return `${option.label}：显示 ${option.count} 个梦境，${option.description}；只改变本页可见筛选，不重跑 Dream Replay、不更新 digest、不确认内容或写回记忆。`;
}

function isRequestedDream(dream: DreamItem): boolean {
  return Boolean(requestedFilename.value) && dream.filename === requestedFilename.value;
}

function dreamTriage(dream: DreamItem): DreamReviewTriage {
  if (!isDreamReviewReady(dream)) {
    return {
      tone: 'evidence',
      label: '先补证据',
      title: '不要直接采用这条梦境',
      summary:
        '没有可核对原始片段，先在自我反思或搜索里补到证据，再判断洞察、风险或新关系。',
      boundary:
        '不会写用户画像、创建 Rehearsal、确认新关系、派发动作或外部通知。',
    };
  }

  if (dream.risks.length > 0) {
    return {
      tone: 'risk',
      label: '高优先复核',
      title: '先核证风险',
      summary: `${dream.risks.length} 条风险线索带有 ${groundingSummary(
        dream,
      )}；先打开反思线程核对原始片段和责任人。`,
      boundary:
        '这里只是风险线索，不会自动通知、派发任务、写外部系统或确认事实。',
    };
  }

  if (dream.relationships.length > 0) {
    return {
      tone: 'relation',
      label: '关系待确认',
      title: '先核证新关系',
      summary: `${dream.relationships.length} 条低置信新关系带有 ${groundingSummary(
        dream,
      )}；先核对双方实体、时间和上下文是否真实成立。`,
      boundary:
        '不会把 dream 关系升格为稳定图谱事实、画像事实或 Rehearsal。',
    };
  }

  if (dream.insights.length > 0) {
    return {
      tone: 'insight',
      label: '洞察可整理',
      title: '整理为反思线索',
      summary: `${dream.insights.length} 条洞察已带 ${groundingSummary(
        dream,
      )}；适合进入反思线程沉淀开放问题或后续观察点。`,
      boundary: '不会自动改写记忆权重、创建行动项或替用户做结论。',
    };
  }

  return {
    tone: 'quiet',
    label: '低优先浏览',
    title: '只作背景回放',
    summary: `已有 ${groundingSummary(
      dream,
    )}，但暂无风险、关系或洞察列表；先作为长期背景阅读。`,
    boundary: '只读浏览，不会写入、发送、同步或触发外部动作。',
  };
}

function dreamReviewHandoffReceipt(dream: DreamItem): DreamReviewHandoffReceipt {
  const evidenceState = isDreamReviewReady(dream)
    ? '可带证据复核'
    : '先补原始证据';

  return {
    title: '只打开复核筛选',
    lines: [
      `目标：Reflection 以“${dream.title}”筛选，来源标记为 dream。`,
      `来源：dreams/${dream.filename}；风险 ${dream.risks.length} 条，新关系 ${dream.relationships.length} 条。`,
      `证据：${groundingSummary(dream)}；${evidenceState}。`,
    ],
    boundary:
      '跳转只携带筛选条件，不确认 dream 结论，不新增记忆或画像，不创建 Rehearsal、通知、动作或外部写回。',
  };
}

function dreamVisibleHandoffLabel(dream: DreamItem): string {
  if (dream.risks.length > 0) return '带风险线索去 Reflection 核证';
  if (dream.relationships.length > 0) return '带新关系线索去 Reflection 核证';
  if (needsGroundingReview(dream)) return '先带主题去 Reflection 找证据';
  if (dream.insights.length > 0) return '带洞察线索去 Reflection 整理';
  return '带主题去 Reflection 只读查看';
}

function dreamNotificationHandoffReceipt(
  dream: DreamItem,
): DreamReviewHandoffReceipt {
  const evidenceState = isDreamReviewReady(dream)
    ? '可带证据进入反思筛选'
    : '缺少可核对证据，先补原始片段';

  return {
    title: '这条是通知指向的梦境',
    lines: [
      `来源：通知深链请求 dreams/${dream.filename}，页面已展开并置顶这条梦境。`,
      `证据：${groundingSummary(dream)}；${evidenceState}。`,
      `下一步：复核这个主题只会打开 Reflection 筛选，不会确认风险或新关系。`,
    ],
    boundary:
      '本回执只说明打开来源和复核范围，不写用户画像、不创建 Rehearsal、不发送通知或外部写回。',
  };
}

function truncate(text: string, maxLen: number): string {
  // Strip markdown headings and extra whitespace for preview
  const plain = text
    .replace(/^#{1,6}\s+.*$/gm, '')
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/`/g, '')
    .replace(/\n{2,}/g, '\n')
    .trim();
  if (plain.length <= maxLen) return plain;
  return plain.slice(0, maxLen) + '...';
}

function visibleItems(items: string[]): string[] {
  return items.slice(0, 2);
}

function renderMarkdown(md: string): string {
  // Simple markdown to HTML conversion for display
  return md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/^### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^## (.+)$/gm, '<h3>$1</h3>')
    .replace(/^# (.+)$/gm, '<h2>$1</h2>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
    .replace(/<\/ul>\s*<ul>/g, '')
    .replace(/\n{2,}/g, '<br/><br/>')
    .replace(/\n/g, '<br/>');
}

function toggleExpand(dream: DreamItem) {
  dream.expanded = !dream.expanded;
}

function reflectionReviewRoute(dream: DreamItem) {
  return {
    path: '/reflection-threads',
    query: {
      status: 'all',
      source: 'dream',
      search: dream.title,
    },
  };
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return '无法连接 Memory Service 或读取梦境文件。';
}

async function loadDreams() {
  loading.value = true;
  loadError.value = '';
  skippedFiles.value = [];
  dreams.value = [];

  try {
    const client = getMemoryServiceClient();
    const files = await client.listUserFiles('dreams');

    // Sort by date descending (latest first)
    const sorted = [...files].sort((a, b) => {
      const dateA = extractDate(a);
      const dateB = extractDate(b);
      return dateB.localeCompare(dateA);
    });

    // Limit to 10 most recent, plus an explicit notification deep-link target.
    const requested = requestedFilename.value;
    const recent = sorted.slice(0, 10);
    const filesToLoad =
      requested && !recent.includes(requested)
        ? [requested, ...recent]
        : recent;

    // Fetch content for each file
    const items: DreamItem[] = [];
    const results = await Promise.all(
      filesToLoad.map(async (filename) => {
        try {
          const content = await client.readUserFile('dreams', filename);
          return { filename, content };
        } catch {
          return { filename, content: null };
        }
      }),
    );

    for (const result of results) {
      if (result.content !== null) {
        const { filename, content } = result;
        const fileDate = extractDate(filename);
        const generatedDate = extractGeneratedDate(content!);
        const narrative = extractSection(content!, 'Narrative');
        items.push({
          filename,
          title: extractTitle(content!, filename),
          date: generatedDate || fileDate,
          fileDate,
          generatedDate,
          preview: truncate(narrative || content!, 300),
          content: content!,
          insights: extractListItems(content!, 'Insights'),
          risks: extractListItems(content!, 'Risks'),
          relationships: extractListItems(content!, 'Discovered Relationships'),
          grounding: extractGroundingReceipt(content!),
          expanded: filename === requested,
        });
      } else {
        skippedFiles.value.push(result.filename);
      }
    }

    if (requested) {
      items.sort((a, b) => {
        if (a.filename === requested) return -1;
        if (b.filename === requested) return 1;
        return 0;
      });
    }

    dreams.value = items;
  } catch (error) {
    console.error('Failed to load dream insights:', error);
    loadError.value = errorMessage(error);
  } finally {
    loading.value = false;
  }
}

onMounted(loadDreams);
watch(
  () => route.query.file,
  () => {
    void loadDreams();
  },
);
</script>

<style scoped>
.dream-insights-container {
  animation: fadeInUp 0.6s ease-out;
  max-width: 900px;
  margin: 0 auto;
}

.header-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.25rem;
}

.section-title {
  font-size: 1.5rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
  color: #e5e7eb;
}

.section-subtitle {
  color: #94a3b8;
  font-size: 0.875rem;
  line-height: 1.5;
}

.review-link,
.load-error-retry {
  border: 1px solid rgba(148, 163, 184, 0.28);
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.8);
  color: #e5e7eb;
  padding: 0.55rem 0.8rem;
  font-size: 0.8rem;
  font-weight: 600;
  text-decoration: none;
  white-space: nowrap;
  cursor: pointer;
}

.review-link:hover,
.load-error-retry:hover {
  border-color: rgba(96, 165, 250, 0.55);
  color: #bfdbfe;
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  color: #94a3b8;
}

.loading-spinner {
  width: 2.5rem;
  height: 2.5rem;
  border: 2px solid rgba(167, 139, 250, 0.3);
  border-top: 2px solid #a78bfa;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 1rem;
}

.load-error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  border: 1px solid rgba(248, 113, 113, 0.28);
  border-radius: 8px;
  background: rgba(127, 29, 29, 0.18);
  color: #fecaca;
  padding: 1rem;
  margin-bottom: 1rem;
}

.load-error-title {
  color: #fee2e2;
  font-weight: 700;
  margin-bottom: 0.25rem;
}

.dream-scope-receipt {
  border: 1px solid rgba(45, 212, 191, 0.22);
  border-radius: 8px;
  background:
    linear-gradient(135deg, rgba(20, 83, 45, 0.16), rgba(30, 41, 59, 0.56)),
    rgba(15, 23, 42, 0.72);
  color: #cbd5e1;
  padding: 0.85rem 0.95rem;
  margin-bottom: 1rem;
}

.scope-receipt-main {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 0.6rem;
}

.scope-receipt-label {
  color: #99f6e4;
  font-size: 0.76rem;
  font-weight: 800;
}

.scope-receipt-main strong {
  color: #e5e7eb;
  font-size: 0.92rem;
}

.scope-receipt-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.45rem 0.8rem;
  color: #94a3b8;
  font-size: 0.78rem;
  line-height: 1.5;
}

.scope-receipt-boundary {
  margin-top: 0.6rem;
  border-top: 1px solid rgba(148, 163, 184, 0.12);
  padding-top: 0.55rem;
  color: #fde68a;
  font-size: 0.78rem;
  line-height: 1.5;
}

.dream-overview {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.overview-metric {
  border: 1px solid rgba(148, 163, 184, 0.16);
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.55);
  padding: 0.85rem;
}

.metric-label {
  display: block;
  color: #94a3b8;
  font-size: 0.75rem;
  margin-bottom: 0.35rem;
}

.overview-metric strong {
  color: #e5e7eb;
  font-size: 1.35rem;
}

.overview-metric.risk strong {
  color: #fca5a5;
}

.overview-metric.relation strong {
  color: #6ee7b7;
}

.overview-metric.priority strong {
  color: #fca5a5;
}

.overview-metric.ready strong {
  color: #a7f3d0;
}

.overview-metric.warning strong {
  color: #fcd34d;
}

.dream-review-filter {
  border: 1px solid rgba(96, 165, 250, 0.2);
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.58);
  padding: 0.8rem 0.9rem;
  margin-bottom: 1rem;
}

.filter-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.8rem;
  margin-bottom: 0.7rem;
  color: #94a3b8;
  font-size: 0.78rem;
  line-height: 1.5;
}

.filter-head strong {
  display: block;
  color: #e5e7eb;
  font-size: 0.9rem;
  margin-top: 0.15rem;
}

.filter-label {
  color: #bfdbfe;
  font-size: 0.74rem;
  font-weight: 800;
}

.filter-options {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.45rem;
}

.filter-option,
.filter-reset {
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 8px;
  background: rgba(30, 41, 59, 0.72);
  color: #cbd5e1;
  cursor: pointer;
  font-size: 0.78rem;
  font-weight: 700;
  transition:
    border-color 0.2s ease,
    background 0.2s ease,
    color 0.2s ease;
}

.filter-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.45rem;
  min-height: 2.35rem;
  padding: 0.45rem 0.55rem;
}

.filter-option strong {
  color: #e5e7eb;
  font-size: 0.9rem;
}

.filter-option:hover,
.filter-option.active,
.filter-reset:hover {
  border-color: rgba(96, 165, 250, 0.5);
  background: rgba(37, 99, 235, 0.18);
  color: #bfdbfe;
}

.filter-boundary {
  margin-top: 0.65rem;
  border-top: 1px solid rgba(148, 163, 184, 0.12);
  padding-top: 0.55rem;
  color: #fde68a;
  font-size: 0.76rem;
  line-height: 1.5;
}

.partial-warning {
  border: 1px solid rgba(251, 191, 36, 0.26);
  border-radius: 8px;
  background: rgba(120, 53, 15, 0.18);
  color: #fde68a;
  padding: 0.75rem 0.9rem;
  margin-bottom: 1rem;
  font-size: 0.82rem;
}

.targeted-warning {
  border-color: rgba(45, 212, 191, 0.3);
  background: rgba(20, 83, 45, 0.14);
  color: #ccfbf1;
}

.grounding-warning {
  border: 1px solid rgba(251, 191, 36, 0.22);
  border-radius: 8px;
  background: rgba(120, 53, 15, 0.12);
  color: #fde68a;
  padding: 0.75rem 0.9rem;
  margin-bottom: 1rem;
  font-size: 0.82rem;
  line-height: 1.5;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  color: #94a3b8;
  text-align: center;
}

.empty-title {
  color: #e5e7eb;
  font-weight: 700;
  margin-bottom: 0.35rem;
}

.empty-hint {
  font-size: 0.875rem;
  color: #64748b;
  margin-top: 0.5rem;
}

.filtered-empty {
  border: 1px solid rgba(148, 163, 184, 0.14);
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.42);
  margin-bottom: 1rem;
}

.filter-reset {
  margin-top: 1rem;
  padding: 0.55rem 0.85rem;
}

.dream-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.dream-card {
  background: rgba(42, 42, 62, 0.8);
  border: 1px solid rgba(148, 163, 184, 0.1);
  border-radius: 8px;
  overflow: hidden;
  transition:
    border-color 0.2s ease,
    background 0.2s ease,
    box-shadow 0.2s ease;
  backdrop-filter: blur(10px);
}

.dream-card:hover {
  border-color: rgba(96, 165, 250, 0.32);
  box-shadow: 0 4px 20px rgba(15, 23, 42, 0.25);
}

.dream-card.expanded {
  border-color: rgba(96, 165, 250, 0.42);
  background: rgba(42, 42, 62, 0.95);
}

.dream-card.targeted {
  border-color: rgba(45, 212, 191, 0.5);
  box-shadow: 0 0 0 1px rgba(45, 212, 191, 0.16);
}

.dream-card.targeted .dream-toggle {
  background: rgba(20, 83, 45, 0.1);
}

.dream-toggle {
  width: 100%;
  border: 0;
  background: transparent;
  text-align: left;
  padding: 1.15rem 1.35rem;
  cursor: pointer;
}

.dream-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.dream-title-block {
  flex: 1;
  min-width: 0;
}

.dream-title-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex: 1;
  flex-wrap: wrap;
}

.dream-title {
  font-size: 1.1rem;
  font-weight: 600;
  color: #e0e0e0;
}

.dream-target-chip {
  border: 1px solid rgba(45, 212, 191, 0.28);
  border-radius: 999px;
  background: rgba(20, 83, 45, 0.18);
  color: #99f6e4;
  padding: 0.14rem 0.48rem;
  font-size: 0.72rem;
  font-weight: 800;
}

.dream-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-top: 0.65rem;
}

.dream-source-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.55rem;
  color: #94a3b8;
  font-size: 0.74rem;
  line-height: 1.4;
}

.dream-source-row span:first-child {
  color: #cbd5e1;
}

.dream-grounding-chip {
  color: #a7f3d0;
}

.dream-grounding-chip.missing {
  color: #fcd34d;
}

.dream-readiness-chip {
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 999px;
  padding: 0.08rem 0.42rem;
  font-weight: 700;
}

.dream-readiness-chip.ready {
  border-color: rgba(45, 212, 191, 0.22);
  color: #a7f3d0;
}

.dream-readiness-chip.empty,
.dream-readiness-chip.missing {
  border-color: rgba(251, 191, 36, 0.24);
  color: #fcd34d;
}

.dream-triage-chip {
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 999px;
  padding: 0.08rem 0.42rem;
  font-weight: 700;
}

.dream-triage-chip.risk {
  border-color: rgba(248, 113, 113, 0.3);
  color: #fecaca;
}

.dream-triage-chip.relation {
  border-color: rgba(45, 212, 191, 0.26);
  color: #99f6e4;
}

.dream-triage-chip.evidence {
  border-color: rgba(251, 191, 36, 0.26);
  color: #fde68a;
}

.dream-triage-chip.insight,
.dream-triage-chip.quiet {
  border-color: rgba(96, 165, 250, 0.22);
  color: #bfdbfe;
}

.dream-badge {
  border: 1px solid rgba(96, 165, 250, 0.18);
  border-radius: 999px;
  background: rgba(37, 99, 235, 0.12);
  color: #bfdbfe;
  padding: 0.18rem 0.5rem;
  font-size: 0.72rem;
  font-weight: 600;
}

.dream-badge.risk {
  border-color: rgba(248, 113, 113, 0.22);
  background: rgba(127, 29, 29, 0.18);
  color: #fecaca;
}

.dream-badge.relation {
  border-color: rgba(45, 212, 191, 0.2);
  background: rgba(20, 83, 45, 0.16);
  color: #99f6e4;
}

.dream-date {
  font-size: 0.75rem;
  color: #64748b;
  background: rgba(100, 116, 139, 0.15);
  padding: 0.2rem 0.6rem;
  border-radius: 0.5rem;
  white-space: nowrap;
}

.expand-indicator {
  color: #93c5fd;
  font-size: 0.75rem;
  font-weight: 700;
  flex-shrink: 0;
  margin-top: 0.25rem;
}

.dream-preview {
  margin-top: 0.75rem;
  color: #94a3b8;
  font-size: 0.875rem;
  line-height: 1.6;
}

.dream-brief {
  padding: 0 1.35rem 1.1rem;
}

.dream-triage-receipt {
  margin: 0 1.35rem 0.9rem;
  border: 1px solid rgba(96, 165, 250, 0.18);
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.34);
  color: #cbd5e1;
  padding: 0.7rem 0.85rem;
  font-size: 0.8rem;
  line-height: 1.5;
}

.dream-notification-receipt {
  margin: 0 1.35rem 0.9rem;
  border: 1px solid rgba(45, 212, 191, 0.28);
  border-radius: 8px;
  background: rgba(20, 83, 45, 0.14);
  color: #cbd5e1;
  padding: 0.72rem 0.85rem;
  font-size: 0.8rem;
  line-height: 1.5;
}

.notification-receipt-head {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.45rem;
  margin-bottom: 0.4rem;
}

.notification-receipt-head span {
  color: #99f6e4;
  font-size: 0.72rem;
  font-weight: 800;
}

.notification-receipt-head strong {
  color: #e5e7eb;
}

.notification-receipt-lines {
  display: grid;
  gap: 0.26rem;
}

.notification-receipt-lines span {
  display: block;
}

.notification-receipt-boundary {
  margin-top: 0.4rem;
  border-top: 1px solid rgba(148, 163, 184, 0.12);
  padding-top: 0.4rem;
  color: #fde68a;
}

.dream-freshness-receipt {
  margin: 0 1.35rem 0.9rem;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.28);
  color: #cbd5e1;
  padding: 0.68rem 0.85rem;
  font-size: 0.78rem;
  line-height: 1.5;
}

.freshness-receipt-head {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.45rem;
  margin-bottom: 0.35rem;
}

.freshness-receipt-head span {
  color: #bfdbfe;
  font-size: 0.72rem;
  font-weight: 800;
}

.freshness-receipt-head strong {
  color: #e5e7eb;
}

.freshness-receipt-lines {
  display: grid;
  gap: 0.24rem;
}

.freshness-receipt-lines span {
  display: block;
}

.freshness-receipt-boundary {
  margin-top: 0.38rem;
  border-top: 1px solid rgba(148, 163, 184, 0.12);
  padding-top: 0.38rem;
  color: #94a3b8;
}

.dream-triage-receipt.risk {
  border-color: rgba(248, 113, 113, 0.28);
  background: rgba(127, 29, 29, 0.12);
}

.dream-triage-receipt.relation {
  border-color: rgba(45, 212, 191, 0.22);
  background: rgba(20, 83, 45, 0.13);
}

.dream-triage-receipt.evidence {
  border-color: rgba(251, 191, 36, 0.24);
  background: rgba(120, 53, 15, 0.12);
}

.triage-head {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.45rem;
  margin-bottom: 0.35rem;
}

.triage-head span {
  color: #94a3b8;
  font-size: 0.72rem;
  font-weight: 700;
}

.triage-head strong {
  color: #e5e7eb;
}

.dream-triage-receipt p {
  margin: 0;
}

.triage-boundary {
  margin-top: 0.35rem;
  color: #94a3b8;
}

.dream-visible-handoff {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.8rem;
  margin: 0 1.35rem 0.9rem;
  border: 1px solid rgba(45, 212, 191, 0.2);
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.32);
  color: #cbd5e1;
  padding: 0.68rem 0.78rem;
}

.visible-handoff-copy {
  min-width: 0;
}

.visible-handoff-copy span {
  display: inline-block;
  color: #99f6e4;
  font-size: 0.72rem;
  font-weight: 800;
  margin-right: 0.45rem;
}

.visible-handoff-copy strong {
  color: #e5e7eb;
  font-size: 0.82rem;
}

.visible-handoff-copy p {
  margin: 0.28rem 0 0;
  color: #94a3b8;
  font-size: 0.76rem;
  line-height: 1.45;
}

.dream-visible-handoff-link {
  flex-shrink: 0;
  border: 1px solid rgba(45, 212, 191, 0.26);
  border-radius: 8px;
  background: rgba(20, 83, 45, 0.16);
  color: #99f6e4;
  padding: 0.46rem 0.68rem;
  font-size: 0.78rem;
  font-weight: 700;
  text-decoration: none;
  white-space: nowrap;
}

.dream-visible-handoff-link:hover {
  border-color: rgba(45, 212, 191, 0.5);
  color: #ccfbf1;
}

.brief-block {
  border-left: 3px solid rgba(96, 165, 250, 0.5);
  background: rgba(15, 23, 42, 0.38);
  padding: 0.7rem 0.85rem;
}

.brief-block.risk {
  border-left-color: rgba(248, 113, 113, 0.72);
  background: rgba(127, 29, 29, 0.12);
}

.brief-label {
  color: #e5e7eb;
  font-size: 0.78rem;
  font-weight: 700;
  margin-bottom: 0.35rem;
}

.brief-block ul {
  margin: 0;
  padding-left: 1rem;
  color: #cbd5e1;
  font-size: 0.82rem;
  line-height: 1.55;
}

.relation-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.65rem;
  color: #99f6e4;
  font-size: 0.78rem;
}

.relation-strip span:first-child {
  color: #6ee7b7;
  font-weight: 700;
}

.dream-content {
  margin: 0 1.35rem 1.25rem;
  padding-top: 1rem;
  border-top: 1px solid rgba(148, 163, 184, 0.1);
}

.review-note {
  border: 1px solid rgba(251, 191, 36, 0.22);
  border-radius: 8px;
  background: rgba(120, 53, 15, 0.14);
  color: #fde68a;
  padding: 0.65rem 0.75rem;
  margin-bottom: 0.85rem;
  font-size: 0.8rem;
  line-height: 1.5;
}

.grounding-receipt {
  border: 1px solid rgba(45, 212, 191, 0.2);
  border-radius: 8px;
  background: rgba(20, 83, 45, 0.12);
  color: #ccfbf1;
  padding: 0.7rem 0.8rem;
  margin-bottom: 0.85rem;
  font-size: 0.8rem;
  line-height: 1.55;
}

.grounding-receipt.missing {
  border-color: rgba(251, 191, 36, 0.24);
  background: rgba(120, 53, 15, 0.12);
  color: #fde68a;
}

.grounding-title {
  color: #e5e7eb;
  font-weight: 700;
  margin-bottom: 0.25rem;
}

.grounding-body {
  font-weight: 700;
}

.grounding-meta,
.grounding-empty {
  color: #94a3b8;
  margin-top: 0.25rem;
}

.grounding-receipt ul {
  margin: 0.45rem 0 0;
  padding-left: 1rem;
  color: #cbd5e1;
}

.dream-review-actions {
  margin-bottom: 0.9rem;
  color: #94a3b8;
  font-size: 0.8rem;
}

.dream-review-command {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.65rem;
  margin-bottom: 0.65rem;
}

.dream-review-topic-link {
  border: 1px solid rgba(45, 212, 191, 0.26);
  border-radius: 8px;
  background: rgba(20, 83, 45, 0.16);
  color: #99f6e4;
  padding: 0.48rem 0.72rem;
  font-size: 0.78rem;
  font-weight: 700;
  text-decoration: none;
}

.dream-review-topic-link:hover {
  border-color: rgba(45, 212, 191, 0.5);
  color: #ccfbf1;
}

.dream-review-handoff-receipt {
  border: 1px solid rgba(96, 165, 250, 0.18);
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.38);
  color: #cbd5e1;
  padding: 0.68rem 0.78rem;
  line-height: 1.5;
}

.handoff-receipt-head {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 0.45rem;
  margin-bottom: 0.45rem;
}

.handoff-receipt-head span {
  color: #93c5fd;
  font-size: 0.72rem;
  font-weight: 800;
}

.handoff-receipt-head strong {
  color: #e5e7eb;
}

.handoff-receipt-lines {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.25rem;
}

.handoff-receipt-boundary {
  margin-top: 0.45rem;
  border-top: 1px solid rgba(148, 163, 184, 0.12);
  padding-top: 0.45rem;
  color: #fde68a;
}

.dream-markdown {
  color: #cbd5e1;
  font-size: 0.875rem;
  line-height: 1.7;
}

.dream-markdown :deep(h2) {
  font-size: 1.2rem;
  font-weight: 600;
  color: #a78bfa;
  margin: 1rem 0 0.5rem;
}

.dream-markdown :deep(h3) {
  font-size: 1.05rem;
  font-weight: 600;
  color: #60a5fa;
  margin: 0.75rem 0 0.5rem;
}

.dream-markdown :deep(h4) {
  font-size: 0.95rem;
  font-weight: 600;
  color: #93c5fd;
  margin: 0.5rem 0 0.25rem;
}

.dream-markdown :deep(strong) {
  color: #e0e0e0;
  font-weight: 600;
}

.dream-markdown :deep(em) {
  color: #94a3b8;
  font-style: italic;
}

.dream-markdown :deep(code) {
  background: rgba(59, 130, 246, 0.1);
  color: #60a5fa;
  padding: 0.1rem 0.4rem;
  border-radius: 0.25rem;
  font-size: 0.8rem;
}

.dream-markdown :deep(ul) {
  padding-left: 1.25rem;
  margin: 0.5rem 0;
}

.dream-markdown :deep(li) {
  padding: 0.2rem 0;
  color: #cbd5e1;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 720px) {
  .header-row {
    flex-direction: column;
  }

  .review-link {
    width: 100%;
    text-align: center;
  }

  .dream-overview {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .filter-head {
    flex-direction: column;
  }

  .filter-options {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .scope-receipt-grid {
    grid-template-columns: 1fr;
  }

  .dream-visible-handoff {
    align-items: stretch;
    flex-direction: column;
  }

  .dream-visible-handoff-link {
    text-align: center;
  }
}
</style>
