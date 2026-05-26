<template>
  <div class="storyline-page">
    <header class="storyline-header">
      <div>
        <div class="storyline-eyebrow">Memory Storyline</div>
        <h1>{{ draft?.title || '故事线草稿' }}</h1>
        <p>
          {{
            draft
              ? `${artifactLabel(draft.targetArtifact)} · ${draft.audience}`
              : '从会前准备和相关记忆生成一份可人工复核的讲述材料。'
          }}
        </p>
      </div>
      <button class="secondary-btn" type="button" @click="reloadDraft">
        重新生成
      </button>
    </header>

    <section v-if="loadError" class="state-panel error">
      <h2>生成失败</h2>
      <p>{{ loadError }}</p>
    </section>

    <section v-else-if="loading" class="state-panel">
      <div class="loading-spinner"></div>
      <p>正在根据会前准备生成 Storyline draft...</p>
    </section>

    <section v-else-if="draft" class="storyline-grid">
      <main class="storyline-main">
        <section class="storyline-section">
          <div class="section-title">
            <h2>故事线段落</h2>
            <span>{{ draft.segments.length }} 段</span>
          </div>
          <article
            v-for="(segment, index) in draft.segments"
            :key="`${segment.title}-${index}`"
            class="segment"
          >
            <div class="segment-index">{{ index + 1 }}</div>
            <div class="segment-body">
              <h3>{{ segment.title }}</h3>
              <p class="intent">{{ segment.intent }}</p>
              <p>{{ segment.narrative }}</p>
              <div class="evidence-row">
                <span
                  v-for="evidenceId in segment.evidenceIds"
                  :key="evidenceId"
                  class="evidence-pill"
                >
                  {{ evidenceId }}
                </span>
              </div>
            </div>
          </article>
        </section>
      </main>

      <aside class="storyline-side">
        <section class="storyline-section">
          <div class="section-title">
            <h2>待确认</h2>
            <span>{{ draft.gaps.length }}</span>
          </div>
          <p v-if="draft.gaps.length === 0" class="muted">
            当前草稿没有额外待确认项。
          </p>
          <ul v-else>
            <li v-for="gap in draft.gaps" :key="gap">{{ gap }}</li>
          </ul>
        </section>

        <section class="storyline-section">
          <div class="section-title">
            <h2>风险边界</h2>
            <span>{{ draft.riskNotes.length }}</span>
          </div>
          <p v-if="draft.riskNotes.length === 0" class="muted">
            未发现明显外发风险，仍建议复制前人工复核。
          </p>
          <ul v-else>
            <li v-for="note in draft.riskNotes" :key="note">{{ note }}</li>
          </ul>
        </section>
      </aside>

      <section class="artifact-panel">
        <div class="section-title">
          <h2>{{ artifactLabel(draft.targetArtifact) }}</h2>
          <button class="primary-btn" type="button" @click="copyArtifact">
            {{ copied ? '已复制' : '复制' }}
          </button>
        </div>
        <textarea :value="draft.artifactText" readonly></textarea>
      </section>
    </section>

    <section v-else class="state-panel error">
      <h2>缺少来源</h2>
      <p>需要从会前准备入口打开，并带上 prepId。</p>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import {
  getMemoryServiceClient,
  type StorylineDraftResponse,
  type StorylineSuggestedArtifact,
} from '../../services/MemoryServiceClient';

const route = useRoute();
const client = getMemoryServiceClient();

const loading = ref(false);
const loadError = ref('');
const draft = ref<StorylineDraftResponse | null>(null);
const copied = ref(false);

