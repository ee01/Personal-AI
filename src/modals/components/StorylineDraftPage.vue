<template>
  <div class="storyline-page">
    <header class="page-header">
      <div class="page-copy">
        <div class="page-eyebrow">memory-exploring · {{ pagePath }}</div>
        <h1>故事线编排器</h1>
        <p>
          把会前准备、会议记录和相关记忆编排成可讲述草稿。生成稿不会自动外发，只在这里复核、切换输出格式和复制。
        </p>
      </div>

      <div class="header-actions">
        <span class="trigger-chip">
          <span class="status-dot"></span>
          {{ prepId ? `${sourceLabel} · ${prepShortId}` : '等待会前准备入口' }}
        </span>
        <div
          v-if="prepId"
          class="target-segmented"
          role="group"
          aria-label="输出格式"
        >
          <button
            v-for="option in artifactOptions"
            :key="option.id"
            type="button"
            :class="{ active: activeTarget === option.id }"
            @click="setTarget(option.id)"
          >
            {{ option.shortLabel }}
          </button>
        </div>
        <button v-if="prepId" class="btn ghost" type="button" @click="reloadDraft">
          重新生成
        </button>
        <button
          v-if="prepId"
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
      <p>正在根据会前准备生成 Storyline draft...</p>
    </section>

    <section v-else-if="draft" class="storyline-workbench">
      <section class="coverage-strip" aria-label="Storyline coverage">
        <div class="metric ok">
          <div class="label">Evidence refs</div>
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
                    :rel="link.external ? 'noreferrer' : undefined"
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
              已复核 {{ draft.gaps.length }} 个待确认和 {{ draft.riskNotes.length }} 条边界提醒
            </span>
          </label>
          <p>Evidence refs 和 Evidence key 会随输出一起复制；外发前按当前边界处理。</p>
        </div>
        <textarea :value="draft.artifactText" readonly aria-label="完整输出草稿"></textarea>
        <p v-if="copyError" class="copy-status error" role="alert">
          {{ copyError }}
        </p>
      </section>
    </section>

    <section v-else class="state-panel empty">
      <div class="empty-kicker">Storyline draft</div>
      <h2>从会前准备进入故事线草稿</h2>
      <p>
        P0 不维护多草稿历史列表，也不会自动扫描生成。打开 RingCentral Video Home 的 Today Pilot 会前准备卡片，只有当 LLM 判断这场会议值得沉淀为分享、汇报或复盘时，才会出现生成入口。
      </p>
      <div class="empty-flow">
        <span>会前准备提示</span>
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

const loading = ref(false);
const loadError = ref('');
const draft = ref<StorylineDraftResponse | null>(null);
const copied = ref(false);
const copyError = ref('');
const reviewAcknowledged = ref(false);
const selectedIndex = ref(0);
let draftLoadToken = 0;

