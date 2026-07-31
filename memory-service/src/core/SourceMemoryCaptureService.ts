import { v4 as uuidv4 } from 'uuid';
import type BetterSqlite3 from 'better-sqlite3';

import type { MemoryChangeLedgerReceipt, MemoryScope } from '../types/index.js';
import type { UserDataManager } from '../storage/UserDataManager.js';
import { chunkText } from '../utils/chunking.js';
import { contentHash } from '../utils/hashing.js';
import { classifyTrust, screenForInjection } from './injectionScreen.js';
import { MemoryChangeLedgerService } from './MemoryChangeLedgerService.js';
import { SourceMemoryDistillationWorker } from './SourceMemoryDistillationWorker.js';
import { now, formatDate } from '../utils/time.js';

export type SourceMemorySourceKind =
  | 'webpage'
  | 'visual_memory'
  | 'selection'
  | 'jira_comment'
  | 'message_reply'
  | 'web_ai_prompt'
  | 'ai_conversation'
  | 'document'
  | 'meeting_material'
  | 'manual';

export type SourceMemoryCaptureMode = 'auto' | 'suggested' | 'manual';
export type SourceMemoryPrivacyLevel =
  | 'private'
  | 'work'
  | 'shareable_summary'
  | 'needs_review';

export interface SourceMemoryInteractionSignals {
  dwellMs?: number;
  activeMs?: number;
  scrollDepth?: number;
  selectedText?: boolean;
  copiedText?: boolean;
  repeatVisit?: boolean;
  ownerAuthored?: boolean;
  manualClick?: boolean;
  openedFromMemory?: boolean;
}

export interface SourceMemoryCandidateInput {
  sourceKind?: SourceMemorySourceKind;
  sourceUrl?: string;
  sourceTitle?: string;
  text?: string;
  selectedText?: string;
  nearbyText?: string;
  entityHints?: Array<{ kind: string; value: string }>;
  interactions?: SourceMemoryInteractionSignals;
  scope?: MemoryScope;
  metadata?: Record<string, unknown>;
}

export interface SourceMemoryCandidateResult {
  eligible: boolean;
  score: number;
  suggestedAction: 'auto_save' | 'suggest' | 'ignore' | 'blocked';
  reasons: string[];
  blockedReason?: string;
  captureMode: SourceMemoryCaptureMode;
  policyReceipt: SourceMemoryCapturePolicyReceipt;
}

export interface SourceMemoryCapturePolicyReceipt {
  state: 'blocked' | 'ignored_low_signal' | 'suggested_review' | 'auto_save_candidate';
  label: string;
  detail: string;
  evidence: string[];
  nextStep: string;
}

export interface SourceMemoryCaptureWriteReceipt {
  state: 'saved_with_recall_signal' | 'saved_without_recall_signal' | 'dismissed_no_recall';
  label: string;
  detail: string;
  evidence: string[];
  nextStep: string;
}

export interface SourceMemoryCaptureActionReceipt {
  state:
    | 'saved'
    | 'resaved'
    | 'duplicate_no_change'
    | 'duplicate_note_updated'
    | 'note_updated'
    | 'dismissed';
  label: string;
  detail: string;
  evidence: string[];
  nextStep: string;
  occurredAt: number;
}

export interface SourceMemoryCaptureNoWriteReceipt {
  state: 'blocked_no_write' | 'invalid_no_write';
  label: string;
  detail: string;
  evidence: string[];
  nextStep: string;
}

export interface SourceMemoryCreateInput extends SourceMemoryCandidateInput {
  captureMode?: SourceMemoryCaptureMode;
  captureReason?: string;
  note?: string;
  privacyLevel?: SourceMemoryPrivacyLevel;
  metadata?: Record<string, unknown>;
}

export interface SourceMemoryCapsule {
  id: string;
  sourceKind: string;
  sourceUrl?: string;
  sourceTitle: string;
  sourceHost?: string;
  captureMode: SourceMemoryCaptureMode;
  captureReason: string;
  status: string;
  scope: MemoryScope;
  privacyLevel: SourceMemoryPrivacyLevel;
  summary: string;
  contentPreview: string;
  messageId?: string;
  metadata?: Record<string, unknown>;
  changeLedger: MemoryChangeLedgerReceipt;
  writeReceipt: SourceMemoryCaptureWriteReceipt;
  actionReceipt?: SourceMemoryCaptureActionReceipt;
  createdAt: number;
  updatedAt: number;
  savedAt?: number;
  duplicate?: boolean;
  anchors: SourceMemoryAnchor[];
  takeaways: SourceMemoryTakeaway[];
  triggers: SourceMemoryTrigger[];
}

interface SourceMemoryAnchor {
  id: string;
  anchorKind: string;
  locator?: string;
  quoteOrPreview: string;
  sensitivity: string;
  confidence: number;
}

interface SourceMemoryTakeaway {
  id: string;
  kind: string;
  title: string;
  body: string;
  evidenceAnchorIds: string[];
  confidence: number;
  status: string;
}

interface SourceMemoryTrigger {
  id: string;
  triggerKind: string;
  description: string;
  matcher: Record<string, unknown>;
  defaultBehavior: string;
}

interface SourceMemoryRow {
  id: string;
  source_kind: string;
  source_url: string | null;
  source_title: string;
  source_host: string | null;
  capture_mode: SourceMemoryCaptureMode;
  capture_reason: string;
  status: string;
  scope: MemoryScope;
  privacy_level: SourceMemoryPrivacyLevel;
  summary: string | null;
  content_preview: string | null;
  message_id: string | null;
  metadata_json: string | null;
  created_at: number;
  updated_at: number;
  saved_at: number | null;
}

interface SourceMemoryAnchorRow {
  id: string;
  anchor_kind: string;
  locator: string | null;
  quote_or_preview: string;
  sensitivity: string;
  confidence: number;
}

interface SourceMemoryTakeawayRow {
  id: string;
  kind: string;
  title: string;
  body: string;
  evidence_anchor_ids_json: string;
  confidence: number;
  status: string;
}

interface SourceMemoryTriggerRow {
  id: string;
  trigger_kind: string;
  description: string;
  matcher_json: string;
  default_behavior: string;
}

interface SourceMemoryActionEventRow {
  event_type: string;
  event_strength: string;
  metadata_json: string | null;
  created_at: number;
}

type SourceMemoryDistillationStatus = 'ready' | 'partial' | 'blocked';

interface SourceMemoryDistillationReceipt {
  status: SourceMemoryDistillationStatus;
  schemaVersion: 1;
  oneLineCue: string;
  compactMemo: string;
  policyReceipt: {
    state: SourceMemoryDistillationStatus;
    label: string;
    detail: string;
    evidence: string[];
    nextStep: string;
  };
  sourceReliability: {
    level: string;
    reason: string;
  };
  downstreamUse: {
    allowed: string[];
    blocked: string[];
  };
  generatedAt: number;
  sourceAsOf: number;
  inputHash: string;
  evidenceAnchorIds: string[];
  takeawayCount: number;
  triggerCount: number;
}

interface SourceMemoryAnchorForDistillation {
  id: string;
  quote_or_preview: string;
}

interface SourceMemoryLinkCandidate {
  targetType: string;
  targetId: string;
  confidence: number;
}

export class SourceMemoryCaptureValidationError extends Error {
  constructor(
    message: string,
    readonly statusCode = 400,
    readonly noWriteReceipt?: SourceMemoryCaptureNoWriteReceipt,
  ) {
    super(message);
    this.name = 'SourceMemoryCaptureValidationError';
  }
}

const MAX_CAPTURE_TEXT_CHARS = 16_000;
const MAX_PREVIEW_CHARS = 900;
const MIN_SIGNAL_CHARS = 18;
const MIN_CJK_SIGNAL_CHARS = 8;
const AUTO_SAVE_THRESHOLD = 0.78;
const SUGGEST_THRESHOLD = 0.48;

