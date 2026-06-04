import {
  hasSensitiveUrlSignal,
  isSensitiveControlDescriptor,
} from '../web-intelligence/contextRecallGuards.js';
import {
  captureComposerTextSnapshot,
  findActiveComposerContext,
  insertTextIntoComposer,
  isComposerElement,
  readComposerText,
  restoreComposerTextSnapshot,
  type ComposerTextSnapshot,
} from './siteContextAdapters.js';
import {
  DEFAULT_ASSIST_CONFIDENCE_THRESHOLD,
  getComposerAssistPreviewText,
  getNextComposerAssistThreshold,
  normalizeComposerAssistThreshold,
  sanitizeComposerAssistInsertText,
} from './assistPreviewPolicy.js';
import {
  CONFIDENCE_THRESHOLD_CONFIG_KEY,
  ENV_CONFIG_KEY,
  isComposerAssistEnabledFromConfig,
} from './assistConfig.js';
import type {
  ComposerAssistRequest,
  ComposerAssistResponse,
  ComposerTarget,
  SiteContextSnapshot,
} from './types.js';

const ROOT_ID = 'pai-composer-guard-root';
const STYLE_ID = 'pai-composer-guard-styles';
const REQUEST_DEBOUNCE_MS = 700;
const DISMISS_TTL_MS = 30 * 60 * 1000;
const INSERT_UNDO_TTL_MS = 10 * 1000;
const FEEDBACK_EVENTS_KEY = 'composerGuardFeedbackEvents';
const MAX_FEEDBACK_EVENTS = 100;
const ICON_SIZE = 24;
const ICON_IMAGE_SIZE = 22;
const ICON_INSET = 6;
const POPOVER_GAP = 6;
const VIEWPORT_MARGIN = 8;
const MIN_POPOVER_HEIGHT = 140;
const DEFAULT_POPOVER_HEIGHT = 260;
const AMBIENT_DRAFT_TTL_MS = 5 * 60 * 1000;
const AMBIENT_EVIDENCE_LIMIT = 12;

type GuardState = 'ready';
type AssistFeedbackKind = 'accepted' | 'rejected';

interface ActiveComposerSession {
  target: ComposerTarget;
  snapshot: SiteContextSnapshot;
  contextKey: string;
  draftText: string;
  draftRevision: number;
}

interface ComposerGuardFeedbackEvent {
  kind: AssistFeedbackKind;
  timestamp: number;
  thresholdBefore: number;
  thresholdAfter: number;
  confidence?: number;
  suggestionType?: ComposerAssistResponse['suggestionType'];
  surface?: SiteContextSnapshot['surface'];
  scenario?: SiteContextSnapshot['scenario'];
  contextType?: SiteContextSnapshot['contextType'];
  contextKey?: string;
}

interface ComposerGuardFeedbackContext {
  assist: ComposerAssistResponse | null;
  contextKey?: string;
  snapshot?: SiteContextSnapshot;
}

interface RehearsalFeedbackTarget {
  id: string;
  type: ComposerAssistResponse['evidence'][number]['type'];
  activationId?: string;
  title?: string;
  sourceLabel?: string;
  sourceUrl?: string;
  sourceTitle?: string;
  displayPriority?: string;
  evidenceRole?: string;
  reasonType?: string;
}

interface PendingInsertionUndo {
  target: ComposerTarget;
  before: ComposerTextSnapshot;
  beforeText: string;
  contextKey: string;
  feedbackContext: ComposerGuardFeedbackContext;
  suggestionText: string;
  insertedAt: number;
  sendTraceRecorded?: boolean;
}

interface AmbientAssistDraft {
  target: ComposerTarget;
  contextKey: string;
  feedbackContext: ComposerGuardFeedbackContext;
  suggestionText: string;
  beforeText?: string;
  recordedAt: number;
  sourceRequestId: string;
  sendTraceRecorded?: boolean;
}

