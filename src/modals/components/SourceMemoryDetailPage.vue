<template>
  <div class="source-memory-page">
    <button class="back-link" type="button" @click="goBack">← 返回</button>

    <section v-if="loading" class="state-panel">正在读取资料记忆...</section>

    <section v-else-if="errorMessage" class="state-panel error">
      <h2>资料记忆不可用</h2>
      <p>{{ errorMessage }}</p>
      <div class="error-boundary-receipt" role="note">
        <strong>详情读取失败回执</strong>
        <p>
          本次只是在读取资料详情时失败，没有创建、撤销、更新备注、写入 web 检索信号或同步外部系统。
        </p>
      </div>
      <div class="state-actions">
        <button type="button" @click="loadCapsule">重试</button>
        <button type="button" class="secondary-state-action" @click="goBack">
          返回时间轴
        </button>
      </div>
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
            :title="openSourceBoundaryText"
            :aria-label="openSourceBoundaryText"
            @click="openSource"
          >
            打开来源
          </button>
          <router-link
            v-if="linkedMemoryAvailable"
            class="secondary-action"
            :to="timelineRoute"
            :title="linkedMemoryBoundaryText"
            :aria-label="linkedMemoryBoundaryText"
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

      <section
        :class="['recall-boundary-panel', recallBoundaryTone]"
        role="note"
      >
        <strong>{{ recallBoundaryTitle }}</strong>
        <p>{{ recallBoundaryText }}</p>
      </section>

      <section v-if="actionReceipt" class="source-action-panel" role="note">
        <div class="source-action-head">
          <div>
            <p class="eyebrow">最近操作回执</p>
            <h2>{{ actionReceipt.label }}</h2>
          </div>
          <span v-if="actionOccurredAt" class="source-action-time">
            {{ actionOccurredAt }}
          </span>
        </div>
        <p>{{ actionReceipt.detail }}</p>
        <div v-if="actionEvidence.length" class="source-action-evidence">
          <span
            v-for="item in actionEvidence"
            :key="item"
            class="source-action-chip"
          >
            {{ item }}
          </span>
        </div>
        <p v-if="actionReceipt.nextStep" class="source-action-next">
          {{ actionReceipt.nextStep }}
        </p>
      </section>

      <section :class="['distillation-panel', distillationTone]" role="note">
        <div class="distillation-head">
          <div>
            <p class="eyebrow">资料蒸馏回执</p>
            <h2>{{ distillationPolicyLabel }}</h2>
          </div>
          <span class="distillation-badge">
            {{ distillationStatusLabel }}
          </span>
        </div>
        <p class="distillation-detail">{{ distillationPolicyDetail }}</p>

        <dl class="distillation-summary">
          <div v-if="distillationOneLineCue">
            <dt>一行提示</dt>
            <dd>{{ distillationOneLineCue }}</dd>
          </div>
          <div v-if="distillationSourceReliability">
            <dt>来源可信度</dt>
            <dd>{{ distillationSourceReliability }}</dd>
          </div>
          <div v-if="distillationGeneratedAt">
            <dt>生成时间</dt>
            <dd>{{ distillationGeneratedAt }}</dd>
          </div>
          <div v-if="distillationSourceAsOf">
            <dt>来源快照</dt>
            <dd>{{ distillationSourceAsOf }}</dd>
          </div>
          <div v-if="distillationInputHashShort">
            <dt>输入指纹</dt>
            <dd>{{ distillationInputHashShort }}</dd>
          </div>
        </dl>

        <div v-if="distillationEvidence.length" class="distillation-evidence">
          <span
            v-for="item in distillationEvidence"
            :key="item"
            class="distillation-chip"
          >
            {{ item }}
          </span>
        </div>

        <div v-if="distillationCompactMemo" class="distillation-memo">
          <h3>Compact memo</h3>
          <pre>{{ distillationCompactMemo }}</pre>
        </div>

        <div v-if="deepDistillationStatus" class="deep-distillation">
          <div class="deep-distillation-head">
            <div>
              <p class="eyebrow">异步深度层</p>
              <h3>证据约束蒸馏</h3>
            </div>
            <span :class="['deep-status-badge', deepDistillationTone]">
              {{ deepDistillationStatusLabel }}
            </span>
          </div>
          <p class="deep-distillation-detail">{{ deepDistillationDetail }}</p>
          <dl class="deep-distillation-meta">
            <div v-if="deepEvidenceSpans.length">
              <dt>证据跨度</dt>
              <dd>{{ deepEvidenceSpans.length }} 条</dd>
            </div>
            <div v-if="deepDistillationAttempts">
              <dt>尝试次数</dt>
              <dd>{{ deepDistillationAttempts }}</dd>
            </div>
            <div v-if="deepDistillationGeneratedAt">
              <dt>深度生成</dt>
              <dd>{{ deepDistillationGeneratedAt }}</dd>
            </div>
            <div v-if="deepDistillationNextAttemptAt">
              <dt>下次重试</dt>
              <dd>{{ deepDistillationNextAttemptAt }}</dd>
            </div>
            <div v-if="deepClusterLabel">
              <dt>来源簇</dt>
              <dd>{{ deepClusterLabel }}</dd>
            </div>
          </dl>

          <details v-if="deepFullMemo" class="deep-memo-details">
            <summary>查看 full memo</summary>
            <pre>{{ deepFullMemo }}</pre>
          </details>

          <div v-if="deepTriggerCards.length" class="deep-artifact-group">
            <h4>场景触发卡</h4>
            <div class="deep-artifact-list">
              <article v-for="(card, index) in deepTriggerCards" :key="`trigger-${index}`">
                <div class="card-meta">
                  <span>{{ deepSceneLabel(card.sceneType) }}</span>
                  <span>{{ deepBudgetLabel(card.budget) }}</span>
                  <span>置信度 {{ formatConfidence(Number(card.confidence)) }}</span>
                </div>
                <p>{{ card.description }}</p>
              </article>
            </div>
          </div>

          <div
            v-if="deepFactCandidates.length || deepOpenQuestions.length"
            class="deep-artifact-grid"
          >
            <section v-if="deepFactCandidates.length" class="deep-artifact-group">
              <h4>事实候选</h4>
              <div class="deep-artifact-list">
                <article
                  v-for="(item, index) in deepFactCandidates"
                  :key="`fact-${index}`"
                >
                  <strong>{{ item.title }}</strong>
                  <p>{{ item.statement }}</p>
                  <small>仅代表来源陈述，不是已确认画像事实</small>
                </article>
              </div>
            </section>
            <section v-if="deepOpenQuestions.length" class="deep-artifact-group">
              <h4>开放问题</h4>
              <div class="deep-artifact-list">
                <article
                  v-for="(item, index) in deepOpenQuestions"
                  :key="`question-${index}`"
                >
                  <strong>{{ item.question }}</strong>
                  <p>{{ item.reason }}</p>
                  <small>{{ deepEscalationLabel(item.escalation) }}</small>
                </article>
              </div>
            </section>
          </div>

          <div v-if="deepSkillSeeds.length" class="deep-artifact-group">
            <h4>Skill seeds</h4>
            <div class="deep-artifact-list">
              <article v-for="(item, index) in deepSkillSeeds" :key="`skill-${index}`">
                <strong>{{ item.title }}</strong>
                <p>{{ item.summary }}</p>
                <small>单条资料只保留 seed；重复且高置信后才进入未激活的 Skill 建议。</small>
              </article>
            </div>
          </div>

          <div v-if="deepStorylineSeeds.length" class="deep-artifact-group">
            <h4>Storyline seeds</h4>
            <div class="deep-artifact-list">
              <article
                v-for="(item, index) in deepStorylineSeeds"
                :key="`storyline-${index}`"
                class="deep-storyline-row"
              >
                <div>
                  <strong>{{ item.title }}</strong>
                  <p>{{ item.claim }}</p>
                  <small>只生成可复核草稿，不自动写回 Slides、Docs 或消息。</small>
                </div>
                <button
                  type="button"
                  :title="storylineSeedBoundaryText(item)"
                  :aria-label="storylineSeedBoundaryText(item)"
                  @click="openStorylineSeed(item)"
                >
                  生成草稿
                </button>
              </article>
            </div>
          </div>

          <details v-if="deepEvidenceSpans.length" class="deep-evidence-details">
            <summary>查看 {{ deepEvidenceSpans.length }} 条 evidence spans</summary>
            <ol>
              <li v-for="span in deepEvidenceSpans" :key="String(span.id)">
                <code>{{ span.id }}</code>
                <p>{{ span.text }}</p>
              </li>
            </ol>
          </details>

          <p v-if="deepBlockedLabels.length" class="deep-policy-boundary">
            不会自动执行：{{ deepBlockedLabels.join('、') }}。
          </p>
        </div>

        <div
          v-if="downstreamAllowedLabels.length || downstreamBlockedLabels.length"
          class="distillation-downstream"
        >
          <div v-if="downstreamAllowedLabels.length">
            <strong>允许作为</strong>
            <p>{{ downstreamAllowedLabels.join('、') }}</p>
          </div>
          <div v-if="downstreamBlockedLabels.length">
            <strong>不会自动用于</strong>
            <p>{{ downstreamBlockedLabels.join('、') }}</p>
          </div>
        </div>

        <p v-if="distillationNextStep" class="distillation-next">
          {{ distillationNextStep }}
        </p>
      </section>

      <section :class="['change-ledger-panel', changeLedgerTone]" role="note">
        <div class="change-ledger-head">
          <div>
            <p class="eyebrow">变化脉络</p>
            <h2>{{ changeLedgerLabel }}</h2>
          </div>
          <span class="change-ledger-badge">{{ changeLedgerStatusLabel }}</span>
        </div>
        <p class="change-ledger-detail">{{ changeLedgerDetail }}</p>
        <div v-if="changeLedgerEvidence.length" class="change-ledger-evidence">
          <span
            v-for="item in changeLedgerEvidence"
            :key="item"
            class="change-ledger-chip"
          >
            {{ item }}
          </span>
        </div>

        <div v-if="changeProjections.length" class="change-projection-list">
          <article
            v-for="projection in changeProjections"
            :key="projection.chainKey"
            class="change-projection-row"
          >
            <div class="change-projection-summary">
              <div>
                <strong>{{ projection.propertyLabel }}</strong>
                <p>
                  <span>{{ projection.previousValue?.display || '未记录' }}</span>
                  <span aria-hidden="true">→</span>
                  <b>{{ projectionCurrentDisplay(projection) }}</b>
                </p>
              </div>
              <span :class="['change-projection-state', projection.status]">
                {{ changeProjectionStatusLabel(projection.status) }}
              </span>
            </div>
            <p class="change-projection-boundary">{{ projection.boundary }}</p>
            <dl class="change-projection-meta">
              <div>
                <dt>事件</dt>
                <dd>{{ projection.eventCount }} 条</dd>
              </div>
              <div v-if="projection.reversalCount">
                <dt>回退</dt>
                <dd>{{ projection.reversalCount }} 次</dd>
              </div>
              <div v-if="projection.currentEvent?.sourceRef.title">
                <dt>最后来源</dt>
                <dd>{{ projection.currentEvent.sourceRef.title }}</dd>
              </div>
              <div v-if="projection.lastObservedAt">
                <dt>最后观测</dt>
                <dd>{{ formatTimestamp(projection.lastObservedAt) }}</dd>
              </div>
            </dl>
            <details v-if="projection.history.length" class="change-history">
              <summary>查看 {{ projection.history.length }} 条历史证据</summary>
              <ol>
                <li
                  v-for="event in changeHistory(projection)"
                  :key="event.id"
                >
                  <div class="change-history-main">
                    <time>{{ formatTimestamp(event.observedAt) }}</time>
                    <strong>{{ formatChangeTransition(event) }}</strong>
                    <span v-if="event.isReversal" class="change-reversal-label">回退</span>
                  </div>
                  <p>
                    {{ changeAuthorityLabel(event.authorityRole) }} ·
                    {{ event.sourceRef.title || event.sourceRef.type }}
                    <template v-if="event.reason"> · 原因：{{ event.reason }}</template>
                  </p>
                </li>
              </ol>
            </details>
          </article>
        </div>
        <p v-else class="change-ledger-empty">
          当前没有可展示的前后值事件；这不代表功能未运行，请以上方提取回执为准。
        </p>
      </section>

      <section
        v-if="capsule.status === 'saved'"
        class="source-memory-detail-note-panel"
      >
        <div class="note-refresh-head">
          <div>
            <p class="eyebrow">补备注并刷新蒸馏</p>
            <h2>补充这份资料以后该怎么用</h2>
          </div>
          <span class="note-refresh-badge">刷新 source pack</span>
        </div>
        <p class="note-refresh-copy">
          备注会刷新这条 capsule 的摘要、关联 web 检索信号和资料蒸馏回执；不会自动写画像、创建任务或同步外部系统。
        </p>
        <label class="note-refresh-label" for="source-memory-note-input">
          资料备注
        </label>
        <textarea
          id="source-memory-note-input"
          v-model="noteDraft"
          class="source-memory-detail-note-input"
          :disabled="savingNote"
          maxlength="800"
          rows="4"
          placeholder="例如：后续写 QBR 时优先引用这张留存趋势图"
        ></textarea>
        <p class="note-refresh-helper">{{ noteDraftCountLabel }}</p>
        <div class="note-refresh-actions">
          <button
            type="button"
            class="primary-action"
            :disabled="!canSubmitNote"
            :title="noteSubmitBoundaryText"
            :aria-label="noteSubmitBoundaryText"
            @click="submitNoteUpdate"
          >
            {{ savingNote ? '提交中...' : noteSubmitLabel }}
          </button>
          <button
            type="button"
            class="secondary-action"
            :disabled="savingNote || !noteChanged"
            :title="noteResetBoundaryText"
            :aria-label="noteResetBoundaryText"
            @click="resetNoteDraft"
          >
            恢复当前备注
          </button>
        </div>
        <div
          v-if="noteUpdateReceipt"
          :class="['note-update-receipt', noteUpdateReceiptTone]"
          role="status"
        >
          <strong>{{ noteUpdateReceipt.title }}</strong>
          <p>{{ noteUpdateReceipt.detail }}</p>
          <div v-if="noteUpdateReceipt.evidence.length" class="note-update-evidence">
            <span
              v-for="item in noteUpdateReceipt.evidence"
              :key="item"
            >
              {{ item }}
            </span>
          </div>
          <p class="note-update-next">{{ noteUpdateReceipt.nextStep }}</p>
        </div>
      </section>

      <section v-if="isVisualMemory" class="visual-panel">
        <div class="visual-head">
          <div>
            <p class="eyebrow">视觉证据</p>
            <h2>{{ visualKindLabel }}</h2>
          </div>
          <span class="visual-badge">{{ visualTagLabel }}</span>
        </div>
        <p v-if="visualLabel" class="visual-caption">{{ visualLabel }}</p>
        <dl class="visual-meta-list">
          <div v-if="visualSelectorHint">
            <dt>网页区域</dt>
            <dd>{{ visualSelectorHint }}</dd>
          </div>
          <div v-if="visualRectText">
            <dt>捕获尺寸</dt>
            <dd>{{ visualRectText }}</dd>
          </div>
          <div v-if="visualScoreText">
            <dt>识别置信</dt>
            <dd>{{ visualScoreText }}</dd>
          </div>
        </dl>

        <div v-if="visualSvgMarkup" class="visual-svg-preview">
          <div class="visual-svg-stage" v-html="visualSvgMarkup"></div>
          <p v-if="visualSvgSizeText" class="visual-preview-note">
            已保存 SVG 图形快照，原始尺寸 {{ visualSvgSizeText }}。
          </p>
        </div>

        <div v-else-if="visualTableRows.length" class="visual-table-wrap">
          <table class="visual-table">
            <thead v-if="visualTableHeaders.length">
              <tr>
                <th
                  v-for="(header, index) in visualTableHeaders"
                  :key="`h-${index}`"
                >
                  {{ header || `列 ${index + 1}` }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, rowIndex) in visualTableRows" :key="rowIndex">
                <td
                  v-for="columnIndex in visualTableColumnCount"
                  :key="columnIndex"
                >
                  {{ row[columnIndex - 1] || '' }}
                </td>
              </tr>
            </tbody>
          </table>
          <p v-if="visualTableTruncated" class="visual-table-note">
            表格较大，当前只展示入库时保存的前 {{ visualTableRows.length }} 行。
          </p>
        </div>
        <p v-else-if="isVisualTable" class="empty-note">
          这条表格证据是旧记录，只保存了表格文本，没有结构化行列；重新入库后可显示表格。
        </p>
        <p v-else-if="isSvgVisual" class="empty-note">
          这条 SVG 证据是旧记录，只保存了 SVG 的文字和区域信息，没有保存图形快照；重新入库后可显示 SVG 预览。
        </p>
      </section>

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
              <dd v-if="safeSourceUrl" class="source-url">{{ safeSourceUrl }}</dd>
              <dd v-else class="source-url hidden">原始来源已隐藏</dd>
              <dd
                v-if="sourceLinkBoundaryText"
                class="source-url-boundary"
              >
                {{ sourceLinkBoundaryText }}；资料详情仍可复核已保存内容。
              </dd>
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
        <button
          type="button"
          :disabled="dismissing"
          :title="dismissBoundaryText"
          :aria-label="dismissBoundaryText"
          @click="dismissCapsule"
        >
          {{ dismissing ? '撤销中...' : '撤销资料记忆' }}
        </button>
      </section>
    </article>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  getMemoryServiceClient,
  type MemoryChangeEvent,
  type MemoryChangeProjection,
  type MemoryChangeProjectionStatus,
  type SourceMemoryCapsule,
  type SourceMemoryCaptureMode,
  type SourceMemoryPrivacyLevel,
} from '../../services/MemoryServiceClient';
import { getMemoryLinkSafetyState } from '../searchResultPresentation';