const SECRET_PATTERN =
  /(?:-----BEGIN\s+(?:RSA\s+|EC\s+|OPENSSH\s+)?PRIVATE\s+KEY-----|\b(?:sk|rk|pk|org|proj)-[A-Za-z0-9_-]{20,}\b|\bgh[pousr]_[A-Za-z0-9_]{20,}\b|\bxox[abprs]-[A-Za-z0-9-]{20,}\b|\bAKIA[0-9A-Z]{16}\b|(?:api[_\s-]?key|access[_\s-]?token|refresh[_\s-]?token|client[_\s-]?secret|id[_\s-]?token|password|passcode|credential|credentials)\s*[:=]\s*['"]?[A-Za-z0-9._~+/=-]{8,})/i;

function getCaptureModeMessageImportance(captureMode: SourceMemoryCaptureMode): number {
  if (captureMode === 'manual') return 0.72;
  if (captureMode === 'auto') return 0.58;
  return 0.64;
}
const SENSITIVE_URL_PATTERN =
  /(?:^|[/?#._-])(login|sign[-_]?in|auth|oauth|password|reset[-_]?password|checkout|payment|billing|mfa|2fa|verification|verify|otp)(?:$|[/?#._-])/i;
const SENSITIVE_URL_PARAM_PATTERN =
  /^(?:access[_-]?token|refresh[_-]?token|id[_-]?token|auth[_-]?token|oauth[_-]?token|token|session(?:id|[_-]?id)?|sid|jwt|password|passcode|client[_-]?secret|api[_-]?key|apikey|secret|signature|sig|x[_-]?amz[_-]?(?:signature|credential)|x[_-]?goog[_-]?(?:signature|credential)|awsaccesskeyid)$/i;
const OAUTH_CODE_CONTEXT_PATTERN = /(?:oauth|auth|login|sign[-_]?in|callback)/i;
const LOW_INFORMATION_PATTERN =
  /^(ok|yes|no|thanks|thank you|sure|好的|可以|收到|谢谢|测试|test|hello|hi)[.!。！\s]*$/i;
const SENTENCE_SPLIT_PATTERN = /(?<=[.!?。！？])\s+/;

export class SourceMemoryCaptureService {
  private readonly changeLedger: MemoryChangeLedgerService;

  constructor(
    private readonly db: BetterSqlite3.Database,
    private readonly userDataManager?: UserDataManager | null,
  ) {
    this.changeLedger = new MemoryChangeLedgerService(db);
  }

  scoreCandidate(input: SourceMemoryCandidateInput): SourceMemoryCandidateResult {
    const text = this.getSignalText(input);
    const rawSourceUrl = normalizeText(input.sourceUrl);
    const sourceUrl = normalizeUrl(input.sourceUrl);
    const sourceTitle = normalizeText(input.sourceTitle).slice(0, 240);
    const blockedReason = this.getBlockedReason(text, sourceUrl, rawSourceUrl);

    if (blockedReason) {
      return {
        eligible: false,
        score: 0,
        suggestedAction: 'blocked',
        reasons: [],
        blockedReason,
        captureMode: 'suggested',
        policyReceipt: buildPolicyReceipt('blocked', {
          blockedReason,
        }),
      };
    }

    if (!hasEnoughSignal(text)) {
      const reasons = ['文本信息量不足'];
      return {
        eligible: false,
        score: 0,
        suggestedAction: 'ignore',
        reasons,
        captureMode: 'suggested',
        policyReceipt: buildPolicyReceipt('ignore', {
          reasons,
        }),
      };
    }

    const reasons: string[] = [];
    let score = 0;

    const sourceKind = input.sourceKind ?? 'webpage';
    const interactions = input.interactions ?? {};
    if (sourceUrl) {
      score += 0.12;
      reasons.push('有来源 URL');
    }
    if (sourceTitle) {
      score += 0.08;
      reasons.push('有页面标题');
    }
    if (sourceKind !== 'webpage') {
      score += 0.06;
      reasons.push(`来源类型明确：${sourceKind}`);
    }

    const lengthScore = Math.min(0.2, text.length / 1200);
    score += lengthScore;
    if (text.length >= 120) reasons.push('文本片段足够完整');

    if (interactions.ownerAuthored) {
      score += 0.28;
      reasons.push('用户对外输入内容');
    }
    if (interactions.manualClick) {
      score += 0.22;
      reasons.push('用户主动点击记住');
    }
    if (input.selectedText || interactions.selectedText) {
      score += 0.16;
      reasons.push('用户选中了文本');
    }
    if (interactions.copiedText) {
      score += 0.12;
      reasons.push('用户复制了内容');
    }
    if ((interactions.dwellMs ?? 0) >= 90_000) {
      score += 0.1;
      reasons.push('停留时间较长');
    }
    if ((interactions.scrollDepth ?? 0) >= 0.6) {
      score += 0.08;
      reasons.push('阅读深度较高');
    }
    if (interactions.repeatVisit) {
      score += 0.08;
      reasons.push('重复访问');
    }
    if (interactions.openedFromMemory) {
      score += 0.06;
      reasons.push('从已有记忆进入');
    }
    if ((input.entityHints ?? []).length > 0) {
      score += Math.min(0.1, (input.entityHints ?? []).length * 0.03);
      reasons.push('命中页面实体线索');
    }

    score = roundScore(Math.min(1, score));
    const hasStrongIntent =
      interactions.ownerAuthored ||
      interactions.manualClick ||
      interactions.copiedText ||
      (Boolean(input.selectedText) && text.length >= 120);
    const suggestedAction =
      score >= AUTO_SAVE_THRESHOLD && hasStrongIntent
        ? 'auto_save'
        : score >= SUGGEST_THRESHOLD
          ? 'suggest'
          : 'ignore';

    return {
      eligible: suggestedAction !== 'ignore',
      score,
      suggestedAction,
      reasons,
      captureMode: suggestedAction === 'auto_save' ? 'auto' : 'suggested',
      policyReceipt: buildPolicyReceipt(suggestedAction, {
        reasons,
        score,
      }),
    };
  }

  createCapsule(input: SourceMemoryCreateInput): SourceMemoryCapsule {
    const candidate = this.scoreCandidate({
      ...input,
      interactions: {
        ...(input.interactions ?? {}),
        manualClick: input.captureMode === 'manual' || input.interactions?.manualClick,
      },
    });
    if (candidate.blockedReason) {
      throw new SourceMemoryCaptureValidationError(
        candidate.blockedReason,
        400,
        buildNoWriteReceipt(input, candidate.blockedReason, 'blocked_no_write'),
      );
    }

    const text = clipText(this.getSignalText(input), MAX_CAPTURE_TEXT_CHARS);
    if (!hasEnoughSignal(text)) {
      throw new SourceMemoryCaptureValidationError(
        'Capture text is too short or low signal.',
        400,
        buildNoWriteReceipt(
          input,
          '资料文本信息量不足，未达到创建 source-memory capsule 的门槛。',
          'invalid_no_write',
        ),
      );
    }

    const ts = now();
    const sourceUrl = normalizeUrl(input.sourceUrl);
    const sourceHost = sourceUrl ? getHost(sourceUrl) : null;
    const sourceTitle =
      normalizeText(input.sourceTitle).slice(0, 240) ||
      (sourceHost ? `网页资料 · ${sourceHost}` : '资料记忆');
    const sourceKind = input.sourceKind ?? (input.selectedText ? 'selection' : 'webpage');
    const captureMode = input.captureMode ?? candidate.captureMode;
    const captureReason =
      normalizeText(input.captureReason) ||
      candidate.reasons.slice(0, 3).join('；') ||
      '用户关注的资料内容';
    const scope = input.scope ?? 'work';
    const privacyLevel = input.privacyLevel ?? 'work';
    const note = normalizeText(input.note).slice(0, 800);
    const summary = note || summarizeText(text, sourceTitle);
    const contentPreview = clipText(text, MAX_PREVIEW_CHARS);
    const sourceFingerprint = contentHash(
      [
        sourceKind,
        sourceUrl || sourceTitle,
        normalizeText(input.selectedText || input.text || text).slice(0, 4000),
      ].join('\n'),
    );
    const fullContent = buildStoredContent({
      sourceTitle,
      note,
      summary,
      text,
      sourceUrl,
    });
    const metadata = {
      ...(input.metadata ?? {}),
      candidateScore: candidate.score,
      candidateReasons: candidate.reasons,
      captureMode,
      interactions: input.interactions ?? {},
      entityHints: normalizeEntityHints(input.entityHints),
      sourceHost,
      sourceKind,
    };

    const existing = this.findCapsuleByFingerprint(sourceFingerprint);
    if (existing) {
      if (existing.status === 'dismissed') {
        const messageId = existing.message_id || uuidv4();
        const transaction = this.db.transaction(() => {
          this.db
            .prepare(
              `UPDATE source_memory_capsules
               SET source_kind = ?,
                   source_url = ?,
                   source_title = ?,
                   source_host = ?,
                   status = 'saved',
                   capture_mode = ?,
                   capture_reason = ?,
                   scope = ?,
                   privacy_level = ?,
                   summary = ?,
                   content_preview = ?,
                   message_id = ?,
                   metadata_json = ?,
                   updated_at = ?,
                   saved_at = ?,
                   dismissed_at = NULL
               WHERE id = ?`,
            )
            .run(
              sourceKind,
              sourceUrl,
              sourceTitle,
              sourceHost,
              captureMode,
              captureReason,
              scope,
              privacyLevel,
              summary,
              contentPreview,
              messageId,
              JSON.stringify(metadata),
              ts,
              ts,
              existing.id,
            );
          this.removeLinkedMemorySignal(existing.message_id);
          this.insertMessageAndChunks({
            messageId,
            capsuleId: existing.id,
            content: fullContent,
            summary,
            scope,
            sourceUrl,
            sourceTitle,
            sourceHost,
            captureMode,
            metadata,
            ts,
          });
          this.insertEvent(existing.id, 'resaved', 'strong', sourceUrl, {
            captureMode,
            captureReason,
          });
        });
        transaction();
      } else {
        const existingMetadata = parseObject(existing.metadata_json ?? '{}');
        const shouldRefreshDuplicateNote = note.length > 0;
        const shouldUpgradeVisualMetadata = hasVisualMetadataUpgrade(existingMetadata, metadata);
        if (shouldRefreshDuplicateNote) {
          const messageId = existing.message_id || uuidv4();
          const refreshedMetadata = {
            ...existingMetadata,
            ...metadata,
            userNote: note,
            noteUpdatedAt: ts,
            duplicateSavedAt: ts,
          };
          const transaction = this.db.transaction(() => {
            this.db
              .prepare(
                `UPDATE source_memory_capsules
                 SET source_kind = ?,
                     source_url = ?,
                     source_title = ?,
                     source_host = ?,
                     capture_mode = ?,
                     capture_reason = ?,
                     scope = ?,
                     privacy_level = ?,
                     summary = ?,
                     content_preview = ?,
                     message_id = ?,
                     metadata_json = ?,
                     updated_at = ?
                 WHERE id = ?`,
              )
              .run(
                sourceKind,
                sourceUrl,
                sourceTitle,
                sourceHost,
                captureMode,
                captureReason,
                scope,
                privacyLevel,
                summary,
                contentPreview,
                messageId,
                JSON.stringify(refreshedMetadata),
                ts,
                existing.id,
              );
            this.removeLinkedMemorySignal(existing.message_id);
            this.insertMessageAndChunks({
              messageId,
              capsuleId: existing.id,
              content: fullContent,
              summary,
              scope,
              sourceUrl,
              sourceTitle,
              sourceHost,
              captureMode,
              metadata: refreshedMetadata,
              ts,
            });
            this.insertEvent(existing.id, 'duplicate_save', 'medium', sourceUrl, {
              captureMode,
              captureReason,
              updatedNote: true,
            });
          });
          transaction();
          this.writeMarkdownSnapshot(existing.id, fullContent, ts);
        } else if (shouldUpgradeVisualMetadata) {
          this.db
            .prepare(
              `UPDATE source_memory_capsules
               SET metadata_json = ?,
                   updated_at = ?
               WHERE id = ?`,
            )
            .run(JSON.stringify(metadata), ts, existing.id);
          this.insertEvent(existing.id, 'duplicate_save', 'medium', sourceUrl, {
            captureMode,
            captureReason,
          });
        } else {
          this.insertEvent(existing.id, 'duplicate_save', 'medium', sourceUrl, {
            captureMode,
            captureReason,
          });
        }
      }
      this.distillCapsule(existing.id, 'duplicate_save');
      this.refreshChangeLedger(existing.id);
      return { ...this.getCapsule(existing.id), duplicate: true };
    }

    const capsuleId = uuidv4();
    const anchorId = uuidv4();
    const messageId = uuidv4();
    const anchorKind = sourceKind === 'visual_memory'
      ? 'visual_region'
      : input.selectedText
        ? 'text_selection'
        : 'page_excerpt';
    const takeaways = buildTakeaways(text, anchorId);
    const triggers = buildTriggers(sourceTitle, sourceUrl, input.entityHints);

    const transaction = this.db.transaction(() => {
      this.db
        .prepare(
          `INSERT INTO source_memory_capsules (
             id, source_kind, source_url, source_title, source_host,
             source_fingerprint, capture_mode, capture_reason, status, scope,
             privacy_level, summary, content_preview, message_id, metadata_json,
             created_at, updated_at, saved_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'saved', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          capsuleId,
          sourceKind,
          sourceUrl,
          sourceTitle,
          sourceHost,
          sourceFingerprint,
          captureMode,
          captureReason,
          scope,
          privacyLevel,
          summary,
          contentPreview,
          messageId,
          JSON.stringify(metadata),
          ts,
          ts,
          ts,
        );

      this.db
        .prepare(
          `INSERT INTO source_memory_anchors (
             id, capsule_id, anchor_kind, locator, quote_or_preview,
             sensitivity, confidence, created_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          anchorId,
          capsuleId,
          anchorKind,
          sourceUrl,
          contentPreview,
          privacyLevel === 'needs_review' ? 'internal' : 'normal',
          0.78,
          ts,
        );

      const takeawayStmt = this.db.prepare(
        `INSERT INTO source_memory_takeaways (
           id, capsule_id, kind, title, body, evidence_anchor_ids_json,
           confidence, status, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?)`,
      );
      for (const takeaway of takeaways) {
        takeawayStmt.run(
          takeaway.id,
          capsuleId,
          takeaway.kind,
          takeaway.title,
          takeaway.body,
          JSON.stringify(takeaway.evidenceAnchorIds),
          takeaway.confidence,
          ts,
        );
      }

      const triggerStmt = this.db.prepare(
        `INSERT INTO source_memory_triggers (
           id, capsule_id, trigger_kind, description, matcher_json,
           default_behavior, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      );
      for (const trigger of triggers) {
        triggerStmt.run(
          trigger.id,
          capsuleId,
          trigger.triggerKind,
          trigger.description,
          JSON.stringify(trigger.matcher),
          trigger.defaultBehavior,
          ts,
        );
      }

      this.insertMessageAndChunks({
        messageId,
        capsuleId,
        content: fullContent,
        summary,
        scope,
        sourceUrl,
        sourceTitle,
        sourceHost,
        captureMode,
        metadata,
        ts,
      });

      this.insertEvent(capsuleId, 'saved', captureMode === 'manual' ? 'strong' : 'medium', sourceUrl, {
        captureMode,
        captureReason,
      });
    });

    transaction();
    this.distillCapsule(capsuleId, 'post_save');
    this.refreshChangeLedger(capsuleId);
    this.writeMarkdownSnapshot(capsuleId, fullContent, ts);

    return this.getCapsule(capsuleId);
  }

  updateCapsuleNote(id: string, note?: string): SourceMemoryCapsule {
    const existing = this.findCapsule(id);
    if (!existing) {
      throw new SourceMemoryCaptureValidationError('Source memory capsule not found.', 404);
    }
    if (existing.status !== 'saved') {
      throw new SourceMemoryCaptureValidationError('Only saved source memory capsules can be annotated.');
    }

    const ts = now();
    const normalizedNote = normalizeText(note).slice(0, 800);
    const existingMessage = existing.message_id
      ? (this.db
          .prepare(`SELECT content FROM messages_raw WHERE id = ?`)
          .get(existing.message_id) as { content: string } | undefined)
      : undefined;
    const text = clipText(
      extractStoredEvidenceText(existingMessage?.content) ||
        existing.content_preview ||
        existing.source_title,
      MAX_CAPTURE_TEXT_CHARS,
    );
    const summary = normalizedNote || summarizeText(text, existing.source_title);
    const metadata = {
      ...parseObject(existing.metadata_json ?? '{}'),
      userNote: normalizedNote || undefined,
      noteUpdatedAt: ts,
    };
    const sourceUrl = existing.source_url ?? undefined;
    const fullContent = buildStoredContent({
      sourceTitle: existing.source_title,
      note: normalizedNote,
      summary,
      text,
      sourceUrl,
    });
    const messageId = existing.message_id || uuidv4();

    const transaction = this.db.transaction(() => {
      this.db
        .prepare(
          `UPDATE source_memory_capsules
           SET summary = ?,
               message_id = ?,
               metadata_json = ?,
               updated_at = ?
           WHERE id = ?`,
        )
        .run(summary, messageId, JSON.stringify(metadata), ts, id);

      this.removeLinkedMemorySignal(existing.message_id);
      this.insertMessageAndChunks({
        messageId,
        capsuleId: id,
        content: fullContent,
        summary,
        scope: existing.scope,
        sourceUrl,
        sourceTitle: existing.source_title,
        sourceHost: existing.source_host,
        captureMode: existing.capture_mode,
        metadata,
        ts,
      });
      this.insertEvent(id, 'note_updated', 'medium', sourceUrl, {
        hasNote: Boolean(normalizedNote),
      });
    });

    transaction();
    this.distillCapsule(id, 'note_updated');
    this.refreshChangeLedger(id);
    this.writeMarkdownSnapshot(id, fullContent, ts);
    return this.getCapsule(id);
  }

  dismissCapsule(id: string, reason?: string): SourceMemoryCapsule {
    const ts = now();
    const existing = this.findCapsule(id);
    if (!existing) {
      throw new SourceMemoryCaptureValidationError('Source memory capsule not found.', 404);
    }
    if (existing.status === 'dismissed') {
      this.changeLedger.setSourceActive('source_memory', id, false);
      return this.getCapsule(id);
    }

    const transaction = this.db.transaction(() => {
      this.db
        .prepare(
          `UPDATE source_memory_capsules
           SET status = 'dismissed', updated_at = ?, dismissed_at = ?
           WHERE id = ?`,
        )
        .run(ts, ts, id);
      this.removeLinkedMemorySignal(existing.message_id);
      this.insertEvent(id, 'dismissed', 'strong', existing.source_url ?? undefined, {
        reason: normalizeText(reason).slice(0, 500),
      });
    });

    transaction();
    this.changeLedger.setSourceActive('source_memory', id, false);
    return this.getCapsule(id);
  }

  getCapsule(id: string): SourceMemoryCapsule {
    const row = this.findCapsule(id);
    if (!row) {
      throw new SourceMemoryCaptureValidationError('Source memory capsule not found.', 404);
    }

    const anchors = this.db
      .prepare(
        `SELECT id, anchor_kind, locator, quote_or_preview, sensitivity, confidence
         FROM source_memory_anchors
         WHERE capsule_id = ?
         ORDER BY created_at ASC`,
      )
      .all(id) as SourceMemoryAnchorRow[];
    const takeaways = this.db
      .prepare(
        `SELECT id, kind, title, body, evidence_anchor_ids_json, confidence, status
         FROM source_memory_takeaways
         WHERE capsule_id = ? AND origin != 'deep_distillation'
         ORDER BY created_at ASC`,
      )
      .all(id) as SourceMemoryTakeawayRow[];
    const triggers = this.db
      .prepare(
        `SELECT id, trigger_kind, description, matcher_json, default_behavior
         FROM source_memory_triggers
         WHERE capsule_id = ? AND origin != 'deep_distillation'
         ORDER BY created_at ASC`,
      )
      .all(id) as SourceMemoryTriggerRow[];

    const linkedMessageId =
      row.status === 'saved' && this.hasLinkedMemorySignal(row.message_id)
        ? row.message_id ?? undefined
        : undefined;
    const linkedSignalActive = Boolean(linkedMessageId);
    const actionEvent = this.getLatestActionEvent(id);

    return {
      id: row.id,
      sourceKind: row.source_kind,
      sourceUrl: row.source_url ?? undefined,
      sourceTitle: row.source_title,
      sourceHost: row.source_host ?? undefined,
      captureMode: row.capture_mode,
      captureReason: row.capture_reason,
      status: row.status,
      scope: row.scope,
      privacyLevel: row.privacy_level,
      summary: row.summary ?? '',
      contentPreview: row.content_preview ?? '',
      messageId: linkedMessageId,
      metadata: parseObject(row.metadata_json ?? '{}'),
      changeLedger: this.changeLedger.getSourceLedger('source_memory', id),
      writeReceipt: buildWriteReceipt({
        sourceKind: row.source_kind,
        captureMode: row.capture_mode,
        scope: row.scope,
        status: row.status,
        linkedSignalActive,
      }),
      actionReceipt: actionEvent
        ? buildActionReceipt(actionEvent, {
            sourceKind: row.source_kind,
            captureMode: row.capture_mode,
            scope: row.scope,
          })
        : undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      savedAt: row.saved_at ?? undefined,
      anchors: anchors.map((anchor) => ({
        id: anchor.id,
        anchorKind: anchor.anchor_kind,
        locator: anchor.locator ?? undefined,
        quoteOrPreview: anchor.quote_or_preview,
        sensitivity: anchor.sensitivity,
        confidence: anchor.confidence,
      })),
      takeaways: takeaways.map((takeaway) => ({
        id: takeaway.id,
        kind: takeaway.kind,
        title: takeaway.title,
        body: takeaway.body,
        evidenceAnchorIds: parseStringArray(takeaway.evidence_anchor_ids_json),
        confidence: takeaway.confidence,
        status: takeaway.status,
      })),
      triggers: triggers.map((trigger) => ({
        id: trigger.id,
        triggerKind: trigger.trigger_kind,
        description: trigger.description,
        matcher: parseObject(trigger.matcher_json),
        defaultBehavior: trigger.default_behavior,
      })),
    };
  }

  distillCapsule(id: string, reason = 'manual'): SourceMemoryCapsule {
    const row = this.findCapsule(id);
    if (!row) {
      throw new SourceMemoryCaptureValidationError('Source memory capsule not found.', 404);
    }
    if (row.status !== 'saved') {
      return this.getCapsule(id);
    }

    const metadata = parseObject(row.metadata_json ?? '{}');
    const evidenceText = this.getEvidenceTextForCapsule(row);
    const anchors = this.db
      .prepare(
        `SELECT id, quote_or_preview
         FROM source_memory_anchors
         WHERE capsule_id = ?
         ORDER BY created_at ASC`,
      )
      .all(id) as SourceMemoryAnchorForDistillation[];
    const takeaways = this.db
      .prepare(
        `SELECT id, kind, title, body, evidence_anchor_ids_json, confidence, status
         FROM source_memory_takeaways
         WHERE capsule_id = ?
         ORDER BY created_at ASC`,
      )
      .all(id) as SourceMemoryTakeawayRow[];
    const triggers = this.db
      .prepare(
        `SELECT id, trigger_kind, description, matcher_json, default_behavior
         FROM source_memory_triggers
         WHERE capsule_id = ?
         ORDER BY created_at ASC`,
      )
      .all(id) as SourceMemoryTriggerRow[];
    const entityHints = normalizeEntityHints(readEntityHints(metadata));
    const inputHash = contentHash(
      [
        row.id,
        row.source_kind,
        row.source_url ?? '',
        row.source_title,
        row.capture_reason,
        row.summary ?? '',
        row.content_preview ?? '',
        evidenceText,
        JSON.stringify(entityHints),
      ].join('\n'),
    );
    const previousDistillation = asRecord(metadata.distillation);
    if (
      previousDistillation.inputHash === inputHash &&
      typeof previousDistillation.status === 'string'
    ) {
      this.enqueueDeepDistillation(id, inputHash, reason);
      return this.getCapsule(id);
    }

    const ts = now();
    const distillation = buildDistillationReceipt({
      row,
      metadata,
      evidenceText,
      anchors,
      takeaways,
      triggerCount: triggers.length,
      entityHints,
      inputHash,
      generatedAt: ts,
    });
    const nextMetadata = {
      ...metadata,
      distillation,
    };
    const distilledLinks = buildDistillationLinks(row, entityHints);
    const transaction = this.db.transaction(() => {
      this.insertEvent(id, 'distillation_started', 'low', row.source_url, {
        reason,
        schemaVersion: distillation.schemaVersion,
        inputHash,
      });

      this.db
        .prepare(
          `UPDATE source_memory_capsules
           SET metadata_json = ?,
               updated_at = ?
           WHERE id = ?`,
        )
        .run(JSON.stringify(nextMetadata), ts, id);

      this.db
        .prepare(
          `UPDATE source_memory_takeaways
           SET status = ?
           WHERE capsule_id = ? AND origin != 'deep_distillation'`,
        )
        .run(distillation.status, id);

      const updateTrigger = this.db.prepare(
        `UPDATE source_memory_triggers
         SET matcher_json = ?,
             default_behavior = ?
         WHERE id = ? AND origin != 'deep_distillation'`,
      );
      for (const trigger of triggers) {
        updateTrigger.run(
          JSON.stringify(
            buildDistilledTriggerMatcher(
              parseObject(trigger.matcher_json),
              row,
              distillation,
              entityHints,
            ),
          ),
          distillation.status === 'ready' ? trigger.default_behavior : 'needs_review',
          trigger.id,
        );
      }

      this.db
        .prepare(
          `DELETE FROM source_memory_links
           WHERE capsule_id = ? AND relation = 'distilled_anchor'`,
        )
        .run(id);
      const insertLink = this.db.prepare(
        `INSERT INTO source_memory_links (
           id, capsule_id, target_type, target_id, relation, confidence, created_at
         ) VALUES (?, ?, ?, ?, 'distilled_anchor', ?, ?)`,
      );
      for (const link of distilledLinks) {
        insertLink.run(
          uuidv4(),
          id,
          link.targetType,
          link.targetId,
          link.confidence,
          ts,
        );
      }

      this.insertEvent(
        id,
        `distillation_${distillation.status}`,
        distillation.status === 'ready' ? 'medium' : 'low',
        row.source_url,
        {
          reason,
          schemaVersion: distillation.schemaVersion,
          inputHash,
          takeawayCount: distillation.takeawayCount,
          triggerCount: distillation.triggerCount,
          linkCount: distilledLinks.length,
        },
      );
    });

    transaction();
    this.enqueueDeepDistillation(id, inputHash, reason);
    return this.getCapsule(id);
  }

  private enqueueDeepDistillation(
    capsuleId: string,
    inputHash: string,
    reason: string,
  ): void {
    try {
      new SourceMemoryDistillationWorker(this.db).enqueue(capsuleId, inputHash, reason);
    } catch (error) {
      console.warn('[SourceMemoryCaptureService] Deep distillation enqueue failed:', error);
    }
  }

  private refreshChangeLedger(id: string): void {
    const row = this.findCapsule(id);
    if (!row) return;
    const metadata = parseObject(row.metadata_json ?? '{}');
    const rawObservedAt = metadata.sourceAsOf ?? metadata.observedAt;
    const observedAt = typeof rawObservedAt === 'number' && Number.isFinite(rawObservedAt)
      ? rawObservedAt > 1e12
        ? Math.floor(rawObservedAt / 1000)
        : Math.floor(rawObservedAt)
      : row.saved_at ?? row.updated_at;
    try {
      this.changeLedger.syncSource({
        sourceRefType: 'source_memory',
        sourceRefId: id,
        sourceTitle: row.source_title,
        sourceUrl: row.source_url ?? undefined,
        sourceKind: row.source_kind,
        text: this.getEvidenceTextForCapsule(row),
        metadata,
        entityHints: normalizeEntityHints(readEntityHints(metadata)),
        observedAt,
        active: row.status === 'saved',
      });
    } catch (error) {
      console.warn('[SourceMemoryCaptureService] Change ledger refresh failed:', error);
    }
  }

  private insertMessageAndChunks(input: {
    messageId: string;
    capsuleId: string;
    content: string;
    summary: string;
    scope: MemoryScope;
    sourceUrl?: string;
    sourceTitle: string;
    sourceHost: string | null;
    captureMode: SourceMemoryCaptureMode;
    metadata: Record<string, unknown>;
    ts: number;
  }): void {
    const messageImportance = getCaptureModeMessageImportance(input.captureMode);
    const chunkImportance = Math.max(0.45, messageImportance - 0.04);
    // Injection defense (P0-2): web-page capsules are untrusted content — the
    // primary "page hides instructions" attack vector. Tag trust + screen for
    // injection patterns here too, since this path bypasses IngestionPipeline.
    const trustClass = classifyTrust('web');
    const screen = screenForInjection(input.content);
    const injectionFlagsJson = screen.flagged
      ? JSON.stringify(screen.flags)
      : null;
    this.db
      .prepare(
        `INSERT INTO messages_raw (
           id, content, summary, scope, source, source_type, source_url,
           source_title, sender, group_id, group_name, timestamp,
           importance, sentiment, metadata_json, trust_class, injection_flags_json,
           created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, 'web', ?, ?, ?, ?, ?, ?, ?, 'neutral', ?, ?, ?, ?, ?)`,
      )
      .run(
        input.messageId,
        input.content,
        input.summary,
        input.scope,
        `source-memory:${input.capsuleId}`,
        input.sourceUrl ?? null,
        input.sourceTitle,
        'Memory Capture',
        input.sourceHost,
        input.sourceHost,
        input.ts,
        messageImportance,
        JSON.stringify({
          ...input.metadata,
          sourceMemoryCapsuleId: input.capsuleId,
          captureLayer: 'memory_capture',
        }),
        trustClass,
        injectionFlagsJson,
        input.ts,
        input.ts,
      );

    const chunks = chunkText(input.content, 220, 40);
    const chunkStmt = this.db.prepare(
      `INSERT INTO chunks (
         file_path, line_start, line_end, content, content_hash, scope, source,
         source_type, related_entity_id, token_count, trust_class, injection_flags_json,
         created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, 'web', ?, ?, ?, ?, ?, ?)`,
    );
    const metadataStmt = this.db.prepare(
      `INSERT INTO memory_metadata (
         target_type, target_id, salience_score, importance,
         consolidation_level, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(target_type, target_id) DO UPDATE SET
         salience_score = excluded.salience_score,
         importance = excluded.importance,
         consolidation_level = excluded.consolidation_level,
         updated_at = excluded.updated_at`,
    );

    metadataStmt.run('message', input.messageId, messageImportance, messageImportance, 'working', input.ts, input.ts);
    for (let index = 0; index < chunks.length; index += 1) {
      const chunk = chunks[index];
      const result = chunkStmt.run(
        `source-memory/${input.capsuleId}.md`,
        chunk.lineStart,
        chunk.lineEnd,
        chunk.content,
        contentHash(`${input.capsuleId}:${index}:${chunk.content}`),
        input.scope,
        `source-memory:${input.capsuleId}`,
        input.messageId,
        chunk.tokenCount,
        trustClass,
        injectionFlagsJson,
        input.ts,
        input.ts,
      );
      metadataStmt.run('chunk', String(result.lastInsertRowid), chunkImportance, chunkImportance, 'working', input.ts, input.ts);
    }
  }

  private removeLinkedMemorySignal(messageId?: string | null): void {
    const normalizedMessageId = normalizeText(messageId);
    if (!normalizedMessageId) return;

    const chunkRows = this.db
      .prepare(`SELECT chunk_id FROM chunks WHERE related_entity_id = ?`)
      .all(normalizedMessageId) as Array<{ chunk_id: number }>;
    const chunkIds = chunkRows.map((row) => String(row.chunk_id));

    this.db
      .prepare(`DELETE FROM memory_metadata WHERE target_type = 'message' AND target_id = ?`)
      .run(normalizedMessageId);

    const deleteChunkMetadata = this.db.prepare(
      `DELETE FROM memory_metadata WHERE target_type = 'chunk' AND target_id = ?`,
    );
    for (const chunkId of chunkIds) {
      deleteChunkMetadata.run(chunkId);
    }

    this.db.prepare(`DELETE FROM chunks WHERE related_entity_id = ?`).run(normalizedMessageId);
    this.db.prepare(`DELETE FROM messages_raw WHERE id = ?`).run(normalizedMessageId);
  }

  private hasLinkedMemorySignal(messageId?: string | null): boolean {
    const normalizedMessageId = normalizeText(messageId);
    if (!normalizedMessageId) return false;

    const row = this.db
      .prepare(`SELECT 1 AS present FROM messages_raw WHERE id = ? LIMIT 1`)
      .get(normalizedMessageId) as { present: number } | undefined;
    return Boolean(row?.present);
  }

  private getLatestActionEvent(capsuleId: string): SourceMemoryActionEventRow | undefined {
    return this.db
      .prepare(
        `SELECT event_type, event_strength, metadata_json, created_at
         FROM source_memory_events
         WHERE capsule_id = ?
           AND event_type NOT LIKE 'distillation_%'
         ORDER BY created_at DESC, rowid DESC
         LIMIT 1`,
      )
      .get(capsuleId) as SourceMemoryActionEventRow | undefined;
  }

  private getEvidenceTextForCapsule(row: SourceMemoryRow): string {
    const existingMessage = row.message_id
      ? (this.db
          .prepare(`SELECT content FROM messages_raw WHERE id = ?`)
          .get(row.message_id) as { content: string } | undefined)
      : undefined;
    return clipText(
      extractStoredEvidenceText(existingMessage?.content) ||
        row.content_preview ||
        row.summary ||
        row.source_title,
      MAX_CAPTURE_TEXT_CHARS,
    );
  }

  private insertEvent(
    capsuleId: string | null,
    eventType: string,
    eventStrength: string,
    sourceUrl?: string | null,
    metadata: Record<string, unknown> = {},
  ): void {
    this.db
      .prepare(
        `INSERT INTO source_memory_events (
           id, capsule_id, event_type, event_strength, source_url,
           metadata_json, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        uuidv4(),
        capsuleId,
        eventType,
        eventStrength,
        sourceUrl ?? null,
        JSON.stringify(metadata),
        now(),
      );
  }

  private writeMarkdownSnapshot(capsuleId: string, content: string, ts: number): void {
    try {
      if (!this.userDataManager?.isInitialized) return;
      const dateStr = formatDate(ts);
      this.userDataManager.appendToFile(
        `daily/${dateStr}.md`,
        `\n\n## Memory Capture\n\n${content}\n`,
        `# Daily Log — ${dateStr}\n\n`,
      );
      this.userDataManager.writeFile(`source-memory/${capsuleId}.md`, content);
    } catch (err) {
      console.warn('[SourceMemoryCaptureService] Markdown snapshot skipped:', err);
    }
  }

  private getSignalText(input: SourceMemoryCandidateInput): string {
    return clipText(
      normalizeText(
        input.selectedText ||
          input.text ||
          [input.sourceTitle, input.nearbyText].filter(Boolean).join('\n'),
      ),
      MAX_CAPTURE_TEXT_CHARS,
    );
  }

  private getBlockedReason(
    text: string,
    sourceUrl?: string,
    rawSourceUrl?: string,
  ): string | undefined {
    if (sourceUrl && SENSITIVE_URL_PATTERN.test(sourceUrl)) {
      return 'Sensitive URL is not eligible for Memory Capture.';
    }
    if (isCredentialBearingSourceUrl(rawSourceUrl || sourceUrl)) {
      return 'Sensitive source URL carries credentials or signed-access parameters and is not eligible for Memory Capture.';
    }
    if (SECRET_PATTERN.test(text)) {
      return 'Selected text appears to contain secrets or credentials.';
    }
    if (LOW_INFORMATION_PATTERN.test(text)) {
      return 'Selected text is too low-signal for Memory Capture.';
    }
    return undefined;
  }

  private findCapsule(id: string): SourceMemoryRow | null {
    return (
      (this.db
        .prepare(
          `SELECT id, source_kind, source_url, source_title, source_host,
                  capture_mode, capture_reason, status, scope, privacy_level,
                  summary, content_preview, message_id, metadata_json,
                  created_at, updated_at, saved_at
           FROM source_memory_capsules
           WHERE id = ?`,
        )
        .get(id) as SourceMemoryRow | undefined) ?? null
    );
  }

  private findCapsuleByFingerprint(fingerprint: string): SourceMemoryRow | null {
    return (
      (this.db
        .prepare(
          `SELECT id, source_kind, source_url, source_title, source_host,
                  capture_mode, capture_reason, status, scope, privacy_level,
                  summary, content_preview, message_id, metadata_json,
                  created_at, updated_at, saved_at
           FROM source_memory_capsules
           WHERE source_fingerprint = ?`,
        )
        .get(fingerprint) as SourceMemoryRow | undefined) ?? null
    );
  }
}

function buildStoredContent(input: {
  sourceTitle: string;
  note: string;
  summary: string;
  text: string;
  sourceUrl?: string;
}): string {
  const lines = [`# ${input.sourceTitle}`, '', `Summary: ${input.summary}`];
  if (input.note) {
    lines.push('', `User note: ${input.note}`);
  }
  if (input.sourceUrl) {
    lines.push('', `Source: ${input.sourceUrl}`);
  }
  lines.push('', '## Evidence', '', input.text);
  return lines.join('\n');
}

function extractStoredEvidenceText(content?: string | null): string {
  const raw = content || '';
  const marker = '\n## Evidence\n';
  const markerIndex = raw.indexOf(marker);
  if (markerIndex < 0) {
    return normalizeText(raw);
  }
  return raw.slice(markerIndex + marker.length).trim();
}

function buildTakeaways(text: string, anchorId: string): SourceMemoryTakeaway[] {
  const sentences = normalizeText(text)
    .split(SENTENCE_SPLIT_PATTERN)
    .map((item) => item.trim())
    .filter((item) => item.length >= 18)
    .slice(0, 3);
  const seed = sentences.length > 0 ? sentences : [clipText(text, 220)];

  return seed.map((sentence, index) => ({
    id: uuidv4(),
    kind: inferTakeawayKind(sentence),
    title: clipText(sentence, 64),
    body: clipText(sentence, 320),
    evidenceAnchorIds: [anchorId],
    confidence: 0.62 - index * 0.04,
    status: 'draft',
  }));
}

function buildTriggers(
  sourceTitle: string,
  sourceUrl?: string,
  entityHints?: Array<{ kind: string; value: string }>,
): SourceMemoryTrigger[] {
  const triggers: SourceMemoryTrigger[] = [];
  const host = sourceUrl ? getHost(sourceUrl) : '';
  if (host) {
    triggers.push({
      id: uuidv4(),
      triggerKind: 'source',
      description: `再次遇到 ${host} 相关资料时安静匹配`,
      matcher: { host },
      defaultBehavior: 'quiet_match',
    });
  }
  for (const hint of (entityHints ?? []).slice(0, 4)) {
    const value = normalizeText(hint.value);
    if (!value) continue;
    triggers.push({
      id: uuidv4(),
      triggerKind: 'entity',
      description: `遇到 ${value} 时可关联这份资料`,
      matcher: { kind: hint.kind, value },
      defaultBehavior: 'quiet_match',
    });
  }
  if (triggers.length === 0) {
    triggers.push({
      id: uuidv4(),
      triggerKind: 'search',
      description: `搜索 ${clipText(sourceTitle, 60)} 时召回`,
      matcher: { title: sourceTitle },
      defaultBehavior: 'quiet_match',
    });
  }
  return triggers;
}

function buildDistillationReceipt(input: {
  row: SourceMemoryRow;
  metadata: Record<string, unknown>;
  evidenceText: string;
  anchors: SourceMemoryAnchorForDistillation[];
  takeaways: SourceMemoryTakeawayRow[];
  triggerCount: number;
  entityHints: Array<{ kind: string; value: string }>;
  inputHash: string;
  generatedAt: number;
}): SourceMemoryDistillationReceipt {
  const evidenceAnchorIds = input.anchors.map((anchor) => anchor.id);
  const hasEvidence =
    hasEnoughSignal(input.evidenceText) ||
    input.anchors.some((anchor) => hasEnoughSignal(anchor.quote_or_preview));
  const status: SourceMemoryDistillationStatus = !hasEvidence
    ? 'blocked'
    : input.row.privacy_level === 'needs_review' || input.takeaways.length === 0
      ? 'partial'
      : 'ready';
  const summary =
    normalizeText(input.row.summary) ||
    summarizeText(input.evidenceText, input.row.source_title);
  const oneLineCue = clipText(
    `已保存资料 · ${input.row.source_title}：${summary}`,
    220,
  );
  const compactMemo = buildDistillationCompactMemo(
    input.row,
    input.evidenceText,
    input.takeaways,
  );

  return {
    status,
    schemaVersion: 1,
    oneLineCue,
    compactMemo,
    policyReceipt: buildDistillationPolicyReceipt(status, {
      anchorCount: evidenceAnchorIds.length,
      takeawayCount: input.takeaways.length,
      triggerCount: input.triggerCount,
      linkCount: buildDistillationLinks(input.row, input.entityHints).length,
      privacyLevel: input.row.privacy_level,
    }),
    sourceReliability: buildDistillationSourceReliability(
      input.row,
      input.metadata,
    ),
    downstreamUse: {
      allowed: [
        'source_memory_detail',
        'context_recall_source_card',
        'reflection_seed',
        'dream_seed',
      ],
      blocked: [
        'auto_profile_write',
        'auto_task_creation',
        'external_write_or_sync',
      ],
    },
    generatedAt: input.generatedAt,
    sourceAsOf: input.row.updated_at || input.row.saved_at || input.generatedAt,
    inputHash: input.inputHash,
    evidenceAnchorIds,
    takeawayCount: input.takeaways.length,
    triggerCount: input.triggerCount,
  };
}

function buildDistillationCompactMemo(
  row: SourceMemoryRow,
  evidenceText: string,
  takeaways: SourceMemoryTakeawayRow[],
): string {
  const lines = [
    `摘要：${normalizeText(row.summary) || summarizeText(evidenceText, row.source_title)}`,
  ];
  for (const takeaway of takeaways.slice(0, 3)) {
    lines.push(`- ${clipText(takeaway.body || takeaway.title, 140)}`);
  }
  if (takeaways.length === 0) {
    lines.push(`- ${clipText(evidenceText || row.content_preview || row.source_title, 140)}`);
  }
  return clipText(lines.join('\n'), 700);
}

function buildDistillationPolicyReceipt(
  status: SourceMemoryDistillationStatus,
  input: {
    anchorCount: number;
    takeawayCount: number;
    triggerCount: number;
    linkCount: number;
    privacyLevel: SourceMemoryPrivacyLevel;
  },
): SourceMemoryDistillationReceipt['policyReceipt'] {
  const evidence = [
    `证据锚点：${input.anchorCount}`,
    `要点：${input.takeawayCount}`,
    `触发线索：${input.triggerCount}`,
    `低副作用链接：${input.linkCount}`,
  ];

  if (status === 'blocked') {
    return {
      state: 'blocked',
      label: '资料蒸馏已阻断',
      detail: '这条资料缺少可用证据锚点，系统只保留原始 capsule，不生成可复用提示。',
      evidence,
      nextStep: '重新保存更完整的资料，或在详情页补充备注后再进入召回。',
    };
  }

  if (status === 'partial') {
    return {
      state: 'partial',
      label: '资料蒸馏需复核',
      detail:
        input.privacyLevel === 'needs_review'
          ? '这条资料带复核隐私级别，只生成受限提示；不会自动写用户画像、创建任务或同步外部平台。'
          : '这条资料的结构化要点不足，只生成受限提示；不会自动写用户画像、创建任务或同步外部平台。',
      evidence,
      nextStep: '在资料详情页复核证据、补备注或补锚点后，再作为 Reflection / Dream 种子使用。',
    };
  }

  return {
    state: 'ready',
    label: '资料蒸馏已就绪',
    detail:
      '已生成一行提示、compact memo、ready takeaways 和安静触发 matcher；只作为证据提示，不自动写用户画像、创建任务或外部写入。',
    evidence,
    nextStep: '后续 Ask、Memory Lens、Reflection 和 Dream 可把它作为带来源的上下文单元引用。',
  };
}

function buildDistillationSourceReliability(
  row: SourceMemoryRow,
  metadata: Record<string, unknown>,
): SourceMemoryDistillationReceipt['sourceReliability'] {
  const interactions = asRecord(metadata.interactions);
  if (
    interactions.ownerAuthored === true &&
    ['jira_comment', 'message_reply', 'web_ai_prompt'].includes(row.source_kind)
  ) {
    return {
      level: 'owner_authored',
      reason: '来源是用户自己写下或发出的资料，可作为用户意图证据处理。',
    };
  }
  if (row.source_kind === 'selection' || row.source_kind === 'webpage') {
    return {
      level: 'source_grounded',
      reason: '来源来自用户保存的网页或选区，需要按外部资料证据处理。',
    };
  }
  if (row.source_kind === 'visual_memory') {
    return {
      level: 'visual_evidence',
      reason: '来源来自用户保存的视觉区域，需要保留原始图表或表格锚点。',
    };
  }
  return {
    level: 'supporting_evidence',
    reason: '来源可作为带出处的支持证据，不自动升格为确定事实。',
  };
}

function buildDistilledTriggerMatcher(
  matcher: Record<string, unknown>,
  row: SourceMemoryRow,
  distillation: SourceMemoryDistillationReceipt,
  entityHints: Array<{ kind: string; value: string }>,
): Record<string, unknown> {
  return {
    ...matcher,
    sourceMemoryDistillation: {
      status: distillation.status,
      schemaVersion: distillation.schemaVersion,
      showAs: distillation.status === 'ready' ? 'quiet_source_cue' : 'review_first',
      budgetTokens: distillation.status === 'ready' ? 80 : 40,
      oneLineCue: distillation.oneLineCue,
    },
    sceneAnchors: {
      sourceKind: row.source_kind,
      sourceHost: row.source_host ?? undefined,
      sourceTitle: row.source_title,
      entities: entityHints,
    },
    suppressionRules: [
      'suppress_on_same_source_url',
      'suppress_after_negative_feedback',
      'suppress_when_capsule_dismissed',
    ],
  };
}

function buildDistillationLinks(
  row: SourceMemoryRow,
  entityHints: Array<{ kind: string; value: string }>,
): SourceMemoryLinkCandidate[] {
  const links: SourceMemoryLinkCandidate[] = [];
  if (row.source_host) {
    links.push({
      targetType: 'source_host',
      targetId: row.source_host,
      confidence: 0.58,
    });
  }
  for (const hint of entityHints.slice(0, 8)) {
    links.push({
      targetType: normalizeLinkTargetType(hint.kind),
      targetId: hint.value,
      confidence: 0.66,
    });
  }
  const seen = new Set<string>();
  return links.filter((link) => {
    const key = `${link.targetType}:${link.targetId.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildPolicyReceipt(
  action: SourceMemoryCandidateResult['suggestedAction'],
  input: { reasons?: string[]; blockedReason?: string; score?: number },
): SourceMemoryCapturePolicyReceipt {
  const rawEvidence = (input.reasons ?? []).filter(Boolean);
  const evidence = [
    ...rawEvidence.filter(isIntentPolicyEvidence),
    ...rawEvidence.filter((item) => !isIntentPolicyEvidence(item)),
  ].slice(0, 4);

  if (action === 'blocked') {
    return {
      state: 'blocked',
      label: '已阻断入库',
      detail: input.blockedReason || '当前资料命中 Memory Capture 阻断规则。',
      evidence,
      nextStep: '不会保存；去掉敏感内容或换普通资料页后再试。',
    };
  }

  if (action === 'ignore') {
    return {
      state: 'ignored_low_signal',
      label: '未提示入库',
      detail: evidence[0] || '当前资料缺少足够可复用信息。',
      evidence,
      nextStep: '继续阅读、复制，或选择更完整的资料段落后再评分。',
    };
  }

  if (action === 'auto_save') {
    return {
      state: 'auto_save_candidate',
      label: '自动入库候选',
      detail: '候选资料具备强意图和低风险信号；前端仍需满足页面级自动阈值。',
      evidence,
      nextStep: '达到自动入库门槛时静默保存，并用轻提示提供撤销。',
    };
  }

  return {
    state: 'suggested_review',
    label: '建议复核入库',
    detail:
      typeof input.score === 'number'
        ? `候选分 ${input.score.toFixed(2)}，需要用户确认后写入。`
        : '资料可能有保存价值，需要用户确认后写入。',
    evidence,
    nextStep: '显示右侧 + 入库；用户可复核、补备注，再确认保存。',
  };
}

function buildWriteReceipt(input: {
  sourceKind: string;
  captureMode: SourceMemoryCaptureMode;
  scope: MemoryScope;
  status: string;
  linkedSignalActive: boolean;
}): SourceMemoryCaptureWriteReceipt {
  const sourceKindLabel = getSourceMemorySourceKindLabel(input.sourceKind);
  const captureModeLabel = getSourceMemoryCaptureModeLabel(input.captureMode);
  const scopeLabel = getSourceMemoryScopeLabel(input.scope);
  const signalLabel = input.sourceKind === 'visual_memory'
    ? '视觉证据检索信号'
    : '网页检索信号';
  const evidence = [
    `资料类型：${sourceKindLabel}`,
    `保存方式：${captureModeLabel}`,
    `范围：${scopeLabel}`,
    `检索信号：${input.linkedSignalActive ? '已启用' : '已关闭'}`,
  ];

  if (input.status === 'dismissed') {
    return {
      state: 'dismissed_no_recall',
      label: '资料召回已关闭',
      detail: `这条 source-memory capsule 仅保留为复核记录；关联 ${signalLabel} 已移除，不再进入 Ask、Memory Lens 或时间轴召回。`,
      evidence,
      nextStep: '如需再次使用这份资料，需要重新保存；撤销状态不会自动外发、插入或同步。',
    };
  }

  if (!input.linkedSignalActive) {
    return {
      state: 'saved_without_recall_signal',
      label: '资料已保存，召回信号缺失',
      detail: `已保留 source-memory capsule，但没有可用的关联 ${signalLabel}；后续召回和搜索不会依赖这条缺失信号。`,
      evidence,
      nextStep: '可在资料详情复核内容，必要时重新保存或补备注；不会自动外发、插入或同步。',
    };
  }

  return {
    state: 'saved_with_recall_signal',
    label: '资料记忆已写入',
    detail: `已创建或更新 source-memory capsule，并写入关联 ${signalLabel}；后续 Ask、Memory Lens 和时间轴可按证据召回。`,
    evidence,
    nextStep: '可在资料详情复核、补备注或撤销；不会自动外发、插入输入框或同步到其他平台。',
  };
}

function buildNoWriteReceipt(
  input: SourceMemoryCreateInput,
  detail: string,
  state: SourceMemoryCaptureNoWriteReceipt['state'],
): SourceMemoryCaptureNoWriteReceipt {
  const sourceKind = input.sourceKind ?? (input.selectedText ? 'selection' : 'webpage');
  const captureMode = input.captureMode ?? 'suggested';
  const scope = input.scope ?? 'work';
  const sourceUrl = normalizeUrl(input.sourceUrl);
  const rawSourceTitle = normalizeText(input.sourceTitle).slice(0, 120);
  const sourceHost = sourceUrl ? getHost(sourceUrl) : '';
  const signalLabel = sourceKind === 'visual_memory'
    ? '视觉证据检索信号'
    : '网页检索信号';
  const sourceLabel = sourceHost || rawSourceTitle || '未提供可保存来源';
  const evidence = [
    `资料类型：${getSourceMemorySourceKindLabel(sourceKind)}`,
    `保存方式：${getSourceMemoryCaptureModeLabel(captureMode)}`,
    `范围：${getSourceMemoryScopeLabel(scope)}`,
    `来源：${sourceLabel}`,
    'source-memory capsule：未创建',
    `${signalLabel}：未写入`,
  ];
  const isBlocked = state === 'blocked_no_write';

  return {
    state,
    label: isBlocked ? '保存已阻断' : '保存未执行',
    detail,
    evidence,
    nextStep: isBlocked
      ? '移除敏感内容或换成普通资料来源后再保存；本次不会外发、插入、同步或写入长期记忆。'
      : '请选择更完整的资料段落后重试；本次不会外发、插入、同步或写入长期记忆。',
  };
}

function buildActionReceipt(
  event: SourceMemoryActionEventRow,
  input: {
    sourceKind: string;
    captureMode: SourceMemoryCaptureMode;
    scope: MemoryScope;
  },
): SourceMemoryCaptureActionReceipt {
  const metadata = parseObject(event.metadata_json ?? '{}');
  const sourceKindLabel = getSourceMemorySourceKindLabel(input.sourceKind);
  const captureModeLabel = getSourceMemoryCaptureModeLabel(input.captureMode);
  const scopeLabel = getSourceMemoryScopeLabel(input.scope);
  const captureReason = normalizeText(String(metadata.captureReason || ''));
  const dismissReason = normalizeText(String(metadata.reason || ''));
  const evidence = [
    `资料类型：${sourceKindLabel}`,
    `保存方式：${captureModeLabel}`,
    `范围：${scopeLabel}`,
    captureReason ? `原因：${captureReason}` : '',
  ].filter(Boolean);
  const base = {
    evidence,
    occurredAt: event.created_at,
  };

  if (event.event_type === 'dismissed') {
    return {
      state: 'dismissed',
      label: '最近操作：资料已撤销',
      detail:
        '最近一次操作关闭了这条资料的关联检索信号；capsule 只保留为复核记录，不再进入 Ask、Memory Lens 或时间轴召回。',
      evidence: [
        ...evidence,
        dismissReason ? `撤销原因：${dismissReason}` : '撤销原因：用户请求',
      ],
      nextStep: '如需再次使用这份资料，需要重新保存；撤销不会删除原网页或外部系统内容。',
      occurredAt: event.created_at,
    };
  }

  if (event.event_type === 'note_updated') {
    return {
      state: 'note_updated',
      label: '最近操作：备注已更新',
      detail:
        metadata.hasNote === false
          ? '最近一次操作清空了资料备注，并刷新同一条 capsule 与关联检索信号。'
          : '最近一次操作更新了资料备注，并刷新同一条 capsule、summary 与关联检索信号。',
      ...base,
      nextStep: '可继续在资料详情复核、补备注或撤销；没有创建第二条资料。',
    };
  }

  if (event.event_type === 'duplicate_save') {
    if (metadata.updatedNote === true) {
      return {
        state: 'duplicate_note_updated',
        label: '最近操作：重复资料已刷新备注',
        detail:
          '最近一次保存命中了已有资料；系统没有创建第二条 capsule，而是更新同一条资料的备注、summary 和关联检索信号。',
        ...base,
        nextStep: '后续召回会使用这条更新后的资料；不会自动外发、插入输入框或同步其他平台。',
      };
    }

    return {
      state: 'duplicate_no_change',
      label: '最近操作：已有资料保持可用',
      detail:
        '最近一次保存命中了已有资料；本次没有新建第二条 capsule，也没有更新备注或正文，只保留已有资料和关联检索信号。',
      ...base,
      nextStep: '可打开详情核对已有资料；如需改变用途，请补备注后重新保存。',
    };
  }

  if (event.event_type === 'resaved') {
    return {
      state: 'resaved',
      label: '最近操作：撤销资料已重新保存',
      detail:
        '最近一次操作重新启用了之前撤销的资料，沿用原 capsule，并重新写入关联检索信号。',
      ...base,
      nextStep: '可在详情页复核新备注、保存方式和召回状态；不会恢复任何外部系统内容。',
    };
  }

  return {
    state: 'saved',
    label: '最近操作：资料已保存',
    detail:
      '最近一次操作创建了 source-memory capsule，并写入关联检索信号，后续可作为带来源证据被召回。',
    ...base,
    nextStep: '可在资料详情复核、补备注或撤销；不会自动外发、插入输入框或同步到其他平台。',
  };
}

function getSourceMemorySourceKindLabel(sourceKind: string): string {
  if (sourceKind === 'selection') return '选区资料';
  if (sourceKind === 'visual_memory') return '视觉证据';
  if (sourceKind === 'jira_comment') return 'Jira 评论资料';
  if (sourceKind === 'message_reply') return '对外回复资料';
  if (sourceKind === 'web_ai_prompt') return '外部 AI 提示资料';
  if (sourceKind === 'manual') return '手动资料';
  return '整页资料';
}

function getSourceMemoryCaptureModeLabel(captureMode: SourceMemoryCaptureMode): string {
  if (captureMode === 'auto') return '自动保存';
  if (captureMode === 'manual') return '主动保存';
  return '建议保存';
}

function getSourceMemoryScopeLabel(scope: MemoryScope): string {
  if (scope === 'personal') return '个人记忆';
  return '工作记忆';
}

function isIntentPolicyEvidence(reason: string): boolean {
  return /用户|选中|复制|停留|阅读|重复访问|实体线索/.test(reason);
}

function inferTakeawayKind(text: string): string {
  if (/risk|风险|block|阻塞|issue|问题/i.test(text)) return 'risk';
  if (/workflow|流程|步骤|how to|怎么|如何/i.test(text)) return 'workflow';
  if (/decision|决定|结论|approved|确认/i.test(text)) return 'decision_input';
  if (/tool|capability|能力|工具|feature|功能/i.test(text)) return 'tool_capability';
  return 'concept';
}

function hasEnoughSignal(text: string): boolean {
  const normalized = normalizeText(text);
  if (normalized.length >= MIN_SIGNAL_CHARS && /[A-Za-z0-9]/.test(normalized)) {
    return true;
  }
  const cjkCount = (normalized.match(/[\u3400-\u9fff]/g) ?? []).length;
  return cjkCount >= MIN_CJK_SIGNAL_CHARS;
}

function summarizeText(text: string, fallbackTitle: string): string {
  const firstSentence = normalizeText(text).split(SENTENCE_SPLIT_PATTERN)[0] ?? '';
  return clipText(firstSentence || fallbackTitle, 180);
}

function normalizeText(text?: string | null): string {
  return (text || '').replace(/\s+/g, ' ').trim();
}

function normalizeEntityHints(
  entityHints?: Array<{ kind?: string; value?: string }> | unknown,
): Array<{ kind: string; value: string }> {
  if (!Array.isArray(entityHints)) return [];
  const normalized: Array<{ kind: string; value: string }> = [];
  for (const hint of entityHints) {
    if (!hint || typeof hint !== 'object') continue;
    const record = hint as Record<string, unknown>;
    const kind = normalizeLinkTargetType(
      typeof record.kind === 'string' ? record.kind : 'entity',
    );
    const value = clipText(
      normalizeText(typeof record.value === 'string' ? record.value : ''),
      160,
    );
    if (!value) continue;
    normalized.push({ kind, value });
  }
  return normalized.slice(0, 12);
}

function readEntityHints(metadata: Record<string, unknown>): unknown {
  return metadata.entityHints;
}

function normalizeLinkTargetType(value: string): string {
  const normalized = normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return normalized || 'entity';
}

function clipText(text: string, maxLength: number): string {
  const normalized = normalizeText(text);
  return normalized.length > maxLength
    ? `${normalized.slice(0, Math.max(0, maxLength - 1))}…`
    : normalized;
}

function normalizeUrl(value?: string): string | undefined {
  const raw = normalizeText(value);
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined;
    url.username = '';
    url.password = '';
    url.hash = '';
    return url.toString();
  } catch {
    return undefined;
  }
}

function isCredentialBearingSourceUrl(value?: string): boolean {
  const raw = normalizeText(value);
  if (!raw) return false;
  try {
    const url = new URL(raw);
    if (url.username || url.password) return true;

    const hasSensitiveParam = (params: URLSearchParams): boolean => {
      for (const key of params.keys()) {
        const normalizedKey = key.trim();
        if (!normalizedKey) continue;
        if (SENSITIVE_URL_PARAM_PATTERN.test(normalizedKey)) return true;
        if (
          normalizedKey.toLowerCase() === 'code' &&
          OAUTH_CODE_CONTEXT_PATTERN.test(raw)
        ) {
          return true;
        }
      }
      return false;
    };

    if (hasSensitiveParam(url.searchParams)) return true;

    const hash = url.hash.replace(/^#/, '');
    if (!hash || !hash.includes('=')) return false;
    const hashQuery = hash.includes('?')
      ? hash.slice(hash.indexOf('?') + 1)
      : hash;
    return hasSensitiveParam(new URLSearchParams(hashQuery));
  } catch {
    return false;
  }
}

function getHost(sourceUrl?: string): string {
  if (!sourceUrl) return '';
  try {
    return new URL(sourceUrl).hostname.toLowerCase();
  } catch {
    return '';
  }
}

function roundScore(score: number): number {
  return Math.round(score * 100) / 100;
}

function parseStringArray(raw: string): string[] {
  try {
    const value = JSON.parse(raw);
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string')
      : [];
  } catch {
    return [];
  }
}

function parseObject(raw: string): Record<string, unknown> {
  try {
    const value = JSON.parse(raw);
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function hasVisualMetadataUpgrade(
  existingMetadata: Record<string, unknown>,
  nextMetadata: Record<string, unknown>,
): boolean {
  const existingVisual = asRecord(existingMetadata.visualMemory);
  const nextVisual = asRecord(nextMetadata.visualMemory);
  if (!Object.keys(nextVisual).length) {
    return false;
  }

  const existingSvg = asRecord(existingVisual.svg);
  const nextSvg = asRecord(nextVisual.svg);
  if (!existingSvg.markup && typeof nextSvg.markup === 'string' && nextSvg.markup.trim()) {
    return true;
  }

  const existingTable = asRecord(existingVisual.table);
  const nextTable = asRecord(nextVisual.table);
  if (
    !Array.isArray(existingTable.rows) &&
    Array.isArray(nextTable.rows) &&
    nextTable.rows.length > 0
  ) {
    return true;
  }

  return false;
}