const pagePath = computed(() =>
  route.path === '/storylines' ? '/storylines' : '/storylines/draft',
);
const sourceKind = computed(() =>
  String(route.query.source || 'today_meeting_prep'),
);
const prepId = computed(() => String(route.query.prepId || '').trim());
const targetArtifact = computed(
  () => normalizeTargetArtifact(route.query.target) || 'speaker_notes',
);
const audienceHint = computed(() => String(route.query.audience || '').trim());
const activeTarget = computed(
  () => draft.value?.targetArtifact || targetArtifact.value,
);
const cacheKey = computed(() =>
  [
    'pai.storylineDraft',
    sourceKind.value,
    prepId.value,
    targetArtifact.value,
    audienceHint.value || '',
  ].join(':'),
);
const sourceLabel = computed(() =>
  sourceKind.value === 'today_meeting_prep'
    ? 'Today Pilot 会前准备'
    : sourceKind.value,
);
const prepShortId = computed(() => shortEvidenceId(prepId.value));
const selectedSegment = computed(
  () => draft.value?.segments[selectedIndex.value] ?? null,
);
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
const selectedEvidenceMissingCount = computed(
  () => selectedEvidenceIds.value.length - selectedEvidenceDetailCount.value,
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
const selectedGroundingState = computed<{
  tone: 'ok' | 'warn' | 'risk';
  label: string;
  detail: string;
}>(() => {
  if (!selectedSegment.value) {
    return {
      tone: 'risk',
      label: '未选择段落',
      detail: '请选择一个故事线段落后再复核证据。',
    };
  }

  const refCount = selectedEvidenceIds.value.length;
  const detailCount = selectedEvidenceDetailCount.value;
  const missingCount = selectedEvidenceMissingCount.value;
  const sourceCount = selectedEvidenceSourceLabels.value.filter(
    (label) => label !== '仅 ref',
  ).length;

  if (refCount === 0) {
    return {
      tone: 'risk',
      label: '未绑定证据',
      detail: '当前段落没有 evidence ref，不应作为可外发内容。',
    };
  }
  if (detailCount === 0) {
    return {
      tone: 'warn',
      label: '只有 ref id',
      detail: '复制文本会保留 ref id，但页面缺少可点开的证据详情。',
    };
  }
  if (missingCount > 0) {
    return {
      tone: 'warn',
      label: '证据详情不完整',
      detail: `${missingCount} 条 ref 缺少详情，复制前需要回到 Evidence key 核查。`,
    };
  }
  if (refCount >= 2 && sourceCount >= 2) {
    return {
      tone: 'ok',
      label: '多源支持',
      detail: `当前段落引用 ${refCount} 条 ref，覆盖 ${sourceCount} 类来源。`,
    };
  }
  if (refCount >= 2) {
    return {
      tone: 'ok',
      label: '多条证据',
      detail: `当前段落引用 ${refCount} 条 ref，来源集中在 ${selectedEvidenceSourceSummary.value}。`,
    };
  }
  return {
    tone: 'warn',
    label: '单条证据',
    detail: '当前段落只有 1 条 ref，适合内部草稿，外发前重点复核。',
  };
});
const evidenceCount = computed(() => {
  if (draft.value?.evidence?.length) return draft.value.evidence.length;
  const segmentEvidenceIds =
    draft.value?.segments.flatMap((segment) => segment.evidenceIds) ?? [];
  return new Set(segmentEvidenceIds).size;
});
const sourceClusters = computed(() => {
  const counts = new Map<string, number>();
  for (const item of draft.value?.evidence ?? []) {
    const key = item.sourceLabel || item.type || 'memory';
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts, ([label, count]) => ({ label, count })).slice(0, 6);
});
const evidenceClusterLabel = computed(() => {
  if (sourceClusters.value.length === 0) return '来自 segment refs';
  return `来自 ${sourceClusters.value.length} 类来源`;
});
const sendableScore = computed(() => {
  const gaps = draft.value?.gaps.length ?? 0;
  const risks = draft.value?.riskNotes.length ?? 0;
  return Math.max(45, Math.min(98, 92 - gaps * 8 - risks * 10));
});
const requiresReviewBeforeCopy = computed(() => {
  const gaps = draft.value?.gaps.length ?? 0;
  const risks = draft.value?.riskNotes.length ?? 0;
  return gaps + risks > 0;
});
const canCopyArtifact = computed(
  () =>
    Boolean(draft.value?.artifactText) &&
    (!requiresReviewBeforeCopy.value || reviewAcknowledged.value),
);
const copyGateReason = computed(() => {
  if (!draft.value?.artifactText) return '';
  if (!requiresReviewBeforeCopy.value || reviewAcknowledged.value) return '';
  return `先复核 ${draft.value.gaps.length} 个待确认和 ${draft.value.riskNotes.length} 条边界提醒`;
});
const copyButtonTitle = computed(() =>
  copyGateReason.value || '复制当前 Storyline 输出',
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

function artifactLabel(target: StorylineSuggestedArtifact): string {
  const labels: Record<StorylineSuggestedArtifact, string> = {
    speaker_notes: 'Speaker Notes',
    slides_outline: 'Slides 提纲',
    ringcentral_post: 'RingCentral 分享帖',
    docs_brief: 'Docs 简报',
  };
  return labels[target];
}

function shortEvidenceId(value: string | undefined): string {
  const text = String(value || '').trim();
  if (!text) return '';
  if (text.length <= 18) return text;
  return `${text.slice(0, 8)}...${text.slice(-6)}`;
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

function readCachedDraft(): StorylineDraftResponse | null {
  try {
    const raw = sessionStorage.getItem(cacheKey.value);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StorylineDraftResponse;
    return parsed?.sourceId === prepId.value &&
      parsed?.targetArtifact === targetArtifact.value
      ? parsed
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
    sessionStorage.setItem(storageKey, JSON.stringify(value));
  } catch {
    // Session cache is best effort.
  }
}

async function loadDraft(options: { force?: boolean } = {}): Promise<void> {
  const loadToken = ++draftLoadToken;
  if (!prepId.value) {
    draft.value = null;
    loadError.value = '';
    loading.value = false;
    return;
  }
  if (!options.force) {
    const cached = readCachedDraft();
    if (cached) {
      draft.value = cached;
      selectedIndex.value = 0;
      loading.value = false;
      loadError.value = '';
      copied.value = false;
      copyError.value = '';
      reviewAcknowledged.value = false;
      return;
    }
  }
  const requestCacheKey = cacheKey.value;
  const requestedPrepId = prepId.value;
  const requestedTarget = targetArtifact.value;
  const requestedAudience = audienceHint.value || undefined;
  loading.value = true;
  loadError.value = '';
  copied.value = false;
  copyError.value = '';
  reviewAcknowledged.value = false;
  try {
    const result = await client.createStorylineDraft({
      sourceKind: 'today_meeting_prep',
      prepId: requestedPrepId,
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
    writeCachedDraft(result, requestCacheKey);
  } catch (error) {
    if (loadToken !== draftLoadToken) return;
    console.error('生成 Storyline draft 失败:', error);
    loadError.value =
      error instanceof Error && error.message === 'storyline_target_mismatch'
        ? '服务端返回的输出格式与当前选择不一致，请重新生成。'
        : formatDraftError(error);
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
      return '这份会前准备没有可追溯的 evidence refs，暂时不能生成故事线草稿。';
    }
    if (error.status === 404) {
      return '这份会前准备已过期或不存在，请回到 Today Pilot 重新生成会前准备。';
    }
    const detail = String(error.body?.detail || '').trim();
    return detail || error.message;
  }
  return error instanceof Error ? error.message : 'storyline_draft_failed';
}

function reloadDraft(): void {
  sessionStorage.removeItem(cacheKey.value);
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
  if (!draft.value?.artifactText) return;
  if (!canCopyArtifact.value) {
    copyError.value = '请先复核待确认项和边界提醒。';
    return;
  }
  try {
    await writeClipboardText(draft.value.artifactText);
    copyError.value = '';
    copied.value = true;
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
  () => [prepId.value, targetArtifact.value, audienceHint.value],
  () => {
    void loadDraft();
  },
  { immediate: true },
);
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
  .workspace {
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

  .target-segmented {
    width: 100%;
    overflow-x: auto;
  }

  .target-segmented button {
    flex: 1 0 auto;
  }
}
</style>