const route = useRoute();
const router = useRouter();
const client = getMemoryServiceClient();

const capsule = ref<SourceMemoryCapsule | null>(null);
const loading = ref(false);
const dismissing = ref(false);
const savingNote = ref(false);
const errorMessage = ref('');
const noteDraft = ref('');
type NoteUpdateReceiptTone = 'pending' | 'success' | 'error';
interface NoteUpdateReceipt {
  tone: NoteUpdateReceiptTone;
  title: string;
  detail: string;
  evidence: string[];
  nextStep: string;
}
const noteUpdateReceipt = ref<NoteUpdateReceipt | null>(null);
let deepRefreshTimer: ReturnType<typeof setTimeout> | null = null;

const capsuleId = computed(() => String(route.params.id || '').trim());
const capsuleMetadata = computed(() => asRecord(capsule.value?.metadata) || {});
const visualMemory = computed(() => asRecord(capsuleMetadata.value.visualMemory) || {});
const isVisualMemory = computed(
  () => capsule.value?.sourceKind === 'visual_memory' || Boolean(visualMemory.value.kind),
);
const visualKind = computed(() => {
  const kind = String(visualMemory.value.kind || '').trim();
  if (kind) return kind;
  const text = [
    capsule.value?.summary,
    capsule.value?.contentPreview,
    capsule.value?.anchors?.[0]?.quoteOrPreview,
  ].join(' ');
  if (/类型：表格|table/i.test(text)) return 'table';
  if (/类型：图表|chart/i.test(text)) return 'chart';
  if (/类型：图片|image/i.test(text)) return 'image';
  return '';
});
const isVisualTable = computed(() => visualKind.value === 'table');
const visualKindLabel = computed(() => visualKindDisplayLabel(visualKind.value));
const visualTagLabel = computed(() => {
  const tagName = String(visualMemory.value.tagName || '').trim();
  return tagName ? tagName.toUpperCase() : 'VISUAL';
});
const isSvgVisual = computed(
  () =>
    String(visualMemory.value.tagName || '').toLowerCase() === 'svg' ||
    String(visualMemory.value.selectorHint || '').toLowerCase().startsWith('svg'),
);
const visualLabel = computed(
  () =>
    String(visualMemory.value.label || '').trim() ||
    String(capsule.value?.summary || '').trim(),
);
const visualSelectorHint = computed(() =>
  String(visualMemory.value.selectorHint || '').trim(),
);
const visualRectText = computed(() => {
  const rect = asRecord(visualMemory.value.rect);
  const width = Number(rect?.width || 0);
  const height = Number(rect?.height || 0);
  if (!width || !height) return '';
  return `${Math.round(width)} × ${Math.round(height)} px`;
});
const visualScoreText = computed(() => {
  const score = Number(visualMemory.value.score);
  if (!Number.isFinite(score) || score <= 0) return '';
  return `${Math.round(score * 100)}%`;
});
const visualSvg = computed(() => asRecord(visualMemory.value.svg));
const visualSvgMarkup = computed(() => sanitizeStoredSvgMarkup(visualSvg.value?.markup));
const visualSvgSizeText = computed(() => {
  const width = Number(visualSvg.value?.width || 0);
  const height = Number(visualSvg.value?.height || 0);
  if (!width || !height) return '';
  return `${Math.round(width)} × ${Math.round(height)} px`;
});
const visualTable = computed(() => asRecord(visualMemory.value.table));
const visualTableHeaders = computed(() =>
  toStringArray(visualTable.value?.headers),
);
const visualTableRows = computed(() => toStringRows(visualTable.value?.rows));
const visualTableColumnCount = computed(() => {
  const rowColumnCount = visualTableRows.value.reduce(
    (max, row) => Math.max(max, row.length),
    0,
  );
  return Math.max(visualTableHeaders.value.length, rowColumnCount, 1);
});
const visualTableTruncated = computed(() => Boolean(visualTable.value?.truncated));
const distillation = computed(() => asRecord(capsuleMetadata.value.distillation));
const distillationPolicy = computed(() =>
  asRecord(distillation.value?.policyReceipt),
);
const distillationStatus = computed(() =>
  String(
    distillation.value?.status ||
      distillationPolicy.value?.state ||
      '',
  ).trim(),
);
const distillationTone = computed(() => {
  if (distillationStatus.value === 'blocked') return 'blocked';
  if (distillationStatus.value === 'partial') return 'partial';
  if (distillationStatus.value === 'ready') return 'ready';
  return 'missing';
});
const distillationStatusLabel = computed(() =>
  distillationStatusDisplayLabel(distillationStatus.value),
);
const distillationPolicyLabel = computed(
  () =>
    String(distillationPolicy.value?.label || '').trim() ||
    '资料蒸馏未生成',
);
const distillationPolicyDetail = computed(
  () =>
    String(distillationPolicy.value?.detail || '').trim() ||
    '这条资料还没有可用的蒸馏回执；本页只按原始 capsule、证据锚点和草稿线索展示，不会把它当作 ready source pack。',
);
const distillationEvidence = computed(() =>
  toStringArray(distillationPolicy.value?.evidence).filter(Boolean),
);
const distillationNextStep = computed(() =>
  String(distillationPolicy.value?.nextStep || '').trim(),
);
const distillationOneLineCue = computed(() =>
  String(distillation.value?.oneLineCue || '').trim(),
);
const distillationCompactMemo = computed(() =>
  String(distillation.value?.compactMemo || '').trim(),
);
const distillationGeneratedAt = computed(() => {
  const value = Number(distillation.value?.generatedAt || 0);
  return value > 0 ? formatTimestamp(value) : '';
});
const distillationSourceAsOf = computed(() => {
  const value = Number(distillation.value?.sourceAsOf || 0);
  return value > 0 ? formatTimestamp(value) : '';
});
const distillationInputHashShort = computed(() => {
  const value = String(distillation.value?.inputHash || '').trim();
  return value ? value.slice(0, 12) : '';
});
const distillationSourceReliability = computed(() => {
  const reliability = asRecord(distillation.value?.sourceReliability);
  return String(reliability?.reason || '').trim();
});
const deepDistillation = computed(() => asRecord(distillation.value?.deep) || {});
const deepInputIsCurrent = computed(() => {
  const deepHash = String(deepDistillation.value.inputHash || '').trim();
  const p0Hash = String(distillation.value?.inputHash || '').trim();
  return Boolean(deepHash && p0Hash && deepHash === p0Hash);
});
const deepDistillationStatus = computed(() => {
  const status = String(deepDistillation.value.status || '').trim();
  if (!status) return '';
  return status === 'ready' && !deepInputIsCurrent.value ? 'stale' : status;
});
const deepDistillationTone = computed(() => {
  if (deepDistillationStatus.value === 'ready') return 'ready';
  if (['queued', 'running', 'retry_wait'].includes(deepDistillationStatus.value)) {
    return 'pending';
  }
  return 'blocked';
});
const deepDistillationStatusLabel = computed(() =>
  deepDistillationStatusDisplayLabel(deepDistillationStatus.value),
);
const deepDistillationDetail = computed(() => {
  const details: Record<string, string> = {
    queued: '已进入后台队列；同步 P0 提示仍可立即召回。',
    running: '正在从已保存证据构造可引用产物；同步 P0 提示仍可使用。',
    retry_wait: '本次深度生成失败，已按有界退避等待重试；不会降级或覆盖 P0。',
    ready: '深度产物已通过 evidence span 引用校验；下列事实、问题和 seeds 仍是候选。',
    stale: '深度产物属于旧快照，当前不会用于召回；等待新输入指纹重新生成。',
    blocked: '深度处理被隐私、审核、证据或注入策略阻断；资料原文与同步 P0 仍保留。',
    failed: '深度处理已达到重试上限；同步 P0 仍保留，可在来源更新后重新排队。',
  };
  return details[deepDistillationStatus.value] || '尚未启动异步深度蒸馏。';
});
const deepDistillationAttempts = computed(() =>
  Math.max(0, Number(deepDistillation.value.attempts || 0)),
);
const deepDistillationGeneratedAt = computed(() =>
  formatDistillationTimestamp(deepDistillation.value.generatedAt),
);
const deepDistillationNextAttemptAt = computed(() =>
  formatDistillationTimestamp(deepDistillation.value.nextAttemptAt),
);
const deepFullMemo = computed(() =>
  deepInputIsCurrent.value ? String(deepDistillation.value.fullMemo || '').trim() : '',
);
const deepEvidenceSpans = computed(() =>
  deepInputIsCurrent.value ? toRecordArray(deepDistillation.value.evidenceSpans) : [],
);
const deepTriggerCards = computed(() =>
  deepInputIsCurrent.value ? toRecordArray(deepDistillation.value.triggerCards) : [],
);
const deepFactCandidates = computed(() =>
  deepInputIsCurrent.value ? toRecordArray(deepDistillation.value.factCandidates) : [],
);
const deepOpenQuestions = computed(() =>
  deepInputIsCurrent.value ? toRecordArray(deepDistillation.value.openQuestions) : [],
);
const deepSkillSeeds = computed(() =>
  deepInputIsCurrent.value ? toRecordArray(deepDistillation.value.skillSeeds) : [],
);
const deepStorylineSeeds = computed(() =>
  deepInputIsCurrent.value ? toRecordArray(deepDistillation.value.storylineSeeds) : [],
);
const deepCluster = computed(() => asRecord(deepDistillation.value.cluster) || {});
const deepClusterLabel = computed(() => {
  const key = String(deepCluster.value.key || '').trim();
  const size = Number(deepCluster.value.size || 0);
  if (!key) return '';
  return size > 1 ? `${key} · ${size} 条独立来源` : `${key} · 当前 1 条来源`;
});
const deepPolicy = computed(() => asRecord(deepDistillation.value.policyReceipt) || {});
const deepBlockedLabels = computed(() =>
  toStringArray(deepPolicy.value.blocked).filter(Boolean).map(downstreamUseLabel),
);
const changeLedger = computed(() => capsule.value?.changeLedger || null);
const changeLedgerLabel = computed(
  () => changeLedger.value?.label || '尚未检查变化',
);
const changeLedgerDetail = computed(
  () =>
    changeLedger.value?.detail ||
    '当前 Memory Service 没有返回变化提取回执；不会把空结果当作没有发生变化。',
);
const changeLedgerStatus = computed(
  () => changeLedger.value?.status || 'not_run',
);
const changeLedgerStatusLabel = computed(() => {
  if (changeLedgerStatus.value === 'ready') return '已提取';
  if (changeLedgerStatus.value === 'no_change') return '未发现变化';
  if (changeLedgerStatus.value === 'blocked') return '缺少稳定对象';
  return '尚未检查';
});
const changeLedgerTone = computed(() => {
  if (capsule.value?.status === 'dismissed') return 'historical';
  return changeLedgerStatus.value;
});
const changeLedgerEvidence = computed(() =>
  (changeLedger.value?.evidence || []).filter(Boolean),
);
const changeProjections = computed(() =>
  (changeLedger.value?.projections || []).filter(Boolean),
);
const currentUserNote = computed(() =>
  String(capsuleMetadata.value.userNote || '').trim(),
);
const normalizedNoteDraft = computed(() => noteDraft.value.trim().slice(0, 800));
const noteChanged = computed(
  () => normalizedNoteDraft.value !== currentUserNote.value,
);
const canSubmitNote = computed(
  () =>
    Boolean(capsule.value) &&
    capsule.value?.status === 'saved' &&
    !savingNote.value &&
    noteChanged.value,
);
const noteSubmitLabel = computed(() =>
  currentUserNote.value ? '更新备注并刷新蒸馏' : '保存备注并刷新蒸馏',
);
const noteDraftCountLabel = computed(
  () =>
    `${noteDraft.value.length}/800；提交后会刷新关联 web 记忆信号和资料蒸馏回执。`,
);
const noteUpdateReceiptTone = computed(
  () => noteUpdateReceipt.value?.tone || '',
);
const sourceMemoryControlTarget = computed(
  () =>
    String(capsule.value?.sourceTitle || '').trim() ||
    capsuleId.value ||
    '当前资料',
);
const openSourceBoundaryText = computed(() => {
  const host =
    String(capsule.value?.sourceHost || '').trim() ||
    safeSourceUrl.value ||
    '原始来源';
  return `打开来源：在新标签打开 ${host} 核对原始资料；不会新增、撤销或更新资料记忆，不写画像/任务，不插入输入框、发送内容、确认事实或同步外部系统。`;
});
const linkedMemoryBoundaryText = computed(
  () =>
    `查看关联记忆：打开 ${sourceMemoryControlTarget.value} 关联的 web 记忆信号时间轴；只读复核当前已返回信号，不重新召回、不写入、不恢复已撤销资料、不外发或同步。`,
);
const noteSubmitBoundaryText = computed(() => {
  if (savingNote.value) {
    return `备注刷新提交中：正在等待 Memory Service 确认 ${sourceMemoryControlTarget.value} 的备注、关联 web 检索信号和资料蒸馏回执；当前页面仍是上一版快照，不自动写画像、创建任务、确认事实或同步外部系统。`;
  }
  if (!noteChanged.value) {
    return `备注未改变：当前不会提交 ${sourceMemoryControlTarget.value}；不刷新关联 web 检索信号、资料蒸馏回执或任何外部系统。`;
  }
  return `提交备注刷新：向 Memory Service 更新 ${sourceMemoryControlTarget.value} 的备注、关联 web 检索信号和资料蒸馏回执；提交中先显示待确认回执，不自动写画像、创建任务、确认事实或同步外部系统。`;
});
const noteResetBoundaryText = computed(
  () =>
    `恢复当前备注：只把输入框恢复为 ${sourceMemoryControlTarget.value} 当前已读取的备注；不请求 Memory Service、不刷新关联 web 检索信号或资料蒸馏、不撤销资料。`,
);
const dismissBoundaryText = computed(
  () =>
    `撤销资料记忆：提交后移除 ${sourceMemoryControlTarget.value} 的关联 web 检索信号，后续 Ask、Memory Lens 和时间轴不再召回；不会删除原网页、外部系统内容、已保存复核记录，也不会外发或同步。`,
);
const downstreamUse = computed(() => asRecord(distillation.value?.downstreamUse));
const downstreamAllowedLabels = computed(() =>
  toStringArray(downstreamUse.value?.allowed)
    .filter(Boolean)
    .map(downstreamUseLabel),
);
const downstreamBlockedLabels = computed(() =>
  toStringArray(downstreamUse.value?.blocked)
    .filter(Boolean)
    .map(downstreamUseLabel),
);
const sourceLinkSafety = computed(() =>
  getMemoryLinkSafetyState({
    sourceUrl: capsule.value?.sourceUrl,
  }),
);
const actionReceipt = computed(() => capsule.value?.actionReceipt || null);
const actionEvidence = computed(() =>
  toStringArray(actionReceipt.value?.evidence).filter(Boolean),
);
const actionOccurredAt = computed(() => {
  const value = Number(actionReceipt.value?.occurredAt || 0);
  return value > 0 ? formatTimestamp(value) : '';
});
const safeSourceUrl = computed(() => sourceLinkSafety.value.sourceUrl || '');
const sourceLinkBoundaryText = computed(() =>
  sourceLinkSafety.value.blockedLabels.join('；'),
);
const linkedMemoryAvailable = computed(
  () => capsule.value?.status === 'saved' && Boolean(capsule.value?.messageId),
);
const recallBoundaryTone = computed(() => {
  if (capsule.value?.status === 'dismissed') return 'dismissed';
  if (!linkedMemoryAvailable.value) return 'missing';
  return 'active';
});
const recallBoundaryTitle = computed(() => {
  if (capsule.value?.status === 'dismissed') return '资料召回已关闭';
  if (!linkedMemoryAvailable.value) return '关联记忆信号缺失';
  return '资料召回已启用';
});
const recallBoundaryText = computed(() => {
  if (capsule.value?.status === 'dismissed') {
    return '撤销已移除关联的 web 记忆信号，后续 Ask、Memory Lens 和时间轴召回不再使用这条 capsule；本页仅保留已保存证据供复核，不会删除原网页或外部系统内容。';
  }
  if (!linkedMemoryAvailable.value) {
    return '这条资料仍保留 capsule 详情，但当前没有可跳转的 web 记忆信号；不会显示关联记忆入口，也不把缺失信号当作已召回证据。';
  }
  return '关联 web 记忆信号仍在，后续 Ask、Memory Lens 和时间轴可以召回这条资料；草稿要点只是候选，不等于已确认事实。';
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
    syncNoteDraftFromCapsule();
    noteUpdateReceipt.value = null;
    scheduleDeepRefresh();
  } catch (error) {
    capsule.value = null;
    errorMessage.value = String((error as Error)?.message || error);
    clearDeepRefresh();
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
    syncNoteDraftFromCapsule();
    noteUpdateReceipt.value = null;
    scheduleDeepRefresh();
  } catch (error) {
    errorMessage.value = String((error as Error)?.message || error);
  } finally {
    dismissing.value = false;
  }
}

