<template>
  <div class="storyline-page">
    <header class="page-header">
      <div class="page-copy">
        <div class="page-eyebrow">memory-exploring · {{ pagePath }}</div>
        <h1>故事线编排器</h1>
        <p>
          把会前准备或资料记忆 seed 编排成可讲述草稿。生成稿不会自动外发，只在这里复核、切换输出格式和复制。
        </p>
      </div>

      <div class="header-actions">
        <span class="trigger-chip">
          <span class="status-dot"></span>
          {{ canRequestDraft ? `${sourceLabel} · ${prepShortId}` : '等待 Storyline 来源' }}
        </span>
        <div
          v-if="canRequestDraft"
          class="target-segmented"
          role="group"
          aria-label="输出格式"
        >
          <button
            v-for="option in artifactOptions"
            :key="option.id"
            type="button"
            :class="{ active: activeTarget === option.id }"
            :aria-pressed="activeTarget === option.id ? 'true' : 'false'"
            :title="targetSwitchButtonBoundary(option.id)"
            :aria-label="targetSwitchButtonBoundary(option.id)"
            @click="setTarget(option.id)"
          >
            {{ option.shortLabel }}
          </button>
        </div>
        <button
          v-if="canRequestDraft"
          class="btn ghost"
          type="button"
          :disabled="!canReloadDraft"
          :title="reloadButtonTitle"
          :aria-label="reloadButtonTitle"
          @click="reloadDraft"
        >
          重新生成
        </button>
        <button
          v-if="canRequestDraft"
          class="btn primary"
          type="button"
          :disabled="!canCopyArtifact"
          :title="copyButtonTitle"
          @click="copyArtifact"
        >
          {{ copied ? '已复制' : '复制输出' }}
        </button>
        <span
          v-if="copyGateReason"
          class="copy-gate-chip"
          role="status"
        >
          {{ copyGateReason }}
        </span>
      </div>
    </header>

    <section v-if="loadError" class="state-panel error">
      <h2>生成失败</h2>
      <p>{{ loadError }}</p>
    </section>

    <section v-else-if="loading" class="state-panel">
      <div class="loading-spinner"></div>
      <p>正在根据已选证据来源生成 Storyline draft...</p>
      <section
        v-if="draftRequestReceipt && !regenerateRequestReceipt"
        class="draft-request-receipt"
        aria-label="Storyline 草稿生成请求回执"
      >
        <div class="receipt-copy">
          <div class="label">草稿生成请求回执</div>
          <h2>正在请求 Storyline Draft API</h2>
          <p>{{ draftRequestReceiptBoundary }}</p>
        </div>
        <div class="receipt-metrics" aria-label="Storyline draft request receipt">
          <span>请求 {{ draftRequestReceipt.requestedAtLabel }}</span>
          <span>{{ artifactLabel(draftRequestReceipt.targetArtifact) }}</span>
          <span>来源 {{ draftRequestReceipt.prepShortId }}</span>
          <span>等待服务端证据回执</span>
        </div>
      </section>
      <section
        v-if="regenerateRequestReceipt"
        class="regenerate-request-receipt"
        aria-label="Storyline 重新生成请求回执"
      >
        <div class="receipt-copy">
          <div class="label">重新生成请求回执</div>
          <h2>已清除本页缓存，正在重新生成</h2>
          <p>{{ regenerateRequestReceiptBoundary }}</p>
        </div>
        <div class="receipt-metrics" aria-label="Storyline regenerate request receipt">
          <span>请求 {{ regenerateRequestReceipt.requestedAtLabel }}</span>
          <span>{{ artifactLabel(regenerateRequestReceipt.targetArtifact) }}</span>
          <span>来源 {{ regenerateRequestReceipt.prepShortId }}</span>
          <span>复核确认已重置</span>
        </div>
      </section>
    </section>

    <section v-else-if="draft" class="storyline-workbench">
      <section
        v-if="generationReceipt"
        class="generation-receipt"
        aria-label="Storyline 生成范围回执"
      >
        <div class="receipt-copy">
          <div class="label">生成范围回执</div>
          <h2>{{ generationModeLabel }}</h2>
          <p>{{ generationReceiptBoundary }}</p>
        </div>
        <div class="receipt-metrics" aria-label="Storyline API generation receipt">
          <span>来源 {{ generationReceipt.sourceEvidenceRefCount }} refs</span>
          <span>草稿引用 {{ generationReceipt.citedEvidenceRefCount }} refs</span>
          <span>返回详情 {{ generationReceipt.returnedEvidenceDetailCount }} 条</span>
          <span
            :class="{ warn: generationReceipt.missingEvidenceDetailCount > 0 }"
          >
            缺详情 {{ generationReceipt.missingEvidenceDetailCount }} 条
          </span>
        </div>
        <p
          v-if="generationReceipt.generationMode === 'fallback_cue_cards'"
          class="receipt-warning"
        >
          {{ fallbackReceiptWarning }}
        </p>
      </section>

      <section
        v-if="sessionCacheReceipt"
        class="session-cache-receipt"
        aria-label="Storyline 会话缓存回执"
      >
        <div class="receipt-copy">
          <div class="label">会话缓存回执</div>
          <h2>复用本页会话缓存</h2>
          <p>{{ sessionCacheReceiptBoundary }}</p>
        </div>
        <div class="receipt-metrics" aria-label="Storyline session cache receipt">
          <span>缓存 {{ sessionCacheReceipt.cachedAtLabel }}</span>
          <span>{{ artifactLabel(sessionCacheReceipt.targetArtifact) }}</span>
          <span>草稿引用 {{ evidenceCount }} refs</span>
          <span>返回详情 {{ returnedEvidenceDetailCount }} 条</span>
        </div>
      </section>

      <section
        v-if="targetHandoffReceipt"
        class="target-handoff-receipt"
        aria-label="Storyline 输出目标回执"
      >
        <div class="receipt-copy">
          <div class="label">输出目标回执</div>
          <h2>{{ targetHandoffReceipt.title }}</h2>
          <p>{{ targetHandoffReceipt.boundary }}</p>
        </div>
        <div class="receipt-metrics" aria-label="Storyline target handoff receipt">
          <span>受众 {{ targetHandoffReceipt.audience }}</span>
          <span>{{ targetHandoffReceipt.handoff }}</span>
          <span>{{ targetHandoffReceipt.format }}</span>
          <span>切换目标会重置复核 / 复制</span>
        </div>
      </section>

      <section class="coverage-strip" aria-label="Storyline coverage">
        <div class="metric ok">
          <div class="label">Cited refs</div>
          <div class="value">{{ evidenceCount }}</div>
          <div class="sub">{{ evidenceClusterLabel }}</div>
        </div>
        <div class="metric ok">
          <div class="label">Story segments</div>
          <div class="value">{{ draft.segments.length }}</div>
          <div class="sub">timeline canvas</div>
        </div>
        <div :class="['metric', draft.gaps.length ? 'warn' : 'ok']">
          <div class="label">Gaps</div>
          <div class="value">{{ draft.gaps.length }}</div>
          <div class="sub">复制前需要确认</div>
        </div>
        <div :class="['metric', sendableScore >= 75 ? 'ok' : 'warn']">
          <div class="label">Sendable %</div>
          <div class="value">{{ sendableScore }}%</div>
          <div class="sub">基于 gaps / risk notes 粗略估计</div>
        </div>
      </section>

      <div class="draft-tabs" role="tablist" aria-label="当前草稿">
        <button class="draft-tab active" type="button">
          <div class="tab-meta">
            <span class="type-pill">{{ artifactLabel(draft.targetArtifact) }}</span>
            <span class="from">{{ sourceLabel }}</span>
          </div>
          <div class="tab-title">{{ draft.title }}</div>
          <div class="tab-foot">
            <span>{{ draft.segments.length }} 段</span>
            <span>{{ draft.audience }}</span>
          </div>
          <div class="bar"><span :style="{ width: `${sendableScore}%` }"></span></div>
        </button>
      </div>

      <section class="workspace">
        <section class="panel canvas-panel">
          <div class="panel-head">
            <div class="title">Storyline canvas</div>
            <div class="meta">
              {{ draft.segments.length }} 段 · {{ artifactLabel(draft.targetArtifact) }} · 手动复制
            </div>
          </div>

          <div class="canvas-head">
            <div>
              <h2>{{ draft.title }}</h2>
              <p class="audience">受众：{{ draft.audience }}</p>
              <div class="chip-row">
                <span class="chip green">{{ artifactLabel(draft.targetArtifact) }}</span>
                <span class="chip">{{ sourceLabel }}</span>
                <span class="chip purple">{{ evidenceCount }} refs</span>
                <span :class="['chip', draft.riskNotes.length ? 'amber' : 'green']">
                  {{ draft.riskNotes.length ? '需边界复核' : '低风险草稿' }}
                </span>
              </div>
            </div>
          </div>

          <div v-if="sourceClusters.length" class="cluster-strip">
            <div
              v-for="cluster in sourceClusters"
              :key="cluster.label"
              class="cluster"
            >
              <span>{{ cluster.label }}</span>
              <strong>{{ cluster.count }}</strong>
            </div>
          </div>

          <div class="canvas-body">
            <div class="timeline">
              <button
                v-for="(segment, index) in draft.segments"
                :key="`${segment.title}-${index}`"
                type="button"
                :class="['segment', { active: index === selectedIndex }]"
                :data-boundary="boundaryForSegment(index)"
                @click="selectedIndex = index"
              >
                <div class="row-meta">
                  <span>SEG {{ String(index + 1).padStart(2, '0') }}</span>
                  <span>{{ segment.evidenceIds.length }} refs</span>
                  <span>{{ boundaryLabel(index) }}</span>
                </div>
                <h3>{{ segment.title }}</h3>
                <p>{{ segment.narrative }}</p>
                <div class="seg-foot">
                  <span
                    v-for="evidenceId in segment.evidenceIds.slice(0, 4)"
                    :key="evidenceId"
                    class="chip neutral"
                  >
                    {{ shortEvidenceId(evidenceId) }}
                  </span>
                </div>
              </button>
            </div>
          </div>
        </section>

        <aside class="panel right-panel">
          <div class="panel-head">
            <div class="title">Inspector</div>
            <div class="meta">当前段落 · 证据 / 缺口 / 导出</div>
          </div>

          <div class="panel-body">
            <section class="inspector-section">
              <div class="label">Selected segment</div>
              <h3>{{ selectedSegment?.title || '未选择段落' }}</h3>
              <p class="body">{{ selectedSegment?.intent }}</p>
              <textarea
                class="draft-area"
                :value="selectedSegment?.narrative || ''"
                readonly
                aria-label="当前段落讲稿"
              ></textarea>
              <div
                :class="['grounding-summary', selectedGroundingState.tone]"
                role="status"
              >
                <div class="grounding-head">
                  <span>Grounding</span>
                  <strong>{{ selectedGroundingState.label }}</strong>
                </div>
                <p>{{ selectedGroundingState.detail }}</p>
                <div class="grounding-chips">
                  <span>{{ selectedEvidenceIds.length }} refs</span>
                  <span>{{ selectedEvidenceDetailCount }} 个详情</span>
                  <span>{{ selectedEvidenceSourceSummary }}</span>
                </div>
              </div>
            </section>

            <section class="inspector-section">
              <div class="label">Evidence · {{ selectedEvidence.length }} refs</div>
              <div v-if="selectedEvidence.length === 0" class="empty-note">
                当前段落没有可展示的证据详情。
              </div>
              <article
                v-for="evidence in selectedEvidence"
                :key="evidence.id"
                class="evidence"
              >
                <div class="row1">
                  <span class="source">{{ evidence.sourceLabel || evidence.type }}</span>
                  <span>{{ shortEvidenceId(evidence.id) }}</span>
                </div>
                <div class="evidence-title">
                  {{ evidence.sourceTitle || evidence.title || evidence.id }}
                </div>
                <div class="evidence-desc">{{ evidence.snippet }}</div>
                <div
                  v-if="
                    visibleEvidenceLinks(evidence).length ||
                    evidenceBlockedLabels(evidence).length
                  "
                  class="evidence-actions"
                >
                  <a
                    v-for="link in visibleEvidenceLinks(evidence)"
                    :key="`${evidence.id}:${link.href}`"
                    :href="link.href"
                    :target="link.external ? '_blank' : undefined"
                    :rel="link.external ? 'noopener noreferrer' : undefined"
                    @click="recordEvidenceSourceOpen(evidence, link)"
                  >
                    {{ link.label }}
                  </a>
                  <span
                    v-for="label in evidenceBlockedLabels(evidence)"
                    :key="`${evidence.id}:${label}`"
                    class="blocked-link"
                  >
                    {{ label }}
                  </span>
                </div>
              </article>
              <div
                v-if="sourceOpenReceipt"
                class="source-open-receipt"
                role="status"
                aria-live="polite"
              >
                <strong>来源打开回执</strong>
                <span>{{ sourceOpenReceipt.summary }}</span>
                <p>{{ sourceOpenReceipt.boundary }}</p>
              </div>
            </section>

            <section class="inspector-section">
              <div class="label">Draft grounding review</div>
              <div
                v-if="groundingReviewFindings.length === 0"
                class="grounding-review ok"
              >
                <strong>所有段落都有多证据支撑</strong>
                复制前仍建议按 Evidence key 核对关键事实和外发边界。
              </div>
              <div v-else class="grounding-review-summary">
                <strong>{{ groundingReviewFindings.length }} 段需要复核证据边界</strong>
                <span>复制前逐段检查单条证据、缺详情或未绑定证据的段落。</span>
              </div>
              <div class="segment-grounding-list">
                <button
                  v-for="item in segmentGroundingReviews"
                  :key="`grounding-${item.index}`"
                  type="button"
                  :class="['segment-grounding-item', item.tone, { active: item.index === selectedIndex }]"
                  @click="selectedIndex = item.index"
                >
                  <span>SEG {{ String(item.index + 1).padStart(2, '0') }}</span>
                  <strong>{{ item.label }}</strong>
                  <p>{{ item.detail }}</p>
                </button>
              </div>
            </section>

            <section class="inspector-section">
              <div class="label">Gaps & boundary</div>
              <div v-if="draft.gaps.length === 0 && draft.riskNotes.length === 0" class="gap ok">
                <strong>可先作为内部草稿使用</strong>
                复制前仍建议人工确认事实、时间和敏感内容。
              </div>
              <div v-for="gap in draft.gaps" :key="gap" class="gap">
                <strong>待确认</strong>
                {{ gap }}
              </div>
              <div v-for="note in draft.riskNotes" :key="note" class="gap risk">
                <strong>边界提醒</strong>
                {{ note }}
              </div>
            </section>

            <section class="inspector-section">
              <div class="label">Artifacts</div>
              <button
                v-for="option in artifactOptions"
                :key="option.id"
                :class="['artifact', { active: activeTarget === option.id }]"
                type="button"
                :aria-pressed="activeTarget === option.id ? 'true' : 'false'"
                :title="targetSwitchButtonBoundary(option.id)"
                :aria-label="targetSwitchButtonBoundary(option.id)"
                @click="setTarget(option.id)"
              >
                <div class="row">
                  <span class="name">{{ option.label }}</span>
                  <span class="size">{{ option.size }}</span>
                </div>
                <div class="desc">{{ option.description }}</div>
              </button>
            </section>
          </div>
        </aside>
      </section>

      <section class="panel artifact-output">
        <div class="panel-head">
          <div>
            <div class="title">{{ artifactLabel(draft.targetArtifact) }}</div>
            <div class="meta">只生成可复制草稿，不自动写回外部平台。</div>
          </div>
          <button
            class="btn primary"
            type="button"
            :disabled="!canCopyArtifact"
            :title="copyButtonTitle"
            @click="copyArtifact"
          >
            {{ copied ? '已复制' : '复制' }}
          </button>
        </div>
        <div
          v-if="requiresReviewBeforeCopy"
          :class="['review-gate', { ready: reviewAcknowledged }]"
        >
          <label>
            <input v-model="reviewAcknowledged" type="checkbox" />
            <span>
              已复核 {{ reviewAcknowledgementLabel }}
            </span>
          </label>
          <div
            v-if="copyReviewChecklist.length"
            class="review-checklist"
            aria-label="复制前复核清单"
          >
            <div class="review-checklist-head">
              <strong>复制前复核清单</strong>
              <span>{{ copyReviewChecklist.length }} 项</span>
            </div>
            <component
              :is="item.segmentIndex === undefined ? 'div' : 'button'"
              v-for="item in copyReviewChecklist"
              :key="item.id"
              :type="item.segmentIndex === undefined ? undefined : 'button'"
              :class="[
                'review-checklist-item',
                item.tone,
                {
                  actionable: item.segmentIndex !== undefined,
                  active: item.segmentIndex === selectedIndex,
                },
              ]"
              :aria-current="item.segmentIndex === selectedIndex ? 'true' : undefined"
              @click="selectReviewItem(item)"
            >
              <span>{{ item.label }}</span>
              <p>{{ item.detail }}</p>
            </component>
          </div>
          <p>
            Evidence refs 和 Evidence key 会随输出一起复制；外发前按当前段落证据、
            待确认项和边界提醒处理。
          </p>
        </div>
        <div
          v-if="copyReceipt"
          :class="['copy-receipt', { stale: copyReceiptIsStale }]"
          role="status"
          aria-live="polite"
        >
          <div class="copy-receipt-head">
            <strong>{{ copyReceiptTitle }}</strong>
            <span>{{ artifactLabel(copyReceipt.targetArtifact) }} · {{ copyReceipt.title }}</span>
          </div>
          <div class="copy-receipt-chips">
            <span>剪贴板快照 {{ copyReceipt.copiedAt }}</span>
            <span>引用 {{ copyReceipt.citedEvidenceCount }} refs</span>
            <span>返回详情 {{ copyReceipt.returnedEvidenceDetailCount }} 条</span>
            <span>{{ copyReceipt.reviewSummary }}</span>
          </div>
          <p v-if="copyReceiptIsStale">
            剪贴板仍是上一份 Storyline 输出；当前页面已经切到
            {{ draft ? artifactLabel(draft.targetArtifact) : '新的草稿状态' }}，交付前请重新复制。
          </p>
          <p>
            只复制到本机剪贴板；没有写回 Slides / Docs / RingCentral，没有发送消息，
            没有保存长期 Storyline 历史，也没有更新 Memory Service 证据状态。
          </p>
        </div>
        <textarea :value="draft.artifactText" readonly aria-label="完整输出草稿"></textarea>
        <p v-if="copyError" class="copy-status error" role="alert">
          {{ copyError }}
        </p>
      </section>
    </section>

    <section v-else class="state-panel empty">
      <div class="empty-kicker">Storyline draft</div>
      <h2>从证据来源进入故事线草稿</h2>
      <p>
        P0 不维护多草稿历史列表，也不会自动扫描生成。请从 Today Pilot 会前准备或资料记忆中的 Storyline seed 打开；所有输出都需要在本页复核后手动复制。
      </p>
      <div class="empty-flow">
        <span>来源提示</span>
        <span>生成故事线</span>
        <span>复核证据和风险</span>
        <span>复制到目标位置</span>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  getMemoryServiceClient,
  MemoryServiceError,
  type ComposerAssistEvidence,
  type StorylineDraftResponse,
  type StorylineSourceKind,
  type StorylineSuggestedArtifact,
} from '../../services/MemoryServiceClient';
import {
  getMemoryLinkSafetyState,
  normalizeMemorySourceUrl,
  sanitizeMemoryExploreRoute,
} from '../searchResultPresentation';