interface AmbientDiffSummary {
  action:
    | 'sent_after_insert'
    | 'sent_without_insert'
    | 'edited_before_send'
    | 'deleted_before_send'
    | 'inserted'
    | 'wrong'
    | 'downstream_reaction';
  polarity: 'positive' | 'negative' | 'correction' | 'neutral';
  strength: 'weak' | 'medium' | 'strong';
  redactedDiff: Record<string, unknown>;
  evidenceRole: 'used' | 'ignored' | 'corrected' | 'deleted';
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function getDraftContextSignature(draftText: string): string {
  const normalized = draftText.replace(/\s+/g, ' ').trim().slice(0, 500);
  if (!normalized) return 'empty';

  let hash = 0;
  for (let index = 0; index < normalized.length; index += 1) {
    hash = ((hash << 5) - hash + normalized.charCodeAt(index)) | 0;
  }
  return Math.abs(hash).toString(36);
}

function buildSessionContextKey(
  snapshot: SiteContextSnapshot,
  target: ComposerTarget,
  draftText: string,
): string {
  const baseKey = `${snapshot.contextKey}|${target.mode || 'composer'}`;
  if (snapshot.contextType !== 'web_agent_prompt') {
    return baseKey;
  }
  return `${baseKey}|draft:${getDraftContextSignature(draftText)}`;
}

function looksLikeSendableComposerText(text?: string): boolean {
  const cleaned = sanitizeComposerAssistInsertText(text);
  if (!cleaned) return false;
  if (/^我理解当前是在讨论[:：]/.test(cleaned)) return false;
  if (/^我这边先补充几个相关点[:：]/.test(cleaned)) return false;
  if (/^我补充一下相关背景[:：]/.test(cleaned)) return false;
  if (/Personal AI context|Please review/i.test(cleaned)) return false;
  return true;
}

function getRehearsalCueLabel(assist: ComposerAssistResponse): string | null {
  const rehearsal = assist.evidence.find((item) => item.type === 'rehearsal');
  if (!rehearsal) return null;
  const reasons = rehearsal.whyRelevant?.filter(Boolean).slice(0, 2) ?? [];
  const suffix = reasons.length ? ` · ${reasons.join(' / ')}` : '';
  return `预演提醒${suffix}`;
}

function getComposerGuardAssistLabel(
  assist: ComposerAssistResponse,
  snapshot: SiteContextSnapshot,
): { label: string; title: string } {
  if (snapshot.contextType === 'web_agent_prompt') {
    if (hasComposerEvidenceSource(assist, 'agent')) {
      return { label: 'Agent 历史上下文', title: '插入 agent 上下文' };
    }
    if (hasComposerEvidenceSource(assist, 'jira')) {
      return { label: 'Jira / 项目上下文', title: '插入项目上下文' };
    }
    if (hasComposerEvidenceSource(assist, 'meeting')) {
      return { label: '会议上下文', title: '插入会议上下文' };
    }
    if (hasComposerEvidenceSource(assist, 'ai')) {
      return { label: '跨 AI 上下文', title: '插入跨 AI 上下文' };
    }
    return { label: '跨 AI 上下文', title: '插入跨 AI 上下文' };
  }
  return { label: '建议内容', title: '插入建议内容' };
}

function hasComposerEvidenceSource(
  assist: ComposerAssistResponse,
  kind: 'agent' | 'jira' | 'meeting' | 'ai',
): boolean {
  return assist.evidence.some((item) => {
    const labels = [
      item.sourceLabel,
      item.sourceTitle,
      item.title,
      String(item.metadata?.sourceType || ''),
      String(item.metadata?.source_type || ''),
      String((item.metadata?.importSourceMetadata as any)?.provider || ''),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    if (kind === 'agent') {
      return /\b(codex_cli|claude_code_cli|cursor_agent_cli)\b/.test(labels);
    }
    if (kind === 'jira') {
      return /\bjira\b|[A-Z][A-Z0-9]+-\d+/i.test(labels);
    }
    if (kind === 'meeting') {
      return /\b(meeting|calendar)\b|会议|会前/.test(labels);
    }
    return /\b(ai_chat|chatgpt|doubao|doubao_chat|claude|gemini)\b/.test(
      labels,
    );
  });
}

function shouldReviewComposerAssistBeforeInsert(
  assist: ComposerAssistResponse,
): boolean {
  return assist.previewRequired || assist.riskLevel === 'high';
}

function hasRehearsalEvidence(assist: ComposerAssistResponse): boolean {
  return assist.evidence.some((item) => item.type === 'rehearsal');
}

function getComposerGuardReviewNote(assist: ComposerAssistResponse): string {
  if (assist.riskLevel === 'high') {
    return '高风险建议：插入前请先核对事实、语气和敏感信息。';
  }
  if (hasRehearsalEvidence(assist)) {
    return '预演提醒：确认这个未来场景提示仍适合当前回复，再插入草稿。';
  }
  return '建议先预览：确认上下文适合后再插入草稿。';
}

function getComposerEvidenceTypeLabel(
  item: ComposerAssistResponse['evidence'][number],
): string {
  if (item.type === 'rehearsal') return '预演提醒';
  if (item.type === 'source_memory') return '资料记忆';
  if (item.type === 'message') return '消息记忆';
  if (item.type === 'entity') return '人物/实体';
  return '记忆片段';
}

function clipReviewEvidencePart(value?: string, maxLength = 54): string {
  const normalized = (value || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength).trimEnd()}...`;
}

function getComposerGuardReviewEvidenceLines(
  assist: ComposerAssistResponse,
): string[] {
  return assist.evidence.slice(0, 3).map((item, index) => {
    const sourceLabel = clipReviewEvidencePart(
      item.sourceLabel ||
        String(item.metadata?.sourceType || item.metadata?.source_type || ''),
      32,
    );
    const title =
      assist.riskLevel === 'high'
        ? ''
        : clipReviewEvidencePart(item.sourceTitle || item.title, 54);
    const reason =
      assist.riskLevel === 'high'
        ? ''
        : clipReviewEvidencePart(
            item.whyRelevant?.[0] || item.whyMatched || '',
            64,
          );
    const score =
      typeof item.score === 'number' && Number.isFinite(item.score)
        ? `${Math.round(item.score * 100)}%`
        : '';
    const parts = [
      `M${index + 1}`,
      getComposerEvidenceTypeLabel(item),
      sourceLabel,
      title,
      score,
      reason,
    ].filter(Boolean);
    return parts.join(' · ');
  });
}

function isSensitiveEditableElement(element: HTMLElement): boolean {
  const input = element as HTMLInputElement;
  return isSensitiveControlDescriptor({
    type: input.type || element.getAttribute('type'),
    autocomplete: element.getAttribute('autocomplete'),
    name: element.getAttribute('name'),
    id: element.id,
    ariaLabel: element.getAttribute('aria-label'),
    placeholder:
      element.getAttribute('placeholder') ||
      element.getAttribute('data-placeholder'),
    inputMode: element.getAttribute('inputmode'),
  });
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function hashAmbientText(text: string): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  let hash = 2166136261;
  for (let index = 0; index < normalized.length; index += 1) {
    hash ^= normalized.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function normalizeAmbientText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenizeAmbientText(text: string): string[] {
  const normalized = normalizeAmbientText(text);
  if (!normalized) return [];
  const tokens = normalized.match(/[a-z0-9]+|[\u4e00-\u9fff]+/g) || [];
  if (tokens.length > 1) return tokens;
  return Array.from(normalized.replace(/\s+/g, '')).filter(Boolean);
}

function getAmbientSimilarityScore(left: string, right: string): number {
  const normalizedLeft = normalizeAmbientText(left);
  const normalizedRight = normalizeAmbientText(right);
  if (!normalizedLeft || !normalizedRight) return 0;
  if (normalizedLeft === normalizedRight) return 1;
  if (
    normalizedLeft.includes(normalizedRight) ||
    normalizedRight.includes(normalizedLeft)
  ) {
    return (
      Math.min(normalizedLeft.length, normalizedRight.length) /
      Math.max(normalizedLeft.length, normalizedRight.length)
    );
  }

  const leftTokens = new Set(tokenizeAmbientText(normalizedLeft));
  const rightTokens = new Set(tokenizeAmbientText(normalizedRight));
  if (!leftTokens.size || !rightTokens.size) return 0;

  let overlap = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) overlap += 1;
  }
  const union = new Set([...leftTokens, ...rightTokens]).size;
  return union > 0 ? overlap / union : 0;
}

function getAmbientEditDistanceBand(score: number): string {
  if (score >= 0.92) return 'none';
  if (score >= 0.65) return 'light';
  if (score >= 0.35) return 'material';
  return 'replacement';
}

function hasCasualHaha(text: string): boolean {
  return /(^|\s|[，。！？!?])哈[哈啊]*|haha/i.test(text);
}

function hasTildeSuffix(text: string): boolean {
  return /[~～]\s*$/.test(text.trim());
}

function hasOverEnthusiasticClaim(text: string): boolean {
  return /最喜欢聊|最爱聊|特别喜欢聊|love to talk/i.test(text);
}

function hasGenericFuturePromise(text: string): boolean {
  return /到时候看你具体|具体想了解哪块|看你想了解哪块|when you want to know/i.test(
    text,
  );
}

function hasPerformativeCollaborationPhrase(text: string): boolean {
  return /一起捣鼓|一起搞一下|咱们一起|we can figure it out together/i.test(text);
}

function buildAmbientStyleFeatureTags(
  suggestion: string,
  final: string,
  similarity: number,
): string[] {
  const tags = new Set<string>();
  if (hasCasualHaha(final)) tags.add('casual_opening_haha');
  if (hasTildeSuffix(final)) tags.add('tilde_suffix');
  if (similarity >= 0.35 && final.length < suggestion.length * 0.72) {
    tags.add('same_intent_shorter_form');
    tags.add('more_direct');
  }
  if (
    /^我这边先补充几个相关点|^我补充一下相关背景|^我理解当前/.test(
      suggestion.trim(),
    ) &&
    !/^我这边先补充几个相关点|^我补充一下相关背景|^我理解当前/.test(
      final.trim(),
    )
  ) {
    tags.add('removed_preamble');
  }
  if (hasOverEnthusiasticClaim(suggestion)) {
    tags.add(
      hasOverEnthusiasticClaim(final)
        ? 'over_enthusiastic_claim'
        : 'removed_over_enthusiastic_claim',
    );
  }
  if (hasGenericFuturePromise(suggestion)) {
    tags.add(
      hasGenericFuturePromise(final)
        ? 'generic_future_promise'
        : 'removed_generic_future_promise',
    );
  }
  if (hasPerformativeCollaborationPhrase(suggestion)) {
    tags.add(
      hasPerformativeCollaborationPhrase(final)
        ? 'performative_collaboration_phrase'
        : 'removed_performative_collaboration_phrase',
    );
  }
  return Array.from(tags);
}

function buildAmbientDiffSummary(
  suggestionText: string,
  finalText: string,
  mode: 'after_insert' | 'without_insert',
): AmbientDiffSummary {
  const suggestion = sanitizeComposerAssistInsertText(suggestionText);
  const final = finalText.trim();
  const similarity = getAmbientSimilarityScore(suggestion, final);
  const normalizedSuggestion = normalizeAmbientText(suggestion);
  const normalizedFinal = normalizeAmbientText(final);
  const containsSuggestion =
    Boolean(normalizedSuggestion) &&
    Boolean(normalizedFinal) &&
    normalizedFinal.includes(normalizedSuggestion);
  const lengthRatio =
    suggestion.length > 0 ? final.length / Math.max(1, suggestion.length) : 0;
  const styleFeatureTags = buildAmbientStyleFeatureTags(
    suggestion,
    final,
    similarity,
  );
  const redactedDiff = {
    rawTextStored: false,
    suggestionHash: hashAmbientText(suggestion),
    finalHash: hashAmbientText(final),
    suggestionTextLength: suggestion.length,
    finalTextLength: final.length,
    similarityScore: Number(similarity.toFixed(3)),
    editDistanceBand: getAmbientEditDistanceBand(similarity),
    lengthChange:
      lengthRatio < 0.72 ? 'shorter' : lengthRatio > 1.28 ? 'longer' : 'similar',
    semanticRelation:
      similarity >= 0.65 || containsSuggestion
        ? 'same_intent'
        : similarity >= 0.35
          ? 'partially_rewritten'
          : 'different_intent',
    styleFeatureTags,
  };

  if (!final) {
    return {
      action: 'deleted_before_send',
      polarity: 'negative',
      strength: 'strong',
      redactedDiff,
      evidenceRole: 'deleted',
    };
  }

  if (mode === 'without_insert') {
    return {
      action: 'sent_without_insert',
      polarity: similarity >= 0.35 ? 'correction' : 'negative',
      strength: similarity >= 0.35 ? 'medium' : 'strong',
      redactedDiff: {
        ...redactedDiff,
        interaction: 'hover_no_insert',
      },
      evidenceRole: similarity >= 0.35 ? 'corrected' : 'ignored',
    };
  }

  if (similarity >= 0.92 || containsSuggestion) {
    return {
      action: 'sent_after_insert',
      polarity: 'positive',
      strength: 'strong',
      redactedDiff,
      evidenceRole: 'used',
    };
  }

  if (similarity >= 0.35) {
    return {
      action: 'edited_before_send',
      polarity: 'correction',
      strength: 'strong',
      redactedDiff,
      evidenceRole: 'corrected',
    };
  }

  return {
    action: 'deleted_before_send',
    polarity: 'negative',
    strength: 'strong',
    redactedDiff,
    evidenceRole: 'deleted',
  };
}

function getAmbientTraceSourceRequestId(
  contextKey: string,
  recordedAt: number,
): string {
  return `composer:${hashAmbientText(`${contextKey}:${recordedAt}`)}`;
}

function getChromeLocal<T extends Record<string, unknown>>(
  keys: string | string[],
): Promise<T> {
  return new Promise((resolve) => {
    if (typeof chrome === 'undefined' || !chrome?.storage?.local) {
      resolve({} as T);
      return;
    }
    chrome.storage.local.get(keys, (result) => resolve(result as T));
  });
}

function setChromeLocal(items: Record<string, unknown>): Promise<void> {
  return new Promise((resolve) => {
    if (typeof chrome === 'undefined' || !chrome?.storage?.local) {
      resolve();
      return;
    }
    chrome.storage.local.set(items, () => resolve());
  });
}

function sendRuntimeMessage(message: unknown): Promise<unknown> {
  return new Promise((resolve, reject) => {
    if (typeof chrome === 'undefined' || !chrome?.runtime?.sendMessage) {
      resolve(undefined);
      return;
    }
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(response);
    });
  });
}

function asPlainObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function getStructuredEvidenceFeedbackTargets(
  assist: ComposerAssistResponse | null,
): RehearsalFeedbackTarget[] {
  if (!assist?.evidence?.length) return [];
  const targets = new Map<string, RehearsalFeedbackTarget>();

  for (const item of assist.evidence) {
    const targetId = getEvidenceFeedbackTargetId(item);
    if (!targetId) continue;
    const key = `${item.type}:${targetId}`;
    if (targets.has(key)) continue;

    const rehearsalMeta = asPlainObject(item.metadata?.rehearsal);
    const activationId =
      item.type === 'rehearsal' &&
      typeof rehearsalMeta?.activationId === 'string' &&
      rehearsalMeta.activationId.trim()
        ? rehearsalMeta.activationId.trim()
        : undefined;
    targets.set(key, {
      id: targetId,
      type: item.type,
      activationId,
      title: item.title,
      sourceLabel: item.sourceLabel,
      sourceUrl: item.sourceUrl,
      sourceTitle: item.sourceTitle,
      displayPriority: item.displayPriority,
      evidenceRole: item.evidenceRole,
      reasonType: item.reasonType,
    });
  }

  return Array.from(targets.values()).slice(0, 5);
}

function getEvidenceFeedbackTargetId(
  item: ComposerAssistResponse['evidence'][number],
): string {
  if (item.type === 'source_memory') {
    const sourceMemoryId = item.metadata?.sourceMemoryCapsuleId;
    const id =
      typeof sourceMemoryId === 'string' && sourceMemoryId.trim()
        ? sourceMemoryId.trim()
        : item.id.trim();
    return id.replace(/^source-memory:/, '');
  }

  if (item.type === 'rehearsal') {
    const rehearsalMeta = asPlainObject(item.metadata?.rehearsal);
    const id =
      typeof rehearsalMeta?.id === 'string' && rehearsalMeta.id.trim()
        ? rehearsalMeta.id.trim()
        : item.id.trim();
    return id;
  }

  return item.id.trim();
}

function buildStructuredFeedbackDetail(
  kind: AssistFeedbackKind,
  snapshot?: SiteContextSnapshot,
  contextKey?: string,
  target?: RehearsalFeedbackTarget,
): string {
  const action = kind === 'accepted' ? 'positive' : 'negative';
  const detail = {
    version: '1',
    interaction:
      kind === 'rejected'
        ? 'memory_relevance_trainer'
        : 'context_recall_feedback',
    surface: 'compose_assist',
    action,
    auto_applied: kind === 'rejected' ? 'true' : undefined,
    feedback_reason:
      kind === 'rejected' ? 'should_not_use_for_reply' : undefined,
    scene_anchor_signature:
      compactStructuredFeedbackDetailValue(contextKey || snapshot?.contextKey, 220),
    compose_surface: compactStructuredFeedbackDetailValue(snapshot?.surface, 80),
    context_type: compactStructuredFeedbackDetailValue(snapshot?.contextType, 80),
    scenario: compactStructuredFeedbackDetailValue(snapshot?.scenario, 80),
    group_id: compactStructuredFeedbackDetailValue(
      snapshot?.identifiers?.groupId || snapshot?.audience?.groupId,
      120,
    ),
    conversation_id: compactStructuredFeedbackDetailValue(
      snapshot?.identifiers?.conversationId ||
        snapshot?.audience?.conversationId,
      120,
    ),
    issue_key: compactStructuredFeedbackDetailValue(
      snapshot?.identifiers?.issueKey || snapshot?.audience?.issueKey,
      80,
    ),
    current_title: compactStructuredFeedbackDetailValue(snapshot?.title, 140),
    current_url: compactStructuredFeedbackDetailValue(snapshot?.url, 220),
    target_type: target?.type,
    source_label: compactStructuredFeedbackDetailValue(target?.sourceLabel, 100),
    source_title: compactStructuredFeedbackDetailValue(target?.sourceTitle, 140),
    source_url: compactStructuredFeedbackDetailValue(target?.sourceUrl, 220),
    display_priority: compactStructuredFeedbackDetailValue(
      target?.displayPriority,
      40,
    ),
    evidence_role: compactStructuredFeedbackDetailValue(target?.evidenceRole, 80),
    reason_type: compactStructuredFeedbackDetailValue(target?.reasonType, 80),
  };

  return JSON.stringify(
    Object.fromEntries(
      Object.entries(detail).filter(([, value]) => Boolean(value)),
    ),
  );
}

function compactStructuredFeedbackDetailValue(
  value: unknown,
  maxLength = 160,
): string | undefined {
  const normalized =
    typeof value === 'string'
      ? value.replace(/\s+/g, ' ').trim()
      : value == null
      ? ''
      : String(value).replace(/\s+/g, ' ').trim();
  if (!normalized) return undefined;
  return normalized.length > maxLength
    ? `${normalized.slice(0, maxLength).trimEnd()}...`
    : normalized;
}

function isUsableViewportRect(rect: DOMRect): boolean {
  return (
    Number.isFinite(rect.top) &&
    Number.isFinite(rect.right) &&
    Number.isFinite(rect.bottom) &&
    Number.isFinite(rect.left) &&
    rect.width >= 4 &&
    rect.height >= 4 &&
    rect.bottom > 0 &&
    rect.right > 0 &&
    rect.top < window.innerHeight &&
    rect.left < window.innerWidth
  );
}

function getUsableElementRect(element: HTMLElement): DOMRect | null {
  const style = window.getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden') {
    return null;
  }

  const rect = element.getBoundingClientRect();
  if (isUsableViewportRect(rect)) {
    return rect;
  }

  for (const clientRect of Array.from(element.getClientRects())) {
    const domRect = DOMRect.fromRect(clientRect);
    if (isUsableViewportRect(domRect)) {
      return domRect;
    }
  }

  return null;
}

export class ComposerGuardController {
  private root: HTMLDivElement | null = null;
  private activeSession: ActiveComposerSession | null = null;
  private latestAssist: ComposerAssistResponse | null = null;
  private requestTimer: number | null = null;
  private positionTimer: number | null = null;
  private undoTimer: number | null = null;
  private requestSeq = 0;
  private dismissedContexts = new Map<string, number>();
  private assistConfidenceThreshold = DEFAULT_ASSIST_CONFIDENCE_THRESHOLD;
  private configLoaded = false;
  private composeAssistEnabled = false;
  private pendingInsertionUndo: PendingInsertionUndo | null = null;
  private acceptedInsertionDraft: AmbientAssistDraft | null = null;
  private previewedAssistDraft: AmbientAssistDraft | null = null;
  private restoringSnapshot = false;
  private reviewMode = false;

  start(): void {
    if (hasSensitiveUrlSignal(window.location.href)) {
      return;
    }

    document.addEventListener('focusin', this.handleFocusIn, true);
    document.addEventListener('input', this.handleInput, true);
    document.addEventListener('keydown', this.handleKeyDown, true);
    document.addEventListener('click', this.handleDocumentClick, true);
    window.addEventListener('scroll', this.schedulePositionRefresh, true);
    window.addEventListener('resize', this.schedulePositionRefresh);
    if (typeof chrome !== 'undefined' && chrome?.storage?.onChanged) {
      chrome.storage.onChanged.addListener(this.handleStorageChanged);
    }
    void this.loadComposerGuardConfig().then(() => {
      if (!this.composeAssistEnabled) return;
      this.injectStyles();
      this.activateFromElement(document.activeElement, true);
    });
  }

  private handleStorageChanged = (
    changes: Record<string, chrome.storage.StorageChange>,
    areaName: string,
  ): void => {
    if (areaName !== 'local' || !changes[ENV_CONFIG_KEY]) return;
    const nextConfig = changes[ENV_CONFIG_KEY].newValue as
      | Record<string, unknown>
      | undefined;
    const wasEnabled = this.composeAssistEnabled;
    this.configLoaded = true;
    this.applyComposerGuardConfig(nextConfig);
    if (!this.composeAssistEnabled) {
      this.clear();
      return;
    }
    if (!wasEnabled) {
      this.injectStyles();
      this.activateFromElement(document.activeElement, true);
      return;
    }
    this.renderIfUseful();
  };

  private handleFocusIn = (event: FocusEvent): void => {
    if (!this.canRunComposerAssist()) {
      this.clearIfConfigReadyAndDisabled();
      return;
    }
    const target = event.target instanceof Element ? event.target : null;
    this.activateFromElement(target, false);
  };

  private handleInput = (event: Event): void => {
    if (this.restoringSnapshot) return;
    if (!this.canRunComposerAssist()) {
      this.clearIfConfigReadyAndDisabled();
      return;
    }
    const target = event.target instanceof Element ? event.target : null;
    if (!target || !isComposerElement(target)) return;
    if (!this.activeSession || !this.isEventFromActiveTarget(target)) {
      this.activateFromElement(target, true);
      return;
    }
    if (this.refreshActiveDraft()) {
      this.latestAssist = null;
      this.removeAffordance();
      this.scheduleAssistRequest();
    }
  };

  private handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape' && this.root) {
      this.dismissCurrentContext();
      return;
    }
    if (
      event.key === 'Enter' &&
      (event.metaKey || event.ctrlKey) &&
      !event.shiftKey &&
      !event.isComposing
    ) {
      const target = event.target instanceof Element ? event.target : null;
      if (target && isComposerElement(target)) {
        void this.recordAmbientSendTrace(target, 'keyboard_send');
      }
    }
  };

  private handleDocumentClick = (event: MouseEvent): void => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target || this.root?.contains(target)) return;
    const sendElement = this.findLikelySendElement(target);
    if (!sendElement) return;
    void this.recordAmbientSendTrace(sendElement, 'send_click');
  };

  private activateFromElement(
    fromElement?: Element | null,
    requestImmediately = false,
  ): void {
    if (!this.canRunComposerAssist()) {
      this.clearIfConfigReadyAndDisabled();
      return;
    }

    if (hasSensitiveUrlSignal(window.location.href)) {
      this.clear();
      return;
    }

    const context = findActiveComposerContext(
      document,
      window.location,
      fromElement,
    );
    if (!context) {
      if (fromElement && this.root?.contains(fromElement)) {
        return;
      }
      if (fromElement && isComposerElement(fromElement)) {
        this.clear();
      } else if (fromElement) {
        this.clear();
      }
      return;
    }

    if (isSensitiveEditableElement(context.target.element)) {
      this.clear();
      return;
    }

    const draftText = readComposerText(context.target);
    const contextKey = buildSessionContextKey(
      context.snapshot,
      context.target,
      draftText,
    );
    if (this.isDismissed(contextKey)) {
      this.clear();
      return;
    }

    const previousTargetElement = this.activeSession?.target.element ?? null;
    const contextChanged = this.activeSession?.contextKey !== contextKey;
    const draftRevision = contextChanged
      ? 0
      : this.activeSession?.draftRevision ?? 0;
    if (
      previousTargetElement &&
      previousTargetElement !== context.target.element
    ) {
      previousTargetElement.classList.remove('pai-composer-guard-target-glow');
    }

    this.activeSession = {
      target: context.target,
      snapshot: context.snapshot,
      contextKey,
      draftText,
      draftRevision,
    };

    if (contextChanged) {
      this.latestAssist = null;
      this.reviewMode = false;
      this.removeAffordance();
    } else {
      this.renderIfUseful();
    }

    this.positionRoot();
    if (requestImmediately || contextChanged || !this.latestAssist) {
      this.scheduleAssistRequest();
    }
  }

  private isEventFromActiveTarget(target: Element): boolean {
    const activeTarget = this.activeSession?.target.element;
    return Boolean(
      activeTarget &&
        (activeTarget === target ||
          activeTarget.contains(target) ||
          target.contains(activeTarget)),
    );
  }

  private findLikelySendElement(target: Element): HTMLElement | null {
    const candidate = target.closest(
      'button,input[type="button"],input[type="submit"],[role="button"],[data-testid],[data-test-id],[data-test-automation-id]',
    );
    if (!(candidate instanceof HTMLElement)) return null;
    if (candidate.closest(`#${ROOT_ID}`)) return null;
    if (
      candidate instanceof HTMLButtonElement ||
      candidate instanceof HTMLInputElement
    ) {
      if (candidate.disabled) return null;
    }

    const hint = [
      candidate.getAttribute('aria-label'),
      candidate.getAttribute('title'),
      candidate.getAttribute('type'),
      candidate.getAttribute('data-testid'),
      candidate.getAttribute('data-test-id'),
      candidate.getAttribute('data-test-automation-id'),
      candidate.id,
      candidate.className,
      candidate.textContent,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    if (!hint) return null;
    const looksSend =
      /\b(send|submit|reply|post|comment)\b/.test(hint) ||
      /发送|提交|回复|评论|发布/.test(hint);
    return looksSend ? candidate : null;
  }

  private isElementNearComposerTarget(
    element: Element,
    target: ComposerTarget,
  ): boolean {
    const targetElement = target.element;
    if (
      element === targetElement ||
      targetElement.contains(element) ||
      element.contains(targetElement)
    ) {
      return true;
    }

    const form = targetElement.closest('form');
    if (form?.contains(element)) return true;

    let parent = targetElement.parentElement;
    for (let depth = 0; parent && depth < 5; depth += 1) {
      if (parent.contains(element)) return true;
      parent = parent.parentElement;
    }

    return false;
  }

  private refreshActiveDraft(): boolean {
    if (!this.activeSession) return false;
    const nextDraftText = readComposerText(this.activeSession.target);
    const draftChanged = nextDraftText !== this.activeSession.draftText;
    const nextContextKey = buildSessionContextKey(
      this.activeSession.snapshot,
      this.activeSession.target,
      nextDraftText,
    );
    const contextChanged = nextContextKey !== this.activeSession.contextKey;
    this.activeSession.draftText = nextDraftText;
    if (draftChanged || contextChanged) {
      this.activeSession.contextKey = nextContextKey;
      this.activeSession.draftRevision += 1;
    }
    this.positionRoot();
    if (contextChanged && this.isDismissed(nextContextKey)) {
      this.clear();
      return false;
    }
    return draftChanged || contextChanged;
  }

  private scheduleAssistRequest = (): void => {
    if (!this.canRunComposerAssist()) return;
    if (this.requestTimer != null) {
      window.clearTimeout(this.requestTimer);
    }
    this.requestTimer = window.setTimeout(() => {
      this.requestTimer = null;
      void this.requestAssist();
    }, REQUEST_DEBOUNCE_MS);
  };

  private async requestAssist(): Promise<void> {
    if (!this.activeSession || !this.canRunComposerAssist()) return;

    this.refreshActiveDraft();
    const session = this.activeSession;
    const requestSeq = ++this.requestSeq;
    const draftRevision = session.draftRevision;
    const contextKey = session.contextKey;

    const payload = this.buildAssistRequest(session);

    try {
      const response = await new Promise<ComposerAssistResponse>(
        (resolve, reject) => {
          chrome.runtime.sendMessage(
            {
              type: 'COMPOSER_ASSIST_REQUEST',
              request: payload,
            },
            (rawResponse) => {
              if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
                return;
              }
              if (rawResponse?.success === false) {
                reject(
                  new Error(rawResponse.error || 'composer_assist_failed'),
                );
                return;
              }
              resolve(rawResponse?.result || rawResponse);
            },
          );
        },
      );

      if (
        requestSeq !== this.requestSeq ||
        this.activeSession?.contextKey !== contextKey ||
        this.activeSession?.draftRevision !== draftRevision
      ) {
        return;
      }

      this.latestAssist = response;
      this.renderIfUseful();
    } catch (error) {
      console.warn('[ComposerGuard] assist request failed:', error);
      if (requestSeq === this.requestSeq) {
        this.latestAssist = null;
        this.reviewMode = false;
        this.removeAffordance();
      }
    }
  }