async function submitNoteUpdate() {
  if (!capsule.value || !canSubmitNote.value) return;

  const note = normalizedNoteDraft.value;
  savingNote.value = true;
  errorMessage.value = '';
  noteUpdateReceipt.value = buildPendingNoteReceipt(note);
  try {
    const response = await client.updateSourceMemoryCapsuleNote(
      capsule.value.id,
      note,
    );
    capsule.value = response.capsule;
    syncNoteDraftFromCapsule();
    noteUpdateReceipt.value = buildConfirmedNoteReceipt(response.capsule);
    scheduleDeepRefresh();
  } catch (error) {
    noteUpdateReceipt.value = buildFailedNoteReceipt(note, error);
  } finally {
    savingNote.value = false;
  }
}

function resetNoteDraft() {
  syncNoteDraftFromCapsule();
}

function syncNoteDraftFromCapsule() {
  noteDraft.value = currentUserNote.value;
}

function buildPendingNoteReceipt(note: string): NoteUpdateReceipt {
  const sourceTitle = capsule.value?.sourceTitle || capsuleId.value || '当前资料';
  return {
    tone: 'pending',
    title: '备注刷新提交中',
    detail:
      '当前页面仍是上一次资料详情快照；备注、关联 web 检索信号和资料蒸馏回执尚未确认刷新。',
    evidence: [
      `目标：${sourceTitle}`,
      `当前蒸馏：${distillationStatusLabel.value}`,
      `请求备注：${note.length} 字`,
    ],
    nextStep:
      '等待 Memory Service 返回；这一步不会自动写用户画像、创建任务、确认新事实或同步外部系统。',
  };
}