const route = useRoute();
const router = useRouter();
const client = getMemoryServiceClient();

const artifactOptions: Array<{
  id: StorylineSuggestedArtifact;
  label: string;
  shortLabel: string;
  size: string;
  description: string;
}> = [
  {
    id: 'speaker_notes',
    label: 'Speaker notes',
    shortLabel: '口播稿',
    size: '~700 字',
    description: '按段落组织，适合会前快速练习或直接复制给自己。',
  },
  {
    id: 'slides_outline',
    label: 'Slides outline',
    shortLabel: 'Slides',
    size: '5-7 页',
    description: '每页 bullets + speaker notes，证据 refs 保留在末尾。',
  },
  {
    id: 'ringcentral_post',
    label: 'RingCentral post',
    shortLabel: '分享帖',
    size: '~180 字',
    description: '短版 TL;DR + next step；默认避开 meeting URL 和私聊原文。',
  },
  {
    id: 'docs_brief',
    label: 'Docs brief',
    shortLabel: '简报',
    size: '1 页',
    description: '更适合沉淀到文档，保留背景、证据和待确认项。',
  },
];

interface EvidenceVisibleLink {
  label: string;
  href: string;
  external: boolean;
}

interface SegmentGroundingReview {
  index: number;
  tone: 'ok' | 'warn' | 'risk';
  label: string;
  detail: string;
  requiresReview: boolean;
}