  private buildAssistRequest(
    session: ActiveComposerSession,
  ): ComposerAssistRequest {
    const snapshot = session.snapshot;
    return {
      surface: snapshot.surface,
      contextType: snapshot.contextType,
      scenario: snapshot.scenario,
      title: snapshot.title,
      url: snapshot.url,
      draftText: session.draftText,
      primaryText: snapshot.primaryText,
      secondaryTexts: snapshot.secondaryTexts,
      keywords: snapshot.keywords,
      identifiers: snapshot.identifiers,
      visibleMessages: snapshot.visibleMessages,
      threadRoot: snapshot.threadRoot,
      audience: snapshot.audience,
      contextItems: snapshot.contextItems,
      sourceTypes: snapshot.sourceTypes,
      automationLevel: 'L1',
    };
  }

  private ensureRoot(): HTMLDivElement {
    if (this.root) return this.root;

    const root = document.createElement('div');
    root.id = ROOT_ID;
    root.className = 'pai-composer-guard';
    root.setAttribute('role', 'group');
    root.setAttribute('aria-label', 'Personal AI composer guard');
    document.documentElement.appendChild(root);
    this.root = root;

    return root;
  }

  private hasUsefulAssist(): boolean {
    return Boolean(
      this.canRunComposerAssist() &&
        this.latestAssist?.available &&
        this.latestAssist.insertText &&
        looksLikeSendableComposerText(this.latestAssist.insertText) &&
        this.latestAssist.confidence >= this.assistConfidenceThreshold,
    );
  }