function buildConfirmedNoteReceipt(updatedCapsule: SourceMemoryCapsule): NoteUpdateReceipt {
  const metadata = asRecord(updatedCapsule.metadata) || {};
  const updatedDistillation = asRecord(metadata.distillation) || {};
  const updatedPolicy = asRecord(updatedDistillation.policyReceipt) || {};
  const updatedStatus = distillationStatusDisplayLabel(
    String(updatedDistillation.status || updatedPolicy.state || ''),
  );
  const sourceAsOf = formatDistillationTimestamp(updatedDistillation.sourceAsOf);
  const evidence = toStringArray(updatedCapsule.actionReceipt?.evidence).filter(Boolean);
  evidence.push(`资料蒸馏：${updatedStatus}`);
  if (sourceAsOf) {
    evidence.push(`来源快照：${sourceAsOf}`);
  }
  const backendNextStep =
    updatedCapsule.actionReceipt?.nextStep ||
    '可继续复核资料蒸馏回执。';
  return {
    tone: 'success',
    title: updatedCapsule.actionReceipt?.label || '备注刷新已确认',
    detail:
      `${updatedCapsule.actionReceipt?.detail || 'Memory Service 已返回最新资料详情。'} 资料蒸馏状态：${updatedStatus}。`,
    evidence,
    nextStep: `${backendNextStep} 自动画像、任务创建和外部同步仍不会自动发生。`,
  };
}

