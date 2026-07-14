import {
  hasSensitiveUrlSignal,
  isSensitiveControlDescriptor,
} from '../web-intelligence/contextRecallGuards.js';
import {
  buildInteractionSceneSnapshot,
  captureComposerSelectionSnapshot,
  captureComposerTextSnapshot,
  findActiveComposerContext,
  insertTextIntoComposer,
  isComposerElement,
  readComposerText,
  restoreComposerSelectionSnapshot,
  restoreComposerTextSnapshot,
  type ComposerSelectionSnapshot,
  type ComposerTextSnapshot,
} from './siteContextAdapters.js';
import {
  DEFAULT_ASSIST_CONFIDENCE_THRESHOLD,
  COMPOSER_ASSIST_INSERT_UNDO_WINDOW_SECONDS,
  buildComposerAssistInsertionReceipt,
  buildComposerRehearsalCueScopeLabel,
  getComposerAssistThresholdForSurface,
  getComposerAssistPreviewText,
  getNextComposerAssistThreshold,
  normalizeComposerAssistThreshold,
  normalizeComposerAssistSurfaceThresholds,
  sanitizeComposerAssistInsertText,
  type ComposerAssistSurfaceThresholds,
} from './assistPreviewPolicy.js';
import {
  CONFIDENCE_THRESHOLD_CONFIG_KEY,
  ENV_CONFIG_KEY,
  isComposerAssistEnabledFromConfig,
  SURFACE_THRESHOLDS_CONFIG_KEY,
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
const INSERT_UNDO_TTL_MS = COMPOSER_ASSIST_INSERT_UNDO_WINDOW_SECONDS * 1000;
const FEEDBACK_RECEIPT_TTL_MS = 4 * 1000;
const FEEDBACK_EVENTS_KEY = 'composerGuardFeedbackEvents';
const MAX_FEEDBACK_EVENTS = 100;
const UNHELPFUL_ASSIST_RETRY_COOLDOWN_MS = 2 * 60 * 1000;
const ASSIST_REQUEST_FAILURE_COOLDOWN_MS = 60 * 1000;
const ICON_SIZE = 24;
const ICON_IMAGE_SIZE = 22;
const ICON_INSET = 6;
const POPOVER_GAP = 6;
const VIEWPORT_MARGIN = 8;
const MIN_POPOVER_HEIGHT = 140;
const DEFAULT_POPOVER_HEIGHT = 260;
const AMBIENT_DRAFT_TTL_MS = 5 * 60 * 1000;
const AMBIENT_EVIDENCE_LIMIT = 12;
const PREVIEW_OBSERVATION_DWELL_MS = 500;

type GuardState = 'ready';
type AssistFeedbackKind = 'accepted' | 'rejected';

interface ActiveComposerSession {
  target: ComposerTarget;
  snapshot: SiteContextSnapshot;
  contextKey: string;
  draftText: string;
  draftRevision: number;
}

interface ReviewInsertionSelection {
  target: ComposerTarget;
  contextKey: string;
  draftRevision: number;
  snapshot: ComposerSelectionSnapshot;
}

interface ComposerAssistInFlightRequest {
  signature: string;
  requestSeq: number;
  startedAt: number;
}

type ComposerAssistRequestGateReason = 'in_flight' | 'failure_cooldown';

interface ComposerGuardFeedbackEvent {
  kind: AssistFeedbackKind;
  timestamp: number;
  thresholdBefore: number;
  thresholdAfter: number;
  thresholdScope?: 'global' | 'surface';
  thresholdSurface?: SiteContextSnapshot['surface'];
  confidence?: number;
  suggestionType?: ComposerAssistResponse['suggestionType'];
  surface?: SiteContextSnapshot['surface'];
  scenario?: SiteContextSnapshot['scenario'];
  contextType?: SiteContextSnapshot['contextType'];
  contextKey?: string;
  cueIds?: string[];
  cueKeys?: string[];
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
  cue?: ComposerAssistResponse['evidence'][number]['cue'];
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

interface ComposerGuardFeedbackReceipt {
  target: ComposerTarget;
  contextKey?: string;
  snapshot?: SiteContextSnapshot;
  variant?: 'rejected' | 'inserted' | 'preview_send';
  hasRehearsalFeedback?: boolean;
  rehearsalCueScope?: string;
  title?: string;
  detail?: string;
  thresholdState?: ComposerGuardThresholdState;
  thresholdError?: string;
  thresholdBefore?: number;
  thresholdAfter?: number;
  thresholdScope?: 'global' | 'surface';
  thresholdSurface?: SiteContextSnapshot['surface'];
  calibrationState?: ComposerGuardCalibrationState;
  calibrationError?: string;
  structuredFeedbackKind?: AssistFeedbackKind;
  structuredFeedbackState?: ComposerGuardStructuredFeedbackState;
  structuredFeedbackError?: string;
  structuredFeedbackTargetCount?: number;
}

type ComposerGuardCalibrationState =
  | 'pending'
  | 'stored'
  | 'duplicate'
  | 'failed'
  | 'unavailable';

type ComposerGuardThresholdState = 'pending' | 'stored' | 'failed';

type ComposerGuardStructuredFeedbackState =
  | 'pending'
  | 'stored'
  | 'failed'
  | 'unavailable';

interface ComposerGuardAmbientTraceSubmitResult {
  state: ComposerGuardCalibrationState;
  error?: string;
}

interface ComposerGuardThresholdSubmitResult {
  state: ComposerGuardThresholdState;
  event?: ComposerGuardFeedbackEvent;
  error?: string;
}

interface ComposerGuardStructuredFeedbackSubmitResult {
  state: ComposerGuardStructuredFeedbackState;
  error?: string;
  targetCount?: number;
}

interface ComposerGuardFeedbackRecordResult {
  event: ComposerGuardFeedbackEvent;
  structuredFeedback: Promise<ComposerGuardStructuredFeedbackSubmitResult>;
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

export function buildComposerAssistRequestSignature(
  contextKey: string,
  draftRevision: number,
): string {
  const normalizedRevision = Number.isFinite(draftRevision)
    ? Math.max(0, Math.trunc(draftRevision))
    : 0;
  return `${contextKey}|revision:${normalizedRevision}`;
}

export function getComposerAssistRequestGate({
  signature,
  inFlightSignature,
  retryBlockedUntil,
  now = Date.now(),
}: {
  signature: string;
  inFlightSignature?: string | null;
  retryBlockedUntil?: number | null;
  now?: number;
}): {
  suppress: boolean;
  reason?: ComposerAssistRequestGateReason;
  retryAfterMs?: number;
} {
  if (inFlightSignature === signature) {
    return { suppress: true, reason: 'in_flight' };
  }
  if (retryBlockedUntil && retryBlockedUntil > now) {
    return {
      suppress: true,
      reason: 'failure_cooldown',
      retryAfterMs: retryBlockedUntil - now,
    };
  }
  return { suppress: false };
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

function getComposerGuardAssistLabel(
  assist: ComposerAssistResponse,
  snapshot: SiteContextSnapshot,
): { label: string; title: string } {
  if (assist.suggestionType === 'prompt_patch') {
    return { label: '提问上下文补丁', title: '插入 prompt 补丁' };
  }
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
  return (
    assist.previewRequired ||
    assist.riskLevel === 'high' ||
    hasRehearsalEvidence(assist)
  );
}

function hasRehearsalEvidence(assist: ComposerAssistResponse): boolean {
  return assist.evidence.some((item) => item.type === 'rehearsal');
}

function getComposerFeedbackSurfaceLabel(
  surface?: SiteContextSnapshot['surface'],
): string {
  switch (surface) {
    case 'chatgpt':
      return 'ChatGPT 场景';
    case 'doubao':
      return '豆包场景';
    case 'claude':
      return 'Claude 场景';
    case 'gemini':
      return 'Gemini 场景';
    case 'jira_issue':
      return 'Jira 评论场景';
    case 'ringcentral_thread':
      return 'RingCentral thread 场景';
    case 'ringcentral_message':
      return 'RingCentral 回复场景';
    default:
      return '当前输入框场景';
  }
}

function buildComposerAssistRejectBoundary(
  assist: ComposerAssistResponse | null,
  snapshot?: SiteContextSnapshot,
): string {
  const surfaceLabel = getComposerFeedbackSurfaceLabel(snapshot?.surface);
  const rehearsalClause = hasRehearsalFeedbackTarget(assist)
    ? '；预演降权是否写入以后续回执为准'
    : '';
  return `减少这类建议：只隐藏当前建议，让${surfaceLabel}后续更谨慎，并尝试提交脱敏 wrong 校准信号${rehearsalClause}；不会发送/提交草稿、删除来源记忆或静默其他输入框。`;
}

function getComposerRehearsalCueScope(
  item: ComposerAssistResponse['evidence'][number],
): string {
  if (item.type !== 'rehearsal') return '';
  return buildComposerRehearsalCueScopeLabel({
    metadata: item.metadata,
    whyRelevant: item.whyRelevant,
  });
}

function getComposerFeedbackRehearsalCueScope(
  assist: ComposerAssistResponse | null,
): string {
  const rehearsal = assist?.evidence.find((item) => item.type === 'rehearsal');
  if (!rehearsal) return '';
  return getComposerRehearsalCueScope(rehearsal);
}

function asDomElement(value: unknown): Element | null {
  if (!value || typeof value !== 'object') return null;
  if (typeof Element !== 'undefined' && value instanceof Element) {
    return value;
  }
  const candidate = value as Partial<Element>;
  return typeof candidate.tagName === 'string' &&
    typeof candidate.closest === 'function'
    ? (value as Element)
    : null;
}

function getElementDebugSummary(element?: Element | null): Record<string, unknown> {
  if (!element) return {};
  return {
    tag: element.tagName,
    id: element.id || undefined,
    className:
      typeof element.className === 'string'
        ? element.className.slice(0, 120)
        : undefined,
  };
}

function isSensitiveEditableElement(target: ComposerTarget): boolean {
  if (target.kind === 'richiframe') {
    return false;
  }
  const element = target.element;
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

function clipCalibrationError(error?: string): string {
  const normalized = (error || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  return normalized.length > 80
    ? `${normalized.slice(0, 80).trimEnd()}...`
    : normalized;
}

function formatComposerAssistThresholdValue(value?: number): string {
  if (!Number.isFinite(value)) return '';
  return Number(value).toFixed(3);
}

function getChromeLocal<T extends Record<string, unknown>>(
  keys: string | string[],
  timeoutMs = 1500,
): Promise<T> {
  return new Promise((resolve) => {
    if (typeof chrome === 'undefined' || !chrome?.storage?.local) {
      resolve({} as T);
      return;
    }
    let settled = false;
    const timer = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve({} as T);
    }, timeoutMs);
    chrome.storage.local.get(keys, (result) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      resolve(result as T);
    });
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
      cue: item.cue,
    });
  }

  return Array.from(targets.values()).slice(0, 5);
}

function hasRehearsalFeedbackTarget(
  assist: ComposerAssistResponse | null,
): boolean {
  return getStructuredEvidenceFeedbackTargets(assist).some(
    (target) => target.type === 'rehearsal',
  );
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
    cue_id: compactStructuredFeedbackDetailValue(target?.cue?.id, 120),
    cue_key: compactStructuredFeedbackDetailValue(target?.cue?.cueKey, 220),
    cue_action_type: compactStructuredFeedbackDetailValue(
      target?.cue?.actionType,
      60,
    ),
    cue_compile_status: compactStructuredFeedbackDetailValue(
      target?.cue?.compileStatus,
      80,
    ),
    cue_confidence: compactStructuredFeedbackDetailValue(
      typeof target?.cue?.confidence === 'number'
        ? String(target.cue.confidence)
        : undefined,
      40,
    ),
    cue_why_now: compactStructuredFeedbackDetailValue(
      target?.cue?.whyNow,
      180,
    ),
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

function getAssistCueIds(
  assist: ComposerAssistResponse | null | undefined,
): string[] {
  const ids = new Set<string>();
  for (const item of assist?.evidence ?? []) {
    const id = item.cue?.id?.trim();
    if (id) ids.add(id);
  }
  return Array.from(ids).slice(0, AMBIENT_EVIDENCE_LIMIT);
}

function getAssistCueKeys(
  assist: ComposerAssistResponse | null | undefined,
): string[] {
  const keys = new Set<string>();
  for (const item of assist?.evidence ?? []) {
    const key = item.cue?.cueKey?.trim();
    if (key) keys.add(key);
  }
  return Array.from(keys).slice(0, AMBIENT_EVIDENCE_LIMIT);
}

function summarizeCueForTrace(
  cue: ComposerAssistResponse['evidence'][number]['cue'],
): Record<string, unknown> | undefined {
  if (!cue?.id) return undefined;
  return {
    id: cue.id,
    cueKey: cue.cueKey,
    actionType: cue.actionType,
    compileStatus: cue.compileStatus,
    confidence: cue.confidence,
    whyNow: cue.whyNow,
  };
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
  private latestAssistContextKey: string | null = null;
  private latestAssistDraftRevision: number | null = null;
  private requestTimer: number | null = null;
  private positionTimer: number | null = null;
  private composerObservationTimer: number | null = null;
  private composerDiscoveryInterval: number | null = null;
  private composerMutationObserver: MutationObserver | null = null;
  private observedRichTextFrames = new WeakSet<HTMLIFrameElement>();
  private undoTimer: number | null = null;
  private feedbackReceiptTimer: number | null = null;
  private previewObservationTimer: number | null = null;
  private requestSeq = 0;
  private inFlightAssistRequest: ComposerAssistInFlightRequest | null = null;
  private assistRetryBlockedUntilBySignature = new Map<string, number>();
  private dismissedContexts = new Map<string, number>();
  private assistConfidenceThreshold = DEFAULT_ASSIST_CONFIDENCE_THRESHOLD;
  private assistSurfaceThresholds: ComposerAssistSurfaceThresholds = {};
  private configLoaded = false;
  private composeAssistEnabled = false;
  private pendingInsertionUndo: PendingInsertionUndo | null = null;
  private acceptedInsertionDraft: AmbientAssistDraft | null = null;
  private previewedAssistDraft: AmbientAssistDraft | null = null;
  private previewObservationCandidate: AmbientAssistDraft | null = null;
  private feedbackReceipt: ComposerGuardFeedbackReceipt | null = null;
  private unhelpfulAssistRetryAtByContext = new Map<string, number>();
  private restoringSnapshot = false;
  private reviewMode = false;
  private reviewInsertionSelection: ReviewInsertionSelection | null = null;

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
      this.startComposerObservation();
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
      this.startComposerObservation();
      this.activateFromElement(document.activeElement, true);
      return;
    }
    if (this.feedbackReceipt) {
      return;
    }
    this.renderIfUseful();
  };

  private startComposerObservation(): void {
    this.injectStyles();
    this.observeRichTextEditorFrames();
    if (this.composerDiscoveryInterval == null) {
      this.composerDiscoveryInterval = window.setInterval(
        this.scanActiveComposerEnvironment,
        1000,
      );
    }
    if (!this.composerMutationObserver) {
      this.composerMutationObserver = new MutationObserver(
        this.scheduleComposerObservation,
      );
      this.composerMutationObserver.observe(document.documentElement, {
        childList: true,
        subtree: true,
      });
    }
    this.scheduleComposerObservation();
  }

  private scheduleComposerObservation = (): void => {
    if (!this.canRunComposerAssist()) return;
    if (this.pendingInsertionUndo) return;
    if (this.feedbackReceipt) return;
    if (this.composerObservationTimer != null) return;
    this.composerObservationTimer = window.setTimeout(() => {
      this.composerObservationTimer = null;
      this.observeRichTextEditorFrames();
      this.activateFromElement(document.activeElement, false);
    }, 120);
  };

  private scanActiveComposerEnvironment = (): void => {
    if (!this.canRunComposerAssist()) return;
    if (this.pendingInsertionUndo) return;
    if (this.feedbackReceipt) return;
    this.observeRichTextEditorFrames();
    const activeElement = asDomElement(document.activeElement);
    this.writeDebugState('scan', {
      activeElement: getElementDebugSummary(activeElement),
      isComposer: activeElement ? isComposerElement(activeElement) : false,
      hasSession: Boolean(this.activeSession),
    });
    if (activeElement && isComposerElement(activeElement)) {
      this.activateFromElement(activeElement, !this.activeSession);
    }
  };

  private observeRichTextEditorFrames(): void {
    if (!this.canRunComposerAssist()) return;
    for (const frame of Array.from(document.querySelectorAll('iframe'))) {
      if (!isComposerElement(frame)) continue;
      this.installRichTextEditorFrameBridge(frame as HTMLIFrameElement);
    }
  }

  private installRichTextEditorFrameBridge(frame: HTMLIFrameElement): void {
    if (this.observedRichTextFrames.has(frame)) return;
    let frameDocument: Document | null = null;
    try {
      frameDocument = frame.contentDocument;
    } catch {
      return;
    }
    const body = frameDocument?.body;
    if (!body) return;

    this.observedRichTextFrames.add(frame);
    const activate = () => {
      if (!this.canRunComposerAssist()) return;
      const requestImmediately =
        !this.activeSession || this.activeSession.target.element !== frame;
      this.activateFromElement(frame, requestImmediately);
    };
    frame.addEventListener('focus', activate, true);
    frame.addEventListener('load', () => {
      this.observedRichTextFrames.delete(frame);
      this.scheduleComposerObservation();
    });
    frameDocument.addEventListener('selectionchange', activate);
    for (const eventName of ['focusin', 'input', 'keyup', 'pointerup']) {
      body.addEventListener(eventName, activate, true);
    }
    if (document.activeElement === frame || frameDocument.activeElement === body) {
      activate();
    }
  }

  private handleFocusIn = (event: FocusEvent): void => {
    if (!this.canRunComposerAssist()) {
      this.clearIfConfigReadyAndDisabled();
      return;
    }
    this.observeRichTextEditorFrames();
    const target = asDomElement(event.target);
    if (
      target &&
      this.pendingInsertionUndo &&
      this.isElementNearComposerTarget(target, this.pendingInsertionUndo.target)
    ) {
      return;
    }
    this.activateFromElement(target, false);
  };

  private handleInput = (event: Event): void => {
    if (this.restoringSnapshot) return;
    if (!this.canRunComposerAssist()) {
      this.clearIfConfigReadyAndDisabled();
      return;
    }
    this.observeRichTextEditorFrames();
    const target = asDomElement(event.target);
    if (!target || !isComposerElement(target)) return;
    if (
      this.pendingInsertionUndo &&
      this.isElementNearComposerTarget(target, this.pendingInsertionUndo.target)
    ) {
      return;
    }
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
      if (this.reviewMode && this.root.dataset.state === 'review') {
        this.closeReviewMode();
        return;
      }
      this.dismissCurrentContext();
      return;
    }
    if (
      event.key === 'Enter' &&
      (event.metaKey || event.ctrlKey) &&
      !event.shiftKey &&
      !event.isComposing
    ) {
      const target = asDomElement(event.target);
      if (target && isComposerElement(target)) {
        void this.recordAmbientSendTrace(target, 'keyboard_send');
      }
    }
  };

  private handleDocumentClick = (event: MouseEvent): void => {
    this.scheduleComposerObservation();
    const target = asDomElement(event.target);
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

    if (
      fromElement &&
      this.pendingInsertionUndo &&
      this.isElementNearComposerTarget(fromElement, this.pendingInsertionUndo.target)
    ) {
      this.positionUndoRoot(this.pendingInsertionUndo.target);
      return;
    }

    const context = findActiveComposerContext(
      document,
      window.location,
      fromElement,
    );
    if (!context) {
      this.writeDebugState('activate:no_context', {
        fromElement: getElementDebugSummary(fromElement),
        isComposer: fromElement ? isComposerElement(fromElement) : false,
      });
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

    if (isSensitiveEditableElement(context.target)) {
      this.writeDebugState('activate:sensitive_target', {
        target: getElementDebugSummary(context.target.element),
        kind: context.target.kind,
      });
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

    const previousSession = this.activeSession;
    const previousTargetElement = previousSession?.target.element ?? null;
    const contextChanged = previousSession?.contextKey !== contextKey;
    const draftChangedWithoutInput = Boolean(
      previousSession &&
        !contextChanged &&
        previousSession.target.element === context.target.element &&
        previousSession.draftText !== draftText,
    );
    const draftRevision = contextChanged
      ? 0
      : (previousSession?.draftRevision ?? 0) +
        (draftChangedWithoutInput ? 1 : 0);
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
    this.writeDebugState('activate:session', {
      kind: context.target.kind,
      mode: context.target.mode,
      contextKey,
      surface: context.snapshot.surface,
      issueKey: context.snapshot.identifiers?.issueKey,
      sourceTypes: context.snapshot.sourceTypes,
      draftLength: draftText.length,
    });

    if (contextChanged || draftChangedWithoutInput) {
      this.latestAssist = null;
      this.latestAssistContextKey = null;
      this.latestAssistDraftRevision = null;
      this.reviewMode = false;
      this.clearPreviewedAssistDraft(previousSession?.contextKey);
      this.unhelpfulAssistRetryAtByContext.delete(contextKey);
      this.removeAffordance();
    } else {
      this.renderIfUseful();
    }

    this.positionRoot();
    const hasPendingRequest = this.requestTimer != null;
    const hasLatestAssist = Boolean(this.latestAssist);
    const latestAssistUseful = this.hasUsefulAssist();
    const now = Date.now();
    this.pruneAssistRetryCooldowns(now);
    const requestSignature = buildComposerAssistRequestSignature(
      contextKey,
      draftRevision,
    );
    const requestGate = this.getAssistRequestGate(requestSignature, now);
    const lastUnhelpfulRetryAt =
      this.unhelpfulAssistRetryAtByContext.get(contextKey);
    const shouldRetryUnhelpfulAssist =
      hasLatestAssist &&
      !latestAssistUseful &&
      !hasPendingRequest &&
      !requestGate.suppress &&
      lastUnhelpfulRetryAt != null &&
      (this.latestAssist?.confidence ?? 0) === 0 &&
      (this.latestAssist?.evidence?.length ?? 0) === 0 &&
      now - lastUnhelpfulRetryAt >= UNHELPFUL_ASSIST_RETRY_COOLDOWN_MS;
    const shouldScheduleAssistRequest =
      !requestGate.suppress &&
      (requestImmediately ||
        contextChanged ||
        draftChangedWithoutInput ||
        (!this.latestAssist && this.requestTimer == null) ||
        shouldRetryUnhelpfulAssist);
    this.writeDebugState('activate:decision', {
      contextKey,
      requestImmediately,
      contextChanged,
      draftChangedWithoutInput,
      hasPendingRequest,
      hasLatestAssist,
      latestAssistUseful,
      latestEvidenceCount: this.latestAssist?.evidence?.length ?? 0,
      latestConfidence: this.latestAssist?.confidence ?? null,
      shouldRetryUnhelpfulAssist,
      requestGateReason: requestGate.reason ?? null,
      requestGateRetryAfterMs: requestGate.retryAfterMs ?? null,
      lastUnhelpfulRetryAgeMs: lastUnhelpfulRetryAt != null
        ? now - lastUnhelpfulRetryAt
        : null,
      shouldScheduleAssistRequest,
    });
    if (shouldScheduleAssistRequest) {
      if (shouldRetryUnhelpfulAssist) {
        this.unhelpfulAssistRetryAtByContext.set(contextKey, now);
      }
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
    this.writeDebugState('request:scheduled', {
      replacingTimer: this.requestTimer != null,
      hasSession: Boolean(this.activeSession),
    });
    if (this.requestTimer != null) {
      window.clearTimeout(this.requestTimer);
    }
    this.requestTimer = window.setTimeout(() => {
      this.requestTimer = null;
      this.writeDebugState('request:timer_fire', {
        hasSession: Boolean(this.activeSession),
        contextKey: this.activeSession?.contextKey,
      });
      void this.requestAssist();
    }, REQUEST_DEBOUNCE_MS);
  };

  private async requestAssist(): Promise<void> {
    if (!this.activeSession || !this.canRunComposerAssist()) return;

    this.refreshActiveDraft();
    const session = this.activeSession;
    const draftRevision = session.draftRevision;
    const contextKey = session.contextKey;
    const requestSignature = buildComposerAssistRequestSignature(
      contextKey,
      draftRevision,
    );
    const requestGate = this.getAssistRequestGate(requestSignature);
    if (requestGate.suppress) {
      this.writeDebugState('request:suppressed', {
        contextKey,
        draftRevision,
        reason: requestGate.reason,
        retryAfterMs: requestGate.retryAfterMs ?? null,
      });
      return;
    }
    const requestSeq = ++this.requestSeq;
    this.inFlightAssistRequest = {
      signature: requestSignature,
      requestSeq,
      startedAt: Date.now(),
    };

    const payload = this.buildAssistRequest(session);
    this.writeDebugState('request:start', {
      contextKey,
      draftRevision,
      surface: payload.surface,
      scenario: payload.scenario,
      issueKey: payload.identifiers?.issueKey,
      sourceTypes: payload.sourceTypes,
    });

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
      this.latestAssistContextKey = contextKey;
      this.latestAssistDraftRevision = draftRevision;
      this.assistRetryBlockedUntilBySignature.delete(requestSignature);
      if (
        (response.confidence ?? 0) === 0 &&
        (response.evidence?.length ?? 0) === 0
      ) {
        this.unhelpfulAssistRetryAtByContext.set(contextKey, Date.now());
      } else {
        this.unhelpfulAssistRetryAtByContext.delete(contextKey);
      }
      this.writeDebugState('request:response', {
        contextKey,
        available: response.available,
        confidence: response.confidence,
        evidenceCount: response.evidence?.length ?? 0,
        insertTextLength: response.insertText?.length ?? 0,
        debug: response.debug,
      });
      this.renderIfUseful();
    } catch (error) {
      this.writeDebugState('request:error', {
        contextKey,
        message: error instanceof Error ? error.message : String(error),
      });
      console.warn('[ComposerGuard] assist request failed:', error);
      if (requestSeq === this.requestSeq) {
        this.assistRetryBlockedUntilBySignature.set(
          requestSignature,
          Date.now() + ASSIST_REQUEST_FAILURE_COOLDOWN_MS,
        );
        this.latestAssist = null;
        this.reviewMode = false;
        this.removeAffordance();
      }
    } finally {
      if (
        this.inFlightAssistRequest?.signature === requestSignature &&
        this.inFlightAssistRequest.requestSeq === requestSeq
      ) {
        this.inFlightAssistRequest = null;
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
      visibleFields: snapshot.visibleFields,
      threadRoot: snapshot.threadRoot,
      audience: snapshot.audience,
      contextItems: snapshot.contextItems,
      sourceTypes: snapshot.sourceTypes,
      interactionScene: buildInteractionSceneSnapshot(snapshot, {
        surface: 'compose_assist',
        target: session.target,
        activeElement: session.target.element,
      }),
      automationLevel: 'L1',
      debug:
        window.localStorage.getItem('__PAI_DEBUG_COMPOSER_GUARD') === '1'
          ? true
          : undefined,
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
        this.latestAssist &&
        this.hasInsertableAssist(this.latestAssist),
    );
  }

  private hasInsertableAssist(assist: ComposerAssistResponse | null): boolean {
    return Boolean(
      assist?.available &&
        assist.insertText &&
        looksLikeSendableComposerText(assist.insertText) &&
        assist.confidence >= this.getActiveAssistThreshold(),
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
    const insertable = this.hasInsertableAssist(assist);
    if (!insertable) {
      this.removeAffordance();
      return;
    }
    const reviewRequired =
      shouldReviewComposerAssistBeforeInsert(assist);
    const reviewOpen = this.reviewMode && reviewRequired;
    const popoverOpen = reviewOpen;
    root.className = `pai-composer-guard${
      popoverOpen ? ' pai-composer-guard--review' : ''
    }`;
    root.dataset.state = popoverOpen ? 'review' : state;
    const iconUrl = chrome.runtime.getURL('icons/icon48.png');
    const preview = this.buildSuggestionPreview(assist, popoverOpen);
    const assistLabel = getComposerGuardAssistLabel(
      assist,
      this.activeSession.snapshot,
    );
    const rejectBoundary = buildComposerAssistRejectBoundary(
      assist,
      this.activeSession.snapshot,
    );

    root.innerHTML = `
      <button class="pai-composer-guard-icon-button" data-action="insert" type="button" title="${escapeHtml(
        reviewRequired && !reviewOpen
          ? '先预览建议内容'
          : assistLabel.title,
      )}" aria-expanded="${popoverOpen ? 'true' : 'false'}">
        <img src="${iconUrl}" alt="Personal AI" />
      </button>
      <div class="pai-composer-guard-popover" aria-hidden="${popoverOpen ? 'false' : 'true'}">
        <div class="pai-composer-guard-header">
          <div class="pai-composer-guard-label">${escapeHtml(
            assistLabel.label,
          )}</div>
          <button class="pai-composer-guard-feedback-button" data-action="reject" type="button" title="${escapeHtml(
            rejectBoundary,
          )}" aria-label="${escapeHtml(rejectBoundary)}">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M10 15.5v3.1c0 .8.7 1.4 1.5 1.4.5 0 .9-.2 1.2-.6l4.2-5.4c.4-.5.6-1.1.6-1.8V5.6c0-1-.8-1.8-1.8-1.8H7.1c-.7 0-1.4.4-1.7 1L2.7 11c-.5 1.2.4 2.5 1.7 2.5H10Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
              <path d="M19 4v10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
        <div class="pai-composer-guard-text">${escapeHtml(preview)}</div>
        ${
          reviewOpen
            ? `<div class="pai-composer-guard-actions">
                <button class="pai-composer-guard-secondary-action" data-action="close-review" type="button">取消</button>
                <button class="pai-composer-guard-primary-action" data-action="confirm-insert" type="button">插入草稿</button>
              </div>`
            : ''
        }
      </div>
    `;

    root.onpointerenter = () => this.schedulePreviewedAssistMemory();
    root.onpointerleave = () => this.cancelPreviewObservation();
    root.onpointerover = (event) => {
      const related = event.relatedTarget;
      if (related instanceof Node && root.contains(related)) return;
      this.schedulePreviewedAssistMemory();
    };
    root.onpointerout = (event) => {
      const related = event.relatedTarget;
      if (related instanceof Node && root.contains(related)) return;
      this.cancelPreviewObservation();
    };
    root.onfocusin = (event) => {
      const related = event.relatedTarget;
      if (related instanceof Node && root.contains(related)) return;
      this.schedulePreviewedAssistMemory();
    };
    root.onfocusout = (event) => {
      const related = event.relatedTarget;
      if (related instanceof Node && root.contains(related)) return;
      this.cancelPreviewObservation();
    };

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
      this.insertLatestAssist(this.getRestorableReviewInsertionSelection());
    });
    confirmInsertButton?.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      if ((event as MouseEvent).detail === 0) {
        this.insertLatestAssist(this.getRestorableReviewInsertionSelection());
      }
    });
    const closeReviewButton = root.querySelector('[data-action="close-review"]');
    closeReviewButton?.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.closeReviewMode();
    });
    closeReviewButton?.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      if ((event as MouseEvent).detail === 0) {
        this.closeReviewMode();
      }
    });
    const rejectButton = root.querySelector('[data-action="reject"]');
    rejectButton?.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.handleRejectAction();
    });
    rejectButton?.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      if ((event as MouseEvent).detail === 0) {
        this.handleRejectAction();
      }
    });
    this.positionRoot();
    this.dispatchComposeAssistVisibility(true);
    this.writeDebugState('render', {
      insertable,
      confidence: assist.confidence,
      evidenceCount: assist.evidence?.length ?? 0,
      rootClass: root.className,
    });
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
    if (!this.hasInsertableAssist(this.latestAssist)) {
      return;
    }
    const insertionSelection = this.captureReviewInsertionSelection();
    if (
      shouldReviewComposerAssistBeforeInsert(this.latestAssist) &&
      !this.reviewMode
    ) {
      this.reviewMode = true;
      this.reviewInsertionSelection = insertionSelection;
      this.rememberPreviewedAssist();
      this.render('ready');
      return;
    }
    this.insertLatestAssist(insertionSelection?.snapshot ?? null);
  }

  private captureReviewInsertionSelection(): ReviewInsertionSelection | null {
    if (!this.activeSession) return null;
    const snapshot = captureComposerSelectionSnapshot(this.activeSession.target);
    if (!snapshot) return null;
    return {
      target: this.activeSession.target,
      contextKey: this.activeSession.contextKey,
      draftRevision: this.activeSession.draftRevision,
      snapshot,
    };
  }

  private getRestorableReviewInsertionSelection():
    | ComposerSelectionSnapshot
    | null {
    if (!this.activeSession || !this.reviewInsertionSelection) return null;
    const saved = this.reviewInsertionSelection;
    if (
      saved.target.element !== this.activeSession.target.element ||
      saved.contextKey !== this.activeSession.contextKey ||
      saved.draftRevision !== this.activeSession.draftRevision
    ) {
      return null;
    }
    return saved.snapshot;
  }

  private clearReviewInsertionSelection(): void {
    this.reviewInsertionSelection = null;
  }

  private isLatestAssistCurrentForInsertion(): boolean {
    if (!this.activeSession || !this.latestAssist) return false;
    const expectedContextKey = this.latestAssistContextKey;
    const expectedDraftRevision = this.latestAssistDraftRevision;
    const draftChanged = this.refreshActiveDraft();
    const currentContextKey = this.activeSession?.contextKey;
    const currentDraftRevision = this.activeSession?.draftRevision;
    const current =
      !draftChanged &&
      Boolean(expectedContextKey) &&
      expectedContextKey === currentContextKey &&
      expectedDraftRevision === currentDraftRevision;
    if (!current) {
      this.writeDebugState('insert:stale_draft', {
        expectedContextKey,
        currentContextKey,
        expectedDraftRevision,
        currentDraftRevision,
        draftChanged,
      });
    }
    return current;
  }

  private clearLatestAssistForStaleDraft(): void {
    this.reviewMode = false;
    this.clearReviewInsertionSelection();
    this.latestAssist = null;
    this.latestAssistContextKey = null;
    this.latestAssistDraftRevision = null;
    this.setTargetGlow(false);
    this.root?.remove();
    this.root = null;
    this.dispatchComposeAssistVisibility(false);
  }

  private showStaleDraftInsertReceipt(
    target: ComposerTarget,
    contextKey: string | undefined,
    feedbackContext: ComposerGuardFeedbackContext,
  ): void {
    this.clearLatestAssistForStaleDraft();
    this.showFeedbackReceipt({
      target,
      contextKey,
      snapshot: feedbackContext.snapshot,
      title: '草稿已变化',
      detail:
        '未写入草稿；这条建议基于旧草稿。Personal AI 没有发送或提交，请按当前草稿重新聚焦后重试。',
    });
  }

  private closeReviewMode(): void {
    if (!this.reviewMode) return;
    this.reviewMode = false;
    this.clearReviewInsertionSelection();
    if (this.hasUsefulAssist()) {
      this.render('ready');
      return;
    }
    this.removeAffordance();
  }

  private handleRejectAction(): void {
    const target = this.activeSession?.target;
    const contextKey = this.activeSession?.contextKey;
    const feedbackContext = this.getCurrentFeedbackContext();
    const hasRehearsalFeedback = hasRehearsalFeedbackTarget(
      feedbackContext.assist,
    );
    if (contextKey) {
      this.dismissedContexts.set(contextKey, Date.now());
    }
    const thresholdUpdate = this.recordAssistFeedback(
      'rejected',
      feedbackContext,
    );
    const calibrationTrace = this.recordAmbientWrongTrace();
    this.clearPreviewedAssistDraft(contextKey);
    this.reviewMode = false;
    this.clearReviewInsertionSelection();
    this.clearInsertionUndo(true);
    this.setTargetGlow(false);
    this.activeSession = null;
    this.latestAssist = null;
    this.root?.remove();
    this.root = null;
    this.dispatchComposeAssistVisibility(false);
    if (target) {
      this.showFeedbackReceipt({
        target,
        contextKey,
        snapshot: feedbackContext.snapshot,
        hasRehearsalFeedback,
        rehearsalCueScope: getComposerFeedbackRehearsalCueScope(
          feedbackContext.assist,
        ),
        thresholdState: 'pending',
        structuredFeedbackState: hasRehearsalFeedback
          ? 'pending'
          : undefined,
        calibrationState: calibrationTrace ? 'pending' : 'unavailable',
        calibrationError: calibrationTrace
          ? undefined
          : 'ambient_calibration_trace_unavailable',
      });
      void thresholdUpdate
        .then(({ event }) => {
          this.updateFeedbackReceiptThresholdState(contextKey, {
            state: 'stored',
            event,
          });
        })
        .catch((error) => {
          this.updateFeedbackReceiptThresholdState(contextKey, {
            state: 'failed',
            error:
              error instanceof Error
                ? error.message
                : 'composer_threshold_update_failed',
          });
        });
      if (hasRehearsalFeedback) {
        void thresholdUpdate
          .then(({ structuredFeedback }) => structuredFeedback)
          .then((result) => {
            this.updateFeedbackReceiptStructuredFeedbackState(
              contextKey,
              result,
            );
          })
          .catch((error) => {
            this.updateFeedbackReceiptStructuredFeedbackState(contextKey, {
              state: 'failed',
              error:
                error instanceof Error
                  ? error.message
                  : 'context_recall_feedback_failed',
            });
          });
      }
      if (calibrationTrace) {
        void calibrationTrace.then((result) => {
          this.updateFeedbackReceiptCalibrationState(contextKey, result);
        });
      }
    }
  }

  private insertLatestAssist(
    selectionSnapshot: ComposerSelectionSnapshot | null = null,
  ): void {
    if (!this.activeSession || !this.latestAssist?.insertText) return;
    const target = this.activeSession.target;
    const contextKey = this.activeSession.contextKey;
    const feedbackContext = this.getCurrentFeedbackContext();
    if (!this.isLatestAssistCurrentForInsertion()) {
      this.showStaleDraftInsertReceipt(target, contextKey, feedbackContext);
      return;
    }
    const beforeText = readComposerText(target);
    const before = captureComposerTextSnapshot(target);
    const insertText = sanitizeComposerAssistInsertText(
      this.latestAssist.insertText,
    );
    if (!insertText) return;
    restoreComposerSelectionSnapshot(target, selectionSnapshot);
    this.restoringSnapshot = true;
    let inserted = false;
    try {
      inserted = insertTextIntoComposer(target, insertText);
    } catch (error) {
      console.warn('[ComposerGuard] insert failed:', error);
    } finally {
      this.restoringSnapshot = false;
    }
    if (!inserted) {
      this.reviewMode = false;
      this.clearReviewInsertionSelection();
      this.setTargetGlow(false);
      this.activeSession = null;
      this.latestAssist = null;
      this.root?.remove();
      this.root = null;
      this.dispatchComposeAssistVisibility(false);
      this.showFeedbackReceipt({
        target,
        contextKey,
        snapshot: feedbackContext.snapshot,
        title: '未写入草稿',
        detail:
          '当前输入框没有接受写入；Personal AI 没有发送或提交。请重新聚焦输入框后重试。',
      });
      return;
    }
    this.clearReviewInsertionSelection();
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
    this.assistSurfaceThresholds = normalizeComposerAssistSurfaceThresholds(
      envConfig?.[SURFACE_THRESHOLDS_CONFIG_KEY],
    );
  }

  private getActiveAssistThreshold(): number {
    return getComposerAssistThresholdForSurface(
      this.activeSession?.snapshot.surface,
      this.assistSurfaceThresholds,
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
    this.clearPreviewObservationTimer();
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
    this.previewObservationCandidate = null;
    this.writeDebugState('ambient_preview:remember', {
      contextKey: this.activeSession.contextKey,
      suggestionLength: suggestionText.length,
    });
  }

  private schedulePreviewedAssistMemory(): void {
    if (!this.activeSession || !this.latestAssist?.insertText) return;
    const contextKey = this.activeSession.contextKey;
    this.cancelPreviewObservation();
    const suggestionText = sanitizeComposerAssistInsertText(
      this.latestAssist.insertText,
    );
    if (!suggestionText) return;
    const recordedAt = Date.now();
    this.previewObservationCandidate = {
      target: this.activeSession.target,
      contextKey,
      feedbackContext: this.getCurrentFeedbackContext(),
      suggestionText,
      recordedAt,
      sourceRequestId: getAmbientTraceSourceRequestId(contextKey, recordedAt),
    };
    this.writeDebugState('ambient_preview:schedule', { contextKey });
    this.previewObservationTimer = window.setTimeout(() => {
      this.previewObservationTimer = null;
      if (!this.activeSession || this.activeSession.contextKey !== contextKey) {
        this.writeDebugState('ambient_preview:skip_context', {
          expectedContextKey: contextKey,
          currentContextKey: this.activeSession?.contextKey,
        });
        return;
      }
      if (!this.root || this.root.dataset.state !== 'ready') {
        this.writeDebugState('ambient_preview:skip_state', {
          contextKey,
          state: this.root?.dataset.state,
        });
        return;
      }
      this.rememberPreviewedAssist();
    }, PREVIEW_OBSERVATION_DWELL_MS);
  }

  private clearPreviewObservationTimer(): void {
    if (this.previewObservationTimer == null) return;
    window.clearTimeout(this.previewObservationTimer);
    this.previewObservationTimer = null;
  }

  private cancelPreviewObservation(): void {
    this.clearPreviewObservationTimer();
    this.previewObservationCandidate = null;
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
    this.cancelPreviewObservation();
    if (!contextKey || this.previewedAssistDraft?.contextKey === contextKey) {
      this.previewedAssistDraft = null;
    }
    if (
      !contextKey ||
      this.previewObservationCandidate?.contextKey === contextKey
    ) {
      this.previewObservationCandidate = null;
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
        cueId: item.cue?.id,
        cueKey: item.cue?.cueKey,
        cue: summarizeCueForTrace(item.cue),
      }));
  }

  private submitAmbientCalibrationTrace(
    payload: Record<string, unknown>,
  ): Promise<ComposerGuardAmbientTraceSubmitResult> {
    const action = String(payload.action || 'unknown');
    const finish = (
      result: ComposerGuardAmbientTraceSubmitResult,
    ): ComposerGuardAmbientTraceSubmitResult => {
      this.writeDebugState('ambient_trace', {
        action,
        state: result.state,
        error: result.error,
      });
      return result;
    };

    if (typeof chrome === 'undefined' || !chrome?.runtime?.sendMessage) {
      return Promise.resolve(
        finish({
          state: 'unavailable',
          error: 'chrome_runtime_unavailable',
        }),
      );
    }
    return new Promise((resolve) => {
      const resolveWith = (result: ComposerGuardAmbientTraceSubmitResult) => {
        resolve(finish(result));
      };
      try {
        chrome.runtime.sendMessage(
          {
            type: 'AMBIENT_CALIBRATION_TRACE',
            trace: payload,
          },
          (response?: {
            success?: boolean;
            result?: {
              stored?: boolean;
              calibrationReceipt?: {
                stored?: boolean;
                duplicate?: boolean;
              };
            };
            error?: string;
          }) => {
            const runtimeError = chrome.runtime.lastError;
            if (runtimeError) {
              resolveWith({
                state: 'failed',
                error:
                  runtimeError.message || 'ambient_calibration_runtime_error',
              });
              return;
            }
            if (!response?.success) {
              resolveWith({
                state: 'failed',
                error: response?.error || 'ambient_calibration_trace_failed',
              });
              return;
            }
            const receipt = response.result?.calibrationReceipt;
            if (receipt?.duplicate || receipt?.stored === false) {
              resolveWith({ state: 'duplicate' });
              return;
            }
            if (response.result?.stored === false) {
              resolveWith({ state: 'duplicate' });
              return;
            }
            resolveWith({ state: 'stored' });
          },
        );
      } catch (error) {
        console.warn('[ComposerGuard] ambient calibration trace failed:', error);
        resolveWith({
          state: 'failed',
          error:
            error instanceof Error
              ? error.message
              : 'ambient_calibration_trace_failed',
        });
      }
    });
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
        cueIds: getAssistCueIds(assist),
        cueKeys: getAssistCueKeys(assist),
        beforeTextLength: draft.beforeText?.length,
      },
      createdAt: Date.now(),
    };
  }

  private recordAmbientInsertedTrace(
    undo: PendingInsertionUndo,
  ): Promise<ComposerGuardAmbientTraceSubmitResult> | null {
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
    return this.submitAmbientCalibrationTrace(
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

  private recordAmbientWrongTrace(): Promise<ComposerGuardAmbientTraceSubmitResult> | null {
    if (!this.activeSession) return null;
    const feedbackContext = this.getCurrentFeedbackContext();
    const suggestionText = sanitizeComposerAssistInsertText(
      feedbackContext.assist?.insertText,
    );
    if (!suggestionText || !feedbackContext.contextKey) return null;
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
    const payload = this.buildAmbientTracePayload(
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
    );
    this.clearPreviewedAssistDraft(feedbackContext.contextKey);
    return this.submitAmbientCalibrationTrace(payload);
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
    const candidate = this.previewObservationCandidate;
    if (
      candidate &&
      !candidate.sendTraceRecorded &&
      Date.now() - candidate.recordedAt >= PREVIEW_OBSERVATION_DWELL_MS &&
      Date.now() - candidate.recordedAt <= AMBIENT_DRAFT_TTL_MS &&
      this.isElementNearComposerTarget(sendElement, candidate.target)
    ) {
      this.previewedAssistDraft = candidate;
      this.previewObservationCandidate = null;
      return candidate;
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
      void this.submitAmbientCalibrationTrace(
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
    const calibrationTrace = this.submitAmbientCalibrationTrace(
      this.buildAmbientTracePayload(preview, summary, trigger),
    );
    this.showPreviewSendCalibrationReceipt(preview, calibrationTrace);
    preview.sendTraceRecorded = true;
    this.previewedAssistDraft = null;
    this.previewObservationCandidate = null;
  }

  private async recordAssistFeedback(
    kind: AssistFeedbackKind,
    feedbackContext = this.getCurrentFeedbackContext(),
  ): Promise<ComposerGuardFeedbackRecordResult> {
    const { assist, contextKey, snapshot } = feedbackContext;
    const result = await getChromeLocal<{
      envConfig?: Record<string, unknown>;
      composerGuardFeedbackEvents?: ComposerGuardFeedbackEvent[];
    }>([ENV_CONFIG_KEY, FEEDBACK_EVENTS_KEY]);
    const envConfig = result.envConfig || {};
    const globalThreshold = normalizeComposerAssistThreshold(
      envConfig[CONFIDENCE_THRESHOLD_CONFIG_KEY],
      this.assistConfidenceThreshold,
    );
    const surfaceThresholds = normalizeComposerAssistSurfaceThresholds(
      envConfig[SURFACE_THRESHOLDS_CONFIG_KEY],
    );
    const surfaceKey = snapshot?.surface;
    const currentThreshold = getComposerAssistThresholdForSurface(
      surfaceKey,
      surfaceThresholds,
      globalThreshold,
    );
    const nextThreshold = getNextComposerAssistThreshold(
      currentThreshold,
      kind,
    );
    const nextEnvConfig: Record<string, unknown> = { ...envConfig };
    if (surfaceKey) {
      const nextSurfaceThresholds = {
        ...surfaceThresholds,
        [surfaceKey]: nextThreshold,
      };
      this.assistConfidenceThreshold = globalThreshold;
      this.assistSurfaceThresholds = nextSurfaceThresholds;
      nextEnvConfig[SURFACE_THRESHOLDS_CONFIG_KEY] = nextSurfaceThresholds;
    } else {
      this.assistConfidenceThreshold = nextThreshold;
      this.assistSurfaceThresholds = surfaceThresholds;
      nextEnvConfig[CONFIDENCE_THRESHOLD_CONFIG_KEY] = nextThreshold;
    }

    const event: ComposerGuardFeedbackEvent = {
      kind,
      timestamp: Date.now(),
      thresholdBefore: currentThreshold,
      thresholdAfter: nextThreshold,
      thresholdScope: surfaceKey ? 'surface' : 'global',
      thresholdSurface: surfaceKey,
      confidence: assist?.confidence,
      suggestionType: assist?.suggestionType,
      surface: snapshot?.surface,
      scenario: snapshot?.scenario,
      contextType: snapshot?.contextType,
      contextKey,
      cueIds: getAssistCueIds(assist),
      cueKeys: getAssistCueKeys(assist),
    };
    const events = Array.isArray(result.composerGuardFeedbackEvents)
      ? result.composerGuardFeedbackEvents
      : [];

    await setChromeLocal({
      [ENV_CONFIG_KEY]: nextEnvConfig,
      [FEEDBACK_EVENTS_KEY]: [...events, event].slice(-MAX_FEEDBACK_EVENTS),
    });

    const structuredFeedback = this.submitStructuredEvidenceFeedback(
      kind,
      feedbackContext,
    );
    return { event, structuredFeedback };
  }

  private async submitStructuredEvidenceFeedback(
    kind: AssistFeedbackKind,
    feedbackContext: ComposerGuardFeedbackContext,
  ): Promise<ComposerGuardStructuredFeedbackSubmitResult> {
    const targets = getStructuredEvidenceFeedbackTargets(feedbackContext.assist);
    if (targets.length === 0) {
      return { state: 'unavailable', targetCount: 0 };
    }

    const results = await Promise.all(
      targets.map(async (target) => {
        try {
          const detail = buildStructuredFeedbackDetail(
            kind,
            feedbackContext.snapshot,
            feedbackContext.contextKey,
            target,
          );
          const response = await sendRuntimeMessage({
            type: 'CONTEXT_RECALL_FEEDBACK',
            feedback: {
              targetId: target.id,
              targetType: target.type,
              action: kind === 'accepted' ? 'positive' : 'negative',
              rehearsalActivationId: target.activationId,
              detail,
            },
          });
          const responseObject = asPlainObject(response);
          if (responseObject?.success === false) {
            throw new Error(
              typeof responseObject.error === 'string'
                ? responseObject.error
                : 'context_recall_feedback_failed',
            );
          }
          return { ok: true as const };
        } catch (error) {
          console.warn(
            '[ComposerGuard] evidence feedback failed:',
            error,
          );
          return {
            ok: false as const,
            error:
              error instanceof Error
                ? error.message
                : 'context_recall_feedback_failed',
          };
        }
      }),
    );

    const failed = results.find((result) => !result.ok);
    if (failed && !failed.ok) {
      return {
        state: 'failed',
        error: failed.error,
        targetCount: targets.length,
      };
    }
    return { state: 'stored', targetCount: targets.length };
  }

  private getAssistRequestGate(
    signature: string,
    now = Date.now(),
  ): ReturnType<typeof getComposerAssistRequestGate> {
    return getComposerAssistRequestGate({
      signature,
      inFlightSignature: this.inFlightAssistRequest?.signature,
      retryBlockedUntil:
        this.assistRetryBlockedUntilBySignature.get(signature) ?? null,
      now,
    });
  }

  private pruneAssistRetryCooldowns(now = Date.now()): void {
    for (const [signature, retryBlockedUntil] of this
      .assistRetryBlockedUntilBySignature) {
      if (retryBlockedUntil <= now) {
        this.assistRetryBlockedUntilBySignature.delete(signature);
      }
    }
  }

  private canRunComposerAssist(): boolean {
    return this.configLoaded && this.composeAssistEnabled;
  }

  private writeDebugState(
    stage: string,
    details: Record<string, unknown> = {},
  ): void {
    try {
      if (window.localStorage.getItem('__PAI_DEBUG_COMPOSER_GUARD') !== '1') {
        return;
      }
      const currentRaw = document.documentElement.getAttribute(
        'data-pai-composer-guard-debug',
      );
      let history: unknown[] = [];
      if (currentRaw) {
        try {
          const current = JSON.parse(currentRaw) as { history?: unknown[] };
          history = Array.isArray(current.history) ? current.history : [];
        } catch {
          history = [];
        }
      }
      const entry = {
        stage,
        at: Date.now(),
        details,
      };
      history = [...history, entry].slice(-12);
      document.documentElement.setAttribute(
        'data-pai-composer-guard-debug',
        JSON.stringify({
          stage,
          at: Date.now(),
          configLoaded: this.configLoaded,
          composeAssistEnabled: this.composeAssistEnabled,
          details,
          history,
        }).slice(0, 4000),
      );
    } catch {
      // Debug-only path.
    }
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
    this.clearReviewInsertionSelection();
    this.cancelPreviewObservation();
    this.clearFeedbackReceipt(false);
    this.clearInsertionUndo(true);
    this.setTargetGlow(false);
    this.activeSession = null;
    this.latestAssist = null;
    this.root?.remove();
    this.root = null;
    this.dispatchComposeAssistVisibility(false);
  }

  private removeAffordance(): void {
    this.reviewMode = false;
    this.clearReviewInsertionSelection();
    this.cancelPreviewObservation();
    this.clearFeedbackReceipt(false);
    this.clearInsertionUndo(true);
    this.setTargetGlow(false);
    this.root?.remove();
    this.root = null;
    this.dispatchComposeAssistVisibility(false);
  }

  private dispatchComposeAssistVisibility(visible: boolean): void {
    window.dispatchEvent(
      new CustomEvent('personal-ai-compose-assist-visibility', {
        detail: { visible },
      }),
    );
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
      } else if (this.feedbackReceipt) {
        this.positionFeedbackReceiptRoot(this.feedbackReceipt.target);
      }
    }, 80);
  };

  private getFeedbackThresholdDetail(
    receipt: ComposerGuardFeedbackReceipt,
  ): string {
    if (!receipt.thresholdState) return '';
    const surfaceLabel = getComposerFeedbackSurfaceLabel(
      receipt.thresholdSurface || receipt.snapshot?.surface,
    );
    if (receipt.thresholdState === 'pending') {
      return `调阈保存中：只调整${surfaceLabel}，不静默其他输入框。`;
    }
    if (receipt.thresholdState === 'failed') {
      const error = clipCalibrationError(receipt.thresholdError);
      return `调阈未保存：建议已隐藏，但下次谨慎度可能不会保留${
        error ? `：${error}` : ''
      }。`;
    }

    const before = formatComposerAssistThresholdValue(receipt.thresholdBefore);
    const after = formatComposerAssistThresholdValue(receipt.thresholdAfter);
    const thresholdLabel =
      receipt.thresholdScope === 'global'
        ? '全局兜底阈值'
        : `${surfaceLabel}阈值`;
    const transition = before && after ? ` ${before} -> ${after}` : '';
    return `调阈已保存：${thresholdLabel}${transition}；只影响这个 surface。`;
  }

  private getStructuredFeedbackDetail(
    receipt: ComposerGuardFeedbackReceipt,
  ): string {
    if (!receipt.hasRehearsalFeedback || !receipt.structuredFeedbackState) {
      return '';
    }
    const accepted =
      receipt.structuredFeedbackKind === 'accepted' ||
      receipt.variant === 'inserted';
    if (receipt.structuredFeedbackState === 'pending') {
      if (accepted) {
        return '预演使用反馈写入中：正在标记对应 activation 为 accepted。';
      }
      return '预演降权写入中：正在标记对应 activation 为 irrelevant。';
    }
    if (receipt.structuredFeedbackState === 'stored') {
      const count =
        typeof receipt.structuredFeedbackTargetCount === 'number' &&
        receipt.structuredFeedbackTargetCount > 0
          ? `${receipt.structuredFeedbackTargetCount} 条`
          : '';
      if (accepted) {
        return `预演使用反馈已写入${count ? `：${count}线索` : ''}；相同场景后续会优先保留。`;
      }
      return `预演降权已写入${count ? `：${count}线索` : ''}；相同场景后续会降权。`;
    }
    if (receipt.structuredFeedbackState === 'failed') {
      const error = clipCalibrationError(receipt.structuredFeedbackError);
      if (accepted) {
        return `预演使用反馈未写入${
          error ? `：${error}` : ''
        }；草稿仍只留在输入框。`;
      }
      return `预演降权未写入${
        error ? `：${error}` : ''
      }；本地调阈仍已尝试。`;
    }
    if (accepted) {
      return '未找到可写入的预演 activation；仅记录草稿保留和脱敏校准状态。';
    }
    return '未找到可写入的预演 activation；仅调整当前输入框场景。';
  }

  private getFeedbackReceiptDetail(
    receipt: ComposerGuardFeedbackReceipt,
  ): string {
    if (receipt.variant === 'inserted') {
      return this.getInsertionCommitReceiptDetail(receipt);
    }
    if (receipt.variant === 'preview_send') {
      return this.getPreviewSendReceiptDetail(receipt);
    }
    if (receipt.detail) return receipt.detail;
    const surfaceLabel = getComposerFeedbackSurfaceLabel(
      receipt.snapshot?.surface,
    );
    const rehearsalScope = receipt.rehearsalCueScope
      ? `命中线索：${receipt.rehearsalCueScope}；`
      : '这条预演建议；';
    const baseDetail = receipt.hasRehearsalFeedback
      ? `${rehearsalScope}${surfaceLabel}也会更谨慎；换个 prompt 仍会重新判断。`
      : `${surfaceLabel}会更谨慎；换个 prompt 仍会重新判断。`;
    const boundaryDetail = receipt.hasRehearsalFeedback
      ? '本次点击只隐藏当前建议；不会发送/提交草稿、删除来源记忆或关闭其他输入框建议，预演降权等后台写入以下方回执为准。'
      : '本次点击只隐藏当前建议；不会发送/提交草稿、删除来源记忆或关闭其他输入框建议。';
    const thresholdDetail = this.getFeedbackThresholdDetail(receipt);
    const structuredFeedbackDetail = this.getStructuredFeedbackDetail(receipt);
    let calibrationDetail = '只保存脱敏校准信号。';

    if (receipt.calibrationState === 'pending') {
      calibrationDetail = '脱敏校准信号正在提交，不上传完整草稿。';
    } else if (receipt.calibrationState === 'stored') {
      calibrationDetail = '校准已写入，只保存脱敏校准信号。';
    } else if (receipt.calibrationState === 'duplicate') {
      calibrationDetail =
        '校准回执重复，未新增写入；仍只保存脱敏校准信号。';
    } else if (receipt.calibrationState === 'failed') {
      const error = clipCalibrationError(receipt.calibrationError);
      calibrationDetail = `建议已隐藏，但校准未写入${
        error ? `：${error}` : ''
      }。`;
    } else if (receipt.calibrationState === 'unavailable') {
      calibrationDetail =
        '建议已隐藏，但当前页面无法连接校准通道，未写入学习信号。';
    }

    return [
      baseDetail,
      boundaryDetail,
      thresholdDetail,
      structuredFeedbackDetail,
      calibrationDetail,
    ]
      .filter(Boolean)
      .join(' ');
  }

  private getPreviewSendReceiptDetail(
    receipt: ComposerGuardFeedbackReceipt,
  ): string {
    const surfaceLabel = getComposerFeedbackSurfaceLabel(
      receipt.snapshot?.surface,
    );
    const baseDetail =
      '你看过建议后自行发送了回复；这只作为建议时机/措辞校准，不代表你拒绝所有建议。';
    const boundaryDetail = `${surfaceLabel}不会被全局静默；不会发送/提交额外内容、删除来源记忆或写入完整草稿。`;
    let calibrationDetail = '';

    if (receipt.calibrationState === 'pending') {
      calibrationDetail =
        'sent_without_insert 脱敏校准信号正在提交，只包含 hash、长度、tag 和证据引用。';
    } else if (receipt.calibrationState === 'stored') {
      calibrationDetail =
        '已记录 sent_without_insert 校准信号，只保存脱敏摘要。';
    } else if (receipt.calibrationState === 'duplicate') {
      calibrationDetail =
        'sent_without_insert 校准回执重复，未新增写入；仍只保存脱敏摘要。';
    } else if (receipt.calibrationState === 'failed') {
      const error = clipCalibrationError(receipt.calibrationError);
      calibrationDetail = `未插入校准未写入${
        error ? `：${error}` : ''
      }；你的回复仍只由原页面发送。`;
    } else if (receipt.calibrationState === 'unavailable') {
      calibrationDetail =
        '当前页面无法连接校准通道，未写入学习信号；你的回复仍只由原页面发送。';
    }

    return [baseDetail, boundaryDetail, calibrationDetail]
      .filter(Boolean)
      .join(' ');
  }

  private getInsertionCommitReceiptDetail(
    receipt: ComposerGuardFeedbackReceipt,
  ): string {
    const structuredFeedbackDetail = this.getStructuredFeedbackDetail(receipt);
    let calibrationDetail = '';
    if (receipt.calibrationState === 'pending') {
      calibrationDetail =
        '撤销窗口已结束；当前草稿仍只留在输入框，未发送/提交。脱敏校准信号正在提交，只包含 hash、长度、tag 和证据引用。';
    } else if (receipt.calibrationState === 'stored') {
      calibrationDetail =
        '撤销窗口已结束；已记录 inserted 校准信号，只保存脱敏摘要；当前草稿未发送/提交。';
    } else if (receipt.calibrationState === 'duplicate') {
      calibrationDetail =
        '撤销窗口已结束；校准回执重复，未新增写入；当前草稿仍未发送/提交。';
    } else if (receipt.calibrationState === 'failed') {
      const error = clipCalibrationError(receipt.calibrationError);
      calibrationDetail = `撤销窗口已结束；当前草稿未发送/提交；但校准未写入${
        error ? `：${error}` : ''
      }。`;
    } else if (receipt.calibrationState === 'unavailable') {
      calibrationDetail =
        '撤销窗口已结束；当前页面无法连接校准通道，未写入学习信号；当前草稿未发送/提交。';
    } else {
      calibrationDetail =
        '撤销窗口已结束；当前草稿仍只留在输入框，未发送/提交。';
    }
    return [calibrationDetail, structuredFeedbackDetail]
      .filter(Boolean)
      .join(' ');
  }

  private updateFeedbackReceiptThresholdState(
    contextKey: string | undefined,
    result: ComposerGuardThresholdSubmitResult,
  ): void {
    if (!this.feedbackReceipt) return;
    if (
      contextKey &&
      this.feedbackReceipt.contextKey &&
      this.feedbackReceipt.contextKey !== contextKey
    ) {
      return;
    }
    this.showFeedbackReceipt({
      ...this.feedbackReceipt,
      thresholdState: result.state,
      thresholdError: result.error,
      thresholdBefore: result.event?.thresholdBefore,
      thresholdAfter: result.event?.thresholdAfter,
      thresholdScope: result.event?.thresholdScope,
      thresholdSurface: result.event?.thresholdSurface,
    });
  }

  private updateFeedbackReceiptCalibrationState(
    contextKey: string | undefined,
    result: ComposerGuardAmbientTraceSubmitResult,
  ): void {
    if (!this.feedbackReceipt) return;
    if (
      contextKey &&
      this.feedbackReceipt.contextKey &&
      this.feedbackReceipt.contextKey !== contextKey
    ) {
      return;
    }
    this.showFeedbackReceipt({
      ...this.feedbackReceipt,
      calibrationState: result.state,
      calibrationError: result.error,
    });
  }

  private updateFeedbackReceiptStructuredFeedbackState(
    contextKey: string | undefined,
    result: ComposerGuardStructuredFeedbackSubmitResult,
  ): void {
    if (!this.feedbackReceipt) return;
    if (
      contextKey &&
      this.feedbackReceipt.contextKey &&
      this.feedbackReceipt.contextKey !== contextKey
    ) {
      return;
    }
    this.showFeedbackReceipt({
      ...this.feedbackReceipt,
      structuredFeedbackState: result.state,
      structuredFeedbackError: result.error,
      structuredFeedbackTargetCount: result.targetCount,
    });
  }

  private showFeedbackReceipt(receipt: ComposerGuardFeedbackReceipt): void {
    this.clearFeedbackReceipt(false);
    this.feedbackReceipt = receipt;
    const title = receipt.title || (receipt.hasRehearsalFeedback
      ? '已隐藏预演建议'
      : '已隐藏这条建议');
    const detail = this.getFeedbackReceiptDetail(receipt);
    const root = this.ensureRoot();
    root.onpointerenter = null;
    root.onpointerleave = null;
    root.onpointerover = null;
    root.onpointerout = null;
    root.onfocusin = null;
    root.onfocusout = null;
    root.className = 'pai-composer-guard pai-composer-guard--feedback';
    root.dataset.state = 'feedback';
    root.innerHTML = `
      <div class="pai-composer-guard-feedback-toast" role="status">
        <div class="pai-composer-guard-feedback-title">${escapeHtml(title)}</div>
        <div class="pai-composer-guard-feedback-detail">${escapeHtml(detail)}</div>
      </div>
    `;
    this.positionFeedbackReceiptRoot(receipt.target);
    this.feedbackReceiptTimer = window.setTimeout(() => {
      this.clearFeedbackReceipt(true);
    }, FEEDBACK_RECEIPT_TTL_MS);
  }

  private clearFeedbackReceipt(removeRoot: boolean): void {
    if (this.feedbackReceiptTimer != null) {
      window.clearTimeout(this.feedbackReceiptTimer);
      this.feedbackReceiptTimer = null;
    }
    this.feedbackReceipt = null;
    if (removeRoot && this.root?.dataset.state === 'feedback') {
      this.root.remove();
      this.root = null;
    }
  }

  private showInsertionCommitReceipt(
    undo: PendingInsertionUndo,
    calibrationTrace: Promise<ComposerGuardAmbientTraceSubmitResult> | null,
    acceptedFeedback: Promise<ComposerGuardFeedbackRecordResult>,
  ): void {
    const hasRehearsalFeedback = hasRehearsalFeedbackTarget(
      undo.feedbackContext.assist,
    );
    this.showFeedbackReceipt({
      target: undo.target,
      contextKey: undo.contextKey,
      snapshot: undo.feedbackContext.snapshot,
      variant: 'inserted',
      title: '草稿保留已确认',
      hasRehearsalFeedback,
      rehearsalCueScope: getComposerFeedbackRehearsalCueScope(
        undo.feedbackContext.assist,
      ),
      calibrationState: calibrationTrace ? 'pending' : 'unavailable',
      calibrationError: calibrationTrace
        ? undefined
        : 'ambient_calibration_trace_unavailable',
      structuredFeedbackKind: 'accepted',
      structuredFeedbackState: hasRehearsalFeedback ? 'pending' : undefined,
    });
    if (calibrationTrace) {
      void calibrationTrace.then((result) => {
        this.updateFeedbackReceiptCalibrationState(undo.contextKey, result);
      });
    }
    if (hasRehearsalFeedback) {
      void acceptedFeedback
        .then(({ structuredFeedback }) => structuredFeedback)
        .then((result) => {
          this.updateFeedbackReceiptStructuredFeedbackState(
            undo.contextKey,
            result,
          );
        })
        .catch((error) => {
          this.updateFeedbackReceiptStructuredFeedbackState(undo.contextKey, {
            state: 'failed',
            error:
              error instanceof Error
                ? error.message
                : 'context_recall_feedback_failed',
          });
        });
    }
  }

  private showPreviewSendCalibrationReceipt(
    draft: AmbientAssistDraft,
    calibrationTrace: Promise<ComposerGuardAmbientTraceSubmitResult> | null,
  ): void {
    this.showFeedbackReceipt({
      target: draft.target,
      contextKey: draft.contextKey,
      snapshot: draft.feedbackContext.snapshot,
      variant: 'preview_send',
      title: '已记录未插入校准',
      calibrationState: calibrationTrace ? 'pending' : 'unavailable',
      calibrationError: calibrationTrace
        ? undefined
        : 'ambient_calibration_trace_unavailable',
    });
    if (calibrationTrace) {
      void calibrationTrace.then((result) => {
        this.updateFeedbackReceiptCalibrationState(draft.contextKey, result);
      });
    }
  }

  private showInsertionUndo(undo: PendingInsertionUndo): void {
    this.clearFeedbackReceipt(true);
    this.clearInsertionUndo(false);
    this.pendingInsertionUndo = undo;
    const insertionReceipt = buildComposerAssistInsertionReceipt({
      contextType: undo.feedbackContext.snapshot?.contextType,
      surface: undo.feedbackContext.snapshot?.surface,
      suggestionType: undo.feedbackContext.assist?.suggestionType,
    });
    const root = this.ensureRoot();
    root.onpointerenter = null;
    root.onpointerleave = null;
    root.onpointerover = null;
    root.onpointerout = null;
    root.onfocusin = null;
    root.onfocusout = null;
    root.className = 'pai-composer-guard pai-composer-guard--undo';
    root.dataset.state = 'undo';
    root.innerHTML = `
      <div class="pai-composer-guard-undo-toast" role="status">
        <span class="pai-composer-guard-undo-copy">
          <strong>${escapeHtml(insertionReceipt.title)}</strong>
          <span>未发送，可继续编辑</span>
          <span class="pai-composer-guard-undo-detail">${escapeHtml(
            insertionReceipt.detail,
          )}</span>
        </span>
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
      this.clearInsertionUndo(true, true);
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

  private clearInsertionUndo(
    commitAccepted: boolean,
    showCommitReceipt = false,
  ): void {
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
      const acceptedFeedback = this.recordAssistFeedback(
        'accepted',
        undo.feedbackContext,
      );
      if (!undo.sendTraceRecorded) {
        this.rememberAcceptedInsertion(undo);
        const calibrationTrace = this.recordAmbientInsertedTrace(undo);
        if (showCommitReceipt) {
          this.showInsertionCommitReceipt(
            undo,
            calibrationTrace,
            acceptedFeedback,
          );
        } else {
          void acceptedFeedback.catch((error) => {
            console.warn('[ComposerGuard] accepted feedback failed:', error);
          });
        }
      } else {
        void acceptedFeedback.catch((error) => {
          console.warn('[ComposerGuard] accepted feedback failed:', error);
        });
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
    this.positionFloatingRoot(target, 112, 36, true);
  }

  private positionFeedbackReceiptRoot(target: ComposerTarget): void {
    this.positionFloatingRoot(target, 260, 48, false);
  }

  private positionFloatingRoot(
    target: ComposerTarget,
    width: number,
    height: number,
    clearAsUndo: boolean,
  ): void {
    if (!this.root) return;
    const rect = this.getAnchorRectForElement(target.element);
    if (!rect) {
      if (clearAsUndo) {
        this.clearInsertionUndo(true);
      } else {
        this.clearFeedbackReceipt(true);
      }
      return;
    }
    const top = clamp(
      rect.top + ICON_INSET,
      VIEWPORT_MARGIN,
      Math.max(VIEWPORT_MARGIN, window.innerHeight - height - VIEWPORT_MARGIN),
    );
    const left = clamp(
      rect.right - width,
      VIEWPORT_MARGIN,
      Math.max(VIEWPORT_MARGIN, window.innerWidth - width - VIEWPORT_MARGIN),
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
      #${ROOT_ID}.pai-composer-guard--undo,
      #${ROOT_ID}.pai-composer-guard--feedback {
        width: auto;
        height: auto;
      }
      .pai-composer-guard-undo-toast {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        max-width: min(360px, calc(100vw - 24px));
        min-height: 28px;
        padding: 5px 7px 5px 9px;
        border: 1px solid rgba(17, 24, 39, 0.12);
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.98);
        box-shadow: 0 10px 24px rgba(17, 24, 39, 0.16);
        color: #374151;
        white-space: normal;
      }
      .pai-composer-guard-undo-copy {
        display: grid;
        gap: 1px;
        min-width: 0;
      }
      .pai-composer-guard-undo-copy strong {
        color: #166534;
        font-size: 12px;
        line-height: 1.1;
      }
      .pai-composer-guard-undo-copy span {
        color: #4b5563;
        font-size: 11px;
        line-height: 1.1;
      }
      .pai-composer-guard-undo-detail {
        overflow-wrap: anywhere;
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
      .pai-composer-guard-feedback-toast {
        display: grid;
        gap: 2px;
        width: min(260px, calc(100vw - 24px));
        min-height: 34px;
        padding: 7px 9px;
        border: 1px solid rgba(180, 83, 9, 0.18);
        border-radius: 8px;
        background: rgba(255, 251, 235, 0.98);
        box-shadow: 0 10px 24px rgba(17, 24, 39, 0.16);
        color: #78350f;
      }
      .pai-composer-guard-feedback-title {
        font-weight: 750;
      }
      .pai-composer-guard-feedback-detail {
        color: #92400e;
        font-size: 11px;
        overflow-wrap: anywhere;
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
      .pai-composer-guard-draft-receipt {
        display: grid;
        gap: 5px;
        margin: 0 0 8px;
        padding: 7px 8px;
        border: 1px solid rgba(17, 24, 39, 0.08);
        border-radius: 7px;
        background: rgba(249, 250, 251, 0.92);
      }
      .pai-composer-guard-source-route-receipt {
        border-color: rgba(37, 99, 235, 0.12);
        background: rgba(239, 246, 255, 0.78);
      }
      .pai-composer-guard-rehearsal-review-receipt {
        border-color: rgba(15, 118, 110, 0.16);
        background: rgba(240, 253, 250, 0.88);
      }
      .pai-composer-guard-draft-receipt-title {
        color: #4b5563;
        font-size: 11px;
        font-weight: 750;
      }
      .pai-composer-guard-draft-receipt-rows {
        display: grid;
        gap: 3px;
      }
      .pai-composer-guard-draft-receipt-row {
        display: grid;
        grid-template-columns: minmax(54px, max-content) 1fr;
        align-items: start;
        gap: 6px;
        font-size: 11px;
        line-height: 1.3;
      }
      .pai-composer-guard-draft-receipt-row span {
        color: #6b7280;
        white-space: nowrap;
      }
      .pai-composer-guard-draft-receipt-row strong {
        color: #374151;
        font-weight: 650;
        overflow-wrap: anywhere;
      }
      .pai-composer-guard-draft-receipt-row--ok strong {
        color: #166534;
      }
      .pai-composer-guard-draft-receipt-row--warn strong {
        color: #92400e;
      }
      .pai-composer-guard-draft-receipt-row--muted strong {
        color: #4b5563;
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