const sourceKind = computed(() =>
  String(route.query.source || 'today_meeting_prep'),
);
const prepId = computed(() => String(route.query.prepId || '').trim());
const targetArtifact = computed(() =>
  normalizeTargetArtifact(route.query.target),
);
const audienceHint = computed(() => String(route.query.audience || '').trim());
const cacheKey = computed(() =>
  [
    'pai.storylineDraft',
    sourceKind.value,
    prepId.value,
    targetArtifact.value || '',
    audienceHint.value || '',
  ].join(':'),
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

function readCachedDraft(): StorylineDraftResponse | null {
  try {
    const raw = sessionStorage.getItem(cacheKey.value);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StorylineDraftResponse;
    return parsed?.sourceId === prepId.value ? parsed : null;
  } catch {
    return null;
  }
}

function writeCachedDraft(value: StorylineDraftResponse): void {
  try {
    sessionStorage.setItem(cacheKey.value, JSON.stringify(value));
  } catch {
    // Session cache is best effort.
  }
}

async function loadDraft(options: { force?: boolean } = {}): Promise<void> {
  if (!prepId.value) {
    draft.value = null;
    loadError.value = '';
    return;
  }
  if (!options.force) {
    const cached = readCachedDraft();
    if (cached) {
      draft.value = cached;
      return;
    }
  }
  loading.value = true;
  loadError.value = '';
  copied.value = false;
  try {
    const result = await client.createStorylineDraft({
      sourceKind: 'today_meeting_prep',
      prepId: prepId.value,
      targetArtifact: targetArtifact.value,
      audienceHint: audienceHint.value || undefined,
    });
    draft.value = result;
    writeCachedDraft(result);
  } catch (error) {
    console.error('生成 Storyline draft 失败:', error);
    loadError.value =
      error instanceof Error ? error.message : 'storyline_draft_failed';
  } finally {
    loading.value = false;
  }
}

function reloadDraft(): void {
  sessionStorage.removeItem(cacheKey.value);
  void loadDraft({ force: true });
}

async function copyArtifact(): Promise<void> {
  if (!draft.value?.artifactText) return;
  await navigator.clipboard.writeText(draft.value.artifactText);
  copied.value = true;
  window.setTimeout(() => {
    copied.value = false;
  }, 1600);
}

onMounted(() => {
  void loadDraft();
});
</script>

<style scoped>
.storyline-page {
  min-height: 100%;
  padding: 24px;
  color: #e5edf7;
}

.storyline-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
}

.storyline-eyebrow {
  color: #64d2ff;
  font-size: 12px;
  font-weight: 800;
  text-transform: uppercase;
}

.storyline-header h1 {
  margin: 4px 0 6px;
  font-size: 28px;
  line-height: 1.2;
}

.storyline-header p {
  margin: 0;
  color: #a9b7c7;
  max-width: 720px;
}

.storyline-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.6fr) minmax(260px, 0.8fr);
  gap: 16px;
}

.storyline-main,
.storyline-side {
  display: grid;
  gap: 16px;
}

.storyline-section,
.artifact-panel,
.state-panel {
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.72);
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.22);
}

.storyline-section,
.state-panel {
  padding: 16px;
}

.section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.section-title h2 {
  margin: 0;
  font-size: 16px;
}

.section-title span {
  color: #93c5fd;
  font-size: 12px;
  font-weight: 800;
}

.segment {
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr);
  gap: 12px;
  padding: 14px 0;
  border-top: 1px solid rgba(148, 163, 184, 0.18);
}

.segment:first-of-type {
  border-top: 0;
  padding-top: 0;
}

.segment-index {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border-radius: 8px;
  background: #0f766e;
  color: #ecfeff;
  font-weight: 800;
}

.segment-body h3 {
  margin: 0 0 6px;
  font-size: 15px;
}

.segment-body p {
  margin: 0 0 8px;
  color: #d5deea;
  line-height: 1.55;
}

.segment-body .intent {
  color: #93c5fd;
  font-size: 12px;
  font-weight: 700;
}

.evidence-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.evidence-pill {
  border: 1px solid rgba(147, 197, 253, 0.36);
  border-radius: 999px;
  padding: 3px 8px;
  color: #bfdbfe;
  font-size: 11px;
  max-width: 100%;
  overflow-wrap: anywhere;
}

.artifact-panel {
  grid-column: 1 / -1;
  padding: 16px;
}

.artifact-panel textarea {
  box-sizing: border-box;
  width: 100%;
  min-height: 280px;
  resize: vertical;
  border: 1px solid rgba(148, 163, 184, 0.28);
  border-radius: 8px;
  padding: 14px;
  background: rgba(2, 6, 23, 0.72);
  color: #e5edf7;
  font: 13px/1.6 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
    monospace;
}

.primary-btn,
.secondary-btn {
  border-radius: 8px;
  border: 1px solid transparent;
  padding: 8px 12px;
  font-weight: 800;
  cursor: pointer;
}

.primary-btn {
  background: #2563eb;
  color: #fff;
}

.secondary-btn {
  background: rgba(15, 23, 42, 0.68);
  border-color: rgba(148, 163, 184, 0.36);
  color: #dbeafe;
}

.state-panel {
  display: grid;
  gap: 10px;
  align-items: center;
  justify-items: start;
  color: #cbd5e1;
}

.state-panel h2 {
  margin: 0;
}

.state-panel p,
.muted,
li {
  color: #a9b7c7;
  line-height: 1.55;
}

.state-panel.error {
  border-color: rgba(248, 113, 113, 0.32);
}

.storyline-section ul {
  margin: 0;
  padding-left: 18px;
}

@media (max-width: 920px) {
  .storyline-page {
    padding: 16px;
  }

  .storyline-header,
  .storyline-grid {
    grid-template-columns: 1fr;
  }

  .storyline-header {
    display: grid;
  }
}
</style>