function buildFailedNoteReceipt(note: string, error: unknown): NoteUpdateReceipt {
  const message = String((error as Error)?.message || error || '未知错误');
  return {
    tone: 'error',
    title: '备注刷新未确认',
    detail:
      `Memory Service 返回错误：${message}。本页保留上一次已读取的 capsule 快照；没有确认更新备注、刷新 web 检索信号或重新生成资料蒸馏。`,
    evidence: [
      `请求备注：${note.length} 字`,
      '资料详情：未确认更新',
      '自动画像 / 任务 / 外部同步：未发生',
    ],
    nextStep: '可稍后重试；不要把当前页面当作备注已保存或蒸馏已刷新的证明。',
  };
}

function openSource() {
  if (!safeSourceUrl.value) return;
  window.open(safeSourceUrl.value, '_blank', 'noopener,noreferrer');
}

function storylineSeedBoundaryText(item: Record<string, unknown>) {
  const title = String(item.title || '当前 Storyline seed').trim();
  return `从“${title}”打开 Storyline 草稿页；只读取当前 capsule 已校验的 evidence spans 并生成可复制草稿，不自动写回 Slides、Docs、RingCentral，不发送、不发布。`;
}

function openStorylineSeed(item: Record<string, unknown>) {
  const seedId = String(item.seedKey || '').trim();
  if (!capsule.value || !seedId) return;
  router.push({
    path: '/storylines/draft',
    query: {
      source: 'source_memory_seed',
      capsuleId: capsule.value.id,
      seedId,
      target: 'speaker_notes',
      audience: String(item.audience || '').trim(),
    },
  });
}

function clearDeepRefresh() {
  if (deepRefreshTimer) {
    clearTimeout(deepRefreshTimer);
    deepRefreshTimer = null;
  }
}

function scheduleDeepRefresh() {
  clearDeepRefresh();
  if (!['queued', 'running', 'retry_wait'].includes(deepDistillationStatus.value)) {
    return;
  }
  deepRefreshTimer = setTimeout(() => {
    void refreshDeepDistillation();
  }, 5000);
}