interface SourceOpenReceipt {
  summary: string;
  boundary: string;
}

interface CopyReceipt {
  snapshotSignature: string;
  title: string;
  targetArtifact: StorylineSuggestedArtifact;
  copiedAt: string;
  citedEvidenceCount: number;
  returnedEvidenceDetailCount: number;
  reviewSummary: string;
}

interface CopyReviewChecklistItem {
  id: string;
  label: string;
  detail: string;
  tone: 'warn' | 'risk';
  segmentIndex?: number;
}

interface CachedDraftReadResult {
  draft: StorylineDraftResponse;
  cachedAt?: string;
}

interface SessionCacheReceipt {
  cachedAtLabel: string;
  targetArtifact: StorylineSuggestedArtifact;
}

interface DraftRequestReceipt {
  requestedAtLabel: string;
  targetArtifact: StorylineSuggestedArtifact;
  prepShortId: string;
}

interface RegenerateRequestReceipt {
  requestedAtLabel: string;
  targetArtifact: StorylineSuggestedArtifact;
  prepShortId: string;
}

interface TargetHandoffReceipt {
  title: string;
  audience: string;
  handoff: string;
  format: string;
  boundary: string;
}

const loading = ref(false);
const loadError = ref('');
const draft = ref<StorylineDraftResponse | null>(null);
const copied = ref(false);
const copyError = ref('');
const reviewAcknowledged = ref(false);
const selectedIndex = ref(0);
const sourceOpenReceipt = ref<SourceOpenReceipt | null>(null);
const copyReceipt = ref<CopyReceipt | null>(null);
const cacheHit = ref<{ cachedAt?: string } | null>(null);
const draftRequestReceipt = ref<DraftRequestReceipt | null>(null);
const regenerateRequestReceipt = ref<RegenerateRequestReceipt | null>(null);
let draftLoadToken = 0;