  private renderIfUseful(): void {
    if (!this.hasUsefulAssist()) {
      this.removeAffordance();
      return;
    }

    this.setTargetGlow(true);
    this.render('ready');
  }

  private render(state: GuardState): void {
    if (!this.activeSession || !this.latestAssist) return;
    this.clearInsertionUndo(true);

    const root = this.ensureRoot();
    const assist = this.latestAssist;
    const reviewRequired = shouldReviewComposerAssistBeforeInsert(assist);
    const reviewOpen = this.reviewMode && reviewRequired;
    root.className = `pai-composer-guard${
      reviewOpen ? ' pai-composer-guard--review' : ''
    }`;
    root.dataset.state = reviewOpen ? 'review' : state;
    const iconUrl = chrome.runtime.getURL('icons/icon48.png');
    const preview = this.buildSuggestionPreview(assist, reviewOpen);
    const cueLabel = getRehearsalCueLabel(assist);
    const assistLabel = getComposerGuardAssistLabel(
      assist,
      this.activeSession.snapshot,
    );
    const reviewEvidenceLines = reviewOpen
      ? getComposerGuardReviewEvidenceLines(assist)
      : [];

    root.innerHTML = `
      <button class="pai-composer-guard-icon-button" data-action="insert" type="button" title="${escapeHtml(
        reviewRequired && !reviewOpen ? '先预览建议内容' : assistLabel.title,
      )}" aria-expanded="${reviewOpen ? 'true' : 'false'}">
        <img src="${iconUrl}" alt="Personal AI" />
      </button>
      <div class="pai-composer-guard-popover" aria-hidden="${reviewOpen ? 'false' : 'true'}">
        <div class="pai-composer-guard-header">
          <div class="pai-composer-guard-label">${escapeHtml(
            assistLabel.label,
          )}</div>
          <button class="pai-composer-guard-feedback-button" data-action="reject" type="button" title="减少这类建议" aria-label="减少这类建议">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M10 15.5v3.1c0 .8.7 1.4 1.5 1.4.5 0 .9-.2 1.2-.6l4.2-5.4c.4-.5.6-1.1.6-1.8V5.6c0-1-.8-1.8-1.8-1.8H7.1c-.7 0-1.4.4-1.7 1L2.7 11c-.5 1.2.4 2.5 1.7 2.5H10Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
              <path d="M19 4v10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
        ${
          cueLabel
            ? `<div class="pai-composer-guard-cue">${escapeHtml(cueLabel)}</div>`
            : ''
        }
        ${
          reviewRequired
            ? `<div class="pai-composer-guard-review-note">${escapeHtml(
                getComposerGuardReviewNote(assist),
              )}</div>`
            : ''
        }
        <div class="pai-composer-guard-text">${escapeHtml(preview)}</div>
        ${
          reviewEvidenceLines.length
            ? `<div class="pai-composer-guard-review-evidence" aria-label="建议依据">
                <div class="pai-composer-guard-review-evidence-title">建议依据</div>
                <ul>
                  ${reviewEvidenceLines
                    .map((line) => `<li>${escapeHtml(line)}</li>`)
                    .join('')}
                </ul>
              </div>`
            : ''
        }
        ${
          reviewOpen
            ? `<div class="pai-composer-guard-actions">
                <button class="pai-composer-guard-secondary-action" data-action="close-review" type="button">取消</button>
                <button class="pai-composer-guard-primary-action" data-action="confirm-insert" type="button">插入</button>
              </div>`
            : ''
        }
      </div>
    `;

    const rememberPreview = () => this.rememberPreviewedAssist();
    root.addEventListener('pointerenter', rememberPreview, { once: true });
    root.addEventListener('focusin', rememberPreview, { once: true });

    const insertButton = root.querySelector('[data-action="insert"]');
    insertButton?.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.handleInsertAction();
    });
    insertButton?.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      if ((event as MouseEvent).detail === 0) {
        this.handleInsertAction();
      }
    });
    const confirmInsertButton = root.querySelector(
      '[data-action="confirm-insert"]',
    );
    confirmInsertButton?.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.insertLatestAssist();
    });
    confirmInsertButton?.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      if ((event as MouseEvent).detail === 0) {
        this.insertLatestAssist();
      }
    });
    const closeReviewButton = root.querySelector('[data-action="close-review"]');
    closeReviewButton?.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.dismissCurrentContext();
    });
    closeReviewButton?.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      if ((event as MouseEvent).detail === 0) {
        this.dismissCurrentContext();
      }
    });
    const rejectButton = root.querySelector('[data-action="reject"]');
    rejectButton?.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      event.stopPropagation();
      void this.recordAssistFeedback('rejected');
      this.recordAmbientWrongTrace();
      this.dismissCurrentContext();
    });
    rejectButton?.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      if ((event as MouseEvent).detail === 0) {
        void this.recordAssistFeedback('rejected');
        this.recordAmbientWrongTrace();
        this.dismissCurrentContext();
      }
    });
    this.positionRoot();
  }

  private buildSuggestionPreview(
    assist: ComposerAssistResponse,
    forceFull = false,
  ): string {
    return getComposerAssistPreviewText(assist.insertText, {
      forceFull,
    });
  }

  private handleInsertAction(): void {
    if (!this.latestAssist) return;
    if (
      shouldReviewComposerAssistBeforeInsert(this.latestAssist) &&
      !this.reviewMode
    ) {
      this.reviewMode = true;
      this.rememberPreviewedAssist();
      this.render('ready');
      return;
    }
    this.insertLatestAssist();
  }

  private insertLatestAssist(): void {
    if (!this.activeSession || !this.latestAssist?.insertText) return;
    const target = this.activeSession.target;
    const beforeText = readComposerText(target);
    const before = captureComposerTextSnapshot(target);
    const contextKey = this.activeSession.contextKey;
    const feedbackContext = this.getCurrentFeedbackContext();
    const insertText = sanitizeComposerAssistInsertText(
      this.latestAssist.insertText,
    );
    if (!insertText) return;
    const inserted = insertTextIntoComposer(target, insertText);
    if (!inserted) return;
    this.clear();
    this.showInsertionUndo({
      target,
      before,
      beforeText,
      contextKey,
      feedbackContext,
      suggestionText: insertText,
      insertedAt: Date.now(),
    });
  }

  private async loadComposerGuardConfig(): Promise<void> {
    const result = await getChromeLocal<{
      envConfig?: Record<string, unknown>;
    }>(ENV_CONFIG_KEY);
    this.configLoaded = true;
    this.applyComposerGuardConfig(result.envConfig);
  }

  private applyComposerGuardConfig(envConfig?: Record<string, unknown>): void {
    this.composeAssistEnabled = isComposerAssistEnabledFromConfig(envConfig);
    this.assistConfidenceThreshold = normalizeComposerAssistThreshold(
      envConfig?.[CONFIDENCE_THRESHOLD_CONFIG_KEY],
      this.assistConfidenceThreshold,
    );
  }

  private getCurrentFeedbackContext(): ComposerGuardFeedbackContext {
    return {
      assist: this.latestAssist,
      contextKey: this.activeSession?.contextKey,
      snapshot: this.activeSession?.snapshot,
    };
  }

  private rememberPreviewedAssist(): void {
    if (!this.activeSession || !this.latestAssist?.insertText) return;
    const suggestionText = sanitizeComposerAssistInsertText(
      this.latestAssist.insertText,
    );
    if (!suggestionText) return;
    const recordedAt = Date.now();
    this.previewedAssistDraft = {
      target: this.activeSession.target,
      contextKey: this.activeSession.contextKey,
      feedbackContext: this.getCurrentFeedbackContext(),
      suggestionText,
      recordedAt,
      sourceRequestId: getAmbientTraceSourceRequestId(
        this.activeSession.contextKey,
        recordedAt,
      ),
    };
  }

  private rememberAcceptedInsertion(undo: PendingInsertionUndo): void {
    this.acceptedInsertionDraft = {
      target: undo.target,
      contextKey: undo.contextKey,
      feedbackContext: undo.feedbackContext,
      suggestionText: undo.suggestionText,
      beforeText: undo.beforeText,
      recordedAt: undo.insertedAt,
      sourceRequestId: getAmbientTraceSourceRequestId(
        undo.contextKey,
        undo.insertedAt,
      ),
      sendTraceRecorded: undo.sendTraceRecorded,
    };
    if (this.previewedAssistDraft?.contextKey === undo.contextKey) {
      this.previewedAssistDraft = null;
    }
  }

  private clearPreviewedAssistDraft(contextKey?: string): void {
    if (!contextKey || this.previewedAssistDraft?.contextKey === contextKey) {
      this.previewedAssistDraft = null;
    }
  }

  private buildAmbientEvidenceRefs(
    feedbackContext: ComposerGuardFeedbackContext,
    role: AmbientDiffSummary['evidenceRole'],
  ): Array<Record<string, unknown>> {
    return (feedbackContext.assist?.evidence || [])
      .filter((item) => item.id)
      .slice(0, AMBIENT_EVIDENCE_LIMIT)
      .map((item) => ({
        id: item.id,
        type: item.type,
        title: item.title || item.sourceTitle,
        sourceLabel: item.sourceLabel,
        role,
        score: typeof item.score === 'number' ? item.score : undefined,
      }));
  }

  private submitAmbientCalibrationTrace(
    payload: Record<string, unknown>,
  ): void {
    if (typeof chrome === 'undefined' || !chrome?.runtime?.sendMessage) {
      return;
    }
    try {
      chrome.runtime.sendMessage(
        {
          type: 'AMBIENT_CALIBRATION_TRACE',
          trace: payload,
        },
        () => {
          void chrome.runtime.lastError;
        },
      );
    } catch (error) {
      console.warn('[ComposerGuard] ambient calibration trace failed:', error);
    }
  }

  private buildAmbientTracePayload(
    draft: AmbientAssistDraft,
    summary: AmbientDiffSummary,
    trigger: string,
  ): Record<string, unknown> {
    const { assist, snapshot } = draft.feedbackContext;
    return {
      surface: 'compose_assist',
      sceneKey: draft.contextKey,
      sourceRequestId: draft.sourceRequestId,
      action: summary.action,
      strength: summary.strength,
      polarity: summary.polarity,
      evidenceRefs: this.buildAmbientEvidenceRefs(
        draft.feedbackContext,
        summary.evidenceRole,
      ),
      redactedDiff: summary.redactedDiff,
      privacyClass: 'sensitive_redacted',
      metadata: {
        trigger,
        contextType: snapshot?.contextType,
        scenario: snapshot?.scenario,
        nativeSurface: snapshot?.surface,
        suggestionType: assist?.suggestionType,
        confidence: assist?.confidence,
        beforeTextLength: draft.beforeText?.length,
      },
      createdAt: Date.now(),
    };
  }

  private recordAmbientInsertedTrace(undo: PendingInsertionUndo): void {
    const draft: AmbientAssistDraft = {
      target: undo.target,
      contextKey: undo.contextKey,
      feedbackContext: undo.feedbackContext,
      suggestionText: undo.suggestionText,
      beforeText: undo.beforeText,
      recordedAt: undo.insertedAt,
      sourceRequestId: getAmbientTraceSourceRequestId(
        undo.contextKey,
        undo.insertedAt,
      ),
    };
    this.submitAmbientCalibrationTrace(
      this.buildAmbientTracePayload(
        draft,
        {
          action: 'inserted',
          polarity: 'positive',
          strength: 'medium',
          evidenceRole: 'used',
          redactedDiff: {
            rawTextStored: false,
            suggestionHash: hashAmbientText(undo.suggestionText),
            suggestionTextLength: undo.suggestionText.length,
            beforeTextLength: undo.beforeText.length,
            interaction: 'insert_undo_expired',
          },
        },
        'undo_commit',
      ),
    );
  }

  private recordAmbientWrongTrace(): void {
    if (!this.activeSession) return;
    const feedbackContext = this.getCurrentFeedbackContext();
    const suggestionText = sanitizeComposerAssistInsertText(
      feedbackContext.assist?.insertText,
    );
    if (!suggestionText || !feedbackContext.contextKey) return;
    const recordedAt = Date.now();
    const draft: AmbientAssistDraft = {
      target: this.activeSession.target,
      contextKey: feedbackContext.contextKey,
      feedbackContext,
      suggestionText,
      recordedAt,
      sourceRequestId: getAmbientTraceSourceRequestId(
        feedbackContext.contextKey,
        recordedAt,
      ),
    };
    this.submitAmbientCalibrationTrace(
      this.buildAmbientTracePayload(
        draft,
        {
          action: 'wrong',
          polarity: 'negative',
          strength: 'strong',
          evidenceRole: 'ignored',
          redactedDiff: {
            rawTextStored: false,
            suggestionHash: hashAmbientText(suggestionText),
            suggestionTextLength: suggestionText.length,
            interaction: 'explicit_thumb_down',
          },
        },
        'thumb_down',
      ),
    );
    this.clearPreviewedAssistDraft(feedbackContext.contextKey);
  }

  private getAmbientInsertionDraftForSend(
    sendElement: Element,
  ): { draft: AmbientAssistDraft; source: 'pending' | 'accepted' } | null {
    const undo = this.pendingInsertionUndo;
    if (
      undo &&
      !undo.sendTraceRecorded &&
      this.isElementNearComposerTarget(sendElement, undo.target)
    ) {
      return {
        source: 'pending',
        draft: {
          target: undo.target,
          contextKey: undo.contextKey,
          feedbackContext: undo.feedbackContext,
          suggestionText: undo.suggestionText,
          beforeText: undo.beforeText,
          recordedAt: undo.insertedAt,
          sourceRequestId: getAmbientTraceSourceRequestId(
            undo.contextKey,
            undo.insertedAt,
          ),
        },
      };
    }

    const accepted = this.acceptedInsertionDraft;
    if (
      accepted &&
      !accepted.sendTraceRecorded &&
      Date.now() - accepted.recordedAt <= AMBIENT_DRAFT_TTL_MS &&
      this.isElementNearComposerTarget(sendElement, accepted.target)
    ) {
      return { source: 'accepted', draft: accepted };
    }

    return null;
  }

  private getAmbientPreviewDraftForSend(
    sendElement: Element,
  ): AmbientAssistDraft | null {
    const preview = this.previewedAssistDraft;
    if (
      preview &&
      !preview.sendTraceRecorded &&
      Date.now() - preview.recordedAt <= AMBIENT_DRAFT_TTL_MS &&
      this.isElementNearComposerTarget(sendElement, preview.target)
    ) {
      return preview;
    }
    return null;
  }

  private async recordAmbientSendTrace(
    sendElement: Element,
    trigger: string,
  ): Promise<void> {
    const insertion = this.getAmbientInsertionDraftForSend(sendElement);
    if (insertion) {
      const finalText = readComposerText(insertion.draft.target);
      const summary = buildAmbientDiffSummary(
        insertion.draft.suggestionText,
        finalText,
        'after_insert',
      );
      this.submitAmbientCalibrationTrace(
        this.buildAmbientTracePayload(insertion.draft, summary, trigger),
      );
      if (insertion.source === 'pending' && this.pendingInsertionUndo) {
        this.pendingInsertionUndo.sendTraceRecorded = true;
        this.clearInsertionUndo(true);
      } else if (this.acceptedInsertionDraft) {
        this.acceptedInsertionDraft.sendTraceRecorded = true;
        this.acceptedInsertionDraft = null;
      }
      return;
    }

    const preview = this.getAmbientPreviewDraftForSend(sendElement);
    if (!preview) return;
    const finalText = readComposerText(preview.target);
    const summary = buildAmbientDiffSummary(
      preview.suggestionText,
      finalText,
      'without_insert',
    );
    this.submitAmbientCalibrationTrace(
      this.buildAmbientTracePayload(preview, summary, trigger),
    );
    preview.sendTraceRecorded = true;
    this.previewedAssistDraft = null;
  }

  private async recordAssistFeedback(
    kind: AssistFeedbackKind,
    feedbackContext = this.getCurrentFeedbackContext(),
  ): Promise<void> {
    const { assist, contextKey, snapshot } = feedbackContext;
    const result = await getChromeLocal<{
      envConfig?: Record<string, unknown>;
      composerGuardFeedbackEvents?: ComposerGuardFeedbackEvent[];
    }>([ENV_CONFIG_KEY, FEEDBACK_EVENTS_KEY]);
    const envConfig = result.envConfig || {};
    const currentThreshold = normalizeComposerAssistThreshold(
      envConfig[CONFIDENCE_THRESHOLD_CONFIG_KEY],
      this.assistConfidenceThreshold,
    );
    const nextThreshold = getNextComposerAssistThreshold(
      currentThreshold,
      kind,
    );
    this.assistConfidenceThreshold = nextThreshold;

    const event: ComposerGuardFeedbackEvent = {
      kind,
      timestamp: Date.now(),
      thresholdBefore: currentThreshold,
      thresholdAfter: nextThreshold,
      confidence: assist?.confidence,
      suggestionType: assist?.suggestionType,
      surface: snapshot?.surface,
      scenario: snapshot?.scenario,
      contextType: snapshot?.contextType,
      contextKey,
    };
    const events = Array.isArray(result.composerGuardFeedbackEvents)
      ? result.composerGuardFeedbackEvents
      : [];

    await setChromeLocal({
      [ENV_CONFIG_KEY]: {
        ...envConfig,
        [CONFIDENCE_THRESHOLD_CONFIG_KEY]: nextThreshold,
      },
      [FEEDBACK_EVENTS_KEY]: [...events, event].slice(-MAX_FEEDBACK_EVENTS),
    });

    void this.submitStructuredEvidenceFeedback(kind, feedbackContext);
  }

  private async submitStructuredEvidenceFeedback(
    kind: AssistFeedbackKind,
    feedbackContext: ComposerGuardFeedbackContext,
  ): Promise<void> {
    const targets = getStructuredEvidenceFeedbackTargets(feedbackContext.assist);
    if (targets.length === 0) return;

    await Promise.all(
      targets.map(async (target) => {
        try {
          const detail = buildStructuredFeedbackDetail(
            kind,
            feedbackContext.snapshot,
            feedbackContext.contextKey,
            target,
          );
          await sendRuntimeMessage({
            type: 'CONTEXT_RECALL_FEEDBACK',
            feedback: {
              targetId: target.id,
              targetType: target.type,
              action: kind === 'accepted' ? 'positive' : 'negative',
              rehearsalActivationId: target.activationId,
              detail,
            },
          });
        } catch (error) {
          console.warn(
            '[ComposerGuard] evidence feedback failed:',
            error,
          );
        }
      }),
    );
  }

  private canRunComposerAssist(): boolean {
    return this.configLoaded && this.composeAssistEnabled;
  }

  private clearIfConfigReadyAndDisabled(): void {
    if (this.configLoaded && !this.composeAssistEnabled) {
      this.clear();
    }
  }

  private dismissCurrentContext(): void {
    const contextKey = this.activeSession?.contextKey;
    if (this.activeSession) {
      this.dismissedContexts.set(this.activeSession.contextKey, Date.now());
    }
    this.clearPreviewedAssistDraft(contextKey);
    this.clear();
  }

  private isDismissed(contextKey: string): boolean {
    const dismissedAt = this.dismissedContexts.get(contextKey);
    if (!dismissedAt) return false;
    if (Date.now() - dismissedAt > DISMISS_TTL_MS) {
      this.dismissedContexts.delete(contextKey);
      return false;
    }
    return true;
  }

  private clear(): void {
    if (this.requestTimer != null) {
      window.clearTimeout(this.requestTimer);
      this.requestTimer = null;
    }
    this.reviewMode = false;
    this.clearInsertionUndo(true);
    this.setTargetGlow(false);
    this.activeSession = null;
    this.latestAssist = null;
    this.root?.remove();
    this.root = null;
  }

  private removeAffordance(): void {
    this.reviewMode = false;
    this.clearInsertionUndo(true);
    this.setTargetGlow(false);
    this.root?.remove();
    this.root = null;
  }

  private setTargetGlow(enabled: boolean): void {
    const targetElement = this.activeSession?.target.element;
    if (!targetElement) return;
    const shouldHighlightTarget =
      enabled && this.activeSession?.snapshot.contextType !== 'web_agent_prompt';
    targetElement.classList.toggle(
      'pai-composer-guard-target-glow',
      shouldHighlightTarget,
    );
  }

  private schedulePositionRefresh = (): void => {
    if (this.positionTimer != null) return;
    this.positionTimer = window.setTimeout(() => {
      this.positionTimer = null;
      if (this.activeSession) {
        this.positionRoot();
      } else if (this.pendingInsertionUndo) {
        this.positionUndoRoot(this.pendingInsertionUndo.target);
      }
    }, 80);
  };

  private showInsertionUndo(undo: PendingInsertionUndo): void {
    this.clearInsertionUndo(false);
    this.pendingInsertionUndo = undo;
    const root = this.ensureRoot();
    root.className = 'pai-composer-guard pai-composer-guard--undo';
    root.dataset.state = 'undo';
    root.innerHTML = `
      <div class="pai-composer-guard-undo-toast" role="status">
        <span>已插入</span>
        <button class="pai-composer-guard-undo-button" data-action="undo-insert" type="button">撤销</button>
      </div>
    `;
    root
      .querySelector('[data-action="undo-insert"]')
      ?.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.restoreLastInsertion();
      });
    this.positionUndoRoot(undo.target);
    this.undoTimer = window.setTimeout(() => {
      this.clearInsertionUndo(true);
    }, INSERT_UNDO_TTL_MS);
  }

  private restoreLastInsertion(): void {
    const undo = this.pendingInsertionUndo;
    if (!undo) return;
    this.clearInsertionUndo(false);
    this.dismissedContexts.set(undo.contextKey, Date.now());
    this.restoringSnapshot = true;
    try {
      restoreComposerTextSnapshot(undo.target, undo.before);
    } finally {
      this.restoringSnapshot = false;
    }
  }

  private clearInsertionUndo(commitAccepted: boolean): void {
    const undo = this.pendingInsertionUndo;
    if (this.undoTimer != null) {
      window.clearTimeout(this.undoTimer);
      this.undoTimer = null;
    }
    this.pendingInsertionUndo = null;
    if (this.root?.dataset.state === 'undo') {
      this.root.remove();
      this.root = null;
    }
    if (commitAccepted && undo) {
      void this.recordAssistFeedback('accepted', undo.feedbackContext);
      if (!undo.sendTraceRecorded) {
        this.rememberAcceptedInsertion(undo);
        this.recordAmbientInsertedTrace(undo);
      } else {
        this.acceptedInsertionDraft = null;
      }
    }
  }

  private positionRoot(): void {
    if (!this.root || !this.activeSession) return;
    const rect = this.getTargetAnchorRect();
    if (!rect) {
      this.removeAffordance();
      return;
    }

    const maxTop = Math.max(
      VIEWPORT_MARGIN,
      window.innerHeight - ICON_SIZE - VIEWPORT_MARGIN,
    );
    const maxLeft = Math.max(
      VIEWPORT_MARGIN,
      window.innerWidth - ICON_SIZE - VIEWPORT_MARGIN,
    );
    const topInsideTarget =
      rect.height >= ICON_SIZE + ICON_INSET * 2
        ? rect.top + ICON_INSET
        : rect.top + Math.max(0, (rect.height - ICON_SIZE) / 2);
    const leftInsideTarget =
      rect.width >= ICON_SIZE + ICON_INSET * 2
        ? rect.right - ICON_SIZE - ICON_INSET
        : rect.right - ICON_SIZE;
    const top = clamp(topInsideTarget, VIEWPORT_MARGIN, maxTop);
    const left = clamp(leftInsideTarget, VIEWPORT_MARGIN, maxLeft);
    const availableBelow = window.innerHeight - top - VIEWPORT_MARGIN;
    const availableAbove = top + ICON_SIZE - VIEWPORT_MARGIN;
    const opensAbove =
      availableBelow < DEFAULT_POPOVER_HEIGHT &&
      availableAbove > availableBelow;
    const availablePopoverHeight = clamp(
      opensAbove ? availableAbove : availableBelow,
      MIN_POPOVER_HEIGHT,
      DEFAULT_POPOVER_HEIGHT,
    );

    this.root.classList.toggle('pai-composer-guard--near-left', left < 360);
    this.root.classList.toggle('pai-composer-guard--above', opensAbove);
    this.root.style.setProperty(
      '--pai-composer-popover-max-height',
      `${Math.floor(availablePopoverHeight)}px`,
    );
    this.root.style.top = `${top}px`;
    this.root.style.left = `${left}px`;
  }

  private getTargetAnchorRect(): DOMRect | null {
    const targetElement = this.activeSession?.target.element;
    if (!targetElement) return null;
    return this.getAnchorRectForElement(targetElement);
  }

  private getAnchorRectForElement(targetElement: HTMLElement): DOMRect | null {
    const candidates: HTMLElement[] = [targetElement];
    const anchorSelectors = [
      '.ql-container',
      '.ProseMirror',
      '[role="textbox"]',
      '[contenteditable="true"]',
      '[data-test-automation-id*="compose"]',
      '[data-testid*="composer"]',
      '[data-testid*="chat-input"]',
      'form',
      'footer',
    ];

    for (const selector of anchorSelectors) {
      const closest = targetElement.closest(selector);
      if (closest instanceof HTMLElement && !candidates.includes(closest)) {
        candidates.push(closest);
      }
    }

    let parent = targetElement.parentElement;
    for (let depth = 0; parent && depth < 5; depth += 1) {
      if (
        parent !== document.body &&
        parent !== document.documentElement &&
        !candidates.includes(parent)
      ) {
        candidates.push(parent);
      }
      parent = parent.parentElement;
    }

    for (const candidate of candidates) {
      const rect = getUsableElementRect(candidate);
      if (rect) return rect;
    }

    return null;
  }

  private positionUndoRoot(target: ComposerTarget): void {
    if (!this.root) return;
    const rect = this.getAnchorRectForElement(target.element);
    if (!rect) {
      this.clearInsertionUndo(true);
      return;
    }
    const top = clamp(
      rect.top + ICON_INSET,
      VIEWPORT_MARGIN,
      Math.max(VIEWPORT_MARGIN, window.innerHeight - 36 - VIEWPORT_MARGIN),
    );
    const left = clamp(
      rect.right - 112,
      VIEWPORT_MARGIN,
      Math.max(VIEWPORT_MARGIN, window.innerWidth - 112 - VIEWPORT_MARGIN),
    );
    this.root.style.top = `${top}px`;
    this.root.style.left = `${left}px`;
  }

  private injectStyles(): void {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${ROOT_ID}.pai-composer-guard {
        position: fixed;
        z-index: 2147483646;
        width: ${ICON_SIZE}px;
        height: ${ICON_SIZE}px;
        --pai-composer-popover-max-height: ${DEFAULT_POPOVER_HEIGHT}px;
        color: #172033;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        font-size: 12px;
        line-height: 1.35;
        pointer-events: auto;
      }
      #${ROOT_ID}.pai-composer-guard--undo {
        width: auto;
        height: auto;
      }
      .pai-composer-guard-undo-toast {
        display: flex;
        align-items: center;
        gap: 8px;
        min-height: 28px;
        padding: 5px 7px 5px 9px;
        border: 1px solid rgba(17, 24, 39, 0.12);
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.98);
        box-shadow: 0 10px 24px rgba(17, 24, 39, 0.16);
        color: #374151;
        white-space: nowrap;
      }
      .pai-composer-guard-undo-button {
        margin: 0;
        border: 0;
        border-radius: 5px;
        padding: 3px 6px;
        background: rgba(198, 40, 40, 0.08);
        color: #c62828;
        font: inherit;
        font-weight: 700;
        cursor: pointer;
      }
      .pai-composer-guard-undo-button:hover {
        background: rgba(198, 40, 40, 0.14);
      }
      .pai-composer-guard-icon-button {
        display: flex;
        align-items: center;
        justify-content: center;
        width: ${ICON_SIZE}px;
        height: ${ICON_SIZE}px;
        margin: 0;
        border: 0;
        border-radius: 999px;
        padding: 0;
        background: transparent;
        box-shadow: 0 3px 10px rgba(209, 42, 42, 0.24);
        cursor: pointer;
        transition: transform 140ms ease, box-shadow 140ms ease;
      }
      .pai-composer-guard-icon-button:hover {
        transform: scale(1.04);
        box-shadow: 0 4px 14px rgba(209, 42, 42, 0.36);
      }
      .pai-composer-guard-icon-button img {
        width: ${ICON_IMAGE_SIZE}px;
        height: ${ICON_IMAGE_SIZE}px;
        display: block;
        border-radius: 999px;
      }
      .pai-composer-guard-popover {
        position: absolute;
        right: ${ICON_SIZE + POPOVER_GAP}px;
        top: -2px;
        width: min(320px, calc(100vw - 70px));
        max-height: min(${DEFAULT_POPOVER_HEIGHT}px, var(--pai-composer-popover-max-height));
        overflow: auto;
        padding: 10px 12px;
        border: 1px solid rgba(17, 24, 39, 0.12);
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.98);
        box-shadow: 0 14px 34px rgba(17, 24, 39, 0.16);
        color: #1f2937;
        opacity: 0;
        transform: translateX(8px) scale(0.98);
        transform-origin: right top;
        pointer-events: none;
        transition: opacity 130ms ease, transform 130ms ease;
      }
      .pai-composer-guard:hover .pai-composer-guard-popover {
        opacity: 1;
        transform: translateX(0) scale(1);
        pointer-events: auto;
      }
      .pai-composer-guard:focus-within .pai-composer-guard-popover,
      .pai-composer-guard--review .pai-composer-guard-popover {
        opacity: 1;
        transform: translateX(0) scale(1);
        pointer-events: auto;
      }
      .pai-composer-guard--near-left .pai-composer-guard-popover {
        right: auto;
        left: ${ICON_SIZE + POPOVER_GAP}px;
        transform: translateX(-8px) scale(0.98);
        transform-origin: left top;
      }
      .pai-composer-guard--near-left:hover .pai-composer-guard-popover {
        transform: translateX(0) scale(1);
      }
      .pai-composer-guard--near-left:focus-within .pai-composer-guard-popover,
      .pai-composer-guard--near-left.pai-composer-guard--review .pai-composer-guard-popover {
        transform: translateX(0) scale(1);
      }
      .pai-composer-guard--above .pai-composer-guard-popover {
        top: auto;
        bottom: -2px;
        transform-origin: right bottom;
      }
      .pai-composer-guard--near-left.pai-composer-guard--above .pai-composer-guard-popover {
        transform-origin: left bottom;
      }
      .pai-composer-guard-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        margin-bottom: 6px;
      }
      .pai-composer-guard-label {
        color: #c62828;
        font-weight: 700;
      }
      .pai-composer-guard-cue {
        margin: 0 0 7px;
        padding: 5px 7px;
        border-radius: 6px;
        background: rgba(15, 118, 110, 0.08);
        color: #0f766e;
        font-size: 11px;
        font-weight: 650;
        overflow-wrap: anywhere;
      }
      .pai-composer-guard-feedback-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex: 0 0 auto;
        width: 18px;
        height: 18px;
        margin: 0;
        border: 0;
        border-radius: 4px;
        padding: 0;
        color: #9ca3af;
        background: transparent;
        cursor: pointer;
      }
      .pai-composer-guard-feedback-button:hover {
        color: #c62828;
        background: rgba(198, 40, 40, 0.08);
      }
      .pai-composer-guard-feedback-button svg {
        width: 14px;
        height: 14px;
        display: block;
      }
      .pai-composer-guard-text {
        color: #374151;
        white-space: pre-wrap;
        word-break: break-word;
        font-size: 12px;
      }
      .pai-composer-guard-review-note {
        margin: 0 0 7px;
        padding: 6px 7px;
        border-radius: 6px;
        background: rgba(180, 83, 9, 0.08);
        color: #92400e;
        font-size: 11px;
        font-weight: 650;
        overflow-wrap: anywhere;
      }
      .pai-composer-guard-review-evidence {
        margin-top: 9px;
        padding-top: 8px;
        border-top: 1px solid rgba(17, 24, 39, 0.08);
        color: #4b5563;
      }
      .pai-composer-guard-review-evidence-title {
        margin-bottom: 4px;
        color: #6b7280;
        font-size: 11px;
        font-weight: 700;
      }
      .pai-composer-guard-review-evidence ul {
        display: grid;
        gap: 4px;
        margin: 0;
        padding: 0;
        list-style: none;
      }
      .pai-composer-guard-review-evidence li {
        font-size: 11px;
        line-height: 1.35;
        overflow-wrap: anywhere;
      }
      .pai-composer-guard-actions {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        margin-top: 10px;
      }
      .pai-composer-guard-primary-action,
      .pai-composer-guard-secondary-action {
        margin: 0;
        border-radius: 6px;
        padding: 4px 9px;
        font: inherit;
        font-weight: 700;
        cursor: pointer;
      }
      .pai-composer-guard-primary-action {
        border: 1px solid rgba(198, 40, 40, 0.22);
        background: #c62828;
        color: #fff;
      }
      .pai-composer-guard-primary-action:hover {
        background: #a92323;
      }
      .pai-composer-guard-secondary-action {
        border: 1px solid rgba(17, 24, 39, 0.12);
        background: rgba(255, 255, 255, 0.88);
        color: #4b5563;
      }
      .pai-composer-guard-secondary-action:hover {
        background: rgba(17, 24, 39, 0.05);
      }
      .pai-composer-guard-target-glow {
        outline: 1px solid rgba(218, 48, 48, 0.54) !important;
        box-shadow:
          0 0 0 3px rgba(218, 48, 48, 0.16),
          0 0 22px rgba(218, 48, 48, 0.38) !important;
        transition: box-shadow 140ms ease, outline-color 140ms ease;
      }
    `;
    document.documentElement.appendChild(style);
  }
}

let controller: ComposerGuardController | null = null;

export function startComposerGuardController(): void {
  if (controller) return;
  controller = new ComposerGuardController();
  controller.start();
}