async function refreshDeepDistillation() {
  if (!capsuleId.value || loading.value || savingNote.value || dismissing.value) {
    scheduleDeepRefresh();
    return;
  }
  try {
    const response = await client.getSourceMemoryCapsule(capsuleId.value);
    capsule.value = response.capsule;
  } catch {
    // Keep the last confirmed capsule snapshot; the regular detail retry remains available.
  } finally {
    scheduleDeepRefresh();
  }
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

function formatDistillationTimestamp(value: unknown) {
  const timestamp = Number(value || 0);
  return timestamp > 0 ? formatTimestamp(timestamp) : '';
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
    visual_memory: '视觉证据',
    selection: '选中文本',
    jira_comment: 'Jira 评论',
    message_reply: '消息回复',
    web_ai_prompt: 'Web AI 输入',
    ai_conversation: 'AI 对话',
    document: '文档资料',
    meeting_material: '会议资料',
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
  if (value === 'visual_region') return '视觉区域';
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

function distillationStatusDisplayLabel(value: string) {
  if (value === 'ready') return 'Ready';
  if (value === 'partial') return 'Partial';
  if (value === 'blocked') return 'Blocked';
  return '未生成';
}

function deepDistillationStatusDisplayLabel(value: string) {
  if (value === 'queued') return '排队中';
  if (value === 'running') return '生成中';
  if (value === 'retry_wait') return '等待重试';
  if (value === 'ready') return '已就绪';
  if (value === 'stale') return '旧快照';
  if (value === 'blocked') return '策略阻断';
  if (value === 'failed') return '重试终止';
  return '未启动';
}

function deepSceneLabel(value: unknown) {
  const labels: Record<string, string> = {
    general: '通用场景',
    page: '页面阅读',
    compose: '写作 / 回复',
    ask: 'Ask 对话',
    meeting: '会议',
    jira: 'Jira',
    research: '研究',
  };
  const key = String(value || '').trim();
  return labels[key] || key || '通用场景';
}

function deepBudgetLabel(value: unknown) {
  const labels: Record<string, string> = {
    one_line: '一行提示',
    compact: 'Compact memo',
    full: 'Full memo',
  };
  const key = String(value || '').trim();
  return labels[key] || key || 'Compact memo';
}

function deepEscalationLabel(value: unknown) {
  if (value === 'when_relevant') return '只在相关场景出现时交给 Ask / Reflection';
  if (value === 'when_blocking') return '仅在阻塞当前任务时请求确认';
  return '默认不升级、不创建确认队列';
}

function changeProjectionStatusLabel(value: MemoryChangeProjectionStatus) {
  if (value === 'confirmed_current') return '已确认当前';
  if (value === 'last_observed') return '最后观测';
  if (value === 'conflicted') return '存在冲突';
  if (value === 'historical_only') return '仅历史';
  if (value === 'superseded_at_source') return '来源已有新值';
  if (value === 'superseded_on_page') return '页面已有新值';
  return value;
}

function projectionCurrentDisplay(projection: MemoryChangeProjection) {
  if ((projection.status === 'superseded_on_page' || projection.status === 'superseded_at_source') && projection.visiblePageValue) {
    return `${projection.visiblePageValue.display}（页面当前）`;
  }
  return projection.currentValue?.display || '未知';
}

function changeHistory(projection: MemoryChangeProjection) {
  return [...projection.history].reverse();
}

function formatChangeTransition(event: MemoryChangeEvent) {
  return `${event.previousValue?.display || '未记录'} → ${event.nextValue.display}`;
}

function changeAuthorityLabel(value: MemoryChangeEvent['authorityRole']) {
  if (value === 'authoritative_source') return '权威来源';
  if (value === 'owner_authored') return '用户本人';
  if (value === 'team_message') return '团队消息';
  if (value === 'ai_generated') return 'AI 生成';
  if (value === 'source_snapshot') return '来源快照';
  return '推断证据';
}

function downstreamUseLabel(value: string) {
  const labels: Record<string, string> = {
    source_memory_detail: '资料详情复核',
    context_recall_source_card: 'Context Recall 资料卡',
    reflection_seed: 'Reflection 证据种子',
    dream_seed: 'Dream 证据种子',
    auto_profile_write: '自动写用户画像',
    auto_task_creation: '自动创建任务',
    external_write_or_sync: '外部写入或同步',
    profile_fact_confirmation: '确认用户画像事实',
    profile_write: '写入用户画像',
    action_execution: '执行操作',
    automatic_skill_publish: '自动发布 Skill',
    storyline_writeback: 'Storyline 自动写回',
  };
  return labels[value] || value;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) => String(item || '').trim())
    : [];
}

function toRecordArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value
        .map((item) => asRecord(item))
        .filter((item): item is Record<string, unknown> => Boolean(item))
    : [];
}

function toStringRows(value: unknown): string[][] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((row): row is unknown[] => Array.isArray(row))
    .map((row) => row.map((cell) => String(cell || '').trim()));
}

function sanitizeStoredSvgMarkup(value: unknown): string {
  const markup = String(value || '').trim();
  if (!markup || markup.length > 300000 || !/^<svg[\s>]/i.test(markup)) {
    return '';
  }
  if (/<(?:script|foreignObject|iframe|object|embed)\b/i.test(markup)) {
    return '';
  }
  if (/\son[a-z]+\s*=/i.test(markup) || /javascript:/i.test(markup)) {
    return '';
  }
  const parser = new DOMParser();
  const document = parser.parseFromString(markup, 'image/svg+xml');
  if (document.querySelector('parsererror')) {
    return '';
  }
  const svg = document.documentElement;
  if (!svg || svg.tagName.toLowerCase() !== 'svg') {
    return '';
  }

  svg
    .querySelectorAll('script, foreignObject, iframe, object, embed')
    .forEach((node) => node.remove());

  for (const node of Array.from(svg.querySelectorAll('*'))) {
    sanitizeStoredSvgElement(node);
  }
  sanitizeStoredSvgElement(svg);

  return new XMLSerializer().serializeToString(svg);
}

function sanitizeStoredSvgElement(node: Element) {
  for (const attr of Array.from(node.attributes)) {
    const name = attr.name;
    const lowerName = name.toLowerCase();
    const value = attr.value.trim();
    const lowerValue = value.toLowerCase();
    if (lowerName.startsWith('on') || lowerValue.includes('javascript:')) {
      node.removeAttribute(name);
      continue;
    }
    if (lowerName === 'style') {
      const safeStyle = sanitizeStoredSvgStyleValue(value);
      if (safeStyle) {
        node.setAttribute(name, safeStyle);
      } else {
        node.removeAttribute(name);
      }
    }
  }
}

function sanitizeStoredSvgStyleValue(value: string): string {
  const blockedProperties = new Set([
    'position',
    'inset',
    'inset-block',
    'inset-block-start',
    'inset-block-end',
    'inset-inline',
    'inset-inline-start',
    'inset-inline-end',
    'top',
    'right',
    'bottom',
    'left',
    'z-index',
    'float',
    'clear',
    'transform',
    'translate',
    'scale',
    'rotate',
    'margin',
    'margin-top',
    'margin-right',
    'margin-bottom',
    'margin-left',
  ]);
  const safeDeclarations = value
    .split(';')
    .map((declaration) => declaration.trim())
    .filter((declaration) => {
      if (!declaration || declaration.toLowerCase().includes('javascript:')) {
        return false;
      }
      const property = declaration.split(':')[0]?.trim().toLowerCase();
      return property ? !blockedProperties.has(property) : false;
    });
  return safeDeclarations.join('; ');
}

function visualKindDisplayLabel(value: string) {
  const labels: Record<string, string> = {
    chart: '图表',
    canvas: '画布图表',
    image: '图片',
    table: '表格',
    figure: '视觉区域',
  };
  return labels[value] || '视觉证据';
}

watch(capsuleId, () => {
  clearDeepRefresh();
  void loadCapsule();
});

onMounted(() => {
  void loadCapsule();
});