const pagePath = computed(() =>
  route.path === '/storylines' ? '/storylines' : '/storylines/draft',
);
const sourceKind = computed(() =>
  String(route.query.source || 'today_meeting_prep'),
);
const prepId = computed(() => String(route.query.prepId || '').trim());
const capsuleId = computed(() => String(route.query.capsuleId || '').trim());
const seedId = computed(() => String(route.query.seedId || '').trim());
const sourceRequestId = computed(() =>
  sourceKind.value === 'source_memory_seed'
    ? capsuleId.value && seedId.value
      ? `${capsuleId.value}:${seedId.value}`
      : ''
    : prepId.value,
);
const targetArtifact = computed(
  () => normalizeTargetArtifact(route.query.target) || 'speaker_notes',
);
const audienceHint = computed(() => String(route.query.audience || '').trim());
const activeTarget = computed(
  () => draft.value?.targetArtifact || targetArtifact.value,
);
const canRequestDraft = computed(
  () =>
    Boolean(sourceRequestId.value) &&
    isSupportedStorylineSourceKind(sourceKind.value),
);
const canReloadDraft = computed(() => canRequestDraft.value && !loading.value);
const cacheKey = computed(() =>
  [
    'pai.storylineDraft',
    sourceKind.value,
    sourceRequestId.value,
    targetArtifact.value,
    audienceHint.value || '',
  ].join(':'),
);
const sourceLabel = computed(() =>
  sourceKind.value === 'today_meeting_prep'
    ? 'Today Pilot 会前准备'
    : sourceKind.value === 'source_memory_seed'
      ? '资料记忆 Storyline seed'
      : sourceKind.value,
);
const prepShortId = computed(() => shortEvidenceId(sourceRequestId.value));
const selectedSegment = computed(
  () => draft.value?.segments[selectedIndex.value] ?? null,
);
const citedEvidenceIds = computed(() => {
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const segment of draft.value?.segments ?? []) {
    for (const rawId of segment.evidenceIds) {
      const id = String(rawId || '').trim();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      ids.push(id);
    }
  }
  return ids;
});
const selectedEvidenceIds = computed(() => {
  const segment = selectedSegment.value;
  if (!segment) return [];
  const seen = new Set<string>();
  return segment.evidenceIds
    .map((id) => String(id || '').trim())
    .filter(Boolean)
    .filter((id) => {
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
});
const evidenceById = computed(() => {
  const map = new Map<string, ComposerAssistEvidence>();
  for (const item of draft.value?.evidence ?? []) {
    map.set(item.id, item);
  }
  return map;
});
const selectedEvidence = computed(() => {
  const segment = selectedSegment.value;
  if (!segment) return [];
  return selectedEvidenceIds.value.map((id) => {
    return (
      evidenceById.value.get(id) || {
        id,
        type: 'chunk',
        title: id,
        snippet: '这条证据只返回了 ref id，原文可在来源记忆中继续查看。',
      }
    );
  });
});
const selectedEvidenceDetailCount = computed(
  () =>
    selectedEvidenceIds.value.filter((id) => evidenceById.value.has(id)).length,
);
const selectedEvidenceSourceLabels = computed(() => {
  const labels = selectedEvidenceIds.value.map((id) => {
    const item = evidenceById.value.get(id);
    return item ? item.sourceLabel || item.type || 'memory' : '仅 ref';
  });
  return Array.from(new Set(labels.filter(Boolean))).slice(0, 4);
});
const selectedEvidenceSourceSummary = computed(() => {
  const labels = selectedEvidenceSourceLabels.value;
  if (labels.length === 0) return '无来源';
  if (labels.length <= 2) return labels.join(' / ');
  return `${labels.slice(0, 2).join(' / ')} +${labels.length - 2}`;
});
const segmentGroundingReviews = computed<SegmentGroundingReview[]>(() =>
  (draft.value?.segments ?? []).map((segment, index) =>
    buildSegmentGroundingReview(segment, index),
  ),
);
const selectedGroundingReview = computed<SegmentGroundingReview>(() => {
  return (
    segmentGroundingReviews.value[selectedIndex.value] || {
      index: selectedIndex.value,
      tone: 'risk',
      label: '未选择段落',
      detail: '请选择一个故事线段落后再复核证据。',
      requiresReview: true,
    }
  );
});
const selectedGroundingState = computed<{
  tone: 'ok' | 'warn' | 'risk';
  label: string;
  detail: string;
}>(() => ({
  tone: selectedGroundingReview.value.tone,
  label: selectedGroundingReview.value.label,
  detail: selectedGroundingReview.value.detail,
}));
const groundingReviewFindings = computed(() =>
  segmentGroundingReviews.value.filter((item) => item.requiresReview),
);
const copyReviewChecklist = computed<CopyReviewChecklistItem[]>(() => {
  const items: CopyReviewChecklistItem[] = [];
  draft.value?.gaps.forEach((gap, index) => {
    items.push({
      id: `gap-${index}`,
      label: `待确认 ${index + 1}`,
      detail: gap,
      tone: 'warn',
    });
  });
  draft.value?.riskNotes.forEach((note, index) => {
    items.push({
      id: `risk-${index}`,
      label: `边界提醒 ${index + 1}`,
      detail: note,
      tone: 'risk',
    });
  });
  for (const item of groundingReviewFindings.value) {
    items.push({
      id: `segment-${item.index}`,
      label: `SEG ${String(item.index + 1).padStart(2, '0')} · ${item.label}`,
      detail: item.detail,
      tone: item.tone === 'risk' ? 'risk' : 'warn',
      segmentIndex: item.index,
    });
  }
  return items;
});
const evidenceCount = computed(() => {
  return citedEvidenceIds.value.length;
});
const returnedEvidenceDetailCount = computed(() => draft.value?.evidence?.length ?? 0);
const citedEvidenceMissingDetailCount = computed(
  () => citedEvidenceIds.value.filter((id) => !evidenceById.value.has(id)).length,
);
const sourceClusters = computed(() => {
  const counts = new Map<string, number>();
  for (const id of citedEvidenceIds.value) {
    const item = evidenceById.value.get(id);
    const key = item ? item.sourceLabel || item.type || 'memory' : '仅 ref';
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts, ([label, count]) => ({ label, count })).slice(0, 6);
});
const evidenceClusterLabel = computed(() => {
  if (sourceClusters.value.length === 0) return '当前草稿未引用证据';
  if (citedEvidenceMissingDetailCount.value > 0) {
    return `已引用 ${evidenceCount.value} refs · ${citedEvidenceMissingDetailCount.value} 条缺详情`;
  }
  return `已引用 ${evidenceCount.value} refs · 返回 ${returnedEvidenceDetailCount.value} 详情`;
});
const generationReceipt = computed(() => draft.value?.generationReceipt ?? null);
const generationModeLabel = computed(() => {
  const receipt = generationReceipt.value;
  if (!receipt) return '等待生成回执';
  return receipt.generationMode === 'fallback_cue_cards'
    ? 'Fallback 草稿，已重新绑定证据'
    : 'LLM 草稿，服务端已核对证据';
});
const generationReceiptBoundary = computed(() => {
  const receipt = generationReceipt.value;
  if (!receipt) return '';
  return [
    `${sourceLabel.value} · ${artifactLabel(receipt.targetArtifact)} · ${receipt.audience}`,
    '只生成可复制草稿，不写回 Slides / Docs / RingCentral，不保存长期 Storyline 历史，也不发送消息。',
  ].join('。');
});
const fallbackReceiptWarning = computed(() => {
  const receipt = generationReceipt.value;
  if (!receipt || receipt.generationMode !== 'fallback_cue_cards') return '';
  if (receipt.fallbackReason === 'llm_generation_failed') {
    return '服务端未拿到模型草稿，已回退到会前 cue cards：这份输出仍绑定 Evidence key，复制前重点复核事实和外发边界。';
  }
  return '服务端已回退到会前 cue cards：模型输出证据不足或引用无效，复制前按 Evidence key 复核。';
});
const sessionCacheReceipt = computed<SessionCacheReceipt | null>(() => {
  if (!cacheHit.value || !draft.value) return null;
  return {
    cachedAtLabel: formatCacheTimestamp(cacheHit.value.cachedAt),
    targetArtifact: draft.value.targetArtifact,
  };
});
const sessionCacheReceiptBoundary = computed(() => {
  if (!sessionCacheReceipt.value) return '';
  const draftSource =
    sourceKind.value === 'today_meeting_prep'
      ? '会前准备'
      : sourceKind.value === 'source_memory_seed'
        ? '资料记忆 seed'
        : '来源';
  return [
    `这次没有重新调用 Draft API，也没有重新读取${draftSource}、刷新证据详情、同步 Memory Service 或确认外发状态`,
    '如会议资料、证据或目标格式刚变化，请点重新生成后再复制',
  ].join('；');
});
const targetHandoffReceipt = computed<TargetHandoffReceipt | null>(() => {
  if (!draft.value) return null;
  const copy = targetHandoffCopy(draft.value.targetArtifact);
  const audience = firstNonEmptyString(
    draft.value.audience,
    generationReceipt.value?.audience,
    audienceHint.value,
    '待确认受众',
  );
  return {
    ...copy,
    audience,
    boundary: [
      `当前目标只决定本页生成格式：${copy.format}`,
      `面向 ${audience} 人工复核后交接`,
      '不会自动写回 Slides / Docs / RingCentral，不会发送消息，不会保存长期 Storyline 历史，也不会更新 Memory Service 证据状态',
    ].join('；'),
  };
});
const draftRequestReceiptBoundary = computed(() => {
  if (!draftRequestReceipt.value) return '';
  return [
    `这次只是从 ${sourceLabel.value} 请求一份 ${artifactLabel(draftRequestReceipt.value.targetArtifact)}草稿`,
    '还没有收到草稿、Evidence key、复制快照或外发确认',
    '不会写回 Slides / Docs / RingCentral，不会发送消息，也不会保存长期 Storyline 历史',
  ].join('；');
});
const regenerateRequestReceiptBoundary = computed(() => {
  if (!regenerateRequestReceipt.value) return '';
  return [
    '这次只清除本页 session 缓存并重新请求 Draft API',
    '不会写回 Slides / Docs / RingCentral，不会发送消息，不会保存长期 Storyline 历史，也不会沿用上一轮复核确认或复制回执',
  ].join('；');
});
const sendableScore = computed(() => {
  const gaps = draft.value?.gaps.length ?? 0;
  const risks = draft.value?.riskNotes.length ?? 0;
  return Math.max(45, Math.min(98, 92 - gaps * 8 - risks * 10));
});
const requiresReviewBeforeCopy = computed(() => {
  const gaps = draft.value?.gaps.length ?? 0;
  const risks = draft.value?.riskNotes.length ?? 0;
  return gaps + risks + groundingReviewFindings.value.length > 0;
});
const reviewRequirementParts = computed(() => {
  const gaps = draft.value?.gaps.length ?? 0;
  const risks = draft.value?.riskNotes.length ?? 0;
  const grounding = groundingReviewFindings.value.length;
  const parts: string[] = [];
  if (gaps > 0) parts.push(`${gaps} 个待确认`);
  if (risks > 0) parts.push(`${risks} 条边界提醒`);
  if (grounding > 0) parts.push(`${grounding} 段证据边界`);
  return parts;
});
const reviewAcknowledgementLabel = computed(() =>
  joinChineseParts(reviewRequirementParts.value),
);
const canCopyArtifact = computed(
  () =>
    canRequestDraft.value &&
    !loading.value &&
    !loadError.value &&
    Boolean(draft.value?.artifactText) &&
    (!requiresReviewBeforeCopy.value || reviewAcknowledged.value),
);
const copyGateReason = computed(() => {
  if (!canRequestDraft.value) return '';
  if (loading.value) return '正在生成，暂不能复制';
  if (loadError.value) return '生成失败，未复制旧草稿';
  if (!draft.value?.artifactText) return '';
  if (!requiresReviewBeforeCopy.value || reviewAcknowledged.value) return '';
  return `先复核 ${reviewAcknowledgementLabel.value}`;
});
const copyButtonTitle = computed(() =>
  copyGateReason.value || '复制当前 Storyline 输出',
);
const reloadButtonTitle = computed(() =>
  loading.value
    ? '正在等待当前 Draft API 回执，避免重复重新生成请求'
    : '清除本页 Storyline 缓存并重新请求 Draft API',
);
const copyReceiptIsStale = computed(() => {
  const receipt = copyReceipt.value;
  if (!receipt || !draft.value) return false;
  return receipt.snapshotSignature !== snapshotSignatureForDraft(draft.value);
});
const copyReceiptTitle = computed(() =>
  copyReceiptIsStale.value ? '旧复制回执' : '复制回执',
);

function normalizeTargetArtifact(
  value: unknown,
): StorylineSuggestedArtifact | undefined {
  const text = String(value || '').trim();
  if (
    text === 'speaker_notes' ||
    text === 'slides_outline' ||
    text === 'ringcentral_post' ||
    text === 'docs_brief'
  ) {
    return text;
  }
  return undefined;
}

function isSupportedStorylineSourceKind(
  value: string,
): value is StorylineSourceKind {
  return value === 'today_meeting_prep' || value === 'source_memory_seed';
}

function artifactLabel(target: StorylineSuggestedArtifact): string {
  const labels: Record<StorylineSuggestedArtifact, string> = {
    speaker_notes: 'Speaker Notes',
    slides_outline: 'Slides 提纲',
    ringcentral_post: 'RingCentral 分享帖',
    docs_brief: 'Docs 简报',
  };
  return labels[target];
}

function targetHandoffCopy(
  target: StorylineSuggestedArtifact,
): Omit<TargetHandoffReceipt, 'audience' | 'boundary'> {
  const copy: Record<
    StorylineSuggestedArtifact,
    Omit<TargetHandoffReceipt, 'audience' | 'boundary'>
  > = {
    speaker_notes: {
      title: 'Speaker Notes 手动练习稿',
      handoff: '手动带到讲稿 / 备注',
      format: '段落讲稿 + Evidence key',
    },
    slides_outline: {
      title: 'Slides 提纲交接稿',
      handoff: '手动复制到 Slides / PPT',
      format: '页结构 + speaker notes',
    },
    ringcentral_post: {
      title: 'RingCentral 分享帖交接稿',
      handoff: '手动复制到 RingCentral',
      format: '短 TL;DR + next step',
    },
    docs_brief: {
      title: 'Docs 简报交接稿',
      handoff: '手动复制到 Docs / 文档',
      format: '一页 brief + Evidence key',
    },
  };
  return copy[target];
}

function targetSwitchButtonBoundary(target: StorylineSuggestedArtifact): string {
  const label = artifactLabel(target);
  const handoff = targetHandoffCopy(target);
  const prep = prepShortId.value || '当前来源';
  const sourceReference =
    sourceKind.value === 'today_meeting_prep'
      ? '会前准备'
      : sourceKind.value === 'source_memory_seed'
        ? '资料记忆 seed'
        : '当前来源';
  const noWriteBoundary =
    '不会写回 Slides / Docs / RingCentral，不会发送消息，不会保存长期 Storyline 历史，也不会更新 Memory Service 证据状态';

  if (target === targetArtifact.value) {
    if (loading.value) {
      return `当前正在生成 ${label}；等待服务端证据回执期间不会重复请求、复制旧草稿或写回外部平台。${noWriteBoundary}。`;
    }
    return `当前已选择 ${label}（${handoff.format}）；点击不会重新请求 Draft API。输出目标只影响本页草稿和复制文本；${noWriteBoundary}。`;
  }

  const reviewReset = requiresReviewBeforeCopy.value
    ? `切换后会重置对 ${reviewAcknowledgementLabel.value} 的复核确认`
    : '切换后会重置复核确认';
  const copyReset = copyReceipt.value
    ? '已有剪贴板回执会变成旧复制回执，交付前需要重新复制'
    : '会清除当前复制状态';

  return [
    `切换到 ${label}（${handoff.format}），为${sourceReference} ${prep} 从本页缓存读取或请求 Storyline Draft API`,
    reviewReset,
    copyReset,
    '来源打开回执会回到当前草稿上下文',
    noWriteBoundary,
  ].join('；');
}

function shortEvidenceId(value: string | undefined): string {
  const text = String(value || '').trim();
  if (!text) return '';
  if (text.length <= 18) return text;
  return `${text.slice(0, 8)}...${text.slice(-6)}`;
}

function uniqueEvidenceIdsForSegment(
  segment: StorylineDraftResponse['segments'][number] | null | undefined,
): string[] {
  const seen = new Set<string>();
  return (segment?.evidenceIds ?? [])
    .map((id) => String(id || '').trim())
    .filter(Boolean)
    .filter((id) => {
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
}

function sourceLabelsForEvidenceIds(ids: string[]): string[] {
  const labels = ids.map((id) => {
    const item = evidenceById.value.get(id);
    return item ? item.sourceLabel || item.type || 'memory' : '仅 ref';
  });
  return Array.from(new Set(labels.filter(Boolean))).slice(0, 4);
}

function summarizeSourceLabels(labels: string[]): string {
  if (labels.length === 0) return '无来源';
  if (labels.length <= 2) return labels.join(' / ');
  return `${labels.slice(0, 2).join(' / ')} +${labels.length - 2}`;
}

function buildSegmentGroundingReview(
  segment: StorylineDraftResponse['segments'][number],
  index: number,
): SegmentGroundingReview {
  const evidenceIds = uniqueEvidenceIdsForSegment(segment);
  const refCount = evidenceIds.length;
  const detailCount = evidenceIds.filter((id) => evidenceById.value.has(id)).length;
  const missingCount = refCount - detailCount;
  const sourceLabels = sourceLabelsForEvidenceIds(evidenceIds);
  const sourceCount = sourceLabels.filter((label) => label !== '仅 ref').length;
  const sourceSummary = summarizeSourceLabels(sourceLabels);
  const prefix = `SEG ${String(index + 1).padStart(2, '0')}`;

  if (refCount === 0) {
    return {
      index,
      tone: 'risk',
      label: '未绑定证据',
      detail: `${prefix} 没有 evidence ref，不应作为可外发内容。`,
      requiresReview: true,
    };
  }
  if (detailCount === 0) {
    return {
      index,
      tone: 'warn',
      label: '只有 ref id',
      detail: `${prefix} 会把 ref id 复制出去，但页面缺少可点开的证据详情。`,
      requiresReview: true,
    };
  }
  if (missingCount > 0) {
    return {
      index,
      tone: 'warn',
      label: '证据详情不完整',
      detail: `${prefix} 有 ${missingCount} 条 ref 缺少详情，需要回到 Evidence key 核查。`,
      requiresReview: true,
    };
  }
  if (refCount >= 2 && sourceCount >= 2) {
    return {
      index,
      tone: 'ok',
      label: '多源支持',
      detail: `${prefix} 引用 ${refCount} 条 ref，覆盖 ${sourceCount} 类来源。`,
      requiresReview: false,
    };
  }
  if (refCount >= 2) {
    return {
      index,
      tone: 'warn',
      label: '单一来源',
      detail: `${prefix} 引用 ${refCount} 条 ref，但来源集中在 ${sourceSummary}。`,
      requiresReview: true,
    };
  }
  return {
    index,
    tone: 'warn',
    label: '单条证据',
    detail: `${prefix} 只有 1 条 ref，适合内部草稿，外发前重点复核。`,
    requiresReview: true,
  };
}

function joinChineseParts(parts: string[]): string {
  if (parts.length === 0) return '当前草稿证据和边界';
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]}和 ${parts[1]}`;
  return `${parts.slice(0, -1).join('、')}和 ${parts[parts.length - 1]}`;
}

function snapshotSignatureForDraft(value: StorylineDraftResponse): string {
  const text = value.artifactText || '';
  return [
    value.id,
    value.targetArtifact,
    text.length,
    text.slice(0, 96),
    text.slice(-96),
  ].join('|');
}

function buildCopyReceipt(value: StorylineDraftResponse): CopyReceipt {
  return {
    snapshotSignature: snapshotSignatureForDraft(value),
    title: value.title,
    targetArtifact: value.targetArtifact,
    copiedAt: new Date().toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }),
    citedEvidenceCount: citedEvidenceIds.value.length,
    returnedEvidenceDetailCount: returnedEvidenceDetailCount.value,
    reviewSummary: requiresReviewBeforeCopy.value
      ? `已复核 ${reviewAcknowledgementLabel.value}`
      : '当前草稿无强制复核项',
  };
}

function selectReviewItem(item: CopyReviewChecklistItem): void {
  if (item.segmentIndex === undefined) return;
  selectedIndex.value = item.segmentIndex;
}

function boundaryForSegment(
  index: number,
): 'shareable' | 'internal_only' | 'needs_redaction' {
  if (!draft.value) return 'shareable';
  if (
    draft.value.riskNotes.length > 0 &&
    index === draft.value.segments.length - 1
  ) {
    return 'needs_redaction';
  }
  if (draft.value.gaps.length > 0 && index >= draft.value.segments.length - 2) {
    return 'internal_only';
  }
  return 'shareable';
}

function boundaryLabel(index: number): string {
  const boundary = boundaryForSegment(index);
  if (boundary === 'needs_redaction') return 'needs redaction';
  if (boundary === 'internal_only') return 'internal';
  return 'shareable';
}

function visibleEvidenceLinks(
  evidence: ComposerAssistEvidence,
): EvidenceVisibleLink[] {
  const state = getMemoryLinkSafetyState({
    exploreLink: evidence.exploreLink,
    sourceUrl: evidence.sourceUrl,
  });
  const links: EvidenceVisibleLink[] = [];

  if (state.exploreRoute) {
    links.push({ label: '打开记忆', href: state.exploreRoute, external: false });
  }
  if (state.sourceUrl) {
    links.push({
      label: state.sourceHost ? `打开来源 · ${state.sourceHost}` : '打开来源',
      href: state.sourceUrl,
      external: true,
    });
  }

  for (const link of evidence.links ?? []) {
    const rawUrl = String(link.url || '').trim();
    const label = String(link.label || '').trim();
    const exploreRoute = sanitizeMemoryExploreRoute(rawUrl);
    if (exploreRoute) {
      links.push({
        label: label || '打开记忆',
        href: exploreRoute,
        external: false,
      });
      continue;
    }

    const sourceUrl = normalizeMemorySourceUrl(rawUrl);
    if (sourceUrl) {
      let host = '';
      try {
        host = new URL(sourceUrl).host;
      } catch {
        host = '';
      }
      links.push({
        label: label || (host ? `打开来源 · ${host}` : '打开来源'),
        href: sourceUrl,
        external: true,
      });
    }
  }

  const seen = new Set<string>();
  return links
    .filter((link) => {
      if (seen.has(link.href)) return false;
      seen.add(link.href);
      return true;
    })
    .slice(0, 3);
}

function evidenceBlockedLabels(evidence: ComposerAssistEvidence): string[] {
  const state = getMemoryLinkSafetyState({
    exploreLink: evidence.exploreLink,
    sourceUrl: evidence.sourceUrl,
  });
  const labels = [...state.blockedLabels];

  for (const link of evidence.links ?? []) {
    const rawUrl = String(link.url || '').trim();
    if (!rawUrl) continue;
    if (sanitizeMemoryExploreRoute(rawUrl) || normalizeMemorySourceUrl(rawUrl)) {
      continue;
    }
    const label = String(link.label || '补充链接').trim();
    labels.push(`${label}已隐藏：仅支持安全记忆路由或 http/https`);
  }

  return Array.from(new Set(labels)).slice(0, 3);
}

function recordEvidenceSourceOpen(
  evidence: ComposerAssistEvidence,
  link: EvidenceVisibleLink,
): void {
  if (!link.external) return;
  let host = '';
  try {
    host = new URL(link.href).host;
  } catch {
    host = '';
  }
  const title = firstNonEmptyString(
    evidence.sourceTitle,
    evidence.title,
    evidence.id,
  );
  const draftSource =
    sourceKind.value === 'today_meeting_prep'
      ? '会前准备'
      : sourceKind.value === 'source_memory_seed'
        ? '资料记忆 seed'
        : '当前 Storyline 来源';
  sourceOpenReceipt.value = {
    summary: `${host || '外部来源'} · ${title}`,
    boundary:
      `只在新标签打开这个来源；本页没有重新读取${draftSource}、刷新证据、同步 Memory Service、确认可外发、写回 Slides / Docs / RingCentral，也没有满足复制前复核。`,
  };
}

function firstNonEmptyString(
  ...values: Array<string | undefined | null>
): string {
  for (const value of values) {
    const text = String(value || '').trim();
    if (text) return text;
  }
  return '未命名证据';
}

function formatCacheTimestamp(value: string | undefined): string {
  if (!value) return '旧格式';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '旧格式';
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function formatReceiptTime(): string {
  return new Date().toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function buildDraftRequestReceipt(
  target: StorylineSuggestedArtifact,
  rawPrepId: string,
): DraftRequestReceipt {
  return {
    requestedAtLabel: formatReceiptTime(),
    targetArtifact: target,
    prepShortId: shortEvidenceId(rawPrepId) || 'unknown',
  };
}

function readCachedDraft(): CachedDraftReadResult | null {
  try {
    const raw = sessionStorage.getItem(cacheKey.value);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const record =
      parsed && typeof parsed === 'object'
        ? (parsed as { cachedAt?: unknown; draft?: unknown })
        : null;
    const cachedAt =
      typeof record?.cachedAt === 'string' ? record.cachedAt : undefined;
    const candidate =
      record?.draft && typeof record.draft === 'object'
        ? (record.draft as StorylineDraftResponse)
        : (parsed as StorylineDraftResponse);
    return candidate?.sourceKind === sourceKind.value &&
      candidate?.sourceId === sourceRequestId.value &&
      candidate?.targetArtifact === targetArtifact.value &&
      candidate?.generationReceipt?.boundary ===
        'draft_only_manual_copy_no_external_write'
      ? { draft: candidate, cachedAt }
      : null;
  } catch {
    return null;
  }
}

function writeCachedDraft(
  value: StorylineDraftResponse,
  storageKey = cacheKey.value,
): void {
  try {
    sessionStorage.setItem(
      storageKey,
      JSON.stringify({
        version: 1,
        cachedAt: new Date().toISOString(),
        draft: value,
      }),
    );
  } catch {
    // Session cache is best effort.
  }
}

async function loadDraft(options: { force?: boolean } = {}): Promise<void> {
  const loadToken = ++draftLoadToken;
  if (!sourceRequestId.value) {
    draft.value = null;
    loadError.value = '';
    loading.value = false;
    sourceOpenReceipt.value = null;
    cacheHit.value = null;
    draftRequestReceipt.value = null;
    regenerateRequestReceipt.value = null;
    return;
  }
  if (!options.force) {
    draftRequestReceipt.value = null;
    regenerateRequestReceipt.value = null;
  }
  const requestedSourceKind = sourceKind.value;
  if (!isSupportedStorylineSourceKind(requestedSourceKind)) {
    draft.value = null;
    loadError.value =
      `当前 Storyline Draft 只支持 Today Pilot 会前准备或资料记忆 Storyline seed（收到的来源：${requestedSourceKind}）。`;
    loading.value = false;
    copied.value = false;
    copyError.value = '';
    reviewAcknowledged.value = false;
    sourceOpenReceipt.value = null;
    cacheHit.value = null;
    draftRequestReceipt.value = null;
    regenerateRequestReceipt.value = null;
    return;
  }
  if (!options.force) {
    const cached = readCachedDraft();
    if (cached) {
      draft.value = cached.draft;
      selectedIndex.value = 0;
      loading.value = false;
      loadError.value = '';
      copied.value = false;
      copyError.value = '';
      reviewAcknowledged.value = false;
      sourceOpenReceipt.value = null;
      cacheHit.value = { cachedAt: cached.cachedAt };
      draftRequestReceipt.value = null;
      regenerateRequestReceipt.value = null;
      return;
    }
  }
  const requestCacheKey = cacheKey.value;
  const requestedSourceId = sourceRequestId.value;
  const requestedTarget = targetArtifact.value;
  const requestedAudience = audienceHint.value || undefined;
  draftRequestReceipt.value = options.force
    ? null
    : buildDraftRequestReceipt(requestedTarget, requestedSourceId);
  loading.value = true;
  loadError.value = '';
  copied.value = false;
  copyError.value = '';
  reviewAcknowledged.value = false;
  sourceOpenReceipt.value = null;
  cacheHit.value = null;
  try {
    const result = requestedSourceKind === 'source_memory_seed'
      ? await client.createStorylineDraft({
          sourceKind: 'source_memory_seed',
          capsuleId: capsuleId.value,
          seedId: seedId.value,
          targetArtifact: requestedTarget,
          audienceHint: requestedAudience,
        })
      : await client.createStorylineDraft({
          sourceKind: 'today_meeting_prep',
          prepId: prepId.value,
          targetArtifact: requestedTarget,
          audienceHint: requestedAudience,
        });
    if (loadToken !== draftLoadToken) return;
    if (result.targetArtifact !== requestedTarget) {
      throw new Error('storyline_target_mismatch');
    }
    draft.value = result;
    selectedIndex.value = 0;
    reviewAcknowledged.value = false;
    cacheHit.value = null;
    writeCachedDraft(result, requestCacheKey);
    draftRequestReceipt.value = null;
    regenerateRequestReceipt.value = null;
  } catch (error) {
    if (loadToken !== draftLoadToken) return;
    console.error('生成 Storyline draft 失败:', error);
    loadError.value =
      error instanceof Error && error.message === 'storyline_target_mismatch'
        ? '服务端返回的输出格式与当前选择不一致，请重新生成。'
        : formatDraftError(error);
    draftRequestReceipt.value = null;
    regenerateRequestReceipt.value = null;
  } finally {
    if (loadToken === draftLoadToken) {
      loading.value = false;
    }
  }
}

function formatDraftError(error: unknown): string {
  if (error instanceof MemoryServiceError) {
    const code = String(error.body?.error || '').trim();
    if (code === 'storyline_source_has_no_usable_evidence') {
      const draftSource =
        sourceKind.value === 'today_meeting_prep'
          ? '会前准备'
          : sourceKind.value === 'source_memory_seed'
            ? '资料记忆 seed'
            : '来源';
      return `这份${draftSource}没有可追溯的 evidence refs，暂时不能生成故事线草稿。`;
    }
    if (error.status === 404) {
      return '这份来源已过期、不存在或 seed 已失效，请回到来源详情重新打开。';
    }
    const detail = String(error.body?.detail || '').trim();
    return detail || error.message;
  }
  return error instanceof Error ? error.message : 'storyline_draft_failed';
}

function reloadDraft(): void {
  if (!canReloadDraft.value) return;
  sessionStorage.removeItem(cacheKey.value);
  copyReceipt.value = null;
  draftRequestReceipt.value = null;
  regenerateRequestReceipt.value = {
    requestedAtLabel: formatReceiptTime(),
    targetArtifact: targetArtifact.value,
    prepShortId: prepShortId.value || 'unknown',
  };
  void loadDraft({ force: true });
}

function setTarget(target: StorylineSuggestedArtifact): void {
  if (target === targetArtifact.value) return;
  void router.replace({
    query: {
      ...route.query,
      target,
    },
  });
}

async function copyArtifact(): Promise<void> {
  if (
    !canRequestDraft.value ||
    loading.value ||
    loadError.value ||
    !draft.value?.artifactText
  ) {
    copyError.value = '当前没有可复制的 Storyline 输出。';
    return;
  }
  if (!canCopyArtifact.value) {
    copyError.value = `请先复核 ${reviewAcknowledgementLabel.value}。`;
    return;
  }
  try {
    await writeClipboardText(draft.value.artifactText);
    copyError.value = '';
    copied.value = true;
    copyReceipt.value = buildCopyReceipt(draft.value);
    window.setTimeout(() => {
      copied.value = false;
    }, 1600);
  } catch (error) {
    console.warn('复制 Storyline artifact 失败:', error);
    copied.value = false;
    copyError.value = '复制失败，请手动选择下方文本复制。';
  }
}

async function writeClipboardText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Extension pages and file:// E2E contexts can deny navigator.clipboard.
    }
  }
  if (copyWithTextarea(text)) return;
  throw new Error('clipboard_unavailable');
}

function copyWithTextarea(text: string): boolean {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  textarea.style.top = '0';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  try {
    return document.execCommand('copy');
  } finally {
    textarea.remove();
  }
}

watch(
  () => [
    sourceKind.value,
    prepId.value,
    capsuleId.value,
    seedId.value,
    targetArtifact.value,
    audienceHint.value,
  ],
  () => {
    void loadDraft();
  },
  { immediate: true },
);

watch(selectedIndex, () => {
  sourceOpenReceipt.value = null;
});
</script>

<style scoped>
.storyline-page {
  --bg: #07111f;
  --panel: rgba(15, 23, 42, 0.72);
  --panel-soft: rgba(30, 41, 59, 0.46);
  --ink: #eef6ff;
  --ink-2: #cbd8e6;
  --muted: #8fa3bb;
  --line: rgba(148, 163, 184, 0.18);
  --line-strong: rgba(148, 163, 184, 0.32);
  --accent: #60a5fa;
  --accent-2: #a78bfa;
  --green: #34d399;
  --amber: #fbbf24;
  --red: #fb7185;
  min-height: 100%;
  padding: 18px;
  color: var(--ink);
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
  margin-bottom: 14px;
}

.page-copy {
  min-width: 0;
  max-width: 780px;
}

.page-eyebrow,
.label {
  color: var(--muted);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.page-header h1 {
  margin: 4px 0 6px;
  font-size: 28px;
  line-height: 1.2;
}

.page-header p {
  margin: 0;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.6;
}

.header-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
  max-width: 620px;
}

.copy-gate-chip {
  flex: 1 0 100%;
  border: 1px solid rgba(251, 191, 36, 0.32);
  border-radius: 8px;
  background: rgba(251, 191, 36, 0.08);
  color: #fde68a;
  padding: 7px 9px;
  font-size: 12px;
  font-weight: 800;
  line-height: 1.35;
  text-align: right;
}

.trigger-chip,
.chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
  border: 1px solid rgba(96, 165, 250, 0.28);
  border-radius: 999px;
  background: rgba(96, 165, 250, 0.12);
  color: var(--accent);
  padding: 5px 9px;
  font-size: 12px;
  font-weight: 700;
  overflow-wrap: anywhere;
}

.status-dot {
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: var(--green);
  box-shadow: 0 0 0 3px rgba(52, 211, 153, 0.16);
  flex: 0 0 auto;
}

.target-segmented {
  display: inline-flex;
  border: 1px solid var(--line-strong);
  border-radius: 8px;
  background: rgba(2, 6, 23, 0.32);
  padding: 3px;
}

.target-segmented button {
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--muted);
  padding: 5px 8px;
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
}

.target-segmented button.active {
  background: rgba(96, 165, 250, 0.18);
  color: var(--ink);
}

.btn {
  border: 1px solid transparent;
  border-radius: 8px;
  padding: 7px 11px;
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
}

.btn:disabled {
  cursor: not-allowed;
  opacity: 0.48;
}

.btn.primary {
  background: #2563eb;
  color: #fff;
}

.btn.ghost {
  border-color: var(--line-strong);
  background: rgba(15, 23, 42, 0.62);
  color: var(--ink-2);
}

.state-panel {
  display: grid;
  gap: 10px;
  align-items: center;
  justify-items: start;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--panel);
  padding: 18px;
  color: var(--ink-2);
}

.state-panel h2 {
  margin: 0;
}

.state-panel p {
  margin: 0;
  color: var(--muted);
}

.state-panel.error {
  border-color: rgba(248, 113, 113, 0.34);
}

.state-panel.empty {
  max-width: 820px;
  border-color: rgba(96, 165, 250, 0.28);
  background:
    linear-gradient(135deg, rgba(96, 165, 250, 0.1), transparent 48%),
    var(--panel);
}

.empty-kicker {
  border: 1px solid rgba(96, 165, 250, 0.28);
  border-radius: 999px;
  background: rgba(96, 165, 250, 0.1);
  color: var(--accent);
  padding: 4px 9px;
  font-size: 11px;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.empty-flow {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 4px;
}

.empty-flow span {
  border: 1px solid var(--line);
  border-radius: 8px;
  background: rgba(2, 6, 23, 0.3);
  color: var(--ink-2);
  padding: 7px 9px;
  font-size: 12px;
  font-weight: 800;
}

.storyline-workbench {
  display: grid;
  gap: 12px;
}

.generation-receipt,
.draft-request-receipt,
.session-cache-receipt,
.target-handoff-receipt,
.regenerate-request-receipt {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
  align-items: start;
  border: 1px solid rgba(96, 165, 250, 0.28);
  border-radius: 8px;
  background: rgba(14, 44, 74, 0.45);
  padding: 12px 14px;
}

.draft-request-receipt {
  width: 100%;
  box-sizing: border-box;
}

.session-cache-receipt {
  border-color: rgba(251, 191, 36, 0.32);
  background: rgba(74, 54, 14, 0.34);
}

.target-handoff-receipt {
  border-color: rgba(45, 212, 191, 0.28);
  background: rgba(19, 78, 74, 0.28);
}

.regenerate-request-receipt {
  width: 100%;
  box-sizing: border-box;
  border-color: rgba(167, 139, 250, 0.34);
  background: rgba(46, 16, 101, 0.28);
}

.session-cache-receipt .label,
.session-cache-receipt h2 {
  color: #fde68a;
}

.target-handoff-receipt .label,
.target-handoff-receipt h2 {
  color: #99f6e4;
}

.regenerate-request-receipt .label,
.regenerate-request-receipt h2 {
  color: #ddd6fe;
}

.receipt-copy h2 {
  margin: 3px 0 5px;
  font-size: 16px;
  line-height: 1.3;
}

.receipt-copy p,
.receipt-warning {
  margin: 0;
  color: var(--ink-2);
  font-size: 12px;
  line-height: 1.5;
}

.receipt-metrics {
  display: grid;
  grid-template-columns: repeat(2, minmax(118px, 1fr));
  gap: 6px;
  min-width: min(380px, 100%);
}

.receipt-metrics span {
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 8px;
  background: rgba(2, 6, 23, 0.26);
  color: var(--ink-2);
  padding: 7px 8px;
  font-size: 12px;
  font-weight: 800;
  line-height: 1.35;
}

.receipt-metrics span.warn,
.receipt-warning {
  color: #fde68a;
}

.receipt-warning {
  grid-column: 1 / -1;
  border-top: 1px solid rgba(251, 191, 36, 0.22);
  padding-top: 8px;
}

.coverage-strip {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.metric {
  border: 1px solid var(--line);
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.56);
  padding: 12px;
}

.metric .value {
  margin-top: 4px;
  font-size: 24px;
  font-weight: 900;
}

.metric .sub {
  margin-top: 3px;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.35;
}

.metric.ok .value {
  color: var(--green);
}

.metric.warn .value {
  color: var(--amber);
}

.draft-tabs {
  display: flex;
  gap: 10px;
  overflow-x: auto;
  padding-bottom: 2px;
}

.draft-tab {
  min-width: min(360px, 100%);
  border: 1px solid rgba(96, 165, 250, 0.38);
  border-radius: 8px;
  background: rgba(96, 165, 250, 0.08);
  color: inherit;
  padding: 10px;
  text-align: left;
}

.tab-meta,
.tab-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  color: var(--muted);
  font-size: 11px;
}

.type-pill {
  color: var(--accent);
  font-weight: 800;
}

.tab-title {
  margin-top: 6px;
  font-size: 14px;
  font-weight: 800;
  line-height: 1.35;
}

.bar {
  height: 3px;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.2);
  margin-top: 9px;
}

.bar span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--green), var(--accent));
}

.workspace {
  display: grid;
  grid-template-columns: minmax(0, 1.55fr) minmax(320px, 0.75fr);
  gap: 12px;
  align-items: start;
}

.panel {
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--panel);
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.22);
  overflow: hidden;
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  border-bottom: 1px solid var(--line);
  padding: 12px 14px;
}

.panel-head .title {
  font-size: 14px;
  font-weight: 900;
}

.panel-head .meta {
  color: var(--muted);
  font-size: 12px;
  line-height: 1.4;
}

.canvas-head {
  padding: 14px 14px 10px;
}

.canvas-head h2 {
  margin: 0;
  font-size: 20px;
  line-height: 1.3;
}

.audience {
  margin: 6px 0 0;
  color: var(--muted);
  font-size: 13px;
}

.chip-row,
.seg-foot {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 10px;
}

.chip.green {
  color: var(--green);
  background: rgba(52, 211, 153, 0.12);
  border-color: rgba(52, 211, 153, 0.28);
}

.chip.amber {
  color: var(--amber);
  background: rgba(251, 191, 36, 0.12);
  border-color: rgba(251, 191, 36, 0.32);
}

.chip.purple {
  color: var(--accent-2);
  background: rgba(167, 139, 250, 0.12);
  border-color: rgba(167, 139, 250, 0.28);
}

.chip.neutral {
  color: var(--muted);
  background: rgba(148, 163, 184, 0.1);
  border-color: var(--line-strong);
}

.cluster-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 0 14px 12px;
}

.cluster {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: rgba(2, 6, 23, 0.26);
  padding: 7px 9px;
  color: var(--ink-2);
  font-size: 12px;
}

.cluster strong {
  color: var(--accent);
}

.canvas-body {
  padding: 0 14px 14px;
}

.timeline {
  position: relative;
  display: grid;
  gap: 10px;
  padding-left: 24px;
}

.timeline::before {
  content: "";
  position: absolute;
  left: 8px;
  top: 8px;
  bottom: 8px;
  width: 2px;
  border-radius: 999px;
  background: linear-gradient(180deg, var(--accent), var(--accent-2), var(--red));
  opacity: 0.58;
}

.segment {
  position: relative;
  width: 100%;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.54);
  color: inherit;
  padding: 12px;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.18s ease, background 0.18s ease, transform 0.18s ease;
}

.segment::before {
  content: "";
  position: absolute;
  left: -22px;
  top: 18px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 0 0 3px var(--bg), 0 0 0 4px rgba(96, 165, 250, 0.28);
}

.segment[data-boundary="internal_only"]::before {
  background: var(--amber);
  box-shadow: 0 0 0 3px var(--bg), 0 0 0 4px rgba(251, 191, 36, 0.34);
}

.segment[data-boundary="needs_redaction"]::before {
  background: var(--red);
  box-shadow: 0 0 0 3px var(--bg), 0 0 0 4px rgba(251, 113, 133, 0.34);
}

.segment.active {
  border-color: rgba(96, 165, 250, 0.62);
  background: rgba(96, 165, 250, 0.08);
  transform: translateX(2px);
}

.row-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  color: var(--muted);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.segment h3 {
  margin: 7px 0 0;
  font-size: 16px;
  line-height: 1.35;
}

.segment p {
  margin: 7px 0 0;
  color: var(--ink-2);
  font-size: 13px;
  line-height: 1.58;
}

.right-panel {
  position: sticky;
  top: 12px;
  max-height: calc(100vh - 24px);
  display: flex;
  flex-direction: column;
}

.right-panel .panel-body {
  overflow-y: auto;
  min-height: 0;
}

.inspector-section {
  border-bottom: 1px solid var(--line);
  padding: 12px 14px;
}

.inspector-section:last-child {
  border-bottom: 0;
}

.inspector-section h3 {
  margin: 6px 0 0;
  font-size: 15px;
  line-height: 1.35;
}

.inspector-section .body {
  margin: 6px 0 0;
  color: var(--ink-2);
  font-size: 13px;
  line-height: 1.55;
}

.draft-area {
  box-sizing: border-box;
  width: 100%;
  min-height: 130px;
  margin-top: 10px;
  border: 1px solid var(--line-strong);
  border-radius: 8px;
  background: rgba(2, 6, 23, 0.42);
  color: var(--ink-2);
  padding: 10px;
  font: 12px/1.55 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  resize: vertical;
}

.grounding-summary {
  margin-top: 10px;
  border: 1px solid rgba(96, 165, 250, 0.3);
  border-radius: 8px;
  background: rgba(96, 165, 250, 0.08);
  padding: 9px;
}

.grounding-summary.warn {
  border-color: rgba(251, 191, 36, 0.34);
  background: rgba(251, 191, 36, 0.08);
}

.grounding-summary.risk {
  border-color: rgba(251, 113, 133, 0.34);
  background: rgba(251, 113, 133, 0.08);
}

.grounding-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  color: var(--muted);
  font-size: 11px;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.grounding-head strong {
  color: var(--green);
  letter-spacing: 0;
}

.grounding-summary.warn .grounding-head strong {
  color: var(--amber);
}

.grounding-summary.risk .grounding-head strong {
  color: var(--red);
}

.grounding-summary p {
  margin: 6px 0 0;
  color: var(--ink-2);
  font-size: 12px;
  line-height: 1.45;
}

.grounding-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}

.grounding-chips span {
  border: 1px solid var(--line);
  border-radius: 999px;
  background: rgba(2, 6, 23, 0.24);
  color: var(--muted);
  padding: 3px 7px;
  font-size: 11px;
  font-weight: 800;
}

.grounding-review,
.grounding-review-summary {
  margin-top: 8px;
  border: 1px solid rgba(251, 191, 36, 0.32);
  border-radius: 8px;
  background: rgba(251, 191, 36, 0.08);
  color: #fde68a;
  padding: 9px;
  font-size: 12px;
  line-height: 1.5;
}

.grounding-review.ok {
  border-color: rgba(52, 211, 153, 0.3);
  background: rgba(52, 211, 153, 0.08);
  color: #bbf7d0;
}

.grounding-review strong,
.grounding-review-summary strong {
  display: block;
}

.grounding-review-summary span {
  color: var(--ink-2);
}

.segment-grounding-list {
  display: grid;
  gap: 7px;
  margin-top: 8px;
}

.segment-grounding-item {
  width: 100%;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: rgba(2, 6, 23, 0.26);
  color: var(--ink-2);
  padding: 8px 9px;
  text-align: left;
  cursor: pointer;
}

.segment-grounding-item.active,
.segment-grounding-item:hover {
  border-color: rgba(96, 165, 250, 0.48);
  background: rgba(96, 165, 250, 0.08);
}

.segment-grounding-item.warn {
  border-color: rgba(251, 191, 36, 0.28);
}

.segment-grounding-item.risk {
  border-color: rgba(251, 113, 133, 0.34);
}

.segment-grounding-item span {
  display: inline-block;
  color: var(--muted);
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.08em;
}

.segment-grounding-item strong {
  display: block;
  margin-top: 3px;
  color: var(--green);
  font-size: 12px;
}

.segment-grounding-item.warn strong {
  color: var(--amber);
}

.segment-grounding-item.risk strong {
  color: var(--red);
}

.segment-grounding-item p {
  margin: 3px 0 0;
  color: var(--muted);
  font-size: 11px;
  line-height: 1.42;
}

.empty-note,
.evidence,
.gap,
.artifact {
  margin-top: 8px;
}

.empty-note {
  color: var(--muted);
  font-size: 12px;
}

.evidence {
  border: 1px solid var(--line);
  border-radius: 8px;
  background: rgba(2, 6, 23, 0.3);
  padding: 9px;
}

.evidence .row1 {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--muted);
  font-size: 11px;
}

.source {
  border-radius: 5px;
  background: rgba(96, 165, 250, 0.12);
  color: var(--accent);
  padding: 2px 6px;
  font-size: 10px;
  font-weight: 900;
  text-transform: uppercase;
}

.evidence-title {
  margin-top: 5px;
  color: var(--ink-2);
  font-size: 13px;
  font-weight: 800;
  overflow-wrap: anywhere;
}

.evidence-desc {
  margin-top: 5px;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.evidence-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}

.evidence-actions a,
.blocked-link {
  border: 1px solid rgba(96, 165, 250, 0.28);
  border-radius: 999px;
  padding: 3px 7px;
  color: var(--accent);
  font-size: 11px;
  font-weight: 800;
  text-decoration: none;
}

.evidence-actions a:hover {
  border-color: rgba(96, 165, 250, 0.56);
  background: rgba(96, 165, 250, 0.1);
}

.blocked-link {
  border-color: rgba(251, 191, 36, 0.28);
  color: #fde68a;
  background: rgba(251, 191, 36, 0.08);
}

.source-open-receipt {
  margin-top: 8px;
  border: 1px solid rgba(96, 165, 250, 0.32);
  border-radius: 8px;
  background: rgba(96, 165, 250, 0.08);
  color: var(--ink-2);
  padding: 9px;
  font-size: 12px;
  line-height: 1.48;
}

.source-open-receipt strong {
  display: block;
  color: var(--accent);
}

.source-open-receipt span {
  display: block;
  margin-top: 3px;
  font-weight: 800;
  overflow-wrap: anywhere;
}

.source-open-receipt p {
  margin: 5px 0 0;
  color: var(--muted);
}

.gap {
  border: 1px solid rgba(251, 191, 36, 0.32);
  border-radius: 8px;
  background: rgba(251, 191, 36, 0.08);
  color: #fde68a;
  padding: 9px;
  font-size: 12px;
  line-height: 1.5;
}

.gap.risk {
  border-color: rgba(251, 113, 133, 0.34);
  background: rgba(251, 113, 133, 0.08);
  color: #fecdd3;
}

.gap.ok {
  border-color: rgba(52, 211, 153, 0.3);
  background: rgba(52, 211, 153, 0.08);
  color: #bbf7d0;
}

.gap strong {
  display: block;
}

.artifact {
  width: 100%;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: rgba(2, 6, 23, 0.28);
  color: var(--ink-2);
  padding: 9px;
  text-align: left;
  cursor: pointer;
}

.artifact.active,
.artifact:hover {
  border-color: rgba(96, 165, 250, 0.44);
  background: rgba(96, 165, 250, 0.07);
}

.artifact .row {
  display: flex;
  justify-content: space-between;
  gap: 8px;
}

.artifact .name {
  font-size: 13px;
  font-weight: 800;
}

.artifact .size,
.artifact .desc {
  color: var(--muted);
  font-size: 11px;
}

.artifact .desc {
  margin-top: 5px;
  line-height: 1.45;
}

.artifact-output textarea {
  box-sizing: border-box;
  display: block;
  width: calc(100% - 28px);
  min-height: 260px;
  margin: 14px;
  resize: vertical;
  border: 1px solid var(--line-strong);
  border-radius: 8px;
  background: rgba(2, 6, 23, 0.56);
  color: var(--ink);
  padding: 12px;
  font: 13px/1.6 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.review-gate {
  margin: 12px 14px 0;
  border: 1px solid rgba(251, 191, 36, 0.32);
  border-radius: 8px;
  background: rgba(251, 191, 36, 0.08);
  padding: 10px 12px;
  color: #fde68a;
}

.review-gate.ready {
  border-color: rgba(52, 211, 153, 0.34);
  background: rgba(52, 211, 153, 0.08);
  color: #bbf7d0;
}

.review-gate label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 800;
}

.review-gate input {
  width: 16px;
  height: 16px;
  accent-color: var(--green);
  flex: 0 0 auto;
}

.review-gate p {
  margin: 6px 0 0 24px;
  color: var(--ink-2);
  font-size: 12px;
  line-height: 1.45;
}

.review-checklist {
  display: grid;
  gap: 7px;
  margin: 10px 0 0 24px;
}

.review-checklist-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  color: var(--muted);
  font-size: 11px;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.review-checklist-head strong {
  color: var(--ink);
}

.review-checklist-head span {
  border: 1px solid rgba(251, 191, 36, 0.28);
  border-radius: 999px;
  color: #fde68a;
  padding: 2px 7px;
  letter-spacing: 0;
  text-transform: none;
}

.review-checklist-item {
  width: 100%;
  border: 1px solid rgba(251, 191, 36, 0.28);
  border-radius: 8px;
  background: rgba(2, 6, 23, 0.2);
  color: var(--ink-2);
  padding: 8px 9px;
  text-align: left;
}

.review-checklist-item.actionable {
  cursor: pointer;
}

.review-checklist-item.actionable:hover,
.review-checklist-item.active {
  border-color: rgba(96, 165, 250, 0.52);
  background: rgba(96, 165, 250, 0.08);
}

.review-checklist-item.risk {
  border-color: rgba(251, 113, 133, 0.34);
}

.review-checklist-item span {
  display: block;
  color: var(--amber);
  font-size: 12px;
  font-weight: 900;
  line-height: 1.35;
}

.review-checklist-item.risk span {
  color: var(--red);
}

.review-checklist-item p {
  margin: 4px 0 0;
  color: var(--muted);
  font-size: 11px;
  line-height: 1.42;
}

.copy-receipt {
  margin: 12px 14px 0;
  border: 1px solid rgba(52, 211, 153, 0.32);
  border-radius: 8px;
  background: rgba(52, 211, 153, 0.08);
  color: var(--ink-2);
  padding: 10px 12px;
  font-size: 12px;
  line-height: 1.48;
}

.copy-receipt.stale {
  border-color: rgba(251, 191, 36, 0.36);
  background: rgba(251, 191, 36, 0.08);
}

.copy-receipt-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 7px;
}

.copy-receipt-head strong {
  color: var(--green);
  font-size: 13px;
}

.copy-receipt.stale .copy-receipt-head strong {
  color: var(--amber);
}

.copy-receipt-head span {
  font-weight: 800;
  overflow-wrap: anywhere;
}

.copy-receipt-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}

.copy-receipt-chips span {
  border: 1px solid var(--line);
  border-radius: 999px;
  background: rgba(2, 6, 23, 0.22);
  color: var(--muted);
  padding: 3px 7px;
  font-size: 11px;
  font-weight: 800;
}

.copy-receipt p {
  margin: 8px 0 0;
  color: var(--muted);
}

.copy-status {
  margin: -6px 14px 14px;
  color: var(--muted);
  font-size: 12px;
}

.copy-status.error {
  color: #fecdd3;
}

@media (max-width: 1120px) {
  .page-header,
  .workspace,
  .generation-receipt,
  .draft-request-receipt,
  .session-cache-receipt,
  .target-handoff-receipt,
  .regenerate-request-receipt {
    grid-template-columns: 1fr;
    display: grid;
  }

  .header-actions {
    justify-content: flex-start;
  }

  .copy-gate-chip {
    text-align: left;
  }

  .right-panel {
    position: static;
    max-height: none;
  }
}

@media (max-width: 760px) {
  .storyline-page {
    padding: 12px;
  }

  .coverage-strip {
    grid-template-columns: 1fr 1fr;
  }

  .receipt-metrics {
    grid-template-columns: 1fr;
    min-width: 0;
  }

  .target-segmented {
    width: 100%;
    overflow-x: auto;
  }

  .target-segmented button {
    flex: 1 0 auto;
  }
}
</style>