onBeforeUnmount(() => {
  clearDeepRefresh();
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

.state-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 14px;
}

.state-panel .secondary-state-action {
  border: 1px solid #d1d5db;
  background: #ffffff;
  color: #374151;
}

.error-boundary-receipt {
  border: 1px solid #fecaca;
  border-radius: 8px;
  background: #ffffff;
  padding: 12px;
  margin-top: 14px;
}

.error-boundary-receipt strong {
  display: block;
  color: #991b1b;
  font-size: 14px;
  margin-bottom: 4px;
}

.error-boundary-receipt p {
  margin: 0;
  color: #374151;
  line-height: 1.55;
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

.recall-boundary-panel {
  border: 1px solid #bfdbfe;
  border-radius: 8px;
  background: #eff6ff;
  padding: 12px 14px;
}

.recall-boundary-panel strong {
  display: block;
  color: #1e3a8a;
  font-size: 14px;
  margin-bottom: 4px;
}

.recall-boundary-panel p {
  margin: 0;
  color: #1f2937;
  line-height: 1.55;
}

.recall-boundary-panel.dismissed {
  border-color: #fecaca;
  background: #fff7f7;
}

.recall-boundary-panel.dismissed strong {
  color: #991b1b;
}

.recall-boundary-panel.missing {
  border-color: #fde68a;
  background: #fffbeb;
}

.recall-boundary-panel.missing strong {
  color: #92400e;
}

.source-action-panel {
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  background: #f8fafc;
  padding: 14px;
}

.source-action-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.source-action-head h2 {
  margin: 0;
  color: #0f172a;
  font-size: 18px;
}

.source-action-time {
  flex: 0 0 auto;
  border-radius: 999px;
  background: #e2e8f0;
  color: #334155;
  font-size: 12px;
  font-weight: 700;
  padding: 4px 8px;
}

.source-action-panel p {
  margin: 10px 0 0;
  color: #334155;
  line-height: 1.6;
}

.source-action-evidence {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

.source-action-chip {
  border: 1px solid #cbd5e1;
  border-radius: 999px;
  background: #ffffff;
  color: #334155;
  font-size: 12px;
  font-weight: 700;
  padding: 5px 9px;
}

.source-action-next {
  font-weight: 700;
}

.distillation-panel {
  border: 1px solid #bbf7d0;
  border-radius: 8px;
  background: #f0fdf4;
  padding: 14px;
}

.distillation-panel.partial {
  border-color: #fde68a;
  background: #fffbeb;
}

.distillation-panel.blocked,
.distillation-panel.missing {
  border-color: #fecaca;
  background: #fff7f7;
}

.distillation-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
}

.distillation-head h2 {
  margin: 0;
  font-size: 18px;
}

.distillation-badge {
  border: 1px solid #86efac;
  border-radius: 999px;
  background: #dcfce7;
  color: #166534;
  padding: 5px 10px;
  font-size: 12px;
  font-weight: 800;
  white-space: nowrap;
}

.distillation-panel.partial .distillation-badge {
  border-color: #facc15;
  background: #fef9c3;
  color: #854d0e;
}

.distillation-panel.blocked .distillation-badge,
.distillation-panel.missing .distillation-badge {
  border-color: #fecaca;
  background: #fee2e2;
  color: #991b1b;
}

.distillation-detail,
.distillation-next {
  margin: 10px 0 0;
  color: #1f2937;
  line-height: 1.6;
}

.distillation-summary {
  display: grid;
  gap: 10px;
  margin: 12px 0 0;
}

.distillation-summary div {
  display: grid;
  grid-template-columns: 92px minmax(0, 1fr);
  gap: 10px;
}

.distillation-summary dt {
  color: #4b5563;
  font-weight: 800;
}

.distillation-summary dd {
  margin: 0;
  color: #111827;
  overflow-wrap: anywhere;
}

.distillation-evidence {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

.distillation-chip {
  border: 1px solid #d1fae5;
  border-radius: 999px;
  background: #ffffff;
  color: #065f46;
  padding: 5px 9px;
  font-size: 12px;
  font-weight: 700;
}

.distillation-panel.partial .distillation-chip {
  border-color: #fde68a;
  color: #92400e;
}

.distillation-panel.blocked .distillation-chip,
.distillation-panel.missing .distillation-chip {
  border-color: #fecaca;
  color: #991b1b;
}

.distillation-memo {
  margin-top: 12px;
}

.distillation-memo h3 {
  margin: 0 0 6px;
  font-size: 14px;
}

.distillation-memo pre {
  margin: 0;
  border: 1px solid #d1fae5;
  border-radius: 8px;
  background: #ffffff;
  color: #111827;
  padding: 10px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  line-height: 1.55;
  font: inherit;
}

.distillation-downstream {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-top: 12px;
}

.distillation-downstream div {
  border: 1px solid #d1fae5;
  border-radius: 8px;
  background: #ffffff;
  padding: 10px;
}

.distillation-downstream strong {
  display: block;
  margin-bottom: 4px;
  color: #065f46;
}

.distillation-downstream p {
  margin: 0;
  color: #1f2937;
  line-height: 1.5;
}

.distillation-panel.partial .distillation-memo pre,
.distillation-panel.partial .distillation-downstream div {
  border-color: #fde68a;
}

.distillation-panel.partial .distillation-downstream strong {
  color: #92400e;
}

.distillation-panel.blocked .distillation-memo pre,
.distillation-panel.missing .distillation-memo pre,
.distillation-panel.blocked .distillation-downstream div,
.distillation-panel.missing .distillation-downstream div {
  border-color: #fecaca;
}

.distillation-panel.blocked .distillation-downstream strong,
.distillation-panel.missing .distillation-downstream strong {
  color: #991b1b;
}

.deep-distillation {
  margin-top: 16px;
  border-top: 1px solid #a7f3d0;
  padding-top: 14px;
}

.deep-distillation-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.deep-distillation-head h3 {
  margin: 0;
  color: #111827;
  font-size: 16px;
}

.deep-status-badge {
  flex: 0 0 auto;
  border: 1px solid #d1d5db;
  border-radius: 999px;
  background: #ffffff;
  color: #374151;
  padding: 4px 9px;
  font-size: 12px;
  font-weight: 800;
}

.deep-status-badge.ready {
  border-color: #86efac;
  color: #166534;
}

.deep-status-badge.pending {
  border-color: #facc15;
  background: #fefce8;
  color: #854d0e;
}

.deep-status-badge.blocked {
  border-color: #fca5a5;
  background: #fff7f7;
  color: #991b1b;
}

.deep-distillation-detail,
.deep-policy-boundary {
  margin: 9px 0 0;
  color: #374151;
  line-height: 1.55;
}

.deep-distillation-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 18px;
  margin: 12px 0 0;
}

.deep-distillation-meta div {
  display: flex;
  gap: 6px;
  min-width: 0;
}

.deep-distillation-meta dt {
  color: #6b7280;
  font-weight: 700;
}

.deep-distillation-meta dd {
  margin: 0;
  color: #111827;
  overflow-wrap: anywhere;
}

.deep-memo-details,
.deep-evidence-details {
  margin-top: 14px;
  border-top: 1px solid #d1fae5;
  padding-top: 10px;
}

.deep-memo-details summary,
.deep-evidence-details summary {
  color: #065f46;
  cursor: pointer;
  font-weight: 800;
}

.deep-memo-details pre {
  margin: 10px 0 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  color: #1f2937;
  font: inherit;
  line-height: 1.6;
}

.deep-artifact-group {
  margin-top: 16px;
  border-top: 1px solid #d1fae5;
  padding-top: 12px;
}

.deep-artifact-group h4 {
  margin: 0 0 8px;
  color: #065f46;
  font-size: 14px;
}

.deep-artifact-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.deep-artifact-list article {
  padding: 10px 0;
  border-bottom: 1px solid #e5e7eb;
}

.deep-artifact-list article:last-child {
  border-bottom: 0;
}

.deep-artifact-list strong {
  color: #111827;
}

.deep-artifact-list p {
  margin: 5px 0 0;
  color: #374151;
  line-height: 1.55;
}

.deep-artifact-list small {
  display: block;
  margin-top: 6px;
  color: #6b7280;
  line-height: 1.45;
}

.deep-storyline-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 14px;
  align-items: center;
}

.deep-storyline-row button {
  border: 1px solid #059669;
  border-radius: 6px;
  background: #ffffff;
  color: #047857;
  padding: 7px 10px;
  cursor: pointer;
  font-weight: 800;
}

.deep-storyline-row button:hover,
.deep-storyline-row button:focus-visible {
  background: #ecfdf5;
}

.deep-evidence-details ol {
  margin: 10px 0 0;
  padding-left: 22px;
}

.deep-evidence-details li {
  padding: 6px 0;
}

.deep-evidence-details code {
  color: #065f46;
  overflow-wrap: anywhere;
}

.deep-evidence-details p {
  margin: 4px 0 0;
  color: #374151;
  line-height: 1.5;
}

.change-ledger-panel {
  border: 1px solid #a7f3d0;
  border-radius: 8px;
  background: #f0fdfa;
  padding: 16px;
}

.change-ledger-panel.no_change,
.change-ledger-panel.not_run {
  border-color: #d1d5db;
  background: #f9fafb;
}

.change-ledger-panel.blocked,
.change-ledger-panel.historical {
  border-color: #fed7aa;
  background: #fff7ed;
}

.change-ledger-head,
.change-projection-summary,
.change-history-main {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.change-ledger-head h2 {
  margin: 0;
  font-size: 18px;
}

.change-ledger-badge,
.change-projection-state,
.change-reversal-label {
  flex: 0 0 auto;
  border: 1px solid #6ee7b7;
  border-radius: 999px;
  background: #d1fae5;
  color: #065f46;
  padding: 4px 8px;
  font-size: 12px;
  font-weight: 800;
  white-space: nowrap;
}

.change-ledger-panel.blocked .change-ledger-badge,
.change-ledger-panel.historical .change-ledger-badge,
.change-projection-state.historical_only,
.change-projection-state.superseded_on_page,
.change-projection-state.superseded_at_source {
  border-color: #fdba74;
  background: #ffedd5;
  color: #9a3412;
}

.change-projection-state.conflicted {
  border-color: #fca5a5;
  background: #fee2e2;
  color: #991b1b;
}

.change-ledger-panel.no_change .change-ledger-badge,
.change-ledger-panel.not_run .change-ledger-badge {
  border-color: #d1d5db;
  background: #ffffff;
  color: #4b5563;
}

.change-ledger-detail,
.change-projection-boundary,
.change-ledger-empty {
  margin: 10px 0 0;
  color: #374151;
  line-height: 1.6;
}

.change-ledger-evidence {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

.change-ledger-chip {
  border: 1px solid #a7f3d0;
  border-radius: 999px;
  background: #ffffff;
  color: #065f46;
  padding: 5px 9px;
  font-size: 12px;
  font-weight: 700;
}

.change-projection-list {
  margin-top: 14px;
  border-top: 1px solid #99f6e4;
}

.change-projection-row {
  padding: 14px 0;
  border-bottom: 1px solid #ccfbf1;
}

.change-projection-row:last-child {
  padding-bottom: 0;
  border-bottom: 0;
}

.change-projection-summary strong {
  color: #134e4a;
}

.change-projection-summary p {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  margin: 5px 0 0;
  color: #4b5563;
}

.change-projection-summary b {
  color: #111827;
}

.change-projection-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  margin: 10px 0 0;
}

.change-projection-meta div {
  display: flex;
  gap: 5px;
  min-width: 0;
}

.change-projection-meta dt {
  color: #6b7280;
  font-weight: 700;
}

.change-projection-meta dd {
  margin: 0;
  color: #1f2937;
  overflow-wrap: anywhere;
}

.change-history {
  margin-top: 12px;
}

.change-history summary {
  color: #0f766e;
  cursor: pointer;
  font-weight: 800;
}

.change-history ol {
  margin: 10px 0 0;
  padding: 0;
  list-style: none;
}

.change-history li {
  border-left: 2px solid #5eead4;
  padding: 6px 0 10px 12px;
}

.change-history-main {
  justify-content: flex-start;
  flex-wrap: wrap;
}

.change-history time {
  color: #6b7280;
  font-variant-numeric: tabular-nums;
}

.change-history li p {
  margin: 5px 0 0;
  color: #4b5563;
  line-height: 1.5;
}

.change-reversal-label {
  border-color: #facc15;
  background: #fef9c3;
  color: #854d0e;
  padding: 2px 6px;
}

.source-memory-detail-note-panel {
  border: 1px solid #bfdbfe;
  border-radius: 8px;
  background: #eff6ff;
  padding: 16px;
}

.note-refresh-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
}

.note-refresh-head h2 {
  margin: 0;
  font-size: 18px;
}

.note-refresh-badge {
  border: 1px solid #93c5fd;
  border-radius: 999px;
  background: #dbeafe;
  color: #1d4ed8;
  padding: 5px 10px;
  font-size: 12px;
  font-weight: 800;
  white-space: nowrap;
}

.note-refresh-copy,
.note-refresh-helper {
  margin: 10px 0 0;
  color: #334155;
  line-height: 1.6;
}

.note-refresh-label {
  display: block;
  margin: 12px 0 6px;
  color: #1e3a8a;
  font-size: 13px;
  font-weight: 800;
}

.source-memory-detail-note-input {
  box-sizing: border-box;
  width: 100%;
  min-height: 108px;
  resize: vertical;
  border: 1px solid #93c5fd;
  border-radius: 8px;
  background: #ffffff;
  color: #111827;
  padding: 10px 12px;
  font: inherit;
  line-height: 1.5;
}

.source-memory-detail-note-input:focus {
  outline: 2px solid #2563eb;
  outline-offset: 2px;
}

.source-memory-detail-note-input:disabled {
  cursor: not-allowed;
  background: #f8fafc;
  color: #64748b;
}

.note-refresh-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 12px;
}

.note-refresh-actions button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.note-update-receipt {
  margin-top: 12px;
  border: 1px solid #bfdbfe;
  border-radius: 8px;
  background: #ffffff;
  color: #1e3a8a;
  padding: 12px;
}

.note-update-receipt.success {
  border-color: #bbf7d0;
  color: #166534;
}

.note-update-receipt.error {
  border-color: #fecaca;
  color: #991b1b;
}

.note-update-receipt p {
  margin: 8px 0 0;
  color: #334155;
  line-height: 1.55;
}

.note-update-evidence {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}

.note-update-evidence span {
  border: 1px solid #cbd5e1;
  border-radius: 999px;
  background: #ffffff;
  color: #334155;
  padding: 5px 9px;
  font-size: 12px;
  font-weight: 700;
}

.note-update-next {
  font-weight: 700;
}

.visual-panel {
  border: 1px solid #bae6fd;
  border-radius: 8px;
  background: #f0f9ff;
  padding: 16px;
}

.visual-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
}

.visual-head h2 {
  margin: 0;
  font-size: 20px;
}

.visual-badge {
  border: 1px solid #67e8f9;
  border-radius: 999px;
  background: #ecfeff;
  color: #0e7490;
  padding: 5px 10px;
  font-size: 12px;
  font-weight: 800;
}

.visual-caption {
  margin: 10px 0 0;
  color: #334155;
  overflow-wrap: anywhere;
}

.visual-meta-list {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin: 12px 0 0;
}

.visual-meta-list div {
  min-width: 140px;
  border: 1px solid #dbeafe;
  border-radius: 8px;
  background: #ffffff;
  padding: 8px 10px;
}

.visual-meta-list dt {
  color: #64748b;
  font-size: 12px;
  font-weight: 800;
}

.visual-meta-list dd {
  margin: 4px 0 0;
  color: #0f172a;
  overflow-wrap: anywhere;
}

.visual-svg-preview {
  margin-top: 14px;
  border: 1px solid #dbeafe;
  border-radius: 8px;
  background: #ffffff;
  overflow: hidden;
}

.visual-svg-stage {
  position: relative;
  isolation: isolate;
  max-height: 420px;
  overflow: auto;
  padding: 12px;
}

.visual-svg-stage :deep(svg) {
  position: static !important;
  inset: auto !important;
  display: block;
  width: 100% !important;
  max-width: none;
  height: auto;
  margin: 0 auto;
}

.visual-svg-stage :deep(svg *) {
  position: static !important;
  inset: auto !important;
}

.visual-preview-note {
  margin: 0;
  border-top: 1px solid #dbeafe;
  padding: 9px 10px;
  color: #475569;
  font-size: 12px;
}

.visual-table-wrap {
  margin-top: 14px;
  overflow-x: auto;
  border: 1px solid #dbeafe;
  border-radius: 8px;
  background: #ffffff;
}

.visual-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 720px;
}

.visual-table th,
.visual-table td {
  border-bottom: 1px solid #e5e7eb;
  border-right: 1px solid #e5e7eb;
  padding: 8px 10px;
  text-align: left;
  vertical-align: top;
  color: #1f2937;
  font-size: 13px;
  line-height: 1.45;
}

.visual-table th:last-child,
.visual-table td:last-child {
  border-right: 0;
}

.visual-table tr:last-child td {
  border-bottom: 0;
}

.visual-table th {
  background: #eff6ff;
  color: #1e3a8a;
  font-weight: 800;
}

.visual-table-note {
  margin: 0;
  border-top: 1px solid #dbeafe;
  padding: 9px 10px;
  color: #475569;
  font-size: 12px;
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

.source-url.hidden {
  color: #6b7280;
  font-weight: 700;
}

.meta-list .source-url-boundary {
  margin-top: 4px;
  color: #92400e;
  font-size: 13px;
  line-height: 1.5;
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

  .distillation-downstream,
  .distillation-summary div,
  .deep-artifact-grid,
  .deep-storyline-row {
    grid-template-columns: 1fr;
  }

  .change-ledger-head,
  .change-projection-summary {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
